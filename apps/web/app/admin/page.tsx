import type { ReactElement } from 'react';

import { serverGet } from '../../lib/server-api';

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
  activeDevices: { id: string; userId: string; deviceName: string | null; lastIp: string | null; lastSeenAt: string; user: { email: string; name: string } }[];
}

function toman(irr: number): string {
  return (irr / 10).toLocaleString('fa-IR');
}

export default async function AdminPage(): Promise<ReactElement> {
  const [data, audit] = await Promise.all([
    serverGet<AdminOverview>('admin/overview'),
    serverGet<{ items: AuditRow[]; total: number }>('admin/audit?take=20'),
  ]);

  if (!data) {
    return <div className="msg">برای مشاهده‌ی داشبورد با حساب مدیر وارد شوید.</div>;
  }

  return (
    <>
      <h1>داشبورد مدیریت</h1>
      <div className="stat-grid">
        <div className="stat">
          <small>کاربران بتا</small>
          <strong>{data.beta.users.toLocaleString('fa-IR')} / {data.beta.userCap.toLocaleString('fa-IR')}</strong>
          <span>{data.beta.seatsLeft.toLocaleString('fa-IR')} ظرفیت باقی‌مانده</span>
        </div>
        <div className="stat">
          <small>دعوت‌های موفق</small>
          <strong>{data.beta.successfulInvites.toLocaleString('fa-IR')}</strong>
          <span>سقف هر کاربر: {data.beta.invitesPerUser.toLocaleString('fa-IR')}</span>
        </div>
        <div className="stat">
          <small>ترک‌ها</small>
          <strong>{data.tracks.toLocaleString('fa-IR')}</strong>
        </div>
        <div className="stat">
          <small>درآمد اشتراک</small>
          <strong>{toman(data.revenueIrR)} تومان</strong>
          <span>{data.paidOrders.toLocaleString('fa-IR')} سفارش پرداخت‌شده</span>
        </div>
      </div>

      <h2>دستگاه‌های فعال</h2>
      {data.activeDevices.length === 0 ? (
        <p className="muted">دستگاه فعالی ثبت نشده است.</p>
      ) : (
        <table className="tbl">
          <thead>
            <tr><th>کاربر</th><th>دستگاه</th><th>IP</th><th>آخرین فعالیت</th></tr>
          </thead>
          <tbody>
            {data.activeDevices.map((d) => (
              <tr key={d.id}>
                <td>{d.user.name} <span className="muted">({d.user.email})</span></td>
                <td dir="ltr" className="ellip">{d.deviceName ?? '—'}</td>
                <td dir="ltr">{d.lastIp ?? '—'}</td>
                <td dir="ltr">{new Date(d.lastSeenAt).toLocaleString('fa-IR')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2>کاربران</h2>
      <table className="tbl">
        <thead>
          <tr><th>نام</th><th>ایمیل</th><th>نقش</th><th>پلن</th><th>عضویت</th></tr>
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

      <h2>گزارش عملیات (Audit Log)</h2>
      {audit?.items.length ? (
        <table className="tbl">
          <thead>
            <tr><th>زمان</th><th>کاربر</th><th>عملیات</th><th>موجودیت</th></tr>
          </thead>
          <tbody>
            {audit.items.map((a) => (
              <tr key={a.id}>
                <td dir="ltr">{new Date(a.createdAt).toLocaleString('fa-IR')}</td>
                <td dir="ltr">{a.actorEmail ?? '—'}</td>
                <td dir="ltr">{a.action}</td>
                <td dir="ltr">{a.entityType}{a.entityId ? `#${a.entityId.slice(0, 8)}` : ''}</td>
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
