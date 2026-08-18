import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import { createArtist, getArtist, listArtists, setArtistActive, updateArtist } from './artists.ts';

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

void test('listArtists builds a query string from page/pageSize/q/isActive and sends the bearer token', async () => {
  const captured: Captured = {};
  mockFetch(200, { items: [], page: 1, pageSize: 20, total: 0 }, captured);

  const result = await listArtists('token-1', { page: 2, pageSize: 10, q: 'ham', isActive: true });

  assert.equal(result.ok, true);
  assert.match(captured.url ?? '', /\/admin\/artists\?/);
  const query = new URL(captured.url ?? '', 'http://x').searchParams;
  assert.equal(query.get('page'), '2');
  assert.equal(query.get('pageSize'), '10');
  assert.equal(query.get('q'), 'ham');
  assert.equal(query.get('isActive'), 'true');
  assert.deepEqual(captured.headers, { authorization: 'Bearer token-1' });
});

void test('listArtists omits unset query params entirely (no page=undefined in the URL)', async () => {
  const captured: Captured = {};
  mockFetch(200, { items: [], page: 1, pageSize: 20, total: 0 }, captured);

  await listArtists('token-1', {});

  assert.equal(captured.url, `http://localhost:3000/admin/artists`);
});

void test('getArtist requests /admin/artists/:id', async () => {
  const captured: Captured = {};
  mockFetch(
    200,
    { id: 'artist-1', name: 'A', bio: null, isActive: true, createdAt: '', updatedAt: '' },
    captured,
  );

  const result = await getArtist('token-1', 'artist-1');

  assert.equal(result.ok, true);
  assert.equal(captured.url, 'http://localhost:3000/admin/artists/artist-1');
});

void test('createArtist POSTs the DTO as JSON to /admin/artists', async () => {
  const captured: Captured = {};
  mockFetch(
    201,
    { id: 'artist-2', name: 'New Artist', bio: null, isActive: true, createdAt: '', updatedAt: '' },
    captured,
  );

  const result = await createArtist('token-1', { name: 'New Artist' });

  assert.equal(result.ok, true);
  assert.equal(captured.method, 'POST');
  assert.equal(captured.url, 'http://localhost:3000/admin/artists');
  assert.deepEqual(JSON.parse(captured.body ?? '{}'), { name: 'New Artist' });
});

void test('updateArtist PATCHes /admin/artists/:id with the DTO', async () => {
  const captured: Captured = {};
  mockFetch(
    200,
    { id: 'artist-1', name: 'Renamed', bio: null, isActive: true, createdAt: '', updatedAt: '' },
    captured,
  );

  await updateArtist('token-1', 'artist-1', { name: 'Renamed' });

  assert.equal(captured.method, 'PATCH');
  assert.equal(captured.url, 'http://localhost:3000/admin/artists/artist-1');
  assert.deepEqual(JSON.parse(captured.body ?? '{}'), { name: 'Renamed' });
});

void test('setArtistActive(true) POSTs to /admin/artists/:id/enable', async () => {
  const captured: Captured = {};
  mockFetch(
    200,
    { id: 'artist-1', name: 'A', bio: null, isActive: true, createdAt: '', updatedAt: '' },
    captured,
  );

  await setArtistActive('token-1', 'artist-1', true);

  assert.equal(captured.method, 'POST');
  assert.equal(captured.url, 'http://localhost:3000/admin/artists/artist-1/enable');
});

void test('setArtistActive(false) POSTs to /admin/artists/:id/disable', async () => {
  const captured: Captured = {};
  mockFetch(
    200,
    { id: 'artist-1', name: 'A', bio: null, isActive: false, createdAt: '', updatedAt: '' },
    captured,
  );

  await setArtistActive('token-1', 'artist-1', false);

  assert.equal(captured.method, 'POST');
  assert.equal(captured.url, 'http://localhost:3000/admin/artists/artist-1/disable');
});

void test('a non-ok response is surfaced as ok:false with the status and parsed body, not thrown', async () => {
  const captured: Captured = {};
  mockFetch(404, { statusCode: 404, message: 'Artist not found', error: 'Not Found' }, captured);

  const result = await getArtist('token-1', 'missing-id');

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.status, 404);
    assert.deepEqual(result.body, {
      statusCode: 404,
      message: 'Artist not found',
      error: 'Not Found',
    });
  }
});
