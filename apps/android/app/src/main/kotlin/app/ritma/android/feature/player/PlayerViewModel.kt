package app.ritma.android.feature.player

import android.content.Context
import androidx.annotation.OptIn
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import app.ritma.android.data.playback.CreateSessionOutcome
import app.ritma.android.data.playback.PlaybackAccessType
import app.ritma.android.data.playback.PlaybackDataSourceFactory
import app.ritma.android.data.playback.PlaybackRepository
import app.ritma.android.data.playback.PlaybackStreamError
import app.ritma.android.data.playback.classifyPlaybackError
import app.ritma.android.di.ApplicationScope
import app.ritma.android.navigation.RitmaDestination
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import java.util.concurrent.atomic.AtomicBoolean
import javax.inject.Inject
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

sealed interface PlayerUiState {
    data object CreatingSession : PlayerUiState

    /** `accessType` is shown to the user; nothing here uses it to decide how much of the track may play. */
    data class Ready(val accessType: PlaybackAccessType, val isPlaying: Boolean) : PlayerUiState

    data class SessionUnavailable(val message: String) : PlayerUiState

    data class StreamError(val error: PlaybackStreamError) : PlayerUiState
}

@HiltViewModel
class PlayerViewModel
@Inject
constructor(
    savedStateHandle: SavedStateHandle,
    @ApplicationContext private val context: Context,
    private val playbackRepository: PlaybackRepository,
    private val dataSourceFactory: PlaybackDataSourceFactory,
    @ApplicationScope private val applicationScope: CoroutineScope,
) : ViewModel() {

    private val trackId: String = checkNotNull(savedStateHandle[RitmaDestination.Player.ARG_TRACK_ID])

    private val _uiState = MutableStateFlow<PlayerUiState>(PlayerUiState.CreatingSession)
    val uiState: StateFlow<PlayerUiState> = _uiState.asStateFlow()

    private var player: ExoPlayer? = null
    private var sessionId: String? = null

    /** Guards `POST /playback/sessions/:id/end` against being fired twice — from natural completion, an error, and `onCleared()` all racing. */
    private val sessionEnded = AtomicBoolean(false)

    private val playerListener =
        object : Player.Listener {
            override fun onIsPlayingChanged(isPlaying: Boolean) {
                _uiState.update { state -> if (state is PlayerUiState.Ready) state.copy(isPlaying = isPlaying) else state }
            }

            override fun onPlaybackStateChanged(playbackState: Int) {
                if (playbackState == Player.STATE_ENDED) {
                    endSessionOnce()
                }
            }

            override fun onPlayerError(error: PlaybackException) {
                // A 416 at the PREVIEW boundary lands here too — classifyPlaybackError
                // maps it to PlaybackStreamError.PreviewEnded, an expected outcome,
                // not a generic crash/failure state.
                _uiState.value = PlayerUiState.StreamError(classifyPlaybackError(error))
                endSessionOnce()
            }
        }

    init {
        viewModelScope.launch {
            // Playback session must exist before any stream request is made.
            when (val outcome = playbackRepository.createSession(trackId)) {
                is CreateSessionOutcome.Success -> {
                    sessionId = outcome.sessionId
                    startPlayback(outcome.sessionId, outcome.accessType)
                }
                is CreateSessionOutcome.DeviceNotAuthorized ->
                    _uiState.value = PlayerUiState.SessionUnavailable(outcome.message)
                is CreateSessionOutcome.TrackUnavailable ->
                    _uiState.value = PlayerUiState.SessionUnavailable(outcome.message)
                is CreateSessionOutcome.ConcurrentSessionExists ->
                    _uiState.value = PlayerUiState.SessionUnavailable(outcome.message)
                is CreateSessionOutcome.Failed -> _uiState.value = PlayerUiState.SessionUnavailable(outcome.message)
            }
        }
    }

    @OptIn(UnstableApi::class)
    private fun startPlayback(sessionId: String, accessType: PlaybackAccessType) {
        val exoPlayer =
            ExoPlayer.Builder(context)
                .setMediaSourceFactory(DefaultMediaSourceFactory(dataSourceFactory.create()))
                .build()
        exoPlayer.addListener(playerListener)
        exoPlayer.setMediaItem(MediaItem.fromUri(playbackRepository.streamUrl(sessionId)))
        exoPlayer.prepare()
        exoPlayer.playWhenReady = true
        player = exoPlayer
        _uiState.value = PlayerUiState.Ready(accessType = accessType, isPlaying = false)
    }

    fun togglePlayPause() {
        val exoPlayer = player ?: return
        if (exoPlayer.isPlaying) exoPlayer.pause() else exoPlayer.play()
    }

    private fun endSessionOnce() {
        val id = sessionId ?: return
        if (sessionEnded.compareAndSet(false, true)) {
            // applicationScope, not viewModelScope: this must still run
            // during onCleared(), by which point viewModelScope is already
            // cancelled.
            applicationScope.launch { playbackRepository.endSession(id) }
        }
    }

    override fun onCleared() {
        player?.removeListener(playerListener)
        player?.release()
        player = null
        endSessionOnce()
    }
}
