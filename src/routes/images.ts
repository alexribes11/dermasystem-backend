import { RequestHandler, Router } from "express";
import dotenv from 'dotenv';
import createHttpError from "http-errors";
import fs from 'fs';
import crypto from 'crypto';
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import s3 from "../db/s3-client";
import { GetCommand, PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import dynamo from "../db/dynamo-client";
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
      ContentType: req.file?.mimetype
    }

    const command = new PutObjectCommand(params);
    await s3.send(command);

    const getUserCommand = new ScanCommand({
      TableName: "users",
      FilterExpression: "id = :id",
      ExpressionAttributeValues: {
        ":id": req.session.userId ?? 'janedoe1'
       }
    });

    const getResponse = await dynamo.send(getUserCommand);
    const items = getResponse.Items;
    if (!items || items.length === 0) {
      throw createHttpError(404, "User not found");
    };

    const userInfo = items[0];
    console.log(userInfo);
    console.log(userInfo.photos);

    const putCommand = new PutCommand({
      TableName: 'users',
      Item: {
        ...userInfo,
        photos: [...userInfo.photos, imageName]
      }
    });
    
    await dynamo.send(putCommand);

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

    const response = await dynamo.send(getCommand);
    console.log('Response:');
    console.log(response);
    const user = response.Item;
    if (!user) {
      throw createHttpError(404, 'User not found');
    }

    const photos = [];

    for (const photo of user.photos) {
      const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: photo
      })
      const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
      photos.push({
        patientId: user.userId,
        patientName: user.firstName + ' ' + user.lastName,
        imageUrl: url,
        dateUploaded: "01/01/01"
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

export default ImageRouter;