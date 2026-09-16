import { z } from "zod";

export const directoryParamsSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid directory ID"),
});

export const createDirectorySchema = z.object({
  parentDirectoryId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, "Invalid parent directory ID"),

  name: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .default("New folder"),
});

export const renameDirectorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Folder name is required")
    .max(100, "Folder name is too long"),
});