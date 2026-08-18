package app.ritma.android.testing

import app.ritma.android.data.catalog.CatalogApi
import app.ritma.android.data.catalog.Genre
import app.ritma.android.data.catalog.PaginatedResponse
import app.ritma.android.data.catalog.PublicAlbum
import app.ritma.android.data.catalog.PublicArtist
import app.ritma.android.data.catalog.PublicTrack

fun <T> emptyPage(): PaginatedResponse<T> = PaginatedResponse(items = emptyList(), page = 1, pageSize = 20, total = 0)

/** Shared fake for `CatalogRepository`/catalog `ViewModel` tests — also records the query args each call received. */
class FakeCatalogApi : CatalogApi {
    var artistsResponse: PaginatedResponse<PublicArtist> = emptyPage()
    var albumsResponse: PaginatedResponse<PublicAlbum> = emptyPage()
    var tracksResponse: PaginatedResponse<PublicTrack> = emptyPage()
    var singleArtist: PublicArtist? = null
    var singleAlbum: PublicAlbum? = null
    var singleTrack: PublicTrack? = null

    var throwOnListArtists: Throwable? = null
    var throwOnListAlbums: Throwable? = null
    var throwOnListTracks: Throwable? = null
    var throwOnGetArtist: Throwable? = null
    var throwOnGetAlbum: Throwable? = null
    var throwOnGetTrack: Throwable? = null

    var lastListArtistsArgs: ListArtistsArgs? = null
        private set

    var lastListAlbumsArgs: ListAlbumsArgs? = null
        private set

    var lastListTracksArgs: ListTracksArgs? = null
        private set

    override suspend fun listArtists(page: Int?, pageSize: Int?, q: String?): PaginatedResponse<PublicArtist> {
        lastListArtistsArgs = ListArtistsArgs(page, pageSize, q)
        throwOnListArtists?.let { throw it }
        return artistsResponse
    }

    override suspend fun getArtist(id: String): PublicArtist {
        throwOnGetArtist?.let { throw it }
        return singleArtist ?: error("singleArtist not configured")
    }

    override suspend fun listAlbums(page: Int?, pageSize: Int?, q: String?, artistId: String?): PaginatedResponse<PublicAlbum> {
        lastListAlbumsArgs = ListAlbumsArgs(page, pageSize, q, artistId)
        throwOnListAlbums?.let { throw it }
        return albumsResponse
    }

    override suspend fun getAlbum(id: String): PublicAlbum {
        throwOnGetAlbum?.let { throw it }
        return singleAlbum ?: error("singleAlbum not configured")
    }

    override suspend fun listTracks(
        page: Int?,
        pageSize: Int?,
        q: String?,
        artistId: String?,
        albumId: String?,
        genre: Genre?,
    ): PaginatedResponse<PublicTrack> {
        lastListTracksArgs = ListTracksArgs(page, pageSize, q, artistId, albumId, genre)
        throwOnListTracks?.let { throw it }
        return tracksResponse
    }

    override suspend fun getTrack(id: String): PublicTrack {
        throwOnGetTrack?.let { throw it }
        return singleTrack ?: error("singleTrack not configured")
    }

    data class ListArtistsArgs(val page: Int?, val pageSize: Int?, val q: String?)

    data class ListAlbumsArgs(val page: Int?, val pageSize: Int?, val q: String?, val artistId: String?)

    data class ListTracksArgs(
        val page: Int?,
        val pageSize: Int?,
        val q: String?,
        val artistId: String?,
        val albumId: String?,
        val genre: Genre?,
    )
}
