import type {
  NextFunction,
  Request,
  Response,
} from "express";

import {
  emptyTrash,
} from "../services/trash/trash.service.js";

export const emptyTrashController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = await emptyTrash({
      userId: req.user._id.toString(),
    });

    return res.status(200).json({
      success: true,
      message: "Trash emptied successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};