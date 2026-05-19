import { z } from "zod";

const tokenLifetimeSchema = z.string().regex(/^\d+[smhd]$/, "Use a duration like 15m, 7d, 3600s or 24h");

function hasLocalhostUrl(value: string) {
  return value
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean)
    .some((url) => {
      try {
        const parsed = new URL(url);
        return ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
      } catch {
        return false;
      }
    });
}

const envSchema = z.object({
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  AUTH_PROVIDER: z.literal("local").default("local"),
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().optional(),
  JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET must have at least 32 characters"),
  JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET must have at least 32 characters"),
  JWT_ACCESS_EXPIRES_IN: tokenLifetimeSchema.default("15m"),
  JWT_REFRESH_EXPIRES_IN: tokenLifetimeSchema.default("7d"),
  FRONTEND_URL: z.string().min(1),
  RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(300)
}).superRefine((config, context) => {
  const frontendUrls = config.FRONTEND_URL.split(",").map((url) => url.trim()).filter(Boolean);

  for (const frontendUrl of frontendUrls) {
    const parsed = z.string().url().safeParse(frontendUrl);
    if (!parsed.success) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["FRONTEND_URL"],
        message: "FRONTEND_URL must contain valid URL values separated by commas"
      });
    }
  }

  if (config.NODE_ENV === "production") {
    if (config.JWT_ACCESS_SECRET.length < 64) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["JWT_ACCESS_SECRET"],
        message: "JWT_ACCESS_SECRET must have at least 64 characters in production"
      });
    }

    if (config.JWT_REFRESH_SECRET.length < 64) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["JWT_REFRESH_SECRET"],
        message: "JWT_REFRESH_SECRET must have at least 64 characters in production"
      });
    }

    if (hasLocalhostUrl(config.FRONTEND_URL)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["FRONTEND_URL"],
        message: "FRONTEND_URL cannot use localhost in production"
      });
    }
  }
});

export function validateEnv(config: Record<string, unknown>) {
  if (config.NODE_ENV === "production" && !config.FRONTEND_URL) {
    throw new Error("Invalid environment configuration: FRONTEND_URL is required in production");
  }

  const result = envSchema.safeParse(config);

  if (!result.success) {
    throw new Error(`Invalid environment configuration: ${JSON.stringify(result.error.flatten().fieldErrors)}`);
  }

  return result.data;
}
