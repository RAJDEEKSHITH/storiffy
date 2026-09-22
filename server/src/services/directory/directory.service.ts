import mongoose from "mongoose";

import Directory from "../../models/directory.model.js";
import File from "../../models/file.model.js";
import User from "../../models/user.model.js";
import { AppError } from "../../utils/app.error.js";

import { abortMultipartUpload, deleteS3Objects } from "../aws/s3.service.js";

const toMongooseObjectId = (id: string) => new mongoose.Types.ObjectId(id);


const getDirectoryTreeIds = async (
  userId: string,
  rootDirectoryId: mongoose.Types.ObjectId,
) => {
  const allIds: mongoose.Types.ObjectId[] = [rootDirectoryId];

  const visited = new Set<string>([rootDirectoryId.toString()]);

  let frontier: mongoose.Types.ObjectId[] = [rootDirectoryId];

  while (frontier.length > 0) {
    const children = await Directory.find({
      userId,
      parentDirectoryId: {
        $in: frontier,
      },
    })
      .select("_id")
      .lean();

    const nextFrontier: mongoose.Types.ObjectId[] = [];

    for (const child of children) {
      const childId = child._id.toString();

      if (visited.has(childId)) {
        continue;
      }

      visited.add(childId);

      nextFrontier.push(child._id);

      allIds.push(child._id);
    }

    frontier = nextFrontier;
  }

  return allIds;
};


const getTrashRootDirectory = async ({
  userId,
  directory,
}: {
  userId: string;
  directory: {
    _id: mongoose.Types.ObjectId;
    parentDirectoryId: mongoose.Types.ObjectId | null;
    deletedAt: Date | null;
  };
}) => {
  let current = directory;

  while (current.parentDirectoryId) {
    const parent = await Directory.findOne({
      _id: current.parentDirectoryId,
      userId,
      deletedAt: {
        $ne: null,
      },
    }).lean();

    if (!parent) {
      break;
    }

    current = parent;
  }

  return current;
};


const ensureParentDirectory = async (
  userId: string,
  parentDirectoryId: string,
) => {
  const directory = await Directory.findOne({
    _id: parentDirectoryId,
    userId,
    deletedAt: null,
  })
    .select("_id")
    .lean();

  if (!directory) {
    throw new AppError("Parent directory does not exist", 404);
  }

  return directory;
};


const makeUniqueDirectoryName = async (
  userId: string,
  parentDirectoryId: string,
  requestedName: string,
) => {
  const name = requestedName.trim() || "New Folder";

  const existingDirectory = await Directory.findOne({
    userId,
    name,
    parentDirectoryId,
    deletedAt: null,
  })
    .select("_id")
    .lean();

  if (!existingDirectory) {
    return name;
  }

  if (!/^New folder(?: \(\d+\))?$/.test(name)) {
    throw new AppError("A folder with this name already exists", 409);
  }

  const siblingsSimilarDirectoryNames = await Directory.find({
    userId,
    parentDirectoryId,
    deletedAt: null,
    name: /^New folder(?: \(\d+\))?$/,
  })
    .select("name")
    .lean();

  const names = new Set(siblingsSimilarDirectoryNames.map((item) => item.name));

  let index = 1;

  while (names.has(`New folder (${index})`)) {
    index += 1;
  }

  return `New folder (${index})`;
};


export const createDirectory = async (
  userId: string,
  parentDirectoryId: string,
  name: string,
  createdBy: string = userId,
) => {
  const parent = await ensureParentDirectory(userId, parentDirectoryId);

  const directoryName = await makeUniqueDirectoryName(
    userId,
    parent._id.toString(),
    name,
  );

  return Directory.create({
    name: directoryName,
    parentDirectoryId: parent._id,
    userId: toMongooseObjectId(userId),
    createdBy: toMongooseObjectId(createdBy),
    size: 0,
    deletedAt: null,
  });
};


