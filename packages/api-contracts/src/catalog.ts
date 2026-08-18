/**
 * The fixed genre list defined by the spec.
 */
export type Genre = 'POP' | 'TRADITIONAL' | 'ROCK' | 'RAP' | 'ELECTRONIC' | 'CLASSICAL' | 'FUSION';

export type TrackType = 'FREE' | 'PAID';

/**
 * Shared pagination query params for every catalog list endpoint.
 */
export interface PageQuery {
  page?: number;
  pageSize?: number;
}

/**
 * Shared paginated response envelope for every catalog list endpoint.
 */
export interface PaginatedResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

/**
 * Query params for `GET /artists`.
 */
export interface PublicArtistQuery extends PageQuery {
  /** Case-insensitive substring match against the artist's name. */
  q?: string;
}

/**
 * Response shape of `GET /artists` (as `PaginatedResponse<PublicArtist>`)
 * and `GET /artists/:id`. Active artists only.
 */
export interface PublicArtist {
  id: string;
  name: string;
  bio: string | null;
}

/**
 * Query params for `GET /albums`.
 */
export interface PublicAlbumQuery extends PageQuery {
  /** Case-insensitive substring match against the album's title. */
  q?: string;
  artistId?: string;
}

/**
 * Response shape of `GET /albums` (as `PaginatedResponse<PublicAlbum>`)
 * and `GET /albums/:id`. Published albums only. `releasedAt` is an ISO
 * 8601 date-time string as serialized over JSON, not a `Date` instance.
 */
export interface PublicAlbum {
  id: string;
  artistId: string;
  title: string;
  coverImageUrl: string;
  releasedAt: string | null;
}

/**
 * Query params for `GET /tracks`.
 */
export interface PublicTrackQuery extends PageQuery {
  /** Case-insensitive substring match against the track's title. */
  q?: string;
  artistId?: string;
  albumId?: string;
  genre?: Genre;
}

/**
 * Response shape of `GET /tracks` (as `PaginatedResponse<PublicTrack>`)
 * and `GET /tracks/:id`. Published tracks only. Deliberately excludes
 * `flacFileUrl` and `status` — the public catalog is metadata only, not an
 * audio delivery surface (see playback.ts for how a track is actually
 * streamed). `price` is a decimal string, not a number, matching how the
 * API serializes it.
 */
export interface PublicTrack {
  id: string;
  artistId: string;
  albumId: string | null;
  title: string;
  genre: Genre;
  durationSeconds: number;
  type: TrackType;
  price: string | null;
  coverImageUrl: string;
  credits: string | null;
  story: string | null;
}

/**
 * Response shape of `GET /tracks/:id/lyrics`. Published tracks with lyrics
 * only — 404 otherwise, never distinguishing "track not published" from
 * "no lyrics yet" to an unauthenticated caller. Deliberately excludes the
 * Lyrics row's own `id`/`createdAt`/`updatedAt` — admin/audit metadata a
 * listener has no use for, matching how `PublicTrack` already excludes the
 * equivalent fields on `AdminTrack`.
 */
export interface PublicLyrics {
  trackId: string;
  content: string;
  syncedContent: string | null;
}
