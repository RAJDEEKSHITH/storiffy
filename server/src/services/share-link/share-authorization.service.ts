import mongoose from "mongoose";

import Directory from "../../models/directory.model.js";
import File from "../../models/file.model.js";
import User from "../../models/user.model.js";
import ShareLink, {
  type AccessType,
  type PermissionRole,
  type ResourceType,
  type ShareLinkI,
} from "../../models/share-link.model.js";
import ShareLinkRecipient from "../../models/share-link-recipient.model.js";
import { AppError } from "../../utils/app.error.js";
import {
  assertDirectoryWithinSharedRoot,
} from "../directory/directory.service.js";
import { isValidShareTokenFormat } from "./share-token.js";

export const SHARE_MAX_DEPTH = 1000;

const objectId = (value: string, message = "Invalid resource id") => {
  if (!mongoose.isValidObjectId(value)) {
    throw new AppError(message, 400);
  }
  return new mongoose.Types.ObjectId(value);
};

export const findActiveSharedFile = async ({
  ownerId,
  fileId,
}: {
  ownerId: string;
  fileId: string;
}) => {
  if (!mongoose.isValidObjectId(fileId)) {
    throw new AppError("File not found", 404);
  }

  const file = await File.findOne({
    _id: objectId(fileId),
    userId: ownerId,
    status: "ready",
    deletedAt: null,
  })
    .select(
      "_id name userId createdBy directoryId storageKey mimeType size status deletedAt createdAt updatedAt",
    )
    .lean();

  if (!file) {
    throw new AppError("File not found", 404);
  }

  return file;
};

export const findActiveSharedDirectory = async ({
  ownerId,
  directoryId,
}: {
  ownerId: string;
  directoryId: string;
}) => {
  if (!mongoose.isValidObjectId(directoryId)) {
    throw new AppError("Directory not found", 404);
  }

  const directory = await Directory.findOne({
    _id: objectId(directoryId),
    userId: ownerId,
    deletedAt: null,
  })
    .select(
      "_id name userId createdBy parentDirectoryId size deletedAt createdAt updatedAt",
    )
    .lean();

  if (!directory) {
    throw new AppError("Directory not found", 404);
  }

  return directory;
};

export const resolveShareLinkByToken = async ({
  token,
  expectedAccessType,
}: {
  token: string;
  expectedAccessType?: AccessType;
}) => {
  if (!isValidShareTokenFormat(token)) {
    throw new AppError("Share link not found", 404);
  }

  const share = await ShareLink.findOne({ token }).lean();

  if (!share) {
    throw new AppError("Share link not found", 404);
  }

  if (
    expectedAccessType &&
    share.accessType !== expectedAccessType
  ) {
    throw new AppError("Share link not found", 404);
  }

  if (share.expiresAt.getTime() <= Date.now()) {
    throw new AppError("Share link has expired", 410);
  }

  // Guard against corrupted/inconsistent data making a public editor link.
  if (
    share.accessType === "public" &&
    share.permission !== "viewer"
  ) {
    throw new AppError("Share link is invalid", 404);
  }

  const owner = await User.findOne({
    _id: share.ownerId,
    status: "active",
  })
    .select("_id name email")
    .lean();

  if (!owner) {
    throw new AppError("Share link is no longer available", 404);
  }

  return { share, owner };
};

export const assertRestrictedRecipient = async ({
  share,
  userId,
}: {
  share: ShareLinkI;
  userId: string;
}) => {
  if (!mongoose.isValidObjectId(userId)) {
    throw new AppError("Access denied", 403);
  }

  const user = await User.findOne({
    _id: userId,
    status: "active",
  })
    .select("_id name email")
    .lean();

  if (!user) {
    throw new AppError("Access denied", 403);
  }

  const recipient = await ShareLinkRecipient.findOne({
    shareLinkId: share._id,
    userId: user._id,
  })
    .select("_id")
    .lean();

  if (!recipient) {
    throw new AppError("You are not allowed to access this share link", 403);
  }

  return user;
};

