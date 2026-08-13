'use client';

import {
  type AdminAlbum,
  type AdminArtist,
  type AdminTrack,
  type Genre,
  type TrackType,
} from '@ritma/api-contracts';
import { type ReactElement } from 'react';
import { useActionState, useState } from 'react';

import { type TrackFormState } from './actions';

const GENRES: Genre[] = ['POP', 'TRADITIONAL', 'ROCK', 'RAP', 'ELECTRONIC', 'CLASSICAL', 'FUSION'];

interface TrackFormProps {
  action: (state: TrackFormState, formData: FormData) => Promise<TrackFormState>;
  track?: AdminTrack;
  /** Only passed on create — a track's artist can't be changed after creation (no field for it in the update DTO). */
  artists?: AdminArtist[];
  /** On create: every artist's albums (filtered client-side by the selected artist). On edit: only the track's own artist's albums. */
  albums: AdminAlbum[];
  submitLabel: string;
}

const INITIAL_STATE: TrackFormState = {};

export function TrackForm({
  action,
  track,
  artists,
  albums,
  submitLabel,
}: TrackFormProps): ReactElement {
  const [state, formAction, isPending] = useActionState(action, INITIAL_STATE);
  const [selectedArtistId, setSelectedArtistId] = useState(track?.artistId ?? '');
  const [type, setType] = useState<TrackType>(track?.type ?? 'FREE');

  const albumsForSelectedArtist = artists
    ? albums.filter((album) => album.artistId === selectedArtistId)
    : albums;

  return (
    <form action={formAction}>
      {artists ? (
        <label>
          Artist
          <select
            name="artistId"
            value={selectedArtistId}
            onChange={(event) => setSelectedArtistId(event.target.value)}
            required
          >
            <option value="" disabled>
              Select an artist
            </option>
            {artists.map((artist) => (
              <option key={artist.id} value={artist.id}>
                {artist.name}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p>Artist: {track?.artistId}</p>
      )}

      <label>
        Album (optional)
        <select name="albumId" defaultValue={track?.albumId ?? ''}>
          <option value="">— No album —</option>
          {albumsForSelectedArtist.map((album) => (
            <option key={album.id} value={album.id}>
              {album.title}
            </option>
          ))}
        </select>
      </label>

      <label>
        Title
        <input type="text" name="title" defaultValue={track?.title} required maxLength={200} />
      </label>

      <label>
        Genre
        <select name="genre" defaultValue={track?.genre ?? ''} required>
          <option value="" disabled>
            Select a genre
          </option>
          {GENRES.map((genre) => (
            <option key={genre} value={genre}>
              {genre}
            </option>
          ))}
        </select>
      </label>

      <label>
        Duration (seconds)
        <input
          type="number"
          name="durationSeconds"
          defaultValue={track?.durationSeconds}
          min={1}
          max={3600}
          required
        />
      </label>

      <label>
        Type
        <select
          name="type"
          value={type}
          onChange={(event) => setType(event.target.value as TrackType)}
          required
        >
          <option value="FREE">FREE</option>
          <option value="PAID">PAID</option>
        </select>
      </label>

      {type === 'PAID' ? (
        <label>
          Price
          <input
            type="number"
            name="price"
            step="0.01"
            min="0.01"
            defaultValue={track?.price ?? ''}
            required
          />
        </label>
      ) : null}

      <label>
        FLAC file URL
        <input type="url" name="flacFileUrl" defaultValue={track?.flacFileUrl} required />
      </label>

      <label>
        Cover image URL
        <input type="url" name="coverImageUrl" defaultValue={track?.coverImageUrl} required />
      </label>

      <label>
        Credits (optional)
        <textarea name="credits" defaultValue={track?.credits ?? ''} maxLength={2000} />
      </label>

      <label>
        Story (optional)
        <textarea name="story" defaultValue={track?.story ?? ''} maxLength={4000} />
      </label>

      {state.fieldMessages && state.fieldMessages.length > 0 ? (
        <ul role="alert">
          {state.fieldMessages.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      ) : null}
      {state.errorMessage ? <p role="alert">{state.errorMessage}</p> : null}

      <button type="submit" disabled={isPending}>
        {submitLabel}
      </button>
    </form>
  );
}
