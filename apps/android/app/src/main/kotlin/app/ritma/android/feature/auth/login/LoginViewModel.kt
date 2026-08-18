package app.ritma.android.feature.auth.login

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.ritma.android.data.auth.AuthRepository
import app.ritma.android.data.auth.SendCodeOutcome
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

data class LoginUiState(
    val phoneNumber: String = "",
    val isSubmitting: Boolean = false,
    val errorMessage: String? = null,
)

@HiltViewModel
class LoginViewModel @Inject constructor(private val authRepository: AuthRepository) : ViewModel() {

    private val _uiState = MutableStateFlow(LoginUiState())
    val uiState: StateFlow<LoginUiState> = _uiState.asStateFlow()

    /** Fired once with the submitted phone number when the OTP was sent — the screen navigates to Verify. */
    private val _codeSentEvent = MutableSharedFlow<String>()
    val codeSentEvent: SharedFlow<String> = _codeSentEvent.asSharedFlow()

    fun onPhoneNumberChange(value: String) {
        _uiState.update { it.copy(phoneNumber = value, errorMessage = null) }
    }

    fun sendCode() {
        val phoneNumber = _uiState.value.phoneNumber.trim()
        if (phoneNumber.isBlank()) {
            _uiState.update { it.copy(errorMessage = "Enter your phone number.") }
            return
        }
        viewModelScope.launch {
            _uiState.update { it.copy(isSubmitting = true, errorMessage = null) }
            when (val outcome = authRepository.sendCode(phoneNumber)) {
                is SendCodeOutcome.Sent -> {
                    _uiState.update { it.copy(isSubmitting = false) }
                    _codeSentEvent.emit(phoneNumber)
                }
                is SendCodeOutcome.RateLimited -> {
                    _uiState.update { it.copy(isSubmitting = false, errorMessage = outcome.message) }
                }
                is SendCodeOutcome.Failed -> {
                    _uiState.update { it.copy(isSubmitting = false, errorMessage = outcome.message) }
                }
            }
        }
    }
}
