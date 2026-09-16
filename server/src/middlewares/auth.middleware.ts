import type { NextFunction, Request, Response } from "express";

import { getSession } from "../services/auth/session.service.js";
import User from "../models/user.model.js";
import { AppError } from "../utils/app.error.js";

export const authenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  try {
    const sessionId = req.signedCookies.sessionId;

    if (!sessionId) {
      throw new AppError("Not authenticated", 401);
    }

    const session = await getSession(sessionId);

    if (!session) {
      throw new AppError("Session expired", 401);
    }

    const user = await User.findById(session.userId);

    if (!user) {
      throw new AppError("User not found", 401);
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};
