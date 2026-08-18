package app.ritma.android.feature.home

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.ListItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.ritma.android.data.catalog.PublicAlbum
import app.ritma.android.data.catalog.PublicArtist
import app.ritma.android.data.catalog.PublicTrack
import app.ritma.android.feature.catalog.CatalogListSection

@Composable
fun HomeRoute(
    onArtistClick: (String) -> Unit,
    onAlbumClick: (String) -> Unit,
    onTrackClick: (String) -> Unit,
    viewModel: HomeViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    HomeScreen(
        uiState = uiState,
        onTabSelected = viewModel::onTabSelected,
        onArtistClick = onArtistClick,
        onAlbumClick = onAlbumClick,
        onTrackClick = onTrackClick,
    )
}

@Composable
fun HomeScreen(
    uiState: HomeUiState,
    onTabSelected: (HomeTab) -> Unit,
    onArtistClick: (String) -> Unit,
    onAlbumClick: (String) -> Unit,
    onTrackClick: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    Scaffold(modifier = modifier.fillMaxSize()) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding),
        ) {
            val tabs = HomeTab.entries
            TabRow(selectedTabIndex = tabs.indexOf(uiState.selectedTab)) {
                tabs.forEach { tab ->
                    Tab(
                        selected = uiState.selectedTab == tab,
                        onClick = { onTabSelected(tab) },
                        text = { Text(tab.name.lowercase().replaceFirstChar { it.uppercase() }) },
                    )
                }
            }
            when (uiState.selectedTab) {
                HomeTab.ARTISTS -> {
                    CatalogListSection(
                        state = uiState.artists,
                        itemKey = PublicArtist::id,
                        modifier = Modifier.weight(1f),
                    ) { artist ->
                        ListItem(
                            headlineContent = { Text(artist.name) },
                            supportingContent = artist.bio?.let { bio -> { Text(bio) } },
                            modifier = Modifier.clickable { onArtistClick(artist.id) },
                        )
                    }
                }
                HomeTab.ALBUMS -> {
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
                HomeTab.TRACKS -> {
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
