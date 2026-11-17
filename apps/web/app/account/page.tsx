'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ReactElement } from 'react';

import { loadSavedAuth, refreshAccessToken, useAuth } from '../../lib/store';

interface DeviceRow {
  id: string;
  deviceName: string | null;
  lastIp: string | null;
  lastSeenAt: string;
  revoked: boolean;
  createdAt: string;
}

interface InviteRow {
  id: string;
  code: string;
  note: string | null;
  usedAt: string | null;
  revoked: boolean;
  createdAt: string;
  usedBy: { email: string; name: string } | null;
}

function tokenHeaders(): Record<string, string> | null {
  const saved = loadSavedAuth();
  return saved ? { Authorization: `Bearer ${saved.token}` } : null;
}

function jsonHeaders(): Record<string, string> | null {
  const saved = loadSavedAuth();
  return saved
    ? { Authorization: `Bearer ${saved.token}`, 'Content-Type': 'application/json' }
    : null;
}

function fa(n: number): string {
  return n.toLocaleString('fa-IR');
}

export default function AccountPage(): ReactElement {
  const { user, logout } = useAuth();
  const [devices, setDevices] = useState<DeviceRow[] | null>(null);
  const [invites, setInvites] = useState<InviteRow[] | null>(null);
  const [state, setState] = useState<'loading' | 'anon' | 'ready' | 'error'>('loading');
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    const headers = tokenHeaders();
    if (!headers) {
      setState('anon');
      return;
    }
    const [d, i] = await Promise.all([
      fetch('/api/devices', { headers }),
      fetch('/api/beta/invites', { headers }),
    ]);
    if (d.status === 401 || i.status === 401) {
      const renewed = await refreshAccessToken();
      if (renewed) {
        await load();
        return;
      }
      setState('anon');
      return;
    }
    if (!d.ok || !i.ok) {
      setState('error');
      return;
    }
    setDevices((await d.json()) as DeviceRow[]);
    setInvites((await i.json()) as InviteRow[]);
    setState('ready');
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function revoke(deviceId: string): Promise<void> {
    setBusy(deviceId);
    setMessage(null);
    try {
      const headers = jsonHeaders();
      if (!headers) return;
      const res = await fetch('/api/devices/revoke', {
        method: 'POST',
        headers,
        body: JSON.stringify({ deviceId }),
      });
      if (res.status === 401) {
        const renewed = await refreshAccessToken();
        if (!renewed) {
          logout();
          return;
        }
      } else if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        setMessage(body.message ?? 'خطا در باطل کردن دستگاه');
        return;
      }
      setMessage('دستگاه باطل شد — نشست آن بیرون انداخته شد.');
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function createInvite(): Promise<void> {
    setBusy('invite');
    setMessage(null);
    try {
      const headers = jsonHeaders();
      if (!headers) return;
      const res = await fetch('/api/beta/invites', { method: 'POST', headers, body: '{}' });
      if (res.status === 401) {
        const renewed = await refreshAccessToken();
        if (!renewed) {
          logout();
          return;
        }
      } else if (res.status === 403) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        setMessage(body.message ?? 'سقف دعوت‌ها پر شده است');
        return;
      } else if (!res.ok) {
        setMessage('خطا در ساخت کد دعوت');
        return;
      }
      setMessage('کد دعوت جدید ساخته شد.');
      await load();
    } finally {
      setBusy(null);
    }
  }

  if (state === 'loading') return <div className="msg">در حال بارگذاری…</div>;
  if (state === 'anon' || !user)
    return <div className="msg">برای مشاهده‌ی حساب، ابتدا وارد شوید.</div>;
  if (state === 'error') return <div className="msg">خطا در دریافت اطلاعات — دوباره تلاش کنید.</div>;

  const activeDevices = devices?.filter((d) => !d.revoked) ?? [];
  const usedInvites = invites?.filter((i) => i.usedAt) ?? [];
  const unusedInvites = invites?.filter((i) => !i.usedAt && !i.revoked) ?? [];

  return (
    <>
      <h2 className="sec">حساب من</h2>
      <p className="muted">
        {user.name} — <span dir="ltr">{user.email}</span>
      </p>
      {message && <div className="msg">{message}</div>}

      <h2 className="sec">دستگاه‌های من ({fa(activeDevices.length)} فعال)</h2>
      <p className="muted">
        حداکثر ۲ دستگاه فعال — اگر جایی لاگین کرده‌ای و دیگر از آن استفاده نمی‌کنی، آن را باطل کن تا
        جا باز شود. باطل کردن دستگاه، همه‌ی نشست‌های آن را بیرون می‌اندازد.
      </p>
      {devices && devices.length > 0 ? (
        <table className="tbl">
          <thead>
            <tr>
              <th>دستگاه</th>
              <th>IP</th>
              <th>آخرین فعالیت</th>
              <th>وضعیت</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {devices.map((d) => (
              <tr key={d.id}>
                <td dir="ltr" className="ellip">
                  {d.deviceName ?? '—'}
                </td>
                <td dir="ltr">{d.lastIp ?? '—'}</td>
                <td dir="ltr">{new Date(d.lastSeenAt).toLocaleString('fa-IR')}</td>
                <td>{d.revoked ? 'باطل‌شده' : 'فعال'}</td>
                <td>
                  {!d.revoked && (
                    <button
                      type="button"
                      className="btn"
                      disabled={busy === d.id}
                      onClick={() => void revoke(d.id)}
                    >
                      {busy === d.id ? '…' : 'باطل کردن'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="muted">دستگاهی ثبت نشده است.</p>
      )}

      <h2 className="sec">دعوت‌های من</h2>
      <p className="muted">
        تا سقف ۱۰ دعوتِ موفق می‌توانی دوستانت را وارد بتا کنی. کد را برایشان بفرست و آن‌ها در صفحه‌ی
        ثبت‌نام وارد کنند.
      </p>
      <button
        type="button"
        className="btn solid"
        disabled={busy === 'invite'}
        onClick={() => void createInvite()}
      >
        {busy === 'invite' ? 'در حال ساخت…' : '+ کد دعوت جدید'}
      </button>

      {invites && invites.length > 0 ? (
        <table className="tbl">
          <thead>
            <tr>
              <th>کد</th>
              <th>وضعیت</th>
              <th>استفاده‌کننده</th>
              <th>ساخت</th>
            </tr>
          </thead>
          <tbody>
            {invites.map((i) => (
              <tr key={i.id}>
                <td dir="ltr">
                  <strong>{i.code}</strong>
                </td>
                <td>
                  {i.revoked ? 'باطل‌شده' : i.usedAt ? 'استفاده‌شده ✅' : 'آماده ارسال'}
                </td>
                <td dir="ltr">{i.usedBy ? i.usedBy.email : '—'}</td>
                <td dir="ltr">{new Date(i.createdAt).toLocaleDateString('fa-IR')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="muted">هنوز کدی نساخته‌ای — {fa(usedInvites.length)} دعوت موفق تاکنون.</p>
      )}
      {unusedInvites.length > 0 && (
        <p className="muted">{fa(unusedInvites.length)} کدِ آماده‌ی ارسال داری.</p>
      )}
    </>
  );
}
