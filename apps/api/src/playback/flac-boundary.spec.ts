import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { findFlacBoundary, InvalidFlacStreamError, parseFlacMetadata } from './flac-boundary';

const FIXTURES_DIR = join(__dirname, '../../test/fixtures');

// Real FLAC files (encoded by the reference `flac` CLI), used so this test
// suite validates against genuine libFLAC output, not just self-consistency
// with this module's own encoder. The expected byte offsets and sample
// counts below were independently cross-checked outside this test suite by
// truncating each fixture at the computed offset and decoding the result
// with the reference `flac` decoder, confirming the exact predicted sample
// count comes out the other end.
const SHORT_5S = readFileSync(join(FIXTURES_DIR, 'short-5s.flac')); // 44100 Hz, 220500 samples, 4096-sample fixed blocks
const TINY_1S = readFileSync(join(FIXTURES_DIR, 'tiny-1s.flac')); // 44100 Hz, 44100 samples, no SEEKTABLE

describe('parseFlacMetadata', () => {
  it('parses STREAMINFO and locates the first frame for a real FLAC file', () => {
    const { streamInfo, audioStart } = parseFlacMetadata(SHORT_5S);
    expect(streamInfo).toEqual({
      sampleRate: 44100,
      minBlockSize: 4096,
      maxBlockSize: 4096,
      totalSamples: 220500n,
    });
    expect(audioStart).toBe(8304);
  });

  it('parses a fixture with no SEEKTABLE block just as well', () => {
    const { streamInfo, audioStart } = parseFlacMetadata(TINY_1S);
    expect(streamInfo.totalSamples).toBe(44100n);
    expect(audioStart).toBe(8282);
  });

  it('rejects a buffer with no "fLaC" marker', () => {
    expect(() => parseFlacMetadata(Buffer.from('not a flac file at all'))).toThrow(
      InvalidFlacStreamError,
    );
  });

  it('rejects a truncated metadata header', () => {
    expect(() => parseFlacMetadata(Buffer.from('fLaC'))).toThrow(InvalidFlacStreamError);
  });
});

describe('findFlacBoundary', () => {
  it('finds the exact frame boundary at or before a 2-second target, verified against a real decode', () => {
    const result = findFlacBoundary(SHORT_5S, 2, true);
    expect(result).toEqual({ kind: 'boundary', byteOffset: 33632, sampleCount: 86016n });
    // 86016 / 44100 ≈ 1.95s — strictly less than the 2s target, as required:
    // the clamp never serves a single sample at or past the target.
    expect(Number(result.kind === 'boundary' ? result.sampleCount : 0n) / 44100).toBeLessThan(2);
  });

  it('never returns a sample count that reaches or exceeds the target', () => {
    for (const targetSeconds of [1, 2, 3, 4]) {
      const result = findFlacBoundary(SHORT_5S, targetSeconds, true);
      expect(result.kind).toBe('boundary');
      if (result.kind === 'boundary') {
        expect(result.sampleCount).toBeLessThan(BigInt(targetSeconds * 44100));
      }
    }
  });

  it('treats a track shorter than the target as needing no clamp at all', () => {
    const result = findFlacBoundary(TINY_1S, 30, true);
    expect(result).toEqual({ kind: 'whole-stream-within-target', sampleCount: 44100n });
  });

  it('treats a track exactly at the target duration as needing no clamp', () => {
    const result = findFlacBoundary(SHORT_5S, 5, true);
    expect(result).toEqual({ kind: 'whole-stream-within-target', sampleCount: 220500n });
  });

  it('reports insufficient data when the prefix ends before the target is resolved', () => {
    const { audioStart } = parseFlacMetadata(SHORT_5S);
    const shortPrefix = SHORT_5S.subarray(0, audioStart + 50);
    const result = findFlacBoundary(shortPrefix, 2, false);
    expect(result).toEqual({ kind: 'insufficient-data' });
  });

  it('does not mistake a truncated prefix for a whole-track short-circuit unless told so', () => {
    const shortPrefix = SHORT_5S.subarray(0, SHORT_5S.length - 1000);
    const result = findFlacBoundary(shortPrefix, 1, false);
    expect(result.kind).toBe('boundary');
  });

  it('recovers a corrupted leading frame header and still lands on the correct later boundary', () => {
    const { audioStart } = parseFlacMetadata(SHORT_5S);
    const corrupted = Buffer.from(SHORT_5S);
    // Flip the CRC-8 byte of the very first frame header so it fails
    // validation; the scanner must skip past the now-unrecognizable frame
    // 0 rather than throw or silently accept a corrupt frame as genuine.
    // Frame 0's absence from the recognized chain does not shift any later
    // frame's real byte position, so the answer must be identical to the
    // uncorrupted 2-second case.
    corrupted.writeUInt8(corrupted.readUInt8(audioStart + 5) ^ 0xff, audioStart + 5);

    const result = findFlacBoundary(corrupted, 2, true);
    expect(result).toEqual({ kind: 'boundary', byteOffset: 33632, sampleCount: 86016n });
  });
});
