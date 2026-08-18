package app.ritma.android.feature.catalog.track

import androidx.lifecycle.SavedStateHandle
import app.ritma.android.data.catalog.CatalogRepository
import app.ritma.android.data.catalog.Genre
import app.ritma.android.data.catalog.PublicTrack
import app.ritma.android.data.catalog.TrackType
import app.ritma.android.navigation.RitmaDestination
import app.ritma.android.testing.FakeCatalogApi
import app.ritma.android.testing.MainDispatcherRule
import java.io.IOException
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test

private const val TRACK_ID = "track-1"

private fun buildViewModel(api: FakeCatalogApi) =
    TrackDetailViewModel(SavedStateHandle(mapOf(RitmaDestination.TrackDetail.ARG_TRACK_ID to TRACK_ID)), CatalogRepository(api))

class TrackDetailViewModelTest {

    @get:Rule val mainDispatcherRule = MainDispatcherRule()

    @Test
    fun `a successful load exposes the track`() {
        val track =
            PublicTrack(
                id = TRACK_ID,
                artistId = "artist-1",
                title = "Track One",
                genre = Genre.POP,
                durationSeconds = 200,
                type = TrackType.FREE,
                coverImageUrl = "https://x/t.jpg",
            )
        val api = FakeCatalogApi().apply { singleTrack = track }

        val state = buildViewModel(api).uiState.value

        check(state is TrackDetailUiState.Loaded)
        assertEquals(track, state.track)
    }

    @Test
    fun `a failure surfaces as an Error state with the exception message`() {
        val api = FakeCatalogApi().apply { throwOnGetTrack = IOException("not found") }

        val state = buildViewModel(api).uiState.value

        check(state is TrackDetailUiState.Error)
        assertEquals("not found", state.message)
    }
}
