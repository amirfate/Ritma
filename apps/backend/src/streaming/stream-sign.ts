import { createHmac, timingSafeEqual } from 'node:crypto';

export const STREAM_TTL_SECONDS = 300;

function streamSecret(): string {
  return process.env.STREAM_SECRET ?? 'dev-stream-secret';
}

export function signStreamToken(trackId: string, exp: number): string {
  return createHmac('sha256', streamSecret()).update(`${trackId}:${exp}`).digest('hex');
}

export function validateStreamSignature(
  trackId: string,
  exp: number,
  sig: string,
): boolean {
  if (!Number.isFinite(exp) || exp * 1000 < Date.now()) return false;
  const expected = Buffer.from(signStreamToken(trackId, exp), 'hex');
  const provided = Buffer.from(sig, 'hex');
  return expected.length === provided.length && timingSafeEqual(expected, provided);
}
