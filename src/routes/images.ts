import { RequestHandler, Router } from "express";
import dotenv from 'dotenv';
import createHttpError from "http-errors";
import fs from 'fs';
import crypto from 'crypto';
import { GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import s3 from "../db/s3-client";
import { PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import dynamoObj from "../db/dynamo-client";
import { fetchUser, updateUser } from "../db/utils/user";
import { deletePhoto, getPhotoUrl } from "../db/utils/photos";
import { SessionData } from "express-session";
import { canAccessPatient } from "./patients";
dotenv.config();

const ImageRouter = Router();

const generateImageID = (bytes = 32) => crypto.randomBytes(bytes).toString('hex');

export const uploadImageToS3:RequestHandler = async (req, res, next) => {

  try {    

    // Throw an UNAUTHORIZED error if the user is not signed in. 
    const { userId, role } = req.session as SessionData;
    const { patientId } = req.body;

    if (!userId) {
      throw createHttpError(403, 'Must be signed in to upload images');
    }

    // Throw an UNAUTHORIZED error if the user is a patient.
    if (role === "patient") {
      throw createHttpError(403, 'Patients are not permitted to upload images')
    }

    // Fetch the patients's data
    const patient = await fetchUser(patientId);
    if (!patient) {
      throw createHttpError(404, "Patient not found");
    };

    console.log(patient);
    console.log(patient.photos);

    // Throw a BAD REQUEST error if the file path was not provided
    if (!req.file || !req.file.path) {
      throw createHttpError(400, "File path must be included in body");
    }

    // Generate the PUT parameters for uploading the image to the S3 bucket.
    const fileBuffer = fs.readFileSync(req.file.path);
    const imageID = generateImageID();
    const s3PutParams = {
      Bucket: process.env.BUCKET_NAME,
      Key: imageID,
      Body: fileBuffer,
      ContentType: req.file?.mimetype,
      DeletedDate: null,
    }

    // Send the command to upload the image to S3
    const command = new PutObjectCommand(s3PutParams);
    await s3.send(command);
    
    // Upload the image's metadata to DynamoDB
    const curDate = (new Date()).toString();
    const newImage = {id: imageID, dateDeleted: null, dateUploaded: curDate};

    const newPhotos = [...patient.photos, newImage]
    updateUser({...patient, photos: newPhotos});

    console.log("=============================================")
    next();
  }
  catch (error) {
    next(error);
  }
};


ImageRouter.get('/:patientId', async (req, res, next) => {

  try {

    // Throw an UNAUTHORIZED error if the user is not signed in. 
    const { userId, role } = req.session;
    if (!userId || !role) {
      throw createHttpError(403, "Must be signed in to view images");
    }

    // Fetch the user's data.
    const user = await fetchUser(userId);
    if (!user) {
      throw createHttpError(404, 'User not found');
    }

    // Fetch the patient's data.
    const { patientId } = req.params;
    const patient = await fetchUser(patientId);
    if (!patient) {
      throw createHttpError(404, 'Patient not found');
    }

    // Verify that the user is authorized to view the patient's data
    const authorized = canAccessPatient(user, patient);
    if (!authorized) {
      throw createHttpError(403, "Not authorized to view patient images");
    }

    const curDate = new Date();
    
    // Filter and delete any photos that are past their expiration date
    const activePhotos = patient.photos.filter(async (photo) => {
      if (!photo.dateDeleted) {
        return true; 
      }
      if (new Date(photo.dateDeleted) > curDate) {
        await deletePhoto(photo);
        return false;
      }
      if (role === "admin") {
        return true;
      } else {
        return false;
      }
    })

    await updateUser({
      ...patient,
      photos: activePhotos
    });

    const photosToSend = [];

    for (var photo of activePhotos) {

      if (photo.dateDeleted !== null && role !== "admin") {
        continue;
      }

      const url = await getPhotoUrl(photo);

      photosToSend.push({
        patientId: patientId,
        patientName: `${patient.firstName} ${patient.lastName}`,
        imgUrl: url,
        dateUploaded: (photo.dateUploaded),
      });
      
    }

    res.status(200).json({
      photos: photosToSend
    });
    
  }
  
  catch(error) {
    next(error);
  }

});

// Note
ImageRouter.put('/scheduleDelete', async (req, res, next) => {

  try {
    const { userId } = req.session;

    // Throw an UNAUTHORIZED error if the user is not signed in. 
    if (!userId) {
      throw createHttpError(403, "Must be signed in to view images");
    }

    console.log("req.body=", req.body);
    const photoToScheduleDelete = req.body.photoToScheduleDelete;
    console.log("photoToScheduleDelete=", photoToScheduleDelete);

    const getUserCommand = new ScanCommand({
      TableName: "users",
      FilterExpression: "id = :id",
      ExpressionAttributeValues: {
        ":id": req.session.userId ?? 'janedoe1'
       }
    });

    const getResponse = await dynamoObj.doc.send(getUserCommand);
    const items = getResponse.Items;
    if (!items || items.length === 0) {
      throw createHttpError(404, "User not found");
    };

    const userInfo = items[0];
    console.log(userInfo);

    const newUserPhotos = userInfo.photos;
    let foundRequestedPhoto = false;
    for (let i=0; i < newUserPhotos.length; i++) {
      const curPhotoImageUrl = (typeof(newUserPhotos[i])=="string" ? newUserPhotos[i] : newUserPhotos[i].imgUrl);
      if  (curPhotoImageUrl == photoToScheduleDelete) {
        console.log("newUserPhotos[i].imageUrl=", curPhotoImageUrl);
        const newDeletionDate = new Date((new Date()).valueOf() + 30*24*60*60*1000).toString();
        if (typeof(newUserPhotos[i])=="string") {
          newUserPhotos[i] = {imageUrl: curPhotoImageUrl, DeletionDate: newDeletionDate};
        } else {
          newUserPhotos[i].DeletionDate = newDeletionDate;
        }
        foundRequestedPhoto = true;
      }
    }

    console.log("newUserPhotos=", newUserPhotos);

    const putCommand = new PutCommand({
      TableName: 'users',
      Item: {
        ...userInfo,
        photos: newUserPhotos
      }
    });
    
    await dynamoObj.doc.send(putCommand);



    // Find the photo in the S3 database with photoId of photoToScheduleDelete,
    // and change its DeletionDate property from null
    // to 30 days ahead of the current time.

    // Obviously, if the DeletionDate property was not null,
    // then set the DeletionDate property to min of (DeletionDate property,
    // 30 days ahead of the current time)

    console.log("RIGHT BEFORE sending status 200 to response")
    res.status(200).send();
    return;
  }

  catch(error) {
    next(error);
  }

});

export default ImageRouter;