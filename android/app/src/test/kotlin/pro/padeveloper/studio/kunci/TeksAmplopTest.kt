package pro.padeveloper.studio.kunci

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Test
import pro.padeveloper.studio.kunci.UjiBantu.l
import pro.padeveloper.studio.kunci.UjiBantu.m
import pro.padeveloper.studio.kunci.UjiBantu.s

/** QA-7: `AmplopV1.teks` (dipakai Inti.halo/ambilKabar) untuk amplop relay berbentuk String / objek / lainnya. */
class TeksAmplopTest {
    @Test
    fun stringApaAdanya() {
        val t = """{"v":1,"jenis_kotak":"kabar"}"""
        assertEquals(t, AmplopV1.teks(t))
    }

    @Test
    fun objekMenjadiJcs() {
        val o = linkedMapOf<String, Any>("v" to 1L, "jenis_kotak" to "kabar", "dari" to "0123456789abcdef")
        assertEquals("""{"dari":"0123456789abcdef","jenis_kotak":"kabar","v":1}""", AmplopV1.teks(o))
    }

    @Test
    fun bentukLainNull() {
        assertNull(AmplopV1.teks(null))
        assertNull(AmplopV1.teks(JsonNull))
        assertNull(AmplopV1.teks(42L))
        assertNull(AmplopV1.teks(1.5))
        assertNull(AmplopV1.teks(true))
        assertNull(AmplopV1.teks(listOf("a")))
        // objek yang tidak bisa dikanonikkan (angka di luar 2^53) → null, bukan pengecualian yang menghentikan ambilKabar
        assertNull(AmplopV1.teks(mapOf("v" to 9007199254740992L)))
    }

    /** Interop: kabar sah vektor kontrak (dibaca sebagai objek, seperti jawaban relay) → teks → lolos pemeriksa HP. */
    @Test
    fun kabarVektorSebagaiObjekLolosPemeriksa() {
        assumeTrue("vektor belum ada (apk/kontrak/vektor-e2e.json)", UjiBantu.ada("vektor-e2e.json"))
        val v = UjiBantu.baca("vektor-e2e.json")
        val kabar = l(m(v["sah"])["kabar"])
        assertTrue(kabar.isNotEmpty())
        for (x in kabar) {
            val c = m(x)
            val teks = AmplopV1.teks(m(c["amplop"]))
            assertNotNull(s(c["label"]), teks)
            val h = AmplopV1.periksa(teks!!, UjiBantu.opsiDariVektor(v, m(c["periksa"]), c["amplop"]))
            assertTrue("${c["label"]}: ${h.alasan}", h.ok)
            assertEquals(m(c["hasil"])["jenis"], h.isi!!["jenis"])
        }
    }
}
