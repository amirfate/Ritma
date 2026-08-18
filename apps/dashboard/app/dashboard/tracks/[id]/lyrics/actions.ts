'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { createLyrics, updateLyrics } from '../../../../../lib/server/lyrics.ts';
import { getValidAccessToken } from '../../../../../lib/server/cookies.ts';

export interface LyricsFormState {
  errorMessage?: string;
  fieldMessages?: string[];
}

function extractErrorMessages(body: unknown): string[] {
  if (typeof body === 'object' && body !== null && 'message' in body) {
    const { message } = body;
    if (Array.isArray(message)) {
      return message.filter((entry): entry is string => typeof entry === 'string');
    }
    if (typeof message === 'string') {
      return [message];
    }
  }
  return ['Something went wrong. Please try again.'];
}

function stringField(formData: FormData, name: string): string {
  const raw = formData.get(name);
  return typeof raw === 'string' ? raw.trim() : '';
}

export async function createLyricsAction(
  trackId: string,
  _prevState: LyricsFormState,
  formData: FormData,
): Promise<LyricsFormState> {
  const accessToken = await getValidAccessToken();
  if (!accessToken) {
    redirect('/login');
  }

  const content = stringField(formData, 'content');
  const syncedContent = stringField(formData, 'syncedContent');

  if (content.length === 0) {
    return { fieldMessages: ['Lyrics content is required.'] };
  }

  const result = await createLyrics(accessToken, trackId, {
    content,
    ...(syncedContent.length > 0 ? { syncedContent } : {}),
  });

  if (!result.ok) {
    if (result.status === 401) {
      redirect('/login');
    }
    if (result.status === 404) {
      return { errorMessage: 'This track no longer exists.' };
    }
    if (result.status === 409) {
      return {
        errorMessage: 'Lyrics already exist for this track. Reload the page to edit them instead.',
      };
    }
    if (result.status === 400) {
      return { fieldMessages: extractErrorMessages(result.body) };
    }
    return { errorMessage: `Could not save lyrics (status ${String(result.status)}).` };
  }

  revalidatePath(`/dashboard/tracks/${trackId}`);
  revalidatePath(`/dashboard/tracks/${trackId}/lyrics`);
  redirect(`/dashboard/tracks/${trackId}/lyrics`);
}

export async function updateLyricsAction(
  trackId: string,
  _prevState: LyricsFormState,
  formData: FormData,
): Promise<LyricsFormState> {
  const accessToken = await getValidAccessToken();
  if (!accessToken) {
    redirect('/login');
  }

  const content = stringField(formData, 'content');
  const syncedContent = stringField(formData, 'syncedContent');

  if (content.length === 0) {
    return { fieldMessages: ['Lyrics content is required.'] };
  }

  const result = await updateLyrics(accessToken, trackId, {
    content,
    syncedContent,
  });

  if (!result.ok) {
    if (result.status === 401) {
      redirect('/login');
    }
    if (result.status === 404) {
      return {
        errorMessage: 'This track has no lyrics yet. Reload the page to create them instead.',
      };
    }
    if (result.status === 400) {
      return { fieldMessages: extractErrorMessages(result.body) };
    }
    return { errorMessage: `Could not save lyrics (status ${String(result.status)}).` };
  }

  revalidatePath(`/dashboard/tracks/${trackId}`);
  revalidatePath(`/dashboard/tracks/${trackId}/lyrics`);
  redirect(`/dashboard/tracks/${trackId}/lyrics`);
}
