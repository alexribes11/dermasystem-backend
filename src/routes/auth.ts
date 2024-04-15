import { RequestHandler, Router } from "express";
import { GetCommand, PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import createHttpError from "http-errors";
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import dynamo from "../db/dynamo-client";

const AuthRouter = Router();

/**
 * Middleware for determining whether the user is currently authenticated.
 */
export const isLoggedIn: RequestHandler = (req, res, next) => {

  try {
    if (req.session.userId) {
      next();
    } else {
      throw createHttpError(403, "Please login to continue");
    }
  }

  catch(error) {
    next(error);
  }
}

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

    if (role != 'patient' || role != 'doctor' || role != 'nurse' || role != 'admin') {
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
    await dynamo.send(putCommand);

    const getResponse = await dynamo.send(
      new GetCommand({
        TableName: "users",
        Key: {
          id: userID
        }
      })
    ); 

    req.session.userId = userID;
    req.session.role = role; 

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

    const getResponse = await dynamo.send(
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

    req.session.userId = user.id;
    req.session.role = user.role; 

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
  const loggedInId = req.session.userId;
  
  const getResponse = await dynamo.send(
    new ScanCommand({
      TableName: "users",
      FilterExpression: "id = :id",
      ExpressionAttributeValues: {
        ":id": loggedInId
       }
    })
  ); 

  const results = getResponse.Items;

  if (!results || results.length === 0) {
    throw createHttpError(403, "Was not able to find user based on session user id");
  }

  const userInfo = results[0];
  
  let {password: _, ...userInfoWithoutPassword} = userInfo;

  res.json({userInfo: userInfo});

});

export default AuthRouter;