import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import { createAlbum, getAlbum, listAlbums, setAlbumPublished, updateAlbum } from './albums.ts';

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

const sampleAlbum = {
  id: 'album-1',
  artistId: 'artist-1',
  title: 'Sample',
  coverImageUrl: 'https://example.com/cover.jpg',
  releasedAt: null,
  isPublished: false,
  createdAt: '',
  updatedAt: '',
};

void test('listAlbums builds a query string from page/pageSize/q/artistId/isPublished and sends the bearer token', async () => {
  const captured: Captured = {};
  mockFetch(200, { items: [], page: 1, pageSize: 20, total: 0 }, captured);

  const result = await listAlbums('token-1', {
    page: 3,
    pageSize: 5,
    q: 'greatest',
    artistId: 'artist-9',
    isPublished: false,
  });

  assert.equal(result.ok, true);
  const query = new URL(captured.url ?? '', 'http://x').searchParams;
  assert.equal(query.get('page'), '3');
  assert.equal(query.get('pageSize'), '5');
  assert.equal(query.get('q'), 'greatest');
  assert.equal(query.get('artistId'), 'artist-9');
  assert.equal(query.get('isPublished'), 'false');
  assert.deepEqual(captured.headers, { authorization: 'Bearer token-1' });
});

void test('listAlbums omits unset query params entirely', async () => {
  const captured: Captured = {};
  mockFetch(200, { items: [], page: 1, pageSize: 20, total: 0 }, captured);

  await listAlbums('token-1', {});

  assert.equal(captured.url, 'http://localhost:3000/admin/albums');
});

void test('getAlbum requests /admin/albums/:id', async () => {
  const captured: Captured = {};
  mockFetch(200, sampleAlbum, captured);

  const result = await getAlbum('token-1', 'album-1');

  assert.equal(result.ok, true);
  assert.equal(captured.url, 'http://localhost:3000/admin/albums/album-1');
});

void test('createAlbum POSTs the DTO — including a required coverImageUrl — to /admin/albums', async () => {
  const captured: Captured = {};
  mockFetch(201, sampleAlbum, captured);

  const result = await createAlbum('token-1', {
    artistId: 'artist-1',
    title: 'Sample',
    coverImageUrl: 'https://example.com/cover.jpg',
  });

  assert.equal(result.ok, true);
  assert.equal(captured.method, 'POST');
  assert.equal(captured.url, 'http://localhost:3000/admin/albums');
  assert.deepEqual(JSON.parse(captured.body ?? '{}'), {
    artistId: 'artist-1',
    title: 'Sample',
    coverImageUrl: 'https://example.com/cover.jpg',
  });
});

void test('a 404 on createAlbum (nonexistent artistId) is surfaced as ok:false, not thrown', async () => {
  const captured: Captured = {};
  mockFetch(404, { statusCode: 404, message: 'Artist not found', error: 'Not Found' }, captured);

  const result = await createAlbum('token-1', {
    artistId: 'missing',
    title: 'X',
    coverImageUrl: 'https://x.test/a.jpg',
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.status, 404);
  }
});

void test('updateAlbum PATCHes /admin/albums/:id and never sends artistId (not a field the backend accepts)', async () => {
  const captured: Captured = {};
  mockFetch(200, sampleAlbum, captured);

  await updateAlbum('token-1', 'album-1', { title: 'Renamed' });

  assert.equal(captured.method, 'PATCH');
  assert.equal(captured.url, 'http://localhost:3000/admin/albums/album-1');
  const sentBody = JSON.parse(captured.body ?? '{}') as Record<string, unknown>;
  assert.deepEqual(sentBody, { title: 'Renamed' });
  assert.equal('artistId' in sentBody, false);
});

void test('setAlbumPublished(true) POSTs to /admin/albums/:id/publish', async () => {
  const captured: Captured = {};
  mockFetch(200, sampleAlbum, captured);

  await setAlbumPublished('token-1', 'album-1', true);

  assert.equal(captured.method, 'POST');
  assert.equal(captured.url, 'http://localhost:3000/admin/albums/album-1/publish');
});

void test('setAlbumPublished(false) POSTs to /admin/albums/:id/unpublish', async () => {
  const captured: Captured = {};
  mockFetch(200, sampleAlbum, captured);

  await setAlbumPublished('token-1', 'album-1', false);

  assert.equal(captured.method, 'POST');
  assert.equal(captured.url, 'http://localhost:3000/admin/albums/album-1/unpublish');
});
