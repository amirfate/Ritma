import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { JwtAuthGuard, type AuthedUser } from '../auth/guards/auth.guards';
import { AlbumsService, ArtistsService, TracksService } from './catalog.service';

@Controller('artists')
export class ArtistsController {
  constructor(private readonly artists: ArtistsService) {}

  @Get()
  list(@Query('q') q?: string, @Query('skip') skip?: string, @Query('take') take?: string) {
    return this.artists.list(q, Number(skip) || 0, Math.min(Number(take) || 20, 50));
  }

  @Get(':slug')
  bySlug(@Param('slug') slug: string) {
    return this.artists.bySlug(slug);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  create(
    @Body() dto: { name: string; bio?: string; imageUrl?: string },
    @Req() req: Request & { user?: AuthedUser },
  ) {
    if (!req.user) throw new ForbiddenException();
    return this.artists.create(dto, req.user);
  }
}

@Controller('albums')
export class AlbumsController {
  constructor(private readonly albums: AlbumsService) {}

  @Get()
  list(@Query('q') q?: string, @Query('skip') skip?: string, @Query('take') take?: string) {
    return this.albums.list(q, Number(skip) || 0, Math.min(Number(take) || 20, 50));
  }

  @Get(':slug')
  bySlug(@Param('slug') slug: string) {
    return this.albums.bySlug(slug);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  create(
    @Body()
    dto: { title: string; artistId: string; coverUrl?: string; releaseDate?: string },
    @Req() req: Request & { user?: AuthedUser },
  ) {
    if (!req.user) throw new ForbiddenException();
    return this.albums.create(dto, req.user);
  }
}

@Controller('tracks')
export class TracksController {
  constructor(private readonly tracks: TracksService) {}

  @Get()
  list(
    @Query('album') albumSlug?: string,
    @Query('artist') artistSlug?: string,
    @Query('q') q?: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.tracks.listPublic(
      albumSlug,
      artistSlug,
      q,
      Number(skip) || 0,
      Math.min(Number(take) || 20, 50),
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  create(
    @Body()
    dto: {
      title: string;
      artistId: string;
      albumId?: string;
      audioUrl?: string;
      durationSec?: number;
      position?: number;
      coverUrl?: string;
      lyrics?: string;
      syncedContent?: string;
      isPublished?: boolean;
    },
    @Req() req: Request & { user?: AuthedUser },
  ) {
    if (!req.user) throw new ForbiddenException();
    return this.tracks.create(dto, req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: Record<string, unknown>, @Req() req: Request & { user?: AuthedUser }) {
    if (!req.user) throw new ForbiddenException();
    return this.tracks.update(id, dto, req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/plays')
  registerPlay(@Param('id') id: string, @Req() req: Request & { user?: AuthedUser }) {
    return this.tracks.registerPlay(id, req.user?.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/stream-url')
  streamUrl(@Param('id') id: string, @Req() req: Request & { user?: AuthedUser }) {
    return this.tracks.streamUrl(id, req.user ?? null);
  }
}
