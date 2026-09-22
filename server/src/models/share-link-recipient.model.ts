import mongoose, { Schema, model } from "mongoose";

export interface ShareLinkRecipientI {
  _id: mongoose.Types.ObjectId;

  // Share link this recipient belongs to.
  shareLinkId: mongoose.Types.ObjectId;

  // Application user who is allowed to access the
  // restricted share link.
  userId: mongoose.Types.ObjectId;

  createdAt?: Date;
  updatedAt?: Date;
}

const shareLinkRecipientSchema = new Schema<ShareLinkRecipientI>(
  {
    shareLinkId: {
      type: Schema.Types.ObjectId,
      ref: "ShareLink",
      required: true,
    },

    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
    strict: "throw",
  },
);

shareLinkRecipientSchema.index(
  {
    shareLinkId: 1,
    userId: 1,
  },
  {
    unique: true,
  },
);

shareLinkRecipientSchema.index({
  userId: 1,
  shareLinkId: 1,
});

const ShareLinkRecipient = model<ShareLinkRecipientI>(
  "ShareLinkRecipient",
  shareLinkRecipientSchema,
);

export default ShareLinkRecipient;
