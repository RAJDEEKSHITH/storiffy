import axios from "./axios";
import type {
  CreateDirectoryResponse,
  DeleteDirectoryResponse,
  DirectoryResponse,
  RenameDirectoryResponse,
} from "../types/directory";

export const getDirectoryItems = async (
  directoryId?: string,
): Promise<DirectoryResponse> => {
  const url = directoryId
    ? `/directory/${directoryId}`
    : "/directory";

  const response = await axios.get<{
    success: boolean;
    message: string;
    data: DirectoryResponse;
  }>(url);

  return response.data.data;
};

export const createFolder = async ({
  parentDirectoryId,
  name,
}: {
  parentDirectoryId: string;
  name: string;
}) => {
  const response =
    await axios.post<CreateDirectoryResponse>(
      "/directory",
      {
        parentDirectoryId,
        name,
      },
    );

  return response.data.data.directory;
};

export const renameDirectory = async (
  directoryId: string,
  name: string,
) => {
  const response =
    await axios.patch<RenameDirectoryResponse>(
      `/directory/${directoryId}`,
      {
        name,
      },
    );

  return response.data.data.directory;
};

export const deleteDirectory = async (
  directoryId: string,
) => {
  const response =
    await axios.delete<DeleteDirectoryResponse>(
      `/directory/${directoryId}`,
    );

  return response.data.data.directory;
};