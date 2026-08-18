import { describe, expect, it } from 'vitest';

import { loadEnv } from './env';

const validSource = {
  DATABASE_URL: 'postgresql://ritma:ritma@localhost:5432/ritma',
  REDIS_URL: 'redis://localhost:6379',
  MINIO_ENDPOINT: 'localhost',
  MINIO_ACCESS_KEY: 'ritma',
  MINIO_SECRET_KEY: 'ritma-minio',
  MINIO_BUCKET: 'ritma-tracks',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
  SMS_IR_API_KEY: 'test-sms-ir-key',
  SMS_IR_TEMPLATE_ID: 'test-template-id',
};

describe('loadEnv', () => {
  it('applies defaults for optional variables', () => {
    const env = loadEnv(validSource);

    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(3000);
    expect(env.MINIO_PORT).toBe(9000);
    expect(env.MINIO_USE_SSL).toBe(false);
    expect(env.JWT_ACCESS_TTL).toBe('15m');
    expect(env.JWT_REFRESH_TTL).toBe('30d');
  });

  it('parses required infrastructure connection variables', () => {
    const env = loadEnv(validSource);

    expect(env.DATABASE_URL).toBe(validSource.DATABASE_URL);
    expect(env.REDIS_URL).toBe(validSource.REDIS_URL);
    expect(env.MINIO_BUCKET).toBe('ritma-tracks');
  });

  it('throws when a required variable is missing', () => {
    const { DATABASE_URL: _omit, ...rest } = validSource;
    expect(() => loadEnv(rest)).toThrowError();
  });

  it('rejects a JWT secret shorter than 32 characters', () => {
    expect(() => loadEnv({ ...validSource, JWT_ACCESS_SECRET: 'too-short' })).toThrowError();
  });
});
