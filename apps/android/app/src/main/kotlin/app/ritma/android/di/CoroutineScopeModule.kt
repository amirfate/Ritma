package app.ritma.android.di

import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Qualifier
import javax.inject.Singleton
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob

/**
 * Marks the process-lifetime [CoroutineScope] below, as opposed to a
 * `ViewModel`'s `viewModelScope`. Needed specifically for best-effort
 * cleanup calls (e.g. ending a playback session) that must still run
 * during `ViewModel.onCleared()`, at which point `viewModelScope` is
 * already cancelled and cannot launch new coroutines.
 */
@Qualifier @Retention(AnnotationRetention.BINARY) annotation class ApplicationScope

@Module
@InstallIn(SingletonComponent::class)
object CoroutineScopeModule {

    @Provides
    @Singleton
    @ApplicationScope
    fun provideApplicationScope(): CoroutineScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
}
