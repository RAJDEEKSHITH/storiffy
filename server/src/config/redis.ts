import { createClient } from "redis";

const redisClient = createClient({
  url: process.env.REDIS_URL!,
});

redisClient.on("error", (error) => {
  console.error("Redis error:", error);
});

export const connectRedis = async () => {
  await redisClient.connect();

  console.log("Redis connected");
};

export default redisClient;
