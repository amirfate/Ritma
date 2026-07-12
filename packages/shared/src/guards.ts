/**
 * Type guard that narrows out `null` and `undefined`.
 * Useful as an `Array#filter` predicate.
 */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/**
 * Type guard for strings that contain at least one non-whitespace character.
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
