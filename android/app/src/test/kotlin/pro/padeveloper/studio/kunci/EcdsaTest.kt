package pro.padeveloper.studio.kunci

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Test
import java.security.KeyPairGenerator
import java.security.spec.ECGenParameterSpec

class EcdsaTest {
    @Test
    fun tandaVerifikasiDanIdKunci() {
        val kp = KeyPairGenerator.getInstance("EC").apply { initialize(ECGenParameterSpec("secp256r1")) }.generateKeyPair()
        val spki = kp.public.encoded
        val pub = Kripto.publikP256(spki)
        val tanda = Kripto.tandaEcdsa(kp.private, "data".toByteArray())
        assertTrue(Kripto.verifikasiEcdsa(pub, "data".toByteArray(), tanda))
        assertFalse(Kripto.verifikasiEcdsa(pub, "datA".toByteArray(), tanda))
        assertEquals(16, Kripto.idKunciEcdsa(spki).length)
    }

    @Test
    fun kunciBukanP256Ditolak() {
        val kp = KeyPairGenerator.getInstance("EC").apply { initialize(ECGenParameterSpec("secp384r1")) }.generateKeyPair()
        assertTrue(runCatching { Kripto.publikP256(kp.public.encoded) }.isFailure)
    }

    /** Wycheproof ecdsa_secp256r1_sha256 (DER): valid harus diterima, invalid harus ditolak. */
    @Test
    fun wycheproof() {
        assumeTrue("vektor wycheproof belum ada", UjiBantu.ada("ecdsa-p256-sha256-wycheproof.json"))
        var n = 0
        for (g in UjiBantu.l(UjiBantu.baca("ecdsa-p256-sha256-wycheproof.json")["testGroups"])) {
            val grup = UjiBantu.m(g)
            val pub = try { Kripto.publikP256(Heks.dek(UjiBantu.s(grup["publicKeyDer"]))) } catch (e: Exception) { continue }
            for (t in UjiBantu.l(grup["tests"])) {
                val u = UjiBantu.m(t)
                val hasil = u["result"]
                if (hasil == "acceptable") continue
                val ok = Kripto.verifikasiEcdsa(pub, Heks.dek(UjiBantu.s(u["msg"])), Heks.dek(UjiBantu.s(u["sig"])))
                assertEquals("tcId ${u["tcId"]} ${u["comment"]}", hasil == "valid", ok)
                n++
            }
        }
        assertTrue("tidak ada kasus wycheproof terbaca", n > 300)
    }
}
