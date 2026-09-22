import mongoose from "mongoose";

import Directory from "../../models/directory.model.js";
import File from "../../models/file.model.js";
import User from "../../models/user.model.js";
import ShareLink, {
  type AccessType,
  type PermissionRole,
  type ResourceType,
  type ShareLinkI,
} from "../../models/share-link.model.js";
import ShareLinkRecipient from "../../models/share-link-recipient.model.js";
import { AppError } from "../../utils/app.error.js";
import {
  buildSharePath,
  calculateShareExpiry,
  createShareToken,
  type ShareDuration,
} from "./share-token.js";

const MAX_RECIPIENTS = 100;
const TOKEN_CREATION_ATTEMPTS = 5;

const isDuplicateKeyError = (error: unknown) =>
  Boolean(
    error &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: unknown }).code === 11000,
  );

const assertResourceType = (resourceType: ResourceType) => {
  if (resourceType !== "file" && resourceType !== "directory") {
    throw new AppError("Invalid resource type", 400);
  }
};

const assertDuration = (duration: ShareDuration) => {
  if (
    duration !== "1h" &&
    duration !== "3h" &&
    duration !== "5h" &&
    duration !== "12h" &&
    duration !== "1d" &&
    duration !== "3d" &&
    duration !== "5d" &&
    duration !== "7d"
  ) {
    throw new AppError("Invalid share duration", 400);
  }
};
const assertConfiguration = ({
  accessType,
  permission,
  recipientCount,
}: {
  accessType: AccessType;
  permission: PermissionRole;
  recipientCount: number;
}) => {
  if (accessType === "public") {
    if (permission !== "viewer") {
      throw new AppError(
        "Public share links can only use viewer permission",
        400,
      );
    }

    if (recipientCount !== 0) {
      throw new AppError("Public share links cannot have recipients", 400);
    }

    return;
  }

  if (recipientCount === 0) {
    throw new AppError(
      "Restricted share links require at least one recipient",
      400,
    );
  }
};

const normalizeRecipientEmails = (emails: string[]) => {
  if (!Array.isArray(emails)) {
    throw new AppError("recipientEmails must be an array", 400);
  }

  if (emails.length > MAX_RECIPIENTS) {
    throw new AppError(
      `A share link can have at most ${MAX_RECIPIENTS} recipients`,
      400,
    );
  }

  const seen = new Set<string>();

  return emails.map((email) => {
    const normalized = email.trim().toLowerCase();

    if (!normalized) {
      throw new AppError("Recipient email cannot be empty", 400);
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      throw new AppError(`Invalid recipient email: ${email}`, 400);
    }

    if (seen.has(normalized)) {
      throw new AppError("Duplicate recipient email", 409);
    }

    seen.add(normalized);

    return normalized;
  });
};

