package app.ritma.android.data.playback

import androidx.media3.common.PlaybackException
import androidx.media3.datasource.HttpDataSource

/**
 * Typed classification of a player-surfaced streaming failure, so a caller
 * can distinguish "the PREVIEW boundary was reached" (416, an expected,
 * non-crashing outcome — the server-enforced 30-second cap from the M5
 * audit) from a genuinely broken session (404) or an auth problem the
 * [app.ritma.android.data.auth.TokenAuthenticator] itself could not
 * recover from (401).
 */
sealed interface PlaybackStreamError {
    data object PreviewEnded : PlaybackStreamError

    data object SessionExpired : PlaybackStreamError

    data object AuthenticationRequired : PlaybackStreamError

    data class Unknown(val cause: Throwable) : PlaybackStreamError
}

fun classifyPlaybackError(error: PlaybackException): PlaybackStreamError =
    classifyByResponseCode(findHttpResponseCode(error), error)

/**
 * Pure mapping from an HTTP status code to a [PlaybackStreamError] —
 * deliberately extracted so it can be unit tested without constructing any
 * real Media3/OkHttp exception types. `internal` rather than `private` so
 * the test in this module can call it directly.
 */
internal fun classifyByResponseCode(responseCode: Int?, error: Throwable): PlaybackStreamError =
    when (responseCode) {
        416 -> PlaybackStreamError.PreviewEnded
        404 -> PlaybackStreamError.SessionExpired
        401 -> PlaybackStreamError.AuthenticationRequired
        else -> PlaybackStreamError.Unknown(error)
    }

/**
 * Walks the real cause chain looking for the HTTP status code Media3's
 * OkHttp data source attaches on a non-2xx response. Only touches
 * high-confidence public API surface (an `is` check and one documented
 * field read) — see the Phase 5 report for why this part is manually
 * reviewed rather than unit tested.
 */
private tailrec fun findHttpResponseCode(throwable: Throwable?): Int? =
    when {
        throwable == null -> null
        throwable is HttpDataSource.InvalidResponseCodeException -> throwable.responseCode
        else -> findHttpResponseCode(throwable.cause)
    }
