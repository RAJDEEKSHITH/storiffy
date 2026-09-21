export interface User {
  _id: string;
  name: string;
  email: string;
  role: "user" | "manager" | "admin";
  status: "active" | "disabled" | "deleted";
  plan: string;
  picture: string | null;
  maxStorageLimitInBytes: number;
  storageUsedInBytes: number;
  rootDirectoryId: string;
}
