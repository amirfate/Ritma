import { type RefreshResponse } from '@ritma/api-contracts';
import { cookies } from 'next/headers';

import { ACCESS_TOKEN_COOKIE, authCookieAttributes, REFRESH_TOKEN_COOKIE } from './cookie-config';
import { decodeJwtExpirySeconds, isExpiredOrExpiringSoon } from './jwt';
import { refreshTokens } from './refresh';

const FALLBACK_ACCESS_MAX_AGE_SECONDS = 15 * 60;
const FALLBACK_REFRESH_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

function maxAgeFromToken(token: string, fallbackSeconds: number): number {
  const exp = decodeJwtExpirySeconds(token);
  return exp === null ? fallbackSeconds : exp - Math.floor(Date.now() / 1000);
}

/** Only callable from a Server Action or Route Handler — Next.js forbids cookie writes elsewhere. */
export async function setAuthCookies(tokens: RefreshResponse): Promise<void> {
  const store = await cookies();
  store.set(
    ACCESS_TOKEN_COOKIE,
    tokens.accessToken,
    authCookieAttributes(maxAgeFromToken(tokens.accessToken, FALLBACK_ACCESS_MAX_AGE_SECONDS)),
  );
  store.set(
    REFRESH_TOKEN_COOKIE,
    tokens.refreshToken,
    authCookieAttributes(maxAgeFromToken(tokens.refreshToken, FALLBACK_REFRESH_MAX_AGE_SECONDS)),
  );
}

/** Only callable from a Server Action or Route Handler — Next.js forbids cookie writes elsewhere. */
export async function clearAuthCookies(): Promise<void> {
  const store = await cookies();
  store.delete(ACCESS_TOKEN_COOKIE);
  store.delete(REFRESH_TOKEN_COOKIE);
}

/**
 * Returns a currently-valid access token for the signed-in session,
 * refreshing and persisting a new cookie pair first if the access token
 * is missing, expired, or expiring soon. Returns `null` when there is no
 * usable session (and clears any stale cookies in that case).
 *
 * Only callable from a Server Action or Route Handler — the refresh path
 * writes cookies, which Server Components cannot do. Server Components
 * should use `getCurrentUser` from `session.ts` instead, which relies on
 * `middleware.ts` having already refreshed the cookie for this navigation.
 */
export async function getValidAccessToken(): Promise<string | null> {
  const store = await cookies();
  const accessToken = store.get(ACCESS_TOKEN_COOKIE)?.value;
  if (accessToken && !isExpiredOrExpiringSoon(accessToken)) {
    return accessToken;
  }

  const refreshToken = store.get(REFRESH_TOKEN_COOKIE)?.value;
  if (!refreshToken) {
    await clearAuthCookies();
    return null;
  }

  const refreshed = await refreshTokens(refreshToken);
  if (!refreshed) {
    await clearAuthCookies();
    return null;
  }

  await setAuthCookies(refreshed);
  return refreshed.accessToken;
}
