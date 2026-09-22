import { Router } from "express";

import {
  register,
  login,
  getCurrentUser,
  logoutUser,
  logoutAllUsers,
} from "../controllers/auth.controller.js";

import { authenticate } from "../middlewares/auth.middleware.js";
import { validateBody } from "../middlewares/validate.middleware.js";
import { loginSchema, registerSchema } from "../validators/auth.validator.js";

const router = Router();

// Base path: /api/auth

router.post("/register", validateBody(registerSchema), register);

router.post("/login", validateBody(loginSchema), login);

router.get("/user", authenticate, getCurrentUser);

router.post("/logout", authenticate, logoutUser);

router.post( "/logout-all", authenticate, logoutAllUsers);
export default router;
