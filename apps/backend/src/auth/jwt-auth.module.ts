import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

import { JwtAuthGuard, RolesGuard } from './guards/auth.guards';

/**
 * Global module that registers JwtModule + auth guards once,
 * so every module (Beta, Devices, Admin, Catalog, ...) can use
 * JwtAuthGuard via @UseGuards without importing AuthModule
 * (which would create a circular dependency).
 */
@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET', 'dev-secret-change-me'),
        signOptions: { expiresIn: '15m' },
      }),
    }),
  ],
  providers: [JwtAuthGuard, RolesGuard],
  exports: [JwtModule, JwtAuthGuard, RolesGuard],
})
export class JwtAuthModule {}
