import { type TrackStatus, type TrackType } from '@prisma/client';
import { type Decimal } from '@prisma/client/runtime/library';

import { InvalidTrackTransitionError } from '../catalog.errors';

export type TrackLifecycleAction = 'ready' | 'publish' | 'unpublish' | 'archive';

interface Transition {
  from: readonly TrackStatus[];
  to: TrackStatus;
}

/**
 * The locked Milestone 4 lifecycle: DRAFT -> READY -> PUBLISHED ->
 * UNPUBLISHED -> ARCHIVED. Archive is reachable from every non-terminal
 * state (it's the sole terminal state); no other shortcuts or reverse
 * transitions (e.g. re-publishing from UNPUBLISHED) are permitted.
 */
const TRANSITIONS: Record<TrackLifecycleAction, Transition> = {
  ready: { from: ['DRAFT'], to: 'READY' },
  publish: { from: ['READY'], to: 'PUBLISHED' },
  unpublish: { from: ['PUBLISHED'], to: 'UNPUBLISHED' },
  archive: { from: ['DRAFT', 'READY', 'PUBLISHED', 'UNPUBLISHED'], to: 'ARCHIVED' },
};

/** Throws `InvalidTrackTransitionError` if `action` doesn't apply to `currentStatus`. */
export function nextTrackStatus(
  currentStatus: TrackStatus,
  action: TrackLifecycleAction,
): TrackStatus {
  const transition = TRANSITIONS[action];
  if (!transition.from.includes(currentStatus)) {
    throw new InvalidTrackTransitionError(currentStatus, action);
  }
  return transition.to;
}

export interface PublishPrerequisiteInput {
  title: string;
  flacFileUrl: string;
  coverImageUrl: string;
  type: TrackType;
  price: Decimal | null;
  albumId: string | null;
  albumExists: boolean;
  artistIsActive: boolean;
  hasLyrics: boolean;
}

/**
 * Publishing must validate, at minimum: a valid active artist, required
 * metadata, a valid album when one is set, required lyrics, and a valid
 * audio asset reference — per the locked spec. Returns every failing
 * reason at once (rather than failing fast) so an admin can fix
 * everything in one pass instead of one rejected request per problem.
 */
export function collectPublishPrerequisiteFailures(input: PublishPrerequisiteInput): string[] {
  const reasons: string[] = [];

  if (!input.artistIsActive) {
    reasons.push("the track's artist must be active");
  }
  if (!input.title.trim()) {
    reasons.push('title is required');
  }
  if (!input.flacFileUrl.trim()) {
    reasons.push('a valid audio asset reference is required');
  }
  if (!input.coverImageUrl.trim()) {
    reasons.push('a cover image is required');
  }
  if (input.albumId !== null && !input.albumExists) {
    reasons.push('the associated album could not be found');
  }
  if (!input.hasLyrics) {
    reasons.push('lyrics are required before publishing');
  }
  if (input.type === 'PAID' && (!input.price || input.price.lessThanOrEqualTo(0))) {
    reasons.push('a positive price is required for paid tracks');
  }

  return reasons;
}
