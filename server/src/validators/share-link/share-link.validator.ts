import * as z from "zod";

const objectId = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid ObjectId");

const email = z.email({
  error: "Invalid email address",
});

export const shareDurationSchema = z.enum([
  "1h",
  "3h",
  "5h",
  "12h",
  "1d",
  "3d",
  "5d",
  "7d",
]);

export const resourceTypeSchema = z.enum([
  "file",
  "directory",
]);

export const permissionSchema = z.enum([
  "viewer",
  "editor",
]);

const recipientEmailsSchema = z
  .array(email)
  .max(100)
  .default([]);

export const createPublicShareSchema = z
  .object({
    resourceType: resourceTypeSchema,
    resourceId: objectId,
    duration: shareDurationSchema,
  })
  .strict();

export const createRestrictedShareSchema = z
  .object({
    resourceType: resourceTypeSchema,
    resourceId: objectId,
    permission: permissionSchema,
    recipientEmails: z
      .array(email)
      .min(1)
      .max(100),
    duration: shareDurationSchema,
  })
  .strict();

export const updateShareLinkSchema = z
  .object({
    accessType: z
      .enum(["public", "restricted"])
      .optional(),

    permission: permissionSchema.optional(),

    recipientEmails: z
      .array(email)
      .max(100)
      .optional(),

    duration: shareDurationSchema.optional(),
  })
  .strict()
  .refine(
    (body) => Object.keys(body).length > 0,
    "At least one setting must be supplied",
  );

export const recipientLookupQuerySchema = z
  .object({
    email,
  })
  .strict();

export const shareLinkIdParamsSchema = z
  .object({
    id: objectId,
  })
  .strict();