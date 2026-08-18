import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type Track, TrackType } from '@prisma/client';

import { AuditService } from '../../audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { paginationArgs, type PaginatedResult, toPaginatedResult } from '../pagination';
import { CreateTrackDto } from './dto/create-track.dto';
import { type ListTrackQueryDto } from './dto/list-track-query.dto';
import { type PublicTrackQueryDto } from './dto/public-track-query.dto';
import { type UpdateTrackDto } from './dto/update-track.dto';
import {
  collectPublishPrerequisiteFailures,
  nextTrackStatus,
  type TrackLifecycleAction,
} from './track-lifecycle';
import { PublishPrerequisitesNotMetError } from '../catalog.errors';

const LIFECYCLE_AUDIT_ACTION: Record<TrackLifecycleAction, 'PUBLISH' | 'ADMIN_ACTION'> = {
  ready: 'ADMIN_ACTION',
  publish: 'PUBLISH',
  unpublish: 'ADMIN_ACTION',
  archive: 'ADMIN_ACTION',
};

/** Enforces "a FREE track has no price, a PAID track has a positive price." */
function assertPriceMatchesType(type: TrackType, price: number | null | undefined): void {
  if (type === TrackType.PAID && !(typeof price === 'number' && price > 0)) {
    throw new BadRequestException('A positive price is required for paid tracks');
  }
  if (type === TrackType.FREE && price !== undefined && price !== null) {
    throw new BadRequestException('Free tracks must not have a price');
  }
}

@Injectable()
export class TrackService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(actorUserId: string, dto: CreateTrackDto): Promise<Track> {
    assertPriceMatchesType(dto.type, dto.price);

    const artist = await this.prisma.artist.findUnique({ where: { id: dto.artistId } });
    if (!artist) {
      throw new NotFoundException('Artist not found');
    }

    if (dto.albumId) {
      const album = await this.prisma.album.findUnique({ where: { id: dto.albumId } });
      if (!album) {
        throw new NotFoundException('Album not found');
      }
      if (album.artistId !== dto.artistId) {
        throw new BadRequestException('Album does not belong to the given artist');
      }
    }

    const track = await this.prisma.track.create({
      data: {
        artistId: dto.artistId,
        albumId: dto.albumId,
        title: dto.title,
        genre: dto.genre,
        durationSeconds: dto.durationSeconds,
        type: dto.type,
        price: dto.price,
        flacFileUrl: dto.flacFileUrl,
        coverImageUrl: dto.coverImageUrl,
        credits: dto.credits,
        story: dto.story,
      },
    });

    await this.auditService.record({
      eventType: 'ADMIN_ACTION',
      actorUserId,
      metadata: { entity: 'Track', action: 'create', trackId: track.id },
    });

    return track;
  }

  async findById(id: string): Promise<Track> {
    const track = await this.prisma.track.findUnique({ where: { id } });
    if (!track) {
      throw new NotFoundException('Track not found');
    }
    return track;
  }

  async findPublishedById(id: string): Promise<Track> {
    const track = await this.prisma.track.findUnique({ where: { id } });
    if (track?.status !== 'PUBLISHED') {
      throw new NotFoundException('Track not found');
    }
    return track;
  }

  async update(actorUserId: string, id: string, dto: UpdateTrackDto): Promise<Track> {
    const existing = await this.findById(id);

    const nextType = dto.type ?? existing.type;
    const nextPrice = dto.price ?? existing.price?.toNumber() ?? null;
    assertPriceMatchesType(nextType, nextPrice);

    if (dto.albumId) {
      const album = await this.prisma.album.findUnique({ where: { id: dto.albumId } });
      if (!album) {
        throw new NotFoundException('Album not found');
      }
      if (album.artistId !== existing.artistId) {
        throw new BadRequestException("Album does not belong to this track's artist");
      }
    }

    const track = await this.prisma.track.update({
      where: { id },
      data: {
        albumId: dto.albumId === null ? null : dto.albumId,
        title: dto.title,
        genre: dto.genre,
        durationSeconds: dto.durationSeconds,
        type: dto.type,
        price: nextType === TrackType.FREE ? null : dto.price,
        flacFileUrl: dto.flacFileUrl,
        coverImageUrl: dto.coverImageUrl,
        credits: dto.credits,
        story: dto.story,
      },
    });

    await this.auditService.record({
      eventType: 'ADMIN_ACTION',
      actorUserId,
      metadata: { entity: 'Track', action: 'update', trackId: id },
    });

    return track;
  }

  /**
   * Runs one of the four lifecycle actions. `publish` additionally
   * re-validates every prerequisite (active artist, required metadata,
   * valid album, required lyrics, valid audio reference, priced-if-paid)
   * against the current database state, not just what was true when the
   * track was created or last updated.
   */
  async transition(actorUserId: string, id: string, action: TrackLifecycleAction): Promise<Track> {
    const track = await this.findById(id);
    const nextStatus = nextTrackStatus(track.status, action);

    if (action === 'publish') {
      const [artist, albumExists, lyrics] = await Promise.all([
        this.prisma.artist.findUnique({ where: { id: track.artistId } }),
        track.albumId
          ? this.prisma.album.findUnique({ where: { id: track.albumId } }).then(Boolean)
          : Promise.resolve(false),
        this.prisma.lyrics.findUnique({ where: { trackId: track.id } }),
      ]);

      const failures = collectPublishPrerequisiteFailures({
        title: track.title,
        flacFileUrl: track.flacFileUrl,
        coverImageUrl: track.coverImageUrl,
        type: track.type,
        price: track.price,
        albumId: track.albumId,
        albumExists,
        artistIsActive: artist?.isActive ?? false,
        hasLyrics: lyrics !== null && lyrics.content.trim().length > 0,
      });

      if (failures.length > 0) {
        throw new PublishPrerequisitesNotMetError(failures);
      }
    }

    const updated = await this.prisma.track.update({
      where: { id },
      data: {
        status: nextStatus,
        publishedAt: action === 'publish' ? new Date() : undefined,
        archivedAt: action === 'archive' ? new Date() : undefined,
      },
    });

    await this.auditService.record({
      eventType: LIFECYCLE_AUDIT_ACTION[action],
      actorUserId,
      metadata: {
        entity: 'Track',
        action,
        trackId: id,
        fromStatus: track.status,
        toStatus: nextStatus,
      },
    });

    return updated;
  }

  async list(query: ListTrackQueryDto): Promise<PaginatedResult<Track>> {
    const where: Prisma.TrackWhereInput = {
      ...(query.q ? { title: { contains: query.q, mode: 'insensitive' } } : {}),
      ...(query.artistId ? { artistId: query.artistId } : {}),
      ...(query.albumId ? { albumId: query.albumId } : {}),
      ...(query.genre ? { genre: query.genre } : {}),
      ...(query.status ? { status: query.status } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.track.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        ...paginationArgs(query),
      }),
      this.prisma.track.count({ where }),
    ]);

    return toPaginatedResult(items, total, query);
  }

  async listPublished(query: PublicTrackQueryDto): Promise<PaginatedResult<Track>> {
    const where: Prisma.TrackWhereInput = {
      status: 'PUBLISHED',
      ...(query.q ? { title: { contains: query.q, mode: 'insensitive' } } : {}),
      ...(query.artistId ? { artistId: query.artistId } : {}),
      ...(query.albumId ? { albumId: query.albumId } : {}),
      ...(query.genre ? { genre: query.genre } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.track.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        ...paginationArgs(query),
      }),
      this.prisma.track.count({ where }),
    ]);

    return toPaginatedResult(items, total, query);
  }
}
