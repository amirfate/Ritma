package app.ritma.android.testing

import app.ritma.android.data.catalog.LyricsApi
import app.ritma.android.data.catalog.PublicLyrics
import okhttp3.ResponseBody
import retrofit2.Response

/** Shared fake for `LyricsRepository`/`LyricsViewModel` tests. */
class FakeLyricsApi : LyricsApi {
    var getLyricsResponse: Response<ResponseBody> =
        jsonResponse(200, PublicLyrics(trackId = "track-1", content = "La la la"))

    /** Set to simulate a transport-level failure (timeout, no connection, ...) rather than an HTTP error response. */
    var getLyricsError: Throwable? = null

    var lastGetLyricsId: String? = null
        private set

    override suspend fun getLyrics(id: String): Response<ResponseBody> {
        lastGetLyricsId = id
        getLyricsError?.let { throw it }
        return getLyricsResponse
    }
}
