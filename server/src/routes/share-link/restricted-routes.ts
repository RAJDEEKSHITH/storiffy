import { Router } from "express";

import {
  abortRestrictedUploadController,
  browseRestrictedDirectoryController,
  completeRestrictedMultipartUploadController,
  completeRestrictedSingleUploadController,
  createRestrictedDirectoryController,
  deleteRestrictedDirectoryController,
  deleteRestrictedFileController,
  downloadRestrictedFileController,
  generateRestrictedMultipartPartUrlController,
  initiateRestrictedFileUploadController,
  renameRestrictedDirectoryController,
  renameRestrictedFileController,
  resolveRestrictedShareController,
  viewRestrictedFileController,
} from "../../controllers/share-link/restricted-share.controller.js";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { shareRateLimit } from "../../middlewares/share-rate-limit.middleware.js";
import {
  validateBody,
  validateParams,
} from "../../middlewares/validate.middleware.js";
import {
  shareTokenParamsSchema,
  sharedCompleteMultipartSchema,
  sharedCreateDirectorySchema,
  sharedDirectoryParamsSchema,
  sharedDirectoryParentParamsSchema,
  sharedFileParamsSchema,
  sharedInitiateUploadSchema,
  sharedPartUrlBodySchema,
  sharedPartUrlParamsSchema,
  sharedRenameSchema,
} from "../../validators/share-link/shared-access.validator.js";

const router = Router();

router.use(authenticate);
router.get(
  "/:token",
  shareRateLimit,
  validateParams(shareTokenParamsSchema),
  resolveRestrictedShareController,
);

router.get(
  "/:token/directories/:directoryId",
  shareRateLimit,
  validateParams(sharedDirectoryParamsSchema),
  browseRestrictedDirectoryController,
);

router.get(
  "/:token/files/:fileId",
  shareRateLimit,
  validateParams(sharedFileParamsSchema),
  viewRestrictedFileController,
);

router.get(
  "/:token/files/:fileId/download",
  shareRateLimit,
  validateParams(sharedFileParamsSchema),
  downloadRestrictedFileController,
);

/* Editor: file mutations. */
router.patch(
  "/:token/files/:fileId",
  shareRateLimit,
  validateParams(sharedFileParamsSchema),
  validateBody(sharedRenameSchema),
  renameRestrictedFileController,
);

router.delete(
  "/:token/files/:fileId",
  shareRateLimit,
  validateParams(sharedFileParamsSchema),
  deleteRestrictedFileController,
);

/* Editor: directory mutations. */
router.patch(
  "/:token/directories/:directoryId",
  shareRateLimit,
  validateParams(sharedDirectoryParamsSchema),
  validateBody(sharedRenameSchema),
  renameRestrictedDirectoryController,
);

router.delete(
  "/:token/directories/:directoryId",
  shareRateLimit,
  validateParams(sharedDirectoryParamsSchema),
  deleteRestrictedDirectoryController,
);

router.post(
  "/:token/directories/:parentDirectoryId",
  shareRateLimit,
  validateParams(sharedDirectoryParentParamsSchema),
  validateBody(sharedCreateDirectorySchema),
  createRestrictedDirectoryController,
);

/* Editor: upload flow. */
router.post(
  "/:token/files/upload/initiate",
  shareRateLimit,
  validateParams(shareTokenParamsSchema),
  validateBody(sharedInitiateUploadSchema),
  initiateRestrictedFileUploadController,
);

router.post(
  "/:token/files/upload/part-url/:id",
  shareRateLimit,
  validateParams(sharedPartUrlParamsSchema),
  validateBody(sharedPartUrlBodySchema),
  generateRestrictedMultipartPartUrlController,
);

router.post(
  "/:token/files/upload/complete/:id",
  shareRateLimit,
  validateParams(sharedPartUrlParamsSchema),
  completeRestrictedSingleUploadController,
);

router.post(
  "/:token/files/upload/complete-multipart/:id",
  shareRateLimit,
  validateParams(sharedPartUrlParamsSchema),
  validateBody(sharedCompleteMultipartSchema),
  completeRestrictedMultipartUploadController,
);

router.post(
  "/:token/files/upload/abort/:id",
  shareRateLimit,
  validateParams(sharedPartUrlParamsSchema),
  abortRestrictedUploadController,
);

export default router;
