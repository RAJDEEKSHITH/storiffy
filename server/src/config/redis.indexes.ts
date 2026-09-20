import redisClient, { connectRedis } from "./redis.js";

const INDEX_NAME = "userIdIdx";

const createIndexes = async () => {
  await connectRedis();
  const indexes = await redisClient.ft._list();

  if (indexes.includes(INDEX_NAME)) {
    console.log(`Redis index "${INDEX_NAME}" already exists`);
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
  console.log(`Redis index "${INDEX_NAME}" created successfully`);
  await redisClient.quit();
};

createIndexes().catch(async (error) => {
  console.error("Failed to create Redis indexes:", error);
  await redisClient.quit();
  process.exit(1);
});