const getShareableResource = async ({
  ownerId,
  resourceType,
  resourceId,
}: {
  ownerId: string;
  resourceType: ResourceType;
  resourceId: string;
}) => {
  if (!mongoose.isValidObjectId(resourceId)) {
    throw new AppError("Resource not found", 404);
  }

  if (resourceType === "file") {
    const file = await File.findOne({
      _id: resourceId,
      userId: ownerId,
      status: "ready",
      deletedAt: null,
    })
      .select("_id name mimeType size userId directoryId createdAt updatedAt")
      .lean();

    if (!file) {
      throw new AppError("File not found", 404);
    }

    const parent = await Directory.findOne({
      _id: file.directoryId,
      userId: ownerId,
      deletedAt: null,
    })
      .select("_id")
      .lean();

    if (!parent) {
      throw new AppError("File is no longer available", 404);
    }

    return file;
  }

  const directory = await Directory.findOne({
    _id: resourceId,
    userId: ownerId,
    deletedAt: null,
  })
    .select(
      "_id name parentDirectoryId userId createdBy size deletedAt createdAt updatedAt",
    )
    .lean();

  if (!directory) {
    throw new AppError("Directory not found", 404);
  }

  return directory;
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const lookupActiveShareRecipient = async ({
  email,
}: {
  email: string;
}) => {
  const normalizedEmail = normalizeEmail(email);

  const user = await User.findOne({
    email: normalizedEmail,
    status: "active",
  })
    .collation({ locale: "en", strength: 2 })
    .select("_id name email status")
    .lean();

  if (!user) {
    throw new AppError(
      "No active Storiffy user was found with this email address",
      404,
    );
  }

  return {
    name: user.name,
    email: user.email,
  };
};

const getRecipients = async (shareLinkId: mongoose.Types.ObjectId) => {
  const rows = await ShareLinkRecipient.find({ shareLinkId })
    .select("userId")
    .lean();

  if (rows.length === 0) return [];

  const users = await User.find({
    _id: { $in: rows.map((row) => row.userId) },
  })
    .select("_id name email status")
    .lean();

  const map = new Map(users.map((user) => [user._id.toString(), user]));

  return rows
    .map((row) => map.get(row.userId.toString()))
    .filter(Boolean)
    .map((user) => ({
      _id: user!._id.toString(),
      name: user!.name,
      email: user!.email,
      status: user!.status,
    }));
};

const validateRecipientsByEmail = async ({
  recipientEmails,
  session,
}: {
  recipientEmails: string[];
  session?: mongoose.ClientSession;
}) => {
  const emails = normalizeRecipientEmails(recipientEmails);

  const query = User.find({
    email: {
      $in: emails,
    },
    status: "active",
  })
    .select("_id name email status")
    .collation({
      locale: "en",
      strength: 2,
    });

  if (session) {
    query.session(session);
  }

  const users = await query.lean();

  if (users.length !== emails.length) {
    throw new AppError(
      "One or more recipients are not active Storiffy users",
      422,
    );
  }

  const map = new Map(users.map((user) => [user.email.toLowerCase(), user]));

  const orderedUsers = emails.map((email) => {
    const user = map.get(email);

    if (!user) {
      throw new AppError(`No active Storiffy user found for ${email}`, 422);
    }

    return user;
  });

  return orderedUsers.map((user) => ({
    _id: user._id,
    name: user.name,
    email: user.email,
    status: user.status,
  }));
};

const serializeResource = (resource: any, resourceType: ResourceType) =>
  resourceType === "file"
    ? {
        _id: resource._id.toString(),
        name: resource.name,
        mimeType: resource.mimeType,
        size: resource.size,
        type: "file" as const,
      }
    : {
        _id: resource._id.toString(),
        name: resource.name,
        size: resource.size,
        type: "directory" as const,
      };

const serializeShare = ({
  share,
  recipients,
  resource,
}: {
  share: ShareLinkI;
  recipients: Array<{
    _id: mongoose.Types.ObjectId | string;
    name: string;
    email: string;
    status?: string;
  }>;
  resource: unknown;
}) => ({
  id: share._id.toString(),
  token: share.token,
  url: buildSharePath({
    accessType: share.accessType,
    token: share.token,
  }),
  resourceType: share.resourceType,
  resourceId: share.resourceId.toString(),
  accessType: share.accessType,
  permission: share.permission,
  expiresAt: share.expiresAt,
  createdAt: share.createdAt,
  updatedAt: share.updatedAt,
  recipients: recipients.map((recipient) => ({
    _id: recipient._id.toString(),
    name: recipient.name,
    email: recipient.email,
    ...(recipient.status ? { status: recipient.status } : {}),
  })),
  resource: serializeResource(resource, share.resourceType),
});

const createWithUniqueToken = async <T>(
  operation: (token: string) => Promise<T>,
) => {
  let lastError: unknown;

  for (let attempt = 0; attempt < TOKEN_CREATION_ATTEMPTS; attempt += 1) {
    try {
      return await operation(createShareToken());
    } catch (error) {
      lastError = error;
      if (!isDuplicateKeyError(error)) throw error;
    }
  }

  throw lastError ?? new AppError("Failed to create share link", 500);
};

export const lookupShareRecipient = async ({ email }: { email: string }) => {
  const normalizedEmail = email.trim().toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new AppError("Please enter a valid email address", 400);
  }

  const user = await User.findOne({
    email: normalizedEmail,
    status: "active",
  })
    .select("_id name email status")
    .collation({
      locale: "en",
      strength: 2,
    })
    .lean();

  if (!user) {
    throw new AppError(
      "No active Storiffy user was found with this email address",
      404,
    );
  }

  return {
    name: user.name,
    email: user.email,
  };
};

export const createPublicShare = async ({
  ownerId,
  resourceType,
  resourceId,
  duration,
}: {
  ownerId: string;
  resourceType: ResourceType;
  resourceId: string;
  duration: ShareDuration;
}) => {
  assertResourceType(resourceType);
  assertDuration(duration);
  assertConfiguration({
    accessType: "public",
    permission: "viewer",
    recipientCount: 0,
  });

  const resource = await getShareableResource({
    ownerId,
    resourceType,
    resourceId,
  });

  const expiresAt = calculateShareExpiry(duration);

  return createWithUniqueToken(async (token) => {
    const share = await ShareLink.create({
      token,
      resourceType,
      resourceId: new mongoose.Types.ObjectId(resourceId),
      ownerId: new mongoose.Types.ObjectId(ownerId),
      accessType: "public",
      permission: "viewer",
      expiresAt,
    });

    return serializeShare({
      share,
      recipients: [],
      resource,
    });
  });
};

