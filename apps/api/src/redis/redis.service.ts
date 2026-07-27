import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

export function createRedisClient(configService: ConfigService): Redis {
  return new Redis(configService.getOrThrow<string>('REDIS_URL'));
}

/**
 * Thin wrapper around the shared ioredis client, exposing only the
 * primitives the application needs (string get/set-with-ttl, atomic
 * increment, delete). Keeping this narrow makes it easy to fake in tests
 * without depending on ioredis's full API surface.
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  constructor(@Inject(REDIS_CLIENT) private readonly client: Redis) {}

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async setWithTtl(key: string, value: string, ttlSeconds: number): Promise<void> {
    await this.client.set(key, value, 'EX', ttlSeconds);
  }

  /** Increments a counter, creating it with the given TTL if it didn't exist. */
  async incrementWithTtl(key: string, ttlSeconds: number): Promise<number> {
    const [[, count]] = (await this.client.multi().incr(key).exec()) as unknown as [
      [Error | null, number],
    ];

    if (count === 1) {
      await this.client.expire(key, ttlSeconds);
    }

    return count;
  }

  async ttl(key: string): Promise<number> {
    return this.client.ttl(key);
  }

  async delete(...keys: string[]): Promise<void> {
    if (keys.length > 0) {
      await this.client.del(...keys);
    }
  }

  onModuleDestroy(): void {
    this.client.disconnect();
  }
}
