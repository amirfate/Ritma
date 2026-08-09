package app.ritma.android.feature.catalog.track

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.ritma.android.data.catalog.CatalogRepository
import app.ritma.android.data.catalog.CatalogResult
import app.ritma.android.data.catalog.PublicTrack
import app.ritma.android.navigation.RitmaDestination
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed interface TrackDetailUiState {
    data object Loading : TrackDetailUiState

    data class Loaded(val track: PublicTrack) : TrackDetailUiState

    data class Error(val message: String) : TrackDetailUiState
}

@HiltViewModel
class TrackDetailViewModel
@Inject
constructor(savedStateHandle: SavedStateHandle, private val catalogRepository: CatalogRepository) : ViewModel() {

    private val trackId: String = checkNotNull(savedStateHandle[RitmaDestination.TrackDetail.ARG_TRACK_ID])

    private val _uiState = MutableStateFlow<TrackDetailUiState>(TrackDetailUiState.Loading)
    val uiState: StateFlow<TrackDetailUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            _uiState.value =
                when (val result = catalogRepository.getTrack(trackId)) {
                    is CatalogResult.Success -> TrackDetailUiState.Loaded(result.data)
                    is CatalogResult.Failed -> TrackDetailUiState.Error(result.message)
                }
        }
    }
}
