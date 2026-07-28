/**
 * Pure HTTP Range parsing and clamping. `contentLimit` is the number of
 * bytes actually servable for this request — the full object size for a
 * full-access session, or the exact preview boundary byte for a PREVIEW
 * session (§3/§12 of the M5 spec: the clamp is derived solely from the
 * server-computed limit, never from anything the client sends).
 */
export type RangeResult =
  | { status: 200; start: number; end: number }
  | { status: 206; start: number; end: number }
  | { status: 416 };

const RANGE_PATTERN = /^bytes=(\d*)-(\d*)$/;

export function computeEffectiveRange(
  rangeHeader: string | undefined,
  contentLimit: number,
): RangeResult {
  if (contentLimit <= 0) {
    return { status: 416 };
  }

  if (!rangeHeader) {
    return { status: 200, start: 0, end: contentLimit - 1 };
  }

  const match = RANGE_PATTERN.exec(rangeHeader.trim());
  if (!match) {
    return { status: 416 };
  }

  const [, startText, endText] = match;
  if (!startText && !endText) {
    return { status: 416 };
  }

  let start: number;
  let end: number;

  if (!startText) {
    // "bytes=-N" — the last N bytes of the servable content.
    const suffixLength = Number(endText);
    if (suffixLength <= 0) {
      return { status: 416 };
    }
    start = Math.max(0, contentLimit - suffixLength);
    end = contentLimit - 1;
  } else {
    start = Number(startText);
    end = endText ? Number(endText) : contentLimit - 1;
  }

  if (
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 0 ||
    start >= contentLimit ||
    end < start
  ) {
    return { status: 416 };
  }

  end = Math.min(end, contentLimit - 1);
  return { status: 206, start, end };
}
