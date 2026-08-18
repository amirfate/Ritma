/**
 * Pure, framework-independent FLAC frame-header parsing. Locates the exact
 * byte offset of the frame boundary at or immediately before a target
 * duration, without decoding any audio (no dependency on ffmpeg/libFLAC at
 * runtime) — used to enforce the Milestone 5 30-second preview clamp.
 *
 * FLAC frames are independently decodable and byte-aligned, so truncating a
 * valid FLAC stream at an exact frame boundary yields a complete, correctly
 * playable prefix. Each frame header directly encodes either its frame
 * number (fixed block-size streams) or the sample number of its first
 * sample (variable block-size streams), validated by an 8-bit CRC over the
 * header bytes — the same non-seektable-dependent technique the reference
 * FLAC decoder uses to seek without decoding audio.
 */

export class InvalidFlacStreamError extends Error {}

export interface FlacStreamInfo {
  sampleRate: number;
  minBlockSize: number;
  maxBlockSize: number;
  totalSamples: bigint;
}

export interface FlacMetadata {
  streamInfo: FlacStreamInfo;
  /** Byte offset of the first frame, i.e. the end of the metadata blocks. */
  audioStart: number;
}

const CRC8_POLYNOMIAL = 0x07;

/** Bounds-checked byte read — every caller has already validated `i < buf.length`. */
function byteAt(buf: Buffer, i: number): number {
  const value = buf[i];
  if (value === undefined) {
    throw new InvalidFlacStreamError(`Unexpected end of buffer at offset ${i}`);
  }
  return value;
}

function crc8(bytes: Buffer, start: number, end: number): number {
  let crc = 0;
  for (let i = start; i < end; i++) {
    crc ^= byteAt(bytes, i);
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc & 0x80) !== 0 ? ((crc << 1) ^ CRC8_POLYNOMIAL) & 0xff : (crc << 1) & 0xff;
    }
  }
  return crc;
}

/** Parses the "fLaC" marker and metadata blocks, extracting STREAMINFO. */
export function parseFlacMetadata(buf: Buffer): FlacMetadata {
  if (buf.length < 4 || buf.toString('ascii', 0, 4) !== 'fLaC') {
    throw new InvalidFlacStreamError('Missing FLAC stream marker');
  }

  let offset = 4;
  let streamInfo: FlacStreamInfo | undefined;

  for (;;) {
    if (offset + 4 > buf.length) {
      throw new InvalidFlacStreamError('Truncated metadata block header');
    }
    const headerByte = byteAt(buf, offset);
    const isLast = (headerByte & 0x80) !== 0;
    const type = headerByte & 0x7f;
    const length =
      (byteAt(buf, offset + 1) << 16) | (byteAt(buf, offset + 2) << 8) | byteAt(buf, offset + 3);
    const bodyStart = offset + 4;
    const bodyEnd = bodyStart + length;
    if (bodyEnd > buf.length) {
      throw new InvalidFlacStreamError('Truncated metadata block body');
    }

    if (type === 0) {
      if (length !== 34) {
        throw new InvalidFlacStreamError('Malformed STREAMINFO block');
      }
      const body = buf.subarray(bodyStart, bodyEnd);
      const sampleRate =
        (byteAt(body, 10) << 12) | (byteAt(body, 11) << 4) | (byteAt(body, 12) >> 4);
      const totalSamples =
        (BigInt(byteAt(body, 13) & 0x0f) << 32n) |
        (BigInt(byteAt(body, 14)) << 24n) |
        (BigInt(byteAt(body, 15)) << 16n) |
        (BigInt(byteAt(body, 16)) << 8n) |
        BigInt(byteAt(body, 17));
      streamInfo = {
        sampleRate,
        minBlockSize: body.readUInt16BE(0),
        maxBlockSize: body.readUInt16BE(2),
        totalSamples,
      };
    }

    offset = bodyEnd;
    if (isLast) break;
  }

  if (!streamInfo) {
    throw new InvalidFlacStreamError('Stream has no STREAMINFO block');
  }

  return { streamInfo, audioStart: offset };
}

interface DecodedNumber {
  value: bigint;
  byteLength: number;
}

/**
 * Decodes FLAC's UTF-8-like extended variable-length integer (up to 36
 * bits / 7 bytes, one level wider than standard UTF-8's 31-bit/6-byte
 * ceiling) used for the frame header's frame/sample number field.
 */
function decodeCodedNumber(buf: Buffer, offset: number): DecodedNumber | undefined {
  if (offset >= buf.length) return undefined;
  const first = byteAt(buf, offset);
  let extraBytes: number;
  let value: bigint;

  if ((first & 0x80) === 0x00) {
    extraBytes = 0;
    value = BigInt(first & 0x7f);
  } else if ((first & 0xe0) === 0xc0) {
    extraBytes = 1;
    value = BigInt(first & 0x1f);
  } else if ((first & 0xf0) === 0xe0) {
    extraBytes = 2;
    value = BigInt(first & 0x0f);
  } else if ((first & 0xf8) === 0xf0) {
    extraBytes = 3;
    value = BigInt(first & 0x07);
  } else if ((first & 0xfc) === 0xf8) {
    extraBytes = 4;
    value = BigInt(first & 0x03);
  } else if ((first & 0xfe) === 0xfc) {
    extraBytes = 5;
    value = BigInt(first & 0x01);
  } else if (first === 0xfe) {
    extraBytes = 6;
    value = 0n;
  } else {
    return undefined;
  }

  if (offset + 1 + extraBytes > buf.length) return undefined;
  for (let i = 0; i < extraBytes; i++) {
    const continuation = byteAt(buf, offset + 1 + i);
    if ((continuation & 0xc0) !== 0x80) return undefined;
    value = (value << 6n) | BigInt(continuation & 0x3f);
  }

  return { value, byteLength: 1 + extraBytes };
}

