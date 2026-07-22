import { z } from 'zod';

/**
 * Infrastructure connection variables shared across Ritma services.
 *
 * This schema covers only the connection details of infrastructure that
 * exists today (Postgres, Redis, MinIO). Service-specific secrets (auth,
 * payment gateway, SMS provider, ...) are added by the milestone that
 * introduces the code consuming them, not speculatively here.
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
});

export type Env = z.infer<typeof envSchema>;

/**
 * Parses and validates `process.env`-shaped input against {@link envSchema}.
 * Throws a `ZodError` describing every missing or malformed variable.
 */
export function loadEnv(source: Record<string, string | undefined>): Env {
  return envSchema.parse(source);
}
