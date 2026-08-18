import { type PlaybackSession } from '@prisma/client';

/**
 * Deliberately just the session id and the resolved access tier — never a
 * raw storage reference (§16/§5 of the M5 spec: the client never learns
 * where the bytes live, only how to ask this API to stream them).
 */
export interface PlaybackSessionResponse {
  id: string;
  accessType: PlaybackSession['accessType'];
}

export function toPlaybackSessionResponse(session: PlaybackSession): PlaybackSessionResponse {
  return { id: session.id, accessType: session.accessType };
}
