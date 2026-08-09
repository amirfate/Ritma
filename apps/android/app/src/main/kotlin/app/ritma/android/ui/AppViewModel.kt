package app.ritma.android.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.ritma.android.data.auth.AuthRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/** Whether a locally-persisted session exists, decided once at app start to pick the nav graph's start destination. */
sealed interface AuthGateState {
    data object Loading : AuthGateState

    data class Resolved(val isAuthenticated: Boolean) : AuthGateState
}

@HiltViewModel
class AppViewModel @Inject constructor(private val authRepository: AuthRepository) : ViewModel() {

    private val _authGateState = MutableStateFlow<AuthGateState>(AuthGateState.Loading)
    val authGateState: StateFlow<AuthGateState> = _authGateState.asStateFlow()

    init {
        viewModelScope.launch { _authGateState.value = AuthGateState.Resolved(authRepository.isAuthenticated()) }
    }
}
