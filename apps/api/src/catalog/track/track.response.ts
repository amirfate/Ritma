import { type Genre, type Track, type TrackStatus, type TrackType } from '@prisma/client';

export interface AdminTrackResponse {
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
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
  archivedAt: Date | null;
}

export interface PublicTrackResponse {
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

export function toAdminTrackResponse(track: Track): AdminTrackResponse {
  return {
    id: track.id,
    artistId: track.artistId,
    albumId: track.albumId,
    title: track.title,
    genre: track.genre,
    durationSeconds: track.durationSeconds,
    type: track.type,
    price: track.price?.toString() ?? null,
    flacFileUrl: track.flacFileUrl,
    coverImageUrl: track.coverImageUrl,
    credits: track.credits,
    story: track.story,
    status: track.status,
    createdAt: track.createdAt,
    updatedAt: track.updatedAt,
    publishedAt: track.publishedAt,
    archivedAt: track.archivedAt,
  };
}

/** No `flacFileUrl` — the public catalog is metadata only, not an audio delivery surface. */
export function toPublicTrackResponse(track: Track): PublicTrackResponse {
  return {
    id: track.id,
    artistId: track.artistId,
    albumId: track.albumId,
    title: track.title,
    genre: track.genre,
    durationSeconds: track.durationSeconds,
    type: track.type,
    price: track.price?.toString() ?? null,
    coverImageUrl: track.coverImageUrl,
    credits: track.credits,
    story: track.story,
  };
}
