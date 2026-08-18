package app.ritma.android.data.catalog

import okhttp3.ResponseBody
import retrofit2.Response
import retrofit2.http.GET
import retrofit2.http.Path

/**
 * Raw [Response]/[ResponseBody], not a parsed [PublicLyrics] directly,
 * because a 404 here is an ordinary, expected outcome (the track isn't
 * published, or simply has no lyrics yet — the API deliberately does not
 * distinguish the two) that [LyricsRepository] branches on explicitly,
 * rather than treating it as a generic failure. The same raw-Response
 * pattern [app.ritma.android.data.playback.PlaybackApi] already uses for
 * status-code-meaningful calls.
 */
interface LyricsApi {
    @GET("tracks/{id}/lyrics") suspend fun getLyrics(@Path("id") id: String): Response<ResponseBody>
}
