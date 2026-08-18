import { NextResponse, type NextRequest } from 'next/server';

import {
  ACCESS_TOKEN_COOKIE,
  authCookieAttributes,
  REFRESH_TOKEN_COOKIE,
} from './lib/server/cookie-config';
import { decodeJwtExpirySeconds, isExpiredOrExpiringSoon } from './lib/server/jwt';
import { refreshTokens } from './lib/server/refresh';

const PROTECTED_PREFIX = '/dashboard';
const LOGIN_PATH = '/login';

function loginRedirect(request: NextRequest): NextResponse {
  const url = new URL(LOGIN_PATH, request.url);
  url.searchParams.set('next', request.nextUrl.pathname);
  return NextResponse.redirect(url);
}

/**
 * Runs on every navigation to a protected route or `/login`. Handles the
 * navigation-time refresh: Server Components can't write cookies (a
 * Next.js constraint), so an expiring access token is refreshed here,
 * before the page renders, rather than in `app/dashboard/layout.tsx`.
 * Route Handlers do their own refresh-and-retry for client-initiated
 * fetches (see `lib/server/cookies.ts`'s `getValidAccessToken`).
 */
export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  const isProtected = pathname === PROTECTED_PREFIX || pathname.startsWith(`${PROTECTED_PREFIX}/`);
  const isLoginPage = pathname === LOGIN_PATH;

  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;

  if (isLoginPage) {
    if (accessToken && !isExpiredOrExpiringSoon(accessToken)) {
      return NextResponse.redirect(new URL(PROTECTED_PREFIX, request.url));
    }
    return NextResponse.next();
  }

  if (!isProtected) {
    return NextResponse.next();
  }

  if (!accessToken && !refreshToken) {
    return loginRedirect(request);
  }

  if (accessToken && !isExpiredOrExpiringSoon(accessToken)) {
    return NextResponse.next();
  }

  if (!refreshToken) {
    const response = loginRedirect(request);
    response.cookies.delete(ACCESS_TOKEN_COOKIE);
    return response;
  }

  const refreshed = await refreshTokens(refreshToken);
  if (!refreshed) {
    const response = loginRedirect(request);
    response.cookies.delete(ACCESS_TOKEN_COOKIE);
    response.cookies.delete(REFRESH_TOKEN_COOKIE);
    return response;
  }

  const now = Math.floor(Date.now() / 1000);
  const accessExp = decodeJwtExpirySeconds(refreshed.accessToken);
  const refreshExp = decodeJwtExpirySeconds(refreshed.refreshToken);

  const response = NextResponse.next();
  response.cookies.set(
    ACCESS_TOKEN_COOKIE,
    refreshed.accessToken,
    authCookieAttributes(accessExp === null ? 15 * 60 : accessExp - now),
  );
  response.cookies.set(
    REFRESH_TOKEN_COOKIE,
    refreshed.refreshToken,
    authCookieAttributes(refreshExp === null ? 30 * 24 * 60 * 60 : refreshExp - now),
  );
  return response;
}

export const config = {
  matcher: ['/dashboard/:path*', '/login'],
};
