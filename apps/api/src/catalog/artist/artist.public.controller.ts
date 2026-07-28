import { Controller, Get, Param, Query } from '@nestjs/common';

import { type PaginatedResult } from '../pagination';
import { ArtistService } from './artist.service';
import { PublicArtistQueryDto } from './dto/public-artist-query.dto';
import { type PublicArtistResponse, toPublicArtistResponse } from './artist.response';

/** Unauthenticated: only ever returns active artists. */
@Controller('artists')
export class ArtistPublicController {
  constructor(private readonly artistService: ArtistService) {}

  @Get()
  async list(@Query() query: PublicArtistQueryDto): Promise<PaginatedResult<PublicArtistResponse>> {
    const result = await this.artistService.listActive(query);
    return { ...result, items: result.items.map(toPublicArtistResponse) };
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<PublicArtistResponse> {
    const artist = await this.artistService.findActiveById(id);
    return toPublicArtistResponse(artist);
  }
}
