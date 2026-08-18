package app.ritma.android.data.playback

import androidx.annotation.OptIn
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.DataSource
import androidx.media3.datasource.okhttp.OkHttpDataSource
import javax.inject.Inject
import javax.inject.Singleton
import okhttp3.OkHttpClient

/**
 * Builds the [DataSource.Factory] ExoPlayer reads the FLAC stream through.
 * Deliberately wraps the exact same [OkHttpClient] singleton provided by
 * `NetworkModule` (Phase 3) — not a second client — so the stream request
 * carries the `Authorization` header via
 * [app.ritma.android.data.auth.AuthInterceptor] and gets transparently
 * retried on 401 via [app.ritma.android.data.auth.TokenAuthenticator],
 * exactly like every Retrofit call. Range requests for seeking are never
 * constructed here: [OkHttpDataSource] issues them itself as standard
 * Media3 `DataSource` behavior.
 */
@Singleton
class PlaybackDataSourceFactory @Inject constructor(private val okHttpClient: OkHttpClient) {

    @OptIn(UnstableApi::class) fun create(): DataSource.Factory = OkHttpDataSource.Factory(okHttpClient)
}
