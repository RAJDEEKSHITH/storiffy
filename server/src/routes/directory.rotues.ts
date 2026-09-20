import { Router } from "express";

import {
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

// Base path: /api/directory

const router = Router();

router.use(authenticate);

/*
|--------------------------------------------------------------------------
| Trash
|--------------------------------------------------------------------------
*/

router.get(
  "/trash",
  getDirectoryTrash,
);

/*
|--------------------------------------------------------------------------
| Breadcrumbs
|--------------------------------------------------------------------------
*/

router.get(
  "/breadcrumbs/:id",
  validateParams(
    directoryParamsSchema,
  ),
  getDirectoryBreadcrumbs,
);

/*
|--------------------------------------------------------------------------
| Directory contents
|--------------------------------------------------------------------------
*/

router.get(
  "/:id",
  validateParams(
    directoryParamsSchema,
  ),
  getDirectory,
);

/*
|--------------------------------------------------------------------------
| Create directory
|--------------------------------------------------------------------------
*/

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

/*
|--------------------------------------------------------------------------
| Rename directory
|--------------------------------------------------------------------------
*/

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

/*
|--------------------------------------------------------------------------
| Restore directory
|--------------------------------------------------------------------------
*/

router.post(
  "/restore/:id",
  validateParams(
    directoryParamsSchema,
  ),
  restoreExistingDirectory,
);

/*
|--------------------------------------------------------------------------
| Permanent delete
|--------------------------------------------------------------------------
*/

router.delete(
  "/permanent/:id",
  validateParams(
    directoryParamsSchema,
  ),
  permanentlyDeleteExistingDirectory,
);

/*
|--------------------------------------------------------------------------
| Move to trash
|--------------------------------------------------------------------------
*/

router.delete(
  "/:id",
  validateParams(
    directoryParamsSchema,
  ),
  moveDirectoryToTrash,
);

export default router;