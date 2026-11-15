import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { BetaModule } from '../beta/beta.module';
import { DevicesModule } from '../devices/devices.module';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard, RolesGuard } from './guards/auth.guards';
import { JwtAuthModule } from './jwt-auth.module';

/**
 * JwtModule + guards are registered once in the global JwtAuthModule
 * (see jwt-auth.module.ts) and are re-exported here for convenience.
 */
@Module({
  imports: [AuditModule, BetaModule, DevicesModule, JwtAuthModule],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, RolesGuard],
  exports: [JwtAuthModule],
})
export class AuthModule {}
