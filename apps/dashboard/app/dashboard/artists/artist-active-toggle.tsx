'use client';

import { type ReactElement } from 'react';
import { useActionState } from 'react';

import { type ArtistFormState, setArtistActiveAction } from './actions';

interface ArtistActiveToggleProps {
  id: string;
  isActive: boolean;
}

const INITIAL_STATE: ArtistFormState = {};

export function ArtistActiveToggle({ id, isActive }: ArtistActiveToggleProps): ReactElement {
  const boundAction = setArtistActiveAction.bind(null, id, !isActive);
  const [state, formAction, isPending] = useActionState(boundAction, INITIAL_STATE);

  return (
    <form action={formAction}>
      <button type="submit" disabled={isPending}>
        {isActive ? 'Disable' : 'Enable'}
      </button>
      {state.errorMessage ? <p role="alert">{state.errorMessage}</p> : null}
    </form>
  );
}
