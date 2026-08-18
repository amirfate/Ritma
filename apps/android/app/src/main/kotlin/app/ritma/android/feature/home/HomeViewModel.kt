package app.ritma.android.feature.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.ritma.android.data.catalog.CatalogRepository
import app.ritma.android.data.catalog.PublicAlbum
import app.ritma.android.data.catalog.PublicArtist
import app.ritma.android.data.catalog.PublicTrack
import app.ritma.android.feature.catalog.CatalogListUiState
import app.ritma.android.feature.catalog.toListUiState
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

enum class HomeTab { ARTISTS, ALBUMS, TRACKS }

data class HomeUiState(
    val selectedTab: HomeTab = HomeTab.TRACKS,
    val artists: CatalogListUiState<PublicArtist> = CatalogListUiState.Loading,
    val albums: CatalogListUiState<PublicAlbum> = CatalogListUiState.Loading,
    val tracks: CatalogListUiState<PublicTrack> = CatalogListUiState.Loading,
)

/** Home is the catalog's browse entry point — the merged "Home/Catalog" destination from the M6 plan. */
@HiltViewModel
class HomeViewModel @Inject constructor(private val catalogRepository: CatalogRepository) : ViewModel() {

    private val _uiState = MutableStateFlow(HomeUiState())
    val uiState: StateFlow<HomeUiState> = _uiState.asStateFlow()

    init {
        loadArtists()
        loadAlbums()
        loadTracks()
    }

    fun onTabSelected(tab: HomeTab) {
        _uiState.update { it.copy(selectedTab = tab) }
    }

    private fun loadArtists() {
        viewModelScope.launch {
            _uiState.update { it.copy(artists = CatalogListUiState.Loading) }
            val result = catalogRepository.listArtists().toListUiState()
            _uiState.update { it.copy(artists = result) }
        }
    }

    private fun loadAlbums() {
        viewModelScope.launch {
            _uiState.update { it.copy(albums = CatalogListUiState.Loading) }
            val result = catalogRepository.listAlbums().toListUiState()
            _uiState.update { it.copy(albums = result) }
        }
    }

    private fun loadTracks() {
        viewModelScope.launch {
            _uiState.update { it.copy(tracks = CatalogListUiState.Loading) }
            val result = catalogRepository.listTracks().toListUiState()
            _uiState.update { it.copy(tracks = result) }
        }
    }
}
