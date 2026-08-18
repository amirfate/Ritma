import { type AdminTrackQuery, type Genre, type TrackStatus } from '@ritma/api-contracts';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { type ReactElement } from 'react';

import { listTracks } from '../../../lib/server/tracks.ts';
import { getReadOnlyAccessToken } from '../../../lib/server/session.ts';

const GENRES: Genre[] = ['POP', 'TRADITIONAL', 'ROCK', 'RAP', 'ELECTRONIC', 'CLASSICAL', 'FUSION'];
const STATUSES: TrackStatus[] = ['DRAFT', 'READY', 'PUBLISHED', 'UNPUBLISHED', 'ARCHIVED'];

interface TracksSearchParams {
  page?: string;
  q?: string;
  artistId?: string;
  albumId?: string;
  genre?: string;
  status?: string;
}

function buildPageHref(params: TracksSearchParams, page: number): string {
  const search = new URLSearchParams();
  if (params.q) search.set('q', params.q);
  if (params.artistId) search.set('artistId', params.artistId);
  if (params.albumId) search.set('albumId', params.albumId);
  if (params.genre) search.set('genre', params.genre);
  if (params.status) search.set('status', params.status);
  search.set('page', String(page));
  return `/dashboard/tracks?${search.toString()}`;
}

export default async function TracksListPage({
  searchParams,
}: {
  searchParams: Promise<TracksSearchParams>;
}): Promise<ReactElement> {
  const params = await searchParams;
  const accessToken = await getReadOnlyAccessToken();
  if (!accessToken) {
    redirect('/login');
  }

  const page = Math.max(1, Number.parseInt(params.page ?? '1', 10) || 1);
  const query: AdminTrackQuery = {
    page,
    pageSize: 20,
    ...(params.q ? { q: params.q } : {}),
    ...(params.artistId ? { artistId: params.artistId } : {}),
    ...(params.albumId ? { albumId: params.albumId } : {}),
    ...(params.genre ? { genre: params.genre as Genre } : {}),
    ...(params.status ? { status: params.status as TrackStatus } : {}),
  };

  const result = await listTracks(accessToken, query);

  if (!result.ok) {
    if (result.status === 401) {
      redirect('/login');
    }
    if (result.status === 403) {
      return <p role="alert">You don&apos;t have permission to view tracks.</p>;
    }
    return <p role="alert">Could not load tracks right now. Try again shortly.</p>;
  }

  const { items, total, pageSize } = result.data;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <section>
      <header>
        <h2>Tracks</h2>
        <Link href="/dashboard/tracks/new">New track</Link>
      </header>

      <form>
        <input type="search" name="q" placeholder="Search by title" defaultValue={params.q ?? ''} />
        <input
          type="text"
          name="artistId"
          placeholder="Filter by artist ID"
          defaultValue={params.artistId ?? ''}
        />
        <input
          type="text"
          name="albumId"
          placeholder="Filter by album ID"
          defaultValue={params.albumId ?? ''}
        />
        <select name="genre" defaultValue={params.genre ?? ''}>
          <option value="">All genres</option>
          {GENRES.map((genre) => (
            <option key={genre} value={genre}>
              {genre}
            </option>
          ))}
        </select>
        <select name="status" defaultValue={params.status ?? ''}>
          <option value="">All statuses</option>
          {STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
        <button type="submit">Search</button>
      </form>

      {items.length === 0 ? (
        <p>No tracks match your search.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Artist</th>
              <th>Genre</th>
              <th>Type</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((track) => (
              <tr key={track.id}>
                <td>
                  <Link href={`/dashboard/tracks/${track.id}`}>{track.title}</Link>
                </td>
                <td>
                  <Link href={`/dashboard/artists/${track.artistId}`}>{track.artistId}</Link>
                </td>
                <td>{track.genre}</td>
                <td>{track.type}</td>
                <td>{track.status}</td>
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
