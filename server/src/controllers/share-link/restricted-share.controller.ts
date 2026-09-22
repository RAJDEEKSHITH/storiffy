import type { NextFunction, Request, Response } from "express";

import {
  abortRestrictedUpload,
  browseRestrictedDirectory,
  completeRestrictedMultipartUpload,
  completeRestrictedSingleUpload,
  createRestrictedDirectory,
  deleteRestrictedDirectory,
  deleteRestrictedFile,
  downloadRestrictedFile,
  generateRestrictedMultipartPartUrl,
  initiateRestrictedFileUpload,
  renameRestrictedDirectory,
  renameRestrictedFile,
  resolveRestrictedShare,
  viewRestrictedFile,
} from "../../services/share-link/restricted-share.service.js";

export const resolveRestrictedShareController = async (
  req: Request<{ token: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = await resolveRestrictedShare({
      token: req.params.token,
      userId: req.user._id.toString(),
    });

    return res.status(200).json({
      success: true,
      message: "Restricted share retrieved successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const browseRestrictedDirectoryController = async (
  req: Request<{ token: string; directoryId: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = await browseRestrictedDirectory({
      token: req.params.token,
      userId: req.user._id.toString(),
      directoryId: req.params.directoryId,
    });

    return res.status(200).json({
      success: true,
      message: "Restricted shared directory retrieved successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const viewRestrictedFileController = async (
  req: Request<{ token: string; fileId: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = await viewRestrictedFile({
      token: req.params.token,
      userId: req.user._id.toString(),
      fileId: req.params.fileId,
    });

    return res.status(200).json({
      success: true,
      message: "Restricted shared file URL generated successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const downloadRestrictedFileController = async (
  req: Request<{ token: string; fileId: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = await downloadRestrictedFile({
      token: req.params.token,
      userId: req.user._id.toString(),
      fileId: req.params.fileId,
    });

    return res.status(200).json({
      success: true,
      message: "Restricted shared file download URL generated successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const renameRestrictedFileController = async (
  req: Request<{ token: string; fileId: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = await renameRestrictedFile({
      token: req.params.token,
      userId: req.user._id.toString(),
      fileId: req.params.fileId,
      name: req.body.name,
    });

    return res.status(200).json({
      success: true,
      message: "Shared file renamed successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const renameRestrictedDirectoryController = async (
  req: Request<{ token: string; directoryId: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = await renameRestrictedDirectory({
      token: req.params.token,
      userId: req.user._id.toString(),
      directoryId: req.params.directoryId,
      name: req.body.name,
    });

    return res.status(200).json({
      success: true,
      message: "Shared directory renamed successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const createRestrictedDirectoryController = async (
  req: Request<{ token: string; parentDirectoryId: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = await createRestrictedDirectory({
      token: req.params.token,
      userId: req.user._id.toString(),
      parentDirectoryId: req.params.parentDirectoryId,
      name: req.body.name,
    });

    return res.status(201).json({
      success: true,
      message: "Shared directory created successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const initiateRestrictedFileUploadController = async (
  req: Request<{token : string}>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = await initiateRestrictedFileUpload({
      token: req.params.token,
      userId: req.user._id.toString(),
      directoryId: req.body.directoryId,
      name: req.body.name,
      size: req.body.size,
      mimeType: req.body.mimeType,
    });

    return res.status(200).json({
      success: true,
      message: "Shared file upload initiated successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const generateRestrictedMultipartPartUrlController = async (
  req: Request<{ token: string; id: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = await generateRestrictedMultipartPartUrl({
      token: req.params.token,
      userId: req.user._id.toString(),
      fileId: req.params.id,
      partNumber: req.body.partNumber,
    });

    return res.status(200).json({
      success: true,
      message: "Shared multipart part URL generated successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const completeRestrictedSingleUploadController = async (
  req: Request<{ token: string; id: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = await completeRestrictedSingleUpload({
      token: req.params.token,
      userId: req.user._id.toString(),
      fileId: req.params.id,
    });

    return res.status(200).json({
      success: true,
      message: "Shared file upload completed successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const completeRestrictedMultipartUploadController = async (
  req: Request<{ token: string; id: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = await completeRestrictedMultipartUpload({
      token: req.params.token,
      userId: req.user._id.toString(),
      fileId: req.params.id,
      parts: req.body.parts,
    });

    return res.status(200).json({
      success: true,
      message: "Shared multipart upload completed successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const abortRestrictedUploadController = async (
  req: Request<{ token: string; id: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = await abortRestrictedUpload({
      token: req.params.token,
      userId: req.user._id.toString(),
      fileId: req.params.id,
    });

    return res.status(200).json({
      success: true,
      message: "Shared file upload aborted successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteRestrictedFileController = async (
  req: Request<{ token: string; fileId: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = await deleteRestrictedFile({
      token: req.params.token,
      userId: req.user._id.toString(),
      fileId: req.params.fileId,
    });

    return res.status(200).json({
      success: true,
      message: "Shared file moved to trash successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteRestrictedDirectoryController = async (
  req: Request<{ token: string; directoryId: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = await deleteRestrictedDirectory({
      token: req.params.token,
      userId: req.user._id.toString(),
      directoryId: req.params.directoryId,
    });

    return res.status(200).json({
      success: true,
      message: "Shared directory moved to trash successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};
