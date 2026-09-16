import { Router } from "express";

import {  
  getDirectory,
} from "../controllers/directory.controller.js";

import {authenticate} from "../middlewares/auth.middleware.js";
import { validateBody, validateParams } from "../middlewares/validate.middleware.js";

import {
  createDirectorySchema,
  directoryParamsSchema,
  renameDirectorySchema,
} from "../validators/directory.validator.js";

const router = Router();

router.get( "/", authenticate, getDirectory);

router.get( "/:id", authenticate, validateParams(directoryParamsSchema), getDirectory);

// router.post(
//   "/",
//   authenticate,
//   validateBody(createDirectorySchema),
//   createNewDirectory,
// );

// router.patch(
//   "/:id",
//   authenticate,
//   validateParams(directoryParamsSchema),
//   validateBody(renameDirectorySchema),
//   renameExistingDirectory,
// );

// router.delete(
//   "/:id",
//   authenticate,
//   validateParams(directoryParamsSchema),
//   deleteExistingDirectory,
// );

export default router;