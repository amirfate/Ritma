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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.ritma.android.data.lyrics.SyncedLyricLine

@Composable
fun LyricsRoute(viewModel: LyricsViewModel = hiltViewModel()) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val activeLine by viewModel.activeLine.collectAsStateWithLifecycle()
    LyricsScreen(uiState = uiState, activeLine = activeLine)
}

/**
 * Renders [app.ritma.android.data.catalog.PublicLyrics.content] verbatim
 * when a track has no valid synced lines (`syncedLyrics.lines.isEmpty()` —
 * `syncedContent` was null or entirely malformed), matching M8 Phase 2's
 * static behavior exactly. When valid synced lines exist, each line is
 * rendered separately with the current [activeLine] bolded and
 * highlighted — no animation, no auto-scroll subsystem, no karaoke/
 * word-level behavior, per the locked Beta UI scope.
 */
@Composable
fun LyricsScreen(uiState: LyricsUiState, activeLine: SyncedLyricLine?, modifier: Modifier = Modifier) {
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
                    if (uiState.syncedLyrics.lines.isEmpty()) {
                        Text(text = uiState.lyrics.content, style = MaterialTheme.typography.bodyLarge)
                    } else {
                        uiState.syncedLyrics.lines.forEach { line ->
                            val isActive = line == activeLine
                            Text(
                                text = line.text,
                                style =
                                    if (isActive) {
                                        MaterialTheme.typography.bodyLarge.copy(fontWeight = FontWeight.Bold)
                                    } else {
                                        MaterialTheme.typography.bodyLarge
                                    },
                                color = if (isActive) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface,
                            )
                        }
                    }
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
