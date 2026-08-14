package app.ritma.android.feature.catalog.lyrics

import androidx.lifecycle.SavedStateHandle
import app.ritma.android.data.catalog.LyricsRepository
import app.ritma.android.data.catalog.PublicLyrics
import app.ritma.android.navigation.RitmaDestination
import app.ritma.android.testing.FakeLyricsApi
import app.ritma.android.testing.MainDispatcherRule
import app.ritma.android.testing.jsonResponse
import app.ritma.android.testing.testJson
import java.io.IOException
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test

private const val TRACK_ID = "track-1"

private fun buildViewModel(api: FakeLyricsApi) =
    LyricsViewModel(
        SavedStateHandle(mapOf(RitmaDestination.LyricsDetail.ARG_TRACK_ID to TRACK_ID)),
        LyricsRepository(api, testJson),
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
}
