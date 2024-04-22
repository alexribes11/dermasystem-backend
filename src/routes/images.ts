import { RequestHandler, Router } from "express";
import dotenv from 'dotenv';
import createHttpError from "http-errors";
import fs from 'fs';
import crypto from 'crypto';
import { GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import s3 from "../db/s3-client";
import { GetCommand, PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import dynamoObj from "../db/dynamo-client";
dotenv.config();

const ImageRouter = Router();

const BUCKET_NAME = process.env.BUCKET_NAME ?? '';

const randomImageName = (bytes = 32) => crypto.randomBytes(bytes).toString('hex');

export const uploadImageToS3:RequestHandler = async (req, res, next) => {
  try {
    console.log("=============================================")
    console.log("Running uploadImageToS3...");
    console.log("User session: ");
    console.log(req.session);
    console.log("User ID: ", req.session.userId);
    const fileBuffer = fs.readFileSync(req.file?.path ?? '');
    console.log(fileBuffer);
    const imageName = randomImageName();

    const params = {
      Bucket: process.env.BUCKET_NAME,
      Key: imageName,
      Body: fileBuffer,
      ContentType: req.file?.mimetype,
      DeletedDate: null,
    }

    const command = new PutObjectCommand(params);
    // Add image (with a random name like '3f592') to the s3 database
    await s3.send(command);

    console.log("req.session=", req.session);
    console.log("req.session.userId=", req.session.userId);

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
    console.log(userInfo.photos);

    const curDate = (new Date()).toString();

    const newImageObj = {imgUrl: imageName, DeletionDate: null, dateUploaded: curDate};

    // It used to be: add imageName to the "photos" array.
    const putCommand = new PutCommand({
      TableName: 'users',
      Item: {
        ...userInfo,
        photos: [...userInfo.photos, newImageObj]
      }
    });
    
    await dynamoObj.doc.send(putCommand);

    console.log("=============================================")
    next();
  }
  catch (error) {
    next(error);
  }
};
ImageRouter.get('/', async (req, res, next) => {

  try {

    const { userId } = req.session;
    console.log("userId=", userId);

    // Throw an UNAUTHORIZED error if the user is not signed in. 
    if (!userId) {
      throw createHttpError(403, "Must be signed in to view images");
    }

    const getCommand = new GetCommand({
      TableName: 'users',
      Key: {
        id: userId
      }
    });

    const response = await dynamoObj.doc.send(getCommand);
    console.log('GET users photos: Response:');
    console.log(response);
    const user = response.Item;
    if (!user) {
      throw createHttpError(404, 'User not found');
    }

    const photos = [];

    const curDate = new Date();

    const curDate = new Date();

    // newUserPhotos is the new version of user.photos
    // in the database.
    let newUserPhotos = user.photos;
    const userPhotosLength = user.photos.length;

    const newDeletionDate = new Date((new Date()).valueOf() + 30*24*60*60*1000);
    console.log("newDeletionDate=", newDeletionDate, " typeof()=", typeof(newDeletionDate));
    
    for (let i = userPhotosLength-1; i >= 0; i--) {
      const photo = user.photos[i];
      console.log("IN check the deletion date, photo=", photo);
      if (typeof(photo) != "string") {
        console.log(photo.DeletionDate, " ", typeof(photo.DeletionDate));
      }
      if (photo.DeletionDate!=null && (new Date(photo.DeletionDate)) < curDate) {
        console.log("we will delete this photo")
        newUserPhotos.splice(i, 1);

        // Delete the image from the S3 database of images.
        const params = {
          Bucket: process.env.BUCKET_NAME,
          Key: photo.imageName,
        }
        const command = new DeleteObjectCommand(params);
        
        await s3.send(command);
      }
    } // End of for loop.

    const putCommand = new PutCommand({
      TableName: 'users',
      Item: {
        ...user,
        photos: newUserPhotos
      }
    });
    await dynamoObj.doc.send(putCommand);





    for (let i = 0; i < user.photos.length; i++) {
      // changed "photo" from a constant to a non-constant variable
      // "const photo" --> "let photo"
      let photo = user.photos[i];
      if (typeof(photo) == "string") {
        photo = {imgUrl: photo}
      }


      if (photo.DeletionDate!=null) {
        // the photo is scheduled to be deleted,
        // which means that we should not show it in 

        // However, just in case the doctor wants to un-delete this image
        // recover, before it is deleted from the S3 database,
        // we should keep this photo in the DynamoDB database photos array.
        continue;
      }

      const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: photo.imgUrl
      });
      const url = await getSignedUrl(s3, command, { expiresIn: 3600 });

      // Need to handle the case where the logged-in user is a patient,
      // VS the logged-in user is not a patient, differently.

      let patientId = "";
      let patientName = "";
      if (user.role == "patient") {
        patientId = user.userId;
        patientName = user.firstName + ' ' + user.lastName;
      } else {
        
      }
      photos.push({
        patientId: patientId,
        patientName: patientName,
        displayImageUrl: url,
        dateUploaded: (photo.dateUploaded ? photo.dateUploaded : "Date Uploaded: N/A"),
        imageUrl: photo.imgUrl
      });
    }

    res.status(200).json({
      photos
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