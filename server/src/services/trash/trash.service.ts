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


export const emptyTrash = async ({
  userId,
}: {
  userId: string;
}) => {
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

  const uploadingFile = files.find(
    (file) => file.status === "uploading",
  );

  if (uploadingFile) {
    throw new AppError(
      "Cannot empty trash while a file is uploading",
      409,
    );
  }

  if (directories.length === 0 && files.length === 0) {
    return {
      deletedDirectories: 0,
      deletedFiles: 0,
      storageFreedInBytes: 0,
    };
  }

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

  const storageKeys = files.map(
    (file) => file.storageKey,
  );

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


const MAX_BULK_TRASH_ITEMS = 1000;

export const bulkMoveItemsToTrash = async ({
  userId,
  directoryIds,
  fileIds,
}: {
  userId: string;
  directoryIds: string[];
  fileIds: string[];
}) => {
  const uniqueDirectoryIdStrings = [
    ...new Set(
      directoryIds
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ];

  const uniqueFileIdStrings = [
    ...new Set(
      fileIds
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ];

  const requestedItemCount =
    uniqueDirectoryIdStrings.length +
    uniqueFileIdStrings.length;

  if (requestedItemCount === 0) {
    throw new AppError(
      "Select at least one file or folder",
      400,
    );
  }

  if (requestedItemCount > MAX_BULK_TRASH_ITEMS) {
    throw new AppError(
      `You can move up to ${MAX_BULK_TRASH_ITEMS} items to trash at once`,
      400,
    );
  }

  const toObjectId = (
    value: string,
    label: string,
  ) => {
    if (!mongoose.Types.ObjectId.isValid(value)) {
      throw new AppError(
        `Invalid ${label} id`,
        400,
      );
    }

    return new mongoose.Types.ObjectId(value);
  };

  const selectedDirectoryObjectIds =
    uniqueDirectoryIdStrings.map((value) =>
      toObjectId(value, "directory"),
    );

  const selectedFileObjectIds =
    uniqueFileIdStrings.map((value) =>
      toObjectId(value, "file"),
    );

  const selectedDirectories =
    selectedDirectoryObjectIds.length > 0
      ? await Directory.find({
          _id: {
            $in: selectedDirectoryObjectIds,
          },
          userId,
          deletedAt: null,
        })
          .select("_id parentDirectoryId")
          .lean()
      : [];

  if (
    selectedDirectories.length !==
    selectedDirectoryObjectIds.length
  ) {
    throw new AppError(
      "One or more selected folders are no longer available",
      409,
    );
  }

  if (
    selectedDirectories.some(
      (directory) =>
        directory.parentDirectoryId === null,
    )
  ) {
    throw new AppError(
      "Home folder cannot be deleted",
      400,
    );
  }

  const selectedDirectorySet =
    new Set(
      selectedDirectories.map((directory) =>
        directory._id.toString(),
      ),
    );

  const topLevelSelectedDirectories =
    selectedDirectories.filter((directory) => {
      const parentId =
        directory.parentDirectoryId?.toString();

      return (
        parentId === undefined ||
        !selectedDirectorySet.has(parentId)
      );
    });

  const directoryTreeIds: mongoose.Types.ObjectId[] = [];
  const visitedDirectoryIds =
    new Set<string>();
  let frontier =
    topLevelSelectedDirectories.map(
      (directory) => directory._id,
    );

  while (frontier.length > 0) {
    const nextFrontier: mongoose.Types.ObjectId[] = [];

    for (const directoryId of frontier) {
      const directoryIdString =
        directoryId.toString();

      if (visitedDirectoryIds.has(directoryIdString)) {
        continue;
      }

      visitedDirectoryIds.add(directoryIdString);
      directoryTreeIds.push(directoryId);
    }

    const children =
      directoryTreeIds.length > 0
        ? await Directory.find({
            userId,
            parentDirectoryId: {
              $in: frontier,
            },
          })
            .select("_id")
            .lean()
        : [];

    for (const child of children) {
      const childId =
        child._id.toString();

      if (visitedDirectoryIds.has(childId)) {
        continue;
      }

      nextFrontier.push(child._id);
    }

    frontier = nextFrontier;
  }

  const directoryTreeIdSet =
    new Set(
      directoryTreeIds.map((directoryId) =>
        directoryId.toString(),
      ),
    );

  if (directoryTreeIds.length > 0) {
    const activeUpload =
      await File.findOne({
        userId,
        directoryId: {
          $in: directoryTreeIds,
        },
        status: "uploading",
      })
        .select("_id")
        .lean();

    if (activeUpload) {
      throw new AppError(
        "Cannot move a folder to trash while a file is uploading",
        409,
      );
    }
  }

  const selectedFiles =
    selectedFileObjectIds.length > 0
      ? await File.find({
          _id: {
            $in: selectedFileObjectIds,
          },
          userId,
          deletedAt: null,
        })
          .select("_id directoryId status size")
          .lean()
      : [];

  if (
    selectedFiles.length !==
    selectedFileObjectIds.length
  ) {
    throw new AppError(
      "One or more selected files are no longer available",
      409,
    );
  }

  const selectedUploadingFile =
    selectedFiles.find(
      (file) => file.status !== "ready",
    );

  if (selectedUploadingFile) {
    throw new AppError(
      "Only ready files can be moved to trash",
      409,
    );
  }

  const explicitFiles =
    selectedFiles.filter(
      (file) =>
        !directoryTreeIdSet.has(
          file.directoryId.toString(),
        ),
    );

  const parentSizeDeltas =
    new Map<string, number>();

  for (const file of explicitFiles) {
    const parentId =
      file.directoryId.toString();
    const currentTotal =
      parentSizeDeltas.get(parentId) ?? 0;

    parentSizeDeltas.set(
      parentId,
      currentTotal + file.size,
    );
  }

  if (explicitFiles.length > 0) {
    const parentIds = [
      ...new Set(
        explicitFiles.map((file) =>
          file.directoryId.toString(),
        ),
      ),
    ].map((value) =>
      toObjectId(value, "parent directory"),
    );

    const activeParents =
      await Directory.find({
        _id: {
          $in: parentIds,
        },
        userId,
        deletedAt: null,
      })
        .select("_id")
        .lean();

    if (
      activeParents.length !== parentIds.length
    ) {
      throw new AppError(
        "One or more selected files no longer have an active parent folder",
        409,
      );
    }
  }

  const expectedTreeDirectoryCount =
    directoryTreeIds.length > 0
      ? await Directory.countDocuments({
          _id: {
            $in: directoryTreeIds,
          },
          userId,
          deletedAt: null,
        })
      : 0;

  const expectedTreeFileCount =
    directoryTreeIds.length > 0
      ? await File.countDocuments({
          userId,
          directoryId: {
            $in: directoryTreeIds,
          },
          status: "ready",
          deletedAt: null,
        })
      : 0;

  const deletedAt = new Date();
  const session = await mongoose.startSession();

  try {
    let deletedDirectories = 0;
    let deletedFiles = 0;

    try {
      await session.withTransaction(
        async () => {
          const directoryUpdateResult =
            directoryTreeIds.length > 0
              ? await Directory.updateMany(
                  {
                    _id: {
                      $in: directoryTreeIds,
                    },
                    userId,
                    deletedAt: null,
                  },
                  {
                    $set: {
                      deletedAt,
                    },
                  },
                  {
                    session,
                  },
                )
              : null;

          if (
            directoryUpdateResult &&
            directoryUpdateResult.modifiedCount !==
              expectedTreeDirectoryCount
          ) {
            throw new AppError(
              "Some selected folders changed before the operation completed. Please try again.",
              409,
            );
          }

          deletedDirectories =
            directoryUpdateResult?.modifiedCount ??
            0;

          const subtreeFileUpdateResult =
            directoryTreeIds.length > 0
              ? await File.updateMany(
                  {
                    userId,
                    directoryId: {
                      $in: directoryTreeIds,
                    },
                    status: "ready",
                    deletedAt: null,
                  },
                  {
                    $set: {
                      deletedAt,
                    },
                  },
                  {
                    session,
                  },
                )
              : null;

          if (
            subtreeFileUpdateResult &&
            subtreeFileUpdateResult.modifiedCount !==
              expectedTreeFileCount
          ) {
            throw new AppError(
              "Some files inside the selected folders changed before the operation completed. Please try again.",
              409,
            );
          }

          deletedFiles =
            subtreeFileUpdateResult?.modifiedCount ??
            0;

          if (explicitFiles.length > 0) {
            const explicitFileIds =
              explicitFiles.map((file) =>
                file._id,
              );

            const explicitFileUpdateResult =
              await File.updateMany(
                {
                  _id: {
                    $in: explicitFileIds,
                  },
                  userId,
                  status: "ready",
                  deletedAt: null,
                },
                {
                  $set: {
                    deletedAt,
                  },
                },
                {
                  session,
                },
              );

            if (
              explicitFileUpdateResult.modifiedCount !==
              explicitFiles.length
            ) {
              throw new AppError(
                "Some selected files changed before the operation completed. Please try again.",
                409,
              );
            }

            deletedFiles +=
              explicitFileUpdateResult.modifiedCount;
          }

          for (const [
            parentId,
            totalSize,
          ] of parentSizeDeltas) {
            const result =
              await Directory.updateOne(
                {
                  _id:
                    toObjectId(
                      parentId,
                      "parent directory",
                    ),
                  userId,
                  deletedAt: null,
                },
                {
                  $inc: {
                    size: -totalSize,
                  },
                },
                {
                  session,
                },
              );

            if (result.matchedCount !== 1) {
              throw new AppError(
                "The parent folder changed before the operation completed. Please try again.",
                409,
              );
            }
          }
        },
      );
    } finally {
      await session.endSession();
    }

    return {
      requestedDirectories:
        uniqueDirectoryIdStrings.length,
      requestedFiles:
        uniqueFileIdStrings.length,
      deletedDirectories,
      deletedFiles,
    };
  } catch (error) {
    throw error;
  }
};
