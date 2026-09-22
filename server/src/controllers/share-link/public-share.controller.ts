import type { NextFunction, Request, Response } from "express";

import {
  browsePublicDirectory,
  downloadPublicFile,
  resolvePublicShare,
  viewPublicFile,
} from "../../services/share-link/public-share.service.js";

export const resolvePublicShareController = async (
  req: Request<{ token: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = await resolvePublicShare(req.params.token);

    return res.status(200).json({
      success: true,
      message: "Public share retrieved successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const browsePublicDirectoryController = async (
  req: Request<{ token: string; directoryId: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = await browsePublicDirectory({
      token: req.params.token,
      directoryId: req.params.directoryId,
    });

    return res.status(200).json({
      success: true,
      message: "Shared directory retrieved successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const viewPublicFileController = async (
  req: Request<{ token: string; fileId: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = await viewPublicFile({
      token: req.params.token,
      fileId: req.params.fileId,
    });

    return res.status(200).json({
      success: true,
      message: "Shared file URL generated successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const downloadPublicFileController = async (
  req: Request<{ token: string; fileId: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = await downloadPublicFile({
      token: req.params.token,
      fileId: req.params.fileId,
    });

    return res.status(200).json({
      success: true,
      message: "Shared file download URL generated successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};
