'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ReactElement } from 'react';

import { loadSavedAuth } from '../../lib/store';

interface DeviceRow {
  id: string;
  deviceName: string | null;
  lastIp: string | null;
  lastSeenAt: string;
  revoked: boolean;
  createdAt: string;
}

function faDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fa-IR', { year: 'numeric', month: 'short', day: 'numeric' });
}

function faTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
}

export default function DevicesPage(): ReactElement {
  const [rows, setRows] = useState<DeviceRow[] | null>(null);
  const [state, setState] = useState<'loading' | 'anon' | 'ready' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    const saved = loadSavedAuth();
    if (!saved) {
      setState('anon');
      return;
    }
    try {
      const res = await fetch('/api/devices', { headers: { Authorization: `Bearer ${saved.token}` } });
      if (!res.ok) throw new Error();
      setRows((await res.json()) as DeviceRow[]);
      setState('ready');
    } catch {
      setState('error');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function revoke(id: string): Promise<void> {
    const saved = loadSavedAuth();
    if (!saved) return;
    setBusy(id);
    setMessage('');
    try {
      const res = await fetch('/api/devices/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${saved.token}` },
        body: JSON.stringify({ deviceId: id }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        setMessage(body?.message ?? 'لغو دستگاه ناموفق بود.');
      } else {
        setMessage('دستگاه لغو شد — برای ورود از آن دستگاه باید دوباره وارد شوید.');
        await load();
      }
    } catch {
      setMessage('خطا در ارتباط با سرور.');
    }
    setBusy(null);
  }

  if (state === 'anon') {
    return (
      <div className="msg">
        برای دیدن دستگاه‌های خود ابتدا <a className="btn small" href="/login">وارد شوید</a>.
      </div>
    );
  }
  if (state === 'loading') return <div className="msg muted">در حال بارگذاری…</div>;
  if (state === 'error') return <div className="msg">خطا در دریافت فهرست دستگاه‌ها.</div>;

  return (
    <>
      <h2>دستگاه‌های من</h2>
      <p className="muted">
        حداکثر ۲ دستگاه فعال برای هر کاربر مجاز است. با لغو یک دستگاه، ورود خودکار آن بسته می‌شود و باید از آن دستگاه دوباره وارد شوید.
      </p>
      {message && <div className="msg">{message}</div>}
      {rows && rows.length > 0 ? (
        <div className="card">
          {rows.map((d) => (
            <div key={d.id} className="track-row" style={{ cursor: 'default' }}>
              <span className="t-name">
                {d.deviceName ?? 'دستگاه ناشناس'}
                {d.revoked ? (
                  <span className="tag red" style={{ marginInlineStart: 10 }}>لغو شده</span>
                ) : (
                  <span className="tag green" style={{ marginInlineStart: 10 }}>فعال</span>
                )}
              </span>
              <span className="pill-live" style={{ background: 'transparent', color: 'var(--muted)' }}>
                {faDate(d.lastSeenAt)} {faTime(d.lastSeenAt)}
                {d.lastIp ? ` — ${d.lastIp}` : ''}
              </span>
              {!d.revoked && (
                <button
                  type="button"
                  className="btn small"
                  disabled={busy === d.id}
                  onClick={() => void revoke(d.id)}
                >
                  {busy === d.id ? 'در حال لغو…' : 'لغو دستگاه'}
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="muted">هنوز دستگاهی ثبت نشده — با اولین ورود، دستگاه شما اینجا نمایش داده می‌شود.</p>
      )}
    </>
  );
}
