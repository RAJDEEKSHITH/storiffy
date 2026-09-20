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

/*
|--------------------------------------------------------------------------
| Trash
|--------------------------------------------------------------------------
*/

router.get(
  "/trash",
  getFileTrash,
);

/*
|--------------------------------------------------------------------------
| Start upload
|--------------------------------------------------------------------------
*/

router.post(
  "/upload/initiate",
  validateBody(
    initiateUploadSchema,
  ),
  initiateUpload,
);

/*
|--------------------------------------------------------------------------
| Multipart part URL
|--------------------------------------------------------------------------
*/

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

/*
|--------------------------------------------------------------------------
| Complete single upload
|--------------------------------------------------------------------------
*/

router.post(
  "/upload/complete/:id",
  validateParams(
    fileIdParamsSchema,
  ),
  completeSingleUpload,
);

/*
|--------------------------------------------------------------------------
| Complete multipart upload
|--------------------------------------------------------------------------
*/

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

/*
|--------------------------------------------------------------------------
| Abort upload
|--------------------------------------------------------------------------
*/

router.post(
  "/upload/abort/:id",
  validateParams(
    fileIdParamsSchema,
  ),
  abortUpload,
);

/*
|--------------------------------------------------------------------------
| Generate CloudFront URL
|--------------------------------------------------------------------------
*/

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

/*
|--------------------------------------------------------------------------
| Rename file
|--------------------------------------------------------------------------
*/

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

/*
|--------------------------------------------------------------------------
| Restore file
|--------------------------------------------------------------------------
*/

router.post(
  "/restore/:id",
  validateParams(
    fileIdParamsSchema,
  ),
  restoreExistingFile,
);

/*
|--------------------------------------------------------------------------
| Permanent delete
|--------------------------------------------------------------------------
*/

router.delete(
  "/permanent/:id",
  validateParams(
    fileIdParamsSchema,
  ),
  permanentDeleteFile,
);

/*
|--------------------------------------------------------------------------
| Move to trash
|--------------------------------------------------------------------------
*/

router.delete(
  "/:id",
  validateParams(
    fileIdParamsSchema,
  ),
  softDeleteFile,
);

export default router;