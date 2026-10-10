package pro.padeveloper.studio.kunci

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Roadmap 2 (pelaksana-review.js): perintah `review_*` disusun & dicek dengan skema Mac; kabar `review` / `review_berkas` diurai
 * ketat (field tak dikenal / nilai di luar kontrak → isi_bentuk). Kasus sama dengan uji/pelaksana/uji-review.js (repo kantor).
 */
class ReviewTest {
    private val id = "b".repeat(32)

    private fun perintah(jenis: String, tambahan: Map<String, Any>): String? = runCatching {
        Perintah.isi(jenis, "dac41f4ed3e1ec5d", "1f600ae09b7479f9", "0".repeat(32), 1, 1, 2, tambahan)
    }.exceptionOrNull()?.let { (it as GalatKunci).kode }

    private fun kabar(jenis: String, m: Any?, tambahan: Map<String, Any> = emptyMap()): String? = AmplopV1.cekIsiKabar(
        linkedMapOf<String, Any>(
            "mac_id" to "dac41f4ed3e1ec5d", "perangkat_id" to "1f600ae09b7479f9", "urut_mac" to 1L, "dibuat" to 1L,
            "jenis" to jenis, jenis to (m ?: JsonNull),
        ) + tambahan,
    )

    private fun butir(vararg ubah: Pair<String, Any?>): Map<String, Any?> = linkedMapOf<String, Any?>(
        "id" to id, "proyek" to "p1", "status" to "terbuka", "dibuat" to 1L, "diperbarui" to 2L, "tugas" to listOf("t-uji-0000000000000001"),
        "cabang" to "main", "hulu" to true, "belumPush" to 0L,
        "berkas" to listOf(mapOf("jalur" to "src/a.php", "status" to "M", "tambah" to 3L, "kurang" to 1L, "biner" to false)),
        "lebih" to 0L, "tes" to listOf(mapOf("perintah" to "npm test", "ok" to true), mapOf("perintah" to "php artisan test", "ok" to JsonNull)),
        "isi" to true, "boleh" to listOf("commit", "buang"),
    ).apply { for ((k, v) in ubah) if (v == null) remove(k) else put(k, v) }

    private fun diff(vararg ubah: Pair<String, Any?>): Map<String, Any?> = linkedMapOf<String, Any?>(
        "review" to id, "jalur" to "src/a.php", "teks" to "@@ -1 +1 @@\n-a\n+b\n", "terpotong" to false, "biner" to false, "disamarkan" to false,
    ).apply { for ((k, v) in ubah) if (v == null) remove(k) else put(k, v) }

    @Test
    fun perintahSah() {
        assertNull(perintah("review_daftar", emptyMap()))
        assertNull(perintah("review_berkas", mapOf("review" to id, "jalur" to "src/a.php")))
        assertNull(perintah("review_aksi", mapOf("review" to id, "aksi" to "commit", "pesan" to "Fitur dari HP")))
        assertNull(perintah("review_aksi", mapOf("review" to id, "aksi" to "buang")))
        assertNull(perintah("review_aksi", mapOf("review" to id, "aksi" to "push")))
    }

    @Test
    fun perintahSalahDitolak() {
        val t = "perintah_tidak_sah"
        assertEquals(t, perintah("review_daftar", mapOf("semua" to true)))
        assertEquals(t, perintah("review_berkas", mapOf("review" to id, "jalur" to "a\nb")))
        assertEquals(t, perintah("review_berkas", mapOf("review" to id, "jalur" to "")))
        assertEquals(t, perintah("review_berkas", mapOf("review" to id, "jalur" to "x".repeat(301))))
        assertEquals(t, perintah("review_aksi", mapOf("review" to id, "aksi" to "commit")))                     // commit tanpa pesan
        assertEquals(t, perintah("review_aksi", mapOf("review" to id, "aksi" to "buang", "pesan" to "x")))      // pesan bukan commit
        assertEquals(t, perintah("review_aksi", mapOf("review" to id, "aksi" to "reset")))
        assertEquals(t, perintah("review_aksi", mapOf("review" to id, "aksi" to "commit", "pesan" to "a\nb")))
        assertEquals(t, perintah("review_aksi", mapOf("review" to id, "aksi" to "commit", "pesan" to " a")))
        assertEquals(t, perintah("review_aksi", mapOf("review" to id, "aksi" to "commit", "pesan" to "x".repeat(201))))
        assertEquals(t, perintah("review_aksi", mapOf("review" to id, "aksi" to "push", "paksa" to true)))
        assertEquals(t, perintah("review_aksi", mapOf("review" to "x", "aksi" to "push")))
    }

