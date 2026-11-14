import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard, type AuthedUser } from '../auth/guards/auth.guards';
import { AuditService } from '../audit/audit.service';

import { DevicesService } from './devices.service';

@Controller('devices')
@UseGuards(JwtAuthGuard)
export class DevicesController {
  constructor(
    private readonly devices: DevicesService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  list(@CurrentUser() user: AuthedUser) {
    return this.devices.listForUser(user.sub);
  }

  @Post('revoke')
  async revoke(
    @CurrentUser() user: AuthedUser,
    @Body() dto: { deviceId: string },
  ) {
    const result = await this.devices.revoke(user.sub, dto.deviceId);
    this.audit.log({
      actorUserId: user.sub,
      actorEmail: user.email,
      action: 'devices.revoke',
      entityType: 'DeviceSession',
      entityId: dto.deviceId,
    });
    return result;
  }
}