export const getBreadcrumbs = async ({
  userId,
  directoryId,
}: {
  userId: string;
  directoryId: string;
}) => {
  let current = await Directory.findOne({
    _id: directoryId,
    userId,
    deletedAt: null,
  }).lean();

  if (!current) {
    throw new AppError("Directory not found", 404);
  }

  const breadcrumbs: Array<{
    id: string;
    name: string;
  }> = [];

  while (current) {
    breadcrumbs.unshift({
      id: current._id.toString(),
      name: current.name,
    });

    if (!current.parentDirectoryId) {
      break;
    }

    current = await Directory.findOne({
      _id: current.parentDirectoryId,
      userId,
      deletedAt: null,
    }).lean();
  }

  return breadcrumbs;
};


export const getDirectoryItems = async (
  userId: string,
  directoryId: string,
) => {
  const directory = await Directory.findOne({
    _id: directoryId,
    userId,
    deletedAt: null,
  }).lean();

  if (!directory) {
    throw new AppError("Directory not found", 404);
  }

  const [directories, files, breadcrumbs] = await Promise.all([
    Directory.find({
      parentDirectoryId: directory._id,
      userId,
      deletedAt: null,
    })
      .sort({
        updatedAt: -1,
      })
      .lean(),

    File.find({
      directoryId: directory._id,
      userId,
      deletedAt: null,
      status: {
        $in: ["uploading", "ready"],
      },
    })
      .sort({
        updatedAt: -1,
      })
      .lean(),

    getBreadcrumbs({
      userId,
      directoryId: directory._id.toString(),
    }),
  ]);

  return {
    directory,
    directories,
    files,
    breadcrumbs,
  };
};


export const renameDirectory = async (
  userId: string,
  directoryId: string,
  name: string,
) => {
  const directory = await Directory.findOne({
    _id: directoryId,
    userId,
    deletedAt: null,
  });

  if (!directory) {
    throw new AppError("Directory not found", 404);
  }

  if (directory.parentDirectoryId === null) {
    throw new AppError("Home folder cannot be renamed", 400);
  }

  const duplicate = await Directory.findOne({
    _id: {
      $ne: directory._id,
    },
    userId,
    parentDirectoryId: directory.parentDirectoryId,
    deletedAt: null,
    name,
  })
    .select("_id")
    .lean();

  if (duplicate) {
    throw new AppError("A folder with this name already exists", 409);
  }

  directory.name = name;

  await directory.save();

  return directory;
};


