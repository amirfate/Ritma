package app.ritma.android.data.playback

import okhttp3.ResponseBody
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.POST
import retrofit2.http.Path

/**
 * Session lifecycle only. The actual stream (`GET
 * /playback/sessions/:id/stream`) is deliberately not modeled here — it is
 * binary audio consumed directly by Media3's [OkHttpDataSource], not a
 * Retrofit JSON call; see [PlaybackDataSourceFactory] and
 * [PlaybackRepository.streamUrl].
 */
interface PlaybackApi {
    /**
     * Raw [Response]/[ResponseBody] because the success/error shape varies
     * by status code (201 body vs. 403/404/409 error body), the same
     * pattern used for `AuthApi.sendCode`/`verify`.
     */
    @POST("playback/sessions")
    suspend fun createSession(@Body request: CreateSessionRequest): Response<ResponseBody>

    @POST("playback/sessions/{id}/end") suspend fun endSession(@Path("id") id: String)
}
