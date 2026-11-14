import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';

import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { LoginDto, RefreshDto, RegisterDto } from './dto/auth.dto';
import { JwtAuthGuard, type AuthedUser } from './guards/auth.guards';
import { AuthService } from './auth.service';

@Controller('auth')
@UseGuards(JwtAuthGuard)
export class AuthController {
  constructor(
    private readonly auth: AuthService,
  ) {}

  @Public()
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
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
