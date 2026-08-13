import {
  type AdminTrack,
  type AdminTrackQuery,
  API_ROUTES,
  type CreateTrackRequest,
  type PaginatedResponse,
  type TrackLifecycleAction,
  type UpdateTrackRequest,
} from '@ritma/api-contracts';

import { getRitmaApiBaseUrl } from './env.ts';

/**
 * Every `/admin/tracks` call's outcome, normalized the same way as
 * `ArtistApiResult`/`AlbumApiResult` — `status` is always present so a
 * caller can distinguish 401/403/404/validation(400)/lifecycle(400) from
 * an unexpected upstream failure.
 */
export type TrackApiResult<T> =
  { ok: true; data: T } | { ok: false; status: number; body: unknown };

async function parseJson(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

function authHeaders(accessToken: string): HeadersInit {
  return { authorization: `Bearer ${accessToken}` };
}

function queryString(query: AdminTrackQuery): string {
  const params = new URLSearchParams();
  if (query.page !== undefined) params.set('page', String(query.page));
  if (query.pageSize !== undefined) params.set('pageSize', String(query.pageSize));
  if (query.q) params.set('q', query.q);
  if (query.artistId) params.set('artistId', query.artistId);
  if (query.albumId) params.set('albumId', query.albumId);
  if (query.genre) params.set('genre', query.genre);
  if (query.status) params.set('status', query.status);
  const serialized = params.toString();
  return serialized ? `?${serialized}` : '';
}

export async function listTracks(
  accessToken: string,
  query: AdminTrackQuery,
): Promise<TrackApiResult<PaginatedResponse<AdminTrack>>> {
  const response = await fetch(
    `${getRitmaApiBaseUrl()}/${API_ROUTES.adminTracks}${queryString(query)}`,
    {
      headers: authHeaders(accessToken),
      cache: 'no-store',
    },
  );
  const body = await parseJson(response);
  return response.ok
    ? { ok: true, data: body as PaginatedResponse<AdminTrack> }
    : { ok: false, status: response.status, body };
}

export async function getTrack(
  accessToken: string,
  id: string,
): Promise<TrackApiResult<AdminTrack>> {
  const response = await fetch(`${getRitmaApiBaseUrl()}/${API_ROUTES.adminTracks}/${id}`, {
    headers: authHeaders(accessToken),
    cache: 'no-store',
  });
  const body = await parseJson(response);
  return response.ok
    ? { ok: true, data: body as AdminTrack }
    : { ok: false, status: response.status, body };
}

export async function createTrack(
  accessToken: string,
  dto: CreateTrackRequest,
): Promise<TrackApiResult<AdminTrack>> {
  const response = await fetch(`${getRitmaApiBaseUrl()}/${API_ROUTES.adminTracks}`, {
    method: 'POST',
    headers: { ...authHeaders(accessToken), 'content-type': 'application/json' },
    body: JSON.stringify(dto),
  });
  const body = await parseJson(response);
  return response.ok
    ? { ok: true, data: body as AdminTrack }
    : { ok: false, status: response.status, body };
}

export async function updateTrack(
  accessToken: string,
  id: string,
  dto: UpdateTrackRequest,
): Promise<TrackApiResult<AdminTrack>> {
  const response = await fetch(`${getRitmaApiBaseUrl()}/${API_ROUTES.adminTracks}/${id}`, {
    method: 'PATCH',
    headers: { ...authHeaders(accessToken), 'content-type': 'application/json' },
    body: JSON.stringify(dto),
  });
  const body = await parseJson(response);
  return response.ok
    ? { ok: true, data: body as AdminTrack }
    : { ok: false, status: response.status, body };
}

/** `action` maps 1:1 to a fixed `POST /admin/tracks/:id/:action` endpoint — see `track.admin.controller.ts`. */
export async function transitionTrack(
  accessToken: string,
  id: string,
  action: TrackLifecycleAction,
): Promise<TrackApiResult<AdminTrack>> {
  const response = await fetch(
    `${getRitmaApiBaseUrl()}/${API_ROUTES.adminTracks}/${id}/${action}`,
    {
      method: 'POST',
      headers: authHeaders(accessToken),
    },
  );
  const body = await parseJson(response);
  return response.ok
    ? { ok: true, data: body as AdminTrack }
    : { ok: false, status: response.status, body };
}
