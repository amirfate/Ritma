package app.ritma.android.feature.catalog.lyrics

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle

@Composable
fun LyricsRoute(viewModel: LyricsViewModel = hiltViewModel()) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    LyricsScreen(uiState = uiState)
}

/**
 * Static lyrics only — renders [app.ritma.android.data.catalog.PublicLyrics.content]
 * verbatim. `syncedContent` is deliberately not read or parsed here (M8
 * Phase 2 scope); a future phase may add timed highlighting on top of this
 * screen without changing this static rendering path.
 */
@Composable
fun LyricsScreen(uiState: LyricsUiState, modifier: Modifier = Modifier) {
    Scaffold(modifier = modifier.fillMaxSize()) { innerPadding ->
        when (uiState) {
            LyricsUiState.Loading -> {
                Box(modifier = Modifier.fillMaxSize().padding(innerPadding), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
            }
            is LyricsUiState.Loaded -> {
                Column(
                    modifier =
                        Modifier.fillMaxSize().padding(innerPadding).verticalScroll(rememberScrollState()).padding(24.dp),
                ) {
                    Text(text = uiState.lyrics.content, style = MaterialTheme.typography.bodyLarge)
                }
            }
            LyricsUiState.Unavailable -> {
                Box(modifier = Modifier.fillMaxSize().padding(innerPadding), contentAlignment = Alignment.Center) {
                    Text(text = "No lyrics available for this track.", style = MaterialTheme.typography.bodyLarge)
                }
            }
            is LyricsUiState.Error -> {
                Box(modifier = Modifier.fillMaxSize().padding(innerPadding), contentAlignment = Alignment.Center) {
                    Text(text = "Couldn't load lyrics: ${uiState.message}", style = MaterialTheme.typography.bodyLarge)
                }
            }
        }
    }
}
