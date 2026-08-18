/**
 * Reads the `exp` claim out of a JWT without verifying its signature.
 * Only used for cookie `maxAge` bookkeeping and proactive-refresh timing —
 * actual token validity is always re-checked by the Ritma API itself
 * (`TokenService.verifyAccessToken`/`rotateTokens`), never trusted here.
 */
export function decodeJwtExpirySeconds(token: string): number | null {
  const segments = token.split('.');
  const payloadSegment = segments[1];
  if (segments.length !== 3 || payloadSegment === undefined) {
    return null;
  }

  try {
    const base64 = payloadSegment.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const payload: unknown = JSON.parse(atob(padded));
    if (
      typeof payload === 'object' &&
      payload !== null &&
      'exp' in payload &&
      typeof payload.exp === 'number'
    ) {
      return payload.exp;
    }
    return null;
  } catch {
    return null;
  }
}

const EXPIRY_SKEW_SECONDS = 30;

/** True when the token is unreadable, already expired, or expiring within the skew window. */
export function isExpiredOrExpiringSoon(token: string): boolean {
  const exp = decodeJwtExpirySeconds(token);
  if (exp === null) {
    return true;
  }
  return exp - Math.floor(Date.now() / 1000) <= EXPIRY_SKEW_SECONDS;
}
