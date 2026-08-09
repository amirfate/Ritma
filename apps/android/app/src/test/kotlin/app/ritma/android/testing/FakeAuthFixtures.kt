package app.ritma.android.testing

import app.ritma.android.data.auth.AuthApi
import app.ritma.android.data.auth.AuthTokens
import app.ritma.android.data.auth.AuthUser
import app.ritma.android.data.auth.DeviceFingerprintSource
import app.ritma.android.data.auth.MeResponse
import app.ritma.android.data.auth.RefreshRequest
import app.ritma.android.data.auth.RefreshResponse
import app.ritma.android.data.auth.SendCodeRequest
import app.ritma.android.data.auth.SendCodeResponse
import app.ritma.android.data.auth.TokenStorage
import app.ritma.android.data.auth.UserRole
import app.ritma.android.data.auth.VerifyRequest
import app.ritma.android.data.auth.VerifyResponse
import okhttp3.ResponseBody
import retrofit2.Response

/** Shared fake for tests that exercise `AuthRepository`/auth `ViewModel`s without a real network or Retrofit backend. */
class FakeAuthApi : AuthApi {
    var sendCodeResponse: Response<ResponseBody> = jsonResponse(200, SendCodeResponse(cooldownSeconds = 30))
    var verifyResponse: Response<ResponseBody> =
        jsonResponse(
            200,
            VerifyResponse(
                accessToken = "access",
                refreshToken = "refresh",
                user = AuthUser(id = "user-1", phoneNumber = "+10000000000", role = UserRole.LISTENER),
            ),
        )
    var refreshResponse: RefreshResponse = RefreshResponse(accessToken = "new-access", refreshToken = "new-refresh")
    var refreshError: Throwable? = null
    var meResponse: MeResponse? = null
    var meError: Throwable? = null
    var logoutError: Throwable? = null

    /** Set to simulate a transport-level failure (timeout, no connection, ...) rather than an HTTP error response. */
    var sendCodeError: Throwable? = null
    var verifyError: Throwable? = null

    var refreshCallCount = 0
        private set

    var logoutCallCount = 0
        private set

    var lastSendCodeRequest: SendCodeRequest? = null
        private set

    var lastVerifyRequest: VerifyRequest? = null
        private set

    override suspend fun sendCode(request: SendCodeRequest): Response<ResponseBody> {
        lastSendCodeRequest = request
        sendCodeError?.let { throw it }
        return sendCodeResponse
    }

    override suspend fun verify(request: VerifyRequest): Response<ResponseBody> {
        lastVerifyRequest = request
        verifyError?.let { throw it }
        return verifyResponse
    }

    override suspend fun refresh(request: RefreshRequest): RefreshResponse {
        refreshCallCount++
        refreshError?.let { throw it }
        return refreshResponse
    }

    override suspend fun logout() {
        logoutCallCount++
        logoutError?.let { throw it }
    }

    override suspend fun me(): MeResponse {
        meError?.let { throw it }
        return meResponse ?: error("meResponse not configured")
    }
}

class FakeTokenStorage(initial: AuthTokens? = null) : TokenStorage {
    @Volatile private var current: AuthTokens? = initial

    override suspend fun save(tokens: AuthTokens) {
        current = tokens
    }

    override suspend fun read(): AuthTokens? = current

    override suspend fun clear() {
        current = null
    }
}

class FakeDeviceFingerprintSource(private val fingerprint: String = "test-fingerprint") : DeviceFingerprintSource {
    override suspend fun getOrCreate(): String = fingerprint
}
