import dotenv from 'dotenv';
import { S3Client } from '@aws-sdk/client-s3'; 

dotenv.config();

const REGION = process.env.REGION ?? '';
const ACCESS_KEY = process.env.ACCESS_KEY ?? '';
const SECRET_KEY = process.env.SECRET_KEY ?? '';

const s3 = new S3Client({
  credentials: {
    accessKeyId: ACCESS_KEY,
    secretAccessKey: SECRET_KEY
  },
  region: REGION
});

export default s3;