import { Controller, Get, Query, UseGuards } from '@nestjs/common';

import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guards';
import { Roles } from '../auth/decorators/roles.decorator';

import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('overview')
  overview() {
    return this.admin.overview();
  }

  @Get('audit')
  audit(@Query('page') page?: string, @Query('take') take?: string) {
    return this.admin.auditPage(Number(page) || 1, Math.min(Number(take) || 50, 200));
  }
}
