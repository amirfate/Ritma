package app.ritma.android.feature.catalog.lyrics

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.ritma.android.data.catalog.LyricsRepository
import app.ritma.android.data.catalog.LyricsResult
import app.ritma.android.data.catalog.PublicLyrics
import app.ritma.android.navigation.RitmaDestination
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed interface LyricsUiState {
    data object Loading : LyricsUiState

    data class Loaded(val lyrics: PublicLyrics) : LyricsUiState

    /** No lyrics to show — the track isn't published, or has none yet. An ordinary empty state, not an error. */
    data object Unavailable : LyricsUiState

    data class Error(val message: String) : LyricsUiState
}

@HiltViewModel
class LyricsViewModel
@Inject
constructor(savedStateHandle: SavedStateHandle, private val lyricsRepository: LyricsRepository) : ViewModel() {

    private val trackId: String = checkNotNull(savedStateHandle[RitmaDestination.LyricsDetail.ARG_TRACK_ID])

    private val _uiState = MutableStateFlow<LyricsUiState>(LyricsUiState.Loading)
    val uiState: StateFlow<LyricsUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            _uiState.value =
                when (val result = lyricsRepository.getLyrics(trackId)) {
                    is LyricsResult.Available -> LyricsUiState.Loaded(result.lyrics)
                    LyricsResult.Unavailable -> LyricsUiState.Unavailable
                    is LyricsResult.Failed -> LyricsUiState.Error(result.message)
                }
        }
    }
}
