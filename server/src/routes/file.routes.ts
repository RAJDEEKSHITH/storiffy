import { Router } from "express";

import {
  abortUpload,
  completeMultipartUpload,
  completeSingleUpload,
  generatePartUploadUrl,
  getFileTrash,
  getFileUrl,
  initiateUpload,
  permanentDeleteFile,
  renameFile,
  restoreExistingFile,
  softDeleteFile,
} from "../controllers/file.controller.js";

import {
  completeMultipartUploadSchema,
  fileIdParamsSchema,
  generatePartUrlSchema,
  getFileUrlSchema,
  initiateUploadSchema,
  renameFileSchema,
} from "../validators/file.validator.js";

import {
  validateBody,
  validateParams,
} from "../middlewares/validate.middleware.js";

import { authenticate } from "../middlewares/auth.middleware.js";

// Base path: /api/files

const router = Router();

router.use(authenticate);


router.get(
  "/trash",
  getFileTrash,
);


router.post(
  "/upload/initiate",
  validateBody(
    initiateUploadSchema,
  ),
  initiateUpload,
);


router.post(
  "/upload/part-url/:id",
  validateParams(
    fileIdParamsSchema,
  ),
  validateBody(
    generatePartUrlSchema,
  ),
  generatePartUploadUrl,
);


router.post(
  "/upload/complete/:id",
  validateParams(
    fileIdParamsSchema,
  ),
  completeSingleUpload,
);


router.post(
  "/upload/complete-multipart/:id",
  validateParams(
    fileIdParamsSchema,
  ),
  validateBody(
    completeMultipartUploadSchema,
  ),
  completeMultipartUpload,
);


router.post(
  "/upload/abort/:id",
  validateParams(
    fileIdParamsSchema,
  ),
  abortUpload,
);


router.post(
  "/:id",
  validateParams(
    fileIdParamsSchema,
  ),
  validateBody(
    getFileUrlSchema,
  ),
  getFileUrl,
);


router.patch(
  "/:id",
  validateParams(
    fileIdParamsSchema,
  ),
  validateBody(
    renameFileSchema,
  ),
  renameFile,
);


router.post(
  "/restore/:id",
  validateParams(
    fileIdParamsSchema,
  ),
  restoreExistingFile,
);


router.delete(
  "/permanent/:id",
  validateParams(
    fileIdParamsSchema,
  ),
  permanentDeleteFile,
);


router.delete(
  "/:id",
  validateParams(
    fileIdParamsSchema,
  ),
  softDeleteFile,
);

export default router;