package app.ritma.android.navigation

import androidx.compose.runtime.Composable
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import app.ritma.android.feature.home.HomeRoute

/**
 * App-level navigation graph. New destinations register here as features
 * are added.
 */
@Composable
fun RitmaNavHost(navController: NavHostController) {
    NavHost(
        navController = navController,
        startDestination = RitmaDestination.Home.route,
    ) {
        composable(route = RitmaDestination.Home.route) {
            HomeRoute()
        }
    }
}
