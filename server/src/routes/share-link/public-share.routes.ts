import { Router } from "express";

import {
  browsePublicDirectoryController,
  downloadPublicFileController,
  resolvePublicShareController,
  viewPublicFileController,
} from "../../controllers/share-link/public-share.controller.js";
import { validateParams } from "../../middlewares/validate.middleware.js";
import { shareRateLimit } from "../../middlewares/share-rate-limit.middleware.js";
import {
  shareTokenParamsSchema,
  sharedDirectoryParamsSchema,
  sharedFileParamsSchema,
} from "../../validators/share-link/shared-access.validator.js";

const router = Router();

router.get(
  "/:token",
  shareRateLimit,
  validateParams(shareTokenParamsSchema),
  resolvePublicShareController,
);

router.get(
  "/:token/directories/:directoryId",
  shareRateLimit,
  validateParams(sharedDirectoryParamsSchema),
  browsePublicDirectoryController,
);

router.get(
  "/:token/files/:fileId",
  shareRateLimit,
  validateParams(sharedFileParamsSchema),
  viewPublicFileController,
);

router.get(
  "/:token/files/:fileId/download",
  shareRateLimit,
  validateParams(sharedFileParamsSchema),
  downloadPublicFileController,
);

export default router;