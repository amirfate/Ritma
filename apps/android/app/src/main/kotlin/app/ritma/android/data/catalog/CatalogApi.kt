package app.ritma.android.data.catalog

import retrofit2.http.GET
import retrofit2.http.Path
import retrofit2.http.Query

/**
 * Mirrors the public catalog routes audited against the locked M5 API —
 * all unauthenticated, all read-only. A page/pageSize query param that is
 * `null` is simply omitted from the request, letting the server's own
 * defaults (`page=1`, `pageSize=20`) apply, matching `PageQuery` being
 * fully optional in the audited contract.
 */
interface CatalogApi {
    @GET("artists")
    suspend fun listArtists(
        @Query("page") page: Int? = null,
        @Query("pageSize") pageSize: Int? = null,
        @Query("q") q: String? = null,
    ): PaginatedResponse<PublicArtist>

    @GET("artists/{id}") suspend fun getArtist(@Path("id") id: String): PublicArtist

    @GET("albums")
    suspend fun listAlbums(
        @Query("page") page: Int? = null,
        @Query("pageSize") pageSize: Int? = null,
        @Query("q") q: String? = null,
        @Query("artistId") artistId: String? = null,
    ): PaginatedResponse<PublicAlbum>

    @GET("albums/{id}") suspend fun getAlbum(@Path("id") id: String): PublicAlbum

    @GET("tracks")
    suspend fun listTracks(
        @Query("page") page: Int? = null,
        @Query("pageSize") pageSize: Int? = null,
        @Query("q") q: String? = null,
        @Query("artistId") artistId: String? = null,
        @Query("albumId") albumId: String? = null,
        @Query("genre") genre: Genre? = null,
    ): PaginatedResponse<PublicTrack>

    @GET("tracks/{id}") suspend fun getTrack(@Path("id") id: String): PublicTrack
}
