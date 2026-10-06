package pro.padeveloper.studio.kunci

import com.google.crypto.tink.hybrid.internal.HpkeContext
import com.google.crypto.tink.hybrid.internal.HpkeKemPrivateKey
import com.google.crypto.tink.hybrid.internal.HpkePrimitiveFactory
import com.google.crypto.tink.hybrid.internal.HpkeUtil
import com.google.crypto.tink.hybrid.internal.JembatanHpkePadev
import com.google.crypto.tink.subtle.X25519
import com.google.crypto.tink.util.Bytes

/**
 * HPKE RFC 9180 mode base, suite PADEV-E2E-v1: DHKEM(X25519, HKDF-SHA256) / HKDF-SHA256 / AES-256-GCM, single-shot (seq 0).
 * Implementasi: Google Tink (lihat JembatanHpkePadev untuk alasan akses paket).
 */
object Hpke {
    val kem = HpkePrimitiveFactory.createKem(HpkeUtil.X25519_HKDF_SHA256_KEM_ID)
    val kdf = HpkePrimitiveFactory.createKdf(HpkeUtil.HKDF_SHA256_KDF_ID)
    val aead = HpkePrimitiveFactory.createAead(HpkeUtil.AES_256_GCM_AEAD_ID)

    class Segel(val enc: ByteArray, val ct: ByteArray)

    fun segel(pkR: ByteArray, info: ByteArray, aad: ByteArray, pt: ByteArray): Segel {
        require(pkR.size == 32) { "kunci publik X25519 harus 32 byte" }
        val h = JembatanHpkePadev.segel(pkR, kem, kdf, aead, info, aad, pt)
        return Segel(h[0], h[1])
    }

    fun buka(skR: ByteArray, enc: ByteArray, info: ByteArray, aad: ByteArray, ct: ByteArray): ByteArray {
        val priv = HpkeKemPrivateKey(Bytes.copyFrom(skR), Bytes.copyFrom(X25519.publicFromPrivate(skR)))
        return HpkeContext.createRecipientContext(enc, priv, kem, kdf, aead, info).open(ct, aad)
    }

    fun publikDariPrivat(skR: ByteArray): ByteArray = X25519.publicFromPrivate(skR)

    fun buatPrivat(): ByteArray = X25519.generatePrivateKey()
}
