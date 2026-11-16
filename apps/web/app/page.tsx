import type { ReactElement } from 'react';

import { serverGet, type AlbumCard, type ArtistCard } from '../lib/server-api';

export default function HomePage(): ReactElement {
  return (
    <>
      <section className="hero">
        <h1>
          به <em>ریتما</em> خوش آمدید
        </h1>
        <p>
          جایی برای شنیدن موسیقی ایرانی با احترام واقعی به آن — کیفیت بالا، پخش بی‌وقفه و پشتیبانی
          مستقیم از هنرمندان.
        </p>
      </section>
      <HomeSections />
    </>
  );
}

async function HomeSections(): Promise<ReactElement> {
  const [albums, artists] = await Promise.all([
    serverGet<AlbumCard[]>('albums?take=8'),
    serverGet<ArtistCard[]>('artists?take=8'),
  ]);
  return (
    <>
      <section className="sec">
        <h2>آلبوم‌ها</h2>
        {albums && albums.length > 0 ? (
          <div className="plcards">
            {albums.map((album) => (
              <a key={album.id} href={`/albums/${album.slug}`} className="neu plcard">
                <div className="cov">♫</div>
                <b>{album.title}</b>
                <div className="sub">{album.artist.name}</div>
              </a>
            ))}
          </div>
        ) : (
          <p style={{ color: 'var(--muted)' }}>هنوز آلبومی منتشر نشده است.</p>
        )}
      </section>
      <section className="sec">
        <h2>هنرمندان برتر</h2>
        {artists && artists.length > 0 ? (
          <div className="ranking">
            {artists.map((artist, i) => (
              <a key={artist.id} href={`/artists/${artist.slug}`} className="rank">
                <div className={'avatar' + (i % 2 === 0 ? ' filled' : '')}>
                  {artist.name.trim().charAt(0)}
                </div>
                <span>{artist.name}</span>
              </a>
            ))}
          </div>
        ) : (
          <p style={{ color: 'var(--muted)' }}>هنوز هنرمندی ثبت نشده است.</p>
        )}
      </section>
    </>
  );
}
