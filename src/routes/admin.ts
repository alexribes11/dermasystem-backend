import { RequestHandler, Router } from "express";
import createHttpError from "http-errors";
import { GetCommand, PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import dynamo from "../db/dynamo-client";
import { isLoggedIn } from "./auth";
import crypto from 'crypto';
import { SessionData } from "express-session";
import { fetchUser, updateUser } from "../db/utils/user";
import { User } from "../types/User";
import dynamoObj from "../db/dynamo-client";

const AdminRouter = Router();

export const isAdmin: RequestHandler = (req, res, next) => {
  const { role } = req.session;
  if (role === "admin") {
    next();
  } else {
    const unauthorizedError = createHttpError(403, "Must be an admin to access this route");
    next(unauthorizedError);
  }
}

export const isDoctor: RequestHandler = (req, res, next) => {
  console.log("Calling is doctor...");
  const { role } = req.session;
  if (role === "doctor") {
    next();
  } else {
    const unauthorizedError = createHttpError(403, "Must be a doctor to access this route");
    next(unauthorizedError);
  }
}


AdminRouter.post("/hospitals/isValid", async(req, res, next) => {
  try {
    console.log("==========================================");
    console.log("POST /hospitals/isValid endpoint:");
    console.log("Request Body: ");
    console.log(req.body);

    const { hospitalName, address } = req.body;

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
    const getResponse = await dynamo.client.send(
      new ScanCommand({
        TableName: "hospitals",
        FilterExpression: "hospitalName = :n AND address = :a",
        ExpressionAttributeValues: {
          ":n": hospitalName,
          ":a": address
         }
      })
    ); 

    if (getResponse.Count && getResponse.Count > 0) {
      res.status(200).json(false);
    } else {
      res.status(200).json(true);
    }
  }
  catch(error) {
    next(error);
  }
});

AdminRouter.get("/hospitals/:zipcode", async(req, res, next) => {
  try {
    const zipcode = parseInt(req.params.zipcode);
    console.log("==========================================");
    console.log(`GET /hospitals/${zipcode} endpoint:`);

    const getResponse = await dynamo.client.send(
      new ScanCommand({
        TableName: "hospitals",
        FilterExpression: "address.zipcode = :z",
        ExpressionAttributeValues: {
          ":z": zipcode
         }
      })
    );
    console.log("Get Response: ");
    console.log(getResponse);
    res.status(200).json(getResponse.Items);
    console.log("==========================================");

  }
  catch(error) {
    next(error);
  }
})

AdminRouter.get("/doctors", isLoggedIn, async (req, res, next) => {

  try {

    console.log("==========================================");
    console.log("GET /doctors endpoint:");

    const { hospitalId, role } = req.session as SessionData;

    if (role === "patient") {
      throw createHttpError(403, "Unauthorized to view this route");
    }

    const getResponse = await dynamoObj.client.send(
      new ScanCommand({
        TableName: "users",
        FilterExpression: "hospitalId = :hId AND userRole = :r",
        ExpressionAttributeValues: {
          ":hId": hospitalId,
          ":r": "doctor"
        }
      })
    ); 

    console.log("Get Response: ");
    console.log(getResponse);

    res.status(200).json(getResponse.Items ?? []);

    console.log("==========================================");
  }
  
  catch(error) {
    next(error);
  }

});

AdminRouter.get("/nurses", isLoggedIn, async (req, res, next) => {

  try {

    console.log("==========================================");
    console.log("GET /nurses endpoint:");

    const { hospitalId, role } = req.session as SessionData;

    if (role === "patient") {
      throw createHttpError(403, "Unauthorized to view this route");
    }

    const getResponse = await dynamoObj.client.send(
      new ScanCommand({
        TableName: "users",
        FilterExpression: "hospitalId = :hId AND userRole = :r",
        ExpressionAttributeValues: {
          ":hId": hospitalId,
          ":r": "nurse"
        }
      })
    ); 

    console.log("Get Response: ");
    console.log(getResponse);

    res.status(200).json(getResponse.Items ?? []);

    console.log("==========================================");
  }
  
  catch(error) {
    next(error);
  }

});

AdminRouter.put("/assignDoctorToPatient", async (req, res, next) => {
  try {
    const {doctorId, patientId} = req.body;

    const doctor = await fetchUser(doctorId);
    if (!doctor) {
      throw createHttpError(404, "Doctor not found");
    }

    const patient = await fetchUser(patientId);
    if (!patient) {
      throw createHttpError(404, "Patient not found");
    }

    const patients = doctor.patients ?? []; 

    if (patients.includes(patientId)) {
      throw createHttpError(409, "Doctor already assigned to patient");
    }

    patients.push(patientId);
    const updatedDoctor = updateUser({...doctor, patients});
    res.status(200).json(updatedDoctor);
  }

  catch (error) {
    next(error);
  }
});

AdminRouter.delete("/:staffId", isLoggedIn, isAdmin, async (req, res, next) => {

  try {
    const { hospitalId } = req.session as SessionData;
    const { staffId } = req.params;
    const staff = await fetchUser(staffId);
    if (!staff) {
      throw createHttpError(404, "Staff member not found");
    }
    if (staff.hospitalId !== hospitalId) {
      throw createHttpError(403, "Unauthorized to remove staff member");
    }
    staff.patients = [];
    staff.hospitalId = "";
    updateUser(staff);
    res.status(200).json(staff);
  }

  catch(error) {
    next(error);
  }
})

export default AdminRouter;