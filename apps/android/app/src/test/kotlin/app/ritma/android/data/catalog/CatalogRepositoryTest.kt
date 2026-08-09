package app.ritma.android.data.catalog

import app.ritma.android.testing.FakeCatalogApi
import java.io.IOException
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * `safeCall`'s success/empty/failure mapping is identical across all six
 * `CatalogRepository` methods, so it's exercised once per shape (success,
 * empty, failure) rather than once per method. What genuinely differs
 * per-method — which query parameters get forwarded to `CatalogApi` — is
 * checked for every list method below, since that's real, method-specific
 * behavior a shared mapping test wouldn't catch.
 */
class CatalogRepositoryTest {

    @Test
    fun `a successful call maps to Success with the response data`() = runTest {
        val artist = PublicArtist(id = "artist-1", name = "Artist One")
        val api = FakeCatalogApi().apply { artistsResponse = PaginatedResponse(listOf(artist), page = 1, pageSize = 20, total = 1) }
        val repository = CatalogRepository(api)

        val result = repository.listArtists()

        check(result is CatalogResult.Success)
        assertEquals(listOf(artist), result.data.items)
    }

    @Test
    fun `an empty result is Success with an empty list, not a separate state`() = runTest {
        val repository = CatalogRepository(FakeCatalogApi())

        val result = repository.listTracks()

        check(result is CatalogResult.Success)
        assertTrue(result.data.items.isEmpty())
    }

    @Test
    fun `a thrown exception maps to Failed with its message`() = runTest {
        val api = FakeCatalogApi().apply { throwOnGetTrack = IOException("no connection") }
        val repository = CatalogRepository(api)

        val result = repository.getTrack("track-1")

        check(result is CatalogResult.Failed)
        assertEquals("no connection", result.message)
    }

    @Test
    fun `listArtists forwards page, pageSize and q unchanged`() = runTest {
        val api = FakeCatalogApi()
        val repository = CatalogRepository(api)

        repository.listArtists(page = 2, pageSize = 10, q = "sina")

        assertEquals(FakeCatalogApi.ListArtistsArgs(page = 2, pageSize = 10, q = "sina"), api.lastListArtistsArgs)
    }

    @Test
    fun `listAlbums forwards the artistId filter`() = runTest {
        val api = FakeCatalogApi()
        val repository = CatalogRepository(api)

        repository.listAlbums(artistId = "artist-42")

        assertEquals(
            FakeCatalogApi.ListAlbumsArgs(page = null, pageSize = null, q = null, artistId = "artist-42"),
            api.lastListAlbumsArgs,
        )
    }

    @Test
    fun `listTracks forwards artistId, albumId and genre filters`() = runTest {
        val api = FakeCatalogApi()
        val repository = CatalogRepository(api)

        repository.listTracks(artistId = "artist-42", albumId = "album-7", genre = Genre.ROCK)

        assertEquals(
            FakeCatalogApi.ListTracksArgs(
                page = null,
                pageSize = null,
                q = null,
                artistId = "artist-42",
                albumId = "album-7",
                genre = Genre.ROCK,
            ),
            api.lastListTracksArgs,
        )
    }
}
