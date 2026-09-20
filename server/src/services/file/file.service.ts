import path from "node:path";
import mongoose from "mongoose";

import Directory from "../../models/directory.model.js";
import File from "../../models/file.model.js";
import User from "../../models/user.model.js";
import { AppError } from "../../utils/app.error.js";

import {
  abortMultipartUpload,
  completeMultipartUpload,
  deleteS3Object,
  generateMultipartPartUrl,
  generatePresignedUploadUrl,
  getS3FileMetaData,
  initiateMultipartUpload,
} from "../aws/s3.service.js";

import { generateCloudFrontSignedUrl } from "../aws/cloudfront.service.js";

const MULTIPART_THRESHOLD = 100 * 1024 * 1024; // 100 MB

const MULTIPART_PART_SIZE = 10 * 1024 * 1024; // 10 MB

// to check valid directory
const validateDirectory = async (
  directoryId: string,
  userId: string,
) => {
  const directory =
    await Directory.findOne({
      _id: directoryId,
      userId,
      deletedAt: null,
    })
      .select("_id")
      .lean();

  if (!directory) {
    throw new AppError(
      "Directory not found",
      404,
    );
  }

  return directory;
};

/*
|--------------------------------------------------------------------------
| Reserve user storage
|--------------------------------------------------------------------------
|
| Storage is reserved when upload starts.
|
| This operation is atomic:
|
| storageUsedInBytes + fileSize <= maxStorageLimitInBytes
|
| and
|
| storageUsedInBytes += fileSize
|
| happen as one MongoDB operation.
|--------------------------------------------------------------------------
*/
// Storage is reserved when upload starts.
const reserveUserStorage = async ({
  userId,
  size,
  session,
}: {
  userId: string;
  size: number;
  session: mongoose.ClientSession;
}) => {
  const user =
    await User.findOneAndUpdate(
      {
        _id: userId,

        $expr: {
          $lte: [
            {
              $add: [
                "$storageUsedInBytes",
                size,
              ],
            },
            "$maxStorageLimitInBytes",
          ],
        },
      },
      {
        $inc: {
          storageUsedInBytes: size,
        },
      },
      {
        returnDocument : "after",
        session,
      },
    );

  if (!user) {
    throw new AppError(
      "Storage limit exceeded",
      400,
    );
  }

  return user;
};


// Release storage reserved by failed upload
const releaseFailedUploadStorage =
  async ({
    userId,
    fileId,
  }: {
    userId: string;
    fileId: string;
  }) => {
    const session =
      await mongoose.startSession();

    try {
      await session.withTransaction(
        async () => {
          const file =
            await File.findOneAndDelete(
              {
                _id: fileId,
                userId,
                status: "uploading",
                deletedAt: null,
              },
              {
                session,
              },
            );

          if (!file) {
            return;
          }

          await User.updateOne(
            {
              _id: userId,
            },
            {
              $inc: {
                storageUsedInBytes:
                  -file.size,
              },
            },
            {
              session,
            },
          );
        },
      );
    } finally {
      await session.endSession();
    }
  };

/*
|--------------------------------------------------------------------------
| Cleanup failed upload
|--------------------------------------------------------------------------
|
| S3 cleanup must succeed before the storage reservation
| is released.
|--------------------------------------------------------------------------
*/
const cleanupFailedUpload = async ({
  userId,
  fileId,
  storageKey,
  uploadId,
}: {
  userId: string;
  fileId: string;
  storageKey: string;
  uploadId: string | null;
}) => {
  try {
    if (uploadId) {
      await abortMultipartUpload({
        key: storageKey,
        uploadId,
      });
    } else {
      await deleteS3Object(
        storageKey,
      );
    }
  } catch (error) {
    console.error(
      "Failed to clean up failed upload from S3:",
      error,
    );

    throw new AppError(
      "Failed to clean up failed upload",
      500,
    );
  }

  await releaseFailedUploadStorage({
    userId,
    fileId,
  });
};


