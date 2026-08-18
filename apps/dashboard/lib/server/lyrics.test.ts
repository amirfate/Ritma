import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import { createLyrics, getLyrics, updateLyrics } from './lyrics.ts';

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

const sampleLyrics = {
  id: 'lyrics-1',
  trackId: 'track-1',
  content: 'La la la',
  syncedContent: null,
  createdAt: '',
  updatedAt: '',
};

void test('getLyrics requests /admin/tracks/:trackId/lyrics and sends the bearer token', async () => {
  const captured: Captured = {};
  mockFetch(200, sampleLyrics, captured);

  const result = await getLyrics('token-1', 'track-1');

  assert.equal(result.ok, true);
  assert.equal(captured.url, 'http://localhost:3000/admin/tracks/track-1/lyrics');
  assert.deepEqual(captured.headers, { authorization: 'Bearer token-1' });
});

void test('getLyrics surfaces a 404 (no lyrics yet) as ok:false, not thrown', async () => {
  const captured: Captured = {};
  mockFetch(
    404,
    { statusCode: 404, message: 'Lyrics not found for this track', error: 'Not Found' },
    captured,
  );

  const result = await getLyrics('token-1', 'track-1');

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.status, 404);
  }
});

void test('createLyrics POSTs the DTO to /admin/tracks/:trackId/lyrics', async () => {
  const captured: Captured = {};
  mockFetch(201, sampleLyrics, captured);

  const result = await createLyrics('token-1', 'track-1', { content: 'La la la' });

  assert.equal(result.ok, true);
  assert.equal(captured.method, 'POST');
  assert.equal(captured.url, 'http://localhost:3000/admin/tracks/track-1/lyrics');
  assert.deepEqual(JSON.parse(captured.body ?? '{}'), { content: 'La la la' });
});

void test('createLyrics can include optional syncedContent', async () => {
  const captured: Captured = {};
  mockFetch(201, sampleLyrics, captured);

  await createLyrics('token-1', 'track-1', {
    content: 'La la la',
    syncedContent: '[00:01.00]La la la',
  });

  assert.deepEqual(JSON.parse(captured.body ?? '{}'), {
    content: 'La la la',
    syncedContent: '[00:01.00]La la la',
  });
});

void test('createLyrics surfaces a 409 (lyrics already exist) as ok:false, not thrown', async () => {
  const captured: Captured = {};
  mockFetch(
    409,
    {
      statusCode: 409,
      message: 'Lyrics already exist for this track; use update instead',
      error: 'Conflict',
    },
    captured,
  );

  const result = await createLyrics('token-1', 'track-1', { content: 'Duplicate attempt' });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.status, 409);
    assert.equal(
      (result.body as { message: string }).message,
      'Lyrics already exist for this track; use update instead',
    );
  }
});

void test('updateLyrics PATCHes /admin/tracks/:trackId/lyrics with the DTO', async () => {
  const captured: Captured = {};
  mockFetch(200, { ...sampleLyrics, content: 'Updated' }, captured);

  await updateLyrics('token-1', 'track-1', { content: 'Updated' });

  assert.equal(captured.method, 'PATCH');
  assert.equal(captured.url, 'http://localhost:3000/admin/tracks/track-1/lyrics');
  assert.deepEqual(JSON.parse(captured.body ?? '{}'), { content: 'Updated' });
});

void test('updateLyrics surfaces a 404 (no lyrics yet to update) as ok:false, not thrown', async () => {
  const captured: Captured = {};
  mockFetch(
    404,
    { statusCode: 404, message: 'Lyrics not found for this track', error: 'Not Found' },
    captured,
  );

  const result = await updateLyrics('token-1', 'track-1', { content: 'Nope' });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.status, 404);
  }
});
