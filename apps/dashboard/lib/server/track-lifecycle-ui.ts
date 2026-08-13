import { type TrackLifecycleAction, type TrackStatus } from '@ritma/api-contracts';

/**
 * Read-only mirror of the transition graph in
 * `apps/api/src/catalog/track/track-lifecycle.ts`'s `TRANSITIONS` table —
 * used ONLY to decide which lifecycle buttons to render for a given
 * `status`. It does not replicate any of the actual prerequisite checks
 * (active artist, lyrics present, price/type match, etc.) — those stay
 * entirely server-side, and their failures are surfaced verbatim from the
 * API response, never re-derived here. The backend's `nextTrackStatus`
 * remains the sole authority on whether an action actually succeeds; if
 * this table and the backend's ever drift, the backend still wins — the
 * dashboard would just show a stale button that fails with a clear error.
 */
const ACTIONS_BY_STATUS: Record<TrackStatus, readonly TrackLifecycleAction[]> = {
  DRAFT: ['ready', 'archive'],
  READY: ['publish', 'archive'],
  PUBLISHED: ['unpublish', 'archive'],
  UNPUBLISHED: ['archive'],
  ARCHIVED: [],
};

export function availableTrackActions(status: TrackStatus): readonly TrackLifecycleAction[] {
  return ACTIONS_BY_STATUS[status];
}

const ACTION_LABELS: Record<TrackLifecycleAction, string> = {
  ready: 'Mark ready',
  publish: 'Publish',
  unpublish: 'Unpublish',
  archive: 'Archive',
};

export function trackActionLabel(action: TrackLifecycleAction): string {
  return ACTION_LABELS[action];
}
