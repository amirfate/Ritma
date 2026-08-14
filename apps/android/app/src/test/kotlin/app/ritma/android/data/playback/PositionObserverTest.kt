package app.ritma.android.data.playback

import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

private const val INTERVAL_MS = 250L

/**
 * Exercises `observePosition` in isolation from ExoPlayer/Media3 — the
 * whole point of extracting it as a plain position-supplier lambda (see
 * its doc comment).
 *
 * `PlayerViewModel` itself cannot be constructed in this repo's plain-JVM
 * test setup at all — not just for the ExoPlayer-specific parts. Its
 * constructor requires a non-null `@ApplicationContext Context`
 * (`android.content.Context` is an abstract class with ~150 abstract
 * members on the Android unit-test stub jar, which throws on any real
 * method call), and this module declares no Robolectric and no mocking
 * library (Mockito/MockK) anywhere — confirmed by inspecting
 * `app/build.gradle.kts`'s `testImplementation` block, which lists only
 * `junit` and `kotlinx-coroutines-test`. Hand-writing a `Context` subclass
 * that overrides every abstract member just to satisfy the constructor
 * would itself be exactly the kind of new, heavy test infrastructure this
 * phase was told not to introduce. So `PlayerViewModel.startPositionObserver`/
 * `stopPositionObserver`'s cancel-before-relaunch wiring against the real
 * `positionJob` field is **not exercised by any test** — that is a real,
 * currently-unclosed gap, not something the test below papers over.
 *
 * What `re-activating the observer cancels the previous run before
 * starting a new one` below actually does: it reproduces
 * `PlayerViewModel`'s exact `positionJob: Job?` field and the exact
 * two-line bodies of `startPositionObserver`/`stopPositionObserver`
 * (`job?.cancel()` then reassign) as a local function inside the test
 * itself, and proves *that specific pattern* prevents duplicate emissions.
 * This is deliberately kept textually parallel to the production
 * implementation so the two are easy to diff by eye — but it is still a
 * copy, not a call into `PlayerViewModel`. If `startPositionObserver`/
 * `stopPositionObserver` are ever changed, this test's local mirror must
 * be updated to match, or it will silently stop proving anything about
 * the real code.
 */
class PositionObserverTest {

    @Test
    fun `emits at the approved cadence`() = runTest {
        val tickTimestamps = mutableListOf<Long>()
        val job = launch { observePosition(INTERVAL_MS, positionMsProvider = { 1_000L }) { tickTimestamps.add(currentTime) } }

        advanceTimeBy(INTERVAL_MS * 4)
        runCurrent()
        job.cancel()

        assertTrue("expected multiple ticks, got ${tickTimestamps.size}", tickTimestamps.size >= 3)
        val gapsBetweenTicks = tickTimestamps.zipWithNext { earlier, later -> later - earlier }
        gapsBetweenTicks.forEach { gap -> assertEquals(INTERVAL_MS, gap) }
    }

    @Test
    fun `propagates the exact position values from the provider, in order`() = runTest {
        val values = mutableListOf(10L, 20L, 30L)
        val ticks = mutableListOf<Long>()
        val job = launch {
            observePosition(INTERVAL_MS, positionMsProvider = { values.removeFirstOrNull() }) { ticks.add(it) }
        }

        advanceUntilIdle()
        job.cancel()

        assertEquals(listOf(10L, 20L, 30L), ticks)
    }

    @Test
    fun `stops on its own once the position source is unavailable, without external cancellation`() = runTest {
        val ticks = mutableListOf<Long>()
        val job = launch { observePosition(INTERVAL_MS, positionMsProvider = { if (ticks.size < 2) 5L else null }) { ticks.add(it) } }

        advanceUntilIdle()

        assertTrue(job.isCompleted)
        assertEquals(2, ticks.size)
    }

    @Test
    fun `re-activating the observer cancels the previous run before starting a new one`() = runTest {
        // A textual mirror of PlayerViewModel's own `positionJob` field and
        // the exact bodies of `startPositionObserver`/`stopPositionObserver`
        // — see the class doc comment for why the real PlayerViewModel
        // can't be constructed and exercised directly in this test.
        var positionJob: Job? = null
        fun start(positionMsProvider: () -> Long?, onTick: (Long) -> Unit) {
            positionJob?.cancel()
            positionJob = launch { observePosition(INTERVAL_MS, positionMsProvider, onTick) }
        }

        val ticksA = mutableListOf<Long>()
        val ticksB = mutableListOf<Long>()

        // Mirrors a first onIsPlayingChanged(true).
        start({ 1L }) { ticksA.add(it) }
        advanceTimeBy(INTERVAL_MS)
        runCurrent()
        val ticksACountBeforeReactivation = ticksA.size
        assertTrue("expected at least one tick before reactivation", ticksACountBeforeReactivation > 0)

        // Mirrors onIsPlayingChanged(true) firing again while the previous
        // poll is still running (e.g. a buffering stall resuming) — the
        // exact case `positionJob?.cancel()` exists to guard against.
        start({ 2L }) { ticksB.add(it) }
        repeat(3) {
            advanceTimeBy(INTERVAL_MS)
            runCurrent()
        }
        positionJob?.cancel()

        // If the cancel-before-reassign guard were missing, ticksA would
        // keep growing here too — it must not.
        assertEquals(ticksACountBeforeReactivation, ticksA.size)
        assertTrue(ticksB.isNotEmpty())
    }
}
