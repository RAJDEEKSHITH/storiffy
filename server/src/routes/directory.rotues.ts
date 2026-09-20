import { Router } from "express";

import {
  createNewDirectory,
  getDirectory,
  getDirectoryBreadcrumbs,
  renameExistingDirectory,
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

const router = Router();

// Base path: /api/directory

router.use(authenticate);

router.get("/breadcrumbs/:id",
  validateParams(directoryParamsSchema),
  getDirectoryBreadcrumbs,
);

router.get("/:id", validateParams(directoryParamsSchema), getDirectory);

router.post("/:id", validateParams(directoryParamsSchema),validateBody(createDirectorySchema), createNewDirectory);

router.patch(
  "/:id",
  validateParams(directoryParamsSchema),
  validateBody(renameDirectorySchema),
  renameExistingDirectory,
);

export default router;
