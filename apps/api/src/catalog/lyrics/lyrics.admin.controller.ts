import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { Roles } from '../../auth/decorators/roles.decorator';
import { type AuthenticatedRequest, JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { CreateLyricsDto } from './dto/create-lyrics.dto';
import { UpdateLyricsDto } from './dto/update-lyrics.dto';
import { type LyricsResponse, toLyricsResponse } from './lyrics.response';
import { LyricsService } from './lyrics.service';

@Controller('admin/tracks/:trackId/lyrics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class LyricsAdminController {
  constructor(private readonly lyricsService: LyricsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Req() request: AuthenticatedRequest,
    @Param('trackId') trackId: string,
    @Body() dto: CreateLyricsDto,
  ): Promise<LyricsResponse> {
    const lyrics = await this.lyricsService.create(request.auth.sub, trackId, dto);
    return toLyricsResponse(lyrics);
  }

  @Get()
  async findOne(@Param('trackId') trackId: string): Promise<LyricsResponse> {
    const lyrics = await this.lyricsService.findByTrackId(trackId);
    return toLyricsResponse(lyrics);
  }

  @Patch()
  async update(
    @Req() request: AuthenticatedRequest,
    @Param('trackId') trackId: string,
    @Body() dto: UpdateLyricsDto,
  ): Promise<LyricsResponse> {
    const lyrics = await this.lyricsService.update(request.auth.sub, trackId, dto);
    return toLyricsResponse(lyrics);
  }
}
