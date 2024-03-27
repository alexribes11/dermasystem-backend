import express, { NextFunction, Request, Response } from "express";
import AuthRouter from "./routes/auth";
import createHttpError, { isHttpError } from "http-errors";

const app = express();
const port = 5005;

const cors = require('cors');

// To use json:
app.use(express.json());
app.use(cors({
  origin: 'http://localhost:5173',
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