export const softDeleteDirectory = async ({
  userId,
  directoryId,
}: {
  userId: string;
  directoryId: string;
}) => {
  const directory = await Directory.findOne({
    _id: directoryId,
    userId,
    deletedAt: null,
  });

  if (!directory) {
    throw new AppError("Directory not found", 404);
  }

  if (directory.parentDirectoryId === null) {
    throw new AppError("Home folder cannot be deleted", 400);
  }

  const directoryIds = await getDirectoryTreeIds(userId, directory._id);

  const activeUpload = await File.findOne({
    userId,
    directoryId: {
      $in: directoryIds,
    },
    status: "uploading",
  })
    .select("_id")
    .lean();

  if (activeUpload) {
    throw new AppError("Cannot delete a folder while a file is uploading", 409);
  }

  const deletedAt = new Date();

  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      await Directory.updateMany(
        {
          _id: {
            $in: directoryIds,
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
      );

      await File.updateMany(
        {
          directoryId: {
            $in: directoryIds,
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
    });
  } finally {
    await session.endSession();
  }

  return {
    directoryId: directory._id.toString(),
    deletedAt,
  };
};


export const getTrashedDirectories = async (userId: string) => {
  const directories = await Directory.find({
    userId,
    deletedAt: {
      $ne: null,
    },
  })
    .sort({
      deletedAt: -1,
    })
    .lean();

  const deletedIds = new Set(
    directories.map((directory) => directory._id.toString()),
  );

  return directories.filter((directory) => {
    if (directory.parentDirectoryId === null) {
      return true;
    }

    return !deletedIds.has(directory.parentDirectoryId.toString());
  });
};


export const restoreDirectory = async ({
  userId,
  directoryId,
}: {
  userId: string;
  directoryId: string;
}) => {
  const directory = await Directory.findOne({
    _id: directoryId,
    userId,
    deletedAt: {
      $ne: null,
    },
  });

  if (!directory) {
    throw new AppError("Trashed directory not found", 404);
  }

  const trashRoot = await getTrashRootDirectory({
    userId,
    directory,
  });

  if (trashRoot._id.toString() !== directory._id.toString()) {
    throw new AppError("Restore the top-level trashed directory instead", 409);
  }

  if (directory.parentDirectoryId) {
    const parent = await Directory.findOne({
      _id: directory.parentDirectoryId,
      userId,
      deletedAt: null,
    })
      .select("_id")
      .lean();

    if (!parent) {
      throw new AppError("Restore the parent directory first", 409);
    }
  }

  const directoryIds = await getDirectoryTreeIds(userId, directory._id);

  const directories = await Directory.find({
    _id: {
      $in: directoryIds,
    },
    userId,
  }).lean();

  for (const item of directories) {
    const duplicate = await Directory.findOne({
      _id: {
        $nin: directoryIds,
      },
      userId,
      parentDirectoryId: item.parentDirectoryId,
      deletedAt: null,
      name: item.name,
    })
      .select("_id")
      .lean();

    if (duplicate) {
      throw new AppError(
        `Cannot restore "${item.name}" because a folder with the same name already exists`,
        409,
      );
    }
  }

  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      await Directory.updateMany(
        {
          _id: {
            $in: directoryIds,
          },
          userId,
          deletedAt: {
            $ne: null,
          },
        },
        {
          $set: {
            deletedAt: null,
          },
        },
        {
          session,
        },
      );

      await File.updateMany(
        {
          userId,
          directoryId: {
            $in: directoryIds,
          },
          deletedAt: {
            $ne: null,
          },
          status: "ready",
        },
        {
          $set: {
            deletedAt: null,
          },
        },
        {
          session,
        },
      );

      const sizes = await File.aggregate([
        {
          $match: {
            userId: toMongooseObjectId(userId),
            directoryId: {
              $in: directoryIds,
            },
            status: "ready",
            deletedAt: null,
          },
        },
        {
          $group: {
            _id: "$directoryId",
            totalSize: {
              $sum: "$size",
            },
          },
        },
      ]).session(session);

      const sizeMap = new Map<string, number>();

      for (const item of sizes) {
        sizeMap.set(item._id.toString(), item.totalSize);
      }

      await Directory.updateMany(
        {
          _id: {
            $in: directoryIds,
          },
          userId,
        },
        {
          $set: {
            size: 0,
          },
        },
        {
          session,
        },
      );

      for (const [id, size] of sizeMap) {
        await Directory.updateOne(
          {
            _id: toMongooseObjectId(id),
            userId,
          },
          {
            $set: {
              size,
            },
          },
          {
            session,
          },
        );
      }
    });
  } finally {
    await session.endSession();
  }

  return Directory.findById(directory._id).lean();
};


export const permanentlyDeleteDirectory = async ({
  userId,
  directoryId,
}: {
  userId: string;
  directoryId: string;
}) => {
  const directory = await Directory.findOne({
    _id: directoryId,
    userId,
    deletedAt: {
      $ne: null,
    },
  });

  if (!directory) {
    throw new AppError("Trashed directory not found", 404);
  }

  if (directory.parentDirectoryId === null) {
    throw new AppError("Home folder cannot be permanently deleted", 400);
  }

  const trashRoot = await getTrashRootDirectory({
    userId,
    directory,
  });

  if (trashRoot._id.toString() !== directory._id.toString()) {
    throw new AppError(
      "Permanently delete the top-level trashed directory instead",
      409,
    );
  }

  const directoryIds = await getDirectoryTreeIds(userId, directory._id);

  const files = await File.find({
    userId,
    directoryId: {
      $in: directoryIds,
    },
  }).lean();

  const uploadingFile = files.find((file) => file.status === "uploading");

  if (uploadingFile) {
    throw new AppError(
      "Cannot permanently delete a directory while a file is uploading",
      409,
    );
  }

  for (const file of files) {
    if (file.uploadId) {
      try {
        await abortMultipartUpload({
          key: file.storageKey,
          uploadId: file.uploadId,
        });
      } catch (error) {
        console.error("Failed to abort stale multipart upload:", error);

        throw new AppError("Failed to permanently delete directory", 500);
      }
    }
  }

  const storageKeys = files.map((file) => file.storageKey);

  if (storageKeys.length > 0) {
    const response = await deleteS3Objects(storageKeys);

    if (response?.Errors && response.Errors.length > 0) {
      console.error("Some S3 objects failed to delete:", response.Errors);

      throw new AppError("Some files could not be permanently deleted", 500);
    }
  }

  const storageToFree = files.reduce(
    (total, file) => (file.status === "ready" ? total + file.size : total),
    0,
  );

  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      const user = await User.findById(userId).session(session);

      if (!user) {
        throw new AppError("User not found", 404);
      }

      user.storageUsedInBytes = Math.max(
        0,
        user.storageUsedInBytes - storageToFree,
      );

      await user.save({
        session,
      });

      await File.deleteMany(
        {
          userId,
          directoryId: {
            $in: directoryIds,
          },
        },
        {
          session,
        },
      );

      await Directory.deleteMany(
        {
          userId,
          _id: {
            $in: directoryIds,
          },
        },
        {
          session,
        },
      );
    });
  } finally {
    await session.endSession();
  }

  return {
    directoryId: directory._id.toString(),
    deletedDirectories: directoryIds.length,
    deletedFiles: files.length,
    storageFreedInBytes: storageToFree,
  };
};


