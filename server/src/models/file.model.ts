import mongoose, { Schema, model } from "mongoose";

export interface FileI {
  _id: mongoose.Types.ObjectId;
  name: string;

  userId: mongoose.Types.ObjectId;
  directoryId: mongoose.Types.ObjectId;

  storageKey: string;

  mimeType: string;
  size: number;

  status: "uploading" | "ready" | "failed";

  deletedAt: Date | null;

  createdAt?: Date;
  updatedAt?: Date;
}

const fileSchema = new Schema<FileI>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    directoryId: {
      type: Schema.Types.ObjectId,
      ref: "Directory",
      required: true,
    },
    storageKey: {
      type: String,
      required: true,
      unique: true,
    },

    mimeType: {
      type: String,
      required: true,
    },

    size: {
      type: Number,
      required: true,
    },

    status: {
      type: String,
      enum: ["uploading", "ready", "failed"],
      default: "ready",
    },

    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    strict: "throw",
  },
);

fileSchema.index({
  userId: 1,
  directoryId: 1,
});

const File = model<FileI>("File", fileSchema);

export default File;
