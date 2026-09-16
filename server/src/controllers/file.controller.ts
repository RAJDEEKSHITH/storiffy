import type { NextFunction, Request, Response } from "express";

import {
  completeFileUpload,
  deleteFile,
  getFileViewUrl,
  initiateFileUpload,
  renameFile,
} from "../services/file/file.service.js";


export const viewFile = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const action =
      req.query.action === "download"
        ? "download"
        : "view";

    const url = await getFileViewUrl(
      req.user._id.toString(),
      req.params.id as string,
      action,
    );

    return res.status(200).json({
      success: true,
      message:
        action === "download"
          ? "File download URL generated successfully"
          : "File view URL generated successfully",
      data: {
        url,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const initiateUpload = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { file, uploadUrl } =
      await initiateFileUpload({
        userId: req.user._id.toString(),
        name: req.body.name,
        size: req.body.size,
        mimeType: req.body.mimeType,
        directoryId: req.body.directoryId,
      });

    return res.status(201).json({
      success: true,
      message: "File upload initialized successfully",
      data: {
        fileId: file._id,
        uploadUrl,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const completeUpload = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = await completeFileUpload(
      req.user._id.toString(),
      req.body.fileId,
    );

    return res.status(200).json({
      success: true,
      message: "File uploaded successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};


export const renameExistingFile = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const file = await renameFile(
      req.user._id.toString(),
      req.params.id as string,
      req.body.name,
    );

    return res.status(200).json({
      success: true,
      message: "File renamed successfully",
      data: {
        file,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteExistingFile = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = await deleteFile(
      req.user._id.toString(),
      req.params.id as string,
    );

    return res.status(200).json({
      success: true,
      message: "File moved to trash",
      data,
    });
  } catch (error) {
    next(error);
  }
};