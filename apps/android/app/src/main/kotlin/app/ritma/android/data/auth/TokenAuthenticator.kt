package app.ritma.android.data.auth

import javax.inject.Inject
import javax.inject.Provider
import javax.inject.Singleton
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import okhttp3.Authenticator
import okhttp3.Request
import okhttp3.Response
import okhttp3.Route

/**
 * Handles a `401` by refreshing the token pair — exactly once per
 * genuinely expired token, even when multiple requests hit `401`
 * concurrently. The server's refresh tokens are single-use (rotated on
 * every call), so two independent refresh attempts racing on the same
 * stored refresh token would strand the second caller with an
 * already-invalidated token and force a false logout.
 *
 * [refreshMutex] serializes every concurrent [authenticate] call. The
 * first one through actually calls the network; every other one, once it
 * acquires the lock, first checks whether the access token that triggered
 * *its own* `401` is still the one currently stored — if a concurrent
 * caller already refreshed in the meantime, it retries with the newer
 * token instead of spending another network call refreshing again.
 *
 * [authApiProvider] is a [Provider], not [AuthApi] directly, to break the
 * dependency cycle this Authenticator sits in: the [okhttp3.OkHttpClient]
 * needs this Authenticator, and [AuthApi] is built from a
 * [retrofit2.Retrofit] that needs that same OkHttpClient. A `Provider`
 * defers resolving `AuthApi` until [authenticate] actually runs, after the
 * whole dependency graph is already constructed.
 */
@Singleton
class TokenAuthenticator
@Inject
constructor(
    private val tokenStorage: TokenStorage,
    private val authApiProvider: Provider<AuthApi>,
) : Authenticator {

    private val refreshMutex = Mutex()

    override fun authenticate(route: Route?, response: Response): Request? {
        if (responseCount(response) > MAX_RETRY_COUNT) return null

        val failedAccessToken = response.request.header("Authorization")?.removePrefix(BEARER_PREFIX)

        return runBlocking {
            refreshMutex.withLock {
                val current = tokenStorage.read() ?: return@withLock null

                if (failedAccessToken != null && failedAccessToken != current.accessToken) {
                    // A concurrent call already refreshed while this one
                    // waited for the lock — reuse the newer token rather
                    // than refreshing again.
                    return@withLock authorizedRequest(response.request, current.accessToken)
                }

                val refreshed =
                    try {
                        authApiProvider.get().refresh(RefreshRequest(current.refreshToken))
                    } catch (e: Exception) {
                        null
                    }

                if (refreshed == null) {
                    tokenStorage.clear()
                    return@withLock null
                }

                tokenStorage.save(AuthTokens(refreshed.accessToken, refreshed.refreshToken))
                authorizedRequest(response.request, refreshed.accessToken)
            }
        }
    }

    private fun authorizedRequest(request: Request, accessToken: String): Request =
        request.newBuilder().header("Authorization", "$BEARER_PREFIX$accessToken").build()

    private fun responseCount(response: Response): Int {
        var count = 1
        var prior = response.priorResponse
        while (prior != null) {
            count++
            prior = prior.priorResponse
        }
        return count
    }

    private companion object {
        const val MAX_RETRY_COUNT = 3
        const val BEARER_PREFIX = "Bearer "
    }
}
