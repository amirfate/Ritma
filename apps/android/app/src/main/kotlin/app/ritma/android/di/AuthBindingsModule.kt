package app.ritma.android.di

import app.ritma.android.data.auth.DeviceFingerprintProvider
import app.ritma.android.data.auth.DeviceFingerprintSource
import app.ritma.android.data.auth.TokenStorage
import app.ritma.android.data.auth.TokenStore
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent

/** `@Binds` needs an abstract module, so this is separate from the `object NetworkModule`. */
@Module
@InstallIn(SingletonComponent::class)
abstract class AuthBindingsModule {
    @Binds abstract fun bindTokenStorage(impl: TokenStore): TokenStorage

    @Binds abstract fun bindDeviceFingerprintSource(impl: DeviceFingerprintProvider): DeviceFingerprintSource
}
