import Link from 'next/link';
import { redirect } from 'next/navigation';
import { type ReactElement } from 'react';

import { listAlbums } from '../../../../../lib/server/albums.ts';
import { getTrack } from '../../../../../lib/server/tracks.ts';
import { getReadOnlyAccessToken } from '../../../../../lib/server/session.ts';
import { updateTrackAction } from '../../actions';
import { TrackForm } from '../../track-form';

export default async function EditTrackPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<ReactElement> {
  const { id } = await params;
  const accessToken = await getReadOnlyAccessToken();
  if (!accessToken) {
    redirect('/login');
  }

  const trackResult = await getTrack(accessToken, id);

  if (!trackResult.ok) {
    if (trackResult.status === 401) {
      redirect('/login');
    }
    if (trackResult.status === 403) {
      return <p role="alert">You don&apos;t have permission to edit this track.</p>;
    }
    if (trackResult.status === 404) {
      return (
        <section>
          <h2>Track not found</h2>
          <p>
            <Link href="/dashboard/tracks">Back to tracks</Link>
          </p>
        </section>
      );
    }
    return <p role="alert">Could not load this track right now. Try again shortly.</p>;
  }

  const track = trackResult.data;

  // Scoped to the track's own (immutable) artist — the update DTO has no field to reassign it.
  const albumsResult = await listAlbums(accessToken, {
    artistId: track.artistId,
    page: 1,
    pageSize: 100,
  });
  const albums = albumsResult.ok ? albumsResult.data.items : [];

  return (
    <section>
      <h2>Edit {track.title}</h2>
      <TrackForm
        action={updateTrackAction.bind(null, id)}
        track={track}
        albums={albums}
        submitLabel="Save changes"
      />
    </section>
  );
}
