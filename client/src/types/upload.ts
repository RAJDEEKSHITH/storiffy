export interface FileUploadItem {
  id: string;
  file: File;
  progress: number;
  status:
    | "uploading"
    | "cancelling"
    | "completed"
    | "failed";
  error?: string;
}
