import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { createLoggerModuleOptions } from '@ritma/logger';
import { LoggerModule } from 'nestjs-pino';

import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
    }),
    LoggerModule.forRoot(createLoggerModuleOptions(process.env.NODE_ENV ?? 'development')),
    HealthModule,
  ],
})
export class AppModule {}
