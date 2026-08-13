import Link from 'next/link';
import { redirect } from 'next/navigation';
import { type ReactElement } from 'react';

import { listAlbums } from '../../../../lib/server/albums.ts';
import { listArtists } from '../../../../lib/server/artists.ts';
import { getReadOnlyAccessToken } from '../../../../lib/server/session.ts';
import { createTrackAction } from '../actions';
import { TrackForm } from '../track-form';

export default async function NewTrackPage(): Promise<ReactElement> {
  const accessToken = await getReadOnlyAccessToken();
  if (!accessToken) {
    redirect('/login');
  }

  const [artistsResult, albumsResult] = await Promise.all([
    listArtists(accessToken, { page: 1, pageSize: 100 }),
    listAlbums(accessToken, { page: 1, pageSize: 100 }),
  ]);

  if (!artistsResult.ok) {
    if (artistsResult.status === 401) {
      redirect('/login');
    }
    if (artistsResult.status === 403) {
      return <p role="alert">You don&apos;t have permission to create tracks.</p>;
    }
    return <p role="alert">Could not load artists right now. Try again shortly.</p>;
  }

  if (artistsResult.data.items.length === 0) {
    return (
      <section>
        <h2>New track</h2>
        <p>
          You need at least one artist before you can create a track.{' '}
          <Link href="/dashboard/artists/new">Create an artist</Link> first.
        </p>
      </section>
    );
  }

  // Albums are optional for a track — a failure here degrades to "no album choices" rather than blocking the page.
  const albums = albumsResult.ok ? albumsResult.data.items : [];

  return (
    <section>
      <h2>New track</h2>
      <TrackForm
        action={createTrackAction}
        artists={artistsResult.data.items}
        albums={albums}
        submitLabel="Create track"
      />
    </section>
  );
}
