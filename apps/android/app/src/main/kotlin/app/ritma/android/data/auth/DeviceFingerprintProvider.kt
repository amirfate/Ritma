package app.ritma.android.data.auth

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import dagger.hilt.android.qualifiers.ApplicationContext
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.flow.first

private val Context.deviceDataStore: DataStore<Preferences> by preferencesDataStore(name = "device")

/**
 * Extracted for the same reason as [TokenStorage]/[TokenStore]: it lets
 * [AuthRepository] be unit-tested with a fake, without needing a real
 * Android `Context` to construct a DataStore-backed instance.
 */
interface DeviceFingerprintSource {
    suspend fun getOrCreate(): String
}

/**
 * A stable per-install identifier sent as `deviceFingerprint` on every
 * `/auth/verify` call. The API never issues or returns one — this is
 * generated once, locally, and reused for the lifetime of the app install.
 * Not a credential, so unlike [TokenStore] this is stored in plain
 * DataStore.
 */
@Singleton
class DeviceFingerprintProvider @Inject constructor(@ApplicationContext private val context: Context) :
    DeviceFingerprintSource {

    override suspend fun getOrCreate(): String {
        val existing = context.deviceDataStore.data.first()[FINGERPRINT_KEY]
        if (existing != null) return existing

        val fingerprint = UUID.randomUUID().toString()
        context.deviceDataStore.edit { it[FINGERPRINT_KEY] = fingerprint }
        return fingerprint
    }

    private companion object {
        val FINGERPRINT_KEY = stringPreferencesKey("device_fingerprint")
    }
}
