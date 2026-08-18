/**
 * The authorization basis a `PlaybackSession` was created under — fixed at
 * creation, never recomputed afterward.
 */
export type PlaybackAccessType = 'PREVIEW' | 'FULL_FREE' | 'FULL_PURCHASED';

/**
 * Request body of `POST /playback/sessions`. Requires a bearer access
 * token.
 */
export interface CreateSessionRequest {
  trackId: string;
}

/**
 * Response body of `POST /playback/sessions` (201). Deliberately just the
 * session id and the resolved access tier — never a raw storage reference.
 */
export interface PlaybackSessionResponse {
  id: string;
  accessType: PlaybackAccessType;
}

/**
 * `GET /playback/sessions/:id/stream` requires a bearer access token and
 * an optional `Range: bytes=start-end` header. It is not a JSON endpoint —
 * it returns binary `audio/flac` bytes (`200` or `206`, with
 * `Accept-Ranges`/`Content-Length`, and — for `206`/`416` —
 * `Content-Range`). No request/response TypeScript type applies; this
 * comment exists only so the route is discoverable alongside its siblings
 * (see `API_ROUTES.playbackSessionStream`). For `PREVIEW` sessions the
 * server enforces a hard 30-second clamp on every request regardless of
 * the client's `Range` header — never derive or enforce a playback
 * duration limit client-side.
 */

/**
 * `POST /playback/sessions/:id/end` requires a bearer access token, takes
 * no request body, and returns `200` — no response type applies.
 * Idempotent if the session is already ended.
 */
