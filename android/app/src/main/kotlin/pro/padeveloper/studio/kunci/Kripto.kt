package pro.padeveloper.studio.kunci

import java.math.BigInteger
import java.security.KeyFactory
import java.security.MessageDigest
import java.security.PrivateKey
import java.security.PublicKey
import java.security.SecureRandom
import java.security.Signature
import java.security.interfaces.ECPublicKey
import java.security.spec.PKCS8EncodedKeySpec
import java.security.spec.X509EncodedKeySpec
import java.util.Base64
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

/** base64url tanpa padding, kanonik (dekode → enkode ulang harus identik). */
object B64u {
    private val pola = Regex("^[A-Za-z0-9_-]*$")

    fun enk(b: ByteArray): String = Base64.getUrlEncoder().withoutPadding().encodeToString(b)

    fun dek(s: String): ByteArray? {
        if (!pola.matches(s) || s.length % 4 == 1) return null
        val b = try { Base64.getUrlDecoder().decode(s) } catch (e: IllegalArgumentException) { return null }
        return if (enk(b) == s) b else null
    }

    fun dekWajib(s: String, nama: String): ByteArray = dek(s) ?: throw JsonSalah("$nama bukan base64url kanonik")
}

object Heks {
    val POLA16 = Regex("^[0-9a-f]{16}$")
    val POLA32 = Regex("^[0-9a-f]{32}$")
    val POLA64 = Regex("^[0-9a-f]{64}$")

    fun enk(b: ByteArray): String = b.joinToString("") { "%02x".format(it.toInt() and 0xff) }

    fun dek(s: String): ByteArray {
        require(s.length % 2 == 0 && s.all { it in '0'..'9' || it in 'a'..'f' }) { "heksa tidak sah" }
        return ByteArray(s.length / 2) { s.substring(it * 2, it * 2 + 2).toInt(16).toByte() }
    }
}

object Kripto {
    private val acak = SecureRandom()

    // Parameter kurva P-256 (secp256r1) untuk memastikan kunci publik Mac benar-benar P-256.
    private val ORDE_P256 = BigInteger("ffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551", 16)

    fun sha256(vararg bagian: ByteArray): ByteArray {
        val md = MessageDigest.getInstance("SHA-256")
        bagian.forEach { md.update(it) }
        return md.digest()
    }

    fun hmacSha256(kunci: ByteArray, data: ByteArray): ByteArray =
        Mac.getInstance("HmacSHA256").run { init(SecretKeySpec(kunci, "HmacSHA256")); doFinal(data) }

    fun acakBytes(n: Int): ByteArray = ByteArray(n).also { acak.nextBytes(it) }

    fun acakHeks(nByte: Int): String = Heks.enk(acakBytes(nByte))

    /** ID kunci ECDSA = hex(SHA-256(SPKI DER))[0:16]. */
    fun idKunciEcdsa(spki: ByteArray): String = Heks.enk(sha256(spki)).substring(0, 16)

    /** ID kunci X25519 = hex(SHA-256(raw 32 byte))[0:16]. */
    fun idKunciX25519(raw: ByteArray): String {
        require(raw.size == 32) { "kunci X25519 harus 32 byte" }
        return Heks.enk(sha256(raw)).substring(0, 16)
    }

    /** SPKI DER → kunci publik P-256; ditolak bila bukan P-256 atau encoding tidak kanonik. */
    fun publikP256(spki: ByteArray): ECPublicKey {
        val k = KeyFactory.getInstance("EC").generatePublic(X509EncodedKeySpec(spki)) as? ECPublicKey
            ?: throw IllegalArgumentException("bukan kunci EC")
        if (k.params.order != ORDE_P256 || k.params.curve.field.fieldSize != 256) throw IllegalArgumentException("bukan P-256")
        if (!k.encoded.contentEquals(spki)) throw IllegalArgumentException("SPKI tidak kanonik")
        return k
    }

    fun privatP256(pkcs8: ByteArray): PrivateKey =
        KeyFactory.getInstance("EC").generatePrivate(PKCS8EncodedKeySpec(pkcs8))

    /**
     * Verifikasi ECDSA P-256/SHA-256. Tanda wajib DER kanonik (ketat): parser JCA sebagian penyedia menerima encoding
     * longgar (mis. INTEGER tanpa 0x00 pembuka / panjang tidak minimal) → tanda bisa diubah tanpa kunci (malleability).
     */
    fun verifikasiEcdsa(publik: PublicKey, data: ByteArray, tandaDer: ByteArray): Boolean = try {
        derKanonik(tandaDer) &&
            Signature.getInstance("SHA256withECDSA").run { initVerify(publik); update(data); verify(tandaDer) }
    } catch (e: Exception) {
        false
    }

    /**
     * true hanya bila `t` = SEQUENCE { INTEGER r, INTEGER s } DER persis: panjang bentuk pendek & tepat, INTEGER minimal
     * (tanpa 0x00 berlebih), positif, 1 ≤ r,s < n, tanpa byte sisa. Untuk P-256 tanda ≤ 72 byte, jadi panjang selalu < 0x80.
     */
    fun derKanonik(t: ByteArray): Boolean {
        if (t.size < 8 || t.size > 72) return false
        if (t[0] != 0x30.toByte() || (t[1].toInt() and 0xff) != t.size - 2) return false
        var i = 2
        repeat(2) {
            if (i + 2 > t.size || t[i] != 0x02.toByte()) return false
            val pjg = t[i + 1].toInt() and 0xff
            if (pjg < 1 || pjg > 33 || i + 2 + pjg > t.size) return false
            val awal = i + 2
            if (t[awal].toInt() and 0x80 != 0) return false // negatif
            if (pjg > 1 && t[awal] == 0.toByte() && t[awal + 1].toInt() and 0x80 == 0) return false // 0x00 berlebih
            val nilai = BigInteger(1, t.copyOfRange(awal, awal + pjg))
            if (nilai.signum() <= 0 || nilai >= ORDE_P256) return false
            i = awal + pjg
        }
        return i == t.size
    }

    fun tandaEcdsa(privat: PrivateKey, data: ByteArray): ByteArray =
        Signature.getInstance("SHA256withECDSA").run { initSign(privat); update(data); sign() }

    /** Banding waktu-konstan. */
    fun sama(a: ByteArray, b: ByteArray): Boolean = MessageDigest.isEqual(a, b)
}

/** Penanda tangan ECDSA P-256 (DER). Android: kunci Keystore; uji JVM: kunci perangkat lunak. */
fun interface Penanda {
    fun tanda(data: ByteArray): ByteArray
}
