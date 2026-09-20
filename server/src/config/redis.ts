import { createClient } from "redis";
import { env } from "./env.js";

const redisClient = createClient({
  url: env.REDIS_URL!,
});

redisClient.on("error", (error) => {
  console.error("Redis error:", error);
});

export const connectRedis = async () => {
  await redisClient.connect();

  console.log("Redis connected");
};

export default redisClient;
