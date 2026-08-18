package app.ritma.android.data.auth

import android.content.Context
import android.util.Base64
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import dagger.hilt.android.qualifiers.ApplicationContext
import java.security.GeneralSecurityException
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.flow.first

private val Context.secureTokenDataStore: DataStore<Preferences> by
    preferencesDataStore(name = "secure_tokens")

data class AuthTokens(val accessToken: String, val refreshToken: String)

/** Storage abstraction for the access/refresh token pair — see [TokenStore] for the real implementation. */
interface TokenStorage {
    suspend fun save(tokens: AuthTokens)

    /**
     * Returns the stored tokens, or `null` if none are stored *or* the
     * stored record could not be decrypted/parsed (corrupted ciphertext,
     * an invalid GCM authentication tag, a permanently invalidated
     * Keystore key, or a malformed persisted payload). Every one of these
     * failure modes is treated identically, as "no valid session" — never
     * as an uncaught crash — because none of them are recoverable without
     * the user authenticating again.
     */
    suspend fun read(): AuthTokens?

    suspend fun clear()
}

/**
 * Persists the access/refresh token pair encrypted at rest via
 * [SecureTokenCipher] (Android Keystore-backed AES-256-GCM) — DataStore
 * only ever stores ciphertext and an IV, never a plaintext token.
 */
@Singleton
class TokenStore
@Inject
constructor(
    @ApplicationContext private val context: Context,
    private val cipher: SecureTokenCipher,
) : TokenStorage {

    override suspend fun save(tokens: AuthTokens) {
        context.secureTokenDataStore.edit { prefs ->
            prefs[ACCESS_TOKEN_KEY] = encode(cipher.encrypt(tokens.accessToken.toByteArray()))
            prefs[REFRESH_TOKEN_KEY] = encode(cipher.encrypt(tokens.refreshToken.toByteArray()))
        }
    }

    override suspend fun read(): AuthTokens? {
        return try {
            val prefs = context.secureTokenDataStore.data.first()
            val accessEncoded = prefs[ACCESS_TOKEN_KEY] ?: return null
            val refreshEncoded = prefs[REFRESH_TOKEN_KEY] ?: return null
            val accessToken = String(cipher.decrypt(decode(accessEncoded)))
            val refreshToken = String(cipher.decrypt(decode(refreshEncoded)))
            AuthTokens(accessToken, refreshToken)
        } catch (e: GeneralSecurityException) {
            // Corrupted ciphertext, a failed GCM authentication tag check,
            // or a permanently invalidated Keystore key all surface here
            // (KeyPermanentlyInvalidatedException is a GeneralSecurityException
            // subtype). None are recoverable — clear the unreadable record
            // so it doesn't keep failing on every future read.
            clear()
            null
        } catch (e: IllegalArgumentException) {
            // Malformed Base64 in a persisted value.
            clear()
            null
        } catch (e: IndexOutOfBoundsException) {
            // A persisted value missing the IV/ciphertext separator.
            clear()
            null
        }
    }

    override suspend fun clear() {
        context.secureTokenDataStore.edit { it.clear() }
    }

    private fun encode(payload: EncryptedPayload): String {
        val iv = Base64.encodeToString(payload.iv, Base64.NO_WRAP)
        val ciphertext = Base64.encodeToString(payload.ciphertext, Base64.NO_WRAP)
        return "$iv$IV_CIPHERTEXT_SEPARATOR$ciphertext"
    }

    private fun decode(value: String): EncryptedPayload {
        val (ivPart, ciphertextPart) = value.split(IV_CIPHERTEXT_SEPARATOR, limit = 2)
        return EncryptedPayload(
            iv = Base64.decode(ivPart, Base64.NO_WRAP),
            ciphertext = Base64.decode(ciphertextPart, Base64.NO_WRAP),
        )
    }

    private companion object {
        val ACCESS_TOKEN_KEY = stringPreferencesKey("access_token")
        val REFRESH_TOKEN_KEY = stringPreferencesKey("refresh_token")
        const val IV_CIPHERTEXT_SEPARATOR = ":"
    }
}
