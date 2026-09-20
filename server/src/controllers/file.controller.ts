import type { Request, Response, NextFunction } from "express";
import {
  abortFileUpload,
  completeMultipartFileUpload,
  completeSingleFileUpload,
  getFileSignedUrl,
  getMultipartPartUploadUrl,
  initiateMultipartUploadService,
  initiateSingleUpload,
} from "../services/file/file.service.js";

const MULTIPART_THRESHOLD = 100 * 1024 * 1024; // 100 MB

export const getFileUrl = async (req : Request<{id : string}>, res : Response, next : NextFunction) => {
  try {
    const data = await getFileSignedUrl({
      userId: req.user._id.toString(),
      fileId: req.params.id,
      download: req.body.download,
    });

    return res.status(200).json({
      success: true,
      message: "File URL generated successfully",
      data,
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
    const userId = req.user._id.toString();
    const { name, size, directoryId, mimeType } = req.body;
    // based on file size threshold
    if (size >= MULTIPART_THRESHOLD) {
      const multipartResult = await initiateMultipartUploadService({
        userId,
        directoryId,
        name,
        size,
        mimeType,
      });
      return res.status(200).json({
        success: true,
        message: "File uploaded initiated",
        data: multipartResult,
      });
    }

    // Default back to single file upload sequence
    const singleFileResult = await initiateSingleUpload({
      userId,
      directoryId,
      name,
      size,
      mimeType,
    });
    return res.status(200).json({
      success: true,
      message: "File uploaded initiated",
      data: singleFileResult,
    });
  } catch (error) {
    next(error);
  }
};

export const completeSingleUpload = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = await completeSingleFileUpload({
      userId: req.user._id.toString(),
      fileId: req.params.id,
    });

    return res.status(200).json({
      success: true,
      message: "File upload completed successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const completeMultipartUpload = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = await completeMultipartFileUpload({
      userId: req.user._id.toString(),
      fileId: req.params.id,
      parts: req.body.parts,
    });

    return res.status(200).json({
      success: true,
      message: "Multipart upload completed successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const abortUpload = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = await abortFileUpload({
      userId: req.user._id.toString(),
      fileId: req.params.id,
    });

    return res.status(200).json({
      success: true,
      message: "File upload aborted successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};

// Request a chunk URL dynamically from the client
export const generatePartUploadUrl = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { partNumber } = req.body;

    const data = await getMultipartPartUploadUrl({
      userId: req.user._id.toString(),
      fileId: req.params.id,
      partNumber,
    });

    return res.status(200).json({
      success: true,
      message: "Multipart part URL generated successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};


export const renameFile = async () => {};

export const softDeleteFile = async () => {};

export const permanentDeleteFile = async () => {};
