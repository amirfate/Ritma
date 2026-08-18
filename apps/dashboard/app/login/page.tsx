'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent, type ReactElement } from 'react';

import { getOrCreateDeviceFingerprint } from '../../lib/client/device-fingerprint';

type Step = 'phone' | 'code';

interface ErrorBody {
  message?: string;
}

export default function LoginPage(): ReactElement {
  const router = useRouter();
  const [step, setStep] = useState<Step>('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [code, setCode] = useState('');
  const [invitationCode, setInvitationCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSendCode(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/auth/send-code', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ phoneNumber }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as ErrorBody | null;
        setError(body?.message ?? 'Could not send the verification code.');
        return;
      }
      setStep('code');
    } catch {
      setError('Network error while sending the verification code.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleVerify(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          phoneNumber,
          code,
          deviceFingerprint: getOrCreateDeviceFingerprint(),
          deviceLabel: 'Ritma Dashboard',
          ...(invitationCode ? { invitationCode } : {}),
        }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as ErrorBody | null;
        setError(body?.message ?? 'Verification failed.');
        return;
      }
      router.push('/dashboard');
      router.refresh();
    } catch {
      setError('Network error while verifying the code.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main>
      <h1>Ritma Dashboard — Sign in</h1>

      {step === 'phone' ? (
        <form onSubmit={(event) => void handleSendCode(event)}>
          <label>
            Phone number
            <input
              type="tel"
              value={phoneNumber}
              onChange={(event) => setPhoneNumber(event.target.value)}
              required
            />
          </label>
          <button type="submit" disabled={isSubmitting}>
            Send code
          </button>
        </form>
      ) : (
        <form onSubmit={(event) => void handleVerify(event)}>
          <label>
            Verification code
            <input
              type="text"
              inputMode="numeric"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              required
            />
          </label>
          <label>
            Invitation code (first-time sign-in only)
            <input
              type="text"
              value={invitationCode}
              onChange={(event) => setInvitationCode(event.target.value)}
            />
          </label>
          <button type="submit" disabled={isSubmitting}>
            Verify
          </button>
          <button type="button" onClick={() => setStep('phone')} disabled={isSubmitting}>
            Back
          </button>
        </form>
      )}

      {error ? <p role="alert">{error}</p> : null}
    </main>
  );
}
