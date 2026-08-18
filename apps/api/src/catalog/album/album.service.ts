import { Injectable, NotFoundException } from '@nestjs/common';
import { type Album, Prisma } from '@prisma/client';

import { AuditService } from '../../audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { paginationArgs, type PaginatedResult, toPaginatedResult } from '../pagination';
import { CreateAlbumDto } from './dto/create-album.dto';
import { type ListAlbumQueryDto } from './dto/list-album-query.dto';
import { type PublicAlbumQueryDto } from './dto/public-album-query.dto';
import { type UpdateAlbumDto } from './dto/update-album.dto';

@Injectable()
export class AlbumService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(actorUserId: string, dto: CreateAlbumDto): Promise<Album> {
    const artist = await this.prisma.artist.findUnique({ where: { id: dto.artistId } });
    if (!artist) {
      throw new NotFoundException('Artist not found');
    }

    const album = await this.prisma.album.create({
      data: {
        artistId: dto.artistId,
        title: dto.title,
        coverImageUrl: dto.coverImageUrl,
        releasedAt: dto.releasedAt ? new Date(dto.releasedAt) : undefined,
      },
    });

    await this.auditService.record({
      eventType: 'ADMIN_ACTION',
      actorUserId,
      metadata: { entity: 'Album', action: 'create', albumId: album.id },
    });

    return album;
  }

  async findById(id: string): Promise<Album> {
    const album = await this.prisma.album.findUnique({ where: { id } });
    if (!album) {
      throw new NotFoundException('Album not found');
    }
    return album;
  }

  async findPublishedById(id: string): Promise<Album> {
    const album = await this.prisma.album.findUnique({ where: { id } });
    if (!album?.isPublished) {
      throw new NotFoundException('Album not found');
    }
    return album;
  }

  async update(actorUserId: string, id: string, dto: UpdateAlbumDto): Promise<Album> {
    await this.findById(id);

    const album = await this.prisma.album.update({
      where: { id },
      data: {
        title: dto.title,
        coverImageUrl: dto.coverImageUrl,
        releasedAt: dto.releasedAt ? new Date(dto.releasedAt) : undefined,
      },
    });

    await this.auditService.record({
      eventType: 'ADMIN_ACTION',
      actorUserId,
      metadata: { entity: 'Album', action: 'update', albumId: id },
    });

    return album;
  }

  async setPublished(actorUserId: string, id: string, isPublished: boolean): Promise<Album> {
    await this.findById(id);

    const album = await this.prisma.album.update({ where: { id }, data: { isPublished } });

    await this.auditService.record({
      eventType: 'ADMIN_ACTION',
      actorUserId,
      metadata: {
        entity: 'Album',
        action: isPublished ? 'publish' : 'unpublish',
        albumId: id,
      },
    });

    return album;
  }

  async list(query: ListAlbumQueryDto): Promise<PaginatedResult<Album>> {
    const where: Prisma.AlbumWhereInput = {
      ...(query.q ? { title: { contains: query.q, mode: 'insensitive' } } : {}),
      ...(query.artistId ? { artistId: query.artistId } : {}),
      ...(query.isPublished !== undefined ? { isPublished: query.isPublished } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.album.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        ...paginationArgs(query),
      }),
      this.prisma.album.count({ where }),
    ]);

    return toPaginatedResult(items, total, query);
  }

  async listPublished(query: PublicAlbumQueryDto): Promise<PaginatedResult<Album>> {
    const where: Prisma.AlbumWhereInput = {
      isPublished: true,
      ...(query.q ? { title: { contains: query.q, mode: 'insensitive' } } : {}),
      ...(query.artistId ? { artistId: query.artistId } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.album.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        ...paginationArgs(query),
      }),
      this.prisma.album.count({ where }),
    ]);

    return toPaginatedResult(items, total, query);
  }
}
