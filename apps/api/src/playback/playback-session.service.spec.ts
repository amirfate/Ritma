import { randomUUID } from 'node:crypto';

import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { type Device, type Track, type User } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { PlaybackSessionService } from './playback-session.service';
import { PLAYBACK_SESSION_MAX_DURATION_MS } from './playback.constants';
import { ConcurrentPlaybackSessionError } from './playback.errors';

function randomPhoneNumber(): string {
  return `+9891${randomUUID().replace(/\D/g, '').slice(0, 8)}`;
}

async function createUserWithDevice(
  prisma: PrismaService,
): Promise<{ user: User; device: Device }> {
  const user = await prisma.user.create({ data: { phoneNumber: randomPhoneNumber() } });
  const device = await prisma.device.create({
    data: { userId: user.id, fingerprint: `dev-${randomUUID()}`, platform: 'android' },
  });
  return { user, device };
}

async function createTrack(
  prisma: PrismaService,
  overrides: Partial<{ type: 'FREE' | 'PAID'; price: number; status: string }> = {},
): Promise<Track> {
  const artist = await prisma.artist.create({ data: { name: `Artist-${randomUUID()}` } });
  return prisma.track.create({
    data: {
      artistId: artist.id,
      title: `Track-${randomUUID()}`,
      genre: 'POP',
      durationSeconds: 200,
      type: overrides.type ?? 'FREE',
      price: overrides.price,
      flacFileUrl: 'https://cdn.example.com/track.flac',
      coverImageUrl: 'https://cdn.example.com/cover.jpg',
      status: (overrides.status ?? 'PUBLISHED') as Track['status'],
      publishedAt: new Date(),
    },
  });
}

