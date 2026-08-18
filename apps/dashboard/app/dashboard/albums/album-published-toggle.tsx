'use client';

import { type ReactElement } from 'react';
import { useActionState } from 'react';

import { type AlbumFormState, setAlbumPublishedAction } from './actions';

interface AlbumPublishedToggleProps {
  id: string;
  isPublished: boolean;
}

const INITIAL_STATE: AlbumFormState = {};

export function AlbumPublishedToggle({ id, isPublished }: AlbumPublishedToggleProps): ReactElement {
  const boundAction = setAlbumPublishedAction.bind(null, id, !isPublished);
  const [state, formAction, isPending] = useActionState(boundAction, INITIAL_STATE);

  return (
    <form action={formAction}>
      <button type="submit" disabled={isPending}>
        {isPublished ? 'Unpublish' : 'Publish'}
      </button>
      {state.errorMessage ? <p role="alert">{state.errorMessage}</p> : null}
    </form>
  );
}
