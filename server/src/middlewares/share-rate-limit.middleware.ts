import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";

interface Bucket {
  count: number;
  resetAt: number;
}

const WINDOW_MS = 60 * 1000;
const MAX_PER_IP = 120;
const MAX_PER_TOKEN = 60;
const MAX_BUCKETS = 20_000;

const buckets = new Map<string, Bucket>();
let lastCleanupAt = 0;

const cleanupExpiredBuckets = (now: number) => {
  if (now - lastCleanupAt < WINDOW_MS) return;

  lastCleanupAt = now;

  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
};

const hashToken = (token: string) =>
  crypto.createHash("sha256").update(token).digest("hex");

const take = (key: string, limit: number) => {
  const now = Date.now();
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, {
      count: 1,
      resetAt: now + WINDOW_MS,
    });

    return {
      allowed: true,
      retryAfter: Math.ceil(WINDOW_MS / 1000),
    };
  }

  if (current.count >= limit) {
    return {
      allowed: false,
      retryAfter: Math.max(
        1,
        Math.ceil((current.resetAt - now) / 1000),
      ),
    };
  }

  current.count += 1;

  return {
    allowed: true,
    retryAfter: Math.max(
      1,
      Math.ceil((current.resetAt - now) / 1000),
    ),
  };
};

export const shareRateLimit = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const now = Date.now();
  cleanupExpiredBuckets(now);

  if (buckets.size > MAX_BUCKETS) {
    // Remove any expired buckets before deciding whether to fail closed.
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) {
        buckets.delete(key);
      }

      if (buckets.size <= MAX_BUCKETS) break;
    }

    if (buckets.size > MAX_BUCKETS) {
      return res.status(429).json({
        success: false,
        message: "Too many share requests. Please try again later.",
      });
    }
  }

  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const ipResult = take(`ip:${ip}`, MAX_PER_IP);

  if (!ipResult.allowed) {
    res.setHeader("Retry-After", ipResult.retryAfter.toString());

    return res.status(429).json({
      success: false,
      message: "Too many share requests. Please try again later.",
    });
  }

  const token = req.params.token;

  if (typeof token === "string" && token.length > 0) {
    const tokenResult = take(
      `token:${hashToken(token)}`,
      MAX_PER_TOKEN,
    );

    if (!tokenResult.allowed) {
      res.setHeader(
        "Retry-After",
        tokenResult.retryAfter.toString(),
      );

      return res.status(429).json({
        success: false,
        message: "Too many requests for this share link.",
      });
    }
  }

  return next();
};
