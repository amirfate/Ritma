import { Controller, Get, Param, Query } from '@nestjs/common';

import { type PaginatedResult } from '../pagination';
import { AlbumService } from './album.service';
import { type PublicAlbumResponse, toPublicAlbumResponse } from './album.response';
import { PublicAlbumQueryDto } from './dto/public-album-query.dto';

/** Unauthenticated: only ever returns published albums. */
@Controller('albums')
export class AlbumPublicController {
  constructor(private readonly albumService: AlbumService) {}

  @Get()
  async list(@Query() query: PublicAlbumQueryDto): Promise<PaginatedResult<PublicAlbumResponse>> {
    const result = await this.albumService.listPublished(query);
    return { ...result, items: result.items.map(toPublicAlbumResponse) };
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<PublicAlbumResponse> {
    const album = await this.albumService.findPublishedById(id);
    return toPublicAlbumResponse(album);
  }
}
