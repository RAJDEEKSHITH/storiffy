import mongoose from "mongoose";

import Directory from "../../models/directory.model.js";
import File from "../../models/file.model.js";
import User from "../../models/user.model.js";
import {AppError} from "../../utils/app.error.js";

import { createUploadSignedUrl, deleteS3File } from "../aws/s3.service.js";
import { createCloudFrontGetSignedUrl } from "../aws/cloudfront.service.js";

export const initiateFileUpload = async ({
  userId,
  name,
  size,
  mimeType,
  directoryId,
}: {
  userId: string;
  name: string;
  size: number;
  mimeType: string;
  directoryId: string;
}) => {
  const user = await User.findById(userId).select(
    "maxStorageLimitInBytes storageUsedInBytes",
  );

  if (!user) {
    throw new AppError("User not found", 404);
  }

  const directory = await Directory.findOne({
    _id: directoryId,
    userId,
    deletedAt: null,
  });

  if (!directory) {
    throw new AppError("Directory not found", 404);
  }

  if (
    user.storageUsedInBytes + size >
    user.maxStorageLimitInBytes
  ) {
    throw new AppError(
      "Not enough storage space",
      403,
    );
  }

  const fileId = new mongoose.Types.ObjectId();

  const extensionIndex = name.lastIndexOf(".");
  const extension =
    extensionIndex !== -1
      ? name.slice(extensionIndex)
      : "";

  const storageKey = `files/${userId}/${fileId}${extension}`;

  const file = await File.create({
    _id: fileId,
    name,
    userId,
    directoryId: directory._id,
    storageKey,
    mimeType,
    size,
    status: "uploading",
    deletedAt: null,
  });

  const uploadUrl = await createUploadSignedUrl({
    key: storageKey,
    contentType: mimeType,
  });

  return {
    file,
    uploadUrl,
  };
};

export const completeFileUpload = async (
  userId: string,
  fileId: string,
) => {
  const file = await File.findOne({
    _id: fileId,
    userId,
    status: "uploading",
    deletedAt: null,
  });

  if (!file) {
    throw new AppError("Uploading file not found", 404);
  }

  const actualSize = await getObjectSize(file.storageKey);

  if (actualSize !== file.size) {
    await deleteS3File(file.storageKey);

    file.status = "failed";
    await file.save();

    throw new AppError(
      `Uploaded file size mismatch. Expected ${file.size} bytes, received ${actualSize} bytes`,
      400,
    );
  }

  file.status = "ready";

  await file.save();

  const [user, updatedDirectory] = await Promise.all([
    User.findByIdAndUpdate(
      userId,
      {
        $inc: {
          storageUsedInBytes: file.size,
        },
      },
      {
        new: true,
      },
    ).select("storageUsedInBytes"),

    Directory.findByIdAndUpdate(
      file.directoryId,
      {
        $inc: {
          size: file.size,
        },
      },
      {
        new: true,
      },
    ),
  ]);

  if (!user || !updatedDirectory) {
    throw new AppError(
      "Failed to update storage information",
      500,
    );
  }

  return {
    file,
    storageUsedInBytes: user.storageUsedInBytes,
  };
};

export const getFileViewUrl = async (
  userId: string,
  fileId: string,
  action: "view" | "download" = "view",
) => {
  const file = await File.findOne({
    _id: fileId,
    userId,
    status: "ready",
    deletedAt: null,
  }).lean();

  if (!file) {
    throw new AppError("File not found", 404);
  }

  return createCloudFrontGetSignedUrl({
    key: file.storageKey,
    download: action === "download",
    fileName: file.name,
  });
};


export const renameFile = async (
  userId: string,
  fileId: string,
  name: string,
) => {
  const file = await File.findOne({
    _id: fileId,
    userId,
    deletedAt: null,
  });

  if (!file) {
    throw new AppError("File not found", 404);
  }

  const existingFile = await File.findOne({
    _id: { $ne: file._id },
    userId,
    directoryId: file.directoryId,
    name,
    deletedAt: null,
  });

  if (existingFile) {
    throw new AppError(
      "A file with this name already exists",
      409,
    );
  }

  file.name = name;

  await file.save();

  return file;
};

export const deleteFile = async (
  userId: string,
  fileId: string,
) => {
  const file = await File.findOne({
    _id: fileId,
    userId,
    deletedAt: null,
  });

  if (!file) {
    throw new AppError("File not found", 404);
  }

  file.deletedAt = new Date();

  await file.save();

  /*
   * IMPORTANT:
   *
   * This is a soft delete.
   *
   * The file remains in S3 and storageUsedInBytes
   * does NOT decrease because your V1 storage model
   * counts active + trash.
   */

  return {
    file,
    storageUsedInBytes: (
      await User.findById(userId).select("storageUsedInBytes")
    )?.storageUsedInBytes ?? 0,
  };
};