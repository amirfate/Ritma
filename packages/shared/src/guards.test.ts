import { describe, expect, it } from 'vitest';

import { isDefined, isNonEmptyString } from './guards';

describe('isDefined', () => {
  it('rejects null and undefined', () => {
    expect(isDefined(null)).toBe(false);
    expect(isDefined(undefined)).toBe(false);
  });

  it('accepts falsy but defined values', () => {
    expect(isDefined(0)).toBe(true);
    expect(isDefined('')).toBe(true);
    expect(isDefined(false)).toBe(true);
  });

  it('filters arrays down to defined values', () => {
    const values: (number | null | undefined)[] = [1, null, 2, undefined, 3];
    expect(values.filter(isDefined)).toEqual([1, 2, 3]);
  });
});

describe('isNonEmptyString', () => {
  it('accepts strings with visible characters', () => {
    expect(isNonEmptyString('ritma')).toBe(true);
    expect(isNonEmptyString('  x  ')).toBe(true);
  });

  it('rejects empty, whitespace-only, and non-string values', () => {
    expect(isNonEmptyString('')).toBe(false);
    expect(isNonEmptyString('   ')).toBe(false);
    expect(isNonEmptyString(42)).toBe(false);
    expect(isNonEmptyString(null)).toBe(false);
  });
});
