import * as z from "zod";

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid ID");

export const directoryParamsSchema = z.object({ id: objectId });

export const createDirectorySchema = z.object({
  parentDirectoryId: objectId,
  name: z.string().trim().max(255).default(""),
});

export const renameDirectorySchema = z.object({
  name: z.string().trim().min(1).max(255),
});
