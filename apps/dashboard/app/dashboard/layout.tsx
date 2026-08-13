import Link from 'next/link';
import { redirect } from 'next/navigation';
import { type ReactElement, type ReactNode } from 'react';

import { getCurrentUser } from '../../lib/server/session';
import { LogoutButton } from './logout-button';

/**
 * ADMIN-only for M7 — the only role any `admin/*` endpoint currently
 * authorizes (verified: every `@Roles()` in the API is `@Roles('ADMIN')`,
 * none for ARTIST). A signed-in ARTIST/LISTENER sees a plain notice
 * instead of a shell that would imply access the API won't grant.
 */
export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}): Promise<ReactElement> {
  const result = await getCurrentUser();

  if (result.status === 'unauthorized') {
    redirect('/login');
  }

  if (result.status === 'forbidden' || result.status === 'error') {
    return (
      <main>
        <h1>Ritma Dashboard</h1>
        <p>
          {result.status === 'forbidden'
            ? 'Your session is no longer authorized. Please sign in again.'
            : 'The Ritma API is unavailable right now. Try again shortly.'}
        </p>
      </main>
    );
  }

  if (result.user.role !== 'ADMIN') {
    return (
      <main>
        <h1>Ritma Dashboard</h1>
        <p>This Dashboard is currently available to administrators only.</p>
      </main>
    );
  }

  return (
    <div>
      <header>
        <nav>
          <Link href="/dashboard">Overview</Link>
          <Link href="/dashboard/artists">Artists</Link>
          <Link href="/dashboard/albums">Albums</Link>
          <Link href="/dashboard/tracks">Tracks</Link>
        </nav>
        <span>
          Signed in as {result.user.phoneNumber} ({result.user.role})
        </span>
        <LogoutButton />
      </header>
      <main>{children}</main>
    </div>
  );
}
