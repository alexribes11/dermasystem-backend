import createHttpError from "http-errors";
import { Hospital } from "../../types/Hospital";
import dynamoObj from "../dynamo-client";
import { PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import crypto from 'crypto';

export async function createHospital(hospital: Hospital): Promise<Hospital> {
  
  const { hospitalName, address } = hospital;

  if (!hospitalName) {
    throw createHttpError(400, "'name' field required in request body.");
  }

  if (!address) {
    throw createHttpError(400, "'address' field required in request body.");
  }

  if (!address.street) {
    throw createHttpError(400, "'street' field required in 'address'.");
  }

  if (!address.city) {
    throw createHttpError(400, "'city' field required in 'address'.");
  }

  if (!address.state) {
    throw createHttpError(400, "'state' field required in 'address'.");
  }

  if (!address.zipcode) {
    throw createHttpError(400, "'zipcode' field required in 'address'.");
  }

  /* Check if there already exists a hospital with the given name and address */
  const getResponse = await dynamoObj.client.send(
    new ScanCommand({
      TableName: "hospitals",
      FilterExpression: "hospitalName = :n AND address = :a",
      ExpressionAttributeValues: {
        ":n": hospitalName,
        ":a": address
        }
    })
  ); 

  console.log("Get Response: ");
  console.log(getResponse);

  if (getResponse.Count && getResponse.Count > 0) {
    throw createHttpError(409, "Hospital already exists");
  }

  const hospitalId = crypto.randomUUID();

    await dynamoObj.client.send(
    new PutCommand({
      TableName: "hospitals",
      Item: {
        id: hospitalId,
        hospitalName: hospitalName,
        address,
      }
    })
  );

  return {...hospital, id: hospitalId};
}