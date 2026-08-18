import { type AdminArtistQuery } from '@ritma/api-contracts';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { type ReactElement } from 'react';

import { listArtists } from '../../../lib/server/artists.ts';
import { getReadOnlyAccessToken } from '../../../lib/server/session.ts';
import { ArtistActiveToggle } from './artist-active-toggle';

interface ArtistsSearchParams {
  page?: string;
  q?: string;
  isActive?: string;
}

function buildPageHref(params: ArtistsSearchParams, page: number): string {
  const search = new URLSearchParams();
  if (params.q) search.set('q', params.q);
  if (params.isActive) search.set('isActive', params.isActive);
  search.set('page', String(page));
  return `/dashboard/artists?${search.toString()}`;
}

export default async function ArtistsListPage({
  searchParams,
}: {
  searchParams: Promise<ArtistsSearchParams>;
}): Promise<ReactElement> {
  const params = await searchParams;
  const accessToken = await getReadOnlyAccessToken();
  if (!accessToken) {
    redirect('/login');
  }

  const page = Math.max(1, Number.parseInt(params.page ?? '1', 10) || 1);
  const query: AdminArtistQuery = {
    page,
    pageSize: 20,
    ...(params.q ? { q: params.q } : {}),
    ...(params.isActive === 'true' ? { isActive: true } : {}),
    ...(params.isActive === 'false' ? { isActive: false } : {}),
  };

  const result = await listArtists(accessToken, query);

  if (!result.ok) {
    if (result.status === 401) {
      redirect('/login');
    }
    if (result.status === 403) {
      return <p role="alert">You don&apos;t have permission to view artists.</p>;
    }
    return <p role="alert">Could not load artists right now. Try again shortly.</p>;
  }

  const { items, total, pageSize } = result.data;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <section>
      <header>
        <h2>Artists</h2>
        <Link href="/dashboard/artists/new">New artist</Link>
      </header>

      <form>
        <input type="search" name="q" placeholder="Search by name" defaultValue={params.q ?? ''} />
        <select name="isActive" defaultValue={params.isActive ?? ''}>
          <option value="">All</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
        <button type="submit">Search</button>
      </form>

      {items.length === 0 ? (
        <p>No artists match your search.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {items.map((artist) => (
              <tr key={artist.id}>
                <td>
                  <Link href={`/dashboard/artists/${artist.id}`}>{artist.name}</Link>
                </td>
                <td>{artist.isActive ? 'Active' : 'Inactive'}</td>
                <td>
                  <ArtistActiveToggle id={artist.id} isActive={artist.isActive} />
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
