import express, { NextFunction, Request, Response } from "express";
// { isLoggedIn }
import AuthRouter, { isLoggedIn } from "./routes/auth";
import createHttpError, { isHttpError } from "http-errors";
import session from 'express-session';
import dotenv from 'dotenv';
import connect from "connect-dynamodb";
/*import { Server } from 'socket.io';
import { createServer } from 'node:http';*/
import { Server } from 'socket.io';
import { createServer } from 'node:http';
import {glob} from 'glob'
import ImageRouter, { uploadImageToS3 } from "./routes/images";
import dynamoObj from "./db/dynamo-client";
import AdminRouter, { isAdmin } from "./routes/admin";
import cookieParser from "cookie-parser";
import PatientsRouter from "./routes/patients";
dotenv.config();


const path = require('path');
var pathlib = require("pathlib");

//import * as child from 'child_process';
//import {spawn} from 'child_process';
const { spawn } = require('child_process');

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

io.on('connection', (socket) => {
  console.log('a user connected');
});

const cors = require('cors');

type SessionData = {
  userId: string,
  role: string,
}

// To use json:
app.use(express.json());
app.use(cookieParser())
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));

const DynamoDBStore = connect<SessionData>(session);
app.use(session({
  secret: process.env.SESSION_SECRET ?? "secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
		maxAge: 60 * 60 * 1000,
    secure: false
	},
  store: new DynamoDBStore({
    client: dynamoObj.client
  }),
}));

app.use("/api/v0/auth", AuthRouter);
app.use("/api/v0/images", isLoggedIn, ImageRouter);
app.use("/api/v0/admin", AdminRouter);
app.use("/api/v0/patients", isLoggedIn, PatientsRouter);

const combinedPath = path.join(__dirname, 'outputImages/inpainted/real_hair');
app.use('/static', express.static(combinedPath));


app.post('/processImage', upload.single("file"), uploadImageToS3, async (req, res, next) => {

  try {

    const { userId, role } = req.session;

    if (role == 'patient') {
      throw createHttpError(403, "Patients cannot upload images.");
    }

    console.log("RUN process-image; Before creating pythonOne");
    //const savedFilename = req?.file?.filename;

    let pathToSavedFile = req?.file?.path;
    pathToSavedFile = './' + pathToSavedFile;
    console.log(req?.file);
    if (pathToSavedFile == null) {
      return;
    }

    var options = {stdio: 'inherit'};
    // const pythonOne = spawn('python3.11', ['src/DigitalHairRemoval.py', pathToSavedFile], options);
    const pythonOne = spawn('python3.12', ['src/model_scripts/hair_train.py', pathToSavedFile], options);
    
    console.log("RUN process-image; Before calling pythonOne.on");

    pythonOne.on('close', async (code: any) => {
      process.stdout.write('"npm install" finished with code ' + code + '\n');

      // I need to read the output image
      // that DigitalHairRemoval.py generates,
      // and send it as a image.
      let data1 = 'hi';
      console.log("code=", code);
      console.log("data1=", data1);
      //const pathToProcessedFile = 'src/outputImages/inpainted/artificial_hair/ip_' + req?.file?.filename;

      // Need to search in 'src/outputImages/inpainted/artificial_hair' for a file with the name req?.file?.filename, without the particular extension

      const folderOfProcessedFiles = './src/outputImages/inpainted/real_hair';

      /*
      const inputPathObj = pathlib(req?.file?.filename)
      console.log("typeof(inputPathObj)=", typeof(inputPathObj))
      console.log("inputPathObj=", inputPathObj);
      const inputFileWithoutExt = inputPathObj.base();
      */
      const inputFileWithoutExt = (req?.file?.filename)?.split(".")[0];
      console.log("inputFileWithoutExt=", inputFileWithoutExt);
      const myPathToProcessedFileWithoutExt = folderOfProcessedFiles + '/ip_' + inputFileWithoutExt;
      console.log("myPathToProcessedFileWithoutExt=", myPathToProcessedFileWithoutExt)
      const pathsToFileWithExt = await glob(myPathToProcessedFileWithoutExt + ".*");
      console.log("pathsToFileWithExt=", pathsToFileWithExt, "typeof()=", typeof(pathsToFileWithExt));
      const pathToFileWithExt = pathsToFileWithExt[0];
      console.log("pathToFileWithExt=", pathToFileWithExt, "typeof()=", typeof(pathToFileWithExt));
      const ext = path.extname(pathToFileWithExt);
      console.log("ext=", ext);

      const myPathToProcessedFileWithExt = myPathToProcessedFileWithoutExt + ext;
      const inputFileWithExt = 'ip_' + inputFileWithoutExt + ext;
      console.log("iFWE=", inputFileWithExt);
    
      //res.send({processedFilename: 'ip_' + req?.file?.filename});
      res.send({processedFilename: inputFileWithExt});
    })
  }

  catch (error) {
    next(error);
  }

})

app.use((req, res, next) => {
	next(createHttpError(404, "Endpoint not found"));
});

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

server.listen(port, () => {
  console.log(`Server started on port ${port}...`);
});