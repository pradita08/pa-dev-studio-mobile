package pro.padeveloper.studio.kunci

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Assume.assumeTrue
import org.junit.Test

class JcsTest {
    @Test
    fun vektorJcsBersama() {
        assumeTrue("vektor belum ada", UjiBantu.ada("vektor-e2e.json"))
        val kasus = UjiBantu.l(UjiBantu.baca("vektor-e2e.json")["jcs"])
        for (k in kasus) {
            val o = UjiBantu.m(k)
            assertEquals(UjiBantu.s(o["masuk"]), UjiBantu.s(o["keluar"]), Jcs.teks(JsonKetat.parse(UjiBantu.s(o["masuk"]))))
        }
    }

    @Test
    fun angkaGayaEcmaScript() {
        val harap = mapOf(
            0.0 to "0", -0.0 to "0", 1.5 to "1.5", 1e21 to "1e+21", 1e20 to "100000000000000000000", 1e-7 to "1e-7",
            0.000001 to "0.000001", 123.456 to "123.456", 5e-324 to "5e-324", 1.7976931348623157e308 to "1.7976931348623157e+308",
            0.1 to "0.1", 333333333.33333329 to "333333333.3333333", -1e-7 to "-1e-7",
        )
        for ((d, s) in harap) assertEquals("angka $d", s, Jcs.angkaEs(d))
    }

    @Test
    fun urutanKunciUtf16DanEscape() {
        val o = JsonKetat.parse("""{"😀":1,"é":2,"a":3,"€":4}""")
        assertEquals("{\"a\":3,\"é\":2,\"€\":4,\"😀\":1}", Jcs.teks(o))
        assertEquals("\"\\u001f\\n\u007f\"", Jcs.teks("\u001f\n\u007f"))
    }

    @Test
    fun masukanBurukDitolak() {
        assertThrows(JsonSalah::class.java) { JsonKetat.parse("""{"a":1,"a":2}""") }
        assertThrows(JsonSalah::class.java) { JsonKetat.parse("""{"a":1} x""") }
        assertThrows(JsonSalah::class.java) { JsonKetat.parse("""{"a":01}""") }
        assertThrows(JsonSalah::class.java) { JsonKetat.parse("[" .repeat(40) + "]".repeat(40)) }
        assertThrows(JsonSalah::class.java) { Jcs.teks("\ud800") }
        assertThrows(JsonSalah::class.java) { Jcs.teks(9007199254740992L) }
        assertThrows(JsonSalah::class.java) { Jcs.teks(Double.NaN) }
        assertThrows(JsonSalah::class.java) { JsonKetat.utf8(byteArrayOf(0xc3.toByte(), 0x28)) }
    }
}
