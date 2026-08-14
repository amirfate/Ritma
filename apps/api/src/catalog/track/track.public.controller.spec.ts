import { randomUUID } from 'node:crypto';

import { NotFoundException } from '@nestjs/common';
import { type Artist } from '@prisma/client';

import { AuditService } from '../../audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LyricsService } from '../lyrics/lyrics.service';
import { TrackPublicController } from './track.public.controller';
import { TrackService } from './track.service';

async function createArtist(prisma: PrismaService): Promise<Artist> {
  return prisma.artist.create({ data: { name: `Artist-${randomUUID()}` } });
}

const baseTrackInput = {
  title: 'A Track',
  genre: 'POP' as const,
  durationSeconds: 180,
  type: 'FREE' as const,
  flacFileUrl: 'https://cdn.example.com/track.flac',
  coverImageUrl: 'https://cdn.example.com/cover.jpg',
};

describe('TrackPublicController.findLyrics', () => {
  let prisma: PrismaService;
  let trackService: TrackService;
  let lyricsService: LyricsService;
  let controller: TrackPublicController;
  let actorUserId: string;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    const auditService = new AuditService(prisma);
    trackService = new TrackService(prisma, auditService);
    lyricsService = new LyricsService(prisma, auditService);
    controller = new TrackPublicController(trackService, lyricsService);

    const admin = await prisma.user.create({
      data: { phoneNumber: `+9891${randomUUID().replace(/\D/g, '').slice(0, 8)}`, role: 'ADMIN' },
    });
    actorUserId = admin.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('returns listener-safe lyrics for a published track that has them', async () => {
    const artist = await createArtist(prisma);
    const track = await trackService.create(actorUserId, {
      ...baseTrackInput,
      artistId: artist.id,
    });
    await lyricsService.create(actorUserId, track.id, {
      content: 'La la la',
      syncedContent: '[00:01.00]La la la',
    });
    await trackService.transition(actorUserId, track.id, 'ready');
    await trackService.transition(actorUserId, track.id, 'publish');

    const result = await controller.findLyrics(track.id);

    expect(result).toEqual({
      trackId: track.id,
      content: 'La la la',
      syncedContent: '[00:01.00]La la la',
    });
  });

  it('404s for a nonexistent track', async () => {
    await expect(controller.findLyrics('does-not-exist')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('404s for an existing but non-PUBLISHED track, even if lyrics exist', async () => {
    const artist = await createArtist(prisma);
    const track = await trackService.create(actorUserId, {
      ...baseTrackInput,
      artistId: artist.id,
    });
    await lyricsService.create(actorUserId, track.id, { content: 'Draft lyrics' });

    // Still DRAFT — never transitioned.
    await expect(controller.findLyrics(track.id)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('404s for a published track with no lyrics', async () => {
    const artist = await createArtist(prisma);
    const track = await trackService.create(actorUserId, {
      ...baseTrackInput,
      artistId: artist.id,
    });

    // The normal `publish` transition requires lyrics to already exist
    // (see TrackService.transition's prerequisite check), so a PUBLISHED
    // track with no lyrics is unreachable through the public API as it
    // exists today. This forces that database state directly to prove
    // `findLyrics` still 404s defensively, rather than assuming the
    // invariant always holds.
    await prisma.track.update({ where: { id: track.id }, data: { status: 'PUBLISHED' } });

    await expect(controller.findLyrics(track.id)).rejects.toBeInstanceOf(NotFoundException);
  });
});
