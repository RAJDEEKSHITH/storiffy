import crypto from "node:crypto";

import redisClient from "../../config/redis.js";

const SESSION_TTL = 60 * 60 * 24 * 7; // 7 days
const MAX_SESSIONS = 2;

export interface SessionData {
  userId: string;
  createdAt: number;
}

export const createSession = async (userId: string) => {
  const sessionId = crypto.randomUUID();

  const key = `session:${sessionId}`;

  await redisClient.json.set(key, "$", {
    userId,
    createdAt: Date.now(),
  });

  await redisClient.expire(key, SESSION_TTL);

  return sessionId;
};

export const getSession = async (
  sessionId: string,
): Promise<SessionData | null> => {
  const session = await redisClient.json.get(`session:${sessionId}`);

  return session as SessionData | null;
};

export const deleteSession = async (sessionId: string) => {
  await redisClient.del(`session:${sessionId}`);
};

export const enforceSessionLimit = async (userId: string) => {
  const sessions = await redisClient.ft.search(
    "userIdIdx",
    `@userId:{${userId}}`,
    {
      SORTBY: "createdAt",
      LIMIT: {
        from: 0,
        size: 1,
      },
      RETURN: [],
    },
  );

  if (sessions.total >= MAX_SESSIONS) {
    const oldestSession = sessions.documents[0];

    if (oldestSession) {
      await redisClient.del(oldestSession.id);
    }
  }
};

export const SESSION_TTL_MS = SESSION_TTL * 1000;
