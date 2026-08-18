/**
 * Cookie names and attributes shared between `middleware.ts` (Edge runtime,
 * writes via `NextResponse.cookies`) and the Node-only helpers in
 * `cookies.ts` (writes via `next/headers`'s `cookies()`). Kept free of
 * `next/headers` imports so it can be imported from either runtime.
 */

export const ACCESS_TOKEN_COOKIE = 'ritma_access_token';
export const REFRESH_TOKEN_COOKIE = 'ritma_refresh_token';

export interface CookieAttributes {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'lax';
  path: string;
  maxAge: number;
}

/** `maxAgeSeconds` should come from the token's own `exp` claim — see `decodeJwtExpirySeconds`. */
export function authCookieAttributes(maxAgeSeconds: number): CookieAttributes {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: Math.max(Math.floor(maxAgeSeconds), 1),
  };
}
