import mongoose from "mongoose";

import Directory from "../../models/directory.model.js";
import File from "../../models/file.model.js";
import User from "../../models/user.model.js";
import { AppError } from "../../utils/app.error.js";

import {
  abortMultipartUpload,
  deleteS3Objects,
} from "../aws/s3.service.js";

const S3_DELETE_BATCH_SIZE = 1000;

/*
|--------------------------------------------------------------------------
| Empty Trash
|--------------------------------------------------------------------------
|
| Permanently deletes every trashed file and directory belonging to
| the authenticated user.
|
| Important:
|
| - Files inside trashed directories are included automatically.
| - We do NOT call permanentlyDeleteFile() or
|   permanentlyDeleteDirectory() one-by-one.
| - Existing individual restore/delete functionality remains untouched.
|
| Storage:
|
| Files reserve user storage until they are permanently deleted.
| Therefore only ready files contribute to storageFreedInBytes.
|
| Directory size:
|
| Moving a file to trash already decreases its active parent directory
| size. Therefore Empty Trash does NOT modify directory.size.
|--------------------------------------------------------------------------
*/

export const emptyTrash = async ({
  userId,
}: {
  userId: string;
}) => {
  /*
   * Load every trashed directory and every trashed file.
   *
   * $exists protects us from accidentally treating documents that
   * might not contain deletedAt as trashed.
   */
  const [directories, files] = await Promise.all([
    Directory.find({
      userId,
      deletedAt: {
        $exists: true,
        $ne: null,
      },
    }).lean(),

    File.find({
      userId,
      deletedAt: {
        $exists: true,
        $ne: null,
      },
    }).lean(),
  ]);

  /*
   * There should never be an active upload in Trash.
   *
   * Directory trash and file trash both normally only contain
   * completed files, but keep this defensive check consistent
   * with the existing permanent directory deletion behavior.
   */
  const uploadingFile = files.find(
    (file) => file.status === "uploading",
  );

  if (uploadingFile) {
    throw new AppError(
      "Cannot empty trash while a file is uploading",
      409,
    );
  }

  /*
   * Nothing to delete.
   */
  if (directories.length === 0 && files.length === 0) {
    return {
      deletedDirectories: 0,
      deletedFiles: 0,
      storageFreedInBytes: 0,
    };
  }

  /*
   * Clean up any stale multipart uploads that somehow remain
   * attached to trashed file records.
   */
  for (const file of files) {
    if (!file.uploadId) {
      continue;
    }

    try {
      await abortMultipartUpload({
        key: file.storageKey,
        uploadId: file.uploadId,
      });
    } catch (error) {
      console.error(
        "Failed to abort stale multipart upload while emptying trash:",
        error,
      );

      throw new AppError(
        "Failed to empty trash",
        500,
      );
    }
  }

  /*
   * Collect S3 object keys.
   */
  const storageKeys = files.map(
    (file) => file.storageKey,
  );

  /*
   * Delete S3 objects in batches.
   *
   * S3 DeleteObjects supports up to 1000 objects per request,
   * so batching keeps the service safe for larger trash contents.
   */
  for (
    let start = 0;
    start < storageKeys.length;
    start += S3_DELETE_BATCH_SIZE
  ) {
    const batch = storageKeys.slice(
      start,
      start + S3_DELETE_BATCH_SIZE,
    );

    try {
      const response = await deleteS3Objects(batch);

      if (
        response?.Errors &&
        response.Errors.length > 0
      ) {
        console.error(
          "Some S3 objects failed to delete while emptying trash:",
          response.Errors,
        );

        throw new AppError(
          "Some files could not be permanently deleted",
          500,
        );
      }
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      console.error(
        "Failed to delete S3 objects while emptying trash:",
        error,
      );

      throw new AppError(
        "Failed to empty trash",
        500,
      );
    }
  }

  /*
   * Only ready files represent permanent storage usage.
   *
   * This follows the same storage accounting rule used by
   * your existing permanentlyDeleteDirectory() implementation.
   */
  const storageToFree = files.reduce(
    (total, file) =>
      file.status === "ready"
        ? total + file.size
        : total,
    0,
  );

  const fileIds = files.map(
    (file) => file._id,
  );

  const directoryIds = directories.map(
    (directory) => directory._id,
  );

  /*
   * MongoDB transaction:
   *
   * 1. Release user storage.
   * 2. Delete trashed files.
   * 3. Delete trashed directories.
   */
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(
      async () => {
        const user = await User.findById(
          userId,
        ).session(session);

        if (!user) {
          throw new AppError(
            "User not found",
            404,
          );
        }

        user.storageUsedInBytes = Math.max(
          0,
          user.storageUsedInBytes -
            storageToFree,
        );

        await user.save({
          session,
        });

        if (fileIds.length > 0) {
          await File.deleteMany(
            {
              userId,
              _id: {
                $in: fileIds,
              },
              deletedAt: {
                $exists: true,
                $ne: null,
              },
            },
            {
              session,
            },
          );
        }

        if (directoryIds.length > 0) {
          await Directory.deleteMany(
            {
              userId,
              _id: {
                $in: directoryIds,
              },
              deletedAt: {
                $exists: true,
                $ne: null,
              },
            },
            {
              session,
            },
          );
        }
      },
    );
  } finally {
    await session.endSession();
  }

  return {
    deletedDirectories:
      directoryIds.length,
    deletedFiles:
      fileIds.length,
    storageFreedInBytes:
      storageToFree,
  };
};