export const createRestrictedShare = async ({
  ownerId,
  resourceType,
  resourceId,
  permission,
  recipientEmails,
  duration,
}: {
  ownerId: string;
  resourceType: ResourceType;
  resourceId: string;
  permission: PermissionRole;
  recipientEmails: string[];
  duration: ShareDuration;
}) => {
  assertResourceType(resourceType);
  assertDuration(duration);

  const normalizedEmails = normalizeRecipientEmails(recipientEmails);

  assertConfiguration({
    accessType: "restricted",
    permission,
    recipientCount: normalizedEmails.length,
  });

  const resource = await getShareableResource({
    ownerId,
    resourceType,
    resourceId,
  });

  const expiresAt = calculateShareExpiry(duration);

  return createWithUniqueToken(async (token) => {
    const session = await mongoose.startSession();

    try {
      let createdShare: ShareLinkI | null = null;

      let recipients: Array<{
        _id: mongoose.Types.ObjectId;
        name: string;
        email: string;
        status: string;
      }> = [];

      await session.withTransaction(async () => {
        recipients = await validateRecipientsByEmail({
          recipientEmails: normalizedEmails,
          session,
        });

        const [share] = await ShareLink.create(
          [
            {
              token,
              resourceType,
              resourceId: new mongoose.Types.ObjectId(resourceId),
              ownerId: new mongoose.Types.ObjectId(ownerId),
              accessType: "restricted",
              permission,
              expiresAt,
            },
          ],
          { session },
        );

        if (!share) {
          throw new AppError("Failed to create share link", 500);
        }

        createdShare = share.toObject() as ShareLinkI;

        await ShareLinkRecipient.insertMany(
          recipients.map((user) => ({
            shareLinkId: share._id,
            userId: user._id,
          })),
          { session },
        );
      });

      if (!createdShare) {
        throw new AppError("Failed to create share link", 500);
      }

      return serializeShare({
        share: createdShare,
        recipients,
        resource,
      });
    } finally {
      await session.endSession();
    }
  });
};

export const getShareLinkForOwner = async ({
  ownerId,
  shareId,
}: {
  ownerId: string;
  shareId: string;
}) => {
  if (!mongoose.isValidObjectId(shareId)) {
    throw new AppError("Share link not found", 404);
  }

  const share = await ShareLink.findById(shareId).lean();

  if (!share) throw new AppError("Share link not found", 404);

  if (share.ownerId.toString() !== ownerId) {
    throw new AppError("You are not allowed to manage this share link", 403);
  }

  const resource = await getShareableResource({
    ownerId,
    resourceType: share.resourceType,
    resourceId: share.resourceId.toString(),
  });

  return serializeShare({
    share,
    recipients: await getRecipients(share._id),
    resource,
  });
};

