import { randomUUID } from 'node:crypto';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { type App } from 'supertest/types';

import { configureApp } from '../src/app.config';
import { AppModule } from '../src/app.module';
import { seedAdminUser, seedRegisteredUser } from './fixtures';

async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  return app;
}

function authHeader(accessToken: string): [string, string] {
  return ['Authorization', `Bearer ${accessToken}`];
}

interface AdminArtist {
  id: string;
  isActive: boolean;
}
interface AdminAlbum {
  id: string;
  isPublished: boolean;
}
interface AdminTrack {
  id: string;
  status: string;
}

const flacUrl = 'https://cdn.example.com/track.flac';
const coverUrl = 'https://cdn.example.com/cover.jpg';

describe('Catalog (e2e)', () => {
  let app: INestApplication;

  afterEach(async () => {
    await app.close();
  });

  it('walks the full admin flow: create Artist -> Album -> Track -> Lyrics -> publish', async () => {
    app = await createTestApp();
    const admin = await seedAdminUser(app);
    const server = app.getHttpServer() as App;

    const artistResponse = await request(server)
      .post('/admin/artists')
      .set(...authHeader(admin.accessToken))
      .send({ name: `Artist-${randomUUID()}` })
      .expect(201);
    const artist = artistResponse.body as AdminArtist;

    const albumResponse = await request(server)
      .post('/admin/albums')
      .set(...authHeader(admin.accessToken))
      .send({ artistId: artist.id, title: 'Debut Album', coverImageUrl: coverUrl })
      .expect(201);
    const album = albumResponse.body as AdminAlbum;

    const trackResponse = await request(server)
      .post('/admin/tracks')
      .set(...authHeader(admin.accessToken))
      .send({
        artistId: artist.id,
        albumId: album.id,
        title: 'Track One',
        genre: 'POP',
        durationSeconds: 200,
        type: 'FREE',
        flacFileUrl: flacUrl,
        coverImageUrl: coverUrl,
      })
      .expect(201);
    const track = trackResponse.body as AdminTrack;
    expect(track.status).toBe('DRAFT');

    await request(server)
      .post(`/admin/tracks/${track.id}/lyrics`)
      .set(...authHeader(admin.accessToken))
      .send({ content: 'La la la' })
      .expect(201);

    await request(server)
      .post(`/admin/tracks/${track.id}/ready`)
      .set(...authHeader(admin.accessToken))
      .expect(200);

    const publishResponse = await request(server)
      .post(`/admin/tracks/${track.id}/publish`)
      .set(...authHeader(admin.accessToken))
      .expect(200);
    expect((publishResponse.body as AdminTrack).status).toBe('PUBLISHED');

    // Publishing the album and enabling the artist so the whole chain is
    // visible end-to-end through the public API.
    await request(server)
      .post(`/admin/albums/${album.id}/publish`)
      .set(...authHeader(admin.accessToken))
      .expect(200);

    const publicTrack = await request(server).get(`/tracks/${track.id}`).expect(200);
    expect(publicTrack.body).toMatchObject({ id: track.id, title: 'Track One' });
    expect(publicTrack.body).not.toHaveProperty('flacFileUrl');
    expect(publicTrack.body).not.toHaveProperty('status');

    await request(server).get(`/albums/${album.id}`).expect(200);
    await request(server).get(`/artists/${artist.id}`).expect(200);
  });

  it('rejects publishing a track with no lyrics', async () => {
    app = await createTestApp();
    const admin = await seedAdminUser(app);
    const server = app.getHttpServer() as App;

    const artist = (
      await request(server)
        .post('/admin/artists')
        .set(...authHeader(admin.accessToken))
        .send({ name: `Artist-${randomUUID()}` })
        .expect(201)
    ).body as AdminArtist;

    const track = (
      await request(server)
        .post('/admin/tracks')
        .set(...authHeader(admin.accessToken))
        .send({
          artistId: artist.id,
          title: 'No Lyrics',
          genre: 'ROCK',
          durationSeconds: 150,
          type: 'FREE',
          flacFileUrl: flacUrl,
          coverImageUrl: coverUrl,
        })
        .expect(201)
    ).body as AdminTrack;

    await request(server)
      .post(`/admin/tracks/${track.id}/ready`)
      .set(...authHeader(admin.accessToken))
      .expect(200);

    const response = await request(server)
      .post(`/admin/tracks/${track.id}/publish`)
      .set(...authHeader(admin.accessToken))
      .expect(400);
    expect((response.body as { reasons: string[] }).reasons).toContain(
      'lyrics are required before publishing',
    );
  });

  it('rejects publishing a track whose artist has been disabled', async () => {
    app = await createTestApp();
    const admin = await seedAdminUser(app);
    const server = app.getHttpServer() as App;

    const artist = (
      await request(server)
        .post('/admin/artists')
        .set(...authHeader(admin.accessToken))
        .send({ name: `Artist-${randomUUID()}` })
        .expect(201)
    ).body as AdminArtist;

    const track = (
      await request(server)
        .post('/admin/tracks')
        .set(...authHeader(admin.accessToken))
        .send({
          artistId: artist.id,
          title: 'Inactive Artist Track',
          genre: 'ROCK',
          durationSeconds: 150,
          type: 'FREE',
          flacFileUrl: flacUrl,
          coverImageUrl: coverUrl,
        })
        .expect(201)
    ).body as AdminTrack;

    await request(server)
      .post(`/admin/tracks/${track.id}/lyrics`)
      .set(...authHeader(admin.accessToken))
      .send({ content: 'La la la' })
      .expect(201);
    await request(server)
      .post(`/admin/tracks/${track.id}/ready`)
      .set(...authHeader(admin.accessToken))
      .expect(200);

    await request(server)
      .post(`/admin/artists/${artist.id}/disable`)
      .set(...authHeader(admin.accessToken))
      .expect(200);

    const response = await request(server)
      .post(`/admin/tracks/${track.id}/publish`)
      .set(...authHeader(admin.accessToken))
      .expect(400);
    expect((response.body as { reasons: string[] }).reasons).toContain(
      "the track's artist must be active",
    );
  });

  it('rejects an invalid lifecycle transition (publish a DRAFT track directly)', async () => {
    app = await createTestApp();
    const admin = await seedAdminUser(app);
    const server = app.getHttpServer() as App;

    const artist = (
      await request(server)
        .post('/admin/artists')
        .set(...authHeader(admin.accessToken))
        .send({ name: `Artist-${randomUUID()}` })
        .expect(201)
    ).body as AdminArtist;

    const track = (
      await request(server)
        .post('/admin/tracks')
        .set(...authHeader(admin.accessToken))
        .send({
          artistId: artist.id,
          title: 'Straight to Publish',
          genre: 'ROCK',
          durationSeconds: 150,
          type: 'FREE',
          flacFileUrl: flacUrl,
          coverImageUrl: coverUrl,
        })
        .expect(201)
    ).body as AdminTrack;

    await request(server)
      .post(`/admin/tracks/${track.id}/publish`)
      .set(...authHeader(admin.accessToken))
      .expect(400);
  });

  it('rejects catalog mutations from a non-admin authenticated user', async () => {
    app = await createTestApp();
    const listener = await seedRegisteredUser(app);
    const server = app.getHttpServer() as App;

    await request(server)
      .post('/admin/artists')
      .set(...authHeader(listener.accessToken))
      .send({ name: 'Should Not Work' })
      .expect(403);

    await request(server)
      .post('/admin/albums')
      .set(...authHeader(listener.accessToken))
      .send({ artistId: 'irrelevant', title: 'x', coverImageUrl: coverUrl })
      .expect(403);

    await request(server)
      .post('/admin/tracks')
      .set(...authHeader(listener.accessToken))
      .send({
        artistId: 'irrelevant',
        title: 'x',
        genre: 'POP',
        durationSeconds: 100,
        type: 'FREE',
        flacFileUrl: flacUrl,
        coverImageUrl: coverUrl,
      })
      .expect(403);
  });

  it('rejects catalog mutations with no bearer token at all', async () => {
    app = await createTestApp();
    const server = app.getHttpServer() as App;

    await request(server).post('/admin/artists').send({ name: 'Anonymous' }).expect(401);
    await request(server).get('/admin/artists').expect(401);
  });

  it('public catalog hides disabled artists, unpublished albums, and non-published tracks', async () => {
    app = await createTestApp();
    const admin = await seedAdminUser(app);
    const server = app.getHttpServer() as App;
    const marker = randomUUID();

    const artist = (
      await request(server)
        .post('/admin/artists')
        .set(...authHeader(admin.accessToken))
        .send({ name: `Hidden-${marker}` })
        .expect(201)
    ).body as AdminArtist;
    await request(server)
      .post(`/admin/artists/${artist.id}/disable`)
      .set(...authHeader(admin.accessToken))
      .expect(200);

    const album = (
      await request(server)
        .post('/admin/albums')
        .set(...authHeader(admin.accessToken))
        .send({ artistId: artist.id, title: `Hidden-${marker}`, coverImageUrl: coverUrl })
        .expect(201)
    ).body as AdminAlbum;

    const track = (
      await request(server)
        .post('/admin/tracks')
        .set(...authHeader(admin.accessToken))
        .send({
          artistId: artist.id,
          title: `Hidden-${marker}`,
          genre: 'POP',
          durationSeconds: 100,
          type: 'FREE',
          flacFileUrl: flacUrl,
          coverImageUrl: coverUrl,
        })
        .expect(201)
    ).body as AdminTrack;

    await request(server).get(`/artists/${artist.id}`).expect(404);
    await request(server).get(`/albums/${album.id}`).expect(404);
    await request(server).get(`/tracks/${track.id}`).expect(404);

    const artistList = await request(server).get(`/artists?q=${marker}`).expect(200);
    expect((artistList.body as { items: unknown[] }).items).toHaveLength(0);

    const albumList = await request(server).get(`/albums?q=${marker}`).expect(200);
    expect((albumList.body as { items: unknown[] }).items).toHaveLength(0);

    const trackList = await request(server).get(`/tracks?q=${marker}`).expect(200);
    expect((trackList.body as { items: unknown[] }).items).toHaveLength(0);
  });

  it('supports title search, genre filter, and pagination on the public track list', async () => {
    app = await createTestApp();
    const admin = await seedAdminUser(app);
    const server = app.getHttpServer() as App;
    const marker = randomUUID();

    const artist = (
      await request(server)
        .post('/admin/artists')
        .set(...authHeader(admin.accessToken))
        .send({ name: `Artist-${marker}` })
        .expect(201)
    ).body as AdminArtist;

    for (const genre of ['POP', 'ROCK'] as const) {
      const track = (
        await request(server)
          .post('/admin/tracks')
          .set(...authHeader(admin.accessToken))
          .send({
            artistId: artist.id,
            title: `Searchable-${marker}-${genre}`,
            genre,
            durationSeconds: 100,
            type: 'FREE',
            flacFileUrl: flacUrl,
            coverImageUrl: coverUrl,
          })
          .expect(201)
      ).body as AdminTrack;

      await request(server)
        .post(`/admin/tracks/${track.id}/lyrics`)
        .set(...authHeader(admin.accessToken))
        .send({ content: 'La la la' })
        .expect(201);
      await request(server)
        .post(`/admin/tracks/${track.id}/ready`)
        .set(...authHeader(admin.accessToken))
        .expect(200);
      await request(server)
        .post(`/admin/tracks/${track.id}/publish`)
        .set(...authHeader(admin.accessToken))
        .expect(200);
    }

    const byTitle = await request(server).get(`/tracks?q=${marker}`).expect(200);
    expect((byTitle.body as { items: unknown[]; total: number }).total).toBe(2);

    const byGenre = await request(server).get(`/tracks?q=${marker}&genre=ROCK`).expect(200);
    expect((byGenre.body as { items: { genre: string }[] }).items).toHaveLength(1);
    expect((byGenre.body as { items: { genre: string }[] }).items[0]?.genre).toBe('ROCK');

    const paged = await request(server).get(`/tracks?q=${marker}&page=1&pageSize=1`).expect(200);
    expect(
      paged.body as { items: unknown[]; page: number; pageSize: number; total: number },
    ).toMatchObject({ page: 1, pageSize: 1, total: 2 });
    expect((paged.body as { items: unknown[] }).items).toHaveLength(1);
  });

  it('admin status filtering finds tracks by lifecycle status', async () => {
    app = await createTestApp();
    const admin = await seedAdminUser(app);
    const server = app.getHttpServer() as App;
    const marker = randomUUID();

    const artist = (
      await request(server)
        .post('/admin/artists')
        .set(...authHeader(admin.accessToken))
        .send({ name: `Artist-${marker}` })
        .expect(201)
    ).body as AdminArtist;

    await request(server)
      .post('/admin/tracks')
      .set(...authHeader(admin.accessToken))
      .send({
        artistId: artist.id,
        title: `Status-${marker}`,
        genre: 'POP',
        durationSeconds: 100,
        type: 'FREE',
        flacFileUrl: flacUrl,
        coverImageUrl: coverUrl,
      })
      .expect(201);

    const draftOnly = await request(server)
      .get(`/admin/tracks?q=${marker}&status=DRAFT`)
      .set(...authHeader(admin.accessToken))
      .expect(200);
    expect((draftOnly.body as { items: unknown[] }).items).toHaveLength(1);

    const publishedOnly = await request(server)
      .get(`/admin/tracks?q=${marker}&status=PUBLISHED`)
      .set(...authHeader(admin.accessToken))
      .expect(200);
    expect((publishedOnly.body as { items: unknown[] }).items).toHaveLength(0);
  });
});
