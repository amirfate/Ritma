'use client';

import { type LyricsResponse } from '@ritma/api-contracts';
import { type ReactElement } from 'react';
import { useActionState } from 'react';

import { type LyricsFormState } from './actions';

interface LyricsFormProps {
  action: (state: LyricsFormState, formData: FormData) => Promise<LyricsFormState>;
  lyrics?: LyricsResponse;
  submitLabel: string;
}

const INITIAL_STATE: LyricsFormState = {};

export function LyricsForm({ action, lyrics, submitLabel }: LyricsFormProps): ReactElement {
  const [state, formAction, isPending] = useActionState(action, INITIAL_STATE);

  return (
    <form action={formAction}>
      <label>
        Lyrics
        <textarea name="content" defaultValue={lyrics?.content ?? ''} required rows={12} />
      </label>

      <label>
        Synced lyrics (optional — e.g. LRC-format timestamped text)
        <textarea name="syncedContent" defaultValue={lyrics?.syncedContent ?? ''} rows={12} />
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
