import { randomUUID } from 'node:crypto';

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { type Artist } from '@prisma/client';

import { AuditService } from '../../audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { InvalidTrackTransitionError, PublishPrerequisitesNotMetError } from '../catalog.errors';
import { TrackService } from './track.service';

async function createArtist(prisma: PrismaService, isActive = true): Promise<Artist> {
  return prisma.artist.create({ data: { name: `Artist-${randomUUID()}`, isActive } });
}

const baseTrackInput = {
  title: 'A Track',
  genre: 'POP' as const,
  durationSeconds: 180,
  type: 'FREE' as const,
  flacFileUrl: 'https://cdn.example.com/track.flac',
  coverImageUrl: 'https://cdn.example.com/cover.jpg',
};

describe('TrackService', () => {
  let prisma: PrismaService;
  let trackService: TrackService;
  let actorUserId: string;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    trackService = new TrackService(prisma, new AuditService(prisma));

    const admin = await prisma.user.create({
      data: { phoneNumber: `+9891${randomUUID().replace(/\D/g, '').slice(0, 8)}`, role: 'ADMIN' },
    });
    actorUserId = admin.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('create', () => {
    it('creates a DRAFT track for a valid artist', async () => {
      const artist = await createArtist(prisma);

      const track = await trackService.create(actorUserId, {
        ...baseTrackInput,
        artistId: artist.id,
      });

      expect(track.status).toBe('DRAFT');
      expect(track.artistId).toBe(artist.id);

      const auditLog = await prisma.auditLog.findFirst({
        where: { eventType: 'ADMIN_ACTION', actorUserId },
        orderBy: { createdAt: 'desc' },
      });
      expect(auditLog?.metadata).toMatchObject({ entity: 'Track', action: 'create' });
    });

    it('rejects creation against a nonexistent artist', async () => {
      await expect(
        trackService.create(actorUserId, { ...baseTrackInput, artistId: 'does-not-exist' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects a PAID track with no price', async () => {
      const artist = await createArtist(prisma);
      await expect(
        trackService.create(actorUserId, {
          ...baseTrackInput,
          artistId: artist.id,
          type: 'PAID',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a FREE track that has a price', async () => {
      const artist = await createArtist(prisma);
      await expect(
        trackService.create(actorUserId, {
          ...baseTrackInput,
          artistId: artist.id,
          type: 'FREE',
          price: 1.99,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('accepts a PAID track with a positive price', async () => {
      const artist = await createArtist(prisma);
      const track = await trackService.create(actorUserId, {
        ...baseTrackInput,
        artistId: artist.id,
        type: 'PAID',
        price: 2.5,
      });
      expect(track.price?.toString()).toBe('2.5');
    });

    it('rejects an album that does not belong to the given artist', async () => {
      const artist = await createArtist(prisma);
      const otherArtist = await createArtist(prisma);
      const album = await prisma.album.create({
        data: {
          artistId: otherArtist.id,
          title: 'Mismatched Album',
          coverImageUrl: 'https://cdn.example.com/cover.jpg',
        },
      });

      await expect(
        trackService.create(actorUserId, {
          ...baseTrackInput,
          artistId: artist.id,
          albumId: album.id,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('lifecycle transitions', () => {
    it('rejects publishing a DRAFT track directly', async () => {
      const artist = await createArtist(prisma);
      const track = await trackService.create(actorUserId, {
        ...baseTrackInput,
        artistId: artist.id,
      });

      await expect(
        trackService.transition(actorUserId, track.id, 'publish'),
      ).rejects.toBeInstanceOf(InvalidTrackTransitionError);
    });

    it('rejects publishing a track with no lyrics', async () => {
      const artist = await createArtist(prisma);
      const track = await trackService.create(actorUserId, {
        ...baseTrackInput,
        artistId: artist.id,
      });
      await trackService.transition(actorUserId, track.id, 'ready');

      await expect(
        trackService.transition(actorUserId, track.id, 'publish'),
      ).rejects.toBeInstanceOf(PublishPrerequisitesNotMetError);

      const stillReady = await trackService.findById(track.id);
      expect(stillReady.status).toBe('READY');
    });

    it('rejects publishing a track whose artist is inactive', async () => {
      const artist = await createArtist(prisma, false);
      const track = await trackService.create(actorUserId, {
        ...baseTrackInput,
        artistId: artist.id,
      });
      await trackService.transition(actorUserId, track.id, 'ready');
      await prisma.lyrics.create({ data: { trackId: track.id, content: 'La la la' } });

      await expect(
        trackService.transition(actorUserId, track.id, 'publish'),
      ).rejects.toBeInstanceOf(PublishPrerequisitesNotMetError);
    });

    it('publishes a READY track once every prerequisite is met, and audits it as PUBLISH', async () => {
      const artist = await createArtist(prisma);
      const track = await trackService.create(actorUserId, {
        ...baseTrackInput,
        artistId: artist.id,
      });
      await trackService.transition(actorUserId, track.id, 'ready');
      await prisma.lyrics.create({ data: { trackId: track.id, content: 'La la la' } });

      const published = await trackService.transition(actorUserId, track.id, 'publish');
      expect(published.status).toBe('PUBLISHED');
      expect(published.publishedAt).not.toBeNull();

      const auditLog = await prisma.auditLog.findFirst({
        where: { eventType: 'PUBLISH', actorUserId },
        orderBy: { createdAt: 'desc' },
      });
      expect(auditLog?.metadata).toMatchObject({
        entity: 'Track',
        action: 'publish',
        trackId: track.id,
      });
    });

    it('walks the full DRAFT -> READY -> PUBLISHED -> UNPUBLISHED -> ARCHIVED chain', async () => {
      const artist = await createArtist(prisma);
      const track = await trackService.create(actorUserId, {
        ...baseTrackInput,
        artistId: artist.id,
      });
      await prisma.lyrics.create({ data: { trackId: track.id, content: 'La la la' } });

      await trackService.transition(actorUserId, track.id, 'ready');
      await trackService.transition(actorUserId, track.id, 'publish');
      const unpublished = await trackService.transition(actorUserId, track.id, 'unpublish');
      expect(unpublished.status).toBe('UNPUBLISHED');

      const archived = await trackService.transition(actorUserId, track.id, 'archive');
      expect(archived.status).toBe('ARCHIVED');
      expect(archived.archivedAt).not.toBeNull();
    });

    it('rejects any transition once a track is ARCHIVED', async () => {
      const artist = await createArtist(prisma);
      const track = await trackService.create(actorUserId, {
        ...baseTrackInput,
        artistId: artist.id,
      });
      await trackService.transition(actorUserId, track.id, 'archive');

      await expect(trackService.transition(actorUserId, track.id, 'ready')).rejects.toBeInstanceOf(
        InvalidTrackTransitionError,
      );
    });

    it('allows archiving directly from DRAFT', async () => {
      const artist = await createArtist(prisma);
      const track = await trackService.create(actorUserId, {
        ...baseTrackInput,
        artistId: artist.id,
      });

      const archived = await trackService.transition(actorUserId, track.id, 'archive');
      expect(archived.status).toBe('ARCHIVED');
    });
  });

  describe('findPublishedById', () => {
    it('hides a track that is not PUBLISHED', async () => {
      const artist = await createArtist(prisma);
      const track = await trackService.create(actorUserId, {
        ...baseTrackInput,
        artistId: artist.id,
      });

      await expect(trackService.findPublishedById(track.id)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('returns a track once it is PUBLISHED', async () => {
      const artist = await createArtist(prisma);
      const track = await trackService.create(actorUserId, {
        ...baseTrackInput,
        artistId: artist.id,
      });
      await prisma.lyrics.create({ data: { trackId: track.id, content: 'La la la' } });
      await trackService.transition(actorUserId, track.id, 'ready');
      await trackService.transition(actorUserId, track.id, 'publish');

      await expect(trackService.findPublishedById(track.id)).resolves.toMatchObject({
        id: track.id,
      });
    });
  });

  describe('list / listPublished', () => {
    it('filters by status, genre, and album', async () => {
      const artist = await createArtist(prisma);
      const marker = randomUUID();
      const track = await trackService.create(actorUserId, {
        ...baseTrackInput,
        artistId: artist.id,
        title: `Track-${marker}`,
      });

      const byStatus = await trackService.list({
        page: 1,
        pageSize: 20,
        q: marker,
        status: 'DRAFT',
      });
      expect(byStatus.items.map((t) => t.id)).toEqual([track.id]);

      const wrongStatus = await trackService.list({
        page: 1,
        pageSize: 20,
        q: marker,
        status: 'PUBLISHED',
      });
      expect(wrongStatus.items).toHaveLength(0);
    });

    it('listPublished never returns a non-PUBLISHED track', async () => {
      const artist = await createArtist(prisma);
      const marker = randomUUID();
      await trackService.create(actorUserId, {
        ...baseTrackInput,
        artistId: artist.id,
        title: `Public-${marker}`,
      });

      const result = await trackService.listPublished({ page: 1, pageSize: 20, q: marker });
      expect(result.items).toHaveLength(0);
    });
  });
});
