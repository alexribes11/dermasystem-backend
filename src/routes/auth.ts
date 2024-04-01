import { Router } from "express";
import { DynamoDBClient, } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import createHttpError from "http-errors";
import crypto from 'crypto';
import bcrypt, { hash } from 'bcrypt';

const AuthRouter = Router();

const client = new DynamoDBClient({
  region: "us-east-1"
});

const docClient = DynamoDBDocumentClient.from(client);

AuthRouter.post("/login", async (req, res, next) => {

  res.json({
    msg: "Logged in!",
    data: null});

  try {
    const { username, password } = req.body;

    if (!username) {
      throw createHttpError(400, "Username required in request body");
    }
    
    if (!password) {
      throw createHttpError(400, "Password required in request body");
    }

    console.log("BEFORE call docClient.send()");

    const getResponse = await docClient.send(
      new ScanCommand({
        TableName: "users",
        FilterExpression: "username = :username",
        ExpressionAttributeValues: {
          ":username": username
         }
      })
    );

    console.log("AFTER call docClient.send()");

    const results = getResponse.Items;

    if (!results) {
      throw createHttpError(403, "Username or password incorrect");
    }

    const user = results[0]

    console.log("BEFORE bcrypt.compare() the req body's password to the database user's password");

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      throw createHttpError(403, "Username or password incorrect");
    }

    console.log("BEFORE call res.json({success: was able to log in})");
    /*
    res.json({
      msg: "Logged in!",
      user
    });
    */

  }

  catch(error) {
    next(error);
  }
})

AuthRouter.post("/register", async (req, res, next) => {
  try {
    const { firstName, lastName, role, username, password, email } = req.body;

    if (!firstName) {
      throw createHttpError(400, "First Name required in request body")
    }

    if (!lastName) {
      throw createHttpError(400, "Last Name required in request body")
    }

    if (!role) {
      throw createHttpError(400, "Role required in request body");
    }

    if (!username) {
      throw createHttpError(400, "Username required in request body");
    }
    
    if (!password) {
      throw createHttpError(400, "Password required in request body");
    }

    if (!email) {
      throw createHttpError(400, "Email required in request body");
    }

    const userID = crypto.randomUUID();
    const hashedPassword = await bcrypt.hash(password, 10);

    const putCommand = new PutCommand({
      TableName: "users",
      Item: {
        id: userID,
        firstName,
        lastName,
        role,
        username,
        password: hashedPassword,
        email
      }
    });

    // No error means the PUT command was successful
    await docClient.send(putCommand);

    const getResponse = await docClient.send(
      new GetCommand({
        TableName: "users",
        Key: {
          id: userID
        }
      })
    ); 

    console.log(getResponse);
    res.status(200).json({
      result: getResponse
    });
  } catch(error) {
    next(error);
  }
})

export default AuthRouter;