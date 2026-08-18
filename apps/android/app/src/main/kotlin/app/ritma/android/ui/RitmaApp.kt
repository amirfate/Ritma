package app.ritma.android.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.compose.rememberNavController
import app.ritma.android.navigation.RitmaDestination
import app.ritma.android.navigation.RitmaNavHost

/**
 * Root composable of the Ritma app. Waits for [AppViewModel] to resolve
 * whether a session is already persisted before mounting the nav graph, so
 * the start destination is genuinely auth-gated: Home for an existing
 * session, Login otherwise.
 */
@Composable
fun RitmaApp(appViewModel: AppViewModel = hiltViewModel()) {
    val authGateState by appViewModel.authGateState.collectAsStateWithLifecycle()

    when (val state = authGateState) {
        AuthGateState.Loading -> {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator()
            }
        }
        is AuthGateState.Resolved -> {
            val navController = rememberNavController()
            val startDestination = if (state.isAuthenticated) RitmaDestination.Home.route else RitmaDestination.Login.route
            RitmaNavHost(navController = navController, startDestination = startDestination)
        }
    }
}
