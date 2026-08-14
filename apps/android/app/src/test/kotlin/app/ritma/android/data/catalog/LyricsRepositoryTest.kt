package app.ritma.android.data.catalog

import app.ritma.android.testing.FakeLyricsApi
import app.ritma.android.testing.jsonResponse
import app.ritma.android.testing.testJson
import java.io.IOException
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Test

class LyricsRepositoryTest {

    @Test
    fun `a 200 response maps to Available with the decoded lyrics`() = runTest {
        val lyrics = PublicLyrics(trackId = "track-1", content = "La la la", syncedContent = "[00:01.00]La la la")
        val api = FakeLyricsApi().apply { getLyricsResponse = jsonResponse(200, lyrics) }
        val repository = LyricsRepository(api, testJson)

        val result = repository.getLyrics("track-1")

        check(result is LyricsResult.Available)
        assertEquals(lyrics, result.lyrics)
    }

    @Test
    fun `a 404 response maps to Unavailable, not Failed`() = runTest {
        val api = FakeLyricsApi().apply { getLyricsResponse = jsonResponse(404, "not found") }
        val repository = LyricsRepository(api, testJson)

        val result = repository.getLyrics("track-1")

        assertEquals(LyricsResult.Unavailable, result)
    }

    @Test
    fun `an unexpected status code maps to Failed`() = runTest {
        val api = FakeLyricsApi().apply { getLyricsResponse = jsonResponse(500, "boom") }
        val repository = LyricsRepository(api, testJson)

        val result = repository.getLyrics("track-1")

        check(result is LyricsResult.Failed)
        assertEquals("Unexpected error (500)", result.message)
    }

    @Test
    fun `a thrown exception maps to Failed with its message`() = runTest {
        val api = FakeLyricsApi().apply { getLyricsError = IOException("no connection") }
        val repository = LyricsRepository(api, testJson)

        val result = repository.getLyrics("track-1")

        check(result is LyricsResult.Failed)
        assertEquals("no connection", result.message)
    }

    @Test
    fun `getLyrics forwards the track id unchanged`() = runTest {
        val api = FakeLyricsApi()
        val repository = LyricsRepository(api, testJson)

        repository.getLyrics("track-42")

        assertEquals("track-42", api.lastGetLyricsId)
    }
}
