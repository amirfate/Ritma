'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ReactElement } from 'react';

import { loadSavedAuth } from './store';

export function ArtistActions({ artistId }: { artistId: string }): ReactElement {
  const [following, setFollowing] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [donateOpen, setDonateOpen] = useState(false);
  const [amountToman, setAmountToman] = useState('5,000');
  const [anon, setAnon] = useState(false);

  const check = useCallback(async (): Promise<void> => {
    const saved = loadSavedAuth();
    if (!saved) {
      setFollowing(null);
      return;
    }
    try {
      const res = await fetch('/api/follows', { headers: { Authorization: `Bearer ${saved.token}` } });
      if (!res.ok) return;
      const rows = (await res.json()) as { artist: { id: string } }[];
      setFollowing(rows.some((r) => r.artist.id === artistId));
    } catch {
      setFollowing(null);
    }
  }, [artistId]);

  useEffect(() => {
    void check();
  }, [check]);

  async function toggleFollow(): Promise<void> {
    const saved = loadSavedAuth();
    if (!saved) {
      setMessage('برای دنبال‌کردن ابتدا وارد شوید.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/artists/${artistId}/follow`, {
        method: following ? 'DELETE' : 'POST',
        headers: { Authorization: `Bearer ${saved.token}` },
      });
      if (res.ok) setFollowing(!following);
    } finally {
      setBusy(false);
    }
  }

  async function donate(): Promise<void> {
    const n = Number(amountToman.replace(/[^\d]/g, ''));
    if (!n || n < 1000) {
      setMessage('حداقل حمایت ۱,۰۰۰ تومان است');
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const saved = loadSavedAuth();
      if (!saved) {
        setMessage('برای حمایت ابتدا وارد شوید.');
        return;
      }
      const res = await fetch(`/api/artists/${artistId}/donate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${saved.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountIrR: n * 10, isAnonymous: anon }),
      });
      const body = (await res.json()) as { ok?: boolean; paidFrom?: string; needGateway?: boolean; ref?: string; message?: string };
      if (!res.ok) throw new Error(body.message ?? 'خطا در ثبت حمایت');
      if (body.needGateway && body.ref) {
        window.location.href = `/pay/${body.ref}`;
        return;
      }
      setMessage('حمایت شما ثبت شد — از پشتیبانی شما سپاسگزاریم.');
      setDonateOpen(false);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'خطای غیرمنتظره');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', margin: '10px 0 4px' }}>
      {following !== null && (
        <button className={`nbtn small${following ? '' : ' primary'}`} type="button" disabled={busy} onClick={() => void toggleFollow()}>
          {following ? 'دنبال می‌کنید ✓' : 'دنبال‌کردن'}
        </button>
      )}
      {following === null && (
        <a className="nbtn small" href="/login">
          برای حمایت وارد شوید
        </a>
      )}
      <button className="nbtn small" type="button" onClick={() => setDonateOpen((o) => !o)}>
        ♥ حمایت مالی
      </button>
      {donateOpen && (
        <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input className="inp" style={{ maxWidth: 140 }} value={amountToman} onChange={(e) => setAmountToman(e.target.value)} inputMode="numeric" />
          <label style={{ fontSize: 13, color: 'var(--muted)' }}>
            <input type="checkbox" checked={anon} onChange={(e) => setAnon(e.target.checked)} /> ناشناس
          </label>
          <button className="nbtn small primary" type="button" disabled={busy} onClick={() => void donate()}>
            ثبت
          </button>
        </span>
      )}
      {message && <span className="msg">{message}</span>}
    </div>
  );
}
