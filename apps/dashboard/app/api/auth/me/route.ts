import { API_ROUTES, type MeResponse } from '@ritma/api-contracts';
import { NextResponse } from 'next/server';

import { clearAuthCookies, getValidAccessToken } from '../../../../lib/server/cookies';
import { getRitmaApiBaseUrl } from '../../../../lib/server/env';

/** Client-fetchable "who am I" — used by Client Components that can't read the httpOnly cookie themselves. */
export async function GET(): Promise<NextResponse> {
  const accessToken = await getValidAccessToken();
  if (!accessToken) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const upstream = await fetch(`${getRitmaApiBaseUrl()}/${API_ROUTES.authMe}`, {
    headers: { authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });

  if (upstream.status === 401) {
    await clearAuthCookies();
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  if (upstream.status === 403) {
    const body: unknown = await upstream.json().catch(() => null);
    return NextResponse.json(body ?? { message: 'Forbidden' }, { status: 403 });
  }

  if (!upstream.ok) {
    return NextResponse.json({ message: 'The Ritma API is unavailable.' }, { status: 502 });
  }

  const user = (await upstream.json()) as MeResponse;
  return NextResponse.json(user);
}
