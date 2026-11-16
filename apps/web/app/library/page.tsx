'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ReactElement } from 'react';

import { loadSavedAuth } from '../../lib/store';

interface LibTrack {
  id: string;
  title: string;
  priceIrR: number;
  artist: { id: string; name: string; slug: string };
}

/** paid rows come as TrackPurchase { track: {...} } — flatten for rendering */
function flatten(rows: { id: string; track: LibTrack }[] | null): LibTrack[] {
  return (rows ?? []).map((r) => r.track);
}

interface FollowRow {
  artist: { id: string; name: string; slug: string; bio: string | null; _count: { tracks: number } };
}

interface HistRow {
  id: string;
  createdAt: string;
  track: { id: string; title: string; artist: { name: string } };
}

function faDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fa-IR', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function LibraryPage(): ReactElement {
  const [tab, setTab] = useState<'library' | 'follows' | 'history'>('library');
  const [paid, setPaid] = useState<LibTrack[] | null>(null);
  const [free, setFree] = useState<LibTrack[] | null>(null);
  const [follows, setFollows] = useState<FollowRow[] | null>(null);
  const [history, setHistory] = useState<HistRow[] | null>(null);
  const [state, setState] = useState<'loading' | 'anon' | 'ready' | 'error'>('loading');

  const load = useCallback(async (): Promise<void> => {
    const saved = loadSavedAuth();
    if (!saved) {
      setState('anon');
      return;
    }
    const h = { Authorization: `Bearer ${saved.token}` };
    try {
      const [l, f, hist] = await Promise.all([
        fetch('/api/library', { headers: h }),
        fetch('/api/follows', { headers: h }),
        fetch('/api/history', { headers: h }),
      ]);
      if (!l.ok) throw new Error();
      const lib = (await l.json()) as { paid: { id: string; track: LibTrack }[]; free: LibTrack[] };
      setPaid(flatten(lib.paid));
      setFree(lib.free);
      setFollows(f.ok ? ((await f.json()) as FollowRow[]) : []);
      setHistory(hist.ok ? ((await hist.json()) as HistRow[]) : []);
      setState('ready');
    } catch {
      setState('error');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (state === 'anon') {
    return <div className="msg">برای دیدن کتابخانه ابتدا <a className="btn small" href="/login">وارد شوید</a>.</div>;
  }
  if (state === 'loading') return <div className="msg muted">در حال بارگذاری…</div>;
  if (state === 'error') return <div className="msg">خطا در دریافت کتابخانه.</div>;

  function section(): ReactElement {
    if (tab === 'library') {
      return (
        <>
          <h2>خریداری‌شده</h2>
          {paid && paid.length > 0 ? (
            <div className="neu card">
              {paid.map((t) => (
                <a key={t.id} href={`/albums`} className="track-row clickable">
                  <span className="t-name">{t.title}</span>
                  <span className="pill-live" style={{ background: 'transparent', color: 'var(--muted)' }}>
                    {t.artist?.name ?? '—'}
                  </span>
                </a>
              ))}
            </div>
          ) : (
            <p className="muted">هنوز قطعه‌ای نخریده‌اید.</p>
          )}
          <h2 style={{ marginTop: 20 }}>رایگان برای پخش</h2>
          {free && free.length > 0 ? (
            <div className="neu card">
              {free.map((t) => (
                <a key={t.id} href="/albums" className="track-row clickable">
                  <span className="t-name">{t.title}</span>
                  <span className="pill-live" style={{ background: 'transparent', color: 'var(--muted)' }}>
                    {t.artist?.name ?? '—'}
                  </span>
                </a>
              ))}
            </div>
          ) : (
            <p className="muted">قطعه‌ی رایگانی یافت نشد.</p>
          )}
        </>
      );
    }
    if (tab === 'follows') {
      return (
        <>
          {follows && follows.length > 0 ? (
            <div className="grid c3">
              {follows.map((f) => (
                <a key={f.artist.id} href={`/artists/${f.artist.slug}`} className="neu card">
                  <h3>{f.artist.name}</h3>
                  <p className="muted">{f.artist._count.tracks} قطعه</p>
                </a>
              ))}
            </div>
          ) : (
            <p className="muted">هنوز هنرمندی را دنبال نمی‌کنید.</p>
          )}
        </>
      );
    }
    return (
      <>
        {history && history.length > 0 ? (
          <table className="tbl">
            <thead>
              <tr>
                <th>قطعه</th>
                <th>هنرمند</th>
                <th>زمان</th>
              </tr>
            </thead>
            <tbody>
              {history.map((r) => (
                <tr key={r.id}>
                  <td>{r.track.title}</td>
                  <td>{r.track.artist.name}</td>
                  <td>{faDate(r.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="muted">هنوز چیزی پخش نکرده‌اید.</p>
        )}
      </>
    );
  }

  return (
    <>
      <h2 className="sec">موسیقی‌های من</h2>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        {(
          [
            ['library', 'کتابخانه'],
            ['follows', 'دنبال‌شده‌ها'],
            ['history', 'تاریخچه پخش'],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            className={`nbtn small${tab === k ? ' primary' : ''}`}
            onClick={() => setTab(k)}
          >
            {label}
          </button>
        ))}
      </div>
      {section()}
    </>
  );
}
