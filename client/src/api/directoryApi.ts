import axios from "./axios";
import type {
  CreateDirectoryResponse,
  DirectoryBreadcrumbsResponse,
  DirectoryMutationResponse,
  DirectoryResponse,
  DirectoryRestoreResponse,
  Directory,
  RenameDirectoryResponse,
} from "../types/directory";

export const getDirectoryItems = async (
  directoryId: string,
): Promise<DirectoryResponse> => {
  const response = await axios.get<{
    success: boolean;
    message: string;
    data: DirectoryResponse;
  }>(`/directories/${directoryId}`);

  return response.data.data;
};

export const getDirectoryBreadcrumbs = async (
  directoryId: string,
) => {
  const response = await axios.get<DirectoryBreadcrumbsResponse>(
    `/directories/breadcrumbs/${directoryId}`,
  );

  return response.data.data;
};

export const createFolder = async ({
  parentDirectoryId,
  name,
}: {
  parentDirectoryId: string;
  name: string;
}): Promise<Directory> => {
  const response = await axios.post<CreateDirectoryResponse>(
    `/directories/${parentDirectoryId}`,
    { name },
  );

  return response.data.data.directory;
};

export const renameDirectory = async (
  directoryId: string,
  name: string,
): Promise<Directory> => {
  const response = await axios.patch<RenameDirectoryResponse>(
    `/directories/${directoryId}`,
    { name },
  );

  return response.data.data.directory;
};

export const deleteDirectory = async (
  directoryId: string,
) => {
  const response = await axios.delete<DirectoryMutationResponse>(
    `/directories/${directoryId}`,
  );

  return response.data.data;
};

export const getDirectoryTrash = async (): Promise<Directory[]> => {
  const response = await axios.get<{
    success: boolean;
    message: string;
    data: Directory[];
  }>("/directories/trash");

  return response.data.data;
};

export const restoreDirectory = async (
  directoryId: string,
): Promise<Directory> => {
  const response = await axios.post<DirectoryRestoreResponse>(
    `/directories/restore/${directoryId}`,
  );

  return response.data.data.directory;
};

export const permanentlyDeleteDirectory = async (
  directoryId: string,
) => {
  const response = await axios.delete<DirectoryMutationResponse>(
    `/directories/permanent/${directoryId}`,
  );

  return response.data.data;
};
