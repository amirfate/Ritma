package app.ritma.android.feature.catalog.artist

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
import app.ritma.android.data.catalog.PublicAlbum
import app.ritma.android.feature.catalog.CatalogListSection

@Composable
fun ArtistDetailRoute(onAlbumClick: (String) -> Unit, viewModel: ArtistDetailViewModel = hiltViewModel()) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    ArtistDetailScreen(uiState = uiState, onAlbumClick = onAlbumClick)
}

@Composable
fun ArtistDetailScreen(uiState: ArtistDetailUiState, onAlbumClick: (String) -> Unit, modifier: Modifier = Modifier) {
    Scaffold(modifier = modifier.fillMaxSize()) { innerPadding ->
        when (uiState) {
            ArtistDetailUiState.Loading -> {
                Box(
                    modifier = Modifier.fillMaxSize().padding(innerPadding),
                    contentAlignment = Alignment.Center,
                ) {
                    CircularProgressIndicator()
                }
            }
            is ArtistDetailUiState.Error -> {
                Box(
                    modifier = Modifier.fillMaxSize().padding(innerPadding),
                    contentAlignment = Alignment.Center,
                ) {
                    Text("Couldn't load this artist: ${uiState.message}")
                }
            }
            is ArtistDetailUiState.Loaded -> {
                Column(modifier = Modifier.fillMaxSize().padding(innerPadding)) {
                    Column(modifier = Modifier.padding(24.dp)) {
                        Text(text = uiState.artist.name, style = MaterialTheme.typography.headlineMedium)
                        uiState.artist.bio?.let { bio ->
                            Text(text = bio, style = MaterialTheme.typography.bodyLarge)
                        }
                    }
                    Text(
                        text = "Albums",
                        style = MaterialTheme.typography.titleMedium,
                        modifier = Modifier.padding(horizontal = 24.dp),
                    )
                    CatalogListSection(
                        state = uiState.albums,
                        itemKey = PublicAlbum::id,
                        modifier = Modifier.weight(1f),
                    ) { album ->
                        ListItem(
                            headlineContent = { Text(album.title) },
                            modifier = Modifier.clickable { onAlbumClick(album.id) },
                        )
                    }
                }
            }
        }
    }
}
