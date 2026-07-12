package app.ritma.android.navigation

/**
 * Top-level navigation destinations of the Ritma app.
 */
sealed class RitmaDestination(val route: String) {
    data object Home : RitmaDestination("home")
}