export const assertOwnerResourceStillValid = async ({
  ownerId,
  resourceType,
  resourceId,
}: {
  ownerId: string;
  resourceType: ResourceType;
  resourceId: mongoose.Types.ObjectId;
}) => {
  if (resourceType === "file") {
    return findActiveSharedFile({
      ownerId,
      fileId: resourceId.toString(),
    });
  }

  return findActiveSharedDirectory({
    ownerId,
    directoryId: resourceId.toString(),
  });
};

export const assertEditorPermission = ({
  permission,
}: {
  permission: PermissionRole;
}) => {
  if (permission !== "editor") {
    throw new AppError(
      "Editor permission is required for this operation",
      403,
    );
  }
};

export const assertDirectoryShareTarget = async ({
  share,
  directoryId,
}: {
  share: ShareLinkI;
  directoryId: string;
}) => {
  if (share.resourceType !== "directory") {
    throw new AppError("This share does not grant directory access", 404);
  }

  return assertDirectoryWithinSharedRoot({
    ownerId: share.ownerId.toString(),
    sharedRootDirectoryId: share.resourceId.toString(),
    targetDirectoryId: directoryId,
  });
};

export const assertFileShareTarget = async ({
  share,
  fileId,
}: {
  share: ShareLinkI;
  fileId: string;
}) => {
  const file = await findActiveSharedFile({
    ownerId: share.ownerId.toString(),
    fileId,
  });

  if (share.resourceType === "file") {
    if (file._id.toString() !== share.resourceId.toString()) {
      throw new AppError("File is outside the shared scope", 404);
    }

    const parent = await Directory.findOne({
      _id: file.directoryId,
      userId: share.ownerId,
      deletedAt: null,
    })
      .select("_id")
      .lean();

    if (!parent) {
      throw new AppError("File is no longer available", 404);
    }

    return file;
  }

  await assertDirectoryWithinSharedRoot({
    ownerId: share.ownerId.toString(),
    sharedRootDirectoryId: share.resourceId.toString(),
    targetDirectoryId: file.directoryId.toString(),
  });

  return file;
};

export const assertSharedRootIsNotTarget = ({
  share,
  directoryId,
}: {
  share: ShareLinkI;
  directoryId: string;
}) => {
  if (
    share.resourceType === "directory" &&
    share.resourceId.toString() === directoryId
  ) {
    throw new AppError(
      "The shared root directory cannot be modified through the share link",
      403,
    );
  }
};

export const assertSharedUploadTarget = async ({
  share,
  actorId,
  fileId,
}: {
  share: ShareLinkI;
  actorId: string;
  fileId: string;
}) => {
  if (share.resourceType !== "directory") {
    throw new AppError(
      "Uploads are only available through directory shares",
      403,
    );
  }

  if (!mongoose.isValidObjectId(fileId)) {
    throw new AppError("Upload not found", 404);
  }

  const file = await File.findOne({
    _id: objectId(fileId, "Upload not found"),
    userId: share.ownerId,
    createdBy: actorId,
    status: "uploading",
    deletedAt: null,
  })
    .select("_id directoryId storageKey uploadId size name mimeType status")
    .lean();

  if (!file) {
    throw new AppError("Upload not found", 404);
  }

  await assertDirectoryWithinSharedRoot({
    ownerId: share.ownerId.toString(),
    sharedRootDirectoryId: share.resourceId.toString(),
    targetDirectoryId: file.directoryId.toString(),
  });

  return file;
};

export const getOwnerResourceForShare = async ({
  ownerId,
  resourceType,
  resourceId,
}: {
  ownerId: string;
  resourceType: ResourceType;
  resourceId: string;
}) =>
  resourceType === "file"
    ? findActiveSharedFile({ ownerId, fileId: resourceId })
    : findActiveSharedDirectory({ ownerId, directoryId: resourceId });
