import ShareLink from "../../models/share-link.model.js";
import ShareLinkRecipient from "../../models/share-link-recipient.model.js";

/*
 * TTL removes expired ShareLink documents asynchronously. Because recipients
 * live in a separate collection, run this periodically from the existing
 * application cron/worker.
 */
export const cleanupShareLinkRecipients = async () => {
  const now = new Date();

  const expiredLinks = await ShareLink.find({
    expiresAt: { $lte: now },
  })
    .select("_id")
    .limit(5000)
    .lean();

  if (expiredLinks.length > 0) {
    await ShareLinkRecipient.deleteMany({
      shareLinkId: {
        $in: expiredLinks.map((share) => share._id),
      },
    });
  }

  const orphanRows = await ShareLinkRecipient.aggregate([
    {
      $lookup: {
        from: ShareLink.collection.name,
        localField: "shareLinkId",
        foreignField: "_id",
        as: "share",
      },
    },
    {
      $match: {
        $expr: {
          $eq: [{ $size: "$share" }, 0],
        },
      },
    },
    {
      $project: { _id: 1 },
    },
    { $limit: 5000 },
  ]);

  if (orphanRows.length > 0) {
    await ShareLinkRecipient.deleteMany({
      _id: { $in: orphanRows.map((row) => row._id) },
    });
  }

  return {
    expiredShareCount: expiredLinks.length,
    orphanRecipientRowsRemoved: orphanRows.length,
  };
};