export const updateShareLink = async ({
  ownerId,
  shareId,
  accessType,
  permission,
  recipientEmails,
  duration,
}: {
  ownerId: string;
  shareId: string;
  accessType?: AccessType;
  permission?: PermissionRole;
  recipientEmails?: string[];
  duration?: ShareDuration;
}) => {
  if (!mongoose.isValidObjectId(shareId)) {
    throw new AppError("Share link not found", 404);
  }

  if (duration !== undefined) {
    assertDuration(duration);
  }

  const session = await mongoose.startSession();

  try {
    const transactionResult = await session.withTransaction(async () => {
      const share = await ShareLink.findById(shareId).session(session);

      if (!share) {
        throw new AppError("Share link not found", 404);
      }

      if (share.ownerId.toString() !== ownerId) {
        throw new AppError(
          "You are not allowed to manage this share link",
          403,
        );
      }

      if (share.expiresAt.getTime() <= Date.now()) {
        throw new AppError(
          "Expired share links cannot be renewed; create a new share link",
          410,
        );
      }

      const nextAccessType = accessType ?? share.accessType;

      if (
        nextAccessType === "public" &&
        permission !== undefined &&
        permission !== "viewer"
      ) {
        throw new AppError(
          "Public share links can only use viewer permission",
          400,
        );
      }

      if (
        nextAccessType === "public" &&
        recipientEmails !== undefined &&
        recipientEmails.length > 0
      ) {
        throw new AppError("Public share links cannot have recipients", 400);
      }

      const nextPermission =
        nextAccessType === "public"
          ? "viewer"
          : (permission ?? share.permission);

      let recipients: Array<{
        _id: mongoose.Types.ObjectId;
        name: string;
        email: string;
        status: string;
      }> = [];

      if (nextAccessType === "restricted") {
        if (recipientEmails !== undefined) {
          recipients = await validateRecipientsByEmail({
            recipientEmails,
            session,
          });
        } else {
          const currentRows = await ShareLinkRecipient.find({
            shareLinkId: share._id,
          })
            .select("userId")
            .session(session)
            .lean();

          const currentRecipientIds = currentRows.map((row) =>
            row.userId.toString(),
          );

          if (currentRecipientIds.length > 0) {
            const users = await User.find({
              _id: {
                $in: currentRecipientIds,
              },
              status: "active",
            })
              .select("_id name email status")
              .session(session)
              .lean();

            if (users.length !== currentRecipientIds.length) {
              throw new AppError(
                "One or more existing recipients are no longer active Storiffy users",
                422,
              );
            }

            const userMap = new Map(
              users.map((user) => [user._id.toString(), user]),
            );

            recipients = currentRecipientIds.map((id) => {
              const user = userMap.get(id);

              if (!user) {
                throw new AppError(
                  "One or more existing recipients are no longer active Storiffy users",
                  422,
                );
              }

              return {
                _id: user._id,
                name: user.name,
                email: user.email,
                status: user.status,
              };
            });
          }
        }
      }

      assertConfiguration({
        accessType: nextAccessType,
        permission: nextPermission,
        recipientCount: recipients.length,
      });

      if (duration !== undefined) {
        share.expiresAt = calculateShareExpiry(duration);
      }

      share.accessType = nextAccessType;
      share.permission = nextPermission;

      await share.save({ session });

      await ShareLinkRecipient.deleteMany(
        {
          shareLinkId: share._id,
        },
        {
          session,
        },
      );

      if (nextAccessType === "restricted" && recipients.length > 0) {
        await ShareLinkRecipient.insertMany(
          recipients.map((user) => ({
            shareLinkId: share._id,
            userId: user._id,
          })),
          {
            session,
          },
        );
      }

      return {
        share,
        recipients,
      };
    });

    if (!transactionResult) {
      throw new AppError("Failed to update share link", 500);
    }

    const resource = await getShareableResource({
      ownerId,
      resourceType: transactionResult.share.resourceType,
      resourceId: transactionResult.share.resourceId.toString(),
    });

    return serializeShare({
      share: transactionResult.share,
      recipients: transactionResult.recipients,
      resource,
    });
  } finally {
    await session.endSession();
  }
};

export const revokeShareLink = async ({
  ownerId,
  shareId,
}: {
  ownerId: string;
  shareId: string;
}) => {
  if (!mongoose.isValidObjectId(shareId)) {
    throw new AppError("Share link not found", 404);
  }

  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      const share = await ShareLink.findById(shareId).session(session);

      if (!share) throw new AppError("Share link not found", 404);

      if (share.ownerId.toString() !== ownerId) {
        throw new AppError(
          "You are not allowed to manage this share link",
          403,
        );
      }

      await ShareLinkRecipient.deleteMany(
        { shareLinkId: share._id },
        { session },
      );

      await ShareLink.deleteOne({ _id: share._id }, { session });
    });
  } finally {
    await session.endSession();
  }

  return {
    shareId,
    revoked: true,
  };
};

export const listMyShares = async (ownerId: string) => {
  const shares = await ShareLink.find({
    ownerId,
    expiresAt: { $gt: new Date() },
  })
    .sort({ createdAt: -1 })
    .lean();

  const result: unknown[] = [];

  for (const share of shares) {
    try {
      const resource = await getShareableResource({
        ownerId,
        resourceType: share.resourceType,
        resourceId: share.resourceId.toString(),
      });

      result.push(
        serializeShare({
          share,
          recipients: await getRecipients(share._id),
          resource,
        }),
      );
    } catch {
      // Never expose an active-looking link for a removed/trashed resource.
    }
  }

  return result;
};

export const listSharesWithMe = async (userId: string) => {
  if (!mongoose.isValidObjectId(userId)) return [];

  const recipientRows = await ShareLinkRecipient.find({
    userId,
  })
    .select("shareLinkId")
    .lean();

  if (recipientRows.length === 0) return [];

  const shares = await ShareLink.find({
    _id: { $in: recipientRows.map((row) => row.shareLinkId) },
    accessType: "restricted",
    expiresAt: { $gt: new Date() },
  })
    .sort({ createdAt: -1 })
    .lean();

  const result: unknown[] = [];

  for (const share of shares) {
    try {
      const owner = await User.findOne({
        _id: share.ownerId,
        status: "active",
      })
        .select("_id name email")
        .lean();

      if (!owner) continue;

      const resource = await getShareableResource({
        ownerId: share.ownerId.toString(),
        resourceType: share.resourceType,
        resourceId: share.resourceId.toString(),
      });

      result.push({
        ...serializeShare({
          share,
          recipients: [],
          resource,
        }),
        owner: {
          _id: owner._id.toString(),
          name: owner.name,
          email: owner.email,
        },
      });
    } catch {
      // Invalid resource/state is not returned.
    }
  }

  return result;
};
