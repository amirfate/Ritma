import Link from 'next/link';
import { redirect } from 'next/navigation';
import { type ReactElement } from 'react';

import { getLyrics } from '../../../../../lib/server/lyrics.ts';
import { getTrack } from '../../../../../lib/server/tracks.ts';
import { getReadOnlyAccessToken } from '../../../../../lib/server/session.ts';
import { createLyricsAction, updateLyricsAction } from './actions';
import { LyricsForm } from './lyrics-form';

export default async function TrackLyricsPage({
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
      return <p role="alert">You don&apos;t have permission to view this track.</p>;
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
  const lyricsResult = await getLyrics(accessToken, id);

  if (!lyricsResult.ok) {
    if (lyricsResult.status === 401) {
      redirect('/login');
    }
    if (lyricsResult.status === 403) {
      return <p role="alert">You don&apos;t have permission to view lyrics for this track.</p>;
    }
    if (lyricsResult.status === 404) {
      return (
        <section>
          <h2>Lyrics — {track.title}</h2>
          <p>
            This track has no lyrics yet. Lyrics are required before the track can be published.
          </p>
          <LyricsForm action={createLyricsAction.bind(null, id)} submitLabel="Save lyrics" />
          <p>
            <Link href={`/dashboard/tracks/${id}`}>Back to track</Link>
          </p>
        </section>
      );
    }
    return <p role="alert">Could not load lyrics right now. Try again shortly.</p>;
  }

  return (
    <section>
      <h2>Lyrics — {track.title}</h2>
      <LyricsForm
        action={updateLyricsAction.bind(null, id)}
        lyrics={lyricsResult.data}
        submitLabel="Save changes"
      />
      <p>
        <Link href={`/dashboard/tracks/${id}`}>Back to track</Link>
      </p>
    </section>
  );
}
