import type { ReactElement } from 'react';

import { serverGet, type TrackRow } from '../../../lib/server-api';

interface AlbumDetail {
  id: string;
  slug: string;
  title: string;
  coverUrl: string | null;
  artist: { slug: string; name: string };
  tracks: TrackRow[];
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
      <h1 style={{ marginTop: 12 }}>{album.title}</h1>
      <p style={{ color: 'var(--muted)' }}>
        اثر از <a href={`/artists/${album.artist.slug}`}>{album.artist.name}</a>
      </p>
      <div className="card" style={{ marginTop: 20 }}>
        {album.tracks.length === 0 && <p style={{ color: 'var(--muted)' }}>قطعه‌ای ندارد.</p>}
        {album.tracks.map((track, index) => (
          <div key={track.id} className="track-row">
            <span className="t-num">{index + 1}</span>
            <span className="t-name">
              {track.title}
              {track.isPremium && <span className="pill">ویژه</span>}
            </span>
            <span className="sub">{Math.round(track.durationSec / 60)} دقیقه</span>
          </div>
        ))}
      </div>
    </>
  );
}
