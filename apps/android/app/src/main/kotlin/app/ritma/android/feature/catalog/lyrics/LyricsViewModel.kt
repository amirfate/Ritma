package app.ritma.android.feature.catalog.lyrics

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.ritma.android.data.catalog.LyricsRepository
import app.ritma.android.data.catalog.LyricsResult
import app.ritma.android.data.catalog.PublicLyrics
import app.ritma.android.data.lyrics.SyncedLyricLine
import app.ritma.android.data.lyrics.SyncedLyrics
import app.ritma.android.data.lyrics.activeLineAt
import app.ritma.android.data.lyrics.parseSyncedLyrics
import app.ritma.android.data.playback.PlaybackPositionHolder
import app.ritma.android.navigation.RitmaDestination
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed interface LyricsUiState {
    data object Loading : LyricsUiState

    /** [syncedLyrics] is always parsed, even when empty (no valid synced lines, or `syncedContent == null`) — an empty result is the fall-back-to-static signal. */
    data class Loaded(val lyrics: PublicLyrics, val syncedLyrics: SyncedLyrics) : LyricsUiState

    /** No lyrics to show — the track isn't published, or has none yet. An ordinary empty state, not an error. */
    data object Unavailable : LyricsUiState

    data class Error(val message: String) : LyricsUiState
}

/**
 * Reads playback position from [PlaybackPositionHolder] — never from
 * `PlayerViewModel` directly (Player and Lyrics are independently-scoped
 * navigation destinations with no shared ViewModel scope; the holder is
 * the approved M9 bridge). Parsing (`parseSyncedLyrics`) and the
 * position-to-line mapping (`activeLineAt`) are both pure, ExoPlayer- and
 * ViewModel-agnostic functions from `data.lyrics` — this class only wires
 * them to the repository result and the holder's position stream.
 */
@HiltViewModel
class LyricsViewModel
@Inject
constructor(
    savedStateHandle: SavedStateHandle,
    private val lyricsRepository: LyricsRepository,
    private val positionHolder: PlaybackPositionHolder,
) : ViewModel() {

    private val trackId: String = checkNotNull(savedStateHandle[RitmaDestination.LyricsDetail.ARG_TRACK_ID])

    private val _uiState = MutableStateFlow<LyricsUiState>(LyricsUiState.Loading)
    val uiState: StateFlow<LyricsUiState> = _uiState.asStateFlow()

    /** `null` whenever there is no synced line to highlight — before the first line, or synced lyrics unavailable entirely. */
    private val _activeLine = MutableStateFlow<SyncedLyricLine?>(null)
    val activeLine: StateFlow<SyncedLyricLine?> = _activeLine.asStateFlow()

    init {
        viewModelScope.launch {
            when (val result = lyricsRepository.getLyrics(trackId)) {
                is LyricsResult.Available -> {
                    val syncedLyrics = parseSyncedLyrics(result.lyrics.syncedContent)
                    _uiState.value = LyricsUiState.Loaded(result.lyrics, syncedLyrics)
                    // Only subscribe when there's something to highlight — a
                    // track with no (or entirely malformed) syncedContent
                    // stays on plain static rendering, no position tracking.
                    if (syncedLyrics.lines.isNotEmpty()) {
                        positionHolder.positionMs.collect { positionMs -> _activeLine.value = syncedLyrics.activeLineAt(positionMs) }
                    }
                }
                LyricsResult.Unavailable -> _uiState.value = LyricsUiState.Unavailable
                is LyricsResult.Failed -> _uiState.value = LyricsUiState.Error(result.message)
            }
        }
    }
}
