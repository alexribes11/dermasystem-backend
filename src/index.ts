import express, { NextFunction, Request, Response } from "express";
import AuthRouter, { isLoggedIn } from "./routes/auth";
import createHttpError, { isHttpError } from "http-errors";
import { DynamoDB, DynamoDBClient } from "@aws-sdk/client-dynamodb";
import session from 'express-session';
import dotenv from 'dotenv';
import connect from "connect-dynamodb";


const app = express();
const port = 5005;

dotenv.config();

const cors = require('cors');

type SessionData = {
  userId: string
}

const DynamoDBStore = connect<SessionData>(session);

// To use json:
app.use(express.json());
app.use(cors({
  origin: 'http://localhost:5173',
}));


app.use(session({
  secret: process.env.SESSION_SECRET ?? "secret",
  resave: false,
  saveUninitialized: true,
  cookie: {
		maxAge: 60 * 60 * 1000
	},
  store: new DynamoDBStore({})
}));

app.use("/api/v0/auth", AuthRouter);

app.use((req, res, next) => {
	next(createHttpError(404, "Endpoint not found"));
})

app.use((error: unknown, req: Request, res: Response, next: NextFunction) => {
	console.error(error);
	let errorMessage = "Whoops, something went wrong";
	let statusCode = 500;
	if (isHttpError(error)) {
		statusCode = error.status;
		errorMessage = error.message;
	}
	res.status(statusCode).json({ error: errorMessage });
});



app.listen(port, () => {
  console.log(`Server started on port ${port}...`);
});