describe('PlaybackSessionService', () => {
  let prisma: PrismaService;
  let service: PlaybackSessionService;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    service = new PlaybackSessionService(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('createSession — access policy', () => {
    it('grants FULL_FREE for a FREE track', async () => {
      const { user, device } = await createUserWithDevice(prisma);
      const track = await createTrack(prisma, { type: 'FREE' });

      const session = await service.createSession(user.id, device.id, track.id);
      expect(session.accessType).toBe('FULL_FREE');
    });

    it('grants PREVIEW for a PAID track with no purchase', async () => {
      const { user, device } = await createUserWithDevice(prisma);
      const track = await createTrack(prisma, { type: 'PAID', price: 2.5 });

      const session = await service.createSession(user.id, device.id, track.id);
      expect(session.accessType).toBe('PREVIEW');
    });

    it('grants FULL_PURCHASED for a PAID track with a matching purchase', async () => {
      const { user, device } = await createUserWithDevice(prisma);
      const track = await createTrack(prisma, { type: 'PAID', price: 2.5 });
      await prisma.purchase.create({
        data: {
          userId: user.id,
          trackId: track.id,
          pricePaid: 2.5,
          artistShare: 2.25,
          platformShare: 0.25,
          paymentReference: `ref-${randomUUID()}`,
        },
      });

      const session = await service.createSession(user.id, device.id, track.id);
      expect(session.accessType).toBe('FULL_PURCHASED');
    });
  });

  describe('createSession — visibility and device checks', () => {
    it('rejects a non-PUBLISHED track with NotFoundException', async () => {
      const { user, device } = await createUserWithDevice(prisma);
      const track = await createTrack(prisma, { status: 'DRAFT' });

      await expect(service.createSession(user.id, device.id, track.id)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('rejects a device that does not belong to the caller', async () => {
      const { user } = await createUserWithDevice(prisma);
      const { device: otherDevice } = await createUserWithDevice(prisma);
      const track = await createTrack(prisma);

      await expect(service.createSession(user.id, otherDevice.id, track.id)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('rejects a revoked device', async () => {
      const { user, device } = await createUserWithDevice(prisma);
      await prisma.device.update({ where: { id: device.id }, data: { revokedAt: new Date() } });
      const track = await createTrack(prisma);

      await expect(service.createSession(user.id, device.id, track.id)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });

  describe('one active session per listener', () => {
    it('rejects a second concurrent session while the first is active', async () => {
      const { user, device } = await createUserWithDevice(prisma);
      const trackA = await createTrack(prisma);
      const trackB = await createTrack(prisma);

      await service.createSession(user.id, device.id, trackA.id);

      await expect(service.createSession(user.id, device.id, trackB.id)).rejects.toBeInstanceOf(
        ConcurrentPlaybackSessionError,
      );
    });

    it('allows a new session once the previous one is explicitly ended', async () => {
      const { user, device } = await createUserWithDevice(prisma);
      const trackA = await createTrack(prisma);
      const trackB = await createTrack(prisma);

      const first = await service.createSession(user.id, device.id, trackA.id);
      await service.endSession(user.id, first.id);

      await expect(service.createSession(user.id, device.id, trackB.id)).resolves.toMatchObject({
        trackId: trackB.id,
      });
    });

    it('allows a new session once the previous one is past the TTL, and reclaims it', async () => {
      const { user, device } = await createUserWithDevice(prisma);
      const trackA = await createTrack(prisma);
      const trackB = await createTrack(prisma);

      const first = await service.createSession(user.id, device.id, trackA.id);
      await prisma.playbackSession.update({
        where: { id: first.id },
        data: { startedAt: new Date(Date.now() - PLAYBACK_SESSION_MAX_DURATION_MS - 1000) },
      });

      const second = await service.createSession(user.id, device.id, trackB.id);
      expect(second.trackId).toBe(trackB.id);

      const reclaimed = await prisma.playbackSession.findUniqueOrThrow({
        where: { id: first.id },
      });
      expect(reclaimed.endedAt).not.toBeNull();
    });

    it('only lets one of two concurrent creation attempts for the same user succeed', async () => {
      const { user, device } = await createUserWithDevice(prisma);
      const trackA = await createTrack(prisma);
      const trackB = await createTrack(prisma);

      const results = await Promise.allSettled([
        service.createSession(user.id, device.id, trackA.id),
        service.createSession(user.id, device.id, trackB.id),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
    });
  });

  describe('getActiveSessionForUser / endSession', () => {
    it('returns a caller-owned active session', async () => {
      const { user, device } = await createUserWithDevice(prisma);
      const track = await createTrack(prisma);
      const session = await service.createSession(user.id, device.id, track.id);

      await expect(service.getActiveSessionForUser(user.id, session.id)).resolves.toMatchObject({
        id: session.id,
      });
    });

    it('rejects fetching another user session', async () => {
      const { user, device } = await createUserWithDevice(prisma);
      const { user: otherUser } = await createUserWithDevice(prisma);
      const track = await createTrack(prisma);
      const session = await service.createSession(user.id, device.id, track.id);

      await expect(
        service.getActiveSessionForUser(otherUser.id, session.id),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects fetching an ended session', async () => {
      const { user, device } = await createUserWithDevice(prisma);
      const track = await createTrack(prisma);
      const session = await service.createSession(user.id, device.id, track.id);
      await service.endSession(user.id, session.id);

      await expect(service.getActiveSessionForUser(user.id, session.id)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('is idempotent when ending an already-ended session', async () => {
      const { user, device } = await createUserWithDevice(prisma);
      const track = await createTrack(prisma);
      const session = await service.createSession(user.id, device.id, track.id);

      await service.endSession(user.id, session.id);
      await expect(service.endSession(user.id, session.id)).resolves.toBeUndefined();
    });

    it('rejects ending a session owned by another user', async () => {
      const { user, device } = await createUserWithDevice(prisma);
      const { user: otherUser } = await createUserWithDevice(prisma);
      const track = await createTrack(prisma);
      const session = await service.createSession(user.id, device.id, track.id);

      await expect(service.endSession(otherUser.id, session.id)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
