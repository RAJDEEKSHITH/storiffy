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

// Temporary upload records receive a server-side lease. This is the
// protection against browser/tab close, network loss, crashes, and clients
// that never call the complete/abort endpoint.
export const UPLOAD_LEASE_MS = 2 * 60 * 60 * 1000; // 2 hours
const CLEANUP_RETRY_LEASE_MS = 5 * 60 * 1000; // 5 minutes

const getUploadLeaseExpiry = () =>
  new Date(Date.now() + UPLOAD_LEASE_MS);

const getCleanupRetryLeaseExpiry = () =>
  new Date(Date.now() + CLEANUP_RETRY_LEASE_MS);

const getUploadLeaseExpiryFrom = (date: Date) =>
  new Date(date.getTime() + UPLOAD_LEASE_MS);

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


/*
|--------------------------------------------------------------------------
| Upload lifecycle helpers
|--------------------------------------------------------------------------
|
| A browser -> S3 upload cannot reliably notify this API when the browser
| closes, the tab crashes, the network disappears, or the process dies.
| uploadExpiresAt therefore acts as a lease for every temporary upload.
|
| State machine:
|
| uploading   -> finalizing -> ready
| uploading   -> failed    -> deleted
| finalizing  -> failed    -> deleted
|
| Completion and cleanup claim the record with conditional MongoDB updates.
| That makes the operation race-safe when two requests/workers run at once.
|--------------------------------------------------------------------------
*/

const isS3NotFoundError = (error: unknown) => {
  const value = error as {
    name?: string;
    Code?: string;
    $metadata?: { httpStatusCode?: number };
  } | null;

  return (
    value?.name === "NotFound" ||
    value?.name === "NoSuchKey" ||
    value?.name === "NoSuchUpload" ||
    value?.Code === "NoSuchKey" ||
    value?.Code === "NoSuchUpload" ||
    value?.$metadata?.httpStatusCode === 404
  );
};

const cleanupS3ForUpload = async ({
  storageKey,
  uploadId,
}: {
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
      await deleteS3Object(storageKey);
    }
  } catch (error) {
    // The desired S3 state is already absent.
    if (!isS3NotFoundError(error)) {
      throw error;
    }
  }
};

const markUploadFailed = async ({
  userId,
  fileId,
}: {
  userId: string;
  fileId: string;
}) => {
  return File.findOneAndUpdate(
    {
      _id: fileId,
      userId,
      deletedAt: null,
      status: {
        $in: ["uploading", "finalizing"],
      },
    },
    {
      $set: {
        status: "failed",
        uploadExpiresAt: getCleanupRetryLeaseExpiry(),
      },
    },
    {
      returnDocument: "after",
    },
  ).lean();
};

const deleteFailedUploadAndReleaseStorage = async ({
  userId,
  fileId,
}: {
  userId: string;
  fileId: string;
}) => {
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      const deletedFile = await File.findOneAndDelete(
        {
          _id: fileId,
          userId,
          status: "failed",
          deletedAt: null,
        },
        { session },
      );

      if (!deletedFile) {
        return;
      }

      await User.updateOne(
        {
          _id: userId,
        },
        {
          $inc: {
            storageUsedInBytes: -deletedFile.size,
          },
        },
        { session },
      );
    });
  } finally {
    await session.endSession();
  }
};

