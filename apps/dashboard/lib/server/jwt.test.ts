import assert from 'node:assert/strict';
import { test } from 'node:test';

import { decodeJwtExpirySeconds, isExpiredOrExpiringSoon } from './jwt.ts';

function base64UrlEncode(value: string): string {
  return Buffer.from(value, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** Builds a syntactically valid (but unsigned) JWT string — signature verification is never done client-side, only `exp` is read. */
function fakeJwt(payload: unknown): string {
  const header = base64UrlEncode(JSON.stringify({ alg: 'none', typ: 'JWT' }));
  const body = base64UrlEncode(typeof payload === 'string' ? payload : JSON.stringify(payload));
  return `${header}.${body}.signature`;
}

const now = (): number => Math.floor(Date.now() / 1000);

void test('decodeJwtExpirySeconds reads the exp claim of a well-formed token', () => {
  const exp = now() + 900;
  assert.equal(decodeJwtExpirySeconds(fakeJwt({ exp, sub: 'user-1' })), exp);
});

void test('decodeJwtExpirySeconds returns null for a token that is not three dot-segments', () => {
  assert.equal(decodeJwtExpirySeconds('not-a-jwt'), null);
  assert.equal(decodeJwtExpirySeconds('only.two'), null);
  assert.equal(decodeJwtExpirySeconds(''), null);
});

void test('decodeJwtExpirySeconds returns null when the payload segment is not valid base64/JSON', () => {
  assert.equal(decodeJwtExpirySeconds('header.***not-base64***.signature'), null);
});

void test('decodeJwtExpirySeconds returns null when the payload has no numeric exp claim', () => {
  assert.equal(decodeJwtExpirySeconds(fakeJwt({ sub: 'user-1' })), null);
  assert.equal(decodeJwtExpirySeconds(fakeJwt({ exp: 'not-a-number' })), null);
  assert.equal(decodeJwtExpirySeconds(fakeJwt('"just a string, not an object"')), null);
});

void test('isExpiredOrExpiringSoon is false for a token well within its lifetime', () => {
  assert.equal(isExpiredOrExpiringSoon(fakeJwt({ exp: now() + 900 })), false);
});

void test('isExpiredOrExpiringSoon is true for a token that has already expired', () => {
  assert.equal(isExpiredOrExpiringSoon(fakeJwt({ exp: now() - 10 })), true);
});

void test('isExpiredOrExpiringSoon is true inside the skew window, even if not technically expired yet', () => {
  // The skew is 30s; 10s-from-now is inside it.
  assert.equal(isExpiredOrExpiringSoon(fakeJwt({ exp: now() + 10 })), true);
});

void test('isExpiredOrExpiringSoon is false just outside the skew window', () => {
  assert.equal(isExpiredOrExpiringSoon(fakeJwt({ exp: now() + 45 })), false);
});

void test('isExpiredOrExpiringSoon is true for an undecodable token — fails closed, not open', () => {
  assert.equal(isExpiredOrExpiringSoon('garbage'), true);
});
