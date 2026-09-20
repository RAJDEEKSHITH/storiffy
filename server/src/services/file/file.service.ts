import path from "node:path";
import Directory from "../../models/directory.model.js";
import File from "../../models/file.model.js";
import { AppError } from "../../utils/app.error.js";
import {
  abortMultipartUpload,
  completeMultipartUpload,
  generateMultipartPartUrl,
  generatePresignedUploadUrl,
  getS3FileMetaData,
  initiateMultipartUpload,
} from "../aws/s3.service.js";
import mongoose from "mongoose";
import { generateCloudFrontSignedUrl } from "../aws/cloudfront.service.js";

const MULTIPART_THRESHOLD = 100 * 1024 * 1024;
const MULTIPART_PART_SIZE = 10 * 1024 * 1024;

const validateDirectory = async (directoryId: string, userId: string) => {
  const directory = await Directory.findOne({
    _id: directoryId,
    userId,
    deletedAt: null,
  })
    .select("_id")
    .lean();

  if (!directory) {
    throw new AppError("Directory not found", 404);
  }
};

export const getFileSignedUrl = async ({
  userId,
  fileId,
  download,
}: {
  userId: string;
  fileId: string;
  download: boolean;
}) => {
  const file = await File.findOne({
    _id: fileId,
    userId,
    deletedAt: null,
    status: "ready",
  }).lean();

  if (!file) {
    throw new AppError("File not found", 404);
  }

  const signedUrl = generateCloudFrontSignedUrl({
    key: file.storageKey,
    download,
    fileName: file.name,
  });

  return {
    file: {
      _id: file._id.toString(),
      name: file.name,
      mimeType: file.mimeType,
      size: file.size,
    },
    url: signedUrl,
  };
};

export const initiateSingleUpload = async ({
  userId,
  directoryId,
  name,
  size,
  mimeType,
}: {
  userId: string;
  directoryId: string;
  name: string;
  size: number;
  mimeType: string;
}) => {
  await validateDirectory(directoryId, userId);

  const fileId = new mongoose.Types.ObjectId();
  const storageKey = `${fileId}${path.extname(name)}`;

  const file = await File.create({
    _id: fileId,
    name,
    userId,
    directoryId,
    storageKey,
    mimeType,
    size,
    status: "uploading",
    uploadId: null,
    deletedAt: null,
  });

  try {
    const uploadUrl = await generatePresignedUploadUrl({
      key: storageKey,
      contentType: mimeType,
    });

    return {
      uploadType: "single" as const,
      fileId: file._id.toString(),
      storageKey,
      uploadUrl,
    };
  } catch (error) {
    // Remove the DB record if S3 presigned URL generation fails.
    await File.deleteOne({
      _id: fileId,
    });

    throw error;
  }
};

// Pure Multipart Upload Service
export const initiateMultipartUploadService = async ({
  userId,
  directoryId,
  name,
  size,
  mimeType,
}: {
  userId: string;
  directoryId: string;
  name: string;
  size: number;
  mimeType: string;
}) => {
  await validateDirectory(directoryId, userId);

  const fileId = new mongoose.Types.ObjectId();
  const storageKey = `${fileId}${path.extname(name)}`;

  const uploadId = await initiateMultipartUpload({
    key: storageKey,
    contentType: mimeType,
  });

  try {
    const file = await File.create({
      _id: fileId,
      name,
      userId,
      directoryId,
      storageKey,
      mimeType,
      size,
      status: "uploading",
      uploadId,
      deletedAt: null,
    });

    return {
      uploadType: "multipart" as const,
      fileId: file._id.toString(),
      storageKey,
      uploadId,
      partSize: MULTIPART_PART_SIZE,
      totalParts: Math.ceil(size / MULTIPART_PART_SIZE),
    };
  } catch (error) {
    // MongoDB creation failed after S3 multipart upload
    // was already created, so clean up the S3 upload.
    try {
      await abortMultipartUpload({
        key: storageKey,
        uploadId,
      });
    } catch (cleanupError) {
      console.error("Failed to abort orphaned multipart upload:", cleanupError);
    }
    throw error;
  }
};

