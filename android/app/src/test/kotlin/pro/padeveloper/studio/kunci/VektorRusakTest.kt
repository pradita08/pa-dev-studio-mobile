package pro.padeveloper.studio.kunci

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Test
import pro.padeveloper.studio.kunci.UjiBantu.l
import pro.padeveloper.studio.kunci.UjiBantu.m
import java.io.File

/** apk/kontrak/vektor-rusak.json (Rizky): `[{label, amplop, periksa, galat}]` — pemeriksa Kotlin menolak dengan alasan sama. */
class VektorRusakTest {
    @Test
    fun amplopRusakDitolakDenganGalatSama() {
        assumeTrue("vektor-rusak.json/vektor-e2e.json belum ada", UjiBantu.ada("vektor-rusak.json") && UjiBantu.ada("vektor-e2e.json"))
        val v = UjiBantu.baca("vektor-e2e.json")
        val kasus = l(JsonKetat.parse(File(UjiBantu.folderKontrak, "vektor-rusak.json").readText(Charsets.UTF_8)))
        assertTrue(kasus.isNotEmpty())
        for (x in kasus) {
            val c = m(x)
            val h = AmplopV1.periksa(c["amplop"], UjiBantu.opsiDariVektor(v, m(c["periksa"]), c["amplop"]))
            assertFalse("${c["label"]} harus ditolak", h.ok)
            assertEquals("${c["label"]}", c["galat"], h.alasan)
        }
    }
}
