import { resolvePlaybackAccessType } from './playback-access';

describe('resolvePlaybackAccessType', () => {
  it('grants FULL_FREE for a FREE track regardless of purchase state', () => {
    expect(resolvePlaybackAccessType('FREE', false)).toBe('FULL_FREE');
    expect(resolvePlaybackAccessType('FREE', true)).toBe('FULL_FREE');
  });

  it('grants PREVIEW for a PAID track with no matching purchase', () => {
    expect(resolvePlaybackAccessType('PAID', false)).toBe('PREVIEW');
  });

  it('grants FULL_PURCHASED for a PAID track with a matching purchase', () => {
    expect(resolvePlaybackAccessType('PAID', true)).toBe('FULL_PURCHASED');
  });
});
