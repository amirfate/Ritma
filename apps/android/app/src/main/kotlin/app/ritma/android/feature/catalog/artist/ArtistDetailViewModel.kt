package app.ritma.android.feature.catalog.artist

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.ritma.android.data.catalog.CatalogRepository
import app.ritma.android.data.catalog.CatalogResult
import app.ritma.android.data.catalog.PublicAlbum
import app.ritma.android.data.catalog.PublicArtist
import app.ritma.android.feature.catalog.CatalogListUiState
import app.ritma.android.feature.catalog.toListUiState
import app.ritma.android.navigation.RitmaDestination
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed interface ArtistDetailUiState {
    data object Loading : ArtistDetailUiState

    data class Loaded(val artist: PublicArtist, val albums: CatalogListUiState<PublicAlbum>) : ArtistDetailUiState

    data class Error(val message: String) : ArtistDetailUiState
}

@HiltViewModel
class ArtistDetailViewModel
@Inject
constructor(savedStateHandle: SavedStateHandle, private val catalogRepository: CatalogRepository) : ViewModel() {

    private val artistId: String = checkNotNull(savedStateHandle[RitmaDestination.ArtistDetail.ARG_ARTIST_ID])

    private val _uiState = MutableStateFlow<ArtistDetailUiState>(ArtistDetailUiState.Loading)
    val uiState: StateFlow<ArtistDetailUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            when (val result = catalogRepository.getArtist(artistId)) {
                is CatalogResult.Success -> {
                    _uiState.value = ArtistDetailUiState.Loaded(result.data, CatalogListUiState.Loading)
                    loadAlbums(result.data.id)
                }
                is CatalogResult.Failed -> _uiState.value = ArtistDetailUiState.Error(result.message)
            }
        }
    }

    /**
     * Albums are fetched separately via `listAlbums(artistId = ...)` — a
     * [PublicArtist] never carries a nested album list from the audited
     * API, so this is a second real call, not an assumption about the
     * artist response shape.
     */
    private fun loadAlbums(artistId: String) {
        viewModelScope.launch {
            val albumsState = catalogRepository.listAlbums(artistId = artistId).toListUiState()
            val current = _uiState.value
            if (current is ArtistDetailUiState.Loaded) {
                _uiState.value = current.copy(albums = albumsState)
            }
        }
    }
}
