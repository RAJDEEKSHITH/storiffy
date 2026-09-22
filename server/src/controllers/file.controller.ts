import type {
  NextFunction,
  Request,
  Response,
} from "express";

import {
  abortFileUpload,
  completeMultipartFileUpload,
  completeSingleFileUpload,
  getFileSignedUrl,
  getMultipartPartUploadUrl,
  getTrashedFiles,
  initiateMultipartUploadService,
  initiateSingleUpload,
  permanentlyDeleteFile as permanentlyDeleteFileService,
  renameFile as renameFileService,
  restoreFile as restoreFileService,
  softDeleteFile as softDeleteFileService,
} from "../services/file/file.service.js";

const MULTIPART_THRESHOLD = 100 * 1024 * 1024; // 100 MB

// get file url to view and download
export const getFileUrl = async (
  req: Request<{
    id: string;
  }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data =
      await getFileSignedUrl({
        userId:
          req.user._id.toString(),
        fileId:
          req.params.id,
        download:
          req.body.download,
      });

    return res.status(200).json({
      success: true,
      message:
        "File URL generated successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};

// initiate upload for files < 100MB
export const initiateUpload = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId =
      req.user._id.toString();

    const {
      name,
      size,
      directoryId,
      mimeType,
    } = req.body;

    if (
      size >=
      MULTIPART_THRESHOLD
    ) {
      const data =
        await initiateMultipartUploadService(
          {
            userId,
            directoryId,
            name,
            size,
            mimeType,
          },
        );

      return res.status(200).json({
        success: true,
        message:
          "File upload initiated",
        data,
      });
    }

    const data =
      await initiateSingleUpload({
        userId,
        directoryId,
        name,
        size,
        mimeType,
      });

    return res.status(200).json({
      success: true,
      message:
        "File upload initiated",
      data,
    });
  } catch (error) {
    next(error);
  }
};

// complete file upload for files < 100 MB
export const completeSingleUpload =
  async (
    req: Request<{
      id: string;
    }>,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const data =
        await completeSingleFileUpload(
          {
            userId:
              req.user._id.toString(),
            fileId:
              req.params.id,
          },
        );

      return res.status(200).json({
        success: true,
        message:
          "File upload completed successfully",
        data,
      });
    } catch (error) {
      next(error);
    }
  };

// complete multipart upload for files >= 100MB
export const completeMultipartUpload =
  async (
    req: Request<{
      id: string;
    }>,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const data =
        await completeMultipartFileUpload(
          {
            userId:
              req.user._id.toString(),
            fileId:
              req.params.id,
            parts:
              req.body.parts,
          },
        );

      return res.status(200).json({
        success: true,
        message:
          "Multipart upload completed successfully",
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  
export const abortUpload = async (
  req: Request<{
    id: string;
  }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data =
      await abortFileUpload({
        userId:
          req.user._id.toString(),
        fileId:
          req.params.id,
      });

    return res.status(200).json({
      success: true,
      message:
        "File upload aborted successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};

// generate single part url for multipart upload
export const generatePartUploadUrl =
  async (
    req: Request<{
      id: string;
    }>,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const data =
        await getMultipartPartUploadUrl(
          {
            userId:
              req.user._id.toString(),
            fileId:
              req.params.id,
            partNumber:
              req.body.partNumber,
          },
        );

      return res.status(200).json({
        success: true,
        message:
          "Multipart part URL generated successfully",
        data,
      });
    } catch (error) {
      next(error);
    }
  };


export const renameFile =
  async (
    req: Request<{
      id: string;
    }>,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const file =
        await renameFileService({
          userId:
            req.user._id.toString(),
          fileId:
            req.params.id,
          name:
            req.body.name,
        });

      return res.status(200).json({
        success: true,
        message:
          "File renamed successfully",
        data: {
          file,
        },
      });
    } catch (error) {
      next(error);
    }
  };


// move file to trash
export const softDeleteFile =
  async (
    req: Request<{
      id: string;
    }>,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const data =
        await softDeleteFileService({
          userId:
            req.user._id.toString(),
          fileId:
            req.params.id,
        });

      return res.status(200).json({
        success: true,
        message:
          "File moved to trash successfully",
        data,
      });
    } catch (error) {
      next(error);
    }
  };

// fetch trashed files
export const getFileTrash = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data =
      await getTrashedFiles(
        req.user._id.toString(),
      );

    return res.status(200).json({
      success: true,
      message:
        "Trashed files fetched successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};

// restore trashed file
export const restoreExistingFile =
  async (
    req: Request<{
      id: string;
    }>,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const file =
        await restoreFileService({
          userId:
            req.user._id.toString(),
          fileId:
            req.params.id,
        });

      return res.status(200).json({
        success: true,
        message:
          "File restored successfully",
        data: {
          file,
        },
      });
    } catch (error) {
      next(error);
    }
  };


// permanently delete the file
export const permanentDeleteFile =
  async (
    req: Request<{
      id: string;
    }>,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const data =
        await permanentlyDeleteFileService(
          {
            userId:
              req.user._id.toString(),
            fileId:
              req.params.id,
          },
        );

      return res.status(200).json({
        success: true,
        message:
          "File permanently deleted",
        data,
      });
    } catch (error) {
      next(error);
    }
  };