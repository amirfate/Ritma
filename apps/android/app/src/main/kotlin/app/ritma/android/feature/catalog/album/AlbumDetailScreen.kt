package app.ritma.android.feature.catalog.album

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ListItem
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
import app.ritma.android.data.catalog.PublicTrack
import app.ritma.android.feature.catalog.CatalogListSection

@Composable
fun AlbumDetailRoute(
    onArtistClick: (String) -> Unit,
    onTrackClick: (String) -> Unit,
    viewModel: AlbumDetailViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    AlbumDetailScreen(uiState = uiState, onArtistClick = onArtistClick, onTrackClick = onTrackClick)
}

@Composable
fun AlbumDetailScreen(
    uiState: AlbumDetailUiState,
    onArtistClick: (String) -> Unit,
    onTrackClick: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    Scaffold(modifier = modifier.fillMaxSize()) { innerPadding ->
        when (uiState) {
            AlbumDetailUiState.Loading -> {
                Box(modifier = Modifier.fillMaxSize().padding(innerPadding), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
            }
            is AlbumDetailUiState.Error -> {
                Box(modifier = Modifier.fillMaxSize().padding(innerPadding), contentAlignment = Alignment.Center) {
                    Text("Couldn't load this album: ${uiState.message}")
                }
            }
            is AlbumDetailUiState.Loaded -> {
                Column(modifier = Modifier.fillMaxSize().padding(innerPadding)) {
                    Column(modifier = Modifier.padding(24.dp)) {
                        Text(text = uiState.album.title, style = MaterialTheme.typography.headlineMedium)
                        Text(
                            text = "by ${uiState.artistName ?: uiState.album.artistId}",
                            style = MaterialTheme.typography.bodyLarge,
                            modifier = Modifier.clickable { onArtistClick(uiState.album.artistId) },
                        )
                    }
                    Text(
                        text = "Tracks",
                        style = MaterialTheme.typography.titleMedium,
                        modifier = Modifier.padding(horizontal = 24.dp),
                    )
                    CatalogListSection(
                        state = uiState.tracks,
                        itemKey = PublicTrack::id,
                        modifier = Modifier.weight(1f),
                    ) { track ->
                        ListItem(
                            headlineContent = { Text(track.title) },
                            supportingContent = { Text(track.genre.name) },
                            modifier = Modifier.clickable { onTrackClick(track.id) },
                        )
                    }
                }
            }
        }
    }
}
