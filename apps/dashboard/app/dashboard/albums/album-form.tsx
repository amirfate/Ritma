'use client';

import { type AdminAlbum, type AdminArtist } from '@ritma/api-contracts';
import { type ReactElement } from 'react';
import { useActionState } from 'react';

import { type AlbumFormState } from './actions';

interface AlbumFormProps {
  action: (state: AlbumFormState, formData: FormData) => Promise<AlbumFormState>;
  album?: AdminAlbum;
  /** Only passed on create — an album's artist can't be changed after creation (no field for it in the update DTO). */
  artists?: AdminArtist[];
  submitLabel: string;
}

const INITIAL_STATE: AlbumFormState = {};

export function AlbumForm({ action, album, artists, submitLabel }: AlbumFormProps): ReactElement {
  const [state, formAction, isPending] = useActionState(action, INITIAL_STATE);

  return (
    <form action={formAction}>
      {artists ? (
        <label>
          Artist
          <select name="artistId" defaultValue="" required>
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
      ) : null}

      <label>
        Title
        <input type="text" name="title" defaultValue={album?.title} required maxLength={200} />
      </label>

      <label>
        Cover image URL
        <input type="url" name="coverImageUrl" defaultValue={album?.coverImageUrl} required />
      </label>

      <label>
        Release date
        <input
          type="date"
          name="releasedAt"
          defaultValue={album?.releasedAt ? album.releasedAt.slice(0, 10) : ''}
        />
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
