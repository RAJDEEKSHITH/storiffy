import api  from "./axios"
export interface EmptyTrashResponse {
  deletedDirectories: number;
  deletedFiles: number;
  storageFreedInBytes: number;
}
export interface MoveItemsToTrashPayload {
  directories: string[];
  files: string[];
}
export interface MoveItemsToTrashResponse {
  requestedDirectories: number;
  requestedFiles: number;
  deletedDirectories: number;
  deletedFiles: number;
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

  export const moveItemsToTrash =
  async ({
    directories,
    files,
  }: MoveItemsToTrashPayload): Promise<MoveItemsToTrashResponse> => {
    const response = await api.post<{
      success: boolean;
      message: string;
      data: MoveItemsToTrashResponse;
    }>("/directories/trash/bulk", {
      directories,
      files,
    });

    return response.data.data;
  };
