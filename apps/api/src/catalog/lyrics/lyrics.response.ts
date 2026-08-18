import { type Lyrics } from '@prisma/client';

export interface LyricsResponse {
  id: string;
  trackId: string;
  content: string;
  syncedContent: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function toLyricsResponse(lyrics: Lyrics): LyricsResponse {
  return {
    id: lyrics.id,
    trackId: lyrics.trackId,
    content: lyrics.content,
    syncedContent: lyrics.syncedContent,
    createdAt: lyrics.createdAt,
    updatedAt: lyrics.updatedAt,
  };
}

/**
 * Listener-facing shape for `GET /tracks/:id/lyrics`. Deliberately excludes
 * `id`/`createdAt`/`updatedAt` — administrative/audit metadata a listener
 * has no use for, the same separation `PublicTrackResponse` already draws
 * against `AdminTrackResponse`.
 */
export interface PublicLyricsResponse {
  trackId: string;
  content: string;
  syncedContent: string | null;
}

export function toPublicLyricsResponse(lyrics: Lyrics): PublicLyricsResponse {
  return {
    trackId: lyrics.trackId,
    content: lyrics.content,
    syncedContent: lyrics.syncedContent,
  };
}
