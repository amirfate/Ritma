package app.ritma.android.feature.catalog.lyrics

import androidx.lifecycle.SavedStateHandle
import app.ritma.android.data.catalog.LyricsRepository
import app.ritma.android.data.catalog.PublicLyrics
import app.ritma.android.data.lyrics.SyncedLyricLine
import app.ritma.android.data.playback.PlaybackPositionHolder
import app.ritma.android.navigation.RitmaDestination
import app.ritma.android.testing.FakeLyricsApi
import app.ritma.android.testing.MainDispatcherRule
import app.ritma.android.testing.jsonResponse
import app.ritma.android.testing.testJson
import java.io.IOException
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

private const val TRACK_ID = "track-1"

private fun buildViewModel(api: FakeLyricsApi, positionHolder: PlaybackPositionHolder = PlaybackPositionHolder()) =
    LyricsViewModel(
        SavedStateHandle(mapOf(RitmaDestination.LyricsDetail.ARG_TRACK_ID to TRACK_ID)),
        LyricsRepository(api, testJson),
        positionHolder,
    )

class LyricsViewModelTest {

    @get:Rule val mainDispatcherRule = MainDispatcherRule()

    @Test
    fun `a successful load exposes the static lyrics content`() {
        val lyrics = PublicLyrics(trackId = TRACK_ID, content = "La la la", syncedContent = "[00:01.00]La la la")
        val api = FakeLyricsApi().apply { getLyricsResponse = jsonResponse(200, lyrics) }

        val state = buildViewModel(api).uiState.value

        check(state is LyricsUiState.Loaded)
        assertEquals(lyrics, state.lyrics)
    }

    @Test
    fun `reads the trackId from the nav arg and forwards it to the repository`() {
        val api = FakeLyricsApi()

        buildViewModel(api)

        assertEquals(TRACK_ID, api.lastGetLyricsId)
    }

    @Test
    fun `a 404 surfaces as Unavailable, not Error`() {
        val api = FakeLyricsApi().apply { getLyricsResponse = jsonResponse(404, "not found") }

        val state = buildViewModel(api).uiState.value

        check(state is LyricsUiState.Unavailable)
    }

    @Test
    fun `a transport failure surfaces as an Error state with the exception message`() {
        val api = FakeLyricsApi().apply { getLyricsError = IOException("no connection") }

        val state = buildViewModel(api).uiState.value

        check(state is LyricsUiState.Error)
        assertEquals("no connection", state.message)
    }

    @Test
    fun `valid synced lyrics are parsed into the loaded state`() {
        val lyrics =
            PublicLyrics(
                trackId = TRACK_ID,
                content = "first\nsecond",
                syncedContent = "[00:01.00]first\n[00:02.00]second",
            )
        val api = FakeLyricsApi().apply { getLyricsResponse = jsonResponse(200, lyrics) }

        val state = buildViewModel(api).uiState.value

        check(state is LyricsUiState.Loaded)
        assertEquals(
            listOf(SyncedLyricLine(1_000L, "first"), SyncedLyricLine(2_000L, "second")),
            state.syncedLyrics.lines,
        )
    }

    @Test
    fun `null syncedContent preserves static lyrics — no synced lines, no active line`() {
        val lyrics = PublicLyrics(trackId = TRACK_ID, content = "Plain static text", syncedContent = null)
        val api = FakeLyricsApi().apply { getLyricsResponse = jsonResponse(200, lyrics) }

        val viewModel = buildViewModel(api)
        val state = viewModel.uiState.value

        check(state is LyricsUiState.Loaded)
        assertTrue(state.syncedLyrics.lines.isEmpty())
        assertEquals("Plain static text", state.lyrics.content)
        assertNull(viewModel.activeLine.value)
    }

    @Test
    fun `malformed syncedContent does not crash — falls back to static, no active line`() {
        val lyrics =
            PublicLyrics(trackId = TRACK_ID, content = "Plain static text", syncedContent = "not a timestamp at all")
        val api = FakeLyricsApi().apply { getLyricsResponse = jsonResponse(200, lyrics) }

        val viewModel = buildViewModel(api)
        val state = viewModel.uiState.value

        check(state is LyricsUiState.Loaded)
        assertTrue(state.syncedLyrics.lines.isEmpty())
        assertNull(viewModel.activeLine.value)
    }

    @Test
    fun `synced lyrics respond to the position already published before the screen opened`() {
        val lyrics =
            PublicLyrics(
                trackId = TRACK_ID,
                content = "first\nsecond",
                syncedContent = "[00:01.00]first\n[00:02.00]second",
            )
        val api = FakeLyricsApi().apply { getLyricsResponse = jsonResponse(200, lyrics) }
        val positionHolder = PlaybackPositionHolder().apply { publish(1_500L) }

        val viewModel = buildViewModel(api, positionHolder)

        assertEquals(SyncedLyricLine(1_000L, "first"), viewModel.activeLine.value)
    }

    @Test
    fun `a forward seek updates the active line`() {
        val lyrics =
            PublicLyrics(
                trackId = TRACK_ID,
                content = "first\nsecond",
                syncedContent = "[00:01.00]first\n[00:02.00]second",
            )
        val api = FakeLyricsApi().apply { getLyricsResponse = jsonResponse(200, lyrics) }
        val positionHolder = PlaybackPositionHolder()
        val viewModel = buildViewModel(api, positionHolder)
        assertNull(viewModel.activeLine.value)

        positionHolder.publish(2_500L)

        assertEquals(SyncedLyricLine(2_000L, "second"), viewModel.activeLine.value)
    }

    @Test
    fun `a backward seek updates the active line`() {
        val lyrics =
            PublicLyrics(
                trackId = TRACK_ID,
                content = "first\nsecond",
                syncedContent = "[00:01.00]first\n[00:02.00]second",
            )
        val api = FakeLyricsApi().apply { getLyricsResponse = jsonResponse(200, lyrics) }
        val positionHolder = PlaybackPositionHolder().apply { publish(2_500L) }
        val viewModel = buildViewModel(api, positionHolder)
        assertEquals(SyncedLyricLine(2_000L, "second"), viewModel.activeLine.value)

        positionHolder.publish(1_200L)

        assertEquals(SyncedLyricLine(1_000L, "first"), viewModel.activeLine.value)
    }

    @Test
    fun `pause does not advance the active line — no publish, no change`() {
        val lyrics =
            PublicLyrics(
                trackId = TRACK_ID,
                content = "first\nsecond",
                syncedContent = "[00:01.00]first\n[00:02.00]second",
            )
        val api = FakeLyricsApi().apply { getLyricsResponse = jsonResponse(200, lyrics) }
        val positionHolder = PlaybackPositionHolder().apply { publish(1_500L) }
        val viewModel = buildViewModel(api, positionHolder)
        val activeLineWhilePaused = viewModel.activeLine.value

        // Simulates PlayerViewModel.stopPositionObserver(): simply nothing
        // publishes anymore. No separate "pause" signal exists or is needed.
        assertEquals(activeLineWhilePaused, viewModel.activeLine.value)
        assertEquals(SyncedLyricLine(1_000L, "first"), viewModel.activeLine.value)
    }
}
