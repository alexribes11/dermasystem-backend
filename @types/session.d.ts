import 'express-session';

declare module "express-session" {
	interface SessionData {
		userId: string
    role: string,
    hospitalId: string,
    firstName: string,
    lastName: string
	}
}