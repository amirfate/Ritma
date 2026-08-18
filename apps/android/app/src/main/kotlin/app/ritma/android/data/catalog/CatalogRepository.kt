package app.ritma.android.data.catalog

import javax.inject.Inject
import javax.inject.Singleton

/**
 * Outcome of a single catalog call. There is no `Loading` variant — that
 * is a caller/UI-level state (the coroutine is suspended awaiting this
 * function, not a value this layer needs to model) — and no separate
 * `Empty` variant either: an empty list result is simply
 * `Success(PaginatedResponse(items = emptyList(), total = 0, ...))`.
 * Deciding when to render an empty-state screen from that is a Phase 6
 * (UI) concern, not something the repository invents a new state for.
 */
sealed interface CatalogResult<out T> {
    data class Success<T>(val data: T) : CatalogResult<T>

    data class Failed(val message: String) : CatalogResult<Nothing>
}

/**
 * Thin wrapper over [CatalogApi] translating exceptions into
 * [CatalogResult.Failed] — every call here is unauthenticated per the
 * audited API, but goes through the same shared, token-attaching
 * `OkHttpClient` as everything else (Phase 3) regardless; an unused
 * `Authorization` header on an unguarded route is harmless.
 */
@Singleton
class CatalogRepository @Inject constructor(private val catalogApi: CatalogApi) {

    suspend fun listArtists(
        page: Int? = null,
        pageSize: Int? = null,
        q: String? = null,
    ): CatalogResult<PaginatedResponse<PublicArtist>> = safeCall {
        catalogApi.listArtists(page, pageSize, q)
    }

    suspend fun getArtist(id: String): CatalogResult<PublicArtist> = safeCall { catalogApi.getArtist(id) }

    suspend fun listAlbums(
        page: Int? = null,
        pageSize: Int? = null,
        q: String? = null,
        artistId: String? = null,
    ): CatalogResult<PaginatedResponse<PublicAlbum>> = safeCall {
        catalogApi.listAlbums(page, pageSize, q, artistId)
    }

    suspend fun getAlbum(id: String): CatalogResult<PublicAlbum> = safeCall { catalogApi.getAlbum(id) }

    suspend fun listTracks(
        page: Int? = null,
        pageSize: Int? = null,
        q: String? = null,
        artistId: String? = null,
        albumId: String? = null,
        genre: Genre? = null,
    ): CatalogResult<PaginatedResponse<PublicTrack>> = safeCall {
        catalogApi.listTracks(page, pageSize, q, artistId, albumId, genre)
    }

    suspend fun getTrack(id: String): CatalogResult<PublicTrack> = safeCall { catalogApi.getTrack(id) }

    private suspend fun <T> safeCall(block: suspend () -> T): CatalogResult<T> =
        try {
            CatalogResult.Success(block())
        } catch (e: Exception) {
            CatalogResult.Failed(e.message ?: "Network error")
        }
}
