import { Photo } from "./Photo";

export type User = {
  id: string;
  firstName: string;
  lastName: string;
  userRole: string;
  username: string;
  hospitalId: string;
  email: string;
  photos: Photo[];
  patients?: string[];
}