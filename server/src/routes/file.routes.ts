import { Router } from "express";

import {
  getFileUrl,
  initiateUpload,
  generatePartUploadUrl,
  completeSingleUpload,
  completeMultipartUpload,
  abortUpload,
  renameFile,
  softDeleteFile,
  permanentDeleteFile,
} from "../controllers/file.controller.js";

import {
  fileIdParamsSchema,
  initiateUploadSchema,
  generatePartUrlSchema,
  completeMultipartUploadSchema,
  renameFileSchema,
  getFileUrlSchema,
} from "../validators/file.validator.js";

import {
  validateBody,
  validateParams,
} from "../middlewares/validate.middleware.js";
import { authenticate } from "../middlewares/auth.middleware.js";

// Base path: /api/files

const router = Router();

// Start single or multipart upload
router.use(authenticate);
router.post(
  "/upload/initiate",
  validateBody(initiateUploadSchema),
  initiateUpload,
);

// Generate / regenerate URL for one multipart part
router.post(
  "/upload/part-url/:id",
  validateParams(fileIdParamsSchema),
  validateBody(generatePartUrlSchema),
  generatePartUploadUrl,
);

router.post(
  "/upload/complete/:id",
  validateParams(fileIdParamsSchema),
  completeSingleUpload,
);

router.post(
  "/upload/complete-multipart/:id",
  validateParams(fileIdParamsSchema),
  validateBody(completeMultipartUploadSchema),
  completeMultipartUpload,
);

// Abort an unfinished upload
router.post(
  "/upload/abort/:id",
  validateParams(fileIdParamsSchema),
  abortUpload,
);

// Generate CloudFront view/download URL
router.post(
  "/:id",
  validateParams(fileIdParamsSchema),
  validateBody(getFileUrlSchema),
  getFileUrl,
);

// Rename file
router.patch(
  "/:id",
  validateParams(fileIdParamsSchema),
  validateBody(renameFileSchema),
  renameFile,
);

// Move file to trash
router.delete("/:id", validateParams(fileIdParamsSchema), softDeleteFile);

// Permanently delete file
router.delete(
  "/permanent/:id",
  validateParams(fileIdParamsSchema),
  permanentDeleteFile,
);

export default router;
