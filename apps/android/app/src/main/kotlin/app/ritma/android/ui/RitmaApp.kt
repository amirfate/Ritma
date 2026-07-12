package app.ritma.android.ui

import androidx.compose.runtime.Composable
import androidx.navigation.compose.rememberNavController
import app.ritma.android.navigation.RitmaNavHost

/**
 * Root composable of the Ritma app. Owns the navigation controller and
 * hosts the app-level navigation graph.
 */
@Composable
fun RitmaApp() {
    val navController = rememberNavController()
    RitmaNavHost(navController = navController)
}
