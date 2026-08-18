import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { type AuthenticatedRequest, JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { ValidateInvitationDto } from './dto/validate-invitation.dto';
import { InvitationService } from './invitation.service';
import { toInvitationResponse, type InvitationResponse } from './invitation.response';

@Controller('invitations')
export class InvitationController {
  constructor(private readonly invitationService: InvitationService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard)
  // Deliberately above the 10-invitation lifetime quota, so a quota
  // rejection (403, business rule) and a rate-limit rejection (429,
  // request volume) stay independently observable rather than always
  // colliding on the same request.
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateInvitationDto,
  ): Promise<InvitationResponse> {
    const invitation = await this.invitationService.createInvitation(
      request.auth.sub,
      dto.inviteePhoneNumber,
    );
    return toInvitationResponse(invitation);
  }

  @Post('validate')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async validate(@Body() dto: ValidateInvitationDto): Promise<{ valid: boolean }> {
    return this.invitationService.validateInvitation(dto.code);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async list(@Req() request: AuthenticatedRequest): Promise<InvitationResponse[]> {
    const invitations = await this.invitationService.listForInviter(request.auth.sub);
    return invitations.map(toInvitationResponse);
  }
}
