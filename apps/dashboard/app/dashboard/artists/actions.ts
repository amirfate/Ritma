'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { createArtist, setArtistActive, updateArtist } from '../../../lib/server/artists.ts';
import { getValidAccessToken } from '../../../lib/server/cookies.ts';

export interface ArtistFormState {
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

export async function createArtistAction(
  _prevState: ArtistFormState,
  formData: FormData,
): Promise<ArtistFormState> {
  const accessToken = await getValidAccessToken();
  if (!accessToken) {
    redirect('/login');
  }

  const name = formData.get('name');
  const bio = formData.get('bio');

  if (typeof name !== 'string' || name.trim().length === 0) {
    return { fieldMessages: ['Name is required.'] };
  }

  const result = await createArtist(accessToken, {
    name: name.trim(),
    ...(typeof bio === 'string' && bio.trim().length > 0 ? { bio: bio.trim() } : {}),
  });

  if (!result.ok) {
    if (result.status === 401) {
      redirect('/login');
    }
    if (result.status === 400) {
      return { fieldMessages: extractErrorMessages(result.body) };
    }
    return { errorMessage: `Could not create the artist (status ${String(result.status)}).` };
  }

  revalidatePath('/dashboard/artists');
  redirect(`/dashboard/artists/${result.data.id}`);
}

export async function updateArtistAction(
  id: string,
  _prevState: ArtistFormState,
  formData: FormData,
): Promise<ArtistFormState> {
  const accessToken = await getValidAccessToken();
  if (!accessToken) {
    redirect('/login');
  }

  const name = formData.get('name');
  const bio = formData.get('bio');

  if (typeof name !== 'string' || name.trim().length === 0) {
    return { fieldMessages: ['Name is required.'] };
  }

  const result = await updateArtist(accessToken, id, {
    name: name.trim(),
    bio: typeof bio === 'string' ? bio.trim() : undefined,
  });

  if (!result.ok) {
    if (result.status === 401) {
      redirect('/login');
    }
    if (result.status === 404) {
      return { errorMessage: 'This artist no longer exists.' };
    }
    if (result.status === 400) {
      return { fieldMessages: extractErrorMessages(result.body) };
    }
    return { errorMessage: `Could not update the artist (status ${String(result.status)}).` };
  }

  revalidatePath('/dashboard/artists');
  revalidatePath(`/dashboard/artists/${id}`);
  redirect(`/dashboard/artists/${id}`);
}

export async function setArtistActiveAction(
  id: string,
  isActive: boolean,
  _prevState: ArtistFormState,
  _formData: FormData,
): Promise<ArtistFormState> {
  const accessToken = await getValidAccessToken();
  if (!accessToken) {
    redirect('/login');
  }

  const result = await setArtistActive(accessToken, id, isActive);

  if (!result.ok) {
    if (result.status === 401) {
      redirect('/login');
    }
    if (result.status === 404) {
      return { errorMessage: 'This artist no longer exists.' };
    }
    return {
      errorMessage: `Could not ${isActive ? 'enable' : 'disable'} the artist (status ${String(result.status)}).`,
    };
  }

  revalidatePath('/dashboard/artists');
  revalidatePath(`/dashboard/artists/${id}`);
  redirect(`/dashboard/artists/${id}`);
}
