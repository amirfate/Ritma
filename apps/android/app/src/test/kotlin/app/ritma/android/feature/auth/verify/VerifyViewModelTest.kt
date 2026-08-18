package app.ritma.android.feature.auth.verify

import androidx.lifecycle.SavedStateHandle
import app.ritma.android.data.auth.AuthErrorBody
import app.ritma.android.data.auth.AuthRepository
import app.ritma.android.data.auth.AuthUser
import app.ritma.android.data.auth.BetaWaitlistedBody
import app.ritma.android.data.auth.UserRole
import app.ritma.android.data.auth.VerifyResponse
import app.ritma.android.navigation.RitmaDestination
import app.ritma.android.testing.FakeAuthApi
import app.ritma.android.testing.FakeDeviceFingerprintSource
import app.ritma.android.testing.FakeTokenStorage
import app.ritma.android.testing.MainDispatcherRule
import app.ritma.android.testing.jsonResponse
import app.ritma.android.testing.testJson
import java.io.IOException
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Rule
import org.junit.Test

private const val PHONE_NUMBER = "+15551234567"

private fun buildViewModel(api: FakeAuthApi, tokenStorage: FakeTokenStorage = FakeTokenStorage()) =
    VerifyViewModel(
        SavedStateHandle(mapOf(RitmaDestination.Verify.ARG_PHONE_NUMBER to PHONE_NUMBER)),
        AuthRepository(api, tokenStorage, FakeDeviceFingerprintSource(), testJson),
    )

class VerifyViewModelTest {

    @get:Rule val mainDispatcherRule = MainDispatcherRule()

    @Test
    fun `successful verification saves tokens and emits the verified event`() = runTest(mainDispatcherRule.dispatcher) {
        val tokenStorage = FakeTokenStorage()
        val api =
            FakeAuthApi().apply {
                verifyResponse =
                    jsonResponse(
                        200,
                        VerifyResponse(
                            accessToken = "access-1",
                            refreshToken = "refresh-1",
                            user = AuthUser(id = "user-1", phoneNumber = PHONE_NUMBER, role = UserRole.LISTENER),
                        ),
                    )
            }
        val viewModel = buildViewModel(api, tokenStorage)
        var verifiedFired = false
        val collector = launch { viewModel.verifiedEvent.first(); verifiedFired = true }

        viewModel.onCodeChange("123456")
        viewModel.submit()

        assertEquals("access-1", tokenStorage.read()?.accessToken)
        assertEquals("refresh-1", tokenStorage.read()?.refreshToken)
        assertEquals(true, verifiedFired)
        collector.cancel()
    }

    @Test
    fun `a 202 beta-waitlisted response shows the message and does not navigate`() =
        runTest(mainDispatcherRule.dispatcher) {
            val api =
                FakeAuthApi().apply {
                    verifyResponse = jsonResponse(202, BetaWaitlistedBody(message = "You're on the waitlist.", waitlisted = true))
                }
            val viewModel = buildViewModel(api)

            viewModel.onCodeChange("123456")
            viewModel.submit()

            assertEquals("You're on the waitlist.", viewModel.uiState.value.waitlistedMessage)
            assertNull(viewModel.uiState.value.errorMessage)
        }

    @Test
    fun `an invalid code or invitation is rejected with the server's message`() = runTest(mainDispatcherRule.dispatcher) {
        val api = FakeAuthApi().apply { verifyResponse = jsonResponse(400, AuthErrorBody(message = "Invalid code.")) }
        val viewModel = buildViewModel(api)

        viewModel.onCodeChange("000000")
        viewModel.submit()

        assertEquals("Invalid code.", viewModel.uiState.value.errorMessage)
        assertNull(viewModel.uiState.value.waitlistedMessage)
    }

    @Test
    fun `a transport-level failure surfaces a generic error and does not crash`() =
        runTest(mainDispatcherRule.dispatcher) {
            val api = FakeAuthApi().apply { verifyError = IOException("no connection") }
            val viewModel = buildViewModel(api)

            viewModel.onCodeChange("123456")
            viewModel.submit()

            assertEquals("no connection", viewModel.uiState.value.errorMessage)
        }

    @Test
    fun `submitting a blank code is rejected locally without calling the repository`() =
        runTest(mainDispatcherRule.dispatcher) {
            val api = FakeAuthApi()
            val viewModel = buildViewModel(api)

            viewModel.submit()

            assertNull(api.lastVerifyRequest)
            assertNotNull(viewModel.uiState.value.errorMessage)
        }
}
