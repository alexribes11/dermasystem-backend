import { RequestHandler, Router } from "express";
import { GetCommand, PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import createHttpError from "http-errors";
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import dynamoObj from "../db/dynamo-client";

const AuthRouter = Router();

/**
 * Middleware for determining whether the user is currently authenticated.
 */
export const isLoggedIn: RequestHandler = (req, res, next) => {

  try {
    if (req.session.userId) {
      next();
    } else {
      // throw createHttpError(403, "Please login to continue");
      console.log("RUN isLoggedIn 403 Forbidden");
      return res.status(403).send();
    }
  }

  catch(error) {
    next(error);
  }
}

AuthRouter.get("/loggedInStatus", async (req, res, next) => {
  // isLoggedIn(req, res, next);
  const { userId } = req.session;
  console.log("userId=", userId);

  let isLoggedInObject = {isLoggedIn: true}

  // Throw an UNAUTHORIZED error if the user is not signed in. 
  if (!userId) {
    // throw createHttpError(403, "Must be signed in to view images");
    isLoggedInObject.isLoggedIn = false;
  }

  res.send(isLoggedInObject);
});

/**
 * Endpoint for registering a new user
 */
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

    console.log("role=", role);
    if (role != 'patient' && role != 'doctor' && role != 'nurse' && role != 'admin') {
      throw createHttpError(400, "Role must be either patient, doctor, nurse, or admin");
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
        email,
        photos: []
      }
    });

    // No error means the PUT command was successful
    await dynamoObj.client.send(putCommand);

    const getResponse = await dynamoObj.client.send(
      new GetCommand({
        TableName: "users",
        Key: {
          id: userID
        }
      })
    ); 

    console.log("BEFORE setting fields of req.session, req.session=", req.session);
    req.session.userId = userID;
    req.session.role = role; 
    console.log("AFTER setting fields of req.session, req.session=", req.session);

    res.status(200).json({
      result: getResponse
    });

  } 
  
  catch(error) {
    next(error);
  }

})

/**
 * Endpoint for logging in
 */
AuthRouter.post("/login", async (req, res, next) => {

  try {

    const { username, password } = req.body;

    if (!username) {
      throw createHttpError(400, "Username required in request body");
    }
    
    if (!password) {
      throw createHttpError(400, "Password required in request body");
    }

    const getResponse = await dynamoObj.client.send(
      new ScanCommand({
        TableName: "users",
        FilterExpression: "username = :username",
        ExpressionAttributeValues: {
          ":username": username
         }
      })
    ); 

    const results = getResponse.Items;

    if (!results || results.length === 0) {
      throw createHttpError(403, "Username or password incorrect");
    }

    const user = results[0]

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      throw createHttpError(403, "Username or password incorrect");
    }

    console.log("BEFORE setting fields of req.session, req.session=", req.session);
    req.session.userId = user.id;
    req.session.role = user.role; 
    console.log("AFTER setting fields of req.session, req.session=", req.session);

    res.json({
      msg: "Logged in!",
      user
    });

  }

  catch(error) {
    next(error);
  }
});

/**
 * Endpoint for logging out
 */
AuthRouter.post("/logout", (req, res, next) => {

	req.session.destroy(error => {
		if (error) {
			next(error);
		} else {
			res.sendStatus(200);
		}
	});

});

/**
 * Endpoint for retreiving all user information (except the password)
 */
AuthRouter.get("/userInfo", async (req, res, next) => {
  console.log("RUN get /userInfo");
  const loggedInId = req.session.userId;

  if (loggedInId == undefined || loggedInId == null) {
    // throw createHttpError(403, "Please login to continue");
    return res.status(403).send();
  }
  
  console.log("loggedInId=", loggedInId);
  const getResponse = await dynamoObj.client.send(
    new ScanCommand({
      TableName: "users",
      FilterExpression: "id = :id",
      ExpressionAttributeValues: {
        ":id": loggedInId
       }
    })
  ); 

  console.log("AFTER the initialization of the variable getResponse");

  const results = getResponse.Items;

  console.log("AFTER the initialization of results as getResponse.Items");

  if (!results || results.length === 0) {
    throw createHttpError(403, "Was not able to find user based on session user id");
  }
  console.log("AFTER the if-statement that checks results.length");

  const userInfo = results[0];
  console.log("AFTER the results[0]");

  
  let {password, ...userInfoWithoutPassword} = userInfo;

  console.log("AFTER the removal of the password property from userInfo");
  res.json({userInfo: userInfoWithoutPassword});

});

export default AuthRouter;