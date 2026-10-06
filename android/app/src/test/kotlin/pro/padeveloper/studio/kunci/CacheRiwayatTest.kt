package pro.padeveloper.studio.kunci

import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.nio.file.Files
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey

/**
 * K-06 (KONTRAK-apk-v2 §6.3): cache riwayat terenkripsi AES-256-GCM, terikat sesi (AAD), rusak → dibuang,
 * ≤7 hari / ≤20 sesi / ≤5 MB. Kunci Keystore diganti kunci perangkat lunak (logika berkas & sandi sama).
 */
class CacheRiwayatTest {
    private val folder: File = Files.createTempDirectory("riwayat").toFile()
    private val kunci: SecretKey = KeyGenerator.getInstance("AES").apply { init(256) }.generateKey()
    private var sekarang = 1_791_000_000_000L
    private val cache = CacheRiwayat(folder, { kunci }, { sekarang })
    private val sesiA = "0f8fad5b-d9cb-469f-a165-70867728950e"
    private val sesiB = "7c9e6679-7425-40de-944b-e07fc1f90ae7"

    @After
    fun bersihkan() {
        folder.deleteRecursively()
    }

    private fun entri(id: Any, waktu: Long, teks: String? = null): Map<String, Any> =
        linkedMapOf<String, Any>("id" to id, "waktu" to waktu, "peran" to "claude").also { e -> teks?.let { e["teks"] = it } }

    private fun riwayat(sesi: String, vararg e: Map<String, Any>, galat: String? = null): Map<String, Any> =
        linkedMapOf<String, Any>("sesi" to sesi, "entri" to e.toList(), "lagi" to false, "versiParser" to "1")
            .also { r -> galat?.let { r["galat"] = it } }

    @Suppress("UNCHECKED_CAST")
    private fun ids(m: Map<String, Any>?): List<Any> = (m!!["entri"] as List<Map<String, Any>>).map { it["id"]!! }

    @Test
    fun simpanBacaTerenkripsi() {
        cache.simpan(riwayat(sesiA, entri("b", sekarang - 1000, "RAHASIA-JAWABAN-CLAUDE"), entri("a", sekarang - 2000)))
        val f = cache.berkas(sesiA)
        assertTrue(f.isFile)
        val mentah = String(f.readBytes(), Charsets.ISO_8859_1)
        assertFalse("teks polos tidak boleh ada di berkas", mentah.contains("RAHASIA"))
        assertFalse("id sesi tidak boleh ada di nama/isi berkas", f.name.contains("0f8fad5b") || mentah.contains("0f8fad5b"))
        assertTrue(mentah.startsWith("PRL1"))
        val b = cache.baca(sesiA.uppercase())
        assertEquals(sesiA, b!!["sesi"])
        assertEquals(sekarang, b["diperbarui"])
        assertEquals(listOf("a", "b"), ids(b)) // urut per waktu
    }

    @Test
    fun gabungPerIdYangBaruMenimpa() {
        cache.simpan(riwayat(sesiA, entri("a", sekarang - 3000, "lama"), entri(2L, sekarang - 2000)))
        cache.simpan(riwayat(sesiA, entri("a", sekarang - 3000, "baru"), entri("c", sekarang - 1000)))
        val b = cache.baca(sesiA)
        assertEquals(listOf<Any>("a", 2L, "c"), ids(b))
        @Suppress("UNCHECKED_CAST")
        assertEquals("baru", (b!!["entri"] as List<Map<String, Any>>)[0]["teks"])
    }

    @Test
    fun galatAtauKosongTidakDisimpan() {
        cache.simpan(riwayat(sesiA, galat = "format_tidak_dikenal"))
        cache.simpan(riwayat(sesiB))
        assertNull(cache.baca(sesiA))
        assertNull(cache.baca(sesiB))
        assertEquals(0, folder.listFiles()?.size ?: 0)
    }

    @Test
    fun berkasDiubahDibuang() {
        cache.simpan(riwayat(sesiA, entri("a", sekarang)))
        val f = cache.berkas(sesiA)
        val b = f.readBytes()
        b[b.size - 1] = (b[b.size - 1].toInt() xor 1).toByte()
        f.writeBytes(b)
        assertNull(cache.baca(sesiA))
        assertFalse(f.exists())
    }

    @Test
    fun berkasDitukarAntarSesiDitolak() {
        cache.simpan(riwayat(sesiA, entri("a", sekarang)))
        cache.berkas(sesiA).copyTo(cache.berkas(sesiB))
        assertNull(cache.baca(sesiB)) // AAD = sesi
        assertNotNull(cache.baca(sesiA))
    }

    @Test
    fun kunciLainTidakBisaMembaca() {
        cache.simpan(riwayat(sesiA, entri("a", sekarang)))
        val lain = KeyGenerator.getInstance("AES").apply { init(256) }.generateKey()
        assertNull(CacheRiwayat(folder, { lain }, { sekarang }).baca(sesiA))
    }

    @Test
    fun retensiTujuhHari() {
        cache.simpan(riwayat(sesiA, entri("tua", sekarang - AturanRiwayat.UMUR_MAKS - 1), entri("muda", sekarang - 1000)))
        assertEquals(listOf<Any>("muda"), ids(cache.baca(sesiA)))
        sekarang += AturanRiwayat.UMUR_MAKS + 1
        assertNull(cache.baca(sesiA))
        assertFalse(cache.berkas(sesiA).exists())
    }

    @Test
    fun paling20Sesi() {
        for (i in 0 until 21) {
            sekarang += 1000
            cache.simpan(riwayat("%08x-0000-4000-8000-000000000000".format(i), entri("e", sekarang)))
        }
        assertEquals(20, folder.listFiles()!!.count { it.name.endsWith(".bin") })
        assertNull(cache.baca("00000000-0000-4000-8000-000000000000")) // terlama dibuang
        assertNotNull(cache.baca("00000014-0000-4000-8000-000000000000"))
    }

    @Test
    fun pangkasBatasUkuranDanUmur() {
        val t = 10_000_000_000L
        val mb = 1024L * 1024
        val hapus = AturanRiwayat.pangkas(
            listOf(
                AturanRiwayat.Berkas("a", t, 2 * mb), AturanRiwayat.Berkas("b", t - 1, 2 * mb),
                AturanRiwayat.Berkas("c", t - 2, 2 * mb), AturanRiwayat.Berkas("d", t - 3, 100),
                AturanRiwayat.Berkas("tua", t - AturanRiwayat.UMUR_MAKS - 1, 10),
            ),
            t,
        )
        assertEquals(setOf("c", "tua"), hapus) // c melewati 5 MB; d kecil masih muat; tua > 7 hari
    }

    @Test
    fun entriPerSesiDibatasi() {
        val banyak = (0 until 1100).map { entri("e$it", sekarang - 10_000 + it) }
        val hasil = AturanRiwayat.gabung(emptyList(), banyak, sekarang)
        assertEquals(AturanRiwayat.MAKS_ENTRI_SESI, hasil.size)
        assertEquals("e1099", hasil.last()["id"])
    }

    @Test
    fun hapusSemua() {
        cache.simpan(riwayat(sesiA, entri("a", sekarang)))
        cache.simpan(riwayat(sesiB, entri("b", sekarang)))
        cache.hapusSemua()
        assertNull(cache.baca(sesiA))
        assertEquals(0, folder.listFiles()?.size ?: 0)
    }
}
