import type { ReactElement } from 'react';

import { serverGet, type AlbumCard } from '../../lib/server-api';

export default async function AlbumsPage(): Promise<ReactElement> {
  const albums = await serverGet<AlbumCard[]>('albums?take=50');
  return (
    <>
      <h2 className="sec">آلبوم‌ها</h2>
      {albums && albums.length > 0 ? (
        <div className="grid" style={{ marginTop: 22 }}>
          {albums.map((album) => (
            <a key={album.id} href={`/albums/${album.slug}`} className="neu card">
              <div className="cover">♫</div>
              <h3>{album.title}</h3>
              <div className="sub">{album.artist.name}</div>
            </a>
          ))}
        </div>
      ) : (
        <p style={{ color: 'var(--muted)' }}>هنوز آلبومی منتشر نشده است.</p>
      )}
    </>
  );
}
