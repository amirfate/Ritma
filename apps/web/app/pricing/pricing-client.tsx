'use client';

import { useState, type ReactElement } from 'react';

import { useAuth } from '../../lib/store';

export function toman(irr: number): string {
  return (irr / 10).toLocaleString('fa-IR');
}

export default function PricingClient({ plans }: { plans: PlanRow[] | null }): ReactElement {
  const { user, token } = useAuth();
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  async function buy(planCode: string): Promise<void> {
    if (!user || !token) {
      window.location.href = '/login';
      return;
    }
    setBusy(planCode);
    setError('');
    try {
      const orderRes = await fetch('/api/payments/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ planCode }),
      });
      if (!orderRes.ok) throw new Error('ساخت سفارش ناموفق بود');
      const order = (await orderRes.json()) as { id: string };
      const payRes = await fetch('/api/payments/orders/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          orderId: order.id,
          gateway: 'mock',
          callbackUrl: `${window.location.origin}/payments/mock-pay?orderId=${order.id}&authority=MOCK-WEB`,
        }),
      });
      if (!payRes.ok) throw new Error('شروع پرداخت ناموفق بود');
      const data = (await payRes.json()) as { redirectUrl: string };
      // The mock gateway redirects back to our own mock page; a real gateway
      // would redirect to its hosted checkout instead.
      window.location.href = data.redirectUrl.replace(
        'http://localhost:3001',
        window.location.origin,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطای غیرمنتظره');
      setBusy('');
    }
  }

  if (!plans || plans.length === 0) {
    return (
      <div className="msg">
        سیستم اشتراک هنوز راه‌اندازی نشده است — به‌زودی.
      </div>
    );
  }

  return (
    <>
      <h1 style={{ textAlign: 'center' }}>اشتراک ویژه ریتما</h1>
      <p style={{ textAlign: 'center', color: 'var(--muted)' }}>
        دسترسی کامل به آثار ویژه، بدون تبلیغات، پشتیبانی از هنرمندان
      </p>
      {error && <p style={{ color: 'var(--danger)', textAlign: 'center' }}>{error}</p>}
      <div className="plans" style={{ marginTop: 34 }}>
        {plans.map((plan, index) => (
          <div key={plan.id} className={`plan${index === 1 ? ' hot' : ''}`}>
            <h3>{plan.title}</h3>
            <div className="price">
              {toman(plan.priceIrR)}
              <small> تومان / {plan.durationDays} روز</small>
            </div>
            <button
              type="button"
              className="btn solid"
              disabled={busy === plan.code}
              onClick={() => void buy(plan.code)}
            >
              {busy === plan.code ? 'در حال انتقال…' : 'خرید اشتراک'}
            </button>
          </div>
        ))}
      </div>
      <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13, marginTop: 26 }}>
        پرداخت از طریق درگاه امن انجام می‌شود؛ اشتراک بلافاصله پس از پرداخت فعال می‌گردد.
      </p>
    </>
  );
}

interface PlanRow {
  id: string;
  code: string;
  title: string;
  durationDays: number;
  priceIrR: number;
}
