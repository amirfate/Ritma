package app.ritma.android.data.playback

import kotlinx.coroutines.delay

/**
 * Polls [positionMsProvider] every [intervalMs] and forwards each non-null
 * result to [onTick], stopping the moment [positionMsProvider] returns
 * `null` (the underlying player is gone) or the calling coroutine is
 * cancelled — cancellation is handled entirely by `delay`'s normal
 * suspend-point behavior, no explicit `isActive` check needed. Deliberately
 * takes a plain position-supplier lambda rather than any ExoPlayer/Media3
 * type, so it can be unit tested without constructing a real player —
 * [app.ritma.android.feature.player.PlayerViewModel] is the only caller
 * and supplies `{ player?.currentPosition }` as [positionMsProvider].
 */
suspend fun observePosition(intervalMs: Long, positionMsProvider: () -> Long?, onTick: (Long) -> Unit) {
    while (true) {
        val positionMs = positionMsProvider() ?: return
        onTick(positionMs)
        delay(intervalMs)
    }
}
