// import { Router } from "express";

// import {
//   completeUpload,
//   deleteExistingFile,
//   initiateUpload,
//   renameExistingFile,
//   viewFile,
// } from "../controllers/file.controller.js";

// import {authenticate} from "../middlewares/auth.middleware.js";
// import { validateBody, validateParams } from "../middlewares/validate.middleware.js";

// import {
//   completeUploadSchema,
//   fileParamsSchema,
//   initiateUploadSchema,
//   renameFileSchema,
// } from "../validators/file.validator.js";

// const router = Router();

// router.post(
//   "/upload/initiate",
//   authenticate,
//   validateBody(initiateUploadSchema),
//   initiateUpload,
// );

// router.post(
//   "/upload/complete",
//   authenticate,
//   validateBody(completeUploadSchema),
//   completeUpload,
// );

// router.get(
//   "/:id/view-url",
//   authenticate,
//   validateParams(fileParamsSchema),
//   viewFile,
// );

// router.patch(
//   "/:id",
//   authenticate,
//   validateParams(fileParamsSchema),
//   validateBody(renameFileSchema),
//   renameExistingFile,
// );

// router.delete(
//   "/:id",
//   authenticate,
//   validateParams(fileParamsSchema),
//   deleteExistingFile,
// );

// export default router;