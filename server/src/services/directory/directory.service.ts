import mongoose from "mongoose";
import Directory from "../../models/directory.model.js";
import File from "../../models/file.model.js";
import { AppError } from "../../utils/app.error.js";

// mongoose objectId utility
const ToMongooseObjectId = (id: string) => new mongoose.Types.ObjectId(id);

const ensureParentDirectory = async (
  userId: string,
  parentDirectoryId: string,
) => {
  const directory = await Directory.findOne({
    _id: parentDirectoryId,
    userId,
    deletedAt: null,
  }).lean();
  if (!directory) throw new AppError("Parent directory does not exists", 404);
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

  if (!existingDirectory) return name;

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
  while (names.has(`New folder (${index})`)) index += 1;
  return `New folder (${index})`;
};

// create new directory
export const createDirectory = async (
  userId: string,
  parentDirectoryId: string,
  name: string,
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
    userId: ToMongooseObjectId(userId),
    size: 0,
    deletedAt: null,
  });
};

// get breadcrumbs of the current directory
export const getBreadcrumbs = async ({
  userId,
  directoryId
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
    throw new AppError("Directory Not Found", 404);
  }

  const [directories, files, breadcrumbs] = await Promise.all([
    Directory.find({
      parentDirectoryId: directory._id,
      userId,
      deletedAt: null,
    })
      .sort({ updatedAt: -1 })
      .lean(),
    File.find({
      directoryId: directory._id,
      userId,
      deletedAt: null,
      status: { $in: ["uploading", "ready"] },
    })
      .sort({ updatedAt: -1 })
      .lean(),
    getBreadcrumbs({userId, directoryId : directory._id.toString()}),
  ]);

  return {
    directory,
    directories,
    files,
    breadcrumbs,
  };
};

// rename directory

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
  if (!directory) throw new AppError("Directory not found", 404);
  if (directory.parentDirectoryId === null)
    throw new AppError("Home folder cannot be renamed", 400);

    const duplicate = await Directory.findOne({
    _id: { $ne: directory._id },
    userId,
    parentDirectoryId: directory.parentDirectoryId,
    deletedAt: null,
    name,
  }).select("_id").lean();
  if (duplicate) throw new AppError("A folder with this name already exists", 409);
  directory.name = name;
  await directory.save();
  return directory
};
