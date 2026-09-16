export interface User {
  id: string;
  name: string;
  email: string;
  role: "user" | "manager" | "admin";
  picture: string | null;
  maxStorageLimitInBytes: number;
  storageUsedInBytes: number;
}