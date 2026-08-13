import Link from 'next/link';
import { redirect } from 'next/navigation';
import { type ReactElement } from 'react';

import { getAlbum } from '../../../../lib/server/albums.ts';
import { getReadOnlyAccessToken } from '../../../../lib/server/session.ts';
import { AlbumPublishedToggle } from '../album-published-toggle';

export default async function AlbumDetailPage({
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
      return <p role="alert">You don&apos;t have permission to view this album.</p>;
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

  const album = result.data;

  return (
    <section>
      <h2>{album.title}</h2>
      <dl>
        <dt>Status</dt>
        <dd>{album.isPublished ? 'Published' : 'Unpublished'}</dd>
        <dt>Artist</dt>
        <dd>
          <Link href={`/dashboard/artists/${album.artistId}`}>{album.artistId}</Link>
        </dd>
        <dt>Cover image</dt>
        <dd>
          <a href={album.coverImageUrl} target="_blank" rel="noreferrer">
            {album.coverImageUrl}
          </a>
        </dd>
        <dt>Release date</dt>
        <dd>{album.releasedAt ? new Date(album.releasedAt).toLocaleDateString() : '—'}</dd>
        <dt>Created</dt>
        <dd>{new Date(album.createdAt).toLocaleString()}</dd>
        <dt>Updated</dt>
        <dd>{new Date(album.updatedAt).toLocaleString()}</dd>
      </dl>

      <p>
        <Link href={`/dashboard/albums/${album.id}/edit`}>Edit</Link>
      </p>
      <AlbumPublishedToggle id={album.id} isPublished={album.isPublished} />

      <p>
        <Link href="/dashboard/albums">Back to albums</Link>
      </p>
    </section>
  );
}
