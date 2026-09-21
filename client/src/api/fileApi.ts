import axios from "axios";
import api from "./axios";
import type {
  DriveFile,
  FileDeleteResponse,
  FilePermanentDeleteResponse,
  FileResponse,
  FileTrashResponse,
  FileViewUrlResponse,
  MultipartPartUrlResponse,
  UploadCompleteResponse,
  UploadInitiateData,
  UploadInitiateResponse,
} from "../types/directory";

export const getFileUrl = async (
  fileId: string,
  download = false,
) => {
  const response = await api.post<FileViewUrlResponse>(
    `/files/${fileId}`,
    { download },
  );

  return response.data.data;
};

export const initiateUpload = async ({
  directoryId,
  name,
  size,
  mimeType,
}: {
  directoryId: string;
  name: string;
  size: number;
  mimeType: string;
}): Promise<UploadInitiateData> => {
  const response = await api.post<UploadInitiateResponse>(
    "/files/upload/initiate",
    { directoryId, name, size, mimeType },
  );

  return response.data.data;
};

export const getMultipartPartUploadUrl = async (
  fileId: string,
  partNumber: number,
  signal?: AbortSignal,
) => {
  const response = await api.post<MultipartPartUrlResponse>(
    `/files/upload/part-url/${fileId}`,
    { partNumber },
    { signal },
  );

  return response.data.data;
};

export const completeSingleUpload = async (
  fileId: string,
) => {
  const response = await api.post<UploadCompleteResponse>(
    `/files/upload/complete/${fileId}`,
  );

  return response.data.data;
};

export const completeMultipartUpload = async ({
  fileId,
  parts,
}: {
  fileId: string;
  parts: { partNumber: number; eTag: string }[];
}) => {
  const response = await api.post<UploadCompleteResponse>(
    `/files/upload/complete-multipart/${fileId}`,
    { parts },
  );

  return response.data.data;
};

export const abortUpload = async (
  fileId: string,
) => {
  const response = await api.post<{
    success: boolean;
    message: string;
    data: { fileId: string; status: "cancelled" };
  }>(`/files/upload/abort/${fileId}`);

  return response.data.data;
};

const putSingleFileToS3 = async ({
  uploadUrl,
  file,
  contentType,
  onProgress,
  signal,
}: {
  uploadUrl: string;
  file: File;
  contentType: string;
  onProgress: (progress: number) => void;
  signal: AbortSignal;
}) => {
  await axios.put(uploadUrl, file, {
    headers: {
      "Content-Type": contentType,
    },
    signal,
    onUploadProgress: (event) => {
      if (event.total) {
        onProgress(
          Math.round(
            (event.loaded / event.total) * 100,
          ),
        );
      }
    },
  });
};

const putMultipartPartToS3 = async ({
  uploadUrl,
  part,
  onProgress,
  signal,
}: {
  uploadUrl: string;
  part: Blob;
  onProgress: (loadedBytes: number) => void;
  signal: AbortSignal;
}) => {
  return axios.put(uploadUrl, part, {
    signal,
    onUploadProgress: (event) => {
      onProgress(event.loaded);
    },
  });
};

const uploadMultipartPartWithRetry = async ({
  fileId,
  partNumber,
  part,
  onProgress,
  signal,
}: {
  fileId: string;
  partNumber: number;
  part: Blob;
  onProgress: (loadedBytes: number) => void;
  signal: AbortSignal;
}) => {
  if (signal.aborted) {
    throw new Error("Upload cancelled.");
  }

  let partUrl = await getMultipartPartUploadUrl(
    fileId,
    partNumber,
    signal,
  );

  try {
    return await putMultipartPartToS3({
      uploadUrl: partUrl.uploadUrl,
      part,
      onProgress,
      signal,
    });
  } catch (firstError) {
    if (signal.aborted) {
      throw new Error("Upload cancelled.");
    }

    if (
      axios.isAxiosError(firstError) &&
      firstError.response?.status === 404
    ) {
      throw new Error(
        `S3 multipart upload no longer exists while uploading part ${partNumber}.`,
      );
    }

    console.warn(
      `Multipart part ${partNumber} failed. Retrying the same presigned URL.`,
      firstError,
    );

    onProgress(0);

    try {
      return await putMultipartPartToS3({
        uploadUrl: partUrl.uploadUrl,
        part,
        onProgress,
        signal,
      });
    } catch (secondError) {
      if (signal.aborted) {
        throw new Error("Upload cancelled.");
      }

      if (
        axios.isAxiosError(secondError) &&
        secondError.response?.status === 404
      ) {
        throw new Error(
          `S3 multipart upload no longer exists while uploading part ${partNumber}.`,
        );
      }

      console.warn(
        `Multipart part ${partNumber} failed again. Requesting a fresh URL.`,
        secondError,
      );

      onProgress(0);

      partUrl = await getMultipartPartUploadUrl(
        fileId,
        partNumber,
        signal,
      );

      return putMultipartPartToS3({
        uploadUrl: partUrl.uploadUrl,
        part,
        onProgress,
        signal,
      });
    }
  }
};

