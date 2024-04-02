import express, { NextFunction, Request, Response } from "express";
// { isLoggedIn }
import AuthRouter from "./routes/auth";
import createHttpError, { isHttpError } from "http-errors";
import session from 'express-session';
import { DynamoDB, DynamoDBClient } from "@aws-sdk/client-dynamodb";
import dotenv from 'dotenv';
import connect from "connect-dynamodb";
/*import { Server } from 'socket.io';
import { createServer } from 'node:http';*/
import { Server } from 'socket.io';
import { createServer } from 'node:http';

const path = require('path');

//import * as child from 'child_process';
import {spawn} from 'child_process';
const multer = require("multer");
//const upload = multer({ dest: "uploads/" });
const storage=  multer.diskStorage({
	destination: (req: any, file: any, cb: any) => {
		cb(null, 'src/uploads')
	},
	filename: (req: any, file: any, cb: any) => {
		console.log("file=", file);
		console.log(file.originalname);
		console.log(path.extname(file.originalname));
		//cb(null, Date.now() + path.extname(file.originalname))
		cb(null, file.originalname)
	}
})
const upload = multer({storage: storage});

//const { spawn } = require('child_process');
const app = express();
const port = 5005;

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173'
  }
});

io.engine.on("connection_error", (err) => {
  console.log(err.req);
  console.log(err.code);
  console.log(err.message);
  console.log(err.context);
})

io.on('connection', (socket) => {
  console.log('a user connected');
});

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173'
  }
});

io.engine.on("connection_error", (err) => {
  console.log(err.req);
  console.log(err.code);
  console.log(err.message);
  console.log(err.context);
})

io.on('connection', (socket) => {
  console.log('a user connected');
});

/*
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173'
  }
});

io.engine.on("connection_error", (err: any) => {
  console.log(err.req);
  console.log(err.code);
  console.log(err.message);
  console.log(err.context);
})

io.on('connection', (socket: any) => {
  console.log('a user connected');
});
*/

// dotenv.config();

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


/*
app.use(session({
  secret: process.env.SESSION_SECRET ?? "secret",
  resave: false,
  saveUninitialized: true,
  cookie: {
		maxAge: 60 * 60 * 1000
	},
  store: new DynamoDBStore({})
}));
*/

app.use("/api/v0/auth", AuthRouter);

/*
app.use((req, res, next) => {
	next(createHttpError(404, "Endpoint not found"));
})
*/
console.log("__dirname=", __dirname);
const combinedPath = path.join(__dirname, 'outputImages/inpainted/artificial_hair');
console.log("combinedPath=", combinedPath)
app.use('/static', express.static(combinedPath));

/*
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
*/



<<<<<<< Updated upstream
app.get('/script1', (req, res) => {
	let data1:string;
	const pythonOne = spawn('python3', ['DigitalHairRemoval.py']);
	pythonOne.stdout.on('data', function(data) {
		data1 = data.toString();
	});

	pythonOne.on('close', (code) => {
		console.log("code=", code);
		console.log("data1=", data1);
		res.send(data1);
	})
	
})

app.post('/process-image', upload.single("file"), (req, res) => {
	console.log("RUN process-image; Before creating pythonOne");
	//const savedFilename = req?.file?.filename;
	let pathToSavedFile = req?.file?.path;
	pathToSavedFile = './' + pathToSavedFile;
	console.log(req?.file);
	if (pathToSavedFile == null) {
		return;
	}
	
	const pythonOne = spawn('python3.11', ['src/DigitalHairRemoval.py', pathToSavedFile]);
	
	console.log("RUN process-image; Before calling pythonOne.on");
	pythonOne.stdout.setEncoding('utf8');
	pythonOne.stdout.on('data', function(data) {
		//Here is where the output goes

		console.log('stdout: ' + data);
	});

	pythonOne.stderr.setEncoding('utf8');
	pythonOne.stderr.on('data', function(data) {
		//Here is where the error output goes

		console.log('stderr: ' + data);
	});

	pythonOne.on('close', (code) => {
		// I need to read the output image
		// that DigitalHairRemoval.py generates,
		// and send it as a image.
		let data1 = 'hi';
		console.log("code=", code);
		console.log("data1=", data1);
		//const pathToProcessedFile = 'src/outputImages/inpainted/artificial_hair/ip_' + req?.file?.filename;

		res.send({processedFilename: 'ip_' + req?.file?.filename});
	})
	
	
})

app.listen(port, () => {
=======
server.listen(port, () => {
>>>>>>> Stashed changes
  console.log(`Server started on port ${port}...`);
console.log(`Server started on port ${port}...`);
});