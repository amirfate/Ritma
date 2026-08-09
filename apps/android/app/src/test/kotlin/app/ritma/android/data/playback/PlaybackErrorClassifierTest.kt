package app.ritma.android.data.playback

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Exercises only [classifyByResponseCode], the pure part of the
 * classifier. Deliberately does not attempt to construct a real
 * `HttpDataSource.InvalidResponseCodeException` — its constructor needs a
 * `DataSpec` and other Media3-internal types this module cannot build with
 * confidence without a compiler available (see the Phase 5 report); the
 * cause-chain-walking half of the classifier is manually reviewed only.
 */
class PlaybackErrorClassifierTest {

    @Test
    fun `416 classifies as preview ended`() {
        val result = classifyByResponseCode(416, RuntimeException("range not satisfiable"))
        assertEquals(PlaybackStreamError.PreviewEnded, result)
    }

    @Test
    fun `404 classifies as session expired`() {
        val result = classifyByResponseCode(404, RuntimeException("not found"))
        assertEquals(PlaybackStreamError.SessionExpired, result)
    }

    @Test
    fun `401 classifies as authentication required`() {
        val result = classifyByResponseCode(401, RuntimeException("unauthorized"))
        assertEquals(PlaybackStreamError.AuthenticationRequired, result)
    }

    @Test
    fun `unrecognized response code classifies as unknown, preserving the cause`() {
        val cause = RuntimeException("server error")
        val result = classifyByResponseCode(500, cause)
        assertTrue(result is PlaybackStreamError.Unknown)
        assertEquals(cause, (result as PlaybackStreamError.Unknown).cause)
    }

    @Test
    fun `a null response code classifies as unknown`() {
        val cause = RuntimeException("no http response involved")
        val result = classifyByResponseCode(null, cause)
        assertTrue(result is PlaybackStreamError.Unknown)
        assertEquals(cause, (result as PlaybackStreamError.Unknown).cause)
    }
}
