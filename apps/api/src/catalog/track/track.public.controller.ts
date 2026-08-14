import { Controller, Get, Param, Query } from '@nestjs/common';

import { LyricsService } from '../lyrics/lyrics.service';
import { type PublicLyricsResponse, toPublicLyricsResponse } from '../lyrics/lyrics.response';
import { type PaginatedResult } from '../pagination';
import { PublicTrackQueryDto } from './dto/public-track-query.dto';
import { type PublicTrackResponse, toPublicTrackResponse } from './track.response';
import { TrackService } from './track.service';

/** Unauthenticated: only ever returns PUBLISHED tracks, and never the audio asset reference. */
@Controller('tracks')
export class TrackPublicController {
  constructor(
    private readonly trackService: TrackService,
    private readonly lyricsService: LyricsService,
  ) {}

  @Get()
  async list(@Query() query: PublicTrackQueryDto): Promise<PaginatedResult<PublicTrackResponse>> {
    const result = await this.trackService.listPublished(query);
    return { ...result, items: result.items.map(toPublicTrackResponse) };
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<PublicTrackResponse> {
    const track = await this.trackService.findPublishedById(id);
    return toPublicTrackResponse(track);
  }

  /**
   * 404s if the track doesn't exist or isn't PUBLISHED (via
   * `findPublishedById`, the same gate `findOne` above uses), and 404s
   * again if the track has no lyrics yet — never distinguishing the two
   * to an unauthenticated caller.
   */
  @Get(':id/lyrics')
  async findLyrics(@Param('id') id: string): Promise<PublicLyricsResponse> {
    await this.trackService.findPublishedById(id);
    const lyrics = await this.lyricsService.findByTrackId(id);
    return toPublicLyricsResponse(lyrics);
  }
}
