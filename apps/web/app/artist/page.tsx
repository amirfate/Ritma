'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ReactElement } from 'react';

import { loadSavedAuth } from '../../lib/store';

interface PanelData {
  artist: { id: string; name: string; slug: string };
  share_percent: number;
  donation_share_percent: number;
  sales: { count: number; gross: number };
  albums_count: number;
  donations: { count: number; total: number; net: number };
  earned_total: number;
  paid_out: number;
  pending_payout: number;
  withdrawable: number;
  payouts: { id: string; amountIrR: number; status: string; trackingCode: string | null; createdAt: string; decidedAt: string | null }[];
  per_track: { id: string; title: string; priceIrR: number; sales: number; gross: number }[];
}

function toman(irr: number): string {
  return (irr / 10).toLocaleString('fa-IR');
}

function faDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fa-IR', { year: 'numeric', month: 'short', day: 'numeric' });
}

const STATUS_FA: Record<string, string> = { PENDING: 'در انتظار', PAID: 'پرداخت شد', REJECTED: 'رد شد' };

export default function ArtistPanelPage(): ReactElement {
  const [data, setData] = useState<PanelData | null>(null);
  const [ledger, setLedger] = useState<{ ledger: { id: string; kind: string; amountGross: number; platformFee: number; amountNet: number; note: string | null; createdAt: string }[] } | null>(null);
  const [amountToman, setAmountToman] = useState('10,000');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [state, setState] = useState<'loading' | 'anon' | 'ready' | 'denied' | 'error'>('loading');

  const load = useCallback(async (): Promise<void> => {
    const saved = loadSavedAuth();
    if (!saved) {
      setState('anon');
      return;
    }
    const h = { Authorization: `Bearer ${saved.token}` };
    try {
      const [p, l] = await Promise.all([
        fetch('/api/artist/panel', { headers: h }),
        fetch('/api/artist/ledger', { headers: h }),
      ]);
      if (p.status === 404) {
        setState('denied');
        return;
      }
      if (!p.ok) throw new Error();
      setData((await p.json()) as PanelData);
      setLedger(l.ok ? ((await l.json()) as NonNullable<typeof ledger>) : null);
      setState('ready');
    } catch {
      setState('error');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function requestPayout(): Promise<void> {
    const n = Number(amountToman.replace(/[^\d]/g, ''));
    if (!n || n < 10000) {
      setMessage('حداقل درخواست تسویه ۱۰,۰۰۰ تومان (۱۰۰,۰۰۰ ریال) است');
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const saved = loadSavedAuth();
      const res = await fetch('/api/artist/payouts', {
        method: 'POST',
        headers: { Authorization: `Bearer ${saved?.token ?? ''}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountIrR: n * 10 }),
      });
      const body = (await res.json()) as { message?: string };
      if (!res.ok) throw new Error(body.message ?? 'خطا در ثبت درخواست');
      setMessage('درخواست تسویه ثبت شد — پس از تأیید مدیر پرداخت می‌شود.');
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'خطای غیرمنتظره');
    } finally {
      setBusy(false);
    }
  }

  if (state === 'anon') {
    return <div className="msg">برای دیدن پنل هنرمند ابتدا <a className="btn small" href="/login">وارد شوید</a>.</div>;
  }
  if (state === 'denied') {
    return <div className="msg">پنل هنرمند برای این حساب فعال نیست — مدیر باید هنرمند را به حساب شما متصل کند.</div>;
  }
  if (state === 'loading') return <div className="msg muted">در حال بارگذاری…</div>;
  if (state === 'error' || !data) return <div className="msg">خطا در دریافت اطلاعات پنل.</div>;

  return (
    <>
      <h1>پنل هنرمند — {data.artist.name}</h1>
      <p className="muted">
        سهم فروش: {data.share_percent}٪ — سهم حمایت مالی: {data.donation_share_percent}٪
      </p>
      <div className="stat-grid">
        <div className="stat"><b>{toman(data.earned_total)}</b><span>کل درآمد (تومان)</span></div>
        <div className="stat"><b>{toman(data.withdrawable)}</b><span>قابل تسویه</span></div>
        <div className="stat"><b>{toman(data.pending_payout)}</b><span>در انتظار تسویه</span></div>
        <div className="stat"><b>{data.sales.count.toLocaleString('fa-IR')}</b><span>فروش</span></div>
      </div>

      <section className="sec">
        <h2>درخواست تسویه</h2>
        <div className="card">
          <p style={{ color: 'var(--muted)' }}>مبلغ به تومان — حداقل ۱۰,۰۰۰ تومان</p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <input className="inp" style={{ maxWidth: 200 }} value={amountToman} onChange={(e) => setAmountToman(e.target.value)} inputMode="numeric" />
            <button className="nbtn primary" type="button" disabled={busy} onClick={() => void requestPayout()}>
              ثبت درخواست
            </button>
          </div>
          {message && <p className="msg">{message}</p>}
        </div>
      </section>

      <section className="sec">
        <h2>تسویه‌ها</h2>
        {data.payouts.length > 0 ? (
          <table className="tbl">
            <thead>
              <tr><th>مبلغ (تومان)</th><th>وضعیت</th><th>کد رهگیری</th><th>تاریخ</th></tr>
            </thead>
            <tbody>
              {data.payouts.map((p) => (
                <tr key={p.id}>
                  <td>{toman(p.amountIrR)}</td>
                  <td>{STATUS_FA[p.status] ?? p.status}</td>
                  <td dir="ltr">{p.trackingCode ?? '—'}</td>
                  <td>{faDate(p.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="muted">درخواست تسویه‌ای ثبت نشده است.</p>
        )}
      </section>

      <section className="sec">
        <h2>فروش به تفکیک قطعه</h2>
        {data.per_track.length > 0 ? (
          <table className="tbl">
            <thead>
              <tr><th>قطعه</th><th>قیمت</th><th>فروش</th><th>ناخالص</th></tr>
            </thead>
            <tbody>
              {data.per_track.map((t) => (
                <tr key={t.id}>
                  <td>{t.title}</td>
                  <td>{t.priceIrR === 0 ? 'رایگان' : toman(t.priceIrR)}</td>
                  <td>{t.sales.toLocaleString('fa-IR')}</td>
                  <td>{toman(t.gross)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="muted">قطعه‌ای ثبت نشده است.</p>
        )}
      </section>

      {ledger && ledger.ledger.length > 0 && (
        <section className="sec">
          <h2>کاروئه درآمد</h2>
          <table className="tbl">
            <thead>
              <tr><th>نوع</th><th>ناخالص</th><th>سهم پلتفرم</th><th>سهم شما</th><th>شرح</th><th>تاریخ</th></tr>
            </thead>
            <tbody>
              {ledger.ledger.map((r) => (
                <tr key={r.id}>
                  <td>{r.kind === 'SALE' ? 'فروش' : 'حمایت'}</td>
                  <td>{toman(r.amountGross)}</td>
                  <td>{toman(r.platformFee)}</td>
                  <td>{toman(r.amountNet)}</td>
                  <td>{r.note ?? '—'}</td>
                  <td>{faDate(r.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}
