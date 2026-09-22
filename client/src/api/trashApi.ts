import api  from "./axios"
export interface EmptyTrashResponse {
  deletedDirectories: number;
  deletedFiles: number;
  storageFreedInBytes: number;
}

export const emptyTrash =
  async (): Promise<EmptyTrashResponse> => {
    const response = await api.delete<{
      success: boolean;
      message: string;
      data: EmptyTrashResponse;
    }>("/directories/trash/empty");

    return response.data.data;
  };