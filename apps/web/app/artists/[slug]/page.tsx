import type { ReactElement } from 'react';

import { serverGet, type AlbumCard, type TrackRow } from '../../../lib/server-api';
import { TrackList } from '../../../lib/player';
import { ArtistActions } from '../../../lib/artist-actions';

interface ArtistDetail {
  id: string;
  slug: string;
  name: string;
  bio: string | null;
  albums: AlbumCard[];
  singles: TrackRow[];
}

export default async function ArtistPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<ReactElement> {
  const { slug } = await params;
  const artist = await serverGet<ArtistDetail>(`artists/${encodeURIComponent(slug)}`);
  if (!artist) {
    return <div className="msg">هنرمند یافت نشد.</div>;
  }
  return (
    <>
      <h1 style={{ marginTop: 12 }}>{artist.name}</h1>
      <ArtistActions artistId={artist.id} />
      {artist.bio && <p style={{ color: 'var(--muted)', maxWidth: 560 }}>{artist.bio}</p>}
      <section className="sec">
        <h2>آلبوم‌ها</h2>
        {artist.albums.length > 0 ? (
          <div className="grid">
            {artist.albums.map((album) => (
              <a key={album.id} href={`/albums/${album.slug}`} className="card">
                <div className="cover">♫</div>
                <h3>{album.title}</h3>
              </a>
            ))}
          </div>
        ) : (
          <p style={{ color: 'var(--muted)' }}>آلبومی ندارد.</p>
        )}
      </section>
      {artist.singles.length > 0 && (
        <section className="sec">
          <h2>تک‌آهنگ‌ها</h2>
          <div className="card">
            <TrackList tracks={artist.singles.map((t) => ({ id: t.id, title: t.title, artist: artist.name, priceIrR: t.priceIrR }))} />          </div>
        </section>
      )}
    </>
  );
}
