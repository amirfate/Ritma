package app.ritma.android.data.playback

import app.ritma.android.BuildConfig
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.json.Json
import okhttp3.ResponseBody
import retrofit2.Response

/**
 * Outcome of `POST /playback/sessions` — mirrors the audited API's
 * per-status-code response shapes, the same pattern as `AuthRepository`'s
 * `SendCodeOutcome`/`VerifyOutcome`. `accessType` on [Success] comes
 * straight from the server body; nothing here computes or overrides it.
 */
sealed interface CreateSessionOutcome {
    data class Success(val sessionId: String, val accessType: PlaybackAccessType) : CreateSessionOutcome

    data class DeviceNotAuthorized(val message: String) : CreateSessionOutcome

    data class TrackUnavailable(val message: String) : CreateSessionOutcome

    data class ConcurrentSessionExists(val message: String) : CreateSessionOutcome

    data class Failed(val message: String) : CreateSessionOutcome
}

/**
 * Owns playback session lifecycle — creating a session before playback
 * starts, ending it on player teardown, and building the stream URL a
 * [PlaybackDataSourceFactory]-backed player reads from. The stream itself
 * is never fetched through this class: Media3 issues the (possibly
 * ranged) GET directly against [streamUrl] through the shared
 * `OkHttpClient`, so the same [app.ritma.android.data.auth.AuthInterceptor]
 * / [app.ritma.android.data.auth.TokenAuthenticator] pair that handles
 * every other authenticated call also covers the stream request and any
 * 401 refresh-retry on it.
 */
@Singleton
class PlaybackRepository @Inject constructor(private val playbackApi: PlaybackApi, private val json: Json) {

    suspend fun createSession(trackId: String): CreateSessionOutcome {
        return try {
            val response = playbackApi.createSession(CreateSessionRequest(trackId))
            when (response.code()) {
                201 -> {
                    val body = decode<PlaybackSessionResponse>(response)
                    CreateSessionOutcome.Success(body.id, body.accessType)
                }
                403 -> CreateSessionOutcome.DeviceNotAuthorized(decode<PlaybackErrorBody>(response).message)
                404 -> CreateSessionOutcome.TrackUnavailable(decode<PlaybackErrorBody>(response).message)
                409 -> CreateSessionOutcome.ConcurrentSessionExists(decode<PlaybackErrorBody>(response).message)
                else -> CreateSessionOutcome.Failed(errorMessage(response))
            }
        } catch (e: Exception) {
            CreateSessionOutcome.Failed(e.message ?: "Network error")
        }
    }

    /** Best-effort — a failed end-session call must never block player teardown. */
    suspend fun endSession(sessionId: String) {
        try {
            playbackApi.endSession(sessionId)
        } catch (e: Exception) {
            // Best-effort: the server also has its own idle/expiry cleanup for sessions.
        }
    }

    /**
     * The URL Media3's [PlaybackDataSourceFactory] reads from. No token is
     * appended here — [app.ritma.android.data.auth.AuthInterceptor]
     * attaches the `Authorization` header to this request the same way it
     * does for every other call on the shared `OkHttpClient`.
     */
    fun streamUrl(sessionId: String): String = "${BuildConfig.API_BASE_URL}playback/sessions/$sessionId/stream"

    private inline fun <reified T> decode(response: Response<ResponseBody>): T {
        val text = (if (response.isSuccessful) response.body() else response.errorBody())?.string()
        return json.decodeFromString(text ?: "")
    }

    private fun errorMessage(response: Response<ResponseBody>): String =
        runCatching { decode<PlaybackErrorBody>(response).message }
            .getOrDefault("Unexpected error (${response.code()})")
}
