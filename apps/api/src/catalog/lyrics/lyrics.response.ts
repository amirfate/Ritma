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
