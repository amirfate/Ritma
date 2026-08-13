import { type Genre, type PageQuery, type TrackType } from './catalog';

/**
 * Query params for `GET /admin/artists`. Unlike the public catalog, this
 * can filter by `isActive` explicitly (including inactive artists) since
 * it's an admin-only view.
 */
export interface AdminArtistQuery extends PageQuery {
  /** Case-insensitive substring match against the artist's name. */
  q?: string;
  isActive?: boolean;
}

/**
 * Response shape of every `/admin/artists` endpoint. `createdAt`/`updatedAt`
 * are ISO 8601 date-time strings as serialized over JSON, not `Date`
 * instances — matching the convention already used for `PublicAlbum.releasedAt`.
 */
export interface AdminArtist {
  id: string;
  name: string;
  bio: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Request body of `POST /admin/artists`.
 */
export interface CreateArtistRequest {
  name: string;
  bio?: string;
}

/**
 * Request body of `PATCH /admin/artists/:id`.
 */
export interface UpdateArtistRequest {
  name?: string;
  bio?: string;
}

/**
 * Query params for `GET /admin/albums`. Unlike the public catalog, this
 * can filter by `isPublished` explicitly (including unpublished albums)
 * since it's an admin-only view.
 */
export interface AdminAlbumQuery extends PageQuery {
  /** Case-insensitive substring match against the album's title. */
  q?: string;
  artistId?: string;
  isPublished?: boolean;
}

/**
 * Response shape of every `/admin/albums` endpoint. `releasedAt`/
 * `createdAt`/`updatedAt` are ISO 8601 strings as serialized over JSON,
 * not `Date` instances.
 */
export interface AdminAlbum {
  id: string;
  artistId: string;
  title: string;
  coverImageUrl: string;
  releasedAt: string | null;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Request body of `POST /admin/albums`. `coverImageUrl` is required here
 * (unlike on update) — the backend rejects its absence on create.
 */
export interface CreateAlbumRequest {
  artistId: string;
  title: string;
  coverImageUrl: string;
  releasedAt?: string;
}

/**
 * Request body of `PATCH /admin/albums/:id`. `artistId` is deliberately
 * absent — the backend DTO has no field to reassign an album's artist.
 */
export interface UpdateAlbumRequest {
  title?: string;
  coverImageUrl?: string;
  releasedAt?: string;
}

/**
 * The locked lifecycle: DRAFT -> READY -> PUBLISHED -> UNPUBLISHED ->
 * ARCHIVED. ARCHIVED is the only terminal state.
 */
export type TrackStatus = 'DRAFT' | 'READY' | 'PUBLISHED' | 'UNPUBLISHED' | 'ARCHIVED';

/**
 * The four lifecycle actions, each a fixed `POST /admin/tracks/:id/:action`
 * endpoint — not a general state-setter. Which actions apply to a given
 * track is entirely a function of its current `status`; see
 * `apps/dashboard/lib/server/track-lifecycle-ui.ts` for the read-only
 * mirror the Dashboard uses to decide which buttons to render.
 */
export type TrackLifecycleAction = 'ready' | 'publish' | 'unpublish' | 'archive';

/**
 * Query params for `GET /admin/tracks`.
 */
export interface AdminTrackQuery extends PageQuery {
  /** Case-insensitive substring match against the track's title. */
  q?: string;
  artistId?: string;
  albumId?: string;
  genre?: Genre;
  status?: TrackStatus;
}

/**
 * Response shape of every `/admin/tracks` endpoint, including the four
 * lifecycle actions. `price` is a decimal string (or `null` for FREE
 * tracks), matching the convention already used for `PublicTrack.price`.
 * `createdAt`/`updatedAt`/`publishedAt`/`archivedAt` are ISO 8601 strings
 * as serialized over JSON, not `Date` instances.
 */
export interface AdminTrack {
  id: string;
  artistId: string;
  albumId: string | null;
  title: string;
  genre: Genre;
  durationSeconds: number;
  type: TrackType;
  price: string | null;
  flacFileUrl: string;
  coverImageUrl: string;
  credits: string | null;
  story: string | null;
  status: TrackStatus;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  archivedAt: string | null;
}

/**
 * Request body of `POST /admin/tracks`. No `status` field — every new
 * track starts as DRAFT; status only ever changes via a lifecycle action.
 */
export interface CreateTrackRequest {
  artistId: string;
  albumId?: string;
  title: string;
  genre: Genre;
  durationSeconds: number;
  type: TrackType;
  /** Required when `type` is PAID, must be omitted when FREE — enforced server-side. */
  price?: number;
  flacFileUrl: string;
  coverImageUrl: string;
  credits?: string;
  story?: string;
}

/**
 * Request body of `PATCH /admin/tracks/:id`. `artistId` is deliberately
 * absent (immutable after creation, like Album). `albumId: null` clears
 * the association; omitting it leaves the current value unchanged.
 */
export interface UpdateTrackRequest {
  albumId?: string | null;
  title?: string;
  genre?: Genre;
  durationSeconds?: number;
  type?: TrackType;
  price?: number;
  flacFileUrl?: string;
  coverImageUrl?: string;
  credits?: string;
  story?: string;
}

/**
 * Response shape of every `/admin/tracks/:trackId/lyrics` endpoint. Exactly
 * one Lyrics row exists per Track (unique on `trackId`) — there is no list
 * endpoint. `syncedContent` is an opaque string (e.g. LRC-format text);
 * the backend does not parse or validate its internal structure beyond
 * being a string. `createdAt`/`updatedAt` are ISO 8601 strings as
 * serialized over JSON, not `Date` instances.
 */
export interface LyricsResponse {
  id: string;
  trackId: string;
  content: string;
  syncedContent: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Request body of `POST /admin/tracks/:trackId/lyrics`. Fails with 409 if
 * lyrics already exist for the track — use `UpdateLyricsRequest` instead.
 */
export interface CreateLyricsRequest {
  content: string;
  syncedContent?: string;
}

/**
 * Request body of `PATCH /admin/tracks/:trackId/lyrics`. Fails with 404 if
 * no lyrics exist yet for the track — use `CreateLyricsRequest` instead.
 */
export interface UpdateLyricsRequest {
  content?: string;
  syncedContent?: string;
}
