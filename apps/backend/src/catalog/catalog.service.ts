import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { PaymentsService } from '../payments/payments.service';
import { signStreamToken, STREAM_TTL_SECONDS } from '../streaming/stream-sign';

function makeSlug(base: string): string {
  const clean = base.trim().toLowerCase().replace(/\s+/g, '-').slice(0, 60);
  return `${clean || 'item'}-${Math.random().toString(36).slice(2, 7)}`;
}

@Injectable()
export class ArtistsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
  ) {}

  async list(q?: string, skip = 0, take = 20): Promise<unknown> {
    return this.prisma.artist.findMany({
      where: q ? { name: { contains: q, mode: 'insensitive' } } : undefined,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
      select: { id: true, slug: true, name: true, imageUrl: true, bio: true },
    });
  }

  async bySlug(slug: string): Promise<unknown> {
    const artist = await this.prisma.artist.findUnique({
      where: { slug },
      include: {
        albums: { orderBy: { releaseDate: 'desc' } },
        tracks: { where: { albumId: null }, orderBy: { createdAt: 'desc' } },
      },
    });
    if (!artist) throw new NotFoundException('هنرمند یافت نشد');
    const { tracks, ...rest } = artist;
    return { ...rest, singles: tracks };
  }

  async create(
    dto: { name: string; bio?: string; imageUrl?: string },
    user: { sub: string; role: string },
  ): Promise<unknown> {
    if (user.role !== 'ADMIN') throw new ForbiddenException('دسترسی مدیریتی لازم است');
    return this.prisma.artist.create({
      data: { name: dto.name, bio: dto.bio, imageUrl: dto.imageUrl, slug: makeSlug(dto.name) },
    });
  }
}

@Injectable()
export class AlbumsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(q?: string, skip = 0, take = 20): Promise<unknown> {
    return this.prisma.album.findMany({
      where: q ? { title: { contains: q, mode: 'insensitive' } } : undefined,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
      include: { artist: { select: { slug: true, name: true } } },
    });
  }

  async bySlug(slug: string): Promise<unknown> {
    const album = await this.prisma.album.findFirst({
      where: { slug },
      include: {
        artist: { select: { slug: true, name: true, imageUrl: true } },
        tracks: { orderBy: { position: 'asc' } },
      },
    });
    if (!album) throw new NotFoundException('آلبوم یافت نشد');
    return album;
  }

  async create(
    dto: { title: string; artistId: string; coverUrl?: string; releaseDate?: string },
    user: { sub: string; role: string },
  ): Promise<unknown> {
    const artist = await this.prisma.artist.findUnique({ where: { id: dto.artistId } });
    if (!artist) throw new NotFoundException('هنرمند یافت نشد');
    if (user.role !== 'ADMIN' && artist.ownerUserId !== user.sub) {
      throw new ForbiddenException('فقط مالک هنرمند یا مدیر');
    }
    return this.prisma.album.create({
      data: {
        title: dto.title,
        artistId: dto.artistId,
        slug: makeSlug(dto.title),
        coverUrl: dto.coverUrl,
        releaseDate: dto.releaseDate ? new Date(dto.releaseDate) : null,
      },
    });
  }
}

@Injectable()
export class TracksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
  ) {}

  async listPublic(albumSlug?: string, artistSlug?: string, q?: string, skip = 0, take = 20): Promise<unknown> {
    return this.prisma.track.findMany({
      where: {
        isPublished: true,
        ...(albumSlug ? { album: { is: { slug: albumSlug } } } : {}),
        ...(artistSlug ? { artist: { is: { slug: artistSlug } } } : {}),
        ...(q ? { title: { contains: q, mode: 'insensitive' } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
      include: { artist: { select: { slug: true, name: true } }, album: { select: { slug: true, title: true } } },
    });
  }

  async create(
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
    user: { sub: string; role: string },
  ): Promise<unknown> {
    const artist = await this.prisma.artist.findUnique({ where: { id: dto.artistId } });
    if (!artist) throw new NotFoundException('هنرمند یافت نشد');
    if (user.role !== 'ADMIN' && artist.ownerUserId !== user.sub) {
      throw new ForbiddenException('فقط مالک هنرمند یا مدیر');
    }
    return this.prisma.track.create({
      data: {
        title: dto.title,
        artistId: dto.artistId,
        albumId: dto.albumId,
        audioUrl: dto.audioUrl,
        durationSec: dto.durationSec ?? 0,
        position: dto.position ?? 0,
        coverUrl: dto.coverUrl,
        lyrics: dto.lyrics,
        syncedContent: dto.syncedContent,
        isPublished: dto.isPublished ?? false,
      },
    });
  }

  async update(
    id: string,
    dto: Record<string, unknown>,
    user: { sub: string; role: string },
  ): Promise<unknown> {
    const track = await this.prisma.track.findUnique({ where: { id }, include: { artist: true } });
    if (!track) throw new NotFoundException('ترک یافت نشد');
    if (user.role !== 'ADMIN' && track.artist.ownerUserId !== user.sub) {
      throw new ForbiddenException('فقط مالک هنرمند یا مدیر');
    }
    const allowed = ['title', 'audioUrl', 'durationSec', 'position', 'coverUrl', 'lyrics', 'syncedContent', 'isPublished'] as const;
    const data: Record<string, unknown> = {};
    for (const key of allowed) {
      if (dto[key] !== undefined) data[key] = dto[key];
    }
    return this.prisma.track.update({ where: { id }, data });
  }

  async streamUrl(trackId: string, user: { sub: string; role: string } | null): Promise<{ url: string; ttl: number }> {
    const track = await this.prisma.track.findUnique({ where: { id: trackId } });
    if (!track) throw new NotFoundException('ترک یافت نشد');
    if (track.isPremium && !(await this.payments.isPremium(user?.sub ?? null))) {
      throw new ForbiddenException('برای پخش این اثر اشتراک ویژه لازم است');
    }
    const exp = Math.floor(Date.now() / 1000) + STREAM_TTL_SECONDS;
    const url = `/tracks/${trackId}/stream?exp=${exp}&sig=${signStreamToken(trackId, exp)}`;
    return { url, ttl: STREAM_TTL_SECONDS };
  }

  /** Registers a play event and bumps the track play counter. */
  async registerPlay(trackId: string, userId?: string): Promise<{ ok: true }> {
    const track = await this.prisma.track.findUnique({ where: { id: trackId } });
    if (!track) throw new NotFoundException('ترک یافت نشد');
    await this.prisma.$transaction([
      this.prisma.playEvent.create({ data: { trackId, userId: userId ?? null } }),
      this.prisma.track.update({ where: { id: trackId }, data: { playCount: { increment: 1 } } }),
    ]);
    return { ok: true };
  }
}
