import type { NextFunction, Request, Response } from "express";

import {
  createDirectory,
  getBreadcrumbs,
  getDirectoryItems,
  renameDirectory,
} from "../services/directory/directory.service.js";

// get directory items folders and files
export const getDirectory = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = await getDirectoryItems(req.user._id.toString(), req.params.id);
    return res.status(200).json({
      success: true,
      message: "Directory items retrieved successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const getDirectoryBreadcrumbs = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = await getBreadcrumbs({
      userId: req.user._id.toString(),
      directoryId: req.params.id,
    });

    return res.status(200).json({
      success: true,
      message: "Directory breadcrumbs fetched successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};

// create new directory
export const createNewDirectory = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const directory = await createDirectory(
      req.user._id.toString(),
      req.params.id,
      req.body.name,
    );

    return res.status(201).json({
      success: true,
      message: "Directory created successfully",
      data: {
        directory,
      },
    });
  } catch (error) {
    next(error);
  }
};

// rename existing directory
export const renameExistingDirectory = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const directory = await renameDirectory(
      req.user._id.toString(),
      req.params.id,
      req.body.name,
    );
    return res.status(200).json({
      success: true,
      message: "Directory renamed successfully",
      data: {
        directory,
      },
    });
  } catch (error) {
    next(error);
  }
};

