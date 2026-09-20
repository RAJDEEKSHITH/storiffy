import type { UserI } from "../../models/user.model.js";

export const toPublicUser = (user: UserI) => {
  return {
    _id: user._id.toString(),
    rootDirectoryId :user.rootDirectoryId,
    name: user.name,
    email: user.email,
    role: user.role,
    status : user.status,
    plan : user.plan,
    picture: user.picture,
    maxStorageLimitInBytes: user.maxStorageLimitInBytes,
    storageUsedInBytes: user.storageUsedInBytes,
  };
};
