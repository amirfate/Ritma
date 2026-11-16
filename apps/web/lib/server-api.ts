// Server-side data fetching for server components. Returns null on failure
// so pages can render a friendly empty state when the backend is down.

export async function serverGet<T>(path: string): Promise<T | null> {
  try {
    const base = process.env.API_URL ?? 'http://127.0.0.1:3000';
    const res = await fetch(`${base}/${path}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export interface ArtistCard {
  id: string;
  slug: string;
  name: string;
  imageUrl: string | null;
}

export interface AlbumCard {
  id: string;
  slug: string;
  title: string;
  coverUrl: string | null;
  artist: { slug: string; name: string };
}

export interface TrackRow {
  id: string;
  title: string;
  durationSec: number;
  position: number;
  isPremium: boolean;
  isSellable: boolean;
  priceIrR: number;
  syncedContent: string | null;
  lyrics?: string | null;
  artist: { slug: string; name: string };
  album: { slug: string; title: string } | null;
}

export interface PlanRow {
  id: string;
  code: string;
  title: string;
  durationDays: number;
  priceIrR: number;
}
