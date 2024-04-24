import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import dynamoObj from "../dynamo-client";
import { User } from "../../types/User";

export async function fetchUser(userId: string) {

  const getCommand = new GetCommand({
    TableName: 'users',
    Key: {
      id: userId
    }
  });

  const getResponse = await dynamoObj.doc.send(getCommand);
  const user = getResponse.Item;

  if (!user) return undefined;

  return user as User;
  
}

export async function updateUser(user: User) {

  const putCommand = new PutCommand({
    TableName: 'users',
    Item: user
  });

  await dynamoObj.doc.send(putCommand);

}