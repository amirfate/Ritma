'use client';

import { useState, type FormEvent, type ReactElement } from 'react';

import { useAuth } from '../../lib/store';

export default function LoginPage(): ReactElement {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(email, password);
      window.location.href = '/';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطای غیرمنتظره');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form" onSubmit={(event) => void onSubmit(event)}>
      <h1>ورود به ریتما</h1>
      <label htmlFor="email">ایمیل</label>
      <input
        id="email"
        type="email"
        dir="ltr"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        required
      />
      <label htmlFor="password">گذرواژه</label>
      <input
        id="password"
        type="password"
        dir="ltr"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        required
      />
      {error && <div className="err">{error}</div>}
      <button type="submit" className="btn solid" disabled={busy}>
        {busy ? 'در حال ورود…' : 'ورود'}
      </button>
      <div className="hint">
        حساب نداری؟ <a href="/register" style={{ color: 'var(--accent)' }}>ثبت‌نام</a>
      </div>
    </form>
  );
}
