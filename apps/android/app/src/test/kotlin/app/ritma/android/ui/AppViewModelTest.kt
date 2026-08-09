package app.ritma.android.ui

import app.ritma.android.data.auth.AuthRepository
import app.ritma.android.data.auth.AuthTokens
import app.ritma.android.testing.FakeAuthApi
import app.ritma.android.testing.FakeDeviceFingerprintSource
import app.ritma.android.testing.FakeTokenStorage
import app.ritma.android.testing.MainDispatcherRule
import app.ritma.android.testing.testJson
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test

/**
 * `RitmaApp`'s nav-graph `startDestination` choice itself needs a real
 * Compose host to verify end-to-end (an instrumented concern, out of
 * scope) — this covers the part that's pure logic: whether the auth gate
 * correctly resolves to authenticated/unauthenticated from what's in
 * `TokenStorage`.
 */
class AppViewModelTest {

    @get:Rule val mainDispatcherRule = MainDispatcherRule()

    @Test
    fun `resolves to authenticated when a token is already stored`() {
        val repository =
            AuthRepository(FakeAuthApi(), FakeTokenStorage(AuthTokens("access", "refresh")), FakeDeviceFingerprintSource(), testJson)

        val state = AppViewModel(repository).authGateState.value

        assertEquals(AuthGateState.Resolved(isAuthenticated = true), state)
    }

    @Test
    fun `resolves to unauthenticated when no token is stored`() {
        val repository = AuthRepository(FakeAuthApi(), FakeTokenStorage(null), FakeDeviceFingerprintSource(), testJson)

        val state = AppViewModel(repository).authGateState.value

        assertEquals(AuthGateState.Resolved(isAuthenticated = false), state)
    }
}
