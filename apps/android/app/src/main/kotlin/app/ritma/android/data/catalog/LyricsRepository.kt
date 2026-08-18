package app.ritma.android.data.catalog

import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.json.Json
import okhttp3.ResponseBody
import retrofit2.Response

/**
 * Outcome of `GET /tracks/:id/lyrics`. Unlike [CatalogResult] (used for
 * Artist/Album/Track, where a 404 has no special meaning beyond "not in
 * the public catalog"), lyrics availability is a first-class UI state per
 * the M8 Phase 2 UX requirement: [Unavailable] must render as an ordinary,
 * expected empty state, not be lumped in with [Failed] (a genuine network
 * or unexpected-server problem).
 */
sealed interface LyricsResult {
    data class Available(val lyrics: PublicLyrics) : LyricsResult

    data object Unavailable : LyricsResult

    data class Failed(val message: String) : LyricsResult
}

/** Thin wrapper over [LyricsApi], the same role [CatalogRepository] plays for [CatalogApi]. */
@Singleton
class LyricsRepository @Inject constructor(private val lyricsApi: LyricsApi, private val json: Json) {

    suspend fun getLyrics(trackId: String): LyricsResult =
        try {
            val response = lyricsApi.getLyrics(trackId)
            when {
                response.isSuccessful -> LyricsResult.Available(decode<PublicLyrics>(response))
                response.code() == 404 -> LyricsResult.Unavailable
                else -> LyricsResult.Failed("Unexpected error (${response.code()})")
            }
        } catch (e: Exception) {
            LyricsResult.Failed(e.message ?: "Network error")
        }

    private inline fun <reified T> decode(response: Response<ResponseBody>): T {
        val text = response.body()?.string() ?: error("Empty response body")
        return json.decodeFromString(text)
    }
}
