import type { UserI } from "../../models/user.model.js";

export const toPublicUser = (user: UserI) => {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    picture: user.picture,
    maxStorageLimitInBytes:
      user.maxStorageLimitInBytes,
    storageUsedInBytes:
      user.storageUsedInBytes,
  };
};