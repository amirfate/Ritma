import { type Album } from '@prisma/client';

export interface AdminAlbumResponse {
  id: string;
  artistId: string;
  title: string;
  coverImageUrl: string;
  releasedAt: Date | null;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicAlbumResponse {
  id: string;
  artistId: string;
  title: string;
  coverImageUrl: string;
  releasedAt: Date | null;
}

export function toAdminAlbumResponse(album: Album): AdminAlbumResponse {
  return {
    id: album.id,
    artistId: album.artistId,
    title: album.title,
    coverImageUrl: album.coverImageUrl,
    releasedAt: album.releasedAt,
    isPublished: album.isPublished,
    createdAt: album.createdAt,
    updatedAt: album.updatedAt,
  };
}

export function toPublicAlbumResponse(album: Album): PublicAlbumResponse {
  return {
    id: album.id,
    artistId: album.artistId,
    title: album.title,
    coverImageUrl: album.coverImageUrl,
    releasedAt: album.releasedAt,
  };
}
