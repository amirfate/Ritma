import { type TrackType } from '@prisma/client';

/**
 * The authorization basis for a stream, fixed once at session creation —
 * see PlaybackAccessType in the Prisma schema for why this is persisted
 * rather than re-derived from Track/Purchase state later.
 */
export type PlaybackAccessType = 'PREVIEW' | 'FULL_FREE' | 'FULL_PURCHASED';

/**
 * The locked Milestone 5 access policy: a FREE track always streams in
 * full; a PAID track streams in full only with a matching Purchase,
 * otherwise it is clamped to a preview. This is the only entitlement logic
 * in Milestone 5 — Purchase rows are read here, never created or mutated.
 */
export function resolvePlaybackAccessType(
  trackType: TrackType,
  hasPurchase: boolean,
): PlaybackAccessType {
  if (trackType === 'FREE') {
    return 'FULL_FREE';
  }
  return hasPurchase ? 'FULL_PURCHASED' : 'PREVIEW';
}
