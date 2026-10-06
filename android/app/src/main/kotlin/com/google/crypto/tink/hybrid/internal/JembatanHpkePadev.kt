package com.google.crypto.tink.hybrid.internal

/**
 * Jembatan ke HPKE Tink untuk PADEV Studio.
 *
 * API publik Tink (HybridEncrypt) tidak menerima `aad`, sedangkan kontrak PADEV-E2E-v1 mewajibkan aad = H.
 * `HpkeContext.createSenderContext` dan `createContext` bersifat package-private, jadi kelas ini sengaja diletakkan
 * di paket Tink yang sama. Versi Tink dipin (app/build.gradle.kts + gradle.lockfile) dan diuji terhadap vektor
 * RFC 9180 resmi; bila Tink dinaikkan, jalankan ulang `apk/bangun.sh uji`.
 */
object JembatanHpkePadev {
    /** Mode base, single-shot: (enc, ct). */
    @JvmStatic
    fun segel(pkR: ByteArray, kem: HpkeKem, kdf: HpkeKdf, aead: HpkeAead, info: ByteArray, aad: ByteArray, pt: ByteArray): Array<ByteArray> {
        val ctx = HpkeContext.createSenderContext(pkR, kem, kdf, aead, info)
        return arrayOf(ctx.encapsulatedKey, ctx.seal(pt, aad))
    }

    /** Hanya untuk uji vektor RFC 9180: konteks pengirim dengan kunci efemeral tetap → (enc, key, baseNonce, konteks). */
    @JvmStatic
    fun konteksTetapUntukUji(pkR: ByteArray, skE: ByteArray, pkE: ByteArray, kdf: HpkeKdf, aead: HpkeAead, info: ByteArray): HpkeContext {
        val kem = X25519HpkeKem(kdf as HkdfHpkeKdf)
        val keluar = kem.encapsulateWithFixedEphemeralKey(pkR, skE, pkE)
        return HpkeContext.createContext(HpkeUtil.BASE_MODE, keluar.encapsulatedKey, keluar.sharedSecret, kem, kdf, aead, info)
    }

    @JvmStatic
    fun kunciKonteks(ctx: HpkeContext): ByteArray = ctx.key

    @JvmStatic
    fun nonceDasar(ctx: HpkeContext): ByteArray = ctx.baseNonce
}
