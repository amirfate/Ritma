'use client';

import { type AdminTrack, type TrackLifecycleAction } from '@ritma/api-contracts';
import { type ReactElement } from 'react';
import { useActionState } from 'react';

import { availableTrackActions, trackActionLabel } from '../../../lib/server/track-lifecycle-ui.ts';
import { transitionTrackAction, type TrackFormState } from './actions';

const INITIAL_STATE: TrackFormState = {};

function ActionButton({ id, action }: { id: string; action: TrackLifecycleAction }): ReactElement {
  const boundAction = transitionTrackAction.bind(null, id, action);
  const [state, formAction, isPending] = useActionState(boundAction, INITIAL_STATE);

  return (
    <form action={formAction}>
      <button type="submit" disabled={isPending}>
        {trackActionLabel(action)}
      </button>
      {state.errorMessage ? <p role="alert">{state.errorMessage}</p> : null}
      {state.fieldMessages && state.fieldMessages.length > 0 ? (
        <ul role="alert">
          {state.fieldMessages.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      ) : null}
    </form>
  );
}

/**
 * Renders one form per available action, derived from `track.status` (the
 * authoritative state the API just returned) via the read-only mirror in
 * `track-lifecycle-ui.ts`. If a race lets a stale button through, the
 * backend's own `InvalidTrackTransitionError` is what actually stops it —
 * this component never decides success, only which buttons to offer.
 */
export function TrackLifecycleActions({ track }: { track: AdminTrack }): ReactElement {
  const actions = availableTrackActions(track.status);

  if (actions.length === 0) {
    return <p>This track is archived — no further lifecycle actions are available.</p>;
  }

  return (
    <div>
      {actions.map((action) => (
        <ActionButton key={action} id={track.id} action={action} />
      ))}
    </div>
  );
}
