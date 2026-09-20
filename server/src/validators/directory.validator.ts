import * as z from "zod";

const objectId = z
  .string()
  .regex(
    /^[0-9a-fA-F]{24}$/,
    "Invalid ID",
  );

export const directoryParamsSchema =
  z.object({
    id: objectId,
  });

export const createDirectorySchema =
  z.object({
    name: z
      .string()
      .trim()
      .max(
        255,
        "Folder name is too long",
      )
      .default(""),
  });

export const renameDirectorySchema =
  z.object({
    name: z
      .string()
      .trim()
      .min(
        1,
        "Folder name is required",
      )
      .max(
        255,
        "Folder name is too long",
      ),
  });