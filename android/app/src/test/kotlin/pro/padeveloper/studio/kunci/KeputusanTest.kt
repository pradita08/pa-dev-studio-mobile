package pro.padeveloper.studio.kunci

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * F1b (pelaksana-keputusan.js): perintah `keputusan_jawab` disusun & dicek dengan skema Mac; kabar `keputusan` diurai ketat
 * (field tak dikenal / nilai di luar kontrak → isi_bentuk). Kasus sama dengan uji/pelaksana/uji-keputusan.js (repo kantor).
 */
class KeputusanTest {
    private val id = "b".repeat(32)
    private val sesi = "0f8fad5b-d9cb-469f-a165-70867728950e"

    private fun perintah(tambahan: Map<String, Any>): String? = runCatching {
        Perintah.isi("keputusan_jawab", "dac41f4ed3e1ec5d", "1f600ae09b7479f9", "0".repeat(32), 1, 1, 2, tambahan)
    }.exceptionOrNull()?.let { (it as GalatKunci).kode }

    private fun kabar(m: Any?, tambahan: Map<String, Any> = emptyMap()): String? = AmplopV1.cekIsiKabar(
        linkedMapOf<String, Any>(
            "mac_id" to "dac41f4ed3e1ec5d", "perangkat_id" to "1f600ae09b7479f9", "urut_mac" to 1L, "dibuat" to 1L,
            "jenis" to "keputusan", "keputusan" to (m ?: JsonNull),
        ) + tambahan,
    )

    private fun butir(vararg ubah: Pair<String, Any?>): Map<String, Any?> = linkedMapOf<String, Any?>(
        "id" to id, "sesi" to sesi, "proyek" to "p1", "akun" to "akun1", "jenis" to "izin", "alat" to "Bash", "ringkas" to "ls",
        "boleh" to listOf("tolak", "izinkan"), "dibuat" to 1L, "sampai" to 2L,
    ).apply { for ((k, v) in ubah) if (v == null) remove(k) else put(k, v) }

    private val tanya = listOf(
        mapOf("teks" to "Lanjut deploy?", "judul" to "Deploy", "banyak" to false,
            "pilihan" to listOf(mapOf("label" to "Ya", "ket" to "sekarang"), mapOf("label" to "Nanti", "ket" to ""))),
    )

    @Test
    fun perintahSah() {
        assertNull(perintah(mapOf("keputusan" to id, "pilih" to "tolak")))
        assertNull(perintah(mapOf("keputusan" to id, "pilih" to "tolak", "pesan" to "jangan")))
        assertNull(perintah(mapOf("keputusan" to id, "pilih" to "izinkan")))
        assertNull(perintah(mapOf("keputusan" to id, "pilih" to "izinkan_selalu")))
        assertNull(perintah(mapOf("keputusan" to id, "pilih" to "jawab", "jawaban" to listOf(listOf("A"), listOf("B", "C")))))
    }

    @Test
    fun perintahSalahDitolak() {
        val t = "perintah_tidak_sah"
        assertEquals(t, perintah(mapOf("keputusan" to id, "pilih" to "jawab")))                                   // jawab tanpa jawaban
        assertEquals(t, perintah(mapOf("keputusan" to id, "pilih" to "tolak", "jawaban" to listOf(listOf("A")))))  // jawaban bukan jawab
        assertEquals(t, perintah(mapOf("keputusan" to id, "pilih" to "semua")))
        assertEquals(t, perintah(mapOf("keputusan" to "x", "pilih" to "tolak")))
        assertEquals(t, perintah(mapOf("keputusan" to id, "pilih" to "tolak", "updatedPermissions" to emptyList<Any>())))
        assertEquals(t, perintah(mapOf("keputusan" to id, "pilih" to "tolak", "pesan" to "")))
        assertEquals(t, perintah(mapOf("keputusan" to id, "pilih" to "tolak", "pesan" to "x".repeat(501))))
        assertEquals(t, perintah(mapOf("keputusan" to id, "pilih" to "jawab", "jawaban" to List(5) { listOf("a") })))
        assertEquals(t, perintah(mapOf("keputusan" to id, "pilih" to "jawab", "jawaban" to listOf(List(7) { "a" }))))
        assertEquals(t, perintah(mapOf("keputusan" to id, "pilih" to "jawab", "jawaban" to listOf(listOf("")))))
    }

    @Test
    fun masaMaksTigaMenit() {
        assertEquals(180_000L, AmplopV1.masaMaks("perintah", mapOf("jenis" to "keputusan_jawab")))
    }

    @Test
    fun kabarSah() {
        assertNull(kabar(mapOf("daftar" to listOf(butir()), "selesai" to emptyList<Any>())))
        assertNull(kabar(mapOf("daftar" to emptyList<Any>(), "selesai" to listOf(mapOf("id" to id, "alasan" to "dijawab_mac")))))
        assertNull(kabar(mapOf("daftar" to listOf(butir("jenis" to "tanya", "pertanyaan" to tanya, "boleh" to listOf("tolak", "jawab"))), "selesai" to emptyList<Any>())))
    }

    @Test
    fun kabarSalahDitolak() {
        val t = Alasan.ISI_BENTUK
        assertEquals(t, kabar(mapOf("daftar" to listOf(butir("cwd" to "/x")), "selesai" to emptyList<Any>())))
        assertEquals(t, kabar(mapOf("daftar" to listOf(butir("boleh" to listOf("izinkan"))), "selesai" to emptyList<Any>())))
        assertEquals(t, kabar(mapOf("daftar" to listOf(butir("jenis" to "tanya")), "selesai" to emptyList<Any>())))
        assertEquals(t, kabar(mapOf("daftar" to listOf(butir("pertanyaan" to emptyList<Any>())), "selesai" to emptyList<Any>())))
        assertEquals(t, kabar(mapOf("daftar" to List(11) { butir() }, "selesai" to emptyList<Any>())))
        assertEquals(t, kabar(mapOf("daftar" to emptyList<Any>(), "selesai" to listOf(mapOf("id" to id, "alasan" to "lain")))))
        assertEquals(t, kabar(mapOf("daftar" to emptyList<Any>())))
        assertEquals(t, kabar(mapOf("daftar" to emptyList<Any>(), "selesai" to emptyList<Any>()), mapOf("cwd" to "/x")))
        assertEquals(t, kabar(mapOf("daftar" to listOf(butir("ringkas" to "x".repeat(4001))), "selesai" to emptyList<Any>())))
        assertEquals(t, kabar(mapOf("daftar" to listOf(butir("jenis" to "lain")), "selesai" to emptyList<Any>())))
    }

    @Test
    fun cariButir() {
        val snap = mapOf<String, Any>("keputusan" to mapOf("daftar" to listOf(butir()), "selesai" to emptyList<Any>()))
        assertNotNull(Keputusan.cariButir(snap, id))
        assertNull(Keputusan.cariButir(snap, "c".repeat(32)))
        assertNull(Keputusan.cariButir(null, id))
    }
}
