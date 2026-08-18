import { randomUUID } from 'node:crypto';

import { ConflictException, NotFoundException } from '@nestjs/common';
import { type Track } from '@prisma/client';

import { AuditService } from '../../audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LyricsService } from './lyrics.service';

async function createTrack(prisma: PrismaService): Promise<Track> {
  const artist = await prisma.artist.create({ data: { name: `Artist-${randomUUID()}` } });
  return prisma.track.create({
    data: {
      artistId: artist.id,
      title: `Track-${randomUUID()}`,
      genre: 'POP',
      durationSeconds: 180,
      type: 'FREE',
      flacFileUrl: 'https://cdn.example.com/track.flac',
      coverImageUrl: 'https://cdn.example.com/cover.jpg',
    },
  });
}

describe('LyricsService', () => {
  let prisma: PrismaService;
  let lyricsService: LyricsService;
  let actorUserId: string;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    lyricsService = new LyricsService(prisma, new AuditService(prisma));

    const admin = await prisma.user.create({
      data: { phoneNumber: `+9891${randomUUID().replace(/\D/g, '').slice(0, 8)}`, role: 'ADMIN' },
    });
    actorUserId = admin.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('creates lyrics for a track and audits it', async () => {
    const track = await createTrack(prisma);

    const lyrics = await lyricsService.create(actorUserId, track.id, { content: 'La la la' });
    expect(lyrics.trackId).toBe(track.id);

    const auditLog = await prisma.auditLog.findFirst({
      where: { eventType: 'ADMIN_ACTION', actorUserId },
      orderBy: { createdAt: 'desc' },
    });
    expect(auditLog?.metadata).toMatchObject({ entity: 'Lyrics', action: 'create' });
  });

  it('rejects creation against a nonexistent track', async () => {
    await expect(
      lyricsService.create(actorUserId, 'does-not-exist', { content: 'La la la' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects creating lyrics twice for the same track', async () => {
    const track = await createTrack(prisma);
    await lyricsService.create(actorUserId, track.id, { content: 'First' });

    await expect(
      lyricsService.create(actorUserId, track.id, { content: 'Second' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('updates existing lyrics', async () => {
    const track = await createTrack(prisma);
    await lyricsService.create(actorUserId, track.id, { content: 'Original' });

    const updated = await lyricsService.update(actorUserId, track.id, {
      content: 'Updated',
      syncedContent: '[00:01.00]Updated',
    });

    expect(updated.content).toBe('Updated');
    expect(updated.syncedContent).toBe('[00:01.00]Updated');
  });

  it('rejects updating lyrics that do not exist yet', async () => {
    const track = await createTrack(prisma);

    await expect(
      lyricsService.update(actorUserId, track.id, { content: 'Nope' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects reading lyrics that do not exist', async () => {
    const track = await createTrack(prisma);

    await expect(lyricsService.findByTrackId(track.id)).rejects.toBeInstanceOf(NotFoundException);
  });
});
