import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { randomBytes } from 'node:crypto';
import * as fs from 'node:fs';
import { extname } from 'node:path';

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

  static readonly AUDIO_EXT = ['.mp3', '.m4a', '.mp4', '.flac', '.aac', '.ogg'];

  /** Direct audio upload (admin-only): stores the file under MEDIA_DIR/audio and
   *  returns the audioKey to register on a track. MinIO presigned flow later. */
  @Post('upload-audio')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const mediaDir = process.env.MEDIA_DIR;
          if (!mediaDir) return cb(new Error('MEDIA_DIR تنظیم نشده است'), '');
          const dir = `${mediaDir}/audio`;
          fs.mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname ?? '').toLowerCase();
          const base =
            (file.originalname ?? 'track')
              .slice(0, Math.max(0, (file.originalname ?? '').length - ext.length))
              .replace(/[^\p{L}\p{N}_-]+/gu, '-')
              .replace(/^-+|-+$/g, '')
              .slice(0, 80) || 'track';
          cb(null, `${Date.now()}-${randomBytes(4).toString('hex')}-${base}${ext}`);
        },
      }),
      limits: { fileSize: 200 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const ext = extname(file.originalname ?? '').toLowerCase();
        if (!AdminController.AUDIO_EXT.includes(ext)) return cb(null, false);
        cb(null, true);
      },
    }),
  )
  uploadAudio(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('فایلی ارسال نشد یا فرمت آن مجاز نیست (mp3/m4a/flac/aac/ogg)');
    return { audioKey: `audio/${file.filename}`, size: file.size, name: file.filename };
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

  // ===== payouts / per-artist shares (ported from ritma-app) =====

  @Get('payouts')
  payouts() {
    return this.admin.listPayouts();
  }

  @Post('payouts/:id/decide')
  decidePayout(@CurrentUser() user: AuthedUser, @Param('id') id: string, @Body() dto: { decision: 'PAID' | 'REJECTED' }) {
    const d = dto.decision === 'REJECTED' ? 'REJECTED' : 'PAID';
    return this.admin.decidePayout(id, d, user);
  }

  @Post('payouts/:id/track')
  payoutTracking(@Param('id') id: string, @Body() dto: { tracking?: string }) {
    return this.admin.setPayoutTracking(id, String(dto.tracking ?? ''));
  }

  @Post('artists/:id/shares')
  artistShares(@CurrentUser() user: AuthedUser, @Param('id') id: string, @Body() dto: { saleShare?: number | null; donationShare?: number | null }) {
    return this.admin.setArtistShares(id, dto.saleShare, dto.donationShare, user);
  }
}
