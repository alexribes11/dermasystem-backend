import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocument } from "@aws-sdk/lib-dynamodb";
import dotenv from 'dotenv';

dotenv.config();

const dynamo = new DynamoDBClient({
  credentials: {
    accessKeyId: process.env.DYNAMO_ACCESS_KEY ?? '',
    secretAccessKey: process.env.DYNAMO_SECRET_KEY ?? ''
  },
  region: process.env.DYNAMO_REGION
});

const marshallOptions = {convertClassInstanceToMap: true};
const unmarshallOptions = {};
const translateConfig = {marshallOptions, unmarshallOptions};

const dynamodb =  DynamoDBDocument.from(dynamo, translateConfig);
// export default dynamo;

const dynamoObj = {client: dynamo, doc: dynamodb};
export default dynamoObj;