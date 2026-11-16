'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { ReactElement } from 'react';

import { loadSavedAuth } from '../../../lib/store';

interface PayRefView {
  ref: string;
  kind: string; // charge | purchase | donation
  amountIrR: number;
  status: string; // PENDING | PAID | CANCELED
  payload: { trackId?: string; artistId?: string; isAnonymous?: boolean };
}

const KIND_FA: Record<string, string> = { charge: 'شارژ کیف پول', purchase: 'خرید قطعه', donation: 'حمایت از هنرمند' };

function toman(irr: number): string {
  return (irr / 10).toLocaleString('fa-IR');
}

export default function PayRefPage(): ReactElement {
  const params = useParams<{ ref: string }>();
  const router = useRouter();
  const ref = params.ref;
  const [data, setData] = useState<PayRefView | null>(null);
  const [state, setState] = useState<'loading' | 'anon' | 'ready' | 'error'>('loading');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    const saved = loadSavedAuth();
    if (!saved) {
      setState('anon');
      return;
    }
    try {
      const res = await fetch(`/api/pay/${ref}`, { headers: { Authorization: `Bearer ${saved.token}` } });
      if (!res.ok) throw new Error();
      setData((await res.json()) as PayRefView);
      setState('ready');
    } catch {
      setState('error');
    }
  }, [ref]);

  useEffect(() => {
    void load();
  }, [load]);

  async function confirm(): Promise<void> {
    setBusy(true);
    setMessage(null);
    try {
      const saved = loadSavedAuth();
      const res = await fetch(`/api/pay/${ref}/confirm`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${saved?.token ?? ''}` },
      });
      const body = (await res.json()) as { balanceIrR?: number; message?: string };
      if (!res.ok) throw new Error(body.message ?? 'خطا در تسویه');
      router.push('/wallet?paid=1');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'خطای غیرمنتظره');
    } finally {
      setBusy(false);
    }
  }

  async function cancel(): Promise<void> {
    setBusy(true);
    const saved = loadSavedAuth();
    await fetch(`/api/pay/${ref}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${saved?.token ?? ''}` },
    });
    router.push('/wallet');
  }

  if (state === 'anon') {
    return <div className="msg">برای ادامه‌ی پرداخت ابتدا <a className="btn small" href="/login">وارد شوید</a>.</div>;
  }
  if (state === 'loading') return <div className="msg muted">در حال بارگذاری…</div>;
  if (state === 'error' || !data) return <div className="msg">تراکنش یافت نشد.</div>;

  return (
    <div className="authwrap">
      <div className="neu authbox">
        <h2>پرداخت</h2>
        <div className="kv">
          <span>نوع</span>
          <b>{KIND_FA[data.kind] ?? data.kind}</b>
        </div>
        <div className="kv">
          <span>مبلغ</span>
          <b>
            {toman(data.amountIrR)} <span style={{ fontWeight: 400 }}>تومان</span>
          </b>
        </div>
        <div className="kv">
          <span>شماره پیگیری</span>
          <b dir="ltr">{data.ref}</b>
        </div>
        {data.status !== 'PENDING' ? (
          <p className="msg">
            {data.status === 'PAID' ? 'این تراکنش قبلاً پرداخت شده است.' : 'این تراکنش لغو شده است.'}
          </p>
        ) : (
          <>
            <p style={{ color: 'var(--muted)' }}>
              درگاه آزمایشی بتا — با تأیید، مبلغ تسویه می‌شود.
            </p>
            <div className="row" style={{ marginTop: 22 }}>
              <button className="nbtn primary" type="button" style={{ flex: 1 }} disabled={busy} onClick={() => void confirm()}>
                تأیید و پرداخت
              </button>
              <button className="nbtn" type="button" style={{ flex: 1 }} disabled={busy} onClick={() => void cancel()}>
                انصراف
              </button>
            </div>
          </>
        )}
        {message && <p className="msg">{message}</p>}
      </div>
    </div>
  );
}
