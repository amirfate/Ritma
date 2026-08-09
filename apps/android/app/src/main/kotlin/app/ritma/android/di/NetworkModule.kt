package app.ritma.android.di

import app.ritma.android.BuildConfig
import app.ritma.android.data.auth.AuthApi
import app.ritma.android.data.auth.AuthInterceptor
import app.ritma.android.data.auth.TokenAuthenticator
import app.ritma.android.data.catalog.CatalogApi
import app.ritma.android.data.playback.PlaybackApi
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory

/**
 * Base networking plumbing, plus wiring the auth mechanism ([AuthInterceptor]
 * for attaching the current access token, [TokenAuthenticator] for
 * refresh-on-401) into the one shared [OkHttpClient] instance every API
 * call goes through. Media3 streaming (Phase 5) reuses this same client
 * rather than a second, divergent auth path.
 */
@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {

    @Provides
    @Singleton
    fun provideJson(): Json = Json { ignoreUnknownKeys = true }

    @Provides
    @Singleton
    fun provideOkHttpClient(
        authInterceptor: AuthInterceptor,
        tokenAuthenticator: TokenAuthenticator,
    ): OkHttpClient {
        val builder =
            OkHttpClient.Builder().addInterceptor(authInterceptor).authenticator(tokenAuthenticator)
        if (BuildConfig.DEBUG) {
            // BASIC only — method, URL, and response code, never headers or
            // bodies, so a bearer token or OTP code can never reach Logcat
            // (matches the same never-log-secrets discipline as the API's
            // own @ritma/logger redaction rules).
            val logging = HttpLoggingInterceptor()
            logging.level = HttpLoggingInterceptor.Level.BASIC
            builder.addInterceptor(logging)
        }
        return builder.build()
    }

    @Provides
    @Singleton
    fun provideRetrofit(okHttpClient: OkHttpClient, json: Json): Retrofit {
        val contentType = "application/json".toMediaType()
        return Retrofit.Builder()
            .baseUrl(BuildConfig.API_BASE_URL)
            .client(okHttpClient)
            .addConverterFactory(json.asConverterFactory(contentType))
            .build()
    }

    @Provides
    @Singleton
    fun provideAuthApi(retrofit: Retrofit): AuthApi = retrofit.create(AuthApi::class.java)

    @Provides
    @Singleton
    fun provideCatalogApi(retrofit: Retrofit): CatalogApi = retrofit.create(CatalogApi::class.java)

    @Provides
    @Singleton
    fun providePlaybackApi(retrofit: Retrofit): PlaybackApi = retrofit.create(PlaybackApi::class.java)
}
