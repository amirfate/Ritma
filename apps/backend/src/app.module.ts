import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';


import { AdminModule } from './admin/admin.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthModule } from './auth/jwt-auth.module';
import { BetaModule } from './beta/beta.module';
import { DevicesModule } from './devices/devices.module';
import { CatalogModule } from './catalog/catalog.module';
import { HealthModule } from './health/health.module';
import { PaymentsModule } from './payments/payments.module';
import { PrismaModule } from './prisma/prisma.module';
import { StreamModule } from './streaming/stream.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true }),
    JwtAuthModule,
    PrismaModule,
    AdminModule,
    AuditModule,
    AuthModule,
    BetaModule,
    DevicesModule,
    PaymentsModule,
    CatalogModule,
    StreamModule,
    HealthModule,
  ],
})
export class AppModule {}
