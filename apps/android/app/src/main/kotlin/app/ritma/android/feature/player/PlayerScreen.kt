package app.ritma.android.feature.player

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
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
import app.ritma.android.data.playback.PlaybackAccessType
import app.ritma.android.data.playback.PlaybackStreamError

@Composable
fun PlayerRoute(viewModel: PlayerViewModel = hiltViewModel()) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    PlayerScreen(uiState = uiState, onPlayPauseClick = viewModel::togglePlayPause)
}

@Composable
fun PlayerScreen(uiState: PlayerUiState, onPlayPauseClick: () -> Unit, modifier: Modifier = Modifier) {
    Scaffold(modifier = modifier.fillMaxSize()) { innerPadding ->
        Box(modifier = Modifier.fillMaxSize().padding(innerPadding), contentAlignment = Alignment.Center) {
            when (uiState) {
                PlayerUiState.CreatingSession -> CircularProgressIndicator()
                is PlayerUiState.Ready -> {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(text = accessTypeLabel(uiState.accessType), style = MaterialTheme.typography.labelLarge)
                        Spacer(modifier = Modifier.height(16.dp))
                        Button(onClick = onPlayPauseClick) {
                            Text(if (uiState.isPlaying) "Pause" else "Play")
                        }
                    }
                }
                is PlayerUiState.SessionUnavailable -> {
                    Text(text = uiState.message, style = MaterialTheme.typography.bodyLarge)
                }
                is PlayerUiState.StreamError -> {
                    Text(text = streamErrorMessage(uiState.error), style = MaterialTheme.typography.bodyLarge)
                }
            }
        }
    }
}

private fun accessTypeLabel(accessType: PlaybackAccessType): String =
    when (accessType) {
        PlaybackAccessType.PREVIEW -> "Preview (first 30 seconds)"
        PlaybackAccessType.FULL_FREE -> "Full track"
        PlaybackAccessType.FULL_PURCHASED -> "Full track (purchased)"
    }

private fun streamErrorMessage(error: PlaybackStreamError): String =
    when (error) {
        PlaybackStreamError.PreviewEnded -> "Preview ended."
        PlaybackStreamError.SessionExpired -> "This playback session has expired."
        PlaybackStreamError.AuthenticationRequired -> "Please sign in again to continue."
        is PlaybackStreamError.Unknown -> "Playback error: ${error.cause.message ?: "unknown"}"
    }
