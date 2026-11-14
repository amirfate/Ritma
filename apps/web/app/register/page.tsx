'use client';

import { useState, type FormEvent, type ReactElement } from 'react';

import { useAuth } from '../../lib/store';

export default function RegisterPage(): ReactElement {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await register(email, name, password, inviteCode.trim().toUpperCase());
      window.location.href = '/';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطای غیرمنتظره');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form" onSubmit={(event) => void onSubmit(event)}>
      <h1>ساخت حساب ریتما</h1>
      <label htmlFor="name">نام نمایشی</label>
      <input
        id="name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        required
        minLength={2}
      />
      <label htmlFor="email">ایمیل</label>
      <input
        id="email"
        type="email"
        dir="ltr"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        required
      />
      <label htmlFor="invite">کد دعوت (دوره‌ی بتا فقط با کد دعوت باز می‌شود)</label>
      <input
        id="invite"
        dir="ltr"
        placeholder="RITMA-XXXXXXXX"
        value={inviteCode}
        onChange={(event) => setInviteCode(event.target.value)}
        required
      />
      <label htmlFor="password">گذرواژه (حداقل ۸ کاراکتر، حرف و عدد)</label>
      <input
        id="password"
        type="password"
        dir="ltr"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        required
        minLength={8}
      />
      {error && <div className="err">{error}</div>}
      <button type="submit" className="btn solid" disabled={busy}>
        {busy ? 'در حال ثبت…' : 'ثبت‌نام'}
      </button>
      <div className="hint">
        حساب داری؟ <a href="/login" style={{ color: 'var(--accent)' }}>ورود</a>
      </div>
    </form>
  );
}
