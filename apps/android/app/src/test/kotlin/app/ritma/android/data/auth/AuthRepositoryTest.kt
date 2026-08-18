package app.ritma.android.data.auth

import app.ritma.android.testing.FakeAuthApi
import app.ritma.android.testing.FakeDeviceFingerprintSource
import app.ritma.android.testing.FakeTokenStorage
import app.ritma.android.testing.jsonResponse
import app.ritma.android.testing.testJson
import java.io.IOException
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Covers `AuthRepository` behavior not already exercised indirectly through
 * `LoginViewModelTest`/`VerifyViewModelTest` — token persistence on
 * success, logout's clear-even-on-failure guarantee, and the
 * session-presence checks other screens rely on. Concurrent-refresh
 * single-flight behavior is `TokenAuthenticator`'s responsibility, already
 * covered by `TokenAuthenticatorTest` — not duplicated here.
 */
class AuthRepositoryTest {

    @Test
    fun `a successful verify persists and returns the token pair`() = runTest {
        val tokenStorage = FakeTokenStorage()
        val api =
            FakeAuthApi().apply {
                verifyResponse =
                    jsonResponse(
                        200,
                        VerifyResponse(
                            accessToken = "access-1",
                            refreshToken = "refresh-1",
                            user = AuthUser(id = "user-1", phoneNumber = "+15551234567", role = UserRole.LISTENER),
                        ),
                    )
            }
        val repository = AuthRepository(api, tokenStorage, FakeDeviceFingerprintSource(), testJson)

        val outcome = repository.verify(phoneNumber = "+15551234567", code = "123456", invitationCode = null)

        check(outcome is VerifyOutcome.Success)
        assertEquals(AuthTokens("access-1", "refresh-1"), outcome.tokens)
        assertEquals(AuthTokens("access-1", "refresh-1"), tokenStorage.read())
    }

    @Test
    fun `logout clears local tokens even when the server call fails`() = runTest {
        val tokenStorage = FakeTokenStorage(initial = AuthTokens("access", "refresh"))
        val api = FakeAuthApi().apply { logoutError = IOException("server unreachable") }
        val repository = AuthRepository(api, tokenStorage, FakeDeviceFingerprintSource(), testJson)

        repository.logout()

        assertEquals(1, api.logoutCallCount)
        assertNull(tokenStorage.read())
    }

    @Test
    fun `isAuthenticated reflects whether a token is currently stored`() = runTest {
        val api = FakeAuthApi()
        val authenticated = AuthRepository(api, FakeTokenStorage(AuthTokens("a", "r")), FakeDeviceFingerprintSource(), testJson)
        val unauthenticated = AuthRepository(api, FakeTokenStorage(null), FakeDeviceFingerprintSource(), testJson)

        assertTrue(authenticated.isAuthenticated())
        assertFalse(unauthenticated.isAuthenticated())
    }

    @Test
    fun `currentUser returns null when the me endpoint fails instead of throwing`() = runTest {
        val api = FakeAuthApi().apply { meError = IOException("expired session") }
        val repository = AuthRepository(api, FakeTokenStorage(), FakeDeviceFingerprintSource(), testJson)

        val user = repository.currentUser()

        assertNull(user)
    }
}
