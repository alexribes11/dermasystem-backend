import { RequestHandler, Router } from "express";
import { Session, SessionData } from "express-session";
import createHttpError from "http-errors";
import { fetchUser, updateUser } from "../db/utils/user";
import { User } from "../types/User";
import dynamoObj from "../db/dynamo-client";
import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { isLoggedIn } from "./auth";

const PatientsRouter = Router();

export const canAccessPatient = (user: User, patient: User) => {

  // Verify that the user is authorized to view the patient's data
  const {id: userId, userRole: role} = user;
  const {id: patientId} = patient;

  let authorized = false;

  if (role === "patient") {
    authorized = userId === patientId;
  } else if (role === "doctor" || role === "nurse") {
    authorized = user.patients?.includes(patientId) ?? false;
  } else if (role === "admin") {
    authorized = user.hospitalId === patient.hospitalId;
  }

  return authorized;
} 

/**
 * Endpoint for retreiving all patients assigned to a user.
 */
PatientsRouter.get("/", isLoggedIn, async (req, res, next) => {

  try {

    const {userId, role, hospitalId} = req.session as SessionData;

    if (role === "patient") {
      throw createHttpError(403, "Not authorized to access this route.")
    }

    const user = await fetchUser(userId) as User;
    let getResponse;

    if (role === "nurse" || role === "doctor") {
      const patients = user.patients ?? []
      var titleObject: Record<string, string> = {};
      var index = 0;
      if (patients.length === 0) {
        return res.status(200).json([]);
      }
      patients.forEach(value => {
          index++;
          var titleKey = ":titlevalue"+index;
          titleObject[titleKey.toString()] = value;
      });

      getResponse = await dynamoObj.client.send(
        new ScanCommand({
          TableName: "users",
          FilterExpression: "hospitalId = :hId AND id IN ("+Object.keys(titleObject).toString()+ ")",
          ExpressionAttributeValues: {
            ":hId": hospitalId,
            ...titleObject,
          }
        }
      ));

    } 
    
    if (role === "admin") {
      getResponse = await dynamoObj.client.send(
        new ScanCommand({
          TableName: "users",
          FilterExpression: "hospitalId = :hId AND userRole = :r",
          ExpressionAttributeValues: {
            ":hId": hospitalId,
            ":r": "patient"
          }
        })
      ); 
    }

    res.status(200).json(getResponse?.Items ?? []);
  } 
  
  catch(error) {
    next(error)
  }
});

/**
 * Endpoint for retreiving the information for a specific patient
 */
PatientsRouter.get("/:patientId", isLoggedIn, async (req, res, next) => {

  try {

    const { userId } = req.session as SessionData;
    const { patientId } = req.params

    const user = await fetchUser(userId);
    if (!user) {
      throw createHttpError(404, "User not found");
    }

    const patient = await fetchUser(patientId);
    if (!patient) {
      throw createHttpError(404, "Patient not found");
    }

    if (!canAccessPatient(user, patient)) {
      throw createHttpError(403, "Unauthorized to access patient data");
    }

    res.status(200).json(patient);

  } 
  
  catch(error) {
    next(error)
  }
});

/**
 * Endpoint for assigning a nurse to a patient
 */
PatientsRouter.put("/:patientId/assignNurse", isLoggedIn, async (req, res, next) => {

  try {

    const { userId, role } = req.session as SessionData;
    const { patientId } = req.params
    const { nurseId } = req.body;

    const user = await fetchUser(userId);
    if (!user) {
      throw createHttpError(404, "User not found");
    }

    if (role !== "doctor" && role !== "admin") {
      throw createHttpError(403, "Not authorized to assign nurse");
    }

    const patient = await fetchUser(patientId);
    if (!patient) {
      throw createHttpError(404, "Patient not found");
    }

    if (!canAccessPatient(user, patient)) {
      throw createHttpError(403, "Unauthorized to access patient data");
    }

    const nurse = await fetchUser(nurseId);
    if (!nurse) {
      throw createHttpError(404, "Nurse not found");
    }

    const patients = nurse.patients ?? [];
    
    if (patients.includes(patientId)) {
      throw createHttpError(409, "Nurse already assigned to patient");
    }

    patients.push(patientId);

    updateUser({...nurse, patients});

    const updatedNurse = await fetchUser(nurseId) as User;
    res.status(200).json(updatedNurse);

  } 
  
  catch(error) {
    next(error)
  }
});

/**
 * Endpoint for unassigning a staff member from a patient
 */
PatientsRouter.delete("/:patientId/unassign/:staffId", isLoggedIn, async (req, res, next) => {

  try {

    const { userId } = req.session as SessionData;

    // Fetch the logged-in user's data 
    const user = await fetchUser(userId) as User;

    // Throw an UNAUTHORIZED error if the user is not an admin or a doctor
    if (user.userRole !== "admin" && user.userRole !== "doctor") {
      throw createHttpError(403, "Unauthorized to access this route");
    }

    // Fetch the patient's data
    const { patientId } = req.params;
    const patient = await fetchUser(patientId);

    // Throw a NOT FOUND error if the patient does not exist
    if (!patient) {
      throw createHttpError(404, "Patient not found");
    }

    // Throw an UNAUTHORIZED error if the user does not have permission to access the patient
    const authorized = canAccessPatient(user, patient);
    if (!authorized) {
      throw createHttpError(403, "Unauthorized to access patient");
    }

    // Fetch the staff member to be unassigned
    const { staffId } = req.params;
    const staff = await fetchUser(staffId);

    // Throw a NOT FOUND error if the staff member does not exist
    if (!staff) {
      throw createHttpError(404, "Staff member not found");
    }

    const patients = staff.patients ?? [];

    // Filter out the patient from the staff member's patients 
    const updatedPatients = patients.filter(patient => patient !== patientId);
    staff.patients = updatedPatients;
    updateUser(staff);

    // Send the info for the newly updated staff member
    res.status(200).json({ staff });

  }

  catch(error) {
    next(error);
  }

})

export default PatientsRouter;