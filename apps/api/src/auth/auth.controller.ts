import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { type User } from '@prisma/client';

import { AuthService, type VerifyResult } from './auth.service';
import { RefreshDto } from './dto/refresh.dto';
import { SendCodeDto } from './dto/send-code.dto';
import { VerifyDto } from './dto/verify.dto';
import { type AuthenticatedRequest, JwtAuthGuard } from './guards/jwt-auth.guard';
import { type IssuedTokens } from './token.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('send-code')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  async sendCode(@Body() dto: SendCodeDto): Promise<{ cooldownSeconds: number }> {
    return this.authService.sendCode(dto.phoneNumber);
  }

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async verify(@Body() dto: VerifyDto): Promise<VerifyResult> {
    return this.authService.verify(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshDto): Promise<IssuedTokens> {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  async logout(@Req() request: AuthenticatedRequest): Promise<void> {
    await this.authService.logout(request.auth.sub, request.auth.deviceId);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(
    @Req() request: AuthenticatedRequest,
  ): Promise<Pick<User, 'id' | 'phoneNumber' | 'role'>> {
    return this.authService.me(request.auth.sub);
  }
}
