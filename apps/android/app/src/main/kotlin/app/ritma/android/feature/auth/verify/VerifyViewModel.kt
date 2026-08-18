package app.ritma.android.feature.auth.verify

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.ritma.android.data.auth.AuthRepository
import app.ritma.android.data.auth.VerifyOutcome
import app.ritma.android.navigation.RitmaDestination
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class VerifyUiState(
    val phoneNumber: String = "",
    val code: String = "",
    val invitationCode: String = "",
    val isSubmitting: Boolean = false,
    val errorMessage: String? = null,
    val waitlistedMessage: String? = null,
)

@HiltViewModel
class VerifyViewModel
@Inject
constructor(savedStateHandle: SavedStateHandle, private val authRepository: AuthRepository) : ViewModel() {

    private val phoneNumber: String = checkNotNull(savedStateHandle[RitmaDestination.Verify.ARG_PHONE_NUMBER])

    private val _uiState = MutableStateFlow(VerifyUiState(phoneNumber = phoneNumber))
    val uiState: StateFlow<VerifyUiState> = _uiState.asStateFlow()

    /** Fired once verification succeeds and tokens are persisted — the screen navigates to Home. */
    private val _verifiedEvent = MutableSharedFlow<Unit>()
    val verifiedEvent: SharedFlow<Unit> = _verifiedEvent.asSharedFlow()

    fun onCodeChange(value: String) {
        _uiState.update { it.copy(code = value, errorMessage = null) }
    }

    fun onInvitationCodeChange(value: String) {
        _uiState.update { it.copy(invitationCode = value, errorMessage = null) }
    }

    fun submit() {
        val state = _uiState.value
        if (state.code.isBlank()) {
            _uiState.update { it.copy(errorMessage = "Enter the code you received.") }
            return
        }
        viewModelScope.launch {
            _uiState.update { it.copy(isSubmitting = true, errorMessage = null, waitlistedMessage = null) }
            val invitationCode = state.invitationCode.trim().ifBlank { null }
            when (val outcome = authRepository.verify(phoneNumber, state.code.trim(), invitationCode)) {
                is VerifyOutcome.Success -> {
                    _uiState.update { it.copy(isSubmitting = false) }
                    _verifiedEvent.emit(Unit)
                }
                is VerifyOutcome.Waitlisted -> {
                    _uiState.update { it.copy(isSubmitting = false, waitlistedMessage = outcome.message) }
                }
                is VerifyOutcome.Rejected -> {
                    _uiState.update { it.copy(isSubmitting = false, errorMessage = outcome.message) }
                }
                is VerifyOutcome.Failed -> {
                    _uiState.update { it.copy(isSubmitting = false, errorMessage = outcome.message) }
                }
            }
        }
    }
}
