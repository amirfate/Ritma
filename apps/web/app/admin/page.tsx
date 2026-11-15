'use client';

import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';

import { loadSavedAuth, refreshAccessToken } from '../../lib/store';

interface BetaStatus {
  users: number;
  userCap: number;
  seatsLeft: number;
  successfulInvites: number;
  invitesPerUser: number;
}

interface AuditRow {
  id: string;
  actorEmail: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  createdAt: string;
}

interface AdminOverview {
  beta: BetaStatus;
  users: { id: string; email: string; name: string; role: string; plan: string; createdAt: string }[];
  tracks: number;
  paidOrders: number;
  revenueIrR: number;
  activeDevices: {
    id: string;
    deviceName: string | null;
    lastIp: string | null;
    lastSeenAt: string;
    user: { email: string; name: string };
  }[];
}

function tokenHeaders(): Record<string, string> | null {
  const saved = loadSavedAuth();
  return saved ? { Authorization: `Bearer ${saved.token}` } : null;
}

function toman(irr: number): string {
  return (irr / 10).toLocaleString('fa-IR');
}

function fa(n: number): string {
  return n.toLocaleString('fa-IR');
}

export default function AdminPage(): ReactElement {
  const [data, setData] = useState<AdminOverview | null>(null);
  const [audit, setAudit] = useState<AuditRow[] | null>(null);
  const [state, setState] = useState<'loading' | 'denied' | 'ready' | 'error'>('loading');

  useEffect(() => {
    async function load(): Promise<void> {
      const headers = tokenHeaders();
      if (!headers) {
        setState('denied');
        return;
      }
      const [o, a] = await Promise.all([
        fetch('/api/admin/overview', { headers }),
        fetch('/api/admin/audit?take=20', { headers }),
      ]);
      if (o.status === 401) {
        // access token expired (15 min) — try one silent refresh
        const renewed = await refreshAccessToken();
        if (renewed) {
          await load();
          return;
        }
        setState('denied');
        return;
      }
      if (o.status === 403) {
        setState('denied');
        return;
      }
      if (!o.ok) {
        setState('error');
        return;
      }
      setData((await o.json()) as AdminOverview);
      if (a.ok) {
        const body = (await a.json()) as { items: AuditRow[] };
        setAudit(body.items);
      }
      setState('ready');
    }
    void load();
  }, []);

  if (state === 'loading') return <div className="msg">در حال بارگذاری…</div>;
  if (state === 'denied')
    return <div className="msg">برای مشاهده‌ی داشبورد با حساب مدیر وارد شوید.</div>;
  if (state === 'error' || !data)
    return <div className="msg">خطا در دریافت اطلاعات — دوباره تلاش کنید.</div>;

  return (
    <>
      <h1>داشبورد مدیریت</h1>
      <div className="stat-grid">
        <div className="stat">
          <small>کاربران بتا</small>
          <strong>
            {fa(data.beta.users)} / {fa(data.beta.userCap)}
          </strong>
          <span>{fa(data.beta.seatsLeft)} ظرفیت باقی‌مانده</span>
        </div>
        <div className="stat">
          <small>دعوت‌های موفق</small>
          <strong>{fa(data.beta.successfulInvites)}</strong>
          <span>سقف هر کاربر: {fa(data.beta.invitesPerUser)}</span>
        </div>
        <div className="stat">
          <small>ترک‌ها</small>
          <strong>{fa(data.tracks)}</strong>
        </div>
        <div className="stat">
          <small>درآمد پرداخت‌شده</small>
          <strong>{toman(data.revenueIrR)} تومان</strong>
          <span>{fa(data.paidOrders)} سفارش پرداخت‌شده</span>
        </div>
      </div>

      <h2>کاربران</h2>
      <table className="tbl">
        <thead>
          <tr>
            <th>نام</th>
            <th>ایمیل</th>
            <th>نقش</th>
            <th>پلن</th>
            <th>عضویت</th>
          </tr>
        </thead>
        <tbody>
          {data.users.map((u) => (
            <tr key={u.id}>
              <td>{u.name}</td>
              <td dir="ltr">{u.email}</td>
              <td>{u.role === 'ADMIN' ? 'مدیر' : 'کاربر'}</td>
              <td>{u.plan === 'PREMIUM' ? 'ویژه' : 'رایگان'}</td>
              <td dir="ltr">{new Date(u.createdAt).toLocaleDateString('fa-IR')}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>دستگاه‌های فعال</h2>
      {data.activeDevices.length === 0 ? (
        <p className="muted">دستگاه فعالی ثبت نشده است.</p>
      ) : (
        <table className="tbl">
          <thead>
            <tr>
              <th>کاربر</th>
              <th>دستگاه</th>
              <th>IP</th>
              <th>آخرین فعالیت</th>
            </tr>
          </thead>
          <tbody>
            {data.activeDevices.map((d) => (
              <tr key={d.id}>
                <td>
                  {d.user.name} <span className="muted">({d.user.email})</span>
                </td>
                <td dir="ltr" className="ellip">
                  {d.deviceName ?? '—'}
                </td>
                <td dir="ltr">{d.lastIp ?? '—'}</td>
                <td dir="ltr">{new Date(d.lastSeenAt).toLocaleString('fa-IR')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2>گزارش عملیات (Audit Log)</h2>
      {audit && audit.length > 0 ? (
        <table className="tbl">
          <thead>
            <tr>
              <th>زمان</th>
              <th>کاربر</th>
              <th>عملیات</th>
              <th>موجودیت</th>
            </tr>
          </thead>
          <tbody>
            {audit.map((row) => (
              <tr key={row.id}>
                <td dir="ltr">{new Date(row.createdAt).toLocaleString('fa-IR')}</td>
                <td dir="ltr">{row.actorEmail ?? '—'}</td>
                <td dir="ltr">{row.action}</td>
                <td dir="ltr">
                  {row.entityType}
                  {row.entityId ? `#${row.entityId.slice(0, 8)}` : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="muted">هنوز عملیاتی ثبت نشده است.</p>
      )}
    </>
  );
}
