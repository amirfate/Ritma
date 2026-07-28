import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { type Readable } from 'node:stream';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { type Track } from '@prisma/client';
import request from 'supertest';
import { type App } from 'supertest/types';

import { configureApp } from '../src/app.config';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { StorageService } from '../src/playback/storage.service';
import { seedRegisteredUser } from './fixtures';

const FIXTURES_DIR = join(__dirname, 'fixtures');

/**
 * Real filesystem-backed stand-in for MinIO, the same technique already
 * established for the external sms.ir dependency (`FakeSmsProvider` in
 * auth.e2e-spec.ts/invitation.e2e-spec.ts) — no live MinIO instance is
 * required to exercise the full authenticated HTTP request path with
 * genuine, reference-`flac`-encoded bytes.
 */
class FixtureStorageService {
  private readonly filesByUrl: Record<string, string> = {
    'https://fixtures.test/long-45s.flac': join(FIXTURES_DIR, 'long-45s.flac'),
    'https://fixtures.test/short-5s.flac': join(FIXTURES_DIR, 'short-5s.flac'),
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

  readRange(flacFileUrl: string, start: number, end?: number): Promise<Readable> {
    return Promise.resolve(createReadStream(this.pathFor(flacFileUrl), { start, end }));
  }
}

async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(StorageService)
    .useValue(new FixtureStorageService())
    .compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  return app;
}

function authHeader(accessToken: string): [string, string] {
  return ['Authorization', `Bearer ${accessToken}`];
}

