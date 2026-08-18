package app.ritma.android.data.playback

import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * The minimal cross-screen bridge between
 * [app.ritma.android.feature.player.PlayerViewModel] (the sole writer) and
 * [app.ritma.android.feature.catalog.lyrics.LyricsViewModel] (a reader),
 * for M9 synced lyrics. Holds nothing but the latest `positionMs`: no
 * ExoPlayer reference, no timer, no lyrics or navigation knowledge, no
 * playback business logic. `PlayerViewModel`'s existing M8 250ms
 * `observePosition` loop remains the only thing that ever computes or
 * observes position — this class only stores and republishes whatever
 * it's told via [publish].
 *
 * `@Singleton`-scoped via Hilt — the same scoping already used elsewhere
 * in this app for shared infrastructure (`PlaybackDataSourceFactory`, the
 * shared `OkHttpClient`, every Retrofit API interface) — so it outlives
 * any single navigation back-stack entry. Player and Lyrics are
 * independently-scoped sibling destinations with no shared nav graph;
 * nothing narrower than app-process scope would let a Lyrics screen
 * opened after Player already started see its position. This is a plain
 * Hilt-managed instance, not a hand-rolled singleton pattern, a service,
 * or a general playback repository — it exposes exactly one piece of
 * state.
 */
@Singleton
class PlaybackPositionHolder @Inject constructor() {

    private val _positionMs = MutableStateFlow(0L)

    /** Replays the latest known position to every new subscriber immediately upon collection. */
    val positionMs: StateFlow<Long> = _positionMs.asStateFlow()

    fun publish(positionMs: Long) {
        _positionMs.value = positionMs
    }
}
