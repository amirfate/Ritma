package app.ritma.android.feature.catalog.album

import androidx.lifecycle.SavedStateHandle
import app.ritma.android.data.catalog.CatalogRepository
import app.ritma.android.data.catalog.Genre
import app.ritma.android.data.catalog.PaginatedResponse
import app.ritma.android.data.catalog.PublicAlbum
import app.ritma.android.data.catalog.PublicArtist
import app.ritma.android.data.catalog.PublicTrack
import app.ritma.android.data.catalog.TrackType
import app.ritma.android.feature.catalog.CatalogListUiState
import app.ritma.android.navigation.RitmaDestination
import app.ritma.android.testing.FakeCatalogApi
import app.ritma.android.testing.MainDispatcherRule
import java.io.IOException
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Rule
import org.junit.Test

private const val ALBUM_ID = "album-1"
private const val ARTIST_ID = "artist-1"

private fun buildViewModel(api: FakeCatalogApi) =
    AlbumDetailViewModel(SavedStateHandle(mapOf(RitmaDestination.AlbumDetail.ARG_ALBUM_ID to ALBUM_ID)), CatalogRepository(api))

class AlbumDetailViewModelTest {

    @get:Rule val mainDispatcherRule = MainDispatcherRule()

    @Test
    fun `loads the album, resolves the artist name via a separate call, and loads its tracks`() {
        val album = PublicAlbum(id = ALBUM_ID, artistId = ARTIST_ID, title = "Album One", coverImageUrl = "https://x/a.jpg")
        val artist = PublicArtist(id = ARTIST_ID, name = "Artist One")
        val track =
            PublicTrack(
                id = "track-1",
                artistId = ARTIST_ID,
                albumId = ALBUM_ID,
                title = "Track One",
                genre = Genre.POP,
                durationSeconds = 200,
                type = TrackType.FREE,
                coverImageUrl = "https://x/t.jpg",
            )
        val api =
            FakeCatalogApi().apply {
                singleAlbum = album
                singleArtist = artist
                tracksResponse = PaginatedResponse(listOf(track), page = 1, pageSize = 20, total = 1)
            }

        val state = buildViewModel(api).uiState.value

        check(state is AlbumDetailUiState.Loaded)
        assertEquals(album, state.album)
        assertEquals("Artist One", state.artistName)
        assertEquals(CatalogListUiState.Loaded(listOf(track)), state.tracks)
        assertEquals(ALBUM_ID, api.lastListTracksArgs?.albumId)
    }

    @Test
    fun `a failure resolving the artist name is non-fatal and leaves it null`() {
        val album = PublicAlbum(id = ALBUM_ID, artistId = ARTIST_ID, title = "Album One", coverImageUrl = "https://x/a.jpg")
        val api =
            FakeCatalogApi().apply {
                singleAlbum = album
                throwOnGetArtist = IOException("artist unavailable")
            }

        val state = buildViewModel(api).uiState.value

        check(state is AlbumDetailUiState.Loaded)
        assertEquals(album, state.album)
        assertNull(state.artistName)
    }

    @Test
    fun `a failure loading the album itself surfaces as an Error state`() {
        val api = FakeCatalogApi().apply { throwOnGetAlbum = IOException("not found") }

        val state = buildViewModel(api).uiState.value

        check(state is AlbumDetailUiState.Error)
        assertEquals("not found", state.message)
    }
}
