package app.ritma.android.data.auth

import okhttp3.ResponseBody
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST

/**
 * Mirrors the auth routes audited against the locked M5 API.
 * `sendCode`/`verify` return the raw body because their success/error
 * shapes differ by status code (`200` vs `202` vs `400`/`429`) — see
 * [AuthRepository] for how each is decoded. `refresh`/`me` return typed
 * bodies directly since they only ever have one success shape; Retrofit
 * throws on a non-2xx response for those, which callers catch.
 */
interface AuthApi {
    @POST("auth/send-code") suspend fun sendCode(@Body request: SendCodeRequest): Response<ResponseBody>

    @POST("auth/verify") suspend fun verify(@Body request: VerifyRequest): Response<ResponseBody>

    @POST("auth/refresh") suspend fun refresh(@Body request: RefreshRequest): RefreshResponse

    @POST("auth/logout") suspend fun logout()

    @GET("auth/me") suspend fun me(): MeResponse
}
