package app.ritma.android.feature.auth.login

import app.ritma.android.data.auth.AuthErrorBody
import app.ritma.android.data.auth.AuthRepository
import app.ritma.android.data.auth.SendCodeResponse
import app.ritma.android.testing.FakeAuthApi
import app.ritma.android.testing.FakeDeviceFingerprintSource
import app.ritma.android.testing.FakeTokenStorage
import app.ritma.android.testing.MainDispatcherRule
import app.ritma.android.testing.jsonResponse
import app.ritma.android.testing.testJson
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Rule
import org.junit.Test

private fun buildViewModel(api: FakeAuthApi) =
    LoginViewModel(AuthRepository(api, FakeTokenStorage(), FakeDeviceFingerprintSource(), testJson))

class LoginViewModelTest {

    @get:Rule val mainDispatcherRule = MainDispatcherRule()

    @Test
    fun `sending the code successfully clears submitting state and emits the phone number`() =
        runTest(mainDispatcherRule.dispatcher) {
            val api = FakeAuthApi().apply { sendCodeResponse = jsonResponse(200, SendCodeResponse(cooldownSeconds = 30)) }
            val viewModel = buildViewModel(api)
            var emittedPhoneNumber: String? = null
            val collector = launch { emittedPhoneNumber = viewModel.codeSentEvent.first() }

            viewModel.onPhoneNumberChange("+15551234567")
            viewModel.sendCode()

            assertEquals("+15551234567", emittedPhoneNumber)
            assertFalse(viewModel.uiState.value.isSubmitting)
            assertNull(viewModel.uiState.value.errorMessage)
            collector.cancel()
        }

    @Test
    fun `a rate-limited response surfaces its message without navigating`() = runTest(mainDispatcherRule.dispatcher) {
        val api =
            FakeAuthApi().apply {
                sendCodeResponse = jsonResponse(429, AuthErrorBody(message = "Too many requests", retryAfterSeconds = 60))
            }
        val viewModel = buildViewModel(api)

        viewModel.onPhoneNumberChange("+15551234567")
        viewModel.sendCode()

        assertEquals("Too many requests", viewModel.uiState.value.errorMessage)
        assertFalse(viewModel.uiState.value.isSubmitting)
    }

    @Test
    fun `a transport-level failure surfaces a generic error and does not crash`() =
        runTest(mainDispatcherRule.dispatcher) {
            // AuthRepository.sendCode wraps the call in try/catch — this simulates
            // a real network exception (timeout, no connection), not an HTTP error body.
            val api = FakeAuthApi().apply { sendCodeError = java.io.IOException("no connection") }
            val viewModel = buildViewModel(api)

            viewModel.onPhoneNumberChange("+15551234567")
            viewModel.sendCode()

            assertEquals("no connection", viewModel.uiState.value.errorMessage)
            assertFalse(viewModel.uiState.value.isSubmitting)
        }

    @Test
    fun `submitting a blank phone number is rejected locally without calling the repository`() =
        runTest(mainDispatcherRule.dispatcher) {
            val api = FakeAuthApi()
            val viewModel = buildViewModel(api)

            viewModel.sendCode()

            assertNull(api.lastSendCodeRequest)
            assertEquals("Enter your phone number.", viewModel.uiState.value.errorMessage)
        }
}
