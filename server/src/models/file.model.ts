import mongoose, { Schema, model } from "mongoose";

export type FileStatus =
  | "uploading"
  | "finalizing"
  | "ready"
  | "failed";

export interface FileI {
  _id: mongoose.Types.ObjectId;
  name: string;

  // Permanent owner of the file.
  userId: mongoose.Types.ObjectId;

  // User who actually created/uploaded the file.
  createdBy: mongoose.Types.ObjectId;

  directoryId: mongoose.Types.ObjectId;

  storageKey: string;
  mimeType: string;
  size: number;

  status: FileStatus;

  deletedAt: Date | null;

  // Present only while an S3 multipart upload is active.
  uploadId: string | null;

  // Lease used to recover uploads abandoned by the browser/client.
  // Null means no temporary upload operation is active.
  uploadExpiresAt: Date | null;

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

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      default: function (this: Pick<FileI, "userId">) {
        return this.userId;
      },
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
      min: 0,
    },

    status: {
      type: String,
      enum: [
        "uploading",
        "finalizing",
        "ready",
        "failed",
      ],
      default: "uploading",
      required: true,
    },

    deletedAt: {
      type: Date,
      default: null,
    },

    uploadId: {
      type: String,
      default: null,
    },

    uploadExpiresAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    strict: "throw",
  },
);

/* Owner directory listing. */
fileSchema.index({
  userId: 1,
  directoryId: 1,
  deletedAt: 1,
  updatedAt: -1,
});

/* Shared-editor authorization/deletion queries. */
fileSchema.index({
  userId: 1,
  createdBy: 1,
  status: 1,
  deletedAt: 1,
});

/* Background abandoned-upload cleanup. */
fileSchema.index({
  status: 1,
  uploadExpiresAt: 1,
});

const File = model<FileI>("File", fileSchema);

export default File;
