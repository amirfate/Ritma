import Link from 'next/link';
import { redirect } from 'next/navigation';
import { type ReactElement } from 'react';

import { getArtist } from '../../../../../lib/server/artists.ts';
import { getReadOnlyAccessToken } from '../../../../../lib/server/session.ts';
import { updateArtistAction } from '../../actions';
import { ArtistForm } from '../../artist-form';

export default async function EditArtistPage({
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
      return <p role="alert">You don&apos;t have permission to edit this artist.</p>;
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

  return (
    <section>
      <h2>Edit {result.data.name}</h2>
      <ArtistForm
        action={updateArtistAction.bind(null, id)}
        artist={result.data}
        submitLabel="Save changes"
      />
    </section>
  );
}
