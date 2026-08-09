package app.ritma.android.testing

import app.ritma.android.data.playback.CreateSessionRequest
import app.ritma.android.data.playback.PlaybackAccessType
import app.ritma.android.data.playback.PlaybackApi
import app.ritma.android.data.playback.PlaybackSessionResponse
import okhttp3.ResponseBody
import retrofit2.Response

/** Shared fake for `PlaybackRepository` tests. */
class FakePlaybackApi : PlaybackApi {
    var createSessionResponse: Response<ResponseBody> =
        jsonResponse(201, PlaybackSessionResponse(id = "session-1", accessType = PlaybackAccessType.FULL_FREE))

    /** Set to simulate a transport-level failure (timeout, no connection, ...) rather than an HTTP error response. */
    var createSessionError: Throwable? = null
    var endSessionError: Throwable? = null

    var lastCreateSessionRequest: CreateSessionRequest? = null
        private set

    var endSessionCallCount = 0
        private set

    var lastEndSessionId: String? = null
        private set

    override suspend fun createSession(request: CreateSessionRequest): Response<ResponseBody> {
        lastCreateSessionRequest = request
        createSessionError?.let { throw it }
        return createSessionResponse
    }

    override suspend fun endSession(id: String) {
        endSessionCallCount++
        lastEndSessionId = id
        endSessionError?.let { throw it }
    }
}
