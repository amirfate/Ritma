import { type Artist } from '@prisma/client';

export interface AdminArtistResponse {
  id: string;
  name: string;
  bio: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicArtistResponse {
  id: string;
  name: string;
  bio: string | null;
}

export function toAdminArtistResponse(artist: Artist): AdminArtistResponse {
  return {
    id: artist.id,
    name: artist.name,
    bio: artist.bio,
    isActive: artist.isActive,
    createdAt: artist.createdAt,
    updatedAt: artist.updatedAt,
  };
}

export function toPublicArtistResponse(artist: Artist): PublicArtistResponse {
  return { id: artist.id, name: artist.name, bio: artist.bio };
}
