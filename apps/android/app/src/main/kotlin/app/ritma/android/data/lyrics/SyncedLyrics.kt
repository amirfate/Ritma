package app.ritma.android.data.lyrics

/** One parsed, validated line of synced lyrics — an LRC-style `[mm:ss.xx]text` entry. */
data class SyncedLyricLine(val positionMs: Long, val text: String)

/**
 * An immutable, ordered (non-decreasing `positionMs`) list of valid synced
 * lines. Parsing guarantees the ordering invariant here, so nothing
 * downstream (e.g. [activeLineAt]) needs to re-sort or re-validate it.
 * An empty [lines] list means "no synced lyrics available" — callers
 * should fall back to static lyrics in that case.
 */
data class SyncedLyrics(val lines: List<SyncedLyricLine>)

private val TIMESTAMP_LINE_REGEX = Regex("""^\[(\d+):([0-5]\d)\.(\d{2})\](.*)$""")
private val EMBEDDED_TIMESTAMP_REGEX = Regex("""\[\d+:[0-5]\d\.\d{2}\]""")

/**
 * Parses Ritma Beta's locked `syncedContent` format: one `[mm:ss.xx]text`
 * line per line — `mm` unbounded, `ss` exactly `00..59`, `.xx` exactly two
 * digits (hundredths). Deliberately strict and line-oriented, not a
 * general LRC parser: metadata tags (`[ar:]`, `[ti:]`, ...) never match
 * this grammar at all (they don't start with digits), and a line
 * containing more than one bracketed timestamp (multiple-timestamps or
 * word-level/enhanced LRC) is rejected outright rather than partially
 * interpreted.
 *
 * Locked ordering behavior (confirmed, deterministic — not just this
 * function's own choice):
 * - Out-of-order line: ignored. A line whose timestamp is *less than* the
 *   last **accepted** line's timestamp is dropped; every other valid line
 *   is still kept. There is no sorting and no reordering anywhere in this
 *   function — lines that survive stay in file order.
 * - Duplicate timestamp: both may remain, in parsed order. "Non-decreasing"
 *   is not "strictly increasing", so an equal timestamp is accepted, not
 *   dropped. [activeLineAt] resolves which one is "active" by simply
 *   preferring the later one in that same file order once reached.
 *
 * `null`/blank input, or input with no line surviving these rules, yields
 * `SyncedLyrics(emptyList())` — "synced lyrics unavailable," per the
 * locked format rules.
 */
fun parseSyncedLyrics(syncedContent: String?): SyncedLyrics {
    if (syncedContent.isNullOrBlank()) return SyncedLyrics(emptyList())

    val lines = mutableListOf<SyncedLyricLine>()
    for (rawLine in syncedContent.lineSequence()) {
        val line = rawLine.trimEnd('\r')
        val match = TIMESTAMP_LINE_REGEX.matchEntire(line) ?: continue
        val (minutesText, secondsText, hundredthsText, text) = match.destructured

        // A second bracketed timestamp anywhere in the remainder means
        // multiple/word-level timestamps on one line — not supported;
        // skip the whole line rather than swallowing it into the text.
        if (EMBEDDED_TIMESTAMP_REGEX.containsMatchIn(text)) continue

        val positionMs = minutesText.toLong() * 60_000L + secondsText.toLong() * 1_000L + hundredthsText.toLong() * 10L
        if (lines.isNotEmpty() && positionMs < lines.last().positionMs) continue

        lines += SyncedLyricLine(positionMs, text)
    }
    return SyncedLyrics(lines)
}

/**
 * Pure, stateless mapping from a playback position to the active synced
 * line. Safe to call on every position tick or after a seek in either
 * direction — it always recomputes from [lines] rather than tracking an
 * incremental cursor that could go stale across a seek.
 *
 * - Before the first line's timestamp: `null` (no active line).
 * - At or after a line's timestamp, before the next one: that line.
 * - At or after the last line's timestamp: the last line.
 * - Duplicate timestamps: the later line in file order wins once reached.
 */
fun SyncedLyrics.activeLineAt(positionMs: Long): SyncedLyricLine? = lines.lastOrNull { it.positionMs <= positionMs }
