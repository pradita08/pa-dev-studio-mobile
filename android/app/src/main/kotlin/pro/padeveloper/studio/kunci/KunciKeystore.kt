package pro.padeveloper.studio.kunci

import android.content.Context
import android.content.pm.PackageManager
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyPermanentlyInvalidatedException
import android.security.keystore.KeyProperties
import android.security.keystore.StrongBoxUnavailableException
import android.security.keystore.UserNotAuthenticatedException
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.PrivateKey
import java.security.Signature
import java.security.spec.ECGenParameterSpec

/**
 * Kunci tanda tangan HP di Android Keystore (kontrak §2, SEC-44):
 * EC P-256 / SHA256withECDSA, non-ekspor, StrongBox bila ada (jatuh ke TEE), setUnlockedDeviceRequired,
 * setInvalidatedByBiometricEnrollment, atestasi dengan challenge dari QR.
 *  - K_rencana : otentikasi ≤ 300 dtk, BIOMETRIC_STRONG | DEVICE_CREDENTIAL.
 *  - K_kerjakan: otentikasi per pemakaian (timeout 0), BIOMETRIC_STRONG saja → BiometricPrompt + CryptoObject;
 *    G3 mode sesi: bila QR membawa petunjuk `kerjakan_pin`, ≤ 300 dtk BIOMETRIC_STRONG | DEVICE_CREDENTIAL (sama dengan K_rencana;
 *    terbuka oleh sidik jari/PIN terakhir, termasuk membuka kunci layar). Petunjuk saja — Mac memutuskan dari atestasi
 *    (userAuthType 2 + timeout 0 vs 3 + 1..300). Tanpa setUserAuthenticationValidWhileOnBody (SEC-122).
 */
object KunciKeystore {
    const val RENCANA = "padev_k_rencana"
    const val KERJAKAN = "padev_k_kerjakan"
    const val UJI_RENCANA = "padev_uji_rencana"
    const val UJI_KERJAKAN = "padev_uji_kerjakan"
    const val MASA_RENCANA_DTK = 300

    class Info(val alias: String, val spki: ByteArray, val rantai: List<ByteArray>, val strongBox: Boolean) {
        val id: String get() = Kripto.idKunciEcdsa(spki)
    }

    private fun ks(): KeyStore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }

    fun adaStrongBox(context: Context): Boolean =
        context.packageManager.hasSystemFeature(PackageManager.FEATURE_STRONGBOX_KEYSTORE)

    fun buat(context: Context, alias: String, kerjakan: Boolean, tantangan: ByteArray, pin: Boolean = false): Info {
        hapus(alias)
        fun spec(strongBox: Boolean): KeyGenParameterSpec {
            val b = KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_SIGN)
                .setAlgorithmParameterSpec(ECGenParameterSpec("secp256r1"))
                .setDigests(KeyProperties.DIGEST_SHA256)
                .setUserAuthenticationRequired(true)
                .setInvalidatedByBiometricEnrollment(true)
                .setUnlockedDeviceRequired(true)
                .setAttestationChallenge(tantangan)
                .setIsStrongBoxBacked(strongBox)
            if (kerjakan) {
                val (masa, auth) = parameterKerjakan(pin)
                b.setUserAuthenticationParameters(masa, auth)
            } else {
                b.setUserAuthenticationParameters(MASA_RENCANA_DTK, KeyProperties.AUTH_BIOMETRIC_STRONG or KeyProperties.AUTH_DEVICE_CREDENTIAL)
            }
            return b.build()
        }
        val kpg = KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_EC, "AndroidKeyStore")
        var strongBox = adaStrongBox(context)
        try {
            try {
                kpg.initialize(spec(strongBox))
                kpg.generateKeyPair()
            } catch (e: StrongBoxUnavailableException) {
                strongBox = false
                kpg.initialize(spec(false))
                kpg.generateKeyPair()
            }
        } catch (e: IllegalStateException) {
            // "Secure lock screen must be enabled" / "At least one biometric must be enrolled"
            throw GalatKunci(if (kerjakan && !pin) "biometrik_belum_ada" else "tanpa_kunci_layar")
        } catch (e: java.security.InvalidAlgorithmParameterException) {
            throw GalatKunci(if (kerjakan && !pin) "biometrik_belum_ada" else "tanpa_kunci_layar")
        }
        return info(alias, strongBox) ?: throw GalatKunci("kunci_gagal")
    }

    /** S-G3-5: (masa dtk, authenticator KeyProperties) K_kerjakan — `pin` (mode sesi) → 300 + BIO|DEVCRED (userAuthType 3), lainnya 0 + BIO (2). */
    fun parameterKerjakan(pin: Boolean): Pair<Int, Int> =
        if (pin) MASA_RENCANA_DTK to (KeyProperties.AUTH_BIOMETRIC_STRONG or KeyProperties.AUTH_DEVICE_CREDENTIAL)
        else 0 to KeyProperties.AUTH_BIOMETRIC_STRONG

    fun info(alias: String, strongBox: Boolean = false): Info? {
        val k = ks()
        val sert = k.getCertificate(alias) ?: return null
        val rantai = k.getCertificateChain(alias)?.map { it.encoded } ?: emptyList()
        return Info(alias, sert.publicKey.encoded, rantai, strongBox)
    }

    fun ada(alias: String): Boolean = ks().containsAlias(alias)

    fun hapus(alias: String) {
        val k = ks()
        if (k.containsAlias(alias)) k.deleteEntry(alias)
    }

    private fun privat(alias: String): PrivateKey =
        ks().getKey(alias, null) as? PrivateKey ?: throw GalatKunci("kunci_tidak_ada")

    /**
     * Signature siap pakai. K_rencana & K_kerjakan mode sesi: melempar [PerluOtentikasi] bila masa otentikasi habis (pemanggil
     * menampilkan BiometricPrompt lalu mengulang). K_kerjakan sidik jari: Signature ini dibungkus CryptoObject untuk BiometricPrompt.
     */
    fun signature(alias: String): Signature {
        val s = Signature.getInstance("SHA256withECDSA")
        try {
            s.initSign(privat(alias))
        } catch (e: UserNotAuthenticatedException) {
            throw PerluOtentikasi()
        } catch (e: KeyPermanentlyInvalidatedException) {
            throw GalatKunci("kunci_tidak_berlaku")
        }
        return s
    }

    class PerluOtentikasi : Exception("perlu otentikasi")
}
