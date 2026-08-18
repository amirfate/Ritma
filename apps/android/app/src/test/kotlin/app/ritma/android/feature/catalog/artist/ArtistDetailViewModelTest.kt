package app.ritma.android.feature.catalog.artist

import androidx.lifecycle.SavedStateHandle
import app.ritma.android.data.catalog.CatalogRepository
import app.ritma.android.data.catalog.PaginatedResponse
import app.ritma.android.data.catalog.PublicAlbum
import app.ritma.android.data.catalog.PublicArtist
import app.ritma.android.feature.catalog.CatalogListUiState
import app.ritma.android.navigation.RitmaDestination
import app.ritma.android.testing.FakeCatalogApi
import app.ritma.android.testing.MainDispatcherRule
import java.io.IOException
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

private const val ARTIST_ID = "artist-1"

private fun buildViewModel(api: FakeCatalogApi) =
    ArtistDetailViewModel(SavedStateHandle(mapOf(RitmaDestination.ArtistDetail.ARG_ARTIST_ID to ARTIST_ID)), CatalogRepository(api))

class ArtistDetailViewModelTest {

    @get:Rule val mainDispatcherRule = MainDispatcherRule()

    @Test
    fun `loads the artist, then its albums via a separate call keyed by the artist's id`() {
        val artist = PublicArtist(id = ARTIST_ID, name = "Artist One")
        val album = PublicAlbum(id = "album-1", artistId = ARTIST_ID, title = "Album One", coverImageUrl = "https://x/a.jpg")
        val api =
            FakeCatalogApi().apply {
                singleArtist = artist
                albumsResponse = PaginatedResponse(listOf(album), page = 1, pageSize = 20, total = 1)
            }

        val viewModel = buildViewModel(api)

        val state = viewModel.uiState.value
        check(state is ArtistDetailUiState.Loaded)
        assertEquals(artist, state.artist)
        assertEquals(CatalogListUiState.Loaded(listOf(album)), state.albums)
        assertEquals(ARTIST_ID, api.lastListAlbumsArgs?.artistId)
    }

    @Test
    fun `a failure loading the artist itself surfaces as an Error state`() {
        val api = FakeCatalogApi().apply { throwOnGetArtist = IOException("not found") }

        val state = buildViewModel(api).uiState.value

        check(state is ArtistDetailUiState.Error)
        assertEquals("not found", state.message)
    }

    @Test
    fun `a failure loading albums keeps the loaded artist but marks albums as Error`() {
        val artist = PublicArtist(id = ARTIST_ID, name = "Artist One")
        val api =
            FakeCatalogApi().apply {
                singleArtist = artist
                throwOnListAlbums = IOException("albums unavailable")
            }

        val state = buildViewModel(api).uiState.value

        check(state is ArtistDetailUiState.Loaded)
        assertEquals(artist, state.artist)
        assertTrue(state.albums is CatalogListUiState.Error)
        assertEquals("albums unavailable", (state.albums as CatalogListUiState.Error).message)
    }
}
