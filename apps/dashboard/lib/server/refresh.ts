import { API_ROUTES, type RefreshRequest, type RefreshResponse } from '@ritma/api-contracts';

import { getRitmaApiBaseUrl } from './env.ts';

/**
 * Calls the existing `POST /auth/refresh` endpoint. Framework-agnostic
 * (fetch only, no cookie access) so it can run from both the Edge
 * middleware and Node Route Handlers, which persist the result through
 * different cookie-writing APIs.
 */
export async function refreshTokens(refreshToken: string): Promise<RefreshResponse | null> {
  const body: RefreshRequest = { refreshToken };

  let response: Response;
  try {
    response = await fetch(`${getRitmaApiBaseUrl()}/${API_ROUTES.authRefresh}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    return null;
  }

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as RefreshResponse;
}
