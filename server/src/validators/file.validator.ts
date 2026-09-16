import { z } from "zod";

export const fileParamsSchema = z.object({
  id: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, "Invalid file ID"),
});

export const initiateUploadSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "File name is required")
    .max(255, "File name is too long"),

  size: z
    .number()
    .int()
    .positive("File size must be greater than zero"),

  mimeType: z
    .string()
    .min(1, "MIME type is required"),

  directoryId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, "Invalid directory ID"),
});

export const completeUploadSchema = z.object({
  fileId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, "Invalid file ID"),
});

export const renameFileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "File name is required")
    .max(255, "File name is too long"),
});