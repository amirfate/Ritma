package app.ritma.android.feature.catalog.track

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.ritma.android.data.catalog.PublicTrack
import app.ritma.android.data.catalog.TrackType

@Composable
fun TrackDetailRoute(
    onArtistClick: (String) -> Unit,
    onAlbumClick: (String) -> Unit,
    onPlayClick: (String) -> Unit,
    viewModel: TrackDetailViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    TrackDetailScreen(
        uiState = uiState,
        onArtistClick = onArtistClick,
        onAlbumClick = onAlbumClick,
        onPlayClick = onPlayClick,
    )
}

@Composable
fun TrackDetailScreen(
    uiState: TrackDetailUiState,
    onArtistClick: (String) -> Unit,
    onAlbumClick: (String) -> Unit,
    onPlayClick: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    Scaffold(modifier = modifier.fillMaxSize()) { innerPadding ->
        when (uiState) {
            TrackDetailUiState.Loading -> {
                Box(modifier = Modifier.fillMaxSize().padding(innerPadding), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
            }
            is TrackDetailUiState.Error -> {
                Box(modifier = Modifier.fillMaxSize().padding(innerPadding), contentAlignment = Alignment.Center) {
                    Text("Couldn't load this track: ${uiState.message}")
                }
            }
            is TrackDetailUiState.Loaded -> {
                val track = uiState.track
                Column(modifier = Modifier.fillMaxSize().padding(innerPadding).padding(24.dp)) {
                    Text(text = track.title, style = MaterialTheme.typography.headlineMedium)
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(text = track.genre.name, style = MaterialTheme.typography.bodyMedium)
                    Text(text = formatDuration(track.durationSeconds), style = MaterialTheme.typography.bodyMedium)
                    if (track.type == TrackType.PAID) {
                        track.price?.let { price ->
                            Text(text = "Price: $price", style = MaterialTheme.typography.bodyMedium)
                        }
                    }
                    Spacer(modifier = Modifier.height(16.dp))
                    OutlinedButton(
                        onClick = { onArtistClick(track.artistId) },
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Text("View artist")
                    }
                    track.albumId?.let { albumId ->
                        Spacer(modifier = Modifier.height(8.dp))
                        OutlinedButton(onClick = { onAlbumClick(albumId) }, modifier = Modifier.fillMaxWidth()) {
                            Text("View album")
                        }
                    }
                    Spacer(modifier = Modifier.height(16.dp))
                    Button(onClick = { onPlayClick(track.id) }, modifier = Modifier.fillMaxWidth()) {
                        Text("Play")
                    }
                }
            }
        }
    }
}

private fun formatDuration(totalSeconds: Int): String {
    val minutes = totalSeconds / 60
    val seconds = totalSeconds % 60
    return "%d:%02d".format(minutes, seconds)
}
