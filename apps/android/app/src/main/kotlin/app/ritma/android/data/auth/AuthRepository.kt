package app.ritma.android.data.auth

import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.json.Json
import okhttp3.ResponseBody
import retrofit2.Response

/** Outcome of `POST /auth/send-code` — mirrors the audited API's per-status-code response shapes. */
sealed interface SendCodeOutcome {
    data class Sent(val cooldownSeconds: Int) : SendCodeOutcome

    data class RateLimited(val message: String, val retryAfterSeconds: Int?) : SendCodeOutcome

    data class Failed(val message: String) : SendCodeOutcome
}

/**
 * Outcome of `POST /auth/verify`. `Waitlisted` (the API's `202` response)
 * is a distinct, non-error business state — the OTP was valid and the
 * invitation was genuine, but the beta was at capacity — never collapsed
 * into `Failed`.
 */
sealed interface VerifyOutcome {
    data class Success(val tokens: AuthTokens, val user: AuthUser) : VerifyOutcome

    data class Waitlisted(val message: String) : VerifyOutcome

    data class Rejected(val message: String) : VerifyOutcome

    data class Failed(val message: String) : VerifyOutcome
}

/**
 * Owns the OTP send/verify flow, session persistence, and logout — the
 * single place that knows how to turn the auth endpoints' per-status-code
 * response shapes (audited against the locked M5 API) into typed outcomes.
 */
@Singleton
class AuthRepository
@Inject
constructor(
    private val authApi: AuthApi,
    private val tokenStorage: TokenStorage,
    private val deviceFingerprintProvider: DeviceFingerprintSource,
    private val json: Json,
) {

    suspend fun sendCode(phoneNumber: String): SendCodeOutcome {
        return try {
            val response = authApi.sendCode(SendCodeRequest(phoneNumber))
            when (response.code()) {
                200 -> SendCodeOutcome.Sent(decode<SendCodeResponse>(response).cooldownSeconds)
                429 -> {
                    val body = decode<AuthErrorBody>(response)
                    SendCodeOutcome.RateLimited(body.message, body.retryAfterSeconds)
                }
                else -> SendCodeOutcome.Failed(errorMessage(response))
            }
        } catch (e: Exception) {
            SendCodeOutcome.Failed(e.message ?: "Network error")
        }
    }

    suspend fun verify(
        phoneNumber: String,
        code: String,
        invitationCode: String?,
        deviceLabel: String? = null,
    ): VerifyOutcome {
        return try {
            val fingerprint = deviceFingerprintProvider.getOrCreate()
            val request =
                VerifyRequest(
                    phoneNumber = phoneNumber,
                    code = code,
                    deviceFingerprint = fingerprint,
                    deviceLabel = deviceLabel,
                    invitationCode = invitationCode,
                )
            val response = authApi.verify(request)
            when (response.code()) {
                200 -> {
                    val body = decode<VerifyResponse>(response)
                    val tokens = AuthTokens(body.accessToken, body.refreshToken)
                    tokenStorage.save(tokens)
                    VerifyOutcome.Success(tokens, body.user)
                }
                202 -> VerifyOutcome.Waitlisted(decode<BetaWaitlistedBody>(response).message)
                400 -> VerifyOutcome.Rejected(decode<AuthErrorBody>(response).message)
                else -> VerifyOutcome.Failed(errorMessage(response))
            }
        } catch (e: Exception) {
            VerifyOutcome.Failed(e.message ?: "Network error")
        }
    }

    /** Clears local credentials unconditionally — a server-side failure never blocks local logout. */
    suspend fun logout() {
        try {
            authApi.logout()
        } catch (e: Exception) {
            // The server call is best-effort, not a precondition for local logout.
        } finally {
            tokenStorage.clear()
        }
    }

    suspend fun currentUser(): AuthUser? =
        try {
            authApi.me()
        } catch (e: Exception) {
            null
        }

    suspend fun isAuthenticated(): Boolean = tokenStorage.read() != null

    private inline fun <reified T> decode(response: Response<ResponseBody>): T {
        val text = (if (response.isSuccessful) response.body() else response.errorBody())?.string()
        return json.decodeFromString(text ?: "")
    }

    private fun errorMessage(response: Response<ResponseBody>): String =
        runCatching { decode<AuthErrorBody>(response).message }
            .getOrDefault("Unexpected error (${response.code()})")
}
