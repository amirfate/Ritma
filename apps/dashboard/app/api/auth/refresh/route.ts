import { NextResponse } from 'next/server';

import { clearAuthCookies, getValidAccessToken } from '../../../../lib/server/cookies';

/**
 * Foundation endpoint for Client Components that need to confirm/refresh
 * the session without a full page navigation (middleware.ts handles the
 * refresh-on-navigate path; this covers the client-fetch path). No request
 * body — the refresh token lives only in the `httpOnly` cookie.
 */
export async function POST(): Promise<NextResponse> {
  const accessToken = await getValidAccessToken();
  if (!accessToken) {
    await clearAuthCookies();
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}
