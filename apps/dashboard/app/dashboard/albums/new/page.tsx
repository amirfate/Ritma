import Link from 'next/link';
import { redirect } from 'next/navigation';
import { type ReactElement } from 'react';

import { listArtists } from '../../../../lib/server/artists.ts';
import { getReadOnlyAccessToken } from '../../../../lib/server/session.ts';
import { createAlbumAction } from '../actions';
import { AlbumForm } from '../album-form';

export default async function NewAlbumPage(): Promise<ReactElement> {
  const accessToken = await getReadOnlyAccessToken();
  if (!accessToken) {
    redirect('/login');
  }

  const result = await listArtists(accessToken, { page: 1, pageSize: 100 });

  if (!result.ok) {
    if (result.status === 401) {
      redirect('/login');
    }
    if (result.status === 403) {
      return <p role="alert">You don&apos;t have permission to create albums.</p>;
    }
    return <p role="alert">Could not load artists right now. Try again shortly.</p>;
  }

  if (result.data.items.length === 0) {
    return (
      <section>
        <h2>New album</h2>
        <p>
          You need at least one artist before you can create an album.{' '}
          <Link href="/dashboard/artists/new">Create an artist</Link> first.
        </p>
      </section>
    );
  }

  return (
    <section>
      <h2>New album</h2>
      <AlbumForm
        action={createAlbumAction}
        artists={result.data.items}
        submitLabel="Create album"
      />
    </section>
  );
}
