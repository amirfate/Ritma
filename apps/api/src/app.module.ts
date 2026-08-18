import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { loadEnv } from '@ritma/config';
import { createLoggerModuleOptions } from '@ritma/logger';
import { LoggerModule } from 'nestjs-pino';

import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { CatalogModule } from './catalog/catalog.module';
import { HealthModule } from './health/health.module';
import { PlaybackModule } from './playback/playback.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: process.env.NODE_ENV === 'test' ? '.env.test' : '.env',
      validate: (config: Record<string, string | undefined>) => loadEnv(config),
    }),
    LoggerModule.forRoot(createLoggerModuleOptions(process.env.NODE_ENV ?? 'development')),
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 20 }],
    }),
    PrismaModule,
    RedisModule,
    AuditModule,
    HealthModule,
    AuthModule,
    CatalogModule,
    PlaybackModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
