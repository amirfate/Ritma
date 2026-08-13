import Link from 'next/link';
import { redirect } from 'next/navigation';
import { type ReactElement } from 'react';

import { getTrack } from '../../../../lib/server/tracks.ts';
import { getReadOnlyAccessToken } from '../../../../lib/server/session.ts';
import { TrackLifecycleActions } from '../track-lifecycle-actions';

export default async function TrackDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<ReactElement> {
  const { id } = await params;
  const accessToken = await getReadOnlyAccessToken();
  if (!accessToken) {
    redirect('/login');
  }

  const result = await getTrack(accessToken, id);

  if (!result.ok) {
    if (result.status === 401) {
      redirect('/login');
    }
    if (result.status === 403) {
      return <p role="alert">You don&apos;t have permission to view this track.</p>;
    }
    if (result.status === 404) {
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

  const track = result.data;

  return (
    <section>
      <h2>{track.title}</h2>
      <dl>
        <dt>Status</dt>
        <dd>{track.status}</dd>
        <dt>Artist</dt>
        <dd>
          <Link href={`/dashboard/artists/${track.artistId}`}>{track.artistId}</Link>
        </dd>
        <dt>Album</dt>
        <dd>
          {track.albumId ? (
            <Link href={`/dashboard/albums/${track.albumId}`}>{track.albumId}</Link>
          ) : (
            '— No album —'
          )}
        </dd>
        <dt>Genre</dt>
        <dd>{track.genre}</dd>
        <dt>Duration</dt>
        <dd>{track.durationSeconds}s</dd>
        <dt>Type</dt>
        <dd>{track.type}</dd>
        <dt>Price</dt>
        <dd>{track.price ?? '—'}</dd>
        <dt>FLAC file</dt>
        <dd>
          <a href={track.flacFileUrl} target="_blank" rel="noreferrer">
            {track.flacFileUrl}
          </a>
        </dd>
        <dt>Cover image</dt>
        <dd>
          <a href={track.coverImageUrl} target="_blank" rel="noreferrer">
            {track.coverImageUrl}
          </a>
        </dd>
        <dt>Credits</dt>
        <dd>{track.credits ?? '—'}</dd>
        <dt>Story</dt>
        <dd>{track.story ?? '—'}</dd>
        <dt>Created</dt>
        <dd>{new Date(track.createdAt).toLocaleString()}</dd>
        <dt>Updated</dt>
        <dd>{new Date(track.updatedAt).toLocaleString()}</dd>
        <dt>Published</dt>
        <dd>{track.publishedAt ? new Date(track.publishedAt).toLocaleString() : '—'}</dd>
        <dt>Archived</dt>
        <dd>{track.archivedAt ? new Date(track.archivedAt).toLocaleString() : '—'}</dd>
      </dl>

      {/* The backend's `update()` has no status guard — editing metadata is allowed at any lifecycle stage, including ARCHIVED. */}
      <p>
        <Link href={`/dashboard/tracks/${track.id}/edit`}>Edit</Link>
        {' · '}
        <Link href={`/dashboard/tracks/${track.id}/lyrics`}>Lyrics</Link>
      </p>
      <TrackLifecycleActions track={track} />

      <p>
        <Link href="/dashboard/tracks">Back to tracks</Link>
      </p>
    </section>
  );
}
