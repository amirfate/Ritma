'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { useEffect, useState, type ReactElement } from 'react';

import { useAuth } from '../../../lib/store';

type Phase = 'checking' | 'ok' | 'fail';

function CallbackInner(): ReactElement {
  const params = useSearchParams();
  const { refreshUser } = useAuth();
  const [phase, setPhase] = useState<Phase>('checking');

  useEffect(() => {
    const orderId = params.get('orderId') ?? '';
    const authority = params.get('authority') ?? '';
    const ok = params.get('ok') !== 'false';
    if (!orderId) {
      setPhase('fail');
      return;
    }
    const query = new URLSearchParams({ orderId, authority, ok: String(ok) });
    fetch(`/api/payments/callback?${query.toString()}`)
      .then((res) => {
        if (!res.ok) throw new Error('failed');
        return res.json() as Promise<{ status: string }>;
      })
      .then((data) => {
        setPhase(data.status === 'PAID' ? 'ok' : 'fail');
        if (data.status === 'PAID') void refreshUser();
      })
      .catch(() => setPhase('fail'));
  }, [params, refreshUser]);

  if (phase === 'checking') {
    return <div className="msg">در حال بررسی نتیجه‌ی پرداخت…</div>;
  }
  if (phase === 'ok') {
    return (
      <div className="authwrap"><div className="neu authbox" style={{ textAlign: 'center' }}>
        <h2>✅ پرداخت موفق</h2>
        <p style={{ color: 'var(--muted)' }}>
          اشتراک ویژه‌ی شما فعال شد. از آثار ویژه لذت ببرید!
        </p>
        <a href="/" className="btn solid">
          بازگشت به خانه
        </a>
      </div></div>
    );
  }
  return (
    <div className="authwrap"><div className="neu authbox" style={{ textAlign: 'center' }}>
      <h2>پرداخت ناموفق</h2>
      <p style={{ color: 'var(--muted)' }}>
        تراکنش تکمیل نشد یا توسط شما لغو شد. می‌توانید دوباره تلاش کنید.
      </p>
      <a href="/" className="btn">
        بازگشت به صفحه‌ی اصلی
      </a>
    </div></div>
  );
}

export default function CallbackPage(): ReactElement {
  return (
    <Suspense fallback={<div className="msg">در حال بارگذاری…</div>}>
      <CallbackInner />
    </Suspense>
  );
}
