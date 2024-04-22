import { RequestHandler, Router } from "express";
import createHttpError from "http-errors";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import dynamo from "../db/dynamo-client";

const AdminRouter = Router();

export const isAdmin: RequestHandler = (req, res, next) => {
  const { role } = req.session;
  if (role === "Admin") {
    next();
  } else {
    const unauthorizedError = createHttpError(403, "Must be an admin to access this route");
    next(unauthorizedError);
  }
}

AdminRouter.post("/hospitals", async (req, res, next) => {

  try {

    console.log("==========================================");
    console.log("POST /hospitals endpoint:");
    console.log("Request Body: ");
    console.log(req.body);

    const { name, address } = req.body;

    if (!name) {
      throw createHttpError(400, "'name' field required in request body.");
    }
    if (!address) {
      throw createHttpError(400, "'address' field required in request body.");
    }

    /* Check if there already exists a hospital with the given name and address */
    const getResponse = await dynamo.send(
      new GetCommand({
        TableName: "users",
        Key: { name, address }
      })
    ); 

    console.log("Get Response: ");
    console.log(getResponse);

    res.status(200).json(getResponse);

    console.log("==========================================");
  }
  
  catch(error) {
    next(error);
  }

});


AdminRouter.get("/doctors", async (req, res, next) => {

  try {

    console.log("==========================================");
    console.log("GET /doctors endpoint:");
    console.log("Request Body: ");
    console.log(req.body);

    const { name, address } = req.body;

    if (!name) {
      throw createHttpError(400, "'name' field required in request body.");
    }
    if (!address) {
      throw createHttpError(400, "'address' field required in request body.");
    }

    /* Check if there already exists a hospital with the given name and address */
    const getResponse = await dynamo.send(
      new GetCommand({
        TableName: "users",
        Key: { name, address }
      })
    ); 

    console.log("Get Response: ");
    console.log(getResponse);

    res.status(200).json(getResponse);

    console.log("==========================================");
  }
  
  catch(error) {
    next(error);
  }

});

export default AdminRouter;