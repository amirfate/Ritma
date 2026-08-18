package app.ritma.android.testing

import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.ResponseBody
import okhttp3.ResponseBody.Companion.toResponseBody
import retrofit2.Response

/** Same converter config as `NetworkModule.provideJson()`, kept separate so tests don't need Hilt. */
val testJson: Json = Json { ignoreUnknownKeys = true }

/**
 * Builds a real Retrofit `Response<ResponseBody>` carrying [body] serialized
 * as JSON, the same shape `AuthRepository`/`PlaybackRepository`'s `decode<T>`
 * helpers parse via `response.body()`/`response.errorBody()`. No fake HTTP
 * server needed — `Response.success`/`Response.error` are plain in-memory
 * factories.
 */
inline fun <reified T> jsonResponse(code: Int, body: T): Response<ResponseBody> {
    val responseBody = testJson.encodeToString(body).toResponseBody("application/json".toMediaType())
    return if (code in 200..299) Response.success(code, responseBody) else Response.error(code, responseBody)
}
