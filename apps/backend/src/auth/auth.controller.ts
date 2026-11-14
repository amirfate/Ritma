import { Body, Controller, Get, Ip, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';

import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { LoginDto, RefreshDto, RegisterDto } from './dto/auth.dto';
import { DevicesService } from '../devices/devices.service';
import { JwtAuthGuard, type AuthedUser } from './guards/auth.guards';
import { AuthService } from './auth.service';

@Controller('auth')
@UseGuards(JwtAuthGuard)
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly devices: DevicesService,
  ) {}

  private deviceInfo(req: Request, ip: string) {
    return {
      deviceKey: DevicesService.keyFor(req.headers['user-agent']),
      deviceName: req.headers['user-agent']?.slice(0, 80),
      ip,
    };
  }

  @Public()
  @Post('register')
  register(@Body() dto: RegisterDto, @Req() req: Request, @Ip() ip: string) {
    return this.auth.register(dto, this.deviceInfo(req, ip));
  }

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto, @Req() req: Request, @Ip() ip: string) {
    return this.auth.login(dto, this.deviceInfo(req, ip));
  }

  @Public()
  @Post('refresh')
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Get('me')
  me(@CurrentUser() user: AuthedUser) {
    return this.auth.me(user.sub);
  }

  @Post('logout')
  logout(
    @CurrentUser() user: AuthedUser,
    @Body() dto: { refreshToken?: string },
  ) {
    return this.auth.logout(user.sub, dto.refreshToken);
  }

  @Get('session-check')
  sessionCheck(@CurrentUser() user: AuthedUser) {
    return { valid: true, email: user.email, role: user.role };
  }
}
