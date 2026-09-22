import { Router } from "express";

import {
  bulkMoveItemsToTrashController,
  createNewDirectory,
  getDirectory,
  getDirectoryBreadcrumbs,
  getDirectoryTrash,
  moveDirectoryToTrash,
  permanentlyDeleteExistingDirectory,
  renameExistingDirectory,
  restoreExistingDirectory,
} from "../controllers/directory.controller.js";

import { authenticate } from "../middlewares/auth.middleware.js";

import {
  validateBody,
  validateParams,
} from "../middlewares/validate.middleware.js";

import {
  createDirectorySchema,
  directoryParamsSchema,
  renameDirectorySchema,
} from "../validators/directory.validator.js";
import { emptyTrashController } from "../controllers/trash.controller.js";

// Base path: /api/directories

const router = Router();

router.use(authenticate);


router.get(
  "/trash",
  getDirectoryTrash,
);

router.post(
  "/trash/bulk",
  bulkMoveItemsToTrashController,
);


router.delete(
  "/trash/empty",
  emptyTrashController,
);


router.get(
  "/breadcrumbs/:id",
  validateParams(
    directoryParamsSchema,
  ),
  getDirectoryBreadcrumbs,
);


router.get(
  "/:id",
  validateParams(
    directoryParamsSchema,
  ),
  getDirectory,
);


router.post(
  "/:id",
  validateParams(
    directoryParamsSchema,
  ),
  validateBody(
    createDirectorySchema,
  ),
  createNewDirectory,
);


router.patch(
  "/:id",
  validateParams(
    directoryParamsSchema,
  ),
  validateBody(
    renameDirectorySchema,
  ),
  renameExistingDirectory,
);


router.post(
  "/restore/:id",
  validateParams(
    directoryParamsSchema,
  ),
  restoreExistingDirectory,
);


router.delete(
  "/permanent/:id",
  validateParams(
    directoryParamsSchema,
  ),
  permanentlyDeleteExistingDirectory,
);


router.delete(
  "/:id",
  validateParams(
    directoryParamsSchema,
  ),
  moveDirectoryToTrash,
);

export default router;