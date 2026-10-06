package pro.padeveloper.studio.kunci

import android.content.Context
import android.os.Handler
import android.os.Looper
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricManager.Authenticators.BIOMETRIC_STRONG
import androidx.biometric.BiometricManager.Authenticators.DEVICE_CREDENTIAL
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import java.security.Signature
import java.util.concurrent.CompletableFuture
import java.util.concurrent.TimeUnit

/**
 * BiometricPrompt sistem. Dipanggil dari thread latar; prompt ditampilkan di thread utama dan thread latar menunggu hasil.
 * Teks prompt disusun Kotlin dari nilai yang akan ditandatangani (SEC-51), bukan dari teks bebas Dart.
 */
object Biometrik {
    const val BUKA = BIOMETRIC_STRONG or DEVICE_CREDENTIAL

    fun bisa(context: Context, authenticators: Int): Int = BiometricManager.from(context).canAuthenticate(authenticators)

    class Teks(val judul: String, val subjudul: String? = null, val keterangan: String? = null)

    /** Buka aplikasi / otentikasi K_rencana: sidik jari ATAU kredensial layar (PIN/pola/sandi sistem). */
    fun bukaKunci(aktivitas: FragmentActivity, teks: Teks): Boolean = tampil(aktivitas, teks, BUKA, null) != null

    /** Konfirmasi Kerjakan: BIOMETRIC_STRONG saja, CryptoObject(Signature K_kerjakan). Mengembalikan Signature yang sudah dibuka. */
    fun konfirmasiKerjakan(aktivitas: FragmentActivity, teks: Teks, sig: Signature): Signature? =
        tampil(aktivitas, teks, BIOMETRIC_STRONG, BiometricPrompt.CryptoObject(sig))?.cryptoObject?.signature

    private fun tampil(aktivitas: FragmentActivity, teks: Teks, authenticators: Int, crypto: BiometricPrompt.CryptoObject?): BiometricPrompt.AuthenticationResult? {
        val status = bisa(aktivitas, authenticators)
        if (status != BiometricManager.BIOMETRIC_SUCCESS) {
            throw GalatKunci(
                when (status) {
                    BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED ->
                        if (authenticators == BIOMETRIC_STRONG) "biometrik_belum_ada" else "tanpa_kunci_layar"
                    else -> "biometrik_tidak_tersedia"
                },
            )
        }
        val hasil = CompletableFuture<BiometricPrompt.AuthenticationResult?>()
        Handler(Looper.getMainLooper()).post {
            try {
                val info = BiometricPrompt.PromptInfo.Builder()
                    .setTitle(teks.judul)
                    .apply { teks.subjudul?.let { setSubtitle(it) } }
                    .apply { teks.keterangan?.let { setDescription(it) } }
                    .setAllowedAuthenticators(authenticators)
                    .setConfirmationRequired(true)
                    .apply { if (authenticators == BIOMETRIC_STRONG) setNegativeButtonText("Batal") }
                    .build()
                val prompt = BiometricPrompt(
                    aktivitas, ContextCompat.getMainExecutor(aktivitas),
                    object : BiometricPrompt.AuthenticationCallback() {
                        override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                            hasil.complete(result)
                        }

                        override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                            hasil.complete(null)
                        }
                    },
                )
                if (crypto != null) prompt.authenticate(info, crypto) else prompt.authenticate(info)
            } catch (e: Exception) {
                hasil.complete(null)
            }
        }
        return hasil.get(3, TimeUnit.MINUTES)
    }
}
