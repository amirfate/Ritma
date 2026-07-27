import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { createRedisClient, REDIS_CLIENT, RedisService } from './redis.service';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: createRedisClient,
      inject: [ConfigService],
    },
    RedisService,
  ],
  exports: [RedisService],
})
export class RedisModule {}
