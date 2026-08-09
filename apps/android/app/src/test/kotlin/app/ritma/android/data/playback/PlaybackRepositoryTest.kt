package app.ritma.android.data.playback

import app.ritma.android.testing.FakePlaybackApi
import app.ritma.android.testing.jsonResponse
import app.ritma.android.testing.testJson
import java.io.IOException
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * `PlaybackErrorClassifier`'s 416/404/401 stream-error mapping is already
 * covered by `PlaybackErrorClassifierTest` (Phase 5) — not duplicated here.
 * This covers `PlaybackRepository.createSession`'s per-status-code mapping
 * and `endSession`'s best-effort (non-throwing) contract instead.
 */
class PlaybackRepositoryTest {

    @Test
    fun `a 201 response maps to Success with the session id and server-decided accessType`() = runTest {
        val api =
            FakePlaybackApi().apply {
                createSessionResponse = jsonResponse(201, PlaybackSessionResponse(id = "session-1", accessType = PlaybackAccessType.PREVIEW))
            }
        val repository = PlaybackRepository(api, testJson)

        val outcome = repository.createSession("track-1")

        check(outcome is CreateSessionOutcome.Success)
        assertEquals("session-1", outcome.sessionId)
        assertEquals(PlaybackAccessType.PREVIEW, outcome.accessType)
    }

    @Test
    fun `a 403 response maps to DeviceNotAuthorized`() = runTest {
        val api = FakePlaybackApi().apply { createSessionResponse = jsonResponse(403, PlaybackErrorBody("Device not authorized.")) }
        val repository = PlaybackRepository(api, testJson)

        val outcome = repository.createSession("track-1")

        check(outcome is CreateSessionOutcome.DeviceNotAuthorized)
        assertEquals("Device not authorized.", outcome.message)
    }

    @Test
    fun `a 404 response maps to TrackUnavailable`() = runTest {
        val api = FakePlaybackApi().apply { createSessionResponse = jsonResponse(404, PlaybackErrorBody("Track not found.")) }
        val repository = PlaybackRepository(api, testJson)

        val outcome = repository.createSession("track-1")

        check(outcome is CreateSessionOutcome.TrackUnavailable)
        assertEquals("Track not found.", outcome.message)
    }

    @Test
    fun `a 409 response maps to ConcurrentSessionExists`() = runTest {
        val api =
            FakePlaybackApi().apply { createSessionResponse = jsonResponse(409, PlaybackErrorBody("A session is already active.")) }
        val repository = PlaybackRepository(api, testJson)

        val outcome = repository.createSession("track-1")

        check(outcome is CreateSessionOutcome.ConcurrentSessionExists)
        assertEquals("A session is already active.", outcome.message)
    }

    @Test
    fun `a transport-level failure maps to Failed instead of throwing`() = runTest {
        val api = FakePlaybackApi().apply { createSessionError = IOException("no connection") }
        val repository = PlaybackRepository(api, testJson)

        val outcome = repository.createSession("track-1")

        check(outcome is CreateSessionOutcome.Failed)
        assertEquals("no connection", outcome.message)
    }

    @Test
    fun `an unrecognized status code maps to Failed with a fallback message`() = runTest {
        val api = FakePlaybackApi().apply { createSessionResponse = jsonResponse(500, PlaybackErrorBody("Internal error")) }
        val repository = PlaybackRepository(api, testJson)

        val outcome = repository.createSession("track-1")

        check(outcome is CreateSessionOutcome.Failed)
        assertEquals("Internal error", outcome.message)
    }

    @Test
    fun `endSession never throws even when the server call fails`() = runTest {
        val api = FakePlaybackApi().apply { endSessionError = IOException("no connection") }
        val repository = PlaybackRepository(api, testJson)

        repository.endSession("session-1")

        assertEquals(1, api.endSessionCallCount)
        assertEquals("session-1", api.lastEndSessionId)
    }

    @Test
    fun `streamUrl points at the session's stream endpoint`() = runTest {
        val repository = PlaybackRepository(FakePlaybackApi(), testJson)

        val url = repository.streamUrl("session-1")

        assertTrue(url.endsWith("playback/sessions/session-1/stream"))
    }
}
