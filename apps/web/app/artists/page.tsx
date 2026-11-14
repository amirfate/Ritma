import type { ReactElement } from 'react';

import { serverGet, type ArtistCard } from '../../lib/server-api';

export default async function ArtistsPage(): Promise<ReactElement> {
  const artists = await serverGet<ArtistCard[]>('artists?take=50');
  return (
    <>
      <h1 style={{ marginTop: 12 }}>هنرمندان</h1>
      {artists && artists.length > 0 ? (
        <div className="grid" style={{ marginTop: 22 }}>
          {artists.map((artist) => (
            <a key={artist.id} href={`/artists/${artist.slug}`} className="card">
              <div className="cover">◉</div>
              <h3>{artist.name}</h3>
            </a>
          ))}
        </div>
      ) : (
        <p style={{ color: 'var(--muted)' }}>هنوز هنرمندی ثبت نشده است.</p>
      )}
    </>
  );
}