export const completeSingleFileUpload = async ({
  userId,
  fileId,
}: {
  userId: string;
  fileId: string;
}) => {
  const file = await File.findOne({
    _id: fileId,
    userId,
    status: "uploading",
    deletedAt: null,
  });

  if (!file) {
    throw new AppError("Upload not found", 404);
  }

  // This endpoint is only for single uploads.
  if (file.uploadId) {
    throw new AppError("This file is a multipart upload", 400);
  }

  let metadata;

  try {
    metadata = await getS3FileMetaData(file.storageKey);
  } catch (error) {
    console.error("Failed to verify uploaded file:", error);

    throw new AppError("Uploaded file could not be verified", 400);
  }

  if (metadata.ContentLength !== file.size) {
    throw new AppError("Uploaded file size does not match expected size", 400);
  }

  file.status = "ready";

  await file.save();

  return {
    fileId: file._id.toString(),
    name: file.name,
    mimeType: file.mimeType,
    size: file.size,
    status: file.status,
  };
};
export const completeMultipartFileUpload = async ({
  userId,
  fileId,
  parts,
}: {
  userId: string;
  fileId: string;
  parts: {
    partNumber: number;
    eTag: string;
  }[];
}) => {
  const file = await File.findOne({
    _id: fileId,
    userId,
    status: "uploading",
    deletedAt: null,
  });

  if (!file) {
    throw new AppError("Upload not found", 404);
  }

  // This endpoint is only for multipart uploads.
  if (!file.uploadId) {
    throw new AppError("This file is not a multipart upload", 400);
  }

  const totalParts = Math.ceil(file.size / MULTIPART_PART_SIZE);

  // Validate that we received exactly the expected number of parts.
  if (parts.length !== totalParts) {
    throw new AppError(`Expected ${totalParts} parts`, 400);
  }
  // Validate part numbers and duplicates.
  const partNumbers = new Set<number>();

  for (const part of parts) {
    if (
      !Number.isInteger(part.partNumber) ||
      part.partNumber < 1 ||
      part.partNumber > totalParts
    ) {
      throw new AppError(`Invalid part number: ${part.partNumber}`, 400);
    }

    if (partNumbers.has(part.partNumber)) {
      throw new AppError(`Duplicate part number: ${part.partNumber}`, 400);
    }

    partNumbers.add(part.partNumber);
  }
  // Make sure every expected part exists.
  for (let i = 1; i <= totalParts; i++) {
    if (!partNumbers.has(i)) {
      throw new AppError(`Missing part number: ${i}`, 400);
    }
  }

  try {
    await completeMultipartUpload({
      key: file.storageKey,
      uploadId: file.uploadId,
      parts: parts
        .map((part) => ({
          PartNumber: part.partNumber,
          ETag: part.eTag,
        }))
        .sort((a, b) => a.PartNumber - b.PartNumber),
    });
  } catch (error) {
    console.error("Failed to complete multipart upload:", error);

    throw new AppError("Failed to complete multipart upload", 500);
  }

  // Verify final S3 object.
  let metadata;
  try {
    metadata = await getS3FileMetaData(file.storageKey);
  } catch (error) {
    console.error("Multipart object verification failed:", error);

    throw new AppError("Uploaded file could not be verified", 500);
  }

  if (metadata.ContentLength !== file.size) {
    throw new AppError("Uploaded file size does not match expected size", 400);
  }

  file.status = "ready";
  file.uploadId = null;

  await file.save();

  return {
    fileId: file._id.toString(),
    name: file.name,
    mimeType: file.mimeType,
    size: file.size,
    status: file.status,
  };
};

export const abortFileUpload = async ({
  userId,
  fileId,
}: {
  userId: string;
  fileId: string;
}) => {
  const file = await File.findOne({
    _id: fileId,
    userId,
    status: "uploading",
    deletedAt: null,
  });

  if (!file) {
    throw new AppError("Upload not found", 404);
  }

  /// Single upload:
  //  There is no S3 multipart upload to abort.
  if (!file.uploadId) {
    file.status = "failed";
    await file.save();

    return {
      fileId: file._id.toString(),
      status: file.status,
    };
  }
  //  Multipart upload.
  try {
    await abortMultipartUpload({
      key: file.storageKey,
      uploadId: file.uploadId,
    });
  } catch (error) {
    console.error("Failed to abort multipart upload:", error);

    throw new AppError("Failed to abort upload", 500);
  }

  file.status = "failed";
  file.uploadId = null;

  await file.save();

  return {
    fileId: file._id.toString(),
    status: file.status,
  };
};

export const getMultipartPartUploadUrl = async ({
  userId,
  fileId,
  partNumber,
}: {
  userId: string;
  fileId: string;
  partNumber: number;
}) => {
  const file = await File.findOne({
    _id: fileId,
    userId,
    status: "uploading",
    deletedAt: null,
  }).lean();

  if (!file) {
    throw new AppError("Upload not found", 404);
  }

  if (!file.uploadId) {
    throw new AppError("File is not a multipart upload", 400);
  }

  const totalParts = Math.ceil(file.size / MULTIPART_PART_SIZE);

  if (
    !Number.isInteger(partNumber) ||
    partNumber < 1 ||
    partNumber > totalParts
  ) {
    throw new AppError("Invalid part number", 400);
  }

  const uploadUrl = await generateMultipartPartUrl({
    key: file.storageKey,
    uploadId: file.uploadId,
    partNumber,
  });

  return {
    partNumber,
    uploadUrl,
  };
};
