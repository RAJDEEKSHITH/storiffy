import type { NextFunction, Request, Response } from "express";

import {
  createPublicShare,
  createRestrictedShare,
  getShareLinkForOwner,
  listMyShares,
  listSharesWithMe,
  lookupActiveShareRecipient,
  revokeShareLink,
  updateShareLink,
} from "../../services/share-link/share-link.service.js";

export const createPublicShareController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = await createPublicShare({
      ownerId: req.user._id.toString(),
      resourceType: req.body.resourceType,
      resourceId: req.body.resourceId,
      duration: req.body.duration,
    });

    return res.status(201).json({
      success: true,
      message: "Public share link created successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const createRestrictedShareController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = await createRestrictedShare({
      ownerId: req.user._id.toString(),
      resourceType: req.body.resourceType,
      resourceId: req.body.resourceId,
      permission: req.body.permission,
      recipientEmails: req.body.recipientEmails,
      duration: req.body.duration,
    });

    return res.status(201).json({
      success: true,
      message: "Restricted share link created successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const lookupShareRecipientController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = await lookupActiveShareRecipient({
      email: req.query.email as string,
    });

    return res.status(200).json({
      success: true,
      message: "Recipient found",
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const getShareLinkController = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = await getShareLinkForOwner({
      ownerId: req.user._id.toString(),
      shareId: req.params.id,
    });

    return res.status(200).json({
      success: true,
      message: "Share link retrieved successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const updateShareLinkController = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = await updateShareLink({
      ownerId: req.user._id.toString(),
      shareId: req.params.id,
      accessType: req.body.accessType,
      permission: req.body.permission,
      recipientEmails: req.body.recipientEmails,
      duration: req.body.duration,
    });

    return res.status(200).json({
      success: true,
      message: "Share link updated successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const revokeShareLinkController = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = await revokeShareLink({
      ownerId: req.user._id.toString(),
      shareId: req.params.id,
    });

    return res.status(200).json({
      success: true,
      message: "Share link revoked successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const listMySharesController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = await listMyShares(req.user._id.toString());

    return res.status(200).json({
      success: true,
      message: "Your active share links retrieved successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const listSharesWithMeController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = await listSharesWithMe(req.user._id.toString());

    return res.status(200).json({
      success: true,
      message: "Shared with you retrieved successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};
