package pro.padeveloper.studio.kunci

import android.content.Context
import android.content.SharedPreferences
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import com.google.crypto.tink.InsecureSecretKeyAccess
import com.google.crypto.tink.KeyTemplates
import com.google.crypto.tink.hybrid.HpkePrivateKey
import com.google.crypto.tink.hybrid.HybridConfig
import com.google.crypto.tink.integration.android.AndroidKeysetManager
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * Penyimpanan aman: setiap nilai dibungkus AES-256-GCM dengan master key Android Keystore (non-ekspor).
 * Tanpa syarat buka layar/otentikasi agar layanan FCM bisa memeriksa amplop di latar; otorisasi tindakan ada di
 * K_rencana/K_kerjakan. AAD = nama entri (entri tidak bisa ditukar). Isi tidak pernah ditulis ke log.
 */
class Brankas(context: Context) {
    private val pref: SharedPreferences = context.applicationContext.getSharedPreferences(PREF, Context.MODE_PRIVATE)

    @Synchronized
    fun simpan(nama: String, nilai: String?) {
        if (nilai == null) { pref.edit().remove(nama).commit(); return }
        val c = Cipher.getInstance("AES/GCM/NoPadding")
        c.init(Cipher.ENCRYPT_MODE, kunci())
        c.updateAAD(nama.toByteArray(Charsets.UTF_8))
        val ct = c.doFinal(nilai.toByteArray(Charsets.UTF_8))
        pref.edit().putString(nama, B64u.enk(c.iv + ct)).commit()
    }

    @Synchronized
    fun baca(nama: String): String? {
        val b = pref.getString(nama, null)?.let { B64u.dek(it) } ?: return null
        if (b.size < 12 + 16) return null
        val c = Cipher.getInstance("AES/GCM/NoPadding")
        c.init(Cipher.DECRYPT_MODE, kunci(), GCMParameterSpec(128, b, 0, 12))
        c.updateAAD(nama.toByteArray(Charsets.UTF_8))
        return String(c.doFinal(b, 12, b.size - 12), Charsets.UTF_8)
    }

    fun bacaLong(nama: String): Long = baca(nama)?.toLongOrNull() ?: 0L

    @Synchronized
    fun hapusSemua() {
        pref.edit().clear().commit()
    }

    private fun kunci(): SecretKey {
        val ks = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (ks.getKey(ALIAS, null) as? SecretKey)?.let { return it }
        val g = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
        g.init(
            KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .setRandomizedEncryptionRequired(true)
                .build(),
        )
        return g.generateKey()
    }

    companion object {
        private const val PREF = "padev_brankas"
        private const val ALIAS = "padev_brankas_v1"
    }
}

/**
 * Kunci cache riwayat cermin (K-06, KONTRAK-apk-v2 §6.3): AES-256-GCM Keystore non-ekspor, `setUnlockedDeviceRequired(true)` —
 * cache hanya bisa dibaca/ditulis saat layar HP terbuka. Terpisah dari Brankas (yang sengaja bisa dipakai di latar untuk FCM).
 * Menghapus kunci = isi cache lama tidak terbaca lagi (penghapusan kriptografis).
 */
object KunciRiwayat {
    private const val ALIAS = "padev_riwayat_v1"

    @Synchronized
    fun dapat(): SecretKey {
        val ks = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (ks.getKey(ALIAS, null) as? SecretKey)?.let { return it }
        val g = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
        g.init(
            KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .setRandomizedEncryptionRequired(true)
                .setUnlockedDeviceRequired(true)
                .build(),
        )
        return g.generateKey()
    }

    @Synchronized
    fun hapus() {
        runCatching { KeyStore.getInstance("AndroidKeyStore").apply { load(null) }.deleteEntry(ALIAS) }
    }
}

/**
 * E_hp: keyset HPKE Tink (X25519/HKDF-SHA256/AES-256-GCM, RAW) yang dibungkus master key AES-256-GCM Keystore
 * (AndroidKeysetManager), tanpa syarat buka layar agar notifikasi bisa dibuka di latar (kontrak §2).
 */
class KunciEhp(private val context: Context, private val nama: String = "padev_ehp") {
    class Pasangan(val privat: ByteArray, val publik: ByteArray) {
        val id: String get() = Kripto.idKunciX25519(publik)
    }

    private fun manajer(): AndroidKeysetManager {
        HybridConfig.register()
        return AndroidKeysetManager.Builder()
            .withSharedPref(context.applicationContext, "keyset", nama)
            .withKeyTemplate(KeyTemplates.get("DHKEM_X25519_HKDF_SHA256_HKDF_SHA256_AES_256_GCM_RAW"))
            .withMasterKeyUri("android-keystore://${nama}_master")
            .build()
    }

    fun ada(): Boolean = context.getSharedPreferences(nama, Context.MODE_PRIVATE).contains("keyset")

    /** Membaca (atau membuat bila belum ada) pasangan kunci. Bahan privat hanya hidup di memori proses. */
    @Synchronized
    fun pasangan(): Pasangan {
        val k = manajer().keysetHandle.primary.key as HpkePrivateKey
        return Pasangan(
            k.privateKeyBytes.toByteArray(InsecureSecretKeyAccess.get()),
            k.publicKey.publicKeyBytes.toByteArray(),
        )
    }

    @Synchronized
    fun buatBaru(): Pasangan {
        hapus()
        return pasangan()
    }

    @Synchronized
    fun hapus() {
        context.getSharedPreferences(nama, Context.MODE_PRIVATE).edit().clear().commit()
    }
}
