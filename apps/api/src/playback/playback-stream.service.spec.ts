import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { type Readable } from 'node:stream';

import { type Track, type User } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { PlaybackSessionService } from './playback-session.service';
import { PlaybackStreamService } from './playback-stream.service';
import { type StorageService } from './storage.service';

const FIXTURES_DIR = join(__dirname, '../../test/fixtures');

/**
 * A real filesystem-backed stand-in for `StorageService`, so these tests
 * exercise the actual Range/preview-clamp orchestration against genuine
 * FLAC bytes without needing a running MinIO instance. Every fixture URL
 * below maps to a real, reference-`flac`-encoded file already validated
 * against the reference decoder in flac-boundary.spec.ts.
 */
class FixtureStorageService {
  private readonly filesByUrl: Record<string, string> = {
    'https://fixtures.test/long-45s.flac': join(FIXTURES_DIR, 'long-45s.flac'),
    'https://fixtures.test/short-5s.flac': join(FIXTURES_DIR, 'short-5s.flac'),
    'https://fixtures.test/tiny-1s.flac': join(FIXTURES_DIR, 'tiny-1s.flac'),
  };

  private pathFor(flacFileUrl: string): string {
    const path = this.filesByUrl[flacFileUrl];
    if (!path) throw new Error(`No fixture mapped for ${flacFileUrl}`);
    return path;
  }

  async getObjectSize(flacFileUrl: string): Promise<number> {
    const stats = await stat(this.pathFor(flacFileUrl));
    return stats.size;
  }

  readRange(
    flacFileUrl: string,
    startByteInclusive: number,
    endByteInclusive?: number,
  ): Promise<Readable> {
    return Promise.resolve(
      createReadStream(this.pathFor(flacFileUrl), {
        start: startByteInclusive,
        end: endByteInclusive,
      }),
    );
  }
}

function randomPhoneNumber(): string {
  return `+9892${randomUUID().replace(/\D/g, '').slice(0, 8)}`;
}

async function readAll(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

describe('PlaybackStreamService', () => {
  let prisma: PrismaService;
  let sessionService: PlaybackSessionService;
  let streamService: PlaybackStreamService;
  let user: User;
  let deviceId: string;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    sessionService = new PlaybackSessionService(prisma);
    streamService = new PlaybackStreamService(
      prisma,
      sessionService,
      new FixtureStorageService() as unknown as StorageService,
    );

    user = await prisma.user.create({ data: { phoneNumber: randomPhoneNumber() } });
    const device = await prisma.device.create({
      data: { userId: user.id, fingerprint: `dev-${randomUUID()}`, platform: 'android' },
    });
    deviceId = device.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function createTrack(flacFileUrl: string, type: 'FREE' | 'PAID' = 'FREE'): Promise<Track> {
    const artist = await prisma.artist.create({ data: { name: `Artist-${randomUUID()}` } });
    return prisma.track.create({
      data: {
        artistId: artist.id,
        title: `Track-${randomUUID()}`,
        genre: 'POP',
        durationSeconds: 45,
        type,
        price: type === 'PAID' ? 2.5 : undefined,
        flacFileUrl,
        coverImageUrl: 'https://cdn.example.com/cover.jpg',
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    });
  }

  async function endActiveSession(userId: string): Promise<void> {
    await prisma.playbackSession.updateMany({
      where: { userId, endedAt: null },
      data: { endedAt: new Date() },
    });
  }

  it('serves the full object with no Range header for a FULL_FREE session', async () => {
    await endActiveSession(user.id);
    const track = await createTrack('https://fixtures.test/short-5s.flac', 'FREE');
    const session = await sessionService.createSession(user.id, deviceId, track.id);
    expect(session.accessType).toBe('FULL_FREE');

    const prepared = await streamService.prepare(user.id, session.id, undefined);
    if (prepared.status === 416) throw new Error('expected a servable range');
    expect(prepared.status).toBe(200);
    expect(prepared.start).toBe(0);
    expect(prepared.contentLimit).toBe(73240);
    expect(prepared.end).toBe(73240 - 1);

    const buffer = await readAll(prepared.stream);
    expect(buffer.length).toBe(73240);
  });

  it('honors a Range header for a full-access session', async () => {
    await endActiveSession(user.id);
    const track = await createTrack('https://fixtures.test/short-5s.flac', 'FREE');
    const session = await sessionService.createSession(user.id, deviceId, track.id);

    const prepared = await streamService.prepare(user.id, session.id, 'bytes=100-199');
    if (prepared.status === 416) throw new Error('expected a servable range');
    expect(prepared.status).toBe(206);
    expect(prepared.start).toBe(100);
    expect(prepared.end).toBe(199);

    const buffer = await readAll(prepared.stream);
    expect(buffer.length).toBe(100);
  });

  it('serves the whole track for a PREVIEW session when it is already shorter than 30 seconds', async () => {
    await endActiveSession(user.id);
    const track = await createTrack('https://fixtures.test/tiny-1s.flac', 'PAID');
    const session = await sessionService.createSession(user.id, deviceId, track.id);
    expect(session.accessType).toBe('PREVIEW');

    const prepared = await streamService.prepare(user.id, session.id, undefined);
    if (prepared.status === 416) throw new Error('expected a servable range');
    expect(prepared.contentLimit).toBe(21011);
  });

  it('clamps a PREVIEW session on a track longer than 30 seconds to the exact validated frame boundary', async () => {
    await endActiveSession(user.id);
    const track = await createTrack('https://fixtures.test/long-45s.flac', 'PAID');
    const session = await sessionService.createSession(user.id, deviceId, track.id);
    expect(session.accessType).toBe('PREVIEW');

    const prepared = await streamService.prepare(user.id, session.id, undefined);
    if (prepared.status === 416) throw new Error('expected a servable range');
    // Independently cross-validated in the FLAC boundary investigation:
    // truncating this exact fixture at byte 396951 decodes to precisely
    // 1,318,912 samples (≈29.9s) through the reference flac decoder.
    expect(prepared.contentLimit).toBe(396951);
    expect(prepared.end).toBe(396951 - 1);

    const buffer = await readAll(prepared.stream);
    expect(buffer.length).toBe(396951);
  });

  it('rejects a Range request past the PREVIEW clamp with 416, even though the real file is longer', async () => {
    await endActiveSession(user.id);
    const track = await createTrack('https://fixtures.test/long-45s.flac', 'PAID');
    const session = await sessionService.createSession(user.id, deviceId, track.id);

    const prepared = await streamService.prepare(user.id, session.id, 'bytes=500000-500100');
    expect(prepared).toEqual({ status: 416, contentLimit: 396951 });
  });

  it('never lets a PREVIEW session reconnect its way past the clamp via a larger Range request', async () => {
    await endActiveSession(user.id);
    const track = await createTrack('https://fixtures.test/long-45s.flac', 'PAID');
    const session = await sessionService.createSession(user.id, deviceId, track.id);

    const prepared = await streamService.prepare(user.id, session.id, 'bytes=0-999999999');
    if (prepared.status === 416) throw new Error('expected a servable range');
    expect(prepared.end).toBeLessThan(396951);
    expect(prepared.contentLimit).toBe(396951);
  });
});