const SHARED_DIRECTORY_MAX_DEPTH = 1000;

export const assertDirectoryWithinSharedRoot = async ({
  ownerId,
  sharedRootDirectoryId,
  targetDirectoryId,
}: {
  ownerId: string;
  sharedRootDirectoryId: string;
  targetDirectoryId: string;
}) => {
  const root = await Directory.findOne({
    _id: sharedRootDirectoryId,
    userId: ownerId,
    deletedAt: null,
  })
    .select("_id name size parentDirectoryId")
    .lean();

  if (!root) {
    throw new AppError("Shared directory is no longer available", 404);
  }

  let current = await Directory.findOne({
    _id: targetDirectoryId,
    userId: ownerId,
    deletedAt: null,
  })
    .select("_id name size parentDirectoryId")
    .lean();

  if (!current) {
    throw new AppError("Directory not found", 404);
  }

  const visited = new Set<string>();

  for (let depth = 0; depth <= SHARED_DIRECTORY_MAX_DEPTH; depth += 1) {
    const currentId = current._id.toString();

    if (visited.has(currentId)) {
      throw new AppError("Directory hierarchy is invalid", 409);
    }

    visited.add(currentId);

    if (currentId === root._id.toString()) {
      return current;
    }

    if (!current.parentDirectoryId) {
      break;
    }

    current = await Directory.findOne({
      _id: current.parentDirectoryId,
      userId: ownerId,
      deletedAt: null,
    })
      .select("_id name size parentDirectoryId")
      .lean();

    if (!current) {
      break;
    }
  }

  throw new AppError("Directory is outside the shared scope", 404);
};

export const getSharedBreadcrumbs = async ({
  ownerId,
  sharedRootDirectoryId,
  currentDirectoryId,
}: {
  ownerId: string;
  sharedRootDirectoryId: string;
  currentDirectoryId: string;
}) => {
  const root = await Directory.findOne({
    _id: sharedRootDirectoryId,
    userId: ownerId,
    deletedAt: null,
  })
    .select("_id name parentDirectoryId")
    .lean();

  if (!root) {
    throw new AppError("Shared directory is no longer available", 404);
  }

  let current = await Directory.findOne({
    _id: currentDirectoryId,
    userId: ownerId,
    deletedAt: null,
  })
    .select("_id name parentDirectoryId")
    .lean();

  if (!current) {
    throw new AppError("Directory not found", 404);
  }

  const breadcrumbs: Array<{ id: string; name: string }> = [];
  const visited = new Set<string>();

  for (let depth = 0; depth <= SHARED_DIRECTORY_MAX_DEPTH; depth += 1) {
    const currentId = current._id.toString();

    if (visited.has(currentId)) {
      throw new AppError("Directory hierarchy is invalid", 409);
    }

    visited.add(currentId);
    breadcrumbs.unshift({
      id: currentId,
      name: current.name,
    });

    if (currentId === root._id.toString()) {
      return breadcrumbs;
    }

    if (!current.parentDirectoryId) {
      break;
    }

    current = await Directory.findOne({
      _id: current.parentDirectoryId,
      userId: ownerId,
      deletedAt: null,
    })
      .select("_id name parentDirectoryId")
      .lean();

    if (!current) {
      break;
    }
  }

  throw new AppError("Directory is outside the shared scope", 404);
};