const cleanupClaimedFailedUpload = async ({
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
  await cleanupS3ForUpload({
    storageKey,
    uploadId,
  });

  await deleteFailedUploadAndReleaseStorage({
    userId,
    fileId,
  });
};

const getReadyUploadResult = async ({
  userId,
  fileId,
}: {
  userId: string;
  fileId: string;
}) => {
  const file = await File.findOne({
    _id: fileId,
    userId,
    status: "ready",
    deletedAt: null,
  }).lean();

  if (!file) {
    throw new AppError("File not found", 404);
  }

  const [directory, user] = await Promise.all([
    Directory.findOne({
      _id: file.directoryId,
      userId,
      deletedAt: null,
    })
      .select("size")
      .lean(),

    User.findById(userId)
      .select("storageUsedInBytes")
      .lean(),
  ]);

  if (!directory || !user) {
    throw new AppError(
      "Upload state is inconsistent",
      500,
    );
  }

  return {
    fileId: file._id.toString(),
    name: file.name,
    mimeType: file.mimeType,
    size: file.size,
    status: "ready" as const,
    storageUsedInBytes: user.storageUsedInBytes,
    directorySize: directory.size,
  };
};

/*
 * A stale finalizing record is claimed by extending its lease. While the
 * lease is fresh, completion requests are rejected, so this worker owns the
 * recovery attempt.
 */
const claimExpiredFinalizingUpload = async ({
  userId,
  fileId,
}: {
  userId: string;
  fileId: string;
}) => {
  const now = new Date();

  return File.findOneAndUpdate(
    {
      _id: fileId,
      userId,
      status: "finalizing",
      deletedAt: null,
      uploadExpiresAt: {
        $lte: now,
      },
    },
    {
      $set: {
        uploadExpiresAt: getUploadLeaseExpiryFrom(now),
      },
    },
    {
      returnDocument: "after",
    },
  ).lean();
};

/*
 * Recover a finalizing upload after its lease expires.
 *
 * - Valid S3 object -> finalize.
 * - Missing S3 object -> release reservation.
 * - Transient S3 failure -> keep the record and retry later.
 * - Invalid size -> delete object and release reservation.
 */
export const recoverFinalizingUpload = async ({
  userId,
  fileId,
}: {
  userId: string;
  fileId: string;
}) => {
  const file = await claimExpiredFinalizingUpload({
    userId,
    fileId,
  });

  if (!file) {
    return false;
  }

  let metadata;

  try {
    metadata = await getS3FileMetaData(
      file.storageKey,
    );
  } catch (error) {
    if (!isS3NotFoundError(error)) {
      await File.updateOne(
        {
          _id: fileId,
          userId,
          status: "finalizing",
          deletedAt: null,
        },
        {
          $set: {
            uploadExpiresAt: getUploadLeaseExpiry(),
          },
        },
      );

      throw error;
    }

    const failed = await markUploadFailed({
      userId,
      fileId,
    });

    if (failed) {
      await deleteFailedUploadAndReleaseStorage({
        userId,
        fileId,
      });
    }

    return true;
  }

  if (metadata.ContentLength !== file.size) {
    const failed = await markUploadFailed({
      userId,
      fileId,
    });

    if (failed) {
      await cleanupClaimedFailedUpload({
        userId,
        fileId,
        storageKey: file.storageKey,
        uploadId: file.uploadId,
      });
    }

    return true;
  }

  return finalizeVerifiedFile({
    userId,
    fileId,
  });
};

/*
 * Recover an expired uploading record. This first claims it by changing the
 * state to finalizing. That same state is used by normal completion, so the
 * cleanup worker and a completion request cannot both own the record.
 */
export const cleanupExpiredUpload = async ({
  userId,
  fileId,
}: {
  userId: string;
  fileId: string;
}) => {
  const now = new Date();

  const staleFailed = await File.findOneAndUpdate(
    {
      _id: fileId,
      userId,
      status: "failed",
      deletedAt: null,
      uploadExpiresAt: {
        $lte: now,
      },
    },
    {
      $set: {
        uploadExpiresAt: getCleanupRetryLeaseExpiry(),
      },
    },
    {
      returnDocument: "after",
    },
  ).lean();

  if (staleFailed) {
    await cleanupClaimedFailedUpload({
      userId,
      fileId,
      storageKey: staleFailed.storageKey,
      uploadId: staleFailed.uploadId,
    });

    return true;
  }

  const staleUploading = await File.findOneAndUpdate(
    {
      _id: fileId,
      userId,
      status: "uploading",
      deletedAt: null,
      uploadExpiresAt: {
        $lte: now,
      },
    },
    {
      $set: {
        status: "finalizing",
        uploadExpiresAt: getUploadLeaseExpiryFrom(now),
      },
    },
    {
      returnDocument: "after",
    },
  ).lean();

  if (staleUploading) {
    let metadata;

    try {
      metadata = await getS3FileMetaData(
        staleUploading.storageKey,
      );
    } catch (error) {
      if (!isS3NotFoundError(error)) {
        await File.updateOne(
          {
            _id: fileId,
            userId,
            status: "finalizing",
            deletedAt: null,
          },
          {
            $set: {
              uploadExpiresAt: getUploadLeaseExpiry(),
            },
          },
        );

        throw error;
      }

      const failed = await markUploadFailed({
        userId,
        fileId,
      });

      if (failed) {
        await cleanupClaimedFailedUpload({
          userId,
          fileId,
          storageKey: staleUploading.storageKey,
          uploadId: staleUploading.uploadId,
        });
      }

      return true;
    }

    if (
      metadata.ContentLength !==
      staleUploading.size
    ) {
      const failed = await markUploadFailed({
        userId,
        fileId,
      });

      if (failed) {
        await cleanupClaimedFailedUpload({
          userId,
          fileId,
          storageKey: staleUploading.storageKey,
          uploadId: staleUploading.uploadId,
        });
      }

      return true;
    }

    await finalizeVerifiedFile({
      userId,
      fileId,
    });

    return true;
  }

  const staleFinalizing = await claimExpiredFinalizingUpload({
    userId,
    fileId,
  });

  if (staleFinalizing) {
    let metadata;

    try {
      metadata = await getS3FileMetaData(
        staleFinalizing.storageKey,
      );
    } catch (error) {
      if (!isS3NotFoundError(error)) {
        await File.updateOne(
          {
            _id: fileId,
            userId,
            status: "finalizing",
            deletedAt: null,
          },
          {
            $set: {
              uploadExpiresAt: getUploadLeaseExpiry(),
            },
          },
        );

        throw error;
      }

      const failed = await markUploadFailed({
        userId,
        fileId,
      });

      if (failed) {
        await deleteFailedUploadAndReleaseStorage({
          userId,
          fileId,
        });
      }

      return true;
    }

    if (
      metadata.ContentLength !==
      staleFinalizing.size
    ) {
      const failed = await markUploadFailed({
        userId,
        fileId,
      });

      if (failed) {
        await cleanupClaimedFailedUpload({
          userId,
          fileId,
          storageKey: staleFinalizing.storageKey,
          uploadId: staleFinalizing.uploadId,
        });
      }

      return true;
    }

    await finalizeVerifiedFile({
      userId,
      fileId,
    });

    return true;
  }

  return false;
};

/*
 * Explicit abort and definitive verification failures use this helper after
 * first changing the record to status=failed.
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
  await cleanupClaimedFailedUpload({
    userId,
    fileId,
    storageKey,
    uploadId,
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
    createdBy = userId,
  }: {
    userId: string;
    directoryId: string;
    name: string;
    size: number;
    mimeType: string;
    createdBy?: string;
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
                createdBy,
                directoryId,
                storageKey,
                mimeType,
                size,
                status: "uploading",
                uploadId: null,
                uploadExpiresAt: getUploadLeaseExpiry(),
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
       * S3 URL generation failed after storage was reserved. Mark the
       * temporary record failed and release the reservation immediately.
       * The operation is idempotent because only an uploading/finalizing
       * record can be claimed by markUploadFailed().
       */
      const failed = await markUploadFailed({
        userId,
        fileId: fileId.toString(),
      });

      if (failed) {
        await deleteFailedUploadAndReleaseStorage({
          userId,
          fileId: fileId.toString(),
        });
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
    createdBy = userId,
  }: {
    userId: string;
    directoryId: string;
    name: string;
    size: number;
    mimeType: string;
    createdBy?: string;
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
                  createdBy,
                  directoryId,
                  storageKey,
                  mimeType,
                  size,
                  status: "uploading",
                  uploadId,
                  uploadExpiresAt: getUploadLeaseExpiry(),
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
      uploadExpiresAt: {
        $gt: new Date(),
      },
    }).lean();

    if (!file) {
      throw new AppError(
        "Upload not found or expired",
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
      !Number.isInteger(partNumber) ||
      partNumber < 1 ||
      partNumber > totalParts
    ) {
      throw new AppError(
        "Invalid part number",
        400,
      );
    }

    // Each successful part-URL request proves that the multipart upload is
    // still active, so renew its lease.
    const renewed =
      await File.findOneAndUpdate(
        {
          _id: file._id,
          userId,
          status: "uploading",
          deletedAt: null,
          uploadExpiresAt: {
            $gt: new Date(),
          },
        },
        {
          $set: {
            uploadExpiresAt:
              getUploadLeaseExpiry(),
          },
        },
        {
          returnDocument: "after",
        },
      ).lean();

    if (!renewed?.uploadId) {
      throw new AppError(
        "Upload not found or expired",
        404,
      );
    }

    const uploadUrl =
      await generateMultipartPartUrl({
        key: renewed.storageKey,
        uploadId: renewed.uploadId,
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
| The upload must already be claimed as finalizing.
|
| User storage was reserved during initiation, so completion does not
| increment storage again. It only changes state to ready and increases the
| direct parent's directory size inside the same transaction.
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
    const session = await mongoose.startSession();

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
      await session.withTransaction(async () => {
        const file = await File.findOne({
          _id: fileId,
          userId,
          status: "finalizing",
          deletedAt: null,
        }).session(session);

        if (!file) {
          throw new AppError(
            "Upload is not available for finalization",
            409,
          );
        }

        const updatedFile =
          await File.findOneAndUpdate(
            {
              _id: file._id,
              userId,
              status: "finalizing",
              deletedAt: null,
            },
            {
              $set: {
                status: "ready",
                uploadId: null,
                uploadExpiresAt: null,
              },
            },
            {
              returnDocument: "after",
              session,
            },
          );

        if (!updatedFile) {
          throw new AppError(
            "File upload has already been finalized",
            409,
          );
        }

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
              returnDocument: "after",
              session,
            },
          );

        if (!directory) {
          throw new AppError(
            "Directory not found",
            404,
          );
        }

        const user = await User.findById(userId)
          .select("storageUsedInBytes")
          .session(session);

        if (!user) {
          throw new AppError(
            "User not found",
            404,
          );
        }

        result = {
          fileId: updatedFile._id.toString(),
          name: updatedFile.name,
          mimeType: updatedFile.mimeType,
          size: updatedFile.size,
          status: "ready",
          storageUsedInBytes:
            user.storageUsedInBytes,
          directorySize: directory.size,
        };
      });
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

const claimUploadForCompletion = async ({
  userId,
  fileId,
}: {
  userId: string;
  fileId: string;
}) => {
  const now = new Date();

  const claimed = await File.findOneAndUpdate(
    {
      _id: fileId,
      userId,
      status: "uploading",
      deletedAt: null,
      $or: [
        {
          uploadExpiresAt: {
            $gt: now,
          },
        },
        {
          uploadExpiresAt: null,
        },
      ],
    },
    {
      $set: {
        status: "finalizing",
        uploadExpiresAt:
          getUploadLeaseExpiry(),
      },
    },
    {
      returnDocument: "after",
    },
  ).lean();

  if (claimed) {
    return claimed;
  }

  const existing = await File.findOne({
    _id: fileId,
    userId,
    deletedAt: null,
  })
    .select("status")
    .lean();

  if (existing?.status === "ready") {
    return "ready" as const;
  }

  if (existing?.status === "finalizing") {
    throw new AppError(
      "Upload completion is already in progress",
      409,
    );
  }

  if (existing?.status === "failed") {
    throw new AppError(
      "Upload has failed and is being cleaned up",
      409,
    );
  }

  throw new AppError(
    "Upload has expired or is no longer available",
    409,
  );
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
    const claimed =
      await claimUploadForCompletion({
        userId,
        fileId,
      });

    if (claimed === "ready") {
      return getReadyUploadResult({
        userId,
        fileId,
      });
    }

    if (claimed.uploadId) {
      throw new AppError(
        "This file is a multipart upload",
        400,
      );
    }

    let metadata;

    try {
      metadata = await getS3FileMetaData(
        claimed.storageKey,
      );
    } catch (error) {
      if (isS3NotFoundError(error)) {
        const failed =
          await markUploadFailed({
            userId,
            fileId,
          });

        if (failed) {
          await cleanupFailedUpload({
            userId,
            fileId,
            storageKey:
              claimed.storageKey,
            uploadId: null,
          });
        }

        throw new AppError(
          "Uploaded file was not found in storage",
          400,
        );
      }

      await File.updateOne(
        {
          _id: fileId,
          userId,
          status: "finalizing",
          deletedAt: null,
        },
        {
          $set: {
            uploadExpiresAt:
              getUploadLeaseExpiry(),
          },
        },
      );

      throw new AppError(
        "Could not verify uploaded file. Please retry.",
        503,
      );
    }

    if (metadata.ContentLength !== claimed.size) {
      const failed =
        await markUploadFailed({
          userId,
          fileId,
        });

      if (failed) {
        await cleanupFailedUpload({
          userId,
          fileId,
          storageKey:
            claimed.storageKey,
          uploadId: null,
        });
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
    const claimed =
      await claimUploadForCompletion({
        userId,
        fileId,
      });

    if (claimed === "ready") {
      return getReadyUploadResult({
        userId,
        fileId,
      });
    }

    if (!claimed.uploadId) {
      throw new AppError(
        "This file is not a multipart upload",
        400,
      );
    }

    const totalParts =
      Math.ceil(
        claimed.size /
          MULTIPART_PART_SIZE,
      );

    if (parts.length !== totalParts) {
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
        key: claimed.storageKey,
        uploadId: claimed.uploadId,
        parts: orderedParts,
      });
    } catch (error) {
      // The S3 completion request can succeed while its HTTP response is
      // lost. HEAD the final object before treating the operation as failed.
      try {
        const metadata =
          await getS3FileMetaData(
            claimed.storageKey,
          );

        if (
          metadata.ContentLength !==
          claimed.size
        ) {
          throw new Error(
            "Final S3 object size does not match",
          );
        }
      } catch {
        await File.updateOne(
          {
            _id: fileId,
            userId,
            status: "finalizing",
            deletedAt: null,
          },
          {
            $set: {
              uploadExpiresAt:
                getUploadLeaseExpiry(),
            },
          },
        );

        throw new AppError(
          "Failed to complete multipart upload. Please retry.",
          503,
        );
      }
    }

    let metadata;

    try {
      metadata = await getS3FileMetaData(
        claimed.storageKey,
      );
    } catch {
      await File.updateOne(
        {
          _id: fileId,
          userId,
          status: "finalizing",
          deletedAt: null,
        },
        {
          $set: {
            uploadExpiresAt:
              getUploadLeaseExpiry(),
          },
        },
      );

      throw new AppError(
        "Could not verify uploaded file. Please retry.",
        503,
      );
    }

    if (
      metadata.ContentLength !==
      claimed.size
    ) {
      const failed =
        await markUploadFailed({
          userId,
          fileId,
        });

      if (failed) {
        await cleanupFailedUpload({
          userId,
          fileId,
          storageKey:
            claimed.storageKey,
          uploadId:
            claimed.uploadId,
        });
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

export const abortFileUpload = async ({
  userId,
  fileId,
}: {
  userId: string;
  fileId: string;
}) => {
  /*
   * Explicit abort is allowed to transition only an active upload.
   * Do NOT use markUploadFailed() here because that helper also accepts
   * "finalizing", which can race with a legitimate completion request.
   */
  const claimed = await File.findOneAndUpdate(
    {
      _id: fileId,
      userId,
      status: "uploading",
      deletedAt: null,
    },
    {
      $set: {
        status: "failed",
        uploadExpiresAt: getCleanupRetryLeaseExpiry(),
      },
    },
    {
      returnDocument: "after",
    },
  ).lean();

  if (claimed) {
    try {
      await cleanupClaimedFailedUpload({
        userId,
        fileId,
        storageKey: claimed.storageKey,
        uploadId: claimed.uploadId,
      });
    } catch (error) {
      console.error(
        "Failed to clean up upload in S3:",
        error,
      );

      await File.updateOne(
        {
          _id: fileId,
          userId,
          status: "failed",
          deletedAt: null,
        },
        {
          $set: {
            uploadExpiresAt: getCleanupRetryLeaseExpiry(),
          },
        },
      );

      throw new AppError(
        "Failed to abort upload. Cleanup will be retried automatically.",
        500,
      );
    }

    return {
      fileId: claimed._id.toString(),
      status: "cancelled" as const,
    };
  }

  const existing = await File.findOne({
    _id: fileId,
    userId,
    deletedAt: null,
  })
    .select("_id status storageKey uploadId")
    .lean();

  if (!existing) {
    throw new AppError(
      "Upload not found",
      404,
    );
  }

  if (existing.status === "ready") {
    return {
      fileId,
      status: "already-completed" as const,
    };
  }

  if (existing.status === "finalizing") {
    throw new AppError(
      "Upload completion is already in progress",
      409,
    );
  }

  if (existing.status === "failed") {
    try {
      await cleanupClaimedFailedUpload({
        userId,
        fileId,
        storageKey: existing.storageKey,
        uploadId: existing.uploadId,
      });
    } catch (error) {
      console.error(
        "Failed to clean up failed upload:",
        error,
      );

      await File.updateOne(
        {
          _id: fileId,
          userId,
          status: "failed",
          deletedAt: null,
        },
        {
          $set: {
            uploadExpiresAt: getCleanupRetryLeaseExpiry(),
          },
        },
      );

      throw new AppError(
        "Failed to discard upload. Cleanup will be retried automatically.",
        500,
      );
    }

    return {
      fileId,
      status: "cancelled" as const,
    };
  }

  throw new AppError(
    "Upload not found",
    404,
  );
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

/*
|--------------------------------------------------------------------------
| Shared-editor compatibility wrappers
|--------------------------------------------------------------------------
|
| restricted-share.service.ts works with two identities:
|
| ownerId  = resource owner
| actorId  = authenticated editor
|
| Share authorization is performed before these functions are called.
| The underlying upload operations intentionally continue to use ownerId
| for File.userId / storage accounting.
|--------------------------------------------------------------------------
*/

export const getMultipartPartUploadUrlAsCreator = async ({
  ownerId,
  actorId: _actorId,
  fileId,
  partNumber,
}: {
  ownerId: string;
  actorId: string;
  fileId: string;
  partNumber: number;
}) => {
  return getMultipartPartUploadUrl({
    userId: ownerId,
    fileId,
    partNumber,
  });
};

export const completeSingleFileUploadAsCreator = async ({
  ownerId,
  actorId: _actorId,
  fileId,
}: {
  ownerId: string;
  actorId: string;
  fileId: string;
}) => {
  return completeSingleFileUpload({
    userId: ownerId,
    fileId,
  });
};

export const completeMultipartFileUploadAsCreator = async ({
  ownerId,
  actorId: _actorId,
  fileId,
  parts,
}: {
  ownerId: string;
  actorId: string;
  fileId: string;
  parts: { partNumber: number; eTag: string }[];
}) => {
  return completeMultipartFileUpload({
    userId: ownerId,
    fileId,
    parts,
  });
};

export const abortFileUploadAsCreator = async ({
  ownerId,
  actorId: _actorId,
  fileId,
}: {
  ownerId: string;
  actorId: string;
  fileId: string;
}) => {
  return abortFileUpload({
    userId: ownerId,
    fileId,
  });
};

export const softDeleteFileAsCreator = async ({
  ownerId,
  actorId,
  fileId,
}: {
  ownerId: string;
  actorId: string;
  fileId: string;
}) => {
  const file = await File.findOne({
    _id: fileId,
    userId: ownerId,
    createdBy: actorId,
    status: "ready",
    deletedAt: null,
  })
    .select("_id")
    .lean();

  if (!file) {
    throw new AppError(
      "File not found or you can only delete files you created",
      404,
    );
  }

  return softDeleteFile({
    userId: ownerId,
    fileId,
  });
};

/*
|--------------------------------------------------------------------------
| Shared file access helpers
|--------------------------------------------------------------------------
|
| These functions are intentionally separate from the owner operations
| above. The ShareLink service is responsible for validating the share
| token, expiry, recipient, and permission before calling these helpers.
|
| userId remains the resource owner. createdBy identifies the actor who
| created a resource through a shared editor link.
|--------------------------------------------------------------------------
*/

export const getFileForSharedAccess = async ({
  ownerId,
  fileId,
}: {
  ownerId: string;
  fileId: string;
}) => {
  const file = await File.findOne({
    _id: fileId,
    userId: ownerId,
    status: "ready",
    deletedAt: null,
  }).lean();

  if (!file) {
    throw new AppError(
      "File not found",
      404,
    );
  }

  return file;
};

/*
 * A file editor is allowed to rename a shared file even when another
 * user originally created that file. Permission to do so comes from
 * the ShareLink service; this helper only enforces owner boundaries.
 */
export const renameSharedFile = async ({
  ownerId,
  fileId,
  name,
}: {
  ownerId: string;
  fileId: string;
  name: string;
}) => {
  return renameFile({
    userId: ownerId,
    fileId,
    name,
  });
};

/*
 * Shared-directory editors may delete only files they created.
 * The owner can still delete any file through the normal owner API.
 */
export const softDeleteSharedFile = async ({
  ownerId,
  actorId,
  fileId,
}: {
  ownerId: string;
  actorId: string;
  fileId: string;
}) => {
  const file = await File.findOne({
    _id: fileId,
    userId: ownerId,
    status: "ready",
    deletedAt: null,
  })
    .select("_id createdBy")
    .lean();

  if (!file) {
    throw new AppError(
      "File not found",
      404,
    );
  }

  if (
    !file.createdBy ||
    file.createdBy.toString() !== actorId
  ) {
    throw new AppError(
      "You can only delete files you created",
      403,
    );
  }

  return softDeleteFile({
    userId: ownerId,
    fileId,
  });
};
