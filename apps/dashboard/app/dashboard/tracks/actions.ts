'use server';

import { type Genre, type TrackLifecycleAction, type TrackType } from '@ritma/api-contracts';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { createTrack, transitionTrack, updateTrack } from '../../../lib/server/tracks.ts';
import { getValidAccessToken } from '../../../lib/server/cookies.ts';

export interface TrackFormState {
  errorMessage?: string;
  fieldMessages?: string[];
}

/**
 * Unlike Artist/Album's error bodies, a failed `publish` can come back as
 * a `PublishPrerequisitesNotMetError` with a `reasons` array (every failing
 * prerequisite at once) instead of a single `message` string — surfaced
 * here verbatim, never re-derived client-side.
 */
function extractErrorMessages(body: unknown): string[] {
  if (typeof body === 'object' && body !== null) {
    if ('reasons' in body) {
      const { reasons } = body;
      if (Array.isArray(reasons)) {
        const filtered = reasons.filter((entry): entry is string => typeof entry === 'string');
        if (filtered.length > 0) {
          return filtered;
        }
      }
    }
    if ('message' in body) {
      const { message } = body;
      if (Array.isArray(message)) {
        return message.filter((entry): entry is string => typeof entry === 'string');
      }
      if (typeof message === 'string') {
        return [message];
      }
    }
  }
  return ['Something went wrong. Please try again.'];
}

function stringField(formData: FormData, name: string): string {
  const raw = formData.get(name);
  return typeof raw === 'string' ? raw.trim() : '';
}

interface ParsedTrackFields {
  albumId: string;
  title: string;
  genre: string;
  durationSeconds: number | null;
  type: string;
  price: string;
  flacFileUrl: string;
  coverImageUrl: string;
  credits: string;
  story: string;
}

function parseTrackFields(formData: FormData): ParsedTrackFields {
  const durationRaw = stringField(formData, 'durationSeconds');
  const durationSeconds = /^\d+$/.test(durationRaw) ? Number.parseInt(durationRaw, 10) : null;

  return {
    albumId: stringField(formData, 'albumId'),
    title: stringField(formData, 'title'),
    genre: stringField(formData, 'genre'),
    durationSeconds,
    type: stringField(formData, 'type'),
    price: stringField(formData, 'price'),
    flacFileUrl: stringField(formData, 'flacFileUrl'),
    coverImageUrl: stringField(formData, 'coverImageUrl'),
    credits: stringField(formData, 'credits'),
    story: stringField(formData, 'story'),
  };
}

/** Bounds echoed from `CreateTrackDto`'s `@Min(1) @Max(3600)` for immediate feedback; the backend re-validates regardless. */
function validateCommonFields(fields: ParsedTrackFields): string[] {
  const messages: string[] = [];
  if (fields.title.length === 0) messages.push('Title is required.');
  if (fields.genre.length === 0) messages.push('Genre is required.');
  if (
    fields.durationSeconds === null ||
    fields.durationSeconds < 1 ||
    fields.durationSeconds > 3600
  ) {
    messages.push('Duration must be a whole number of seconds between 1 and 3600.');
  }
  if (fields.type.length === 0) messages.push('Type is required.');
  if (fields.type === 'PAID' && fields.price.length === 0) {
    messages.push('Price is required for paid tracks.');
  }
  if (fields.flacFileUrl.length === 0) messages.push('FLAC file URL is required.');
  if (fields.coverImageUrl.length === 0) messages.push('Cover image URL is required.');
  return messages;
}

export async function createTrackAction(
  _prevState: TrackFormState,
  formData: FormData,
): Promise<TrackFormState> {
  const accessToken = await getValidAccessToken();
  if (!accessToken) {
    redirect('/login');
  }

  const artistId = stringField(formData, 'artistId');
  const fields = parseTrackFields(formData);

  const fieldMessages = validateCommonFields(fields);
  if (artistId.length === 0) fieldMessages.unshift('Please select an artist.');
  if (fieldMessages.length > 0) {
    return { fieldMessages };
  }

  const result = await createTrack(accessToken, {
    artistId,
    ...(fields.albumId.length > 0 ? { albumId: fields.albumId } : {}),
    title: fields.title,
    // Guarded by validateCommonFields: genre/type are non-empty strings matching the fixed Genre/TrackType enums by construction (select options).
    genre: fields.genre as Genre,
    durationSeconds: fields.durationSeconds ?? 0,
    type: fields.type as TrackType,
    ...(fields.type === 'PAID' ? { price: Number(fields.price) } : {}),
    flacFileUrl: fields.flacFileUrl,
    coverImageUrl: fields.coverImageUrl,
    ...(fields.credits.length > 0 ? { credits: fields.credits } : {}),
    ...(fields.story.length > 0 ? { story: fields.story } : {}),
  });

  if (!result.ok) {
    if (result.status === 401) {
      redirect('/login');
    }
    if (result.status === 404) {
      return { errorMessage: 'The selected artist or album no longer exists.' };
    }
    if (result.status === 400) {
      return { fieldMessages: extractErrorMessages(result.body) };
    }
    return { errorMessage: `Could not create the track (status ${String(result.status)}).` };
  }

  revalidatePath('/dashboard/tracks');
  redirect(`/dashboard/tracks/${result.data.id}`);
}

export async function updateTrackAction(
  id: string,
  _prevState: TrackFormState,
  formData: FormData,
): Promise<TrackFormState> {
  const accessToken = await getValidAccessToken();
  if (!accessToken) {
    redirect('/login');
  }

  const fields = parseTrackFields(formData);
  const fieldMessages = validateCommonFields(fields);
  if (fieldMessages.length > 0) {
    return { fieldMessages };
  }

  const result = await updateTrack(accessToken, id, {
    albumId: fields.albumId.length > 0 ? fields.albumId : null,
    title: fields.title,
    genre: fields.genre as Genre,
    durationSeconds: fields.durationSeconds ?? 0,
    type: fields.type as TrackType,
    ...(fields.type === 'PAID' ? { price: Number(fields.price) } : {}),
    flacFileUrl: fields.flacFileUrl,
    coverImageUrl: fields.coverImageUrl,
    credits: fields.credits,
    story: fields.story,
  });

  if (!result.ok) {
    if (result.status === 401) {
      redirect('/login');
    }
    if (result.status === 404) {
      return { errorMessage: 'This track — or the selected album — no longer exists.' };
    }
    if (result.status === 400) {
      return { fieldMessages: extractErrorMessages(result.body) };
    }
    return { errorMessage: `Could not update the track (status ${String(result.status)}).` };
  }

  revalidatePath('/dashboard/tracks');
  revalidatePath(`/dashboard/tracks/${id}`);
  redirect(`/dashboard/tracks/${id}`);
}

export async function transitionTrackAction(
  id: string,
  action: TrackLifecycleAction,
  _prevState: TrackFormState,
  _formData: FormData,
): Promise<TrackFormState> {
  const accessToken = await getValidAccessToken();
  if (!accessToken) {
    redirect('/login');
  }

  const result = await transitionTrack(accessToken, id, action);

  if (!result.ok) {
    if (result.status === 401) {
      redirect('/login');
    }
    if (result.status === 404) {
      return { errorMessage: 'This track no longer exists.' };
    }
    if (result.status === 400) {
      return { fieldMessages: extractErrorMessages(result.body) };
    }
    return { errorMessage: `Could not perform "${action}" (status ${String(result.status)}).` };
  }

  revalidatePath('/dashboard/tracks');
  revalidatePath(`/dashboard/tracks/${id}`);
  redirect(`/dashboard/tracks/${id}`);
}
