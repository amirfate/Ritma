import { z } from 'zod';

/**
 * Infrastructure connection variables and service secrets shared across
 * Ritma services. Service-specific secrets are added by the milestone
 * that introduces the code consuming them (auth's JWT and sms.ir secrets
 * were added by the auth & session milestone), not speculatively ahead of
 * that.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),

  MINIO_ENDPOINT: z.string().min(1),
  MINIO_PORT: z.coerce.number().int().positive().default(9000),
  MINIO_ACCESS_KEY: z.string().min(1),
  MINIO_SECRET_KEY: z.string().min(1),
  MINIO_BUCKET: z.string().min(1),
  MINIO_USE_SSL: z.coerce.boolean().default(false),

  /// Signs short-lived access tokens. Separate from the refresh secret so
  /// leaking one does not compromise the other.
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.string().min(1).default('15m'),
  /// Signs long-lived refresh tokens.
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_REFRESH_TTL: z.string().min(1).default('30d'),

  /// sms.ir Verify API credentials for OTP delivery.
  SMS_IR_API_KEY: z.string().min(1),
  SMS_IR_TEMPLATE_ID: z.string().min(1),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Parses and validates `process.env`-shaped input against {@link envSchema}.
 * Throws a `ZodError` describing every missing or malformed variable.
 */
export function loadEnv(source: Record<string, string | undefined>): Env {
  return envSchema.parse(source);
}
