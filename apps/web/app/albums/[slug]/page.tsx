import type { ReactElement } from 'react';

import { serverGet, type TrackRow } from '../../../lib/server-api';
import { TrackList } from '../../../lib/player';

interface AlbumDetail {
  id: string;
  slug: string;
  title: string;
  coverUrl: string | null;
  artist: { slug: string; name: string };
  tracks: (TrackRow & { lyrics?: string | null })[];
}

export default async function AlbumPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<ReactElement> {
  const { slug } = await params;
  const album = await serverGet<AlbumDetail>(`albums/${encodeURIComponent(slug)}`);
  if (!album) {
    return <div className="msg">آلبوم یافت نشد.</div>;
  }
  return (
    <>
      <h2 className="sec">{album.title}</h2>
      <p style={{ color: 'var(--muted)' }}>
        اثر از <a href={`/artists/${album.artist.slug}`}>{album.artist.name}</a>
      </p>
      <div className="neu card" style={{ marginTop: 20 }}>
        {album.tracks.length === 0 && <p style={{ color: 'var(--muted)' }}>قطعه‌ای ندارد.</p>}
        <TrackList
          tracks={album.tracks.map((t) => ({
            id: t.id,
            title: t.title,
            artist: album.artist.name,
            priceIrR: t.priceIrR,
            lyrics: t.lyrics,
            syncedContent: t.syncedContent,
          }))}
        />
      </div>
    </>
  );
}