interface ParsedFrameHeader {
  /** Total header length in bytes, from the sync code through the CRC-8 byte inclusive. */
  headerLength: number;
  /** Sample number of this frame's first sample. */
  firstSample: bigint;
}

/**
 * Attempts to parse a complete, CRC-8-validated frame header at `offset`.
 * Returns undefined if the sync pattern doesn't match, a reserved field is
 * set, the buffer runs out, or the trailing CRC-8 doesn't match — any of
 * which means `offset` is not a genuine frame boundary (most commonly, a
 * byte sequence inside frame audio data that happens to resemble a sync
 * code).
 */
function tryParseFrameHeader(
  buf: Buffer,
  offset: number,
  streamInfo: FlacStreamInfo,
): ParsedFrameHeader | undefined {
  if (offset + 4 > buf.length) return undefined;
  if (byteAt(buf, offset) !== 0xff) return undefined;
  const syncByte1 = byteAt(buf, offset + 1);
  if ((syncByte1 & 0xfe) !== 0xf8) return undefined;

  const blockingStrategy = syncByte1 & 0x01;
  const byte2 = byteAt(buf, offset + 2);
  const blockSizeBits = (byte2 >> 4) & 0x0f;
  const sampleRateBits = byte2 & 0x0f;
  const byte3 = byteAt(buf, offset + 3);
  const channelBits = (byte3 >> 4) & 0x0f;
  const sampleSizeBits = (byte3 >> 1) & 0x07;
  const reservedBit = byte3 & 0x01;

  if (reservedBit !== 0) return undefined;
  if (blockSizeBits === 0x00) return undefined;
  if (sampleRateBits === 0x0f) return undefined;
  if (channelBits >= 0x0b) return undefined;
  if (sampleSizeBits === 0x03 || sampleSizeBits === 0x07) return undefined;

  const coded = decodeCodedNumber(buf, offset + 4);
  if (!coded) return undefined;
  let pos = offset + 4 + coded.byteLength;

  if (blockSizeBits === 0x06) {
    if (pos >= buf.length) return undefined;
    pos += 1;
  } else if (blockSizeBits === 0x07) {
    if (pos + 2 > buf.length) return undefined;
    pos += 2;
  }

  if (sampleRateBits === 0x0c) {
    if (pos >= buf.length) return undefined;
    pos += 1;
  } else if (sampleRateBits === 0x0d || sampleRateBits === 0x0e) {
    if (pos + 2 > buf.length) return undefined;
    pos += 2;
  }

  if (pos >= buf.length) return undefined;
  const expectedCrc = byteAt(buf, pos);
  if (crc8(buf, offset, pos) !== expectedCrc) return undefined;
  const headerLength = pos + 1 - offset;

  const firstSample =
    blockingStrategy === 0 ? coded.value * BigInt(streamInfo.maxBlockSize) : coded.value;

  return { headerLength, firstSample };
}

export type FlacBoundaryOutcome =
  | { kind: 'boundary'; byteOffset: number; sampleCount: bigint }
  | { kind: 'whole-stream-within-target'; sampleCount: bigint }
  | { kind: 'insufficient-data' };

/**
 * Given a buffer holding the start of a FLAC file (`prefix`), finds the
 * exact byte offset such that `prefix.subarray(0, byteOffset)` contains
 * only complete frames whose samples all fall strictly before
 * `targetSeconds` — i.e. the returned range never contains a single sample
 * at or past the target, only ever less.
 *
 * `prefixCoversWholeFile` must be true when `prefix` is the file's entire
 * content (not just a leading chunk); this lets a track shorter than
 * `targetSeconds` be recognized as needing no clamp at all, rather than
 * being mistaken for a truncated fetch.
 */
export function findFlacBoundary(
  prefix: Buffer,
  targetSeconds: number,
  prefixCoversWholeFile: boolean,
): FlacBoundaryOutcome {
  const { streamInfo, audioStart } = parseFlacMetadata(prefix);
  const targetSample = BigInt(Math.floor(targetSeconds * streamInfo.sampleRate));

  if (streamInfo.totalSamples > 0n && streamInfo.totalSamples <= targetSample) {
    return { kind: 'whole-stream-within-target', sampleCount: streamInfo.totalSamples };
  }

  let offset = audioStart;
  let lastBoundaryOffset = audioStart;
  let lastBoundarySampleCount = 0n;

  while (offset < prefix.length) {
    const parsed = tryParseFrameHeader(prefix, offset, streamInfo);
    if (!parsed) {
      offset += 1;
      continue;
    }
    if (parsed.firstSample >= targetSample) {
      return {
        kind: 'boundary',
        byteOffset: lastBoundaryOffset,
        sampleCount: lastBoundarySampleCount,
      };
    }
    lastBoundaryOffset = offset;
    lastBoundarySampleCount = parsed.firstSample;
    offset += 1;
  }

  if (prefixCoversWholeFile) {
    return { kind: 'whole-stream-within-target', sampleCount: streamInfo.totalSamples };
  }
  return { kind: 'insufficient-data' };
}
