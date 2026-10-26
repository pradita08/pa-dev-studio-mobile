package pro.padeveloper.studio.kunci

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Test

/** G4 "Lanjutkan di Chat" (S-G4-1, S-G4-14): `jalankan.sesi` UUID huruf kecil persis, opsional; cache chat menerima Tugas.sesi. */
class LanjutSesiTest {
    private val sesi = "0f8fad5b-d9cb-469f-a165-70867728950e"

    private fun jalankan(vararg lain: Pair<String, Any>): String? = runCatching {
        val t = linkedMapOf<String, Any>("tugas" to "t-uji-0123456789abcdef", "proyek" to "kantor", "akun" to "akun1", "mode" to "rencana",
            "pesan" to "lanjut", "baru" to false).also { it.putAll(lain) }
        Perintah.isi("jalankan", "dac41f4ed3e1ec5d", "1f600ae09b7479f9", "0".repeat(32), 1, 1, 2, t)
        null
    }.exceptionOrNull()?.let { (it as? GalatKunci)?.kode ?: it.javaClass.simpleName }

    @Test
    fun sesiSahDanTanpaSesi() {
        assertNull(jalankan())
        assertNull(jalankan("sesi" to sesi))
    }

    @Test
    fun sesiBentukLainDitolak() {
        for (v in listOf(sesi.uppercase(), sesi.dropLast(1), sesi + "0", "../x", "$sesi.jsonl")) {
            assertEquals(v, "perintah_tidak_sah", jalankan("sesi" to v))
        }
        assertEquals("perintah_tidak_sah", jalankan("sesi" to JsonNull))
        assertEquals("perintah_tidak_sah", jalankan("sesi" to 1L))
    }

    @Test
    fun cacheChatMenerimaSesi() {
        val e = linkedMapOf<String, Any?>("id" to "t-abc-0123456789abcdef", "waktu" to 5L, "akun" to "akun1", "mode" to "rencana",
            "pesan" to "lanjut", "baru" to false, "tahap" to "selesai")
        assertEquals(sesi, RiwayatChat.cekEntri(e + ("sesi" to sesi))["sesi"])
        assertThrows(IllegalArgumentException::class.java) { RiwayatChat.cekEntri(e + ("sesi" to sesi.uppercase())) }
    }
}
