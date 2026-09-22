import api from "./axios";
import type {
  SharedDirectoryResponse,
  SharedFileResponse,
  SharedMutationResponse,
  SharedPartUrlData,
  SharedUploadInitiateData,
} from "../types/share-link";
import type { UploadCompleteResponse } from "../types/directory";

export const resolvePublicShare = async (token: string) => {
  const response = await api.get<
    SharedDirectoryResponse | SharedFileResponse
  >(`/shares/public/${token}`);

  return response.data.data;
};

export const browsePublicDirectory = async (
  token: string,
  directoryId: string,
) => {
  const response = await api.get<SharedDirectoryResponse>(
    `/shares/public/${token}/directories/${directoryId}`,
  );

  return response.data.data;
};

export const viewPublicFile = async (
  token: string,
  fileId: string,
) => {
  const response = await api.get<SharedFileResponse>(
    `/shares/public/${token}/files/${fileId}`,
  );

  return response.data.data;
};

export const downloadPublicFile = async (
  token: string,
  fileId: string,
) => {
  const response = await api.get<SharedFileResponse>(
    `/shares/public/${token}/files/${fileId}/download`,
  );

  return response.data.data;
};

export const resolveRestrictedShare = async (
  token: string,
) => {
  const response = await api.get<
    SharedDirectoryResponse | SharedFileResponse
  >(`/shares/restricted/${token}`);

  return response.data.data;
};

export const browseRestrictedDirectory = async (
  token: string,
  directoryId: string,
) => {
  const response = await api.get<SharedDirectoryResponse>(
    `/shares/restricted/${token}/directories/${directoryId}`,
  );

  return response.data.data;
};

export const viewRestrictedFile = async (
  token: string,
  fileId: string,
) => {
  const response = await api.get<SharedFileResponse>(
    `/shares/restricted/${token}/files/${fileId}`,
  );

  return response.data.data;
};

export const downloadRestrictedFile = async (
  token: string,
  fileId: string,
) => {
  const response = await api.get<SharedFileResponse>(
    `/shares/restricted/${token}/files/${fileId}/download`,
  );

  return response.data.data;
};

export const renameRestrictedFile = async (
  token: string,
  fileId: string,
  name: string,
) => {
  const response = await api.patch<
    SharedMutationResponse<{ share: SharedFileResponse["data"]["share"]; file: SharedFileResponse["data"]["file"] }>
  >(`/shares/restricted/${token}/files/${fileId}`, { name });

  return response.data.data;
};

export const renameRestrictedDirectory = async (
  token: string,
  directoryId: string,
  name: string,
) => {
  const response = await api.patch<
    SharedMutationResponse<{ share: SharedDirectoryResponse["data"]["share"]; directory: SharedDirectoryResponse["data"]["directory"] }>
  >(`/shares/restricted/${token}/directories/${directoryId}`, { name });

  return response.data.data;
};

export const createRestrictedDirectory = async (
  token: string,
  parentDirectoryId: string,
  name: string,
) => {
  const response = await api.post<
    SharedMutationResponse<{ share: SharedDirectoryResponse["data"]["share"]; directory: SharedDirectoryResponse["data"]["directory"] }>
  >(`/shares/restricted/${token}/directories/${parentDirectoryId}`, { name });

  return response.data.data;
};

export const deleteRestrictedFile = async (
  token: string,
  fileId: string,
) => {
  const response = await api.delete<
    SharedMutationResponse<{
      share: SharedDirectoryResponse["data"]["share"];
      fileId: string;
      deletedAt?: string;
    }>
  >(`/shares/restricted/${token}/files/${fileId}`);

  return response.data.data;
};

export const deleteRestrictedDirectory = async (
  token: string,
  directoryId: string,
) => {
  const response = await api.delete<
    SharedMutationResponse<{
      share: SharedDirectoryResponse["data"]["share"];
      directoryId: string;
      deletedAt?: string;
    }>
  >(`/shares/restricted/${token}/directories/${directoryId}`);

  return response.data.data;
};

export const initiateRestrictedUpload = async ({
  token,
  directoryId,
  name,
  size,
  mimeType,
}: {
  token: string;
  directoryId: string;
  name: string;
  size: number;
  mimeType: string;
}): Promise<SharedUploadInitiateData> => {
  const response = await api.post<
    SharedMutationResponse<Omit<SharedUploadInitiateData, "share"> & { share: SharedUploadInitiateData["share"] }>
  >(`/shares/restricted/${token}/files/upload/initiate`, {
    directoryId,
    name,
    size,
    mimeType,
  });

  return response.data.data;
};

export const getRestrictedMultipartPartUploadUrl = async (
  token: string,
  fileId: string,
  partNumber: number,
  signal?: AbortSignal,
): Promise<SharedPartUrlData> => {
  const response = await api.post<
    ApiResponse<SharedPartUrlData>
  >(
    `/shares/restricted/${token}/files/upload/part-url/${fileId}`,
    { partNumber },
    { signal },
  );

  return response.data.data;
};

export const completeRestrictedSingleUpload = async (
  token: string,
  fileId: string,
): Promise<UploadCompleteResponse["data"]> => {
  const response = await api.post<UploadCompleteResponse>(
    `/shares/restricted/${token}/files/upload/complete/${fileId}`,
  );

  return response.data.data;
};

export const completeRestrictedMultipartUpload = async ({
  token,
  fileId,
  parts,
}: {
  token: string;
  fileId: string;
  parts: { partNumber: number; eTag: string }[];
}) => {
  const response = await api.post<UploadCompleteResponse>(
    `/shares/restricted/${token}/files/upload/complete-multipart/${fileId}`,
    { parts },
  );

  return response.data.data;
};

export const abortRestrictedUpload = async (
  token: string,
  fileId: string,
) => {
  const response = await api.post<ApiResponse<{ fileId: string; status: "cancelled" }>>(
    `/shares/restricted/${token}/files/upload/abort/${fileId}`,
  );

  return response.data.data;
};

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

