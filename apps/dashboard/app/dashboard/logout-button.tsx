'use client';

import { useRouter } from 'next/navigation';
import { type ReactElement } from 'react';

export function LogoutButton(): ReactElement {
  const router = useRouter();

  async function handleLogout(): Promise<void> {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <button type="button" onClick={() => void handleLogout()}>
      Log out
    </button>
  );
}
