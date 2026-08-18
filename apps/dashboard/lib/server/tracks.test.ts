import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import { createTrack, getTrack, listTracks, transitionTrack, updateTrack } from './tracks.ts';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

interface Captured {
  url?: string;
  method?: string;
  headers?: HeadersInit;
  body?: string;
}

function mockFetch(status: number, responseBody: unknown, captured: Captured): void {
  globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    captured.url = typeof input === 'string' ? input : undefined;
    captured.method = init?.method;
    captured.headers = init?.headers;
    captured.body = typeof init?.body === 'string' ? init.body : undefined;
    return Promise.resolve(new Response(JSON.stringify(responseBody), { status }));
  };
}

const sampleTrack = {
  id: 'track-1',
  artistId: 'artist-1',
  albumId: null,
  title: 'Sample',
  genre: 'POP',
  durationSeconds: 180,
  type: 'FREE',
  price: null,
  flacFileUrl: 'https://example.com/track.flac',
  coverImageUrl: 'https://example.com/cover.jpg',
  credits: null,
  story: null,
  status: 'DRAFT',
  createdAt: '',
  updatedAt: '',
  publishedAt: null,
  archivedAt: null,
};

void test('listTracks builds a query string from every backend-supported filter and sends the bearer token', async () => {
  const captured: Captured = {};
  mockFetch(200, { items: [], page: 1, pageSize: 20, total: 0 }, captured);

  await listTracks('token-1', {
    page: 2,
    pageSize: 10,
    q: 'anthem',
    artistId: 'artist-1',
    albumId: 'album-1',
    genre: 'ROCK',
    status: 'PUBLISHED',
  });

  const query = new URL(captured.url ?? '', 'http://x').searchParams;
  assert.equal(query.get('page'), '2');
  assert.equal(query.get('pageSize'), '10');
  assert.equal(query.get('q'), 'anthem');
  assert.equal(query.get('artistId'), 'artist-1');
  assert.equal(query.get('albumId'), 'album-1');
  assert.equal(query.get('genre'), 'ROCK');
  assert.equal(query.get('status'), 'PUBLISHED');
  assert.deepEqual(captured.headers, { authorization: 'Bearer token-1' });
});

void test('listTracks omits unset query params entirely', async () => {
  const captured: Captured = {};
  mockFetch(200, { items: [], page: 1, pageSize: 20, total: 0 }, captured);

  await listTracks('token-1', {});

  assert.equal(captured.url, 'http://localhost:3000/admin/tracks');
});

void test('getTrack requests /admin/tracks/:id', async () => {
  const captured: Captured = {};
  mockFetch(200, sampleTrack, captured);

  const result = await getTrack('token-1', 'track-1');

  assert.equal(result.ok, true);
  assert.equal(captured.url, 'http://localhost:3000/admin/tracks/track-1');
});

void test('createTrack POSTs the DTO to /admin/tracks, with no status field', async () => {
  const captured: Captured = {};
  mockFetch(201, sampleTrack, captured);

  await createTrack('token-1', {
    artistId: 'artist-1',
    title: 'Sample',
    genre: 'POP',
    durationSeconds: 180,
    type: 'FREE',
    flacFileUrl: 'https://example.com/track.flac',
    coverImageUrl: 'https://example.com/cover.jpg',
  });

  assert.equal(captured.method, 'POST');
  assert.equal(captured.url, 'http://localhost:3000/admin/tracks');
  const sentBody = JSON.parse(captured.body ?? '{}') as Record<string, unknown>;
  assert.equal('status' in sentBody, false);
});

void test('updateTrack PATCHes /admin/tracks/:id and never sends artistId (immutable after creation)', async () => {
  const captured: Captured = {};
  mockFetch(200, sampleTrack, captured);

  await updateTrack('token-1', 'track-1', { title: 'Renamed' });

  assert.equal(captured.method, 'PATCH');
  assert.equal(captured.url, 'http://localhost:3000/admin/tracks/track-1');
  const sentBody = JSON.parse(captured.body ?? '{}') as Record<string, unknown>;
  assert.deepEqual(sentBody, { title: 'Renamed' });
  assert.equal('artistId' in sentBody, false);
});

void test('updateTrack can explicitly clear albumId by sending null', async () => {
  const captured: Captured = {};
  mockFetch(200, sampleTrack, captured);

  await updateTrack('token-1', 'track-1', { albumId: null });

  const sentBody = JSON.parse(captured.body ?? '{}') as Record<string, unknown>;
  assert.equal(sentBody.albumId, null);
});

void test('transitionTrack(ready) POSTs to /admin/tracks/:id/ready', async () => {
  const captured: Captured = {};
  mockFetch(200, sampleTrack, captured);

  await transitionTrack('token-1', 'track-1', 'ready');

  assert.equal(captured.method, 'POST');
  assert.equal(captured.url, 'http://localhost:3000/admin/tracks/track-1/ready');
});

void test('transitionTrack(publish) POSTs to /admin/tracks/:id/publish', async () => {
  const captured: Captured = {};
  mockFetch(200, sampleTrack, captured);

  await transitionTrack('token-1', 'track-1', 'publish');

  assert.equal(captured.url, 'http://localhost:3000/admin/tracks/track-1/publish');
});

void test('transitionTrack(unpublish) POSTs to /admin/tracks/:id/unpublish', async () => {
  const captured: Captured = {};
  mockFetch(200, sampleTrack, captured);

  await transitionTrack('token-1', 'track-1', 'unpublish');

  assert.equal(captured.url, 'http://localhost:3000/admin/tracks/track-1/unpublish');
});

void test('transitionTrack(archive) POSTs to /admin/tracks/:id/archive', async () => {
  const captured: Captured = {};
  mockFetch(200, sampleTrack, captured);

  await transitionTrack('token-1', 'track-1', 'archive');

  assert.equal(captured.url, 'http://localhost:3000/admin/tracks/track-1/archive');
});

void test('an InvalidTrackTransitionError (400) is surfaced as ok:false with the exact backend body', async () => {
  const captured: Captured = {};
  mockFetch(
    400,
    {
      statusCode: 400,
      message: 'Cannot publish a track that is currently DRAFT.',
      currentStatus: 'DRAFT',
      action: 'publish',
    },
    captured,
  );

  const result = await transitionTrack('token-1', 'track-1', 'publish');

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.status, 400);
    assert.equal((result.body as { currentStatus: string }).currentStatus, 'DRAFT');
  }
});

void test('a PublishPrerequisitesNotMetError (400) preserves the reasons array', async () => {
  const captured: Captured = {};
  mockFetch(
    400,
    {
      statusCode: 400,
      message: 'The track cannot be published until all prerequisites are met.',
      reasons: ['lyrics are required before publishing', "the track's artist must be active"],
    },
    captured,
  );

  const result = await transitionTrack('token-1', 'track-1', 'publish');

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.deepEqual((result.body as { reasons: string[] }).reasons, [
      'lyrics are required before publishing',
      "the track's artist must be active",
    ]);
  }
});
