import type { NextFunction, Request, Response } from "express";
import { getDirectoryItems } from "../services/directory/directory.service.js";

export const getDirectory = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const directoryId = (req.params.id as string | undefined) ?? req.user.rootDirectoryId.toString();

    const data = await getDirectoryItems(req.user._id.toString(), directoryId);
    console.log(data)
    return res.status(200).json({
      success: true,
      message: "Directory items retrieved successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};
