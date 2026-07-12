import { describe, expect, it } from 'vitest';

import { invariant } from './invariant';

describe('invariant', () => {
  it('does not throw for truthy conditions', () => {
    expect(() => invariant(true, 'must hold')).not.toThrow();
    expect(() => invariant(1, 'must hold')).not.toThrow();
    expect(() => invariant('value', 'must hold')).not.toThrow();
  });

  it('throws with a descriptive message for falsy conditions', () => {
    expect(() => invariant(false, 'flag must be set')).toThrowError(
      'Invariant violation: flag must be set',
    );
    expect(() => invariant(null, 'value required')).toThrowError(
      'Invariant violation: value required',
    );
  });
});
