package app.ritma.android.navigation

import androidx.compose.runtime.Composable
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.navArgument
import app.ritma.android.feature.auth.login.LoginRoute
import app.ritma.android.feature.auth.verify.VerifyRoute
import app.ritma.android.feature.catalog.album.AlbumDetailRoute
import app.ritma.android.feature.catalog.artist.ArtistDetailRoute
import app.ritma.android.feature.catalog.track.TrackDetailRoute
import app.ritma.android.feature.home.HomeRoute
import app.ritma.android.feature.player.PlayerRoute

/**
 * App-level navigation graph — the seven M6 destinations: Login -> Verify
 * -> Home/Catalog -> Artist -> Album -> Track -> Player.
 */
@Composable
fun RitmaNavHost(navController: NavHostController, startDestination: String) {
    NavHost(navController = navController, startDestination = startDestination) {
        composable(route = RitmaDestination.Login.route) {
            LoginRoute(
                onCodeSent = { phoneNumber -> navController.navigate(RitmaDestination.Verify.createRoute(phoneNumber)) },
            )
        }
        composable(
            route = RitmaDestination.Verify.route,
            arguments = listOf(navArgument(RitmaDestination.Verify.ARG_PHONE_NUMBER) { type = NavType.StringType }),
        ) {
            VerifyRoute(
                onVerified = {
                    navController.navigate(RitmaDestination.Home.route) {
                        popUpTo(RitmaDestination.Login.route) { inclusive = true }
                    }
                },
            )
        }
        composable(route = RitmaDestination.Home.route) {
            HomeRoute(
                onArtistClick = { artistId -> navController.navigate(RitmaDestination.ArtistDetail.createRoute(artistId)) },
                onAlbumClick = { albumId -> navController.navigate(RitmaDestination.AlbumDetail.createRoute(albumId)) },
                onTrackClick = { trackId -> navController.navigate(RitmaDestination.TrackDetail.createRoute(trackId)) },
            )
        }
        composable(
            route = RitmaDestination.ArtistDetail.route,
            arguments = listOf(navArgument(RitmaDestination.ArtistDetail.ARG_ARTIST_ID) { type = NavType.StringType }),
        ) {
            ArtistDetailRoute(
                onAlbumClick = { albumId -> navController.navigate(RitmaDestination.AlbumDetail.createRoute(albumId)) },
            )
        }
        composable(
            route = RitmaDestination.AlbumDetail.route,
            arguments = listOf(navArgument(RitmaDestination.AlbumDetail.ARG_ALBUM_ID) { type = NavType.StringType }),
        ) {
            AlbumDetailRoute(
                onArtistClick = { artistId -> navController.navigate(RitmaDestination.ArtistDetail.createRoute(artistId)) },
                onTrackClick = { trackId -> navController.navigate(RitmaDestination.TrackDetail.createRoute(trackId)) },
            )
        }
        composable(
            route = RitmaDestination.TrackDetail.route,
            arguments = listOf(navArgument(RitmaDestination.TrackDetail.ARG_TRACK_ID) { type = NavType.StringType }),
        ) {
            TrackDetailRoute(
                onArtistClick = { artistId -> navController.navigate(RitmaDestination.ArtistDetail.createRoute(artistId)) },
                onAlbumClick = { albumId -> navController.navigate(RitmaDestination.AlbumDetail.createRoute(albumId)) },
                onPlayClick = { trackId -> navController.navigate(RitmaDestination.Player.createRoute(trackId)) },
            )
        }
        composable(
            route = RitmaDestination.Player.route,
            arguments = listOf(navArgument(RitmaDestination.Player.ARG_TRACK_ID) { type = NavType.StringType }),
        ) {
            PlayerRoute()
        }
    }
}
