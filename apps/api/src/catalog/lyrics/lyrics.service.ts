import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { type Lyrics } from '@prisma/client';

import { AuditService } from '../../audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateLyricsDto } from './dto/create-lyrics.dto';
import { type UpdateLyricsDto } from './dto/update-lyrics.dto';

@Injectable()
export class LyricsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  private async assertTrackExists(trackId: string): Promise<void> {
    const track = await this.prisma.track.findUnique({ where: { id: trackId } });
    if (!track) {
      throw new NotFoundException('Track not found');
    }
  }

  async create(actorUserId: string, trackId: string, dto: CreateLyricsDto): Promise<Lyrics> {
    await this.assertTrackExists(trackId);

    const existing = await this.prisma.lyrics.findUnique({ where: { trackId } });
    if (existing) {
      throw new ConflictException('Lyrics already exist for this track; use update instead');
    }

    const lyrics = await this.prisma.lyrics.create({
      data: { trackId, content: dto.content, syncedContent: dto.syncedContent },
    });

    await this.auditService.record({
      eventType: 'ADMIN_ACTION',
      actorUserId,
      metadata: { entity: 'Lyrics', action: 'create', trackId },
    });

    return lyrics;
  }

  async findByTrackId(trackId: string): Promise<Lyrics> {
    const lyrics = await this.prisma.lyrics.findUnique({ where: { trackId } });
    if (!lyrics) {
      throw new NotFoundException('Lyrics not found for this track');
    }
    return lyrics;
  }

  async update(actorUserId: string, trackId: string, dto: UpdateLyricsDto): Promise<Lyrics> {
    await this.findByTrackId(trackId);

    const lyrics = await this.prisma.lyrics.update({
      where: { trackId },
      data: { content: dto.content, syncedContent: dto.syncedContent },
    });

    await this.auditService.record({
      eventType: 'ADMIN_ACTION',
      actorUserId,
      metadata: { entity: 'Lyrics', action: 'update', trackId },
    });

    return lyrics;
  }
}
