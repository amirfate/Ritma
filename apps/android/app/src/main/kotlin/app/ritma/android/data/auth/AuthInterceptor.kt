package app.ritma.android.data.auth

import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.runBlocking
import okhttp3.Interceptor
import okhttp3.Response

/**
 * Attaches the currently stored access token to every outgoing request, if
 * one exists. OkHttp interceptors run synchronously off the caller's
 * thread, so reading the (suspend, DataStore-backed) token store here
 * necessarily blocks via [runBlocking] — the standard bridge for this
 * exact OkHttp + coroutine-based storage combination.
 */
@Singleton
class AuthInterceptor @Inject constructor(private val tokenStorage: TokenStorage) : Interceptor {

    override fun intercept(chain: Interceptor.Chain): Response {
        val original = chain.request()
        val tokens = runBlocking { tokenStorage.read() }
        val request =
            if (tokens != null) {
                original.newBuilder().header("Authorization", "Bearer ${tokens.accessToken}").build()
            } else {
                original
            }
        return chain.proceed(request)
    }
}
