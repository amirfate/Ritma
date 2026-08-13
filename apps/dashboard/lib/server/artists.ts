import {
  type AdminArtist,
  type AdminArtistQuery,
  API_ROUTES,
  type CreateArtistRequest,
  type PaginatedResponse,
  type UpdateArtistRequest,
} from '@ritma/api-contracts';

import { getRitmaApiBaseUrl } from './env.ts';

/**
 * Every `/admin/artists` call's outcome, normalized to a shape callers can
 * branch on without re-deriving status-code meaning each time. `status` is
 * always present so a caller can distinguish 401/403/404/validation(400)
 * from an unexpected upstream failure, without this module hardcoding UI
 * decisions about what to do with each.
 */
export type ArtistApiResult<T> =
  { ok: true; data: T } | { ok: false; status: number; body: unknown };

async function parseJson(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

function authHeaders(accessToken: string): HeadersInit {
  return { authorization: `Bearer ${accessToken}` };
}

function queryString(query: AdminArtistQuery): string {
  const params = new URLSearchParams();
  if (query.page !== undefined) params.set('page', String(query.page));
  if (query.pageSize !== undefined) params.set('pageSize', String(query.pageSize));
  if (query.q) params.set('q', query.q);
  if (query.isActive !== undefined) params.set('isActive', String(query.isActive));
  const serialized = params.toString();
  return serialized ? `?${serialized}` : '';
}

export async function listArtists(
  accessToken: string,
  query: AdminArtistQuery,
): Promise<ArtistApiResult<PaginatedResponse<AdminArtist>>> {
  const response = await fetch(
    `${getRitmaApiBaseUrl()}/${API_ROUTES.adminArtists}${queryString(query)}`,
    {
      headers: authHeaders(accessToken),
      cache: 'no-store',
    },
  );
  const body = await parseJson(response);
  return response.ok
    ? { ok: true, data: body as PaginatedResponse<AdminArtist> }
    : { ok: false, status: response.status, body };
}

export async function getArtist(
  accessToken: string,
  id: string,
): Promise<ArtistApiResult<AdminArtist>> {
  const response = await fetch(`${getRitmaApiBaseUrl()}/${API_ROUTES.adminArtists}/${id}`, {
    headers: authHeaders(accessToken),
    cache: 'no-store',
  });
  const body = await parseJson(response);
  return response.ok
    ? { ok: true, data: body as AdminArtist }
    : { ok: false, status: response.status, body };
}

export async function createArtist(
  accessToken: string,
  dto: CreateArtistRequest,
): Promise<ArtistApiResult<AdminArtist>> {
  const response = await fetch(`${getRitmaApiBaseUrl()}/${API_ROUTES.adminArtists}`, {
    method: 'POST',
    headers: { ...authHeaders(accessToken), 'content-type': 'application/json' },
    body: JSON.stringify(dto),
  });
  const body = await parseJson(response);
  return response.ok
    ? { ok: true, data: body as AdminArtist }
    : { ok: false, status: response.status, body };
}

export async function updateArtist(
  accessToken: string,
  id: string,
  dto: UpdateArtistRequest,
): Promise<ArtistApiResult<AdminArtist>> {
  const response = await fetch(`${getRitmaApiBaseUrl()}/${API_ROUTES.adminArtists}/${id}`, {
    method: 'PATCH',
    headers: { ...authHeaders(accessToken), 'content-type': 'application/json' },
    body: JSON.stringify(dto),
  });
  const body = await parseJson(response);
  return response.ok
    ? { ok: true, data: body as AdminArtist }
    : { ok: false, status: response.status, body };
}

export async function setArtistActive(
  accessToken: string,
  id: string,
  isActive: boolean,
): Promise<ArtistApiResult<AdminArtist>> {
  const action = isActive ? 'enable' : 'disable';
  const response = await fetch(
    `${getRitmaApiBaseUrl()}/${API_ROUTES.adminArtists}/${id}/${action}`,
    {
      method: 'POST',
      headers: authHeaders(accessToken),
    },
  );
  const body = await parseJson(response);
  return response.ok
    ? { ok: true, data: body as AdminArtist }
    : { ok: false, status: response.status, body };
}
