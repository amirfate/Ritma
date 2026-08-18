package app.ritma.android.data.auth

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyInfo
import android.security.keystore.KeyProperties
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.GCMParameterSpec
import javax.inject.Inject
import javax.inject.Singleton

private const val ANDROID_KEYSTORE = "AndroidKeyStore"
private const val KEY_ALIAS = "ritma_token_key"
private const val TRANSFORMATION = "AES/GCM/NoPadding"
private const val GCM_TAG_LENGTH_BITS = 128

/**
 * Ciphertext and the GCM IV used to produce it; both are required to
 * decrypt. A plain class, not a data class — `ByteArray` equality/hashCode
 * would be reference-based, not content-based, and nothing here relies on
 * either.
 */
class EncryptedPayload(val ciphertext: ByteArray, val iv: ByteArray)

/**
 * Encrypts token bytes at rest using an AES-256-GCM key held in the Android
 * Keystore — the key material itself is never readable by application code,
 * only usable through the Keystore's `Cipher` API. No user-authentication
 * gate is configured on the key, since tokens must be readable for silent
 * background refresh, not only during active user interaction.
 */
@Singleton
class SecureTokenCipher @Inject constructor() {

    private val keyStore: KeyStore = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }

    private fun getOrCreateKey(): SecretKey {
        (keyStore.getKey(KEY_ALIAS, null) as? SecretKey)?.let { return it }

        val keyGenerator =
            KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEYSTORE)
        val spec =
            KeyGenParameterSpec.Builder(
                    KEY_ALIAS,
                    KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
                )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build()
        keyGenerator.init(spec)
        return keyGenerator.generateKey()
    }

    /**
     * Whether the current runtime reports this key as backed by dedicated
     * secure hardware (a TEE or StrongBox), per
     * [KeyInfo.isInsideSecureHardware]. This is an observed capability, not
     * a guarantee: devices and emulators without such hardware fall back to
     * a software-only Keystore implementation, which still isolates the key
     * from application memory but without hardware backing. Callers must
     * not assume `true`.
     */
    fun isHardwareBacked(): Boolean {
        val key = getOrCreateKey()
        val factory = SecretKeyFactory.getInstance(key.algorithm, ANDROID_KEYSTORE)
        val keyInfo = factory.getKeySpec(key, KeyInfo::class.java) as KeyInfo
        return keyInfo.isInsideSecureHardware
    }

    fun encrypt(plaintext: ByteArray): EncryptedPayload {
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.ENCRYPT_MODE, getOrCreateKey())
        val ciphertext = cipher.doFinal(plaintext)
        return EncryptedPayload(ciphertext = ciphertext, iv = cipher.iv)
    }

    fun decrypt(payload: EncryptedPayload): ByteArray {
        val cipher = Cipher.getInstance(TRANSFORMATION)
        val spec = GCMParameterSpec(GCM_TAG_LENGTH_BITS, payload.iv)
        cipher.init(Cipher.DECRYPT_MODE, getOrCreateKey(), spec)
        return cipher.doFinal(payload.ciphertext)
    }
}
