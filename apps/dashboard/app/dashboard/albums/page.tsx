import { type AdminAlbumQuery } from '@ritma/api-contracts';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { type ReactElement } from 'react';

import { listAlbums } from '../../../lib/server/albums.ts';
import { getReadOnlyAccessToken } from '../../../lib/server/session.ts';
import { AlbumPublishedToggle } from './album-published-toggle';

interface AlbumsSearchParams {
  page?: string;
  q?: string;
  artistId?: string;
  isPublished?: string;
}

function buildPageHref(params: AlbumsSearchParams, page: number): string {
  const search = new URLSearchParams();
  if (params.q) search.set('q', params.q);
  if (params.artistId) search.set('artistId', params.artistId);
  if (params.isPublished) search.set('isPublished', params.isPublished);
  search.set('page', String(page));
  return `/dashboard/albums?${search.toString()}`;
}

export default async function AlbumsListPage({
  searchParams,
}: {
  searchParams: Promise<AlbumsSearchParams>;
}): Promise<ReactElement> {
  const params = await searchParams;
  const accessToken = await getReadOnlyAccessToken();
  if (!accessToken) {
    redirect('/login');
  }

  const page = Math.max(1, Number.parseInt(params.page ?? '1', 10) || 1);
  const query: AdminAlbumQuery = {
    page,
    pageSize: 20,
    ...(params.q ? { q: params.q } : {}),
    ...(params.artistId ? { artistId: params.artistId } : {}),
    ...(params.isPublished === 'true' ? { isPublished: true } : {}),
    ...(params.isPublished === 'false' ? { isPublished: false } : {}),
  };

  const result = await listAlbums(accessToken, query);

  if (!result.ok) {
    if (result.status === 401) {
      redirect('/login');
    }
    if (result.status === 403) {
      return <p role="alert">You don&apos;t have permission to view albums.</p>;
    }
    return <p role="alert">Could not load albums right now. Try again shortly.</p>;
  }

  const { items, total, pageSize } = result.data;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <section>
      <header>
        <h2>Albums</h2>
        <Link href="/dashboard/albums/new">New album</Link>
      </header>

      <form>
        <input type="search" name="q" placeholder="Search by title" defaultValue={params.q ?? ''} />
        <input
          type="text"
          name="artistId"
          placeholder="Filter by artist ID"
          defaultValue={params.artistId ?? ''}
        />
        <select name="isPublished" defaultValue={params.isPublished ?? ''}>
          <option value="">All</option>
          <option value="true">Published</option>
          <option value="false">Unpublished</option>
        </select>
        <button type="submit">Search</button>
      </form>

      {items.length === 0 ? (
        <p>No albums match your search.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Artist</th>
              <th>Status</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {items.map((album) => (
              <tr key={album.id}>
                <td>
                  <Link href={`/dashboard/albums/${album.id}`}>{album.title}</Link>
                </td>
                <td>
                  <Link href={`/dashboard/artists/${album.artistId}`}>{album.artistId}</Link>
                </td>
                <td>{album.isPublished ? 'Published' : 'Unpublished'}</td>
                <td>
                  <AlbumPublishedToggle id={album.id} isPublished={album.isPublished} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <nav aria-label="Pagination">
        {page > 1 ? <Link href={buildPageHref(params, page - 1)}>Previous</Link> : null}
        <span>
          Page {page} of {totalPages}
        </span>
        {page < totalPages ? <Link href={buildPageHref(params, page + 1)}>Next</Link> : null}
      </nav>
    </section>
  );
}