export const uploadSingleFileToS3 = async ({
  uploadUrl,
  file,
  mimeType,
  onProgress,
  signal,
}: {
  uploadUrl: string;
  file: File;
  mimeType: string;
  onProgress: (progress: number) => void;
  signal: AbortSignal;
}) => {
  await putSingleFileToS3({
    uploadUrl,
    file,
    contentType: mimeType,
    onProgress,
    signal,
  });
};

export const uploadMultipartFileToS3 = async ({
  file,
  fileId,
  partSize,
  totalParts,
  onProgress,
  signal,
}: {
  file: File;
  fileId: string;
  partSize: number;
  totalParts: number;
  onProgress: (progress: number) => void;
  signal: AbortSignal;
}) => {
  const partLoaded = new Map<number, number>();
  const completedParts = new Map<number, string>();
  const concurrency = Math.min(3, totalParts);
  let nextPartNumber = 1;
  let failedError: unknown = null;

  const reportOverallProgress = () => {
    let uploadedBytes = 0;

    for (const loaded of partLoaded.values()) {
      uploadedBytes += loaded;
    }

    onProgress(
      Math.min(
        100,
        Math.round(
          (uploadedBytes / file.size) * 100,
        ),
      ),
    );
  };

  const uploadWorker = async () => {
    while (true) {
      if (signal.aborted || failedError) {
        return;
      }

      const partNumber = nextPartNumber++;

      if (partNumber > totalParts) {
        return;
      }

      const start =
        (partNumber - 1) * partSize;
      const end = Math.min(
        start + partSize,
        file.size,
      );
      const part = file.slice(start, end);

      partLoaded.set(partNumber, 0);
      reportOverallProgress();

      try {
        const response =
          await uploadMultipartPartWithRetry({
            fileId,
            partNumber,
            part,
            onProgress: (loadedBytes) => {
              partLoaded.set(
                partNumber,
                loadedBytes,
              );
              reportOverallProgress();
            },
            signal,
          });

        const eTag =
          response.headers.etag ??
          response.headers.ETag;

        if (!eTag) {
          throw new Error(
            `S3 did not return ETag for multipart part ${partNumber}.`,
          );
        }

        completedParts.set(
          partNumber,
          eTag,
        );

        partLoaded.set(
          partNumber,
          part.size,
        );

        reportOverallProgress();
      } catch (error) {
        if (signal.aborted) {
          return;
        }

        if (!failedError) {
          failedError = error;
        }

        console.error(
          `Multipart part ${partNumber} failed permanently.`,
          error,
        );

        return;
      }
    }
  };

  // All workers settle before the caller can abort the server-side
  // multipart upload. This prevents another worker from using a
  // multipart upload ID after it has already been aborted.
  await Promise.all(
    Array.from(
      { length: concurrency },
      () => uploadWorker(),
    ),
  );

  if (signal.aborted) {
    throw new Error("Upload cancelled.");
  }

  if (failedError) {
    throw failedError;
  }

  return Array.from(
    completedParts.entries(),
  )
    .sort(([a], [b]) => a - b)
    .map(([partNumber, eTag]) => ({
      partNumber,
      eTag,
    }));
};

export const renameFile = async (
  fileId: string,
  name: string,
): Promise<DriveFile> => {
  const response = await api.patch<FileResponse>(
    `/files/${fileId}`,
    { name },
  );

  return response.data.data.file;
};

export const deleteFile = async (
  fileId: string,
) => {
  const response = await api.delete<FileDeleteResponse>(
    `/files/${fileId}`,
  );

  return response.data.data;
};

export const getFileTrash = async (): Promise<DriveFile[]> => {
  const response = await api.get<FileTrashResponse>(
    "/files/trash",
  );

  return response.data.data;
};

export const restoreFile = async (
  fileId: string,
): Promise<DriveFile> => {
  const response = await api.post<FileResponse>(
    `/files/restore/${fileId}`,
  );

  return response.data.data.file;
};

export const permanentlyDeleteFile = async (
  fileId: string,
) => {
  const response = await api.delete<FilePermanentDeleteResponse>(
    `/files/permanent/${fileId}`,
  );

  return response.data.data;
};
