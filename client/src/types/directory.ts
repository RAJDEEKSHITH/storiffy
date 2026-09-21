export interface Directory {
  _id: string;
  name: string;
  parentDirectoryId: string | null;
  userId: string;
  size: number;
  deletedAt: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export type FileStatus = "uploading" | "ready" | "failed";

export interface DriveFile {
  _id: string;
  name: string;
  userId: string;
  directoryId: string;
  storageKey: string;
  mimeType: string;
  size: number;
  status: FileStatus;
  uploadId: string | null;
  deletedAt: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface BreadcrumbItem {
  id: string;
  name: string;
}

export interface DirectoryResponse {
  directory: Directory;
  directories: Directory[];
  files: DriveFile[];
  breadcrumbs: BreadcrumbItem[];
}

export interface CreateDirectoryResponse {
  success: boolean;
  message: string;
  data: { directory: Directory };
}

export interface RenameDirectoryResponse {
  success: boolean;
  message: string;
  data: { directory: Directory };
}

export interface DirectoryBreadcrumbsResponse {
  success: boolean;
  message: string;
  data: BreadcrumbItem[];
}

export interface DirectoryMutationResponse {
  success: boolean;
  message: string;
  data: {
    directoryId: string;
    deletedAt?: string;
    storageFreedInBytes?: number;
    deletedDirectories?: number;
    deletedFiles?: number;
  };
}

export interface DirectoryRestoreResponse {
  success: boolean;
  message: string;
  data: { directory: Directory };
}

export interface SingleUploadInitiateData {
  uploadType: "single";
  fileId: string;
  storageKey: string;
  uploadUrl: string;
}

export interface MultipartUploadInitiateData {
  uploadType: "multipart";
  fileId: string;
  storageKey: string;
  uploadId: string;
  partSize: number;
  totalParts: number;
}

export type UploadInitiateData =
  | SingleUploadInitiateData
  | MultipartUploadInitiateData;

export interface UploadInitiateResponse {
  success: boolean;
  message: string;
  data: UploadInitiateData;
}

export interface FileCompletionData {
  fileId: string;
  name: string;
  mimeType: string;
  size: number;
  status: "ready";
  storageUsedInBytes: number;
  directorySize: number;
}

export interface UploadCompleteResponse {
  success: boolean;
  message: string;
  data: FileCompletionData;
}

export interface MultipartPartUrlResponse {
  success: boolean;
  message: string;
  data: {
    partNumber: number;
    uploadUrl: string;
  };
}

export interface FileViewUrlResponse {
  success: boolean;
  message: string;
  data: {
    file: {
      _id: string;
      name: string;
      mimeType: string;
      size: number;
    };
    url: string;
  };
}

export interface FileResponse {
  success: boolean;
  message: string;
  data: { file: DriveFile };
}

export interface FileDeleteResponse {
  success: boolean;
  message: string;
  data: {
    fileId: string;
    deletedAt?: string;
    storageFreedInBytes?: number;
  };
}

export interface FileTrashResponse {
  success: boolean;
  message: string;
  data: DriveFile[];
}

export interface FilePermanentDeleteResponse {
  success: boolean;
  message: string;
  data: {
    fileId: string;
    storageFreedInBytes: number;
  };
}
