import redisClient, { connectRedis } from "./redis.js";

const INDEX_NAME = "userIdIdx";

const createIndexes = async () => {
  await connectRedis();
  const indexes = await redisClient.ft._list();

  if (indexes.includes(INDEX_NAME)) {
    console.log("Redis indexes already exist");
    await redisClient.quit();
    return;
  }

  await redisClient.ft.create(
    INDEX_NAME,
    {
      "$.userId": {
        type: "TAG",
        AS: "userId",
      },
      "$.createdAt": {
        type: "NUMERIC",
        AS: "createdAt",
        SORTABLE: true,
      },
    },
    {
      ON: "JSON",
      PREFIX: "session:",
    },
  );
  console.log("Redis session index created");
  await redisClient.quit();
};

createIndexes().catch(async (error) => {
  console.error("Failed to create Redis indexes:", error);
  await redisClient.quit();
  process.exit(1);
});
