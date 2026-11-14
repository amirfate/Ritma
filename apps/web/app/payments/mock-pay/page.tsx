'use client';

// Mock payment gateway page (development only). A real gateway replaces this
// with its own hosted page; the callback contract stays the same.

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { useEffect, useState, type ReactElement } from 'react';

function MockPayInner(): ReactElement {
  const params = useSearchParams();
  const orderId = params.get('orderId') ?? '';
  const authority = params.get('authority') ?? 'MOCK-UNKNOWN';
  const [note, setNote] = useState('در حال اتصال به درگاه آزمایشی…');

  useEffect(() => {
    if (orderId) setNote(`سفارش ${orderId.slice(0, 8)}… — مبلغ در انتظار پرداخت`);
  }, [orderId]);

  function decide(ok: boolean): void {
    const query = new URLSearchParams({ orderId, authority, ok: String(ok) });
    window.location.href = `/payments/callback?${query.toString()}`;
  }

  return (
    <div className="msg">
      <h1 style={{ marginTop: 0 }}>درگاه پرداخت آزمایشی</h1>
      <p style={{ color: 'var(--muted)' }}>{note}</p>
      <p style={{ color: 'var(--muted)', fontSize: 13 }}>
        این صفحه فقط برای محیط توسعه است. در تولید، درگاه واقعی (مثلاً زرین‌پال) جای آن را می‌گیرد.
      </p>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
        <button type="button" className="btn solid" onClick={() => decide(true)}>
          پرداخت موفق
        </button>
        <button type="button" className="btn" onClick={() => decide(false)}>
          انصراف
        </button>
      </div>
    </div>
  );
}

export default function MockPayPage(): ReactElement {
  return (
    <Suspense fallback={<div className="msg">در حال بارگذاری…</div>}>
      <MockPayInner />
    </Suspense>
  );
}
