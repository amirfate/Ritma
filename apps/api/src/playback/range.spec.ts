import { computeEffectiveRange } from './range';

describe('computeEffectiveRange', () => {
  it('returns the full content range when no Range header is present', () => {
    expect(computeEffectiveRange(undefined, 1000)).toEqual({ status: 200, start: 0, end: 999 });
  });

  it('serves a standard bytes=start-end range', () => {
    expect(computeEffectiveRange('bytes=100-199', 1000)).toEqual({
      status: 206,
      start: 100,
      end: 199,
    });
  });

  it('serves an open-ended bytes=start- range up to the content limit', () => {
    expect(computeEffectiveRange('bytes=900-', 1000)).toEqual({
      status: 206,
      start: 900,
      end: 999,
    });
  });

  it('serves a suffix bytes=-N range (last N bytes)', () => {
    expect(computeEffectiveRange('bytes=-100', 1000)).toEqual({
      status: 206,
      start: 900,
      end: 999,
    });
  });

  it('clamps a requested end past the content limit down to the limit', () => {
    expect(computeEffectiveRange('bytes=500-999999', 1000)).toEqual({
      status: 206,
      start: 500,
      end: 999,
    });
  });

  it('never returns an end at or beyond contentLimit, regardless of what is requested', () => {
    for (const header of ['bytes=0-999999', 'bytes=0-', 'bytes=-999999', undefined]) {
      const result = computeEffectiveRange(header, 30);
      expect(result.status === 416 ? undefined : result.end).not.toBeGreaterThanOrEqual(30);
    }
  });

  it('rejects a start at or past the content limit with 416', () => {
    expect(computeEffectiveRange('bytes=1000-1001', 1000)).toEqual({ status: 416 });
    expect(computeEffectiveRange('bytes=1000-', 1000)).toEqual({ status: 416 });
  });

  it('rejects a malformed Range header with 416', () => {
    expect(computeEffectiveRange('not-a-range', 1000)).toEqual({ status: 416 });
    expect(computeEffectiveRange('bytes=-', 1000)).toEqual({ status: 416 });
    expect(computeEffectiveRange('bytes=abc-def', 1000)).toEqual({ status: 416 });
  });

  it('rejects an end before start with 416', () => {
    expect(computeEffectiveRange('bytes=500-100', 1000)).toEqual({ status: 416 });
  });

  it('rejects a zero-length suffix range with 416', () => {
    expect(computeEffectiveRange('bytes=-0', 1000)).toEqual({ status: 416 });
  });

  it('rejects any request when the content limit is zero (e.g. an empty preview boundary)', () => {
    expect(computeEffectiveRange(undefined, 0)).toEqual({ status: 416 });
    expect(computeEffectiveRange('bytes=0-0', 0)).toEqual({ status: 416 });
  });
});
