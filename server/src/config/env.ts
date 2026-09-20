import * as z from "zod";

const envSchema = z.object({
  CLIENT_URLS: z
    .string()
    .min(1)
    .transform((value) =>
      value
        .split(",")
        .map((url) => url.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.url())),

  PORT: z.coerce.number().int().positive(),

  NODE_ENV: z.enum(["development", "production", "test"]),

  MONGODB_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),

  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),

  COOKIE_SECRET: z.string().min(1),

  AWS_BUCKET: z.string().min(1),
  AWS_REGION: z.string().min(1),
  AWS_ACCESS_KEY_ID: z.string().min(1),
  AWS_SECRET_ACCESS_KEY: z.string().min(1),

  CLOUDFRONT_URL: z.url().min(1),
  CLOUDFRONT_PRIVATE_KEY: z.string().min(1),
  KEY_PAIR_ID: z.string().min(1),
});

export const env = envSchema.parse(process.env);