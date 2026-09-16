import type { NextFunction, Request, Response } from "express";

import {
  loginUserWithEmail,
  registerUserWithEmail,
} from "../services/auth/auth.service.js";

import {
  createSession,
  enforceSessionLimit,
  SESSION_TTL_MS,
} from "../services/auth/session.service.js";

import UserModel from "../models/user.model.js";
import { toPublicUser } from "../services/user/user.service.js";

export const register = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { name, email, password } = req.body;
    console.log(req.body);
    console.log(req.body);
    const user = await registerUserWithEmail({ name, email, password });
    return res.status(201).json({
      success: true,
      message: "user registered successfully",
      data: {
        user: {
          id: user._id,
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
    const { email, password } = req.body;

    const user = await loginUserWithEmail({
      email,
      password,
    });

    const userId = user._id.toString();

    // Remove oldest session if user already has 2 active sessions
    await enforceSessionLimit(userId);

    // Create new session
    const sessionId = await createSession(userId);

    res.cookie("sessionId", sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_TTL_MS,
      signed: true,
    });

    return res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        user: toPublicUser(user)
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
        user : toPublicUser(user)
      },
    });
  } catch (error) {
    next(error);
  }
};
