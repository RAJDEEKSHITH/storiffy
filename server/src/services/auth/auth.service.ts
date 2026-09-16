import bcrypt from "bcrypt";
import User from "../../models/user.model.js";
import type {
  LoginInput,
  RegisterInput,
} from "../../validators/auth.validator.js";
import { AppError } from "../../utils/app.error.js";
import mongoose from "mongoose";
import Directory from "../../models/directory.model.js";

export const registerUserWithEmail = async ({
  name,
  email,
  password,
}: RegisterInput) => {
  const mongooseSession = await mongoose.startSession();

  try {
    mongooseSession.startTransaction();

    const existingUser = await User.findOne({ email }, null, {
      session: mongooseSession,
    });

    if (existingUser) {
      throw new AppError("Email already registered", 409);
    }

    const userId = new mongoose.Types.ObjectId();
    const rootDirectoryId = new mongoose.Types.ObjectId();

    const passwordHash = await bcrypt.hash(password, 10);

    // Create root directory
    await Directory.create(
      [
        {
          _id: rootDirectoryId,
          name: `root-${email}`,
          userId,
          parentDirectoryId: null,
        },
      ],
      { session: mongooseSession },
    );

    // Create user
    const [user] = await User.create(
      [
        {
          _id: userId,
          name,
          email,
          passwordHash,
          rootDirectoryId,
        },
      ],
      { session: mongooseSession },
    );
    if (!user) {
      throw new AppError("Failed to create user", 500);
    }
    await mongooseSession.commitTransaction();

    return user;
  } catch (error) {
    if (mongooseSession.inTransaction()) {
      await mongooseSession.abortTransaction();
    }
    throw error;
  } finally {
    await mongooseSession.endSession();
  }
};

export const loginUserWithEmail = async ({ email, password }: LoginInput) => {
  const user = await User.findOne({ email });

  if (!user || !user.passwordHash) {
    throw new AppError("Invalid email or password", 401);
  }

  const passwordMatch = await bcrypt.compare(password, user.passwordHash);

  if (!passwordMatch) {
    throw new AppError("Invalid email or password", 401);
  }

  return user;
};
