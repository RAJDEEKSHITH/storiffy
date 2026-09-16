import mongoose, { Schema, model } from "mongoose";

export interface DirectoryI {
  _id: mongoose.Types.ObjectId;
  name: string;
  parentDirectoryId: mongoose.Types.ObjectId | null;
  userId: mongoose.Types.ObjectId;
  size: number;
  deletedAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

const directorySchema = new Schema<DirectoryI>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    size: {
      type: Number,
      required: true,
      default: 0,
    },
    parentDirectoryId: {
      type: Schema.Types.ObjectId,
      ref: "Directory",
      default: null,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
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

const Directory = model<DirectoryI>("Directory", directorySchema);

export default Directory;
