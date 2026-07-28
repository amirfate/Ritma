import { Controller, Get, Param, Query } from '@nestjs/common';

import { type PaginatedResult } from '../pagination';
import { PublicTrackQueryDto } from './dto/public-track-query.dto';
import { type PublicTrackResponse, toPublicTrackResponse } from './track.response';
import { TrackService } from './track.service';

/** Unauthenticated: only ever returns PUBLISHED tracks, and never the audio asset reference. */
@Controller('tracks')
export class TrackPublicController {
  constructor(private readonly trackService: TrackService) {}

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
}
