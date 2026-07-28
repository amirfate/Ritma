/** The locked Milestone 5 preview length. Never derived from client input. */
export const PREVIEW_SECONDS = 30;

/**
 * How long an active session is honored, with no explicit end, before it
 * stops blocking a new session for the same user — set well above the
 * longest plausible single continuous listen so it never cuts off a
 * legitimately still-playing user. No heartbeat/liveness signal is used;
 * reclaim is purely TTL-based, derived from `startedAt` (Milestone 5
 * decision: no `lastActivityAt`, no heartbeat endpoint).
 */
export const PLAYBACK_SESSION_MAX_DURATION_MS = 4 * 60 * 60 * 1000;

/**
 * Upper bound on how many leading bytes are probed to locate the 30-second
 * FLAC frame boundary. Generous even for high-resolution FLAC (24-bit /
 * 96kHz at up to ~3000kbps): 30s of audio is at most ~11.25MB there.
 */
export const PREVIEW_BOUNDARY_PROBE_BYTES = 16 * 1024 * 1024;
