import { API_ROUTES, type MeResponse } from '@ritma/api-contracts';
import { cookies } from 'next/headers';

import { ACCESS_TOKEN_COOKIE } from './cookie-config';
import { getRitmaApiBaseUrl } from './env';

export type CurrentUserResult =
  | { status: 'ok'; user: MeResponse }
  | { status: 'unauthorized' }
  | { status: 'forbidden' }
  | { status: 'error' };

/**
 * Read-only cookie read for Server Components that need the access token
 * to call an admin endpoint directly (e.g. `lib/server/artists.ts`).
 * Same "middleware already refreshed it" assumption as `getCurrentUser` —
 * no refresh-and-retry here, since Server Components can't write cookies.
 */
export async function getReadOnlyAccessToken(): Promise<string | null> {
  return (await cookies()).get(ACCESS_TOKEN_COOKIE)?.value ?? null;
}

/**
 * Read-only: assumes `middleware.ts` has already refreshed an
 * expiring/expired access-token cookie for this navigation, since Server
 * Components cannot write cookies themselves (a Next.js constraint, not a
 * choice). Route Handlers that need refresh-and-retry should use
 * `getValidAccessToken` from `cookies.ts` instead.
 */
export async function getCurrentUser(): Promise<CurrentUserResult> {
  const accessToken = (await cookies()).get(ACCESS_TOKEN_COOKIE)?.value;
  if (!accessToken) {
    return { status: 'unauthorized' };
  }

  let response: Response;
  try {
    response = await fetch(`${getRitmaApiBaseUrl()}/${API_ROUTES.authMe}`, {
      headers: { authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    });
  } catch {
    return { status: 'error' };
  }

  if (response.status === 401) {
    return { status: 'unauthorized' };
  }
  if (response.status === 403) {
    return { status: 'forbidden' };
  }
  if (!response.ok) {
    return { status: 'error' };
  }

  const user = (await response.json()) as MeResponse;
  return { status: 'ok', user };
}
