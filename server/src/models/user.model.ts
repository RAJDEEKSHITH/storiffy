import mongoose, { Schema } from "mongoose";

export interface UserI {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;

  // roles
  role: "user" | "admin" | "manager";

  // null for Google-only accounts
  passwordHash: string | null;

  // null for users who have not linked Google
  googleId: string | null;

  picture : string | null;
  // Current effective plan.
  // "free" initially, paid plans later.
  plan: string;

  // Values are stored in bytes.
  maxStorageLimitInBytes: number;
  storageUsedInBytes: number;

  status: "active" | "disabled" | "deleted";

  rootDirectoryId: mongoose.Types.ObjectId;

  createdAt?: Date;
  updatedAt?: Date;
}

const userSchema = new Schema<UserI>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    passwordHash: {
      type: String,
      default: null,
    },
    role: {
      type: String,
      enum: ["user", "manager", "admin"],
      default: "user",
    },
    googleId: {
      type: String,
      default: null,
    },
    picture : {
      type : String,
      default : null
    },
    plan: {
      type: String,
      default: "free",
    },
    maxStorageLimitInBytes: {
      type: Number,
      required: true,
      default: 1 * 1024 * 1024 * 1024, // 1 GB
    },
    storageUsedInBytes: {
      type: Number,
      required: true,
      default: 0,
    },
    status: {
      type: String,
      enum: ["active", "disabled", "deleted"],
      default: "active",
    },
    rootDirectoryId: {
      type: Schema.Types.ObjectId,
      ref: "Directory",
      required: true,
    },
  },
  {
    timestamps: true,
    strict: "throw",
  },
);

userSchema.index(
  { googleId: 1 },
  {
    unique: true,
    sparse: true,
  },
);

const User = mongoose.model<UserI>("User", userSchema);

export default User;
