import crypto from "node:crypto";

export const SHARE_DURATIONS = {
  "1h": 60 * 60 * 1000,
  "3h": 3 * 60 * 60 * 1000,
  "5h": 5 * 60 * 60 * 1000,
  "12h": 12 * 60 * 60 * 1000,
  "1d": 24 * 60 * 60 * 1000,
  "3d": 3 * 24 * 60 * 60 * 1000,
  "5d": 5 * 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
} as const;

export type ShareDuration = keyof typeof SHARE_DURATIONS;

export const SHARE_MAX_DURATION_MS = SHARE_DURATIONS["7d"];

export const createShareToken = () =>
  crypto.randomBytes(32).toString("base64url");

export const getDurationMs = (duration: ShareDuration) =>
  SHARE_DURATIONS[duration];

export const calculateShareExpiry = (
  duration: ShareDuration,
  now = Date.now(),
) => new Date(now + getDurationMs(duration));

export const buildSharePath = ({
  accessType,
  token,
}: {
  accessType: "public" | "restricted";
  token: string;
}) => `/share/${accessType}/${token}`;

export const isValidShareTokenFormat = (token: string) =>
  /^[A-Za-z0-9_-]{40,100}$/.test(token);
