import Link from 'next/link';
import { redirect } from 'next/navigation';
import { type ReactElement } from 'react';

import { getAlbum } from '../../../../../lib/server/albums.ts';
import { getReadOnlyAccessToken } from '../../../../../lib/server/session.ts';
import { updateAlbumAction } from '../../actions';
import { AlbumForm } from '../../album-form';

export default async function EditAlbumPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<ReactElement> {
  const { id } = await params;
  const accessToken = await getReadOnlyAccessToken();
  if (!accessToken) {
    redirect('/login');
  }

  const result = await getAlbum(accessToken, id);

  if (!result.ok) {
    if (result.status === 401) {
      redirect('/login');
    }
    if (result.status === 403) {
      return <p role="alert">You don&apos;t have permission to edit this album.</p>;
    }
    if (result.status === 404) {
      return (
        <section>
          <h2>Album not found</h2>
          <p>
            <Link href="/dashboard/albums">Back to albums</Link>
          </p>
        </section>
      );
    }
    return <p role="alert">Could not load this album right now. Try again shortly.</p>;
  }

  return (
    <section>
      <h2>Edit {result.data.title}</h2>
      <AlbumForm
        action={updateAlbumAction.bind(null, id)}
        album={result.data}
        submitLabel="Save changes"
      />
    </section>
  );
}
