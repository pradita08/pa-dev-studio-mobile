package pro.padeveloper.studio.kunci

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assume.assumeTrue
import org.junit.Test

/**
 * KONTRAK-apk-v2 §10.1 (G5): `jalankan.sambung`. Inline = jalur pembuat HP (Perintah.isi); vektor V-K01..V-K07 dari
 * kontrak/vektor-sambung.json (dibuat Bima), V-K07 memakai kunci uji vektor-e2e.json.
 */
class SambungTest {
    private val sesi = "0f8fad5b-d9cb-469f-a165-70867728950e"
    private val dasar = linkedMapOf<String, Any>(
        "tugas" to "t-abc-0123456789abcdef", "proyek" to "p1", "akun" to "akun1", "mode" to "kerjakan", "pesan" to "halo",
        "baru" to false, "sesi" to sesi, "sambung" to true,
    )

    private fun jalankan(vararg ubah: Pair<String, Any?>, dari: Map<String, Any> = dasar): String? {
        val t = LinkedHashMap(dari).apply { for ((k, v) in ubah) if (v == null) remove(k) else put(k, v) }
        return runCatching { Perintah.isi("jalankan", "dac41f4ed3e1ec5d", "1f600ae09b7479f9", "0".repeat(32), 1, 1, 2, t) }
            .exceptionOrNull()?.let { (it as GalatKunci).kode }
    }

    @Test
    fun v_k01_sah() = assertNull(jalankan())

    @Test
    fun tanpaSambungPerilakuLama() { // mundur-kompatibel
        assertNull(jalankan("sambung" to null))
        assertNull(jalankan("sambung" to null, "sesi" to null))
    }

    @Test
    fun v_k02_tanpaSesi() = assertEquals("perintah_tidak_sah", jalankan("sesi" to null))

    @Test
    fun v_k03_baru() = assertEquals("perintah_tidak_sah", jalankan("baru" to true))

    @Test
    fun v_k04_modeRencana() = assertEquals("perintah_tidak_sah", jalankan("mode" to "rencana"))

    @Test
    fun v_k05_sambungBukanTrue() {
        assertEquals("perintah_tidak_sah", jalankan("sambung" to false))
        assertEquals("perintah_tidak_sah", jalankan("sambung" to "ya"))
    }

    @Test
    fun v_k06_otomatis() = assertEquals("perintah_tidak_sah", jalankan("otomatis" to true))

    @Test
    fun sesiBukanUuidKecil() = assertEquals("perintah_tidak_sah", jalankan("sesi" to sesi.uppercase()))

    private fun harapan(x: Map<String, Any>): String? = x["harapan"] as? String   // null JSON = JsonNull = sah

    /** Kelompok K vektor-sambung.json (Bima): isi perintah lewat cekIsiPerintah; V-K07 lewat amplop bertanda peran itu. */
    @Test
    fun vektorKelompokK() {
        assumeTrue("kontrak/vektor-sambung.json tidak ada", UjiBantu.ada("vektor-sambung.json"))
        val e2e = UjiBantu.baca("vektor-e2e.json")
        val ku = UjiBantu.KunciUji(e2e)
        val konteks = UjiBantu.m(e2e["konteks"])
        val kasus = UjiBantu.l(UjiBantu.baca("vektor-sambung.json")["K"])
        assertEquals(10, kasus.size)
        for (k in kasus) {
            val x = UjiBantu.m(k)
            val label = "${x["id"]}/${x["varian"]}"
            val isi = UjiBantu.m(x["isi"])
            if (x["peran"] == "k_kerjakan") {
                assertEquals(label, harapan(x), AmplopV1.cekIsiPerintah(isi))
            } else {
                val kd = isi["kedaluwarsa"] as Long
                val peran = UjiBantu.s(x["peran"])
                val a = AmplopV1.buat("perintah", ku.id(peran), ku.publikX("e_mac"), isi, kd, ku.penanda(peran))
                val opsi = AmplopV1.Opsi(
                    "perintah", UjiBantu.kunciTandaDari(UjiBantu.m(UjiBantu.m(e2e["kunci_tanda_dikenal"])["mac"])), listOf(ku.privatX("e_mac")),
                    UjiBantu.s(konteks["mac_id"]), sekarang = isi["dibuat"] as Long,
                )
                assertEquals(label, harapan(x), AmplopV1.periksa(JsonKetat.parse(Jcs.teks(a)), opsi).alasan)
            }
        }
    }

    /** Amplop sah ditandatangani K_kerjakan lolos pemeriksa utuh (pembanding V-K07). */
    @Test
    fun sambungSahLolosBilaKKerjakan() {
        assumeTrue("kontrak/vektor-sambung.json tidak ada", UjiBantu.ada("vektor-sambung.json"))
        val e2e = UjiBantu.baca("vektor-e2e.json")
        val ku = UjiBantu.KunciUji(e2e)
        val isi = UjiBantu.m(UjiBantu.m(UjiBantu.l(UjiBantu.baca("vektor-sambung.json")["K"])[0])["isi"])
        val a = AmplopV1.buat("perintah", ku.id("k_kerjakan"), ku.publikX("e_mac"), isi, isi["kedaluwarsa"] as Long, ku.penanda("k_kerjakan"))
        val opsi = AmplopV1.Opsi(
            "perintah", UjiBantu.kunciTandaDari(UjiBantu.m(UjiBantu.m(e2e["kunci_tanda_dikenal"])["mac"])), listOf(ku.privatX("e_mac")),
            UjiBantu.s(UjiBantu.m(e2e["konteks"])["mac_id"]), sekarang = isi["dibuat"] as Long,
        )
        val h = AmplopV1.periksa(JsonKetat.parse(Jcs.teks(a)), opsi)
        assertEquals(h.alasan, true, h.ok)
    }
}
