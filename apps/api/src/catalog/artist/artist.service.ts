import { Injectable, NotFoundException } from '@nestjs/common';
import { type Artist, Prisma } from '@prisma/client';

import { AuditService } from '../../audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { paginationArgs, type PaginatedResult, toPaginatedResult } from '../pagination';
import { type CreateArtistDto } from './dto/create-artist.dto';
import { type ListArtistQueryDto } from './dto/list-artist-query.dto';
import { type PublicArtistQueryDto } from './dto/public-artist-query.dto';
import { type UpdateArtistDto } from './dto/update-artist.dto';

@Injectable()
export class ArtistService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(actorUserId: string, dto: CreateArtistDto): Promise<Artist> {
    const artist = await this.prisma.artist.create({
      data: { name: dto.name, bio: dto.bio },
    });

    await this.auditService.record({
      eventType: 'ADMIN_ACTION',
      actorUserId,
      metadata: { entity: 'Artist', action: 'create', artistId: artist.id },
    });

    return artist;
  }

  async findById(id: string): Promise<Artist> {
    const artist = await this.prisma.artist.findUnique({ where: { id } });
    if (!artist) {
      throw new NotFoundException('Artist not found');
    }
    return artist;
  }

  /** Same lookup, but only returns the artist if it's currently active (for public reads). */
  async findActiveById(id: string): Promise<Artist> {
    const artist = await this.prisma.artist.findUnique({ where: { id } });
    if (!artist?.isActive) {
      throw new NotFoundException('Artist not found');
    }
    return artist;
  }

  async update(actorUserId: string, id: string, dto: UpdateArtistDto): Promise<Artist> {
    await this.findById(id);

    const artist = await this.prisma.artist.update({
      where: { id },
      data: { name: dto.name, bio: dto.bio },
    });

    await this.auditService.record({
      eventType: 'ADMIN_ACTION',
      actorUserId,
      metadata: { entity: 'Artist', action: 'update', artistId: id },
    });

    return artist;
  }

  async setActive(actorUserId: string, id: string, isActive: boolean): Promise<Artist> {
    await this.findById(id);

    const artist = await this.prisma.artist.update({ where: { id }, data: { isActive } });

    await this.auditService.record({
      eventType: 'ADMIN_ACTION',
      actorUserId,
      metadata: { entity: 'Artist', action: isActive ? 'enable' : 'disable', artistId: id },
    });

    return artist;
  }

  async list(query: ListArtistQueryDto): Promise<PaginatedResult<Artist>> {
    const where: Prisma.ArtistWhereInput = {
      ...(query.q ? { name: { contains: query.q, mode: 'insensitive' } } : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.artist.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        ...paginationArgs(query),
      }),
      this.prisma.artist.count({ where }),
    ]);

    return toPaginatedResult(items, total, query);
  }

  /** Public catalog: active artists only, same search/pagination shape. */
  async listActive(query: PublicArtistQueryDto): Promise<PaginatedResult<Artist>> {
    const where: Prisma.ArtistWhereInput = {
      isActive: true,
      ...(query.q ? { name: { contains: query.q, mode: 'insensitive' } } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.artist.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        ...paginationArgs(query),
      }),
      this.prisma.artist.count({ where }),
    ]);

    return toPaginatedResult(items, total, query);
  }
}
