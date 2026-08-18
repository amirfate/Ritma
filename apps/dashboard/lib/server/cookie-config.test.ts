import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';

import { authCookieAttributes } from './cookie-config.ts';

const env = process.env as Record<string, string | undefined>;
let originalNodeEnv: string | undefined;

beforeEach(() => {
  originalNodeEnv = env.NODE_ENV;
});

afterEach(() => {
  env.NODE_ENV = originalNodeEnv;
});

void test('authCookieAttributes always sets httpOnly, sameSite=lax, and path=/', () => {
  const attrs = authCookieAttributes(900);
  assert.equal(attrs.httpOnly, true);
  assert.equal(attrs.sameSite, 'lax');
  assert.equal(attrs.path, '/');
});

void test('authCookieAttributes enables secure only in production', () => {
  env.NODE_ENV = 'production';
  assert.equal(authCookieAttributes(900).secure, true);

  env.NODE_ENV = 'development';
  assert.equal(authCookieAttributes(900).secure, false);

  env.NODE_ENV = 'test';
  assert.equal(authCookieAttributes(900).secure, false);
});

void test('authCookieAttributes floors a fractional maxAge', () => {
  assert.equal(authCookieAttributes(899.9).maxAge, 899);
});

void test('authCookieAttributes clamps a zero/negative maxAge up to 1 second, never 0 or negative', () => {
  assert.equal(authCookieAttributes(0).maxAge, 1);
  assert.equal(authCookieAttributes(-100).maxAge, 1);
});
