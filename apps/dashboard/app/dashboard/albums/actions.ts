'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { createAlbum, setAlbumPublished, updateAlbum } from '../../../lib/server/albums.ts';
import { getValidAccessToken } from '../../../lib/server/cookies.ts';

export interface AlbumFormState {
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

export async function createAlbumAction(
  _prevState: AlbumFormState,
  formData: FormData,
): Promise<AlbumFormState> {
  const accessToken = await getValidAccessToken();
  if (!accessToken) {
    redirect('/login');
  }

  const artistId = stringField(formData, 'artistId');
  const title = stringField(formData, 'title');
  const coverImageUrl = stringField(formData, 'coverImageUrl');
  const releasedAt = stringField(formData, 'releasedAt');

  const fieldMessages: string[] = [];
  if (artistId.length === 0) fieldMessages.push('Please select an artist.');
  if (title.length === 0) fieldMessages.push('Title is required.');
  if (coverImageUrl.length === 0) fieldMessages.push('Cover image URL is required.');
  if (fieldMessages.length > 0) {
    return { fieldMessages };
  }

  const result = await createAlbum(accessToken, {
    artistId,
    title,
    coverImageUrl,
    ...(releasedAt.length > 0 ? { releasedAt } : {}),
  });

  if (!result.ok) {
    if (result.status === 401) {
      redirect('/login');
    }
    if (result.status === 404) {
      return { errorMessage: 'The selected artist no longer exists.' };
    }
    if (result.status === 400) {
      return { fieldMessages: extractErrorMessages(result.body) };
    }
    return { errorMessage: `Could not create the album (status ${String(result.status)}).` };
  }

  revalidatePath('/dashboard/albums');
  redirect(`/dashboard/albums/${result.data.id}`);
}

export async function updateAlbumAction(
  id: string,
  _prevState: AlbumFormState,
  formData: FormData,
): Promise<AlbumFormState> {
  const accessToken = await getValidAccessToken();
  if (!accessToken) {
    redirect('/login');
  }

  const title = stringField(formData, 'title');
  const coverImageUrl = stringField(formData, 'coverImageUrl');
  const releasedAt = stringField(formData, 'releasedAt');

  const fieldMessages: string[] = [];
  if (title.length === 0) fieldMessages.push('Title is required.');
  if (coverImageUrl.length === 0) fieldMessages.push('Cover image URL is required.');
  if (fieldMessages.length > 0) {
    return { fieldMessages };
  }

  const result = await updateAlbum(accessToken, id, {
    title,
    coverImageUrl,
    ...(releasedAt.length > 0 ? { releasedAt } : {}),
  });

  if (!result.ok) {
    if (result.status === 401) {
      redirect('/login');
    }
    if (result.status === 404) {
      return { errorMessage: 'This album no longer exists.' };
    }
    if (result.status === 400) {
      return { fieldMessages: extractErrorMessages(result.body) };
    }
    return { errorMessage: `Could not update the album (status ${String(result.status)}).` };
  }

  revalidatePath('/dashboard/albums');
  revalidatePath(`/dashboard/albums/${id}`);
  redirect(`/dashboard/albums/${id}`);
}

export async function setAlbumPublishedAction(
  id: string,
  isPublished: boolean,
  _prevState: AlbumFormState,
  _formData: FormData,
): Promise<AlbumFormState> {
  const accessToken = await getValidAccessToken();
  if (!accessToken) {
    redirect('/login');
  }

  const result = await setAlbumPublished(accessToken, id, isPublished);

  if (!result.ok) {
    if (result.status === 401) {
      redirect('/login');
    }
    if (result.status === 404) {
      return { errorMessage: 'This album no longer exists.' };
    }
    return {
      errorMessage: `Could not ${isPublished ? 'publish' : 'unpublish'} the album (status ${String(result.status)}).`,
    };
  }

  revalidatePath('/dashboard/albums');
  revalidatePath(`/dashboard/albums/${id}`);
  redirect(`/dashboard/albums/${id}`);
}
