import { describe, expect, it } from 'vitest';

import { loadEnv } from './env';

const validSource = {
  DATABASE_URL: 'postgresql://ritma:ritma@localhost:5432/ritma',
  REDIS_URL: 'redis://localhost:6379',
  MINIO_ENDPOINT: 'localhost',
  MINIO_ACCESS_KEY: 'ritma',
  MINIO_SECRET_KEY: 'ritma-minio',
  MINIO_BUCKET: 'ritma-tracks',
};

describe('loadEnv', () => {
  it('applies defaults for optional variables', () => {
    const env = loadEnv(validSource);

    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(3000);
    expect(env.MINIO_PORT).toBe(9000);
    expect(env.MINIO_USE_SSL).toBe(false);
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
});
