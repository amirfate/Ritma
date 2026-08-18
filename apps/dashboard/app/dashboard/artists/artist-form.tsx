'use client';

import { type AdminArtist } from '@ritma/api-contracts';
import { type ReactElement } from 'react';
import { useActionState } from 'react';

import { type ArtistFormState } from './actions';

interface ArtistFormProps {
  action: (state: ArtistFormState, formData: FormData) => Promise<ArtistFormState>;
  artist?: AdminArtist;
  submitLabel: string;
}

const INITIAL_STATE: ArtistFormState = {};

export function ArtistForm({ action, artist, submitLabel }: ArtistFormProps): ReactElement {
  const [state, formAction, isPending] = useActionState(action, INITIAL_STATE);

  return (
    <form action={formAction}>
      <label>
        Name
        <input type="text" name="name" defaultValue={artist?.name} required maxLength={200} />
      </label>
      <label>
        Bio
        <textarea name="bio" defaultValue={artist?.bio ?? ''} maxLength={4000} />
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
