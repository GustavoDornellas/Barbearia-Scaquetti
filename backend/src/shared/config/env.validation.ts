import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  AUTH_PROVIDER: z.literal("local").default("local"),
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().optional(),
  JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET must have at least 32 characters"),
  JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET must have at least 32 characters"),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
  FRONTEND_URL: z.string().url().default("http://localhost:5173"),
  RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(300)
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
