import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { type Response } from 'express';

import { type AuthenticatedRequest, JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateSessionDto } from './dto/create-session.dto';
import { PlaybackSessionService } from './playback-session.service';
import {
  type PlaybackSessionResponse,
  toPlaybackSessionResponse,
} from './playback-session.response';
import { PlaybackStreamService } from './playback-stream.service';

/**
 * Every route requires a valid bearer token only — no role restriction.
 * Streaming is a plain listener capability, not admin/artist-only (§11).
 */
@Controller('playback/sessions')
@UseGuards(JwtAuthGuard)
export class PlaybackController {
  constructor(
    private readonly sessionService: PlaybackSessionService,
    private readonly streamService: PlaybackStreamService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateSessionDto,
  ): Promise<PlaybackSessionResponse> {
    const session = await this.sessionService.createSession(
      request.auth.sub,
      request.auth.deviceId,
      dto.trackId,
    );
    return toPlaybackSessionResponse(session);
  }

  @Get(':id/stream')
  async stream(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Res() response: Response,
  ): Promise<void> {
    const prepared = await this.streamService.prepare(request.auth.sub, id, request.headers.range);

    if (prepared.status === 416) {
      response.status(416).set('Content-Range', `bytes */${prepared.contentLimit}`).end();
      return;
    }

    response.status(prepared.status);
    response.set({
      'Content-Type': 'audio/flac',
      'Accept-Ranges': 'bytes',
      'Content-Length': String(prepared.end - prepared.start + 1),
    });
    if (prepared.status === 206) {
      response.set(
        'Content-Range',
        `bytes ${prepared.start}-${prepared.end}/${prepared.contentLimit}`,
      );
    }
    prepared.stream.pipe(response);
  }

  @Post(':id/end')
  @HttpCode(HttpStatus.OK)
  async end(@Req() request: AuthenticatedRequest, @Param('id') id: string): Promise<void> {
    await this.sessionService.endSession(request.auth.sub, id);
  }
}
