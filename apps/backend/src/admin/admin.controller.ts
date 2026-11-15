import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard, RolesGuard, type AuthedUser } from '../auth/guards/auth.guards';

import type { CreateTrackDto, UpdateTrackDto } from './admin.service';
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

  // ===== catalog management (audio registration; files go to MEDIA_DIR) =====

  @Get('tracks')
  tracks() {
    return this.admin.listTracks();
  }

  @Get('artists')
  artists() {
    return this.admin.listArtistsLite();
  }

  @Get('albums')
  albums() {
    return this.admin.listAlbumsLite();
  }

  @Post('artists')
  createArtist(
    @CurrentUser() user: AuthedUser,
    @Body() dto: { name: string; bio?: string; imageUrl?: string },
  ) {
    return this.admin.createArtist(dto, user);
  }

  @Post('tracks')
  createTrack(@CurrentUser() user: AuthedUser, @Body() dto: CreateTrackDto) {
    return this.admin.createTrack(dto, user);
  }

  @Patch('tracks/:id')
  updateTrack(
    @CurrentUser() user: AuthedUser,
    @Param('id') id: string,
    @Body() dto: UpdateTrackDto,
  ) {
    return this.admin.updateTrack(id, dto, user);
  }

  @Post('tracks/:id/publish')
  publishTrack(@CurrentUser() user: AuthedUser, @Param('id') id: string) {
    return this.admin.publishTrack(id, true, user);
  }

  @Post('tracks/:id/unpublish')
  unpublishTrack(@CurrentUser() user: AuthedUser, @Param('id') id: string) {
    return this.admin.publishTrack(id, false, user);
  }
}
