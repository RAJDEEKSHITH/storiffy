import type { NextFunction, Request, Response } from "express";

import {
  loginUserWithEmail,
  logout,
  registerUserWithEmail,
} from "../services/auth/auth.service.js";

import {
  deleteAllSessionsForUser,
  deleteSession,
  SESSION_TTL_MS,
} from "../services/auth/session.service.js";

import UserModel from "../models/user.model.js";
import { toPublicUser } from "../services/user/user.service.js";
import { env } from "../config/env.js";

export const register = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { name, email, password } = req.body;
    const user = await registerUserWithEmail({ name, email, password });
    return res.status(201).json({
      success: true,
      message: "user registered successfully",
      data: {
        user: {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { user, sessionId } = await loginUserWithEmail(req.body);

    res.cookie("sessionId", sessionId, {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_TTL_MS,
      signed: true,
    });

    return res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        user: toPublicUser(user),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getCurrentUser = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.user._id;

    const user = await UserModel.findById(userId);

    if (!user) {
      return res.status(401).json({
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        user: toPublicUser(user),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const logoutUser = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const sessionId = req.signedCookies?.sessionId as string | undefined;
    if (sessionId) await logout(sessionId);
    res.clearCookie("sessionId");
    return res.status(200).json({
      success: true,
      message: "Signed out",
      data: {},
    });
  } catch (error) {
    next(error);
  }
};

export const logoutAllUsers = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.user._id.toString();

    await deleteAllSessionsForUser(userId);

    res.clearCookie("sessionId");

    return res.status(200).json({
      success: true,
      message: "Signed out on all devices",
      data: {},
    });
  } catch (error) {
    next(error);
  }
};