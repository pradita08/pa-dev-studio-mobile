package pro.padeveloper.studio.kunci

import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.nio.file.Files
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey

/** Riwayat chat HP: entri dari Dart dicek ketat, disimpan utuh (ganti, bukan gabung) & terenkripsi per proyek. */
class RiwayatChatTest {
    private val folder: File = Files.createTempDirectory("chat").toFile()
    private val kunci: SecretKey = KeyGenerator.getInstance("AES").apply { init(256) }.generateKey()
    private val sekarang = 1_791_000_000_000L
    private val cache = CacheRiwayat(folder, { kunci }, { sekarang })

    @After
    fun bersihkan() {
        folder.deleteRecursively()
    }

    private fun entri(id: String, waktu: Any = sekarang - 1000, vararg lain: Pair<String, Any?>): Map<String, Any?> =
        linkedMapOf<String, Any?>(
            "id" to id, "waktu" to waktu, "akun" to "akun1", "mode" to "rencana", "pesan" to "cek SIMPEG", "baru" to false,
            "tahap" to "selesai",
        ).also { it.putAll(lain) }

    @Test
    fun entriSahDinormalkan() {
        val e = RiwayatChat.cekEntri(
            entri("t-abc-0123456789abcdef", 5, "durasiMs" to 900, "urut" to -1, "teks" to "RAHASIA-JAWABAN", "perintahId" to null,
                "ditolak" to listOf(mapOf("alat" to "Bash", "ringkas" to "rm"))),
        )
        assertEquals(5L, e["waktu"])
        assertEquals(900L, e["durasiMs"])
        assertEquals(-1L, e["urut"])
        assertFalse(e.containsKey("perintahId"))
        // roadmap 3: tugas antrean limit & akun otomatis + pemakaian
        val a = RiwayatChat.cekEntri(
            entri("t-abc-0123456789abcdef", 5, "tahap" to "antre", "otomatis" to true, "akunDipakai" to "akun2", "sampai" to 99,
                "token" to 120000, "giliran" to 8, "biayaSen" to 42),
        )
        assertEquals("antre", a["tahap"])
        assertEquals(99L, a["sampai"])
        assertEquals(120000L, a["token"])
        assertEquals(true, a["otomatis"])
    }

    @Test
    fun entriTidakSahDitolak() {
        val salah = listOf(
            entri("../../x"),
            entri("t-abc-0123456789abcdef", "kemarin"),
            entri("t-abc-0123456789abcdef", 1, "mode" to "root"),
            entri("t-abc-0123456789abcdef", 1, "tahap" to "<script>"),
            entri("t-abc-0123456789abcdef", 1, "pesan" to "x".repeat(AmplopV1.MAKS_PESAN + 1)),
            entri("t-abc-0123456789abcdef", 1, "asing" to "x"),
            entri("t-abc-0123456789abcdef", 1, "akunDipakai" to "../akun"),
            entri("t-abc-0123456789abcdef", 1, "otomatis" to "ya"),
            entri("t-abc-0123456789abcdef", 1, "token" to -5),
            entri("t-abc-0123456789abcdef", 1, "ditolak" to List(11) { mapOf("alat" to "a", "ringkas" to "b") }),
            linkedMapOf("id" to "t-abc-0123456789abcdef"),
        )
        for (e in salah) assertThrows(IllegalArgumentException::class.java) { RiwayatChat.cekEntri(e) }
        assertThrows(IllegalArgumentException::class.java) {
            RiwayatChat.cekDaftar(listOf(entri("t-abc-0123456789abcdef"), entri("t-abc-0123456789abcdef")))
        }
        assertThrows(IllegalArgumentException::class.java) { RiwayatChat.kunci("../simpeg") }
    }

    @Test
    fun simpanGantiHapusTerenkripsi() {
        val k = RiwayatChat.kunci("simpeg")
        cache.ganti(k, RiwayatChat.cekDaftar(listOf(entri("t-a-0123456789abcdef", sekarang - 2000, "teks" to "RAHASIA-JAWABAN"),
            entri("t-b-0123456789abcdef"))))
        val mentah = String(cache.berkas(k).readBytes(), Charsets.ISO_8859_1)
        assertFalse(mentah.contains("RAHASIA") || mentah.contains("SIMPEG"))
        @Suppress("UNCHECKED_CAST")
        val ids = { (cache.baca(k)!!["entri"] as List<Map<String, Any>>).map { it["id"] } }
        assertEquals(listOf("t-a-0123456789abcdef", "t-b-0123456789abcdef"), ids())
        // ganti = isi utuh (tugas yang dibatalkan di HP ikut hilang dari berkas)
        cache.ganti(k, RiwayatChat.cekDaftar(listOf(entri("t-b-0123456789abcdef"))))
        assertEquals(listOf("t-b-0123456789abcdef"), ids())
        assertNull(cache.baca(RiwayatChat.kunci("etpp")))
        cache.ganti(k, emptyList())
        assertFalse(cache.berkas(k).exists())
        cache.ganti(k, RiwayatChat.cekDaftar(listOf(entri("t-b-0123456789abcdef"))))
        cache.hapus(k)
        assertTrue(cache.baca(k) == null)
    }
}
