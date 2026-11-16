'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ReactElement } from 'react';

import { loadSavedAuth } from '../../lib/store';

interface TxRow {
  id: string;
  amountIrR: number;
  kind: string;
  ref: string | null;
  status: string;
  createdAt: string;
}

function toman(irr: number): string {
  return (irr / 10).toLocaleString('fa-IR');
}

function faDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fa-IR', { year: 'numeric', month: 'short', day: 'numeric' });
}

const KIND_FA: Record<string, string> = { CHARGE: 'شارژ', PURCHASE: 'خرید', DONATION: 'حمایت' };

export default function WalletPage(): ReactElement {
  const router = useRouter();
  const [balance, setBalance] = useState<number | null>(null);
  const [tx, setTx] = useState<TxRow[] | null>(null);
  const [amountToman, setAmountToman] = useState('50,000');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [state, setState] = useState<'loading' | 'anon' | 'ready' | 'error'>('loading');

  const load = useCallback(async (): Promise<void> => {
    const saved = loadSavedAuth();
    if (!saved) {
      setState('anon');
      return;
    }
    try {
      const [b, t] = await Promise.all([
        fetch('/api/wallet', { headers: { Authorization: `Bearer ${saved.token}` } }),
        fetch('/api/wallet/tx', { headers: { Authorization: `Bearer ${saved.token}` } }),
      ]);
      if (!b.ok) throw new Error('خطا در دریافت موجودی');
      setBalance(((await b.json()) as { balanceIrR: number }).balanceIrR);
      setTx(t.ok ? ((await t.json()) as TxRow[]) : []);
      setState('ready');
    } catch {
      setState('error');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function charge(): Promise<void> {
    const n = Number(amountToman.replace(/[^\d]/g, ''));
    if (!n || n < 10000) {
      setMessage('حداقل مبلغ شارژ ۱۰,۰۰۰ تومان است');
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const saved = loadSavedAuth();
      const res = await fetch('/api/wallet/charge', {
        method: 'POST',
        headers: { Authorization: `Bearer ${saved?.token ?? ''}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountIrR: n * 10 }),
      });
      const body = (await res.json()) as { ref?: string; message?: string };
      if (!res.ok) throw new Error(body.message ?? 'خطا در ایجاد تراکنش');
      router.push(`/pay/${body.ref}`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'خطای غیرمنتظره');
    } finally {
      setBusy(false);
    }
  }

  if (state === 'anon') {
    return <div className="msg">برای دیدن کیف پول ابتدا <a className="btn small" href="/login">وارد شوید</a>.</div>;
  }
  if (state === 'loading') return <div className="msg muted">در حال بارگذاری…</div>;
  if (state === 'error') return <div className="msg">خطا در دریافت اطلاعات کیف پول.</div>;

  return (
    <>
      <h2 className="sec">کیف پول</h2>
      <div className="stat-grid">
        <div className="neu stat">
          <b>{balance !== null ? toman(balance) : '—'}</b>
          <span>تومان موجودی</span>
        </div>
      </div>

      <section className="sec">
        <h2>شارژ کیف پول</h2>
        <div className="neu card">
          <p style={{ color: 'var(--muted)' }}>مبلغ به تومان — حداقل ۱۰,۰۰۰ تومان</p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <input
              className="inp"
              style={{ maxWidth: 200 }}
              value={amountToman}
              onChange={(e) => setAmountToman(e.target.value)}
              inputMode="numeric"
            />
            <button className="nbtn primary" type="button" disabled={busy} onClick={() => void charge()}>
              پرداخت
            </button>
          </div>
          {message && <p className="msg">{message}</p>}
        </div>
      </section>

      <section className="sec">
        <h2>تراکنش‌ها</h2>
        {tx && tx.length > 0 ? (
          <div className="neu card" style={{ padding: 0 }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>نوع</th>
                <th>مبلغ (تومان)</th>
                <th>وضعیت</th>
                <th>تاریخ</th>
              </tr>
            </thead>
            <tbody>
              {tx.map((r) => (
                <tr key={r.id}>
                  <td>{KIND_FA[r.kind] ?? r.kind}</td>
                  <td style={{ color: r.amountIrR >= 0 ? 'var(--accent)' : 'inherit' }}>
                    {r.amountIrR >= 0 ? '+' : '−'}
                    {toman(Math.abs(r.amountIrR))}
                  </td>
                  <td>{r.status === 'DONE' ? 'انجام شد' : r.status}</td>
                  <td>{faDate(r.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        ) : (
          <p style={{ color: 'var(--muted)' }}>هنوز تراکنشی ندارید.</p>
        )}
      </section>
    </>
  );
}
