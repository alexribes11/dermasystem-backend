import { RequestHandler, Router } from "express";
import dotenv from 'dotenv';
import createHttpError from "http-errors";
import fs from 'fs';
import crypto from 'crypto';
import { PutObjectCommand } from "@aws-sdk/client-s3";
import s3 from "../db/s3-client";
import { fetchUser, updateUser } from "../db/utils/user";
import { deletePhoto, getPhotoUrl } from "../db/utils/photos";
import { Session, SessionData } from "express-session";
import { canAccessPatient } from "./patients";
import { Photo } from "../types/Photo";
import { User } from "../types/User";
import { isLoggedIn } from "./auth";
dotenv.config();

const ImageRouter = Router();

const generateImageID = (bytes = 32) => crypto.randomBytes(bytes).toString('hex');

export const uploadImageToS3:RequestHandler = async (req, res, next) => {

  try {    

    // Throw an UNAUTHORIZED error if the user is not signed in. 
    const { userId, role, firstName, lastName } = req.session as SessionData;
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
    const newImage: Photo = {
      id: imageID, 
      dateDeleted: null, 
      datePermanentDelete: null,
      dateUploaded: curDate, 
      deletedBy: null,
      uploadedBy: {
        id: userId,
        name: `${firstName} ${lastName}`,
        role: role
      },
      patientId,
      diagnosis: "N/A"
    };

    const newPhotos = [...patient.photos, newImage]
    updateUser({...patient, photos: newPhotos});

    console.log("=============================================")
    next();
  }
  catch (error) {
    next(error);
  }
};


ImageRouter.get('/:patientId', isLoggedIn, async (req, res, next) => {

  try {

    const {userId} = req.session as SessionData;

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
    const patientPhotos = patient.photos ?? [];

    // Filter and delete any photos that are past their expiration date
    const activePhotos = patientPhotos.filter(async (photo) => {
      if (!photo.dateDeleted) {
        return true; 
      }
      if (curDate > new Date(photo.datePermanentDelete ?? "")) {
        await deletePhoto(patient, photo);
        return false;
      }
      if (user.userRole === "admin") {
        return true;
      } else {
        return false;
      }
    });

    await updateUser({
      ...patient,
      photos: activePhotos
    });

    const photosToSend = [];

    for (var photo of activePhotos) {

      if (photo.dateDeleted !== null && user.userRole !== "admin") {
        continue;
      }

      const url = await getPhotoUrl(photo);

      photosToSend.push({
        ...photo,
        imgUrl: url,
        patientName: `${patient.firstName} ${patient.lastName}`
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
ImageRouter.put('/scheduleDelete/:patientId/:imageId', async (req, res, next) => {

  console.log("Called PUT /scheduleDelete/:patientId/:imageId");

  try {
    
    const { userId } = req.session as SessionData;
    const user = await fetchUser(userId) as User;
    console.log("User:", user);

    if (user.userRole !== "admin" && user.userRole !== "doctor") {
      throw createHttpError(403, "Unauthorized to access this route");
    }

    const { patientId, imageId } = req.params;
    const patient = await fetchUser(patientId);
    console.log("Patient:", patient);

    if (!patient) {
      throw createHttpError(404, "Patient not found");
    }

    if (!canAccessPatient(user, patient)) {
      throw createHttpError(403, "Unathorized to access patient data");
    }

    const photos = patient.photos ?? [];

    const updatedPhotos = photos.map(photo => {
      if (photo.id !== imageId) return photo;
      const dateDeleted = (new Date()).toString();
      const datePermanentDelete = new Date((new Date()).valueOf() + 30*24*60*60*1000).toString();
      const deletedBy = {
        id: userId,
        name: `${user.firstName} ${user.lastName}`,
        role: user.userRole
      }
      return {...photo, dateDeleted, datePermanentDelete, deletedBy};
    })

    patient.photos = updatedPhotos;

    updateUser(patient);

    res.status(200).send();

  }

  catch(error) {
    next(error);
  }

});

// Note
ImageRouter.put('/recover/:patientId', async (req, res, next) => {

  console.log("Called PUT /recover/:patientId");

  try {
    
    const { userId } = req.session as SessionData;
    const user = await fetchUser(userId) as User;
    console.log("User:", user);

    if (user.userRole !== "admin") {
      throw createHttpError(403, "Unauthorized to access this route");
    }

    const { patientId } = req.params;
    const patient = await fetchUser(patientId);
    console.log("Patient:", patient);

    if (!patient) {
      throw createHttpError(404, "Patient not found");
    }

    if (!canAccessPatient(user, patient)) {
      throw createHttpError(403, "Unathorized to access patient data");
    }

    const image = req.body.image as Photo;

    const updatedPhoto: Photo = {
      ...image,
      dateDeleted: null,
      datePermanentDelete: null,
      deletedBy: null
    }

    const photos = patient.photos ?? [];
    const updatedPhotos = photos.map(photo => {
      if (photo.id !== updatedPhoto.id) return photo;
      return updatedPhoto;
    });
    
    patient.photos = updatedPhotos;

    updateUser(patient);

  }

  catch(error) {
    next(error);
  }

});

/**
 * Endpoint used by doctors to publish a diagnosis
 */
ImageRouter.put('/publishDiagnosis/:patientId/:imageId', async(req, res, next) => {

  console.log("Calling PUT /publishDiagnosis");

  // Get the logged-in user's data
  const { userId } = req.session as SessionData;
  const user = await fetchUser(userId);

  // Verify that the user is a doctor
  if (user?.userRole !== "doctor") {
    throw createHttpError(403, "Not authorized to access this route");
  }

  // Get the patient's data, if it exists
  const { patientId } = req.params;
  const patient = await fetchUser(patientId);
  if (!patient) {
    throw createHttpError(404, "Patient not found");
  }

  // Verify that the doctor is authorized to access the patient's data
  if (!canAccessPatient(user, patient)) {
    throw createHttpError(403, "Not authorized to access patient data");
  }

  const { diagnosis } = req.body;
  if (!diagnosis) {
    throw createHttpError(400, "Diagnosis expected in request body");
  }

  const { imageId: photoId } = req.params;
  const photos = patient.photos ?? [];
  const updatedPhotos = photos.map((photo) => {
    if (photo.id !== photoId) return photo;
    return {...photo, diagnosis}
  });
  patient.photos = updatedPhotos;
  updateUser(patient)
});

/**
 * Endpoint used by doctors to hide a diagnosis
 */
ImageRouter.put('/hideDiagnosis/:patientId/:imageId', async(req, res, next) => {

  console.log("Calling PUT /publishDiagnosis");

  // Get the logged-in user's data
  const { userId } = req.session as SessionData;
  const user = await fetchUser(userId);

  // Verify that the user is a doctor
  if (user?.userRole !== "doctor") {
    throw createHttpError(403, "Not authorized to access this route");
  }

  // Get the patient's data, if it exists
  const { patientId } = req.params;
  const patient = await fetchUser(patientId);
  if (!patient) {
    throw createHttpError(404, "Patient not found");
  }

  // Verify that the doctor is authorized to access the patient's data
  if (!canAccessPatient(user, patient)) {
    throw createHttpError(403, "Not authorized to access patient data");
  }
  
  const { imageId: photoId } = req.params;
  const photos = patient.photos ?? [];
  const updatedPhotos = photos.map((photo) => {
    if (photo.id !== photoId) return photo;
    return {...photo, diagnosis: "N/A"}
  });

  patient.photos = updatedPhotos;
  updateUser(patient)
});

export default ImageRouter;