    @Test
    fun masaMaksAksiTigaMenit() {
        assertEquals(180_000L, AmplopV1.masaMaks("perintah", mapOf("jenis" to "review_aksi")))
        assertEquals(600_000L, AmplopV1.masaMaks("perintah", mapOf("jenis" to "review_berkas")))
    }

    @Test
    fun kabarSah() {
        assertNull(kabar("review", mapOf("daftar" to listOf(butir()))))
        assertNull(kabar("review", mapOf("daftar" to listOf(butir("status" to "dikomit", "commit" to "abc1234", "boleh" to listOf("push"), "galat" to "push_gagal: x")))))
        assertNull(kabar("review", mapOf("daftar" to emptyList<Any>())))
        assertNull(kabar("review_berkas", diff()))
        assertNull(kabar("review_berkas", diff("teks" to "", "rahasia" to true)))
    }

    @Test
    fun kabarSalahDitolak() {
        val t = Alasan.ISI_BENTUK
        assertEquals(t, kabar("review", mapOf("daftar" to listOf(butir("akar" to "/Users/x")))))
        assertEquals(t, kabar("review", mapOf("daftar" to listOf(butir("status" to "x")))))
        assertEquals(t, kabar("review", mapOf("daftar" to listOf(butir("boleh" to listOf("reset"))))))
        assertEquals(t, kabar("review", mapOf("daftar" to List(7) { butir() })))
        assertEquals(t, kabar("review", mapOf("daftar" to listOf(butir("berkas" to listOf(mapOf("jalur" to "a", "status" to "R", "tambah" to 0L, "kurang" to 0L, "biner" to false)))))))
        assertEquals(t, kabar("review", mapOf("daftar" to listOf(butir("tes" to listOf(mapOf("perintah" to "npm test", "ok" to "ya")))))))
        assertEquals(t, kabar("review", mapOf("daftar" to listOf(butir("commit" to "XYZ")))))
        assertEquals(t, kabar("review", mapOf("daftar" to listOf(butir("cabang" to null)))))
        assertEquals(t, kabar("review", mapOf("daftar" to listOf(butir())), mapOf("cwd" to "/x")))
        assertEquals(t, kabar("review_berkas", diff("teks" to "DB_PASSWORD=x", "rahasia" to true)))
        assertEquals(t, kabar("review_berkas", diff("teks" to "x".repeat(40001))))
        assertEquals(t, kabar("review_berkas", diff("path" to "/abs")))
        assertEquals(t, kabar("review_berkas", diff("rahasia" to false)))
    }

    @Test
    fun cariButirDanTeksSidikJari() {
        val b = butir("lebih" to 2L, "belumPush" to 3L)
        val snap = mapOf<String, Any>("review" to mapOf("daftar" to listOf(b)))
        val ada = Review.cariButir(snap, id)
        assertNotNull(ada)
        assertNull(Review.cariButir(snap, "c".repeat(32)))
        val (judul, sub, ket) = Review.teksSidikJari(ada!!, "commit", "Fitur A")
        assertEquals("Commit 3 berkas · p1", judul)
        assertEquals("Cabang main", sub)
        assertTrue(ket!!.contains("\"Fitur A\"") && ket.contains("src/a.php"))
        assertEquals("Push 3 commit · p1", Review.teksSidikJari(ada, "push", null).first)
        assertTrue(Review.teksSidikJari(ada, "buang", null).second.contains("tidak bisa dibatalkan"))
    }
}
