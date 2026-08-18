import { API_ROUTES } from '@ritma/api-contracts';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { ACCESS_TOKEN_COOKIE } from '../../../../lib/server/cookie-config';
import { clearAuthCookies } from '../../../../lib/server/cookies';
import { getRitmaApiBaseUrl } from '../../../../lib/server/env';

/**
 * Best-effort: revokes the device server-side using whatever access token
 * cookie currently exists (an expired one is fine — the point is clearing
 * the Dashboard's own cookies, which happens regardless of the upstream
 * result). No refresh-and-retry here; an already-logged-out session has
 * nothing to retry with.
 */
export async function POST(): Promise<NextResponse> {
  const accessToken = (await cookies()).get(ACCESS_TOKEN_COOKIE)?.value;

  if (accessToken) {
    try {
      await fetch(`${getRitmaApiBaseUrl()}/${API_ROUTES.authLogout}`, {
        method: 'POST',
        headers: { authorization: `Bearer ${accessToken}` },
      });
    } catch {
      // Best-effort — cookies are cleared below regardless.
    }
  }

  await clearAuthCookies();
  return NextResponse.json({ ok: true });
}
