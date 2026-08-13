'use client';

const STORAGE_KEY = 'ritma-dashboard-device-fingerprint';

/**
 * The API's `deviceFingerprint` is an opaque per-device identifier used
 * for the 2-active-device cap, not a credential — unlike the JWTs, it's
 * fine to keep in `localStorage`. Generating a fresh one on every login
 * would otherwise count as a new device each time and burn through that
 * cap, so it's persisted and reused across sessions in this browser.
 */
export function getOrCreateDeviceFingerprint(): string {
  const existing = window.localStorage.getItem(STORAGE_KEY);
  if (existing) {
    return existing;
  }
  const generated = crypto.randomUUID();
  window.localStorage.setItem(STORAGE_KEY, generated);
  return generated;
}
