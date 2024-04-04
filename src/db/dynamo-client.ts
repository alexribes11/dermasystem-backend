import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import dotenv from 'dotenv';

dotenv.config();

const dynamo = new DynamoDBClient({
  credentials: {
    accessKeyId: process.env.DYNAMO_ACCESS_KEY ?? '',
    secretAccessKey: process.env.DYNAMO_SECRET_KEY ?? ''
  },
  region: process.env.DYNAMO_REGION
});

export default dynamo;