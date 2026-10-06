package pro.padeveloper.studio.kunci

import com.google.crypto.tink.hybrid.internal.HpkeContext
import com.google.crypto.tink.hybrid.internal.HpkeKemPrivateKey
import com.google.crypto.tink.hybrid.internal.JembatanHpkePadev
import com.google.crypto.tink.util.Bytes
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Assume.assumeTrue
import org.junit.Test

/** HPKE Tink terhadap vektor resmi RFC 9180 (suite 0x0020/0x0001/0x0002, mode base). */
class HpkeTest {
    private fun h(o: Any?) = Heks.dek(UjiBantu.s(o))

    @Test
    fun vektorResmiRfc9180() {
        assumeTrue("vektor HPKE belum ada", UjiBantu.ada("hpke-rfc9180-base-0020-0001-0002.json"))
        val daftar = UjiBantu.l(UjiBantu.baca("hpke-rfc9180-base-0020-0001-0002.json")["vektor"])
        assertTrue(daftar.isNotEmpty())
        for (x in daftar) {
            val v = UjiBantu.m(x)
            assertEquals(0L, v["mode"]); assertEquals(32L, v["kem_id"]); assertEquals(1L, v["kdf_id"]); assertEquals(2L, v["aead_id"])
            val info = h(v["info"])
            val enkripsi = UjiBantu.l(v["encryptions"]).map { UjiBantu.m(it) }
            // penerima: buka semua pesan berurutan (seq 0..n)
            val priv = HpkeKemPrivateKey(Bytes.copyFrom(h(v["skRm"])), Bytes.copyFrom(h(v["pkRm"])))
            val penerima = HpkeContext.createRecipientContext(h(v["enc"]), priv, Hpke.kem, Hpke.kdf, Hpke.aead, info)
            for (e in enkripsi) assertArrayEquals(h(e["pt"]), penerima.open(h(e["ct"]), h(e["aad"])))
            // pengirim deterministik (kunci efemeral vektor): key, base_nonce, ct
            val pengirim = JembatanHpkePadev.konteksTetapUntukUji(h(v["pkRm"]), h(v["skEm"]), h(v["pkEm"]), Hpke.kdf, Hpke.aead, info)
            assertArrayEquals(h(v["enc"]), pengirim.encapsulatedKey)
            assertArrayEquals(h(v["key"]), JembatanHpkePadev.kunciKonteks(pengirim))
            assertArrayEquals(h(v["base_nonce"]), JembatanHpkePadev.nonceDasar(pengirim))
            for (e in enkripsi) assertArrayEquals(h(e["ct"]), pengirim.seal(h(e["pt"]), h(e["aad"])))
            // pembungkus single-shot memakai seq 0
            assertArrayEquals(h(enkripsi[0]["pt"]), Hpke.buka(h(v["skRm"]), h(v["enc"]), info, h(enkripsi[0]["aad"]), h(enkripsi[0]["ct"])))
        }
    }

    @Test
    fun segelBukaDanAadTerikat() {
        val sk = Hpke.buatPrivat()
        val pk = Hpke.publikDariPrivat(sk)
        val s = Hpke.segel(pk, "info".toByteArray(), "aad".toByteArray(), "halo".toByteArray())
        assertEquals(32, s.enc.size)
        assertArrayEquals("halo".toByteArray(), Hpke.buka(sk, s.enc, "info".toByteArray(), "aad".toByteArray(), s.ct))
        for ((info, aad) in listOf("info" to "aaX", "infX" to "aad")) {
            try {
                Hpke.buka(sk, s.enc, info.toByteArray(), aad.toByteArray(), s.ct); fail("harus gagal: $info/$aad")
            } catch (e: java.security.GeneralSecurityException) { /* benar */ }
        }
    }
}
