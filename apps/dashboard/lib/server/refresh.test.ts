import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import { refreshTokens } from './refresh.ts';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

void test('refreshTokens returns the new pair on a 200 response, calling POST /auth/refresh with the token', async () => {
  let capturedUrl: string | undefined;
  let capturedInit: RequestInit | undefined;

  globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    capturedUrl = typeof input === 'string' ? input : undefined;
    capturedInit = init;
    return Promise.resolve(
      new Response(JSON.stringify({ accessToken: 'new-access', refreshToken: 'new-refresh' }), {
        status: 200,
      }),
    );
  };

  const result = await refreshTokens('old-refresh-token');

  assert.deepEqual(result, { accessToken: 'new-access', refreshToken: 'new-refresh' });
  assert.match(capturedUrl ?? '', /\/auth\/refresh$/);
  assert.equal(capturedInit?.method, 'POST');
  const sentBody =
    typeof capturedInit?.body === 'string' ? (JSON.parse(capturedInit.body) as unknown) : undefined;
  assert.deepEqual(sentBody, { refreshToken: 'old-refresh-token' });
});

void test('refreshTokens returns null when the API rejects the refresh token (non-ok status)', async () => {
  globalThis.fetch = () =>
    Promise.resolve(
      new Response(JSON.stringify({ message: 'Invalid or expired refresh token' }), {
        status: 401,
      }),
    );

  assert.equal(await refreshTokens('stale-token'), null);
});

void test('refreshTokens returns null instead of throwing on a network failure', async () => {
  globalThis.fetch = () => Promise.reject(new TypeError('fetch failed'));

  assert.equal(await refreshTokens('any-token'), null);
});
