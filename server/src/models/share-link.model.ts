  import mongoose, { Schema, model } from "mongoose";

  export type ResourceType = "file" | "directory";

  export type AccessType = "public" | "restricted";

  export type PermissionRole = "viewer" | "editor";

  export interface ShareLinkI {
    _id: mongoose.Types.ObjectId;

    token: string;

    // Resource being shared.
    resourceType: ResourceType;
    resourceId: mongoose.Types.ObjectId;

    // Owner of the resource/share.
    ownerId: mongoose.Types.ObjectId;

    // Public or restricted.
    accessType: AccessType;

    // Viewer or editor.
    permission: PermissionRole;

    // ShareLink always has an expiry.
    // Maximum allowed duration is enforced by the service.
    expiresAt: Date;

    createdAt?: Date;
    updatedAt?: Date;
  }

  const shareLinkSchema = new Schema<ShareLinkI>(
    {
      token: {
        type: String,
        required: true,
        unique: true,
      },

      resourceType: {
        type: String,
        enum: ["file", "directory"],
        required: true,
      },

      resourceId: {
        type: Schema.Types.ObjectId,
        required: true,
      },

      ownerId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },

      accessType: {
        type: String,
        enum: ["public", "restricted"],
        required: true,
      },

      permission: {
        type: String,
        enum: ["viewer", "editor"],
        required: true,
      },

      expiresAt: {
        type: Date,
        required: true,
      },
    },
    {
      timestamps: true,
      strict: "throw",
    },
  );

  shareLinkSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

  shareLinkSchema.index({
    ownerId: 1,
    expiresAt: 1,
  });

  shareLinkSchema.index({
    resourceType: 1,
    resourceId: 1,
  });

  const ShareLink = model<ShareLinkI>("ShareLink", shareLinkSchema);

  export default ShareLink;
