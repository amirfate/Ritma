package app.ritma.android.navigation

import android.net.Uri

/**
 * Top-level navigation destinations of the Ritma app. The M6 Android
 * Listener vertical slice: Login -> Verify -> Home/Catalog -> Artist ->
 * Album -> Track -> Player.
 */
sealed class RitmaDestination(val route: String) {
    data object Login : RitmaDestination("login")

    /**
     * `phoneNumber` travels as a query argument so a phone number
     * containing characters like `+` survives round-tripping; callers must
     * build the concrete route via [createRoute] rather than
     * string-concatenating the raw route pattern.
     */
    data object Verify : RitmaDestination("verify?phoneNumber={phoneNumber}") {
        const val ARG_PHONE_NUMBER = "phoneNumber"

        fun createRoute(phoneNumber: String): String = "verify?phoneNumber=${Uri.encode(phoneNumber)}"
    }

    data object Home : RitmaDestination("home")

    data object ArtistDetail : RitmaDestination("artist/{artistId}") {
        const val ARG_ARTIST_ID = "artistId"

        fun createRoute(artistId: String): String = "artist/$artistId"
    }

    data object AlbumDetail : RitmaDestination("album/{albumId}") {
        const val ARG_ALBUM_ID = "albumId"

        fun createRoute(albumId: String): String = "album/$albumId"
    }

    data object TrackDetail : RitmaDestination("track/{trackId}") {
        const val ARG_TRACK_ID = "trackId"

        fun createRoute(trackId: String): String = "track/$trackId"
    }

    data object Player : RitmaDestination("player/{trackId}") {
        const val ARG_TRACK_ID = "trackId"

        fun createRoute(trackId: String): String = "player/$trackId"
    }
}
