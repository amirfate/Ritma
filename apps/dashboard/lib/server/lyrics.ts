import {
  API_ROUTES,
  type CreateLyricsRequest,
  type LyricsResponse,
  type UpdateLyricsRequest,
} from '@ritma/api-contracts';

import { getRitmaApiBaseUrl } from './env.ts';

/**
 * Every `/admin/tracks/:trackId/lyrics` call's outcome, normalized the
 * same way as `ArtistApiResult`/`AlbumApiResult`/`TrackApiResult`.
 * `status` is always present so a caller can distinguish
 * 401/403/404/409(create-conflict)/validation(400) from an unexpected
 * upstream failure.
 */
export type LyricsApiResult<T> =
  { ok: true; data: T } | { ok: false; status: number; body: unknown };

async function parseJson(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

function authHeaders(accessToken: string): HeadersInit {
  return { authorization: `Bearer ${accessToken}` };
}

/** Nested under the existing `admin/tracks` route — there is no standalone Lyrics resource. */
function lyricsPath(trackId: string): string {
  return `${API_ROUTES.adminTracks}/${trackId}/lyrics`;
}

export async function getLyrics(
  accessToken: string,
  trackId: string,
): Promise<LyricsApiResult<LyricsResponse>> {
  const response = await fetch(`${getRitmaApiBaseUrl()}/${lyricsPath(trackId)}`, {
    headers: authHeaders(accessToken),
    cache: 'no-store',
  });
  const body = await parseJson(response);
  return response.ok
    ? { ok: true, data: body as LyricsResponse }
    : { ok: false, status: response.status, body };
}

/** Fails with 409 if lyrics already exist for this track — the backend has no upsert semantics here. */
export async function createLyrics(
  accessToken: string,
  trackId: string,
  dto: CreateLyricsRequest,
): Promise<LyricsApiResult<LyricsResponse>> {
  const response = await fetch(`${getRitmaApiBaseUrl()}/${lyricsPath(trackId)}`, {
    method: 'POST',
    headers: { ...authHeaders(accessToken), 'content-type': 'application/json' },
    body: JSON.stringify(dto),
  });
  const body = await parseJson(response);
  return response.ok
    ? { ok: true, data: body as LyricsResponse }
    : { ok: false, status: response.status, body };
}

/** Fails with 404 if no lyrics exist yet for this track — create first. */
export async function updateLyrics(
  accessToken: string,
  trackId: string,
  dto: UpdateLyricsRequest,
): Promise<LyricsApiResult<LyricsResponse>> {
  const response = await fetch(`${getRitmaApiBaseUrl()}/${lyricsPath(trackId)}`, {
    method: 'PATCH',
    headers: { ...authHeaders(accessToken), 'content-type': 'application/json' },
    body: JSON.stringify(dto),
  });
  const body = await parseJson(response);
  return response.ok
    ? { ok: true, data: body as LyricsResponse }
    : { ok: false, status: response.status, body };
}
