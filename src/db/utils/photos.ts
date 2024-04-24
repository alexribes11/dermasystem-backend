import { DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import s3 from "../s3-client";
import { Photo } from "../../types/Photo";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const getPhotoUrl = async (photo: Photo) => {
  const command = new GetObjectCommand({
    Bucket: process.env.BUCKET_NAME ?? '',
    Key: photo.id
  });

  const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
  return url;
}

export const uploadPhoto = async () => {

}

export const deletePhoto = async (photo: Photo) => {
  console.log('Deleting photo: ', JSON.stringify(photo));
  await s3.send(new DeleteObjectCommand({
    Bucket: process.env.BUCKET_NAME,
    Key: photo.id,
  }));
}