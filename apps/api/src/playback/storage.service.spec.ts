import { resolveMinioObjectKey } from './storage.service';

describe('resolveMinioObjectKey', () => {
  it('extracts the URL path, without a leading slash, as the object key', () => {
    expect(resolveMinioObjectKey('https://cdn.example.com/tracks/abc123.flac')).toBe(
      'tracks/abc123.flac',
    );
  });

  it('strips only leading slashes, not internal ones', () => {
    expect(resolveMinioObjectKey('https://cdn.example.com/a/b/c.flac')).toBe('a/b/c.flac');
  });

  it('ignores the query string and host', () => {
    expect(resolveMinioObjectKey('https://other-host.example.com/x.flac?token=abc')).toBe('x.flac');
  });
});
