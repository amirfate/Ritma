package app.ritma.android.feature.catalog.album

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.ritma.android.data.catalog.CatalogRepository
import app.ritma.android.data.catalog.CatalogResult
import app.ritma.android.data.catalog.PublicAlbum
import app.ritma.android.data.catalog.PublicTrack
import app.ritma.android.feature.catalog.CatalogListUiState
import app.ritma.android.feature.catalog.toListUiState
import app.ritma.android.navigation.RitmaDestination
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed interface AlbumDetailUiState {
    data object Loading : AlbumDetailUiState

    /**
     * `artistName` is `null` until the separate `getArtist(album.artistId)`
     * call resolves (or forever, if it fails) — [PublicAlbum] only carries
     * the bare `artistId` foreign key, never a nested artist object, so
     * the name is never assumed and [album]'s `artistId` remains usable
     * for navigation even while this is still `null`.
     */
    data class Loaded(
        val album: PublicAlbum,
        val artistName: String?,
        val tracks: CatalogListUiState<PublicTrack>,
    ) : AlbumDetailUiState

    data class Error(val message: String) : AlbumDetailUiState
}

@HiltViewModel
class AlbumDetailViewModel
@Inject
constructor(savedStateHandle: SavedStateHandle, private val catalogRepository: CatalogRepository) : ViewModel() {

    private val albumId: String = checkNotNull(savedStateHandle[RitmaDestination.AlbumDetail.ARG_ALBUM_ID])

    private val _uiState = MutableStateFlow<AlbumDetailUiState>(AlbumDetailUiState.Loading)
    val uiState: StateFlow<AlbumDetailUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            when (val result = catalogRepository.getAlbum(albumId)) {
                is CatalogResult.Success -> {
                    val album = result.data
                    _uiState.value = AlbumDetailUiState.Loaded(album, artistName = null, tracks = CatalogListUiState.Loading)
                    loadArtistName(album.artistId)
                    loadTracks(album.id)
                }
                is CatalogResult.Failed -> _uiState.value = AlbumDetailUiState.Error(result.message)
            }
        }
    }

    private fun loadArtistName(artistId: String) {
        viewModelScope.launch {
            val result = catalogRepository.getArtist(artistId)
            if (result is CatalogResult.Success) {
                val current = _uiState.value
                if (current is AlbumDetailUiState.Loaded) {
                    _uiState.value = current.copy(artistName = result.data.name)
                }
            }
            // A failure here is non-critical — the screen falls back to showing the bare artistId.
        }
    }

    private fun loadTracks(albumId: String) {
        viewModelScope.launch {
            val tracksState = catalogRepository.listTracks(albumId = albumId).toListUiState()
            val current = _uiState.value
            if (current is AlbumDetailUiState.Loaded) {
                _uiState.value = current.copy(tracks = tracksState)
            }
        }
    }
}
