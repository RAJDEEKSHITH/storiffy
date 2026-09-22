import mongoose from "mongoose";

import File from "../models/file.model.js";
import {
  UPLOAD_LEASE_MS,
  cleanupExpiredUpload,
} from "../services/file/file.service.js";
import {
  reconcileAllStorageUsage,
} from "../services/file/storage-reconciliation.service.js";

const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const RECONCILIATION_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const BATCH_SIZE = 50;

let workerStarted = false;
let runInProgress = false;
let lastReconciliationAt = 0;

const initializeLegacyUploadLeases = async () => {
  const leaseExpiresAt = new Date(
    Date.now() + UPLOAD_LEASE_MS,
  );

  const result = await File.updateMany(
    {
      deletedAt: null,
      status: {
        $in: [
          "uploading",
          "finalizing",
          "failed",
        ],
      },
      uploadExpiresAt: null,
    },
    {
      $set: {
        uploadExpiresAt: leaseExpiresAt,
      },
    },
  );

  if (result.modifiedCount > 0) {
    console.log(
      `Initialized upload leases for ${result.modifiedCount} legacy upload(s)`,
    );
  }
};

const runMaintenancePass = async () => {
  if (mongoose.connection.readyState !== 1) {
    return;
  }

  if (runInProgress) {
    return;
  }

  runInProgress = true;

  try {
    const now = new Date();

    const staleUploads = await File.find({
      deletedAt: null,
      status: {
        $in: [
          "uploading",
          "finalizing",
          "failed",
        ],
      },
      uploadExpiresAt: {
        $lte: now,
      },
    })
      .select("_id userId")
      .sort({ uploadExpiresAt: 1 })
      .limit(BATCH_SIZE)
      .lean();

    for (const upload of staleUploads) {
      try {
        await cleanupExpiredUpload({
          userId: upload.userId.toString(),
          fileId: upload._id.toString(),
        });
      } catch (error) {
        console.error(
          "Upload maintenance cleanup failed:",
          {
            fileId: upload._id.toString(),
            userId: upload.userId.toString(),
            error,
          },
        );
      }
    }

    const nowMs = Date.now();

    if (
      nowMs - lastReconciliationAt >=
      RECONCILIATION_INTERVAL_MS
    ) {
      lastReconciliationAt = nowMs;

      try {
        const result =
          await reconcileAllStorageUsage();

        console.log(
          "Storage reconciliation completed",
          result,
        );
      } catch (error) {
        console.error(
          "Storage reconciliation failed:",
          error,
        );
      }
    }
  } finally {
    runInProgress = false;
  }
};

export const startUploadMaintenanceWorker = () => {
  if (workerStarted) {
    return;
  }

  workerStarted = true;

  void (async () => {
    try {
      await initializeLegacyUploadLeases();
      await runMaintenancePass();
    } catch (error) {
      console.error(
        "Initial upload maintenance pass failed:",
        error,
      );
    }
  })();

  const timer = setInterval(
    () => {
      void runMaintenancePass();
    },
    CLEANUP_INTERVAL_MS,
  );

  /*
   * The HTTP server itself keeps the Node process alive. The interval does
   * not need to be the reason the process remains alive during shutdown/tests.
   */
  timer.unref();
};
