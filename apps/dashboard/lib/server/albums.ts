import {
  type AdminAlbum,
  type AdminAlbumQuery,
  API_ROUTES,
  type CreateAlbumRequest,
  type PaginatedResponse,
  type UpdateAlbumRequest,
} from '@ritma/api-contracts';

import { getRitmaApiBaseUrl } from './env.ts';

/**
 * Every `/admin/albums` call's outcome, normalized the same way as
 * `ArtistApiResult` in `artists.ts` — `status` is always present so a
 * caller can distinguish 401/403/404/validation(400) from an unexpected
 * upstream failure.
 */
export type AlbumApiResult<T> =
  { ok: true; data: T } | { ok: false; status: number; body: unknown };

async function parseJson(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

function authHeaders(accessToken: string): HeadersInit {
  return { authorization: `Bearer ${accessToken}` };
}

function queryString(query: AdminAlbumQuery): string {
  const params = new URLSearchParams();
  if (query.page !== undefined) params.set('page', String(query.page));
  if (query.pageSize !== undefined) params.set('pageSize', String(query.pageSize));
  if (query.q) params.set('q', query.q);
  if (query.artistId) params.set('artistId', query.artistId);
  if (query.isPublished !== undefined) params.set('isPublished', String(query.isPublished));
  const serialized = params.toString();
  return serialized ? `?${serialized}` : '';
}

export async function listAlbums(
  accessToken: string,
  query: AdminAlbumQuery,
): Promise<AlbumApiResult<PaginatedResponse<AdminAlbum>>> {
  const response = await fetch(
    `${getRitmaApiBaseUrl()}/${API_ROUTES.adminAlbums}${queryString(query)}`,
    {
      headers: authHeaders(accessToken),
      cache: 'no-store',
    },
  );
  const body = await parseJson(response);
  return response.ok
    ? { ok: true, data: body as PaginatedResponse<AdminAlbum> }
    : { ok: false, status: response.status, body };
}

export async function getAlbum(
  accessToken: string,
  id: string,
): Promise<AlbumApiResult<AdminAlbum>> {
  const response = await fetch(`${getRitmaApiBaseUrl()}/${API_ROUTES.adminAlbums}/${id}`, {
    headers: authHeaders(accessToken),
    cache: 'no-store',
  });
  const body = await parseJson(response);
  return response.ok
    ? { ok: true, data: body as AdminAlbum }
    : { ok: false, status: response.status, body };
}

export async function createAlbum(
  accessToken: string,
  dto: CreateAlbumRequest,
): Promise<AlbumApiResult<AdminAlbum>> {
  const response = await fetch(`${getRitmaApiBaseUrl()}/${API_ROUTES.adminAlbums}`, {
    method: 'POST',
    headers: { ...authHeaders(accessToken), 'content-type': 'application/json' },
    body: JSON.stringify(dto),
  });
  const body = await parseJson(response);
  return response.ok
    ? { ok: true, data: body as AdminAlbum }
    : { ok: false, status: response.status, body };
}

export async function updateAlbum(
  accessToken: string,
  id: string,
  dto: UpdateAlbumRequest,
): Promise<AlbumApiResult<AdminAlbum>> {
  const response = await fetch(`${getRitmaApiBaseUrl()}/${API_ROUTES.adminAlbums}/${id}`, {
    method: 'PATCH',
    headers: { ...authHeaders(accessToken), 'content-type': 'application/json' },
    body: JSON.stringify(dto),
  });
  const body = await parseJson(response);
  return response.ok
    ? { ok: true, data: body as AdminAlbum }
    : { ok: false, status: response.status, body };
}

export async function setAlbumPublished(
  accessToken: string,
  id: string,
  isPublished: boolean,
): Promise<AlbumApiResult<AdminAlbum>> {
  const action = isPublished ? 'publish' : 'unpublish';
  const response = await fetch(
    `${getRitmaApiBaseUrl()}/${API_ROUTES.adminAlbums}/${id}/${action}`,
    {
      method: 'POST',
      headers: authHeaders(accessToken),
    },
  );
  const body = await parseJson(response);
  return response.ok
    ? { ok: true, data: body as AdminAlbum }
    : { ok: false, status: response.status, body };
}
