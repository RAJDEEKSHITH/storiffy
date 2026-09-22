import mongoose from "mongoose";

import File from "../../models/file.model.js";
import User from "../../models/user.model.js";

/*
 * storageUsedInBytes is a reservation counter.
 *
 * Every File document represents reserved storage until that document is
 * permanently removed. This includes trashed files and temporary upload
 * records (uploading/finalizing/failed).
 *
 * Therefore the consistency invariant is:
 *
 *   User.storageUsedInBytes === SUM(File.size for that user)
 */

export const reconcileUserStorageUsage = async (
  userId: string,
) => {
  const [aggregate, user] = await Promise.all([
    File.aggregate<{ _id: null; total: number }>([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
        },
      },
      {
        $group: {
          _id: null,
          total: {
            $sum: "$size",
          },
        },
      },
    ]),

    User.findById(userId)
      .select("storageUsedInBytes")
      .lean(),
  ]);

  if (!user) {
    return {
      userId,
      repaired: false,
      reason: "user-not-found" as const,
    };
  }

  const actualStorage = aggregate[0]?.total ?? 0;

  if (user.storageUsedInBytes === actualStorage) {
    return {
      userId,
      repaired: false,
      previous: user.storageUsedInBytes,
      actual: actualStorage,
    };
  }

  /*
   * Conditional update prevents the reconciliation pass from overwriting a
   * legitimate upload/delete change that happened after our read.
   * If the value changed concurrently, the next reconciliation pass will
   * retry with fresh data.
   */
  const result = await User.updateOne(
    {
      _id: userId,
      storageUsedInBytes: user.storageUsedInBytes,
    },
    {
      $set: {
        storageUsedInBytes: actualStorage,
      },
    },
  );

  if (result.modifiedCount === 0) {
    return {
      userId,
      repaired: false,
      skippedBecauseOfConcurrentChange: true,
      previous: user.storageUsedInBytes,
      actual: actualStorage,
    };
  }

  console.warn("Repaired storage usage mismatch", {
    userId,
    previous: user.storageUsedInBytes,
    actual: actualStorage,
  });

  return {
    userId,
    repaired: true,
    previous: user.storageUsedInBytes,
    actual: actualStorage,
  };
};

export const reconcileAllStorageUsage = async () => {
  let scannedUsers = 0;
  let repairedUsers = 0;

  const cursor = User.find({})
    .select("_id")
    .lean()
    .cursor();

  try {
    for await (const user of cursor) {
      scannedUsers += 1;

      const result =
        await reconcileUserStorageUsage(
          user._id.toString(),
        );

      if (result.repaired) {
        repairedUsers += 1;
      }
    }
  } finally {
    await cursor.close();
  }

  return {
    scannedUsers,
    repairedUsers,
  };
};
