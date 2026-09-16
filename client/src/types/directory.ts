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

export interface DirectoryResponse {
  directory: Directory;
  directories: Directory[];
  files: DriveFile[];
}

export interface CreateDirectoryResponse {
  success: boolean;
  message: string;
  data: {
    directory: Directory;
  };
}

export interface RenameDirectoryResponse {
  success: boolean;
  message: string;
  data: {
    directory: Directory;
  };
}

export interface DeleteDirectoryResponse {
  success: boolean;
  message: string;
  data: {
    directory: Directory;
  };
}

export interface UploadInitiateResponse {
  success: boolean;
  message: string;
  data: {
    fileId: string;
    uploadUrl: string;
  };
}

export interface UploadCompleteResponse {
  success: boolean;
  message: string;
  data: {
    file: DriveFile;
    storageUsedInBytes: number;
  };
}

export interface FileViewUrlResponse {
  success: boolean;
  message: string;
  data: {
    url: string;
  };
}

export interface RenameFileResponse {
  success: boolean;
  message: string;
  data: {
    file: DriveFile;
  };
}

export interface DeleteFileResponse {
  success: boolean;
  message: string;
  data: {
    file: DriveFile;
    storageUsedInBytes: number;
  };
}