async function createPublishedTrack(
  app: INestApplication,
  flacFileUrl: string,
  type: 'FREE' | 'PAID' = 'FREE',
): Promise<Track> {
  const prisma = app.get(PrismaService);
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

describe('Playback (e2e)', () => {
  let app: INestApplication;

  afterEach(async () => {
    await app.close();
  });

  it('walks the full FREE-track flow: create session -> stream -> end -> session no longer usable', async () => {
    app = await createTestApp();
    const server = app.getHttpServer() as App;
    const listener = await seedRegisteredUser(app);
    const track = await createPublishedTrack(app, 'https://fixtures.test/short-5s.flac', 'FREE');

    const createResponse = await request(server)
      .post('/playback/sessions')
      .set(...authHeader(listener.accessToken))
      .send({ trackId: track.id })
      .expect(201);
    expect(createResponse.body).toMatchObject({ accessType: 'FULL_FREE' });
    const sessionId = (createResponse.body as { id: string }).id;

    const streamResponse = await request(server)
      .get(`/playback/sessions/${sessionId}/stream`)
      .set(...authHeader(listener.accessToken))
      .expect(200);
    expect(streamResponse.headers['content-length']).toBe('73240');
    expect(streamResponse.headers['accept-ranges']).toBe('bytes');
    expect(streamResponse.body).not.toHaveProperty('flacFileUrl');

    await request(server)
      .post(`/playback/sessions/${sessionId}/end`)
      .set(...authHeader(listener.accessToken))
      .expect(200);

    await request(server)
      .get(`/playback/sessions/${sessionId}/stream`)
      .set(...authHeader(listener.accessToken))
      .expect(404);
  });

  it('clamps a PAID track with no purchase to exactly the validated 30-second boundary', async () => {
    app = await createTestApp();
    const server = app.getHttpServer() as App;
    const listener = await seedRegisteredUser(app);
    const track = await createPublishedTrack(app, 'https://fixtures.test/long-45s.flac', 'PAID');

    const createResponse = await request(server)
      .post('/playback/sessions')
      .set(...authHeader(listener.accessToken))
      .send({ trackId: track.id })
      .expect(201);
    expect(createResponse.body).toMatchObject({ accessType: 'PREVIEW' });
    const sessionId = (createResponse.body as { id: string }).id;

    const streamResponse = await request(server)
      .get(`/playback/sessions/${sessionId}/stream`)
      .set(...authHeader(listener.accessToken))
      .expect(200);
    expect(streamResponse.headers['content-length']).toBe('396951');

    const rangeResponse = await request(server)
      .get(`/playback/sessions/${sessionId}/stream`)
      .set(...authHeader(listener.accessToken))
      .set('Range', 'bytes=500000-500100')
      .expect(416);
    expect(rangeResponse.headers['content-range']).toBe('bytes */396951');
  });

  it('grants a full stream once a matching Purchase exists', async () => {
    app = await createTestApp();
    const server = app.getHttpServer() as App;
    const listener = await seedRegisteredUser(app);
    const track = await createPublishedTrack(app, 'https://fixtures.test/long-45s.flac', 'PAID');
    const prisma = app.get(PrismaService);
    await prisma.purchase.create({
      data: {
        userId: listener.userId,
        trackId: track.id,
        pricePaid: 2.5,
        artistShare: 2.25,
        platformShare: 0.25,
        paymentReference: `ref-${randomUUID()}`,
      },
    });

    const createResponse = await request(server)
      .post('/playback/sessions')
      .set(...authHeader(listener.accessToken))
      .send({ trackId: track.id })
      .expect(201);
    expect(createResponse.body).toMatchObject({ accessType: 'FULL_PURCHASED' });
    const sessionId = (createResponse.body as { id: string }).id;

    const streamResponse = await request(server)
      .get(`/playback/sessions/${sessionId}/stream`)
      .set(...authHeader(listener.accessToken))
      .expect(200);
    expect(streamResponse.headers['content-length']).toBe(String(593127));
  });

  it('rejects a second concurrent session for the same listener with 409', async () => {
    app = await createTestApp();
    const server = app.getHttpServer() as App;
    const listener = await seedRegisteredUser(app);
    const trackA = await createPublishedTrack(app, 'https://fixtures.test/short-5s.flac');
    const trackB = await createPublishedTrack(app, 'https://fixtures.test/short-5s.flac');

    await request(server)
      .post('/playback/sessions')
      .set(...authHeader(listener.accessToken))
      .send({ trackId: trackA.id })
      .expect(201);

    await request(server)
      .post('/playback/sessions')
      .set(...authHeader(listener.accessToken))
      .send({ trackId: trackB.id })
      .expect(409);
  });

  it('rejects creating a session for a track that is not PUBLISHED', async () => {
    app = await createTestApp();
    const server = app.getHttpServer() as App;
    const listener = await seedRegisteredUser(app);
    const prisma = app.get(PrismaService);
    const artist = await prisma.artist.create({ data: { name: `Artist-${randomUUID()}` } });
    const draftTrack = await prisma.track.create({
      data: {
        artistId: artist.id,
        title: 'Unpublished',
        genre: 'POP',
        durationSeconds: 45,
        type: 'FREE',
        flacFileUrl: 'https://fixtures.test/short-5s.flac',
        coverImageUrl: 'https://cdn.example.com/cover.jpg',
      },
    });

    await request(server)
      .post('/playback/sessions')
      .set(...authHeader(listener.accessToken))
      .send({ trackId: draftTrack.id })
      .expect(404);
  });

  it('rejects every playback route without a bearer token', async () => {
    app = await createTestApp();
    const server = app.getHttpServer() as App;
    const track = await createPublishedTrack(app, 'https://fixtures.test/short-5s.flac');

    await request(server).post('/playback/sessions').send({ trackId: track.id }).expect(401);
    await request(server).get(`/playback/sessions/${randomUUID()}/stream`).expect(401);
    await request(server).post(`/playback/sessions/${randomUUID()}/end`).expect(401);
  });

  it("rejects operating on another listener's session", async () => {
    app = await createTestApp();
    const server = app.getHttpServer() as App;
    const owner = await seedRegisteredUser(app);
    const intruder = await seedRegisteredUser(app);
    const track = await createPublishedTrack(app, 'https://fixtures.test/short-5s.flac');

    const createResponse = await request(server)
      .post('/playback/sessions')
      .set(...authHeader(owner.accessToken))
      .send({ trackId: track.id })
      .expect(201);
    const sessionId = (createResponse.body as { id: string }).id;

    await request(server)
      .get(`/playback/sessions/${sessionId}/stream`)
      .set(...authHeader(intruder.accessToken))
      .expect(404);
    await request(server)
      .post(`/playback/sessions/${sessionId}/end`)
      .set(...authHeader(intruder.accessToken))
      .expect(404);
  });

  it('rejects creating a session from a revoked device', async () => {
    app = await createTestApp();
    const server = app.getHttpServer() as App;
    const listener = await seedRegisteredUser(app);
    const track = await createPublishedTrack(app, 'https://fixtures.test/short-5s.flac');
    const prisma = app.get(PrismaService);
    await prisma.device.updateMany({
      where: { userId: listener.userId },
      data: { revokedAt: new Date() },
    });

    await request(server)
      .post('/playback/sessions')
      .set(...authHeader(listener.accessToken))
      .send({ trackId: track.id })
      .expect(403);
  });
});