export const getSharedDirectoryItems = async ({
  ownerId,
  sharedRootDirectoryId,
  currentDirectoryId,
}: {
  ownerId: string;
  sharedRootDirectoryId: string;
  currentDirectoryId: string;
}) => {
  const currentDirectory = await Directory.findOne({
    _id: currentDirectoryId,
    userId: ownerId,
    deletedAt: null,
  }).lean();

  if (!currentDirectory) {
    throw new AppError("Directory not found", 404);
  }

  const breadcrumbs: Array<{
    id: string;
    name: string;
  }> = [];

  let current = currentDirectory;

  const visited = new Set<string>();

  while (current) {
    const currentId = current._id.toString();

    if (visited.has(currentId)) {
      throw new AppError("Invalid directory hierarchy", 500);
    }

    visited.add(currentId);

    breadcrumbs.unshift({
      id: currentId,
      name: current.name,
    });

    if (currentId === sharedRootDirectoryId) {
      break;
    }

    if (!current.parentDirectoryId) {
      throw new AppError("Directory is outside the shared directory", 404);
    }

    const parent = await Directory.findOne({
      _id: current.parentDirectoryId,
      userId: ownerId,
      deletedAt: null,
    }).lean();

    if (!parent) {
      throw new AppError("Directory is outside the shared directory", 404);
    }

    current = parent;
  }

  const firstBreadcrumb = breadcrumbs[0];

  if (!firstBreadcrumb || firstBreadcrumb.id !== sharedRootDirectoryId) {
    throw new AppError("Directory is outside the shared directory", 404);
  }

  const [directories, files] = await Promise.all([
    Directory.find({
      parentDirectoryId: currentDirectory._id,
      userId: ownerId,
      deletedAt: null,
    })
      .sort({
        updatedAt: -1,
      })
      .lean(),

    File.find({
      directoryId: currentDirectory._id,
      userId: ownerId,
      deletedAt: null,
      status: "ready",
    })
      .sort({
        updatedAt: -1,
      })
      .lean(),
  ]);

  return {
    directory: currentDirectory,
    directories,
    files,
    breadcrumbs,
  };
};

export const assertSharedDirectoryDeletionSafe = async ({
  ownerId,
  actorId,
  directoryId,
}: {
  ownerId: string;
  actorId: string;
  directoryId: string;
}) => {
  const directory = await Directory.findOne({
    _id: directoryId,
    userId: ownerId,
    deletedAt: null,
  })
    .select("_id parentDirectoryId createdBy")
    .lean();

  if (!directory) {
    throw new AppError("Directory not found", 404);
  }

  const directoryIds = await getDirectoryTreeIds(ownerId, directory._id);

  const [directories, files] = await Promise.all([
    Directory.find({
      _id: { $in: directoryIds },
      userId: ownerId,
      deletedAt: null,
    })
      .select("_id createdBy")
      .lean(),

    File.find({
      directoryId: { $in: directoryIds },
      userId: ownerId,
      deletedAt: null,
    })
      .select("_id createdBy status")
      .lean(),
  ]);

  const actor = actorId.toString();

  if (directories.some((item) => item.createdBy?.toString() !== actor)) {
    throw new AppError(
      "You cannot delete a directory containing content created by another user",
      409,
    );
  }

  if (files.some((item) => item.createdBy?.toString() !== actor)) {
    throw new AppError(
      "You cannot delete a directory containing files created by another user",
      409,
    );
  }

  if (files.some((item) => item.status !== "ready")) {
    throw new AppError(
      "Cannot delete a directory while an upload is not ready",
      409,
    );
  }

  return directory;
};
