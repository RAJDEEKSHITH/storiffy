import * as z from "zod";

const objectId = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid ID");

export const fileIdParamsSchema = z.object({
  id: objectId,
});

export const initiateUploadSchema = z.object({
  directoryId: objectId,
  name: z
    .string()
    .trim()
    .min(1, "File name is required")
    .max(255, "File name is too long"),
  size: z
    .number()
    .int()
    .positive("File size must be greater than 0"),
  mimeType: z
    .string()
    .trim()
    .min(1, "MIME type is required")
    .max(255, "MIME type is too long"),
});

export const generatePartUrlSchema = z.object({
  partNumber: z
    .number()
    .int()
    .positive("Part number must be greater than 0"),
});


export const completeMultipartUploadSchema = z.object({
  parts: z
    .array(
      z.object({
        partNumber: z.number().int().positive(),
        eTag: z.string().trim().min(1),
      }),
    )
    .min(1, "At least one part is required"),
});

export const getFileUrlSchema = z.object({
  download: z.boolean().default(false),
});

export const renameFileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "File name is required")
    .max(255, "File name is too long"),
});