// Get signed CloudFront URL
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
    throw new AppError(
      "File not found",
      404,
    );
  }

  const signedUrl =
    generateCloudFrontSignedUrl({
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

// initiate single upload for files < 100 MB
export const initiateSingleUpload =
  async ({
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
    await validateDirectory(
      directoryId,
      userId,
    );

    const fileId =
      new mongoose.Types.ObjectId();

    const storageKey =
      `${fileId}${path.extname(name)}`;

    /*
     * Reserve storage + create file
     * atomically.
     */
    const session =
      await mongoose.startSession();

    try {
      await session.withTransaction(
        async () => {
          await reserveUserStorage({
            userId,
            size,
            session,
          });

          await File.create(
            [
              {
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
              },
            ],
            {
              session,
            },
          );
        },
      );
    } finally {
      await session.endSession();
    }

    try {
      const uploadUrl =
        await generatePresignedUploadUrl({
          key: storageKey,
          contentType: mimeType,
        });

      return {
        uploadType: "single" as const,
        fileId: fileId.toString(),
        storageKey,
        uploadUrl,
      };
    } catch (error) {
      /*
       * S3 URL generation failed after storage
       * was reserved.
       */
      try {
        await releaseFailedUploadStorage({
          userId,
          fileId:
            fileId.toString(),
        });
      } catch (cleanupError) {
        console.error(
          "Failed to release storage after single upload initiation failure:",
          cleanupError,
        );
      }

      throw error;
    }
  };



//  Initiate multipart upload for files >= 100 MB
export const initiateMultipartUploadService =
  async ({
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
    await validateDirectory(
      directoryId,
      userId,
    );

    const fileId =
      new mongoose.Types.ObjectId();

    const storageKey =
      `${fileId}${path.extname(name)}`;

    /*
     * Create multipart upload in S3 first.
     */
    const uploadId =
      await initiateMultipartUpload({
        key: storageKey,
        contentType: mimeType,
      });

    try {
      /*
       * Reserve storage + create file.
       */
      const session =
        await mongoose.startSession();

      try {
        await session.withTransaction(
          async () => {
            await reserveUserStorage({
              userId,
              size,
              session,
            });

            await File.create(
              [
                {
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
                },
              ],
              {
                session,
              },
            );
          },
        );
      } finally {
        await session.endSession();
      }

      return {
        uploadType: "multipart" as const,
        fileId:
          fileId.toString(),
        storageKey,
        uploadId,
        partSize:
          MULTIPART_PART_SIZE,
        totalParts:
          Math.ceil(
            size /
              MULTIPART_PART_SIZE,
          ),
      };
    } catch (error) {
      /// MongoDB transaction failed.
      // The multipart upload now exists only in S3, so we need to abort it.
      try {
        await abortMultipartUpload({
          key: storageKey,
          uploadId,
        });
      } catch (cleanupError) {
        console.error(
          "Failed to abort orphaned multipart upload:",
          cleanupError,
        );
      }

      throw error;
    }
  };


// Generate multipart part URL
export const getMultipartPartUploadUrl =
  async ({
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
      throw new AppError(
        "Upload not found",
        404,
      );
    }

    if (!file.uploadId) {
      throw new AppError(
        "File is not a multipart upload",
        400,
      );
    }

    const totalParts =
      Math.ceil(
        file.size /
          MULTIPART_PART_SIZE,
      );

    if (
      !Number.isInteger(
        partNumber,
      ) ||
      partNumber < 1 ||
      partNumber > totalParts
    ) {
      throw new AppError(
        "Invalid part number",
        400,
      );
    }

    const uploadUrl =
      await generateMultipartPartUrl({
        key: file.storageKey,
        uploadId:
          file.uploadId,
        partNumber,
      });

    return {
      partNumber,
      uploadUrl,
    };
  };

/*
|--------------------------------------------------------------------------
| Finalize verified file
|--------------------------------------------------------------------------
|
| IMPORTANT:
|
| User storage was already reserved during initiation.
|
| Therefore completion does NOT increase user storage.
|
| Only:
|
| uploading -> ready
|
| and:
|
| directory.size += file.size
|--------------------------------------------------------------------------
*/

const finalizeVerifiedFile =
  async ({
    userId,
    fileId,
  }: {
    userId: string;
    fileId: string;
  }) => {
    const session =
      await mongoose.startSession();

    let result:
      | {
          fileId: string;
          name: string;
          mimeType: string;
          size: number;
          status: "ready";
          storageUsedInBytes: number;
          directorySize: number;
        }
      | null = null;

    try {
      await session.withTransaction(
        async () => {
          const file =
            await File.findOne({
              _id: fileId,
              userId,
              deletedAt: null,
            }).session(session);

          if (!file) {
            throw new AppError(
              "Upload not found",
              404,
            );
          }

          /*
           * Idempotency:
           *
           * The previous completion request may have committed
           * successfully while its HTTP response was lost.
           * A retry must return success without incrementing
           * directory size again.
           */
          if (file.status === "ready") {
            const directory =
              await Directory.findOne({
                _id: file.directoryId,
                userId,
                deletedAt: null,
              })
                .select("size")
                .session(session);

            const user =
              await User.findById(userId)
                .select("storageUsedInBytes")
                .session(session);

            if (!directory) {
              throw new AppError(
                "Directory not found",
                404,
              );
            }

            if (!user) {
              throw new AppError(
                "User not found",
                404,
              );
            }

            result = {
              fileId: file._id.toString(),
              name: file.name,
              mimeType: file.mimeType,
              size: file.size,
              status: "ready",
              storageUsedInBytes:
                user.storageUsedInBytes,
              directorySize: directory.size,
            };

            return;
          }

          if (file.status !== "uploading") {
            throw new AppError(
              "Upload cannot be completed",
              409,
            );
          }

          /*
           * Atomic status transition.
           *
           * Prevents storage/directory size from
           * being updated twice if completion is
           * accidentally called twice.
           */
          const updatedFile =
            await File.findOneAndUpdate(
              {
                _id: file._id,
                userId,
                status: "uploading",
                deletedAt: null,
              },
              {
                $set: {
                  status: "ready",
                  uploadId: null,
                },
              },
              {
                returnDocument : "after",
                session,
              },
            );

          if (!updatedFile) {
            throw new AppError(
              "File upload has already been completed",
              409,
            );
          }

          /*
           * Directory size represents the size
           * of ready files directly inside it.
           */
          const directory =
            await Directory.findOneAndUpdate(
              {
                _id: file.directoryId,
                userId,
                deletedAt: null,
              },
              {
                $inc: {
                  size: file.size,
                },
              },
              {
                returnDocument : "after",
                session,
              },
            );

          if (!directory) {
            throw new AppError(
              "Directory not found",
              404,
            );
          }

          const user =
            await User.findById(
              userId,
            )
              .select(
                "storageUsedInBytes",
              )
              .session(session);

          if (!user) {
            throw new AppError(
              "User not found",
              404,
            );
          }

          result = {
            fileId:
              updatedFile._id.toString(),
            name:
              updatedFile.name,
            mimeType:
              updatedFile.mimeType,
            size:
              updatedFile.size,
            status: "ready",
            storageUsedInBytes:
              user.storageUsedInBytes,
            directorySize:
              directory.size,
          };
        },
      );
    } finally {
      await session.endSession();
    }

    if (!result) {
      throw new AppError(
        "Failed to finalize file upload",
        500,
      );
    }

    return result;
  };

/*
|--------------------------------------------------------------------------
| Complete single upload
|--------------------------------------------------------------------------
*/

export const completeSingleFileUpload =
  async ({
    userId,
    fileId,
  }: {
    userId: string;
    fileId: string;
  }) => {
    const file = await File.findOne({
      _id: fileId,
      userId,
      deletedAt: null,
    });

    if (!file) {
      throw new AppError(
        "Upload not found",
        404,
      );
    }

    if (file.status === "ready") {
      return finalizeVerifiedFile({
        userId,
        fileId,
      });
    }

    if (file.status !== "uploading") {
      throw new AppError(
        "Upload cannot be completed",
        409,
      );
    }

    if (file.uploadId) {
      throw new AppError(
        "This file is a multipart upload",
        400,
      );
    }

    let metadata;

    try {
      metadata =
        await getS3FileMetaData(
          file.storageKey,
        );
    } catch (error) {
      console.error(
        "Failed to verify uploaded file:",
        error,
      );

      /*
       * Do not delete the upload here. A transient network/AWS
       * error can happen even though the S3 object is valid.
       * Keep the reservation and allow the client to retry
       * completion. Explicit abort/discard performs cleanup.
       */
      throw new AppError(
        "Could not verify uploaded file. Please retry.",
        503,
      );
    }

    if (
      metadata.ContentLength !==
      file.size
    ) {
      try {
        await cleanupFailedUpload({
          userId,
          fileId:
            file._id.toString(),
          storageKey:
            file.storageKey,
          uploadId: null,
        });
      } catch (cleanupError) {
        console.error(
          "Failed to clean up invalid single upload:",
          cleanupError,
        );
      }

      throw new AppError(
        "Uploaded file size does not match expected size",
        400,
      );
    }

    return finalizeVerifiedFile({
      userId,
      fileId,
    });
  };

/*
|--------------------------------------------------------------------------
| Complete multipart upload
|--------------------------------------------------------------------------
*/

export const completeMultipartFileUpload =
  async ({
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
      deletedAt: null,
    });

    if (!file) {
      throw new AppError(
        "Upload not found",
        404,
      );
    }

    if (file.status === "ready") {
      return finalizeVerifiedFile({
        userId,
        fileId,
      });
    }

    if (file.status !== "uploading") {
      throw new AppError(
        "Upload cannot be completed",
        409,
      );
    }

    if (!file.uploadId) {
      throw new AppError(
        "This file is not a multipart upload",
        400,
      );
    }

    const totalParts =
      Math.ceil(
        file.size /
          MULTIPART_PART_SIZE,
      );

    if (
      parts.length !== totalParts
    ) {
      throw new AppError(
        `Expected ${totalParts} parts`,
        400,
      );
    }

    const partNumbers =
      new Set<number>();

    for (const part of parts) {
      if (
        !Number.isInteger(
          part.partNumber,
        ) ||
        part.partNumber < 1 ||
        part.partNumber > totalParts
      ) {
        throw new AppError(
          `Invalid part number: ${part.partNumber}`,
          400,
        );
      }

      if (
        partNumbers.has(
          part.partNumber,
        )
      ) {
        throw new AppError(
          `Duplicate part number: ${part.partNumber}`,
          400,
        );
      }

      if (!part.eTag) {
        throw new AppError(
          `Missing ETag for part ${part.partNumber}`,
          400,
        );
      }

      partNumbers.add(
        part.partNumber,
      );
    }

    for (
      let i = 1;
      i <= totalParts;
      i++
    ) {
      if (!partNumbers.has(i)) {
        throw new AppError(
          `Missing part number: ${i}`,
          400,
        );
      }
    }

    const orderedParts =
      parts
        .map((part) => ({
          PartNumber:
            part.partNumber,
          ETag:
            part.eTag,
        }))
        .sort(
          (a, b) =>
            a.PartNumber -
            b.PartNumber,
        );

    try {
      await completeMultipartUpload({
        key: file.storageKey,
        uploadId: file.uploadId,
        parts: orderedParts,
      });
    } catch (error) {
      /*
       * S3 may have completed the object even if
       * the SDK request returned an error.
       *
       * Check the final object before deciding
       * that completion failed.
       */
      console.error(
        "Multipart completion returned an error:",
        error,
      );

      try {
        const metadata =
          await getS3FileMetaData(
            file.storageKey,
          );

        if (
          metadata.ContentLength !==
          file.size
        ) {
          throw new Error(
            "Final S3 object size does not match",
          );
        }
      } catch {
        throw new AppError(
          "Failed to complete multipart upload",
          500,
        );
      }
    }

    /*
     * Always verify the final object.
     */
    let metadata;

    try {
      metadata =
        await getS3FileMetaData(
          file.storageKey,
        );
    } catch (error) {
      console.error(
        "Multipart object verification failed:",
        error,
      );

      /*
       * Preserve the upload on verification/network failure.
       * The client can safely retry completion. Explicit abort
       * or discard is responsible for cleanup.
       */
      throw new AppError(
        "Could not verify uploaded file. Please retry.",
        503,
      );
    }

    if (
      metadata.ContentLength !==
      file.size
    ) {
      /*
       * The object exists but is invalid.
       */
      try {
        await deleteS3Object(
          file.storageKey,
        );

        await releaseFailedUploadStorage({
          userId,
          fileId:
            file._id.toString(),
        });
      } catch (cleanupError) {
        console.error(
          "Failed to clean up invalid multipart upload:",
          cleanupError,
        );
      }

      throw new AppError(
        "Uploaded file size does not match expected size",
        400,
      );
    }

    return finalizeVerifiedFile({
      userId,
      fileId,
    });
  };

/*
|--------------------------------------------------------------------------
| Abort / Cancel upload
|--------------------------------------------------------------------------
*/

export const abortFileUpload =
  async ({
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
      throw new AppError(
        "Upload not found",
        404,
      );
    }

    /*
     * Clean S3 first.
     */
    try {
      if (file.uploadId) {
        await abortMultipartUpload({
          key: file.storageKey,
          uploadId: file.uploadId,
        });
      } else {
        await deleteS3Object(
          file.storageKey,
        );
      }
    } catch (error) {
      console.error(
        "Failed to clean up upload in S3:",
        error,
      );

      throw new AppError(
        "Failed to abort upload",
        500,
      );
    }

    /*
     * Delete File + release reserved storage
     * atomically.
     */
    const session =
      await mongoose.startSession();

    try {
      await session.withTransaction(
        async () => {
          const deletedFile =
            await File.findOneAndDelete(
              {
                _id: file._id,
                userId,
                status: "uploading",
              },
              {
                session,
              },
            );

          if (!deletedFile) {
            throw new AppError(
              "Upload not found",
              404,
            );
          }

          await User.updateOne(
            {
              _id: userId,
            },
            {
              $inc: {
                storageUsedInBytes:
                  -deletedFile.size,
              },
            },
            {
              session,
            },
          );
        },
      );
    } finally {
      await session.endSession();
    }

    return {
      fileId:
        file._id.toString(),
      status:
        "cancelled" as const,
    };
  };

/*
|--------------------------------------------------------------------------
| Rename file
|--------------------------------------------------------------------------
*/

export const renameFile =
  async ({
    userId,
    fileId,
    name,
  }: {
    userId: string;
    fileId: string;
    name: string;
  }) => {
    const file = await File.findOne({
      _id: fileId,
      userId,
      status: "ready",
      deletedAt: null,
    });

    if (!file) {
      throw new AppError(
        "File not found",
        404,
      );
    }

    file.name = name;

    await file.save();

    return file;
  };

/*
|--------------------------------------------------------------------------
| Soft delete file
|--------------------------------------------------------------------------
|
| Storage remains consumed.
|
| Directory size decreases because the file is
| no longer active inside the directory.
|--------------------------------------------------------------------------
*/

export const softDeleteFile =
  async ({
    userId,
    fileId,
  }: {
    userId: string;
    fileId: string;
  }) => {
    const session =
      await mongoose.startSession();

    let result:
      | {
          fileId: string;
          deletedAt: Date;
        }
      | null = null;

    try {
      await session.withTransaction(
        async () => {
          const file =
            await File.findOneAndUpdate(
              {
                _id: fileId,
                userId,
                status: "ready",
                deletedAt: null,
              },
              {
                $set: {
                  deletedAt:
                    new Date(),
                },
              },
              {
                returnDocument: "after",
                session,
              },
            );

          if (!file) {
            throw new AppError(
              "File not found",
              404,
            );
          }

          await Directory.updateOne(
            {
              _id: file.directoryId,
              userId,
              deletedAt: null,
            },
            {
              $inc: {
                size: -file.size,
              },
            },
            {
              session,
            },
          );

          result = {
            fileId:
              file._id.toString(),
            deletedAt:
              file.deletedAt!,
          };
        },
      );
    } finally {
      await session.endSession();
    }

    if (!result) {
      throw new AppError(
        "Failed to move file to trash",
        500,
      );
    }

    return result;
  };

/*
|--------------------------------------------------------------------------
| Get file trash
|--------------------------------------------------------------------------
|
| Files inside a trashed directory are not shown
| individually. They are represented by the
| top-level trashed directory.
|--------------------------------------------------------------------------
*/

export const getTrashedFiles =
  async (userId: string) => {
    const activeDirectories =
      await Directory.find({
        userId,
        deletedAt: null,
      })
        .select("_id")
        .lean();

    if (
      activeDirectories.length ===
      0
    ) {
      return [];
    }

    return File.find({
      userId,
      deletedAt: {
        $ne: null,
      },
      directoryId: {
        $in: activeDirectories.map(
          (directory) =>
            directory._id,
        ),
      },
    })
      .sort({
        deletedAt: -1,
      })
      .lean();
  };

/*
|--------------------------------------------------------------------------
| Restore file
|--------------------------------------------------------------------------
|
| Parent directory must be active.
|
| User storage does not change because trash
| never released the storage reservation.
|--------------------------------------------------------------------------
*/

export const restoreFile =
  async ({
    userId,
    fileId,
  }: {
    userId: string;
    fileId: string;
  }) => {
    const session =
      await mongoose.startSession();

    let result = null;

    try {
      await session.withTransaction(
        async () => {
          const file =
            await File.findOne({
              _id: fileId,
              userId,
              status: "ready",
              deletedAt: {
                $ne: null,
              },
            }).session(session);

          if (!file) {
            throw new AppError(
              "Trashed file not found",
              404,
            );
          }

          const directory =
            await Directory.findOne({
              _id: file.directoryId,
              userId,
              deletedAt: null,
            }).session(session);

          if (!directory) {
            throw new AppError(
              "Restore the parent directory first",
              409,
            );
          }

          file.deletedAt = null;

          await file.save({
            session,
          });

          directory.size +=
            file.size;

          await directory.save({
            session,
          });

          result =
            file.toObject();
        },
      );
    } finally {
      await session.endSession();
    }

    return result;
  };

  
// Permanently delete file
export const permanentlyDeleteFile =
  async ({
    userId,
    fileId,
  }: {
    userId: string;
    fileId: string;
  }) => {
    const file = await File.findOne({
      _id: fileId,
      userId,
      deletedAt: {
        $ne: null,
      },
    });

    if (!file) {
      throw new AppError(
        "Trashed file not found",
        404,
      );
    }

    /*
     * A trashed ready file should not normally
     * have an active multipart upload.
     *
     * Still clean it if one exists.
     */
    if (file.uploadId) {
      try {
        await abortMultipartUpload({
          key: file.storageKey,
          uploadId: file.uploadId,
        });
      } catch (error) {
        console.error(
          "Failed to abort stale multipart upload:",
          error,
        );

        throw new AppError(
          "Failed to permanently delete file",
          500,
        );
      }
    }

    /*
     * Delete the actual S3 object.
     */
    try {
      await deleteS3Object(
        file.storageKey,
      );
    } catch (error) {
      console.error(
        "Failed to delete file from S3:",
        error,
      );

      throw new AppError(
        "Failed to permanently delete file",
        500,
      );
    }

     //  Release storage + delete DB record.
    const session =
      await mongoose.startSession();

    try {
      await session.withTransaction(
        async () => {
          const currentFile =
            await File.findOne({
              _id: file._id,
              userId,
              deletedAt: {
                $ne: null,
              },
            }).session(session);

          if (!currentFile) {
            throw new AppError(
              "File not found",
              404,
            );
          }

          const user =
            await User.findById(
              userId,
            ).session(session);

          if (!user) {
            throw new AppError(
              "User not found",
              404,
            );
          }

          /*
           * Storage was reserved for this file
           * from upload initiation until now.
           */
          user.storageUsedInBytes =
            Math.max(
              0,
              user.storageUsedInBytes -
                currentFile.size,
            );

          await user.save({
            session,
          });

          /*
           * Directory size was already reduced
           * when the file entered trash.
           *
           * Therefore do NOT decrement it here.
           */
          await File.deleteOne(
            {
              _id:
                currentFile._id,
              userId,
            },
            {
              session,
            },
          );
        },
      );
    } finally {
      await session.endSession();
    }

    return {
      fileId:
        file._id.toString(),
      storageFreedInBytes:
        file.size,
    };
  };