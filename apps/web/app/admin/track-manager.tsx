'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ReactElement } from 'react';

import { loadSavedAuth, refreshAccessToken } from '../../lib/store';

interface TrackRow {
  id: string;
  title: string;
  audioUrl: string | null;
  durationSec: number;
  isPremium: boolean;
  isSellable: boolean;
  priceIrR: number;
  isPublished: boolean;
  playCount: number;
  artist: { id: string; name: string };
  album: { id: string; title: string } | null;
}

interface ArtistLite {
  id: string;
  name: string;
}

interface AlbumLite {
  id: string;
  title: string;
  artistId: string;
}

function tokenHeaders(json?: boolean): Record<string, string> | null {
  const saved = loadSavedAuth();
  if (!saved) return null;
  const h: Record<string, string> = { Authorization: `Bearer ${saved.token}` };
  if (json) h['Content-Type'] = 'application/json';
  return h;
}

export function TrackManager(): ReactElement {
  const [tracks, setTracks] = useState<TrackRow[] | null>(null);
  const [artists, setArtists] = useState<ArtistLite[]>([]);
  const [albums, setAlbums] = useState<AlbumLite[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // form states
  const [artistName, setArtistName] = useState('');
  const [trackTitle, setTrackTitle] = useState('');
  const [trackArtist, setTrackArtist] = useState('');
  const [trackAlbum, setTrackAlbum] = useState('');
  const [audioKey, setAudioKey] = useState('');
  const [duration, setDuration] = useState('');
  const [isPremium, setIsPremium] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  // inline edit
  const [editKey, setEditKey] = useState<Record<string, string>>({});
  const [editPrice, setEditPrice] = useState<Record<string, string>>({});

  const load = useCallback(async (): Promise<void> => {
    const headers = tokenHeaders();
    if (!headers) return;
    const [t, a, al] = await Promise.all([
      fetch('/api/admin/tracks', { headers }),
      fetch('/api/admin/artists', { headers }),
      fetch('/api/admin/albums', { headers }),
    ]);
    if (t.status === 401) {
      const renewed = await refreshAccessToken();
      if (renewed) {
        await load();
        return;
      }
      setError('نشست منقضی شده — دوباره وارد شوید');
      return;
    }
    if (!t.ok) {
      setError('خطا در دریافت ترک‌ها');
      return;
    }
    setTracks((await t.json()) as TrackRow[]);
    if (a.ok) setArtists((await a.json()) as ArtistLite[]);
    if (al.ok) setAlbums((await al.json()) as AlbumLite[]);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function call(path: string, init: RequestInit, okMsg: string): Promise<boolean> {
    setError(null);
    setMessage(null);
    const res = await fetch(`/api/${path}`, init);
    if (res.status === 401) {
      const renewed = await refreshAccessToken();
      if (renewed) return call(path, init, okMsg);
      setError('نشست منقضی شده — دوباره وارد شوید');
      return false;
    }
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      setError(body.message ?? 'خطا در عملیات');
      return false;
    }
    setMessage(okMsg);
    await load();
    return true;
  }

  async function createArtist(): Promise<void> {
    if (!artistName.trim()) return;
    setBusy('artist');
    const ok = await call(
      'admin/artists',
      {
        method: 'POST',
        headers: tokenHeaders(true) ?? undefined,
        body: JSON.stringify({ name: artistName.trim() }),
      },
      'هنرمند ساخته شد',
    );
    if (ok) setArtistName('');
    setBusy(null);
  }

  function onFileChosen(f: File | null): void {
    setPendingFile(f);
    if (!f) return;
    // auto-fill duration from the local file metadata
    const url = URL.createObjectURL(f);
    const probe = new Audio();
    probe.preload = 'metadata';
    probe.src = url;
    probe.onloadedmetadata = () => {
      if (Number.isFinite(probe.duration) && probe.duration > 0) {
        setDuration(String(Math.round(probe.duration)));
      }
      URL.revokeObjectURL(url);
    };
    probe.onerror = () => URL.revokeObjectURL(url);
  }

  function uploadNow(retry = true): Promise<void> {
    const file = pendingFile;
    const saved = loadSavedAuth();
    if (!file || !saved) return Promise.resolve();
    setUploadPct(0);
    return new Promise<void>((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/admin/upload-audio');
      xhr.setRequestHeader('Authorization', `Bearer ${saved.token}`);
      xhr.upload.onprogress = (ev) => {
        if (ev.lengthComputable) setUploadPct(Math.round((ev.loaded / ev.total) * 100));
      };
      xhr.onload = () => {
        setUploadPct(null);
        if (xhr.status === 401 && retry) {
          void refreshAccessToken().then((ok) => {
            if (ok) void uploadNow(false);
            else setError('نشست منقضی شده — دوباره وارد شوید');
            resolve();
          });
          return;
        }
        try {
          const body = JSON.parse(xhr.responseText) as { audioKey?: string; message?: string };
          if (xhr.status >= 200 && xhr.status < 300 && body.audioKey) {
            setAudioKey(body.audioKey);
            setMessage('فایل آپلود شد — کلید در فرم ثبت شد');
            setPendingFile(null);
          } else {
            setError(body.message ?? 'آپلود ناموفق بود');
          }
        } catch {
          setError('آپلود ناموفق بود');
        }
        resolve();
      };
      xhr.onerror = () => {
        setUploadPct(null);
        setError('آپلود ناموفق بود');
        resolve();
      };
      const fd = new FormData();
      fd.append('file', file);
      xhr.send(fd);
    });
  }

  async function createTrack(): Promise<void> {
    if (!trackTitle.trim() || !trackArtist) return;
    setBusy('track');
    const ok = await call(
      'admin/tracks',
      {
        method: 'POST',
        headers: tokenHeaders(true) ?? undefined,
        body: JSON.stringify({
          title: trackTitle.trim(),
          artistId: trackArtist,
          ...(trackAlbum ? { albumId: trackAlbum } : {}),
          ...(audioKey.trim() ? { audioUrl: audioKey.trim() } : {}),
          ...(duration ? { durationSec: Number(duration) } : {}),
          isPremium,
        }),
      },
      'ترک ساخته شد (پیش‌فرض منتشر نشده)',
    );
    if (ok) {
      setTrackTitle('');
      setAudioKey('');
      setDuration('');
      setIsPremium(false);
    }
    setBusy(null);
  }

  async function saveAudio(id: string): Promise<void> {
    const key = editKey[id];
    if (key === undefined) return;
    setBusy(id);
    await call(
      `admin/tracks/${id}`,
      {
        method: 'PATCH',
        headers: tokenHeaders(true) ?? undefined,
        body: JSON.stringify({ audioUrl: key.trim() || null }),
      },
      'کلید فایل صوتی ثبت شد',
    );
    setBusy(null);
  }

  async function savePrice(id: string): Promise<void> {
    const p = editPrice[id];
    if (p === undefined) return;
    setBusy(id);
    await call(
      `admin/tracks/${id}`,
      {
        method: 'PATCH',
        headers: tokenHeaders(true) ?? undefined,
        body: JSON.stringify({ isSellable: p.trim() !== '', priceIrR: Number(p) * 10 || 0 }),
      },
      'قیمت ثبت شد',
    );
    setBusy(null);
  }

  async function togglePublish(t: TrackRow): Promise<void> {
    setBusy(t.id);
    await call(
      `admin/tracks/${t.id}/${t.isPublished ? 'unpublish' : 'publish'}`,
      { method: 'POST', headers: tokenHeaders(true) ?? undefined, body: '{}' },
      t.isPublished ? 'از انتشار خارج شد' : 'منتشر شد',
    );
    setBusy(null);
  }

  return (
    <>
      <h2>مدیریت ترک‌ها و فایل‌های صوتی</h2>
      {message && <div className="msg">{message}</div>}
      {error && <div className="msg" style={{ color: '#e5484d' }}>{error}</div>}

      <h3>هنرمند جدید</h3>
      <div className="adm-form">
        <input
          placeholder="نام هنرمند"
          value={artistName}
          onChange={(e) => setArtistName(e.target.value)}
        />
        <button type="button" className="btn" disabled={busy === 'artist'} onClick={() => void createArtist()}>
          {busy === 'artist' ? '…' : 'ساخت هنرمند'}
        </button>
      </div>

      <h3>ترک جدید</h3>
      <div className="adm-form">
        <input placeholder="عنوان ترک" value={trackTitle} onChange={(e) => setTrackTitle(e.target.value)} />
        <select value={trackArtist} onChange={(e) => setTrackArtist(e.target.value)}>
          <option value="">— هنرمند را انتخاب کن —</option>
          {artists.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <select value={trackAlbum} onChange={(e) => setTrackAlbum(e.target.value)}>
          <option value="">— بدون آلبوم (تک‌آهنگ) —</option>
          {albums.map((al) => (
            <option key={al.id} value={al.id}>
              {al.title}
            </option>
          ))}
        </select>
        <div className="uploadrow">
          <input
            type="file"
            accept=".mp3,.m4a,.mp4,.flac,.aac,.ogg,audio/*"
            disabled={uploadPct !== null}
            onChange={(e) => onFileChosen(e.target.files?.[0] ?? null)}
          />
          <button type="button" className="btn solid" disabled={!pendingFile || uploadPct !== null} onClick={() => void uploadNow()}>
            {uploadPct !== null ? `${uploadPct}٪` : 'آپلود فایل صوتی'}
          </button>
        </div>
        <input
          dir="ltr"
          placeholder="یا کلید دستی مثل: audio/my-song.m4a"
          value={audioKey}
          onChange={(e) => setAudioKey(e.target.value)}
        />
        <input
          dir="ltr"
          placeholder="مدت (ثانیه)"
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
        />
        <label className="chk">
          <input type="checkbox" checked={isPremium} onChange={(e) => setIsPremium(e.target.checked)} />
          ویژه (Premium)
        </label>
        <button type="button" className="btn solid" disabled={busy === 'track'} onClick={() => void createTrack()}>
          {busy === 'track' ? '…' : 'ساخت ترک'}
        </button>
      </div>

      <h3>ترک‌های موجود</h3>
      {tracks === null ? (
        <p className="muted">در حال بارگذاری…</p>
      ) : tracks.length === 0 ? (
        <p className="muted">هنوز ترکی ثبت نشده است.</p>
      ) : (
        <table className="tbl">
          <thead>
            <tr>
              <th>عنوان</th>
              <th>هنرمند</th>
              <th>audioKey</th>
              <th>قیمت (تومان)</th>
              <th>پخش</th>
              <th>وضعیت</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {tracks.map((t) => (
              <tr key={t.id}>
                <td>
                  {t.title}
                  {t.isPremium && <span className="badge">ویژه</span>}
                </td>
                <td>{t.artist.name}</td>
                <td>
                  <div className="keyrow">
                    <input
                      dir="ltr"
                      value={editKey[t.id] ?? t.audioUrl ?? ''}
                      placeholder="— ثبت نشده —"
                      onChange={(e) => setEditKey({ ...editKey, [t.id]: e.target.value })}
                    />
                    <button
                      type="button"
                      className="btn"
                      disabled={busy === t.id}
                      onClick={() => void saveAudio(t.id)}
                    >
                      ذخیره
                    </button>
                  </div>
                </td>
                <td>
                  <div className="keyrow">
                    <input
                      dir="ltr"
                      value={editPrice[t.id] ?? (t.isSellable ? String(t.priceIrR / 10) : '')}
                      placeholder={t.isSellable ? undefined : 'رایگان/ویژه'}
                      onChange={(e) => setEditPrice({ ...editPrice, [t.id]: e.target.value })}
                    />
                    <button
                      type="button"
                      className="btn"
                      disabled={busy === t.id}
                      onClick={() => void savePrice(t.id)}
                    >
                      ذخیره
                    </button>
                  </div>
                </td>
                <td>{t.playCount.toLocaleString('fa-IR')}</td>
                <td>{t.isPublished ? 'منتشرشده ✅' : 'پیش‌نویس'}</td>
                <td>
                  <button
                    type="button"
                    className="btn"
                    disabled={busy === t.id}
                    onClick={() => void togglePublish(t)}
                  >
                    {t.isPublished ? 'لغو انتشار' : 'انتشار'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
