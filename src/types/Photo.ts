export type Photo = {
  id: string;
  dateDeleted: string | null;
  datePermanentDelete: string | null;
  dateUploaded: string;
  uploadedBy: {
    id: string,
    name: string,
    role: string
  };
  deletedBy: {
    id: string,
    name: string,
    role: string
  } | null;
  diagnosis: string,
  patientId: string
}