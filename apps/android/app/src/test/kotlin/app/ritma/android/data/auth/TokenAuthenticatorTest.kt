package app.ritma.android.data.auth

import java.util.concurrent.TimeUnit
import javax.inject.Provider
import kotlinx.coroutines.delay
import kotlinx.coroutines.runBlocking
import okhttp3.Protocol
import okhttp3.Request
import okhttp3.Response
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test

private class FakeTokenStorage(initial: AuthTokens?) : TokenStorage {
    @Volatile private var current: AuthTokens? = initial

    override suspend fun save(tokens: AuthTokens) {
        current = tokens
    }

    override suspend fun read(): AuthTokens? = current

    override suspend fun clear() {
        current = null
    }
}

/** Only [refresh] is exercised by [TokenAuthenticator] in these tests. */
private open class FakeAuthApi(private val refreshDelayMs: Long) : AuthApi {
    var refreshCallCount = 0
        private set

    override suspend fun sendCode(request: SendCodeRequest) = error("not used in this test")

    override suspend fun verify(request: VerifyRequest) = error("not used in this test")

    override suspend fun refresh(request: RefreshRequest): RefreshResponse {
        val call = synchronized(this) { ++refreshCallCount }
        delay(refreshDelayMs)
        return RefreshResponse(accessToken = "new-access-$call", refreshToken = "new-refresh-$call")
    }

    override suspend fun logout() = error("not used in this test")

    override suspend fun me() = error("not used in this test")
}

private fun unauthorizedResponse(accessToken: String): Response {
    val request =
        Request.Builder()
            .url("http://test.local/resource")
            .header("Authorization", "Bearer $accessToken")
            .build()
    return Response.Builder()
        .request(request)
        .protocol(Protocol.HTTP_1_1)
        .code(401)
        .message("Unauthorized")
        .build()
}

private fun chainedUnauthorizedResponse(prior: Response): Response =
    Response.Builder()
        .request(prior.request)
        .protocol(Protocol.HTTP_1_1)
        .code(401)
        .message("Unauthorized")
        .priorResponse(prior)
        .build()

class TokenAuthenticatorTest {

    /**
     * Genuine OS threads, not coroutine `async {}` blocks — a
     * single-threaded coroutine test dispatcher would serialize the two
     * calls cooperatively regardless of whether the mutex actually works,
     * which would let a broken (unsynchronized) implementation pass by
     * accident. Real threads are the only way to actually prove the race
     * protection this test exists to verify.
     */
    @Test
    fun `two concurrent 401s for the same access token trigger exactly one refresh call`() {
        val tokenStorage = FakeTokenStorage(AuthTokens("old-access", "old-refresh"))
        val fakeApi = FakeAuthApi(refreshDelayMs = 100)
        val authenticator = TokenAuthenticator(tokenStorage, Provider { fakeApi })
        val response = unauthorizedResponse("old-access")

        val results = arrayOfNulls<Request>(2)
        val threads =
            List(2) { index -> Thread { results[index] = authenticator.authenticate(null, response) } }
        threads.forEach { it.start() }
        threads.forEach { it.join(TimeUnit.SECONDS.toMillis(5)) }

        assertEquals(
            "the second concurrent 401 must not spend its own network refresh call",
            1,
            fakeApi.refreshCallCount,
        )
        assertNotNull(results[0])
        assertNotNull(results[1])
        assertEquals("Bearer new-access-1", results[0]?.header("Authorization"))
        assertEquals("Bearer new-access-1", results[1]?.header("Authorization"))
    }

    @Test
    fun `a request whose failed token is already stale is retried without refreshing`() = runBlocking {
        // Simulates a 401 that was already in flight when a different
        // request's refresh completed and saved a newer token.
        val tokenStorage =
            FakeTokenStorage(AuthTokens("already-refreshed-access", "already-refreshed-refresh"))
        val fakeApi = FakeAuthApi(refreshDelayMs = 0)
        val authenticator = TokenAuthenticator(tokenStorage, Provider { fakeApi })
        val response = unauthorizedResponse("stale-access")

        val result = authenticator.authenticate(null, response)

        assertEquals(0, fakeApi.refreshCallCount)
        assertEquals("Bearer already-refreshed-access", result?.header("Authorization"))
    }

    @Test
    fun `a failed refresh clears the token store and returns null`() = runBlocking {
        val tokenStorage = FakeTokenStorage(AuthTokens("old-access", "old-refresh"))
        val failingApi =
            object : FakeAuthApi(0) {
                override suspend fun refresh(request: RefreshRequest): RefreshResponse =
                    throw IllegalStateException("refresh failed")
            }
        val authenticator = TokenAuthenticator(tokenStorage, Provider { failingApi })
        val response = unauthorizedResponse("old-access")

        val result = authenticator.authenticate(null, response)

        assertNull(result)
        assertNull(tokenStorage.read())
    }

    @Test
    fun `a successful refresh persists the rotated token pair, not the old one`() = runBlocking {
        val tokenStorage = FakeTokenStorage(AuthTokens("old-access", "old-refresh"))
        val fakeApi = FakeAuthApi(refreshDelayMs = 0)
        val authenticator = TokenAuthenticator(tokenStorage, Provider { fakeApi })
        val response = unauthorizedResponse("old-access")

        authenticator.authenticate(null, response)

        val persisted = tokenStorage.read()
        assertEquals("new-access-1", persisted?.accessToken)
        assertEquals("new-refresh-1", persisted?.refreshToken)
    }

    @Test
    fun `exceeding the retry limit stops without attempting another refresh`() {
        val tokenStorage = FakeTokenStorage(AuthTokens("old-access", "old-refresh"))
        val fakeApi = FakeAuthApi(refreshDelayMs = 0)
        val authenticator = TokenAuthenticator(tokenStorage, Provider { fakeApi })

        var response = unauthorizedResponse("old-access")
        repeat(4) { response = chainedUnauthorizedResponse(response) }

        val result = authenticator.authenticate(null, response)

        assertNull(result)
        assertEquals(0, fakeApi.refreshCallCount)
    }
}
