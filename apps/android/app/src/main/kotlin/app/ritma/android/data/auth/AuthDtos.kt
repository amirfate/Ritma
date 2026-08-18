package app.ritma.android.data.auth

import kotlinx.serialization.Serializable

// Hand-authored Kotlin mirrors of packages/api-contracts/src/auth.ts. This
// repository has no TS-to-Kotlin codegen pipeline, so these must be kept in
// sync manually with the TypeScript contracts and the NestJS DTOs/response
// shapes they describe.

@Serializable enum class UserRole { LISTENER, ARTIST, ADMIN }

@Serializable data class SendCodeRequest(val phoneNumber: String)

@Serializable data class SendCodeResponse(val cooldownSeconds: Int)

/**
 * `invitationCode` is required only when `phoneNumber` has no existing
 * account — a returning user's login never needs one. `devicePlatform` is
 * fixed to `"android"`, the only platform in scope for the beta.
 */
@Serializable
data class VerifyRequest(
    val phoneNumber: String,
    val code: String,
    val deviceFingerprint: String,
    val devicePlatform: String = "android",
    val deviceLabel: String? = null,
    val invitationCode: String? = null,
)

@Serializable data class AuthUser(val id: String, val phoneNumber: String, val role: UserRole)

@Serializable
data class VerifyResponse(val accessToken: String, val refreshToken: String, val user: AuthUser)

@Serializable data class RefreshRequest(val refreshToken: String)

/** The presented refresh token is invalidated on use — this pair replaces it, it does not extend it. */
@Serializable data class RefreshResponse(val accessToken: String, val refreshToken: String)

typealias MeResponse = AuthUser

/** Body of the `202 Accepted` "beta waitlisted" outcome of `POST /auth/verify`. */
@Serializable data class BetaWaitlistedBody(val message: String, val waitlisted: Boolean)

/**
 * The generic `{ message: string }` shape used by every other auth error
 * this app distinguishes (invalid/expired OTP, invitation
 * required/invalid). Rate-limit errors additionally carry
 * `retryAfterSeconds`; nullable because not every `429` includes it — the
 * app-wide default throttle has no such field.
 */
@Serializable data class AuthErrorBody(val message: String, val retryAfterSeconds: Int? = null)
