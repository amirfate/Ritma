const UNIT_TO_MS = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
} as const;

type DurationUnit = keyof typeof UNIT_TO_MS;

function isDurationUnit(value: string): value is DurationUnit {
  return value in UNIT_TO_MS;
}

/**
 * Parses a short duration string (e.g. `15m`, `30d`) into milliseconds.
 * Supports the same `s`/`m`/`h`/`d` suffixes used for `JWT_ACCESS_TTL` and
 * `JWT_REFRESH_TTL`, which is all this project's configuration needs.
 */
export function parseDurationMs(duration: string): number {
  const match = /^(\d+)(s|m|h|d)$/.exec(duration.trim());
  const amount = match?.[1];
  const unit = match?.[2];
  if (!amount || !unit || !isDurationUnit(unit)) {
    throw new Error(
      `Invalid duration string: "${duration}". Expected a format like "15m" or "30d".`,
    );
  }

  return Number(amount) * UNIT_TO_MS[unit];
}

/** Same as {@link parseDurationMs}, expressed in whole seconds. */
export function parseDurationSeconds(duration: string): number {
  return Math.floor(parseDurationMs(duration) / 1000);
}
