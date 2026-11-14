import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard, type AuthedUser } from '../auth/guards/auth.guards';
import { AuditService } from '../audit/audit.service';

import { BetaService } from './beta.service';

@Controller('beta')
@UseGuards(JwtAuthGuard)
export class BetaController {
  constructor(
    private readonly beta: BetaService,
    private readonly audit: AuditService,
  ) {}

  @Get('status')
  status() {
    return this.beta.status();
  }

  @Get('invites')
  myInvites(@CurrentUser() user: AuthedUser) {
    return this.beta.myInvites(user.sub);
  }

  @Post('invites')
  async createInvite(
    @CurrentUser() user: AuthedUser,
    @Body() dto: { note?: string },
  ) {
    const invite = await this.beta.createInvite(user.sub, dto.note);
    this.audit.log({
      actorUserId: user.sub,
      actorEmail: user.email,
      action: 'beta.invite.create',
      entityType: 'Invite',
      entityId: invite.id,
      after: { code: invite.code },
    });
    return invite;
  }
}
