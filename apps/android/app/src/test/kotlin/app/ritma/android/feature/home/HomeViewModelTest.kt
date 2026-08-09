package app.ritma.android.feature.home

import app.ritma.android.data.catalog.CatalogRepository
import app.ritma.android.data.catalog.Genre
import app.ritma.android.data.catalog.PaginatedResponse
import app.ritma.android.data.catalog.PublicAlbum
import app.ritma.android.data.catalog.PublicArtist
import app.ritma.android.data.catalog.PublicTrack
import app.ritma.android.data.catalog.TrackType
import app.ritma.android.feature.catalog.CatalogListUiState
import app.ritma.android.testing.FakeCatalogApi
import app.ritma.android.testing.MainDispatcherRule
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test

class HomeViewModelTest {

    @get:Rule val mainDispatcherRule = MainDispatcherRule()

    @Test
    fun `initial load populates all three tabs from the catalog repository`() {
        val artist = PublicArtist(id = "artist-1", name = "Artist One")
        val album =
            PublicAlbum(id = "album-1", artistId = "artist-1", title = "Album One", coverImageUrl = "https://x/a.jpg")
        val track =
            PublicTrack(
                id = "track-1",
                artistId = "artist-1",
                albumId = "album-1",
                title = "Track One",
                genre = Genre.POP,
                durationSeconds = 180,
                type = TrackType.FREE,
                coverImageUrl = "https://x/t.jpg",
            )
        val api =
            FakeCatalogApi().apply {
                artistsResponse = PaginatedResponse(items = listOf(artist), page = 1, pageSize = 20, total = 1)
                albumsResponse = PaginatedResponse(items = listOf(album), page = 1, pageSize = 20, total = 1)
                tracksResponse = PaginatedResponse(items = listOf(track), page = 1, pageSize = 20, total = 1)
            }
        val viewModel = HomeViewModel(CatalogRepository(api))

        val state = viewModel.uiState.value

        assertEquals(CatalogListUiState.Loaded(listOf(artist)), state.artists)
        assertEquals(CatalogListUiState.Loaded(listOf(album)), state.albums)
        assertEquals(CatalogListUiState.Loaded(listOf(track)), state.tracks)
    }

    @Test
    fun `a failed list call surfaces as an Error state for just that tab`() {
        val api = FakeCatalogApi().apply { throwOnListArtists = IllegalStateException("boom") }
        val viewModel = HomeViewModel(CatalogRepository(api))

        val state = viewModel.uiState.value

        assertEquals(CatalogListUiState.Error("boom"), state.artists)
        assertEquals(CatalogListUiState.Loaded(emptyList<PublicAlbum>()), state.albums)
        assertEquals(CatalogListUiState.Loaded(emptyList<PublicTrack>()), state.tracks)
    }

    @Test
    fun `selecting a tab updates the selected tab in ui state`() {
        val viewModel = HomeViewModel(CatalogRepository(FakeCatalogApi()))

        viewModel.onTabSelected(HomeTab.ARTISTS)

        assertEquals(HomeTab.ARTISTS, viewModel.uiState.value.selectedTab)
    }
}
