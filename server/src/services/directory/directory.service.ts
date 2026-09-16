import mongoose from "mongoose";

import Directory from "../../models/directory.model.js";
import File from "../../models/file.model.js";
import User from "../../models/user.model.js";
import { AppError } from "../../utils/app.error.js";

const generateFolderName = async ( userId: mongoose.Types.ObjectId,
parentDirectoryId: mongoose.Types.ObjectId,
) => {
  const baseName = "New folder";

  const existingNames = await Directory.find({
    userId,
    parentDirectoryId,
    deletedAt: null,
    name: {
      $regex: `^${baseName}( \\([0-9]+\\))?$`,
      $options: "i",
    },
  })
    .select("name")
    .lean();

  const names = new Set(existingNames.map((directory) => directory.name));

  if (!names.has(baseName)) {
    return baseName;
  }

  let counter = 1;

  while (names.has(`${baseName} (${counter})`)) {
    counter += 1;
  }

  return `${baseName} (${counter})`;
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

  const [files, directories] = await Promise.all([
    File.find({
      userId,
      directoryId: directory._id,
      deletedAt: null,
    })
      .sort({ updatedAt: -1 })
      .lean(),

    Directory.find({
      userId,
      parentDirectoryId: directory._id,
      deletedAt: null,
    })
      .sort({ updatedAt: -1 })
      .lean(),
  ]);

  return {
    directory,
    files,
    directories,
  };
};

export const createDirectory = async (
  userId: string,
  parentDirectoryId: string,
  requestedName: string,
) => {
  const parentDirectory = await Directory.findOne({
    _id: parentDirectoryId,
    userId,
    deletedAt: null,
  });

  if (!parentDirectory) {
    throw new AppError("Parent directory not found", 404);
  }

  const name =
    requestedName === "New folder"
      ? await generateFolderName(
          new mongoose.Types.ObjectId(userId),
          parentDirectory._id,
        )
      : requestedName;

  const existingDirectory = await Directory.findOne({
    userId,
    parentDirectoryId: parentDirectory._id,
    deletedAt: null,
    name,
  });

  if (existingDirectory) {
    throw new AppError(
      "A folder with this name already exists",
      409,
    );
  }

  return Directory.create({
    name,
    parentDirectoryId: parentDirectory._id,
    userId,
    size: 0,
    deletedAt: null,
  });
};

const ensureUniqueDirectoryName = async (
  userId: string,
  parentDirectoryId: mongoose.Types.ObjectId,
  name: string,
  directoryId: mongoose.Types.ObjectId,
) => {
  const existingDirectory = await Directory.findOne({
    userId,
    parentDirectoryId,
    deletedAt: null,
    name,
    _id: { $ne: directoryId },
  });

  if (existingDirectory) {
    throw new AppError("A folder with this name already exists", 409);
  }
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

  const directoryIdObject = new mongoose.Types.ObjectId(
    directoryId,
  );

  if (directory.parentDirectoryId) {
    await ensureUniqueDirectoryName(
      userId,
      directory.parentDirectoryId,
      name,
      directoryIdObject,
    );
  }

  directory.name = name;

  await directory.save();

  return directory;
};

export const deleteDirectory = async (userId: string, directoryId: string) => {
  const user = await User.findById(userId).select("rootDirectoryId");

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

  if (user.rootDirectoryId.equals(directory._id)) {
    throw new AppError("The root directory cannot be deleted", 400);
  }

  const deletedAt = new Date();

  const directoryIds: mongoose.Types.ObjectId[] = [directory._id];

  let currentIds = [directory._id];

  while (currentIds.length > 0) {
    const children = await Directory.find({
      userId,
      parentDirectoryId: { $in: currentIds },
      deletedAt: null,
    })
      .select("_id")
      .lean();

    if (children.length === 0) {
      break;
    }

    currentIds = children.map((child) => child._id);
    directoryIds.push(...currentIds);
  }

  await Promise.all([
    Directory.updateMany(
      {
        _id: { $in: directoryIds },
        userId,
      },
      {
        $set: {
          deletedAt,
        },
      },
    ),

    File.updateMany(
      {
        userId,
        directoryId: { $in: directoryIds },
        deletedAt: null,
      },
      {
        $set: {
          deletedAt,
        },
      },
    ),
  ]);

  directory.deletedAt = deletedAt;

  return directory;
};
