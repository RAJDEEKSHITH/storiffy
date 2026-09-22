import { z } from "zod";

const objectId = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid ObjectId");

export const shareTokenParamsSchema = z
  .object({
    token: z
      .string()
      .min(40)
      .max(100)
      .regex(/^[A-Za-z0-9_-]+$/, "Invalid share token"),
  })
  .strict();

export const sharedDirectoryParamsSchema = z
  .object({
    token: z.string().min(40).max(100),
    directoryId: objectId,
  })
  .strict();

export const sharedDirectoryParentParamsSchema = z
  .object({
    token: z.string().min(40).max(100),
    parentDirectoryId: objectId,
  })
  .strict();

export const sharedFileParamsSchema = z
  .object({
    token: z.string().min(40).max(100),
    fileId: objectId,
  })
  .strict();

export const sharedRenameSchema = z
  .object({
    name: z.string().trim().min(1).max(255),
  })
  .strict();

export const sharedCreateDirectorySchema = z
  .object({
    name: z.string().trim().min(1).max(255),
  })
  .strict();

export const sharedInitiateUploadSchema = z
  .object({
    directoryId: objectId,
    name: z.string().trim().min(1).max(255),
    size: z.number().int().nonnegative(),
    mimeType: z.string().trim().min(1).max(255),
  })
  .strict();

export const sharedPartUrlParamsSchema = z
  .object({
    token: z.string().min(40).max(100),
    id: objectId,
  })
  .strict();

export const sharedPartUrlBodySchema = z
  .object({
    partNumber: z.number().int().min(1),
  })
  .strict();

export const sharedCompleteMultipartSchema = z
  .object({
    parts: z
      .array(
        z
          .object({
            partNumber: z.number().int().min(1),
            eTag: z.string().min(1),
          })
          .strict(),
      )
      .min(1),
  })
  .strict();
