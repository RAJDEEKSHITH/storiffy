import type {
  NextFunction,
  Request,
  Response,
} from "express";

import {
  createDirectory,
  getBreadcrumbs,
  getDirectoryItems,
  getTrashedDirectories,
  permanentlyDeleteDirectory,
  renameDirectory,
  restoreDirectory,
  softDeleteDirectory,
} from "../services/directory/directory.service.js";

// get directory (folders,files,breadcrumbs)
export const getDirectory = async (
  req: Request<{
    id: string;
  }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data =
      await getDirectoryItems(
        req.user._id.toString(),
        req.params.id,
      );

    return res.status(200).json({
      success: true,
      message:
        "Directory items retrieved successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};


export const getDirectoryBreadcrumbs =
  async (
    req: Request<{
      id: string;
    }>,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const data =
        await getBreadcrumbs({
          userId:
            req.user._id.toString(),
          directoryId:
            req.params.id,
        });

      return res.status(200).json({
        success: true,
        message:
          "Directory breadcrumbs fetched successfully",
        data,
      });
    } catch (error) {
      next(error);
    }
  };


export const createNewDirectory =
  async (
    req: Request<{
      id: string;
    }>,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const directory =
        await createDirectory(
          req.user._id.toString(),
          req.params.id,
          req.body.name,
        );

      return res.status(201).json({
        success: true,
        message:
          "Directory created successfully",
        data: {
          directory,
        },
      });
    } catch (error) {
      next(error);
    }
  };


export const renameExistingDirectory =
  async (
    req: Request<{
      id: string;
    }>,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const directory =
        await renameDirectory(
          req.user._id.toString(),
          req.params.id,
          req.body.name,
        );

      return res.status(200).json({
        success: true,
        message:
          "Directory renamed successfully",
        data: {
          directory,
        },
      });
    } catch (error) {
      next(error);
    }
  };


// soft delete directory
export const moveDirectoryToTrash =
  async (
    req: Request<{
      id: string;
    }>,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const data =
        await softDeleteDirectory({
          userId:
            req.user._id.toString(),
          directoryId:
            req.params.id,
        });

      return res.status(200).json({
        success: true,
        message:
          "Directory moved to trash successfully",
        data,
      });
    } catch (error) {
      next(error);
    }
  };


// get trash items
export const getDirectoryTrash =
  async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const data =
        await getTrashedDirectories(
          req.user._id.toString(),
        );

      return res.status(200).json({
        success: true,
        message:
          "Trashed directories fetched successfully",
        data,
      });
    } catch (error) {
      next(error);
    }
  };


// restore deleted directory
export const restoreExistingDirectory =
  async (
    req: Request<{
      id: string;
    }>,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const directory =
        await restoreDirectory({
          userId:
            req.user._id.toString(),
          directoryId:
            req.params.id,
        });

      return res.status(200).json({
        success: true,
        message:
          "Directory restored successfully",
        data: {
          directory,
        },
      });
    } catch (error) {
      next(error);
    }
  };


// permanently delete the directory
export const permanentlyDeleteExistingDirectory =
  async (
    req: Request<{
      id: string;
    }>,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const data =
        await permanentlyDeleteDirectory({
          userId:
            req.user._id.toString(),
          directoryId:
            req.params.id,
        });

      return res.status(200).json({
        success: true,
        message:
          "Directory permanently deleted",
        data,
      });
    } catch (error) {
      next(error);
    }
  };