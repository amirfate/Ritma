import Link from 'next/link';
import { redirect } from 'next/navigation';
import { type ReactElement } from 'react';

import { getArtist } from '../../../../lib/server/artists.ts';
import { getReadOnlyAccessToken } from '../../../../lib/server/session.ts';
import { ArtistActiveToggle } from '../artist-active-toggle';

export default async function ArtistDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<ReactElement> {
  const { id } = await params;
  const accessToken = await getReadOnlyAccessToken();
  if (!accessToken) {
    redirect('/login');
  }

  const result = await getArtist(accessToken, id);

  if (!result.ok) {
    if (result.status === 401) {
      redirect('/login');
    }
    if (result.status === 403) {
      return <p role="alert">You don&apos;t have permission to view this artist.</p>;
    }
    if (result.status === 404) {
      return (
        <section>
          <h2>Artist not found</h2>
          <p>
            <Link href="/dashboard/artists">Back to artists</Link>
          </p>
        </section>
      );
    }
    return <p role="alert">Could not load this artist right now. Try again shortly.</p>;
  }

  const artist = result.data;

  return (
    <section>
      <h2>{artist.name}</h2>
      <dl>
        <dt>Status</dt>
        <dd>{artist.isActive ? 'Active' : 'Inactive'}</dd>
        <dt>Bio</dt>
        <dd>{artist.bio ?? '—'}</dd>
        <dt>Created</dt>
        <dd>{new Date(artist.createdAt).toLocaleString()}</dd>
        <dt>Updated</dt>
        <dd>{new Date(artist.updatedAt).toLocaleString()}</dd>
      </dl>

      <p>
        <Link href={`/dashboard/artists/${artist.id}/edit`}>Edit</Link>
      </p>
      <ArtistActiveToggle id={artist.id} isActive={artist.isActive} />

      <p>
        <Link href="/dashboard/artists">Back to artists</Link>
      </p>
    </section>
  );
}
