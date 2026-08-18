package app.ritma.android.data.lyrics

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ParseSyncedLyricsTest {

    @Test
    fun `valid single line`() {
        val result = parseSyncedLyrics("[00:12.34]first line")

        assertEquals(listOf(SyncedLyricLine(12_340L, "first line")), result.lines)
    }

    @Test
    fun `valid multiple lines`() {
        val result =
            parseSyncedLyrics(
                """
                [00:12.34]first line
                [00:17.80]second line
                [00:24.15]third line
                """.trimIndent(),
            )

        assertEquals(
            listOf(
                SyncedLyricLine(12_340L, "first line"),
                SyncedLyricLine(17_800L, "second line"),
                SyncedLyricLine(24_150L, "third line"),
            ),
            result.lines,
        )
    }

    @Test
    fun `00 00 00 is a valid timestamp`() {
        val result = parseSyncedLyrics("[00:00.00]start")

        assertEquals(listOf(SyncedLyricLine(0L, "start")), result.lines)
    }

    @Test
    fun `minute greater than or equal to 60 is valid for long tracks`() {
        val result = parseSyncedLyrics("[75:03.20]late line")

        assertEquals(listOf(SyncedLyricLine(75L * 60_000L + 3_200L, "late line")), result.lines)
    }

    @Test
    fun `malformed timestamp is ignored`() {
        val result = parseSyncedLyrics("00:12.34]missing opening bracket")

        assertTrue(result.lines.isEmpty())
    }

    @Test
    fun `invalid seconds is ignored`() {
        val result = parseSyncedLyrics("[00:60.00]seconds out of range")

        assertTrue(result.lines.isEmpty())
    }

    @Test
    fun `invalid hundredths is ignored`() {
        val threeDigits = parseSyncedLyrics("[00:12.345]too many digits")
        val oneDigit = parseSyncedLyrics("[00:12.3]too few digits")

        assertTrue(threeDigits.lines.isEmpty())
        assertTrue(oneDigit.lines.isEmpty())
    }

    @Test
    fun `missing closing bracket is ignored`() {
        val result = parseSyncedLyrics("[00:12.34text")

        assertTrue(result.lines.isEmpty())
    }

    @Test
    fun `metadata line is ignored`() {
        val result = parseSyncedLyrics("[ar:Some Artist]")

        assertTrue(result.lines.isEmpty())
    }

    @Test
    fun `multiple timestamps on one line is ignored`() {
        val result = parseSyncedLyrics("[00:01.00][00:02.00]word-level style")

        assertTrue(result.lines.isEmpty())
    }

    @Test
    fun `a malformed line mixed with valid lines only drops the malformed one`() {
        val result =
            parseSyncedLyrics(
                """
                [00:01.00]valid one
                [ar:Some Artist]
                [00:02.00]valid two
                """.trimIndent(),
            )

        assertEquals(
            listOf(SyncedLyricLine(1_000L, "valid one"), SyncedLyricLine(2_000L, "valid two")),
            result.lines,
        )
    }

    @Test
    fun `an out-of-order line is dropped, later valid lines are kept`() {
        val result =
            parseSyncedLyrics(
                """
                [00:10.00]first
                [00:05.00]out of order, dropped
                [00:15.00]third
                """.trimIndent(),
            )

        assertEquals(
            listOf(SyncedLyricLine(10_000L, "first"), SyncedLyricLine(15_000L, "third")),
            result.lines,
        )
    }

    @Test
    fun `duplicate timestamps are both kept`() {
        val result =
            parseSyncedLyrics(
                """
                [00:10.00]first at 10s
                [00:10.00]also at 10s
                """.trimIndent(),
            )

        assertEquals(
            listOf(SyncedLyricLine(10_000L, "first at 10s"), SyncedLyricLine(10_000L, "also at 10s")),
            result.lines,
        )
    }

    @Test
    fun `null input yields no lines`() {
        assertTrue(parseSyncedLyrics(null).lines.isEmpty())
    }

    @Test
    fun `empty input yields no lines`() {
        assertTrue(parseSyncedLyrics("").lines.isEmpty())
    }

    @Test
    fun `input with no valid lines yields no lines`() {
        val result =
            parseSyncedLyrics(
                """
                [ar:Some Artist]
                not a timestamped line at all
                """.trimIndent(),
            )

        assertTrue(result.lines.isEmpty())
    }
}

class ActiveLineAtTest {

    private val lyrics =
        SyncedLyrics(
            listOf(
                SyncedLyricLine(10_000L, "first"),
                SyncedLyricLine(20_000L, "second"),
                SyncedLyricLine(30_000L, "third"),
            ),
        )

    @Test
    fun `position before the first line has no active line`() {
        assertNull(lyrics.activeLineAt(5_000L))
    }

    @Test
    fun `position exactly at the first line activates it`() {
        assertEquals(SyncedLyricLine(10_000L, "first"), lyrics.activeLineAt(10_000L))
    }

    @Test
    fun `position between lines activates the previous line`() {
        assertEquals(SyncedLyricLine(10_000L, "first"), lyrics.activeLineAt(15_000L))
    }

    @Test
    fun `position exactly at a later boundary activates that line`() {
        assertEquals(SyncedLyricLine(20_000L, "second"), lyrics.activeLineAt(20_000L))
    }

    @Test
    fun `position after the last line activates the last line`() {
        assertEquals(SyncedLyricLine(30_000L, "third"), lyrics.activeLineAt(999_000L))
    }

    @Test
    fun `a forward seek recomputes correctly with no stored cursor`() {
        assertEquals(SyncedLyricLine(10_000L, "first"), lyrics.activeLineAt(12_000L))

        assertEquals(SyncedLyricLine(30_000L, "third"), lyrics.activeLineAt(35_000L))
    }

    @Test
    fun `a backward seek recomputes correctly with no stored cursor`() {
        assertEquals(SyncedLyricLine(30_000L, "third"), lyrics.activeLineAt(35_000L))

        assertEquals(SyncedLyricLine(10_000L, "first"), lyrics.activeLineAt(12_000L))
    }

    @Test
    fun `duplicate timestamps resolve to the later line in file order once reached`() {
        val withDuplicates =
            SyncedLyrics(
                listOf(
                    SyncedLyricLine(10_000L, "first at 10s"),
                    SyncedLyricLine(10_000L, "second at 10s"),
                ),
            )

        assertEquals(SyncedLyricLine(10_000L, "second at 10s"), withDuplicates.activeLineAt(10_000L))
    }
}
