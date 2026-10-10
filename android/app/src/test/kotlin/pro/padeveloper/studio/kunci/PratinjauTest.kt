package pro.padeveloper.studio.kunci

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Roadmap 2b/2c (pelaksana-pratinjau.js): perintah `pratinjau` & kabar `pratinjau` / `pratinjau_gambar` ketat, sama dengan
 * uji/pelaksana/uji-pratinjau.js (repo kantor). Alamat yang boleh dibuka hanya https *.ts.net dengan port.
 */
class PratinjauTest {
    private fun perintah(tambahan: Map<String, Any>): String? = runCatching {
        Perintah.isi("pratinjau", "dac41f4ed3e1ec5d", "1f600ae09b7479f9", "0".repeat(32), 1, 1, 2, tambahan)
    }.exceptionOrNull()?.let { (it as GalatKunci).kode }

    private fun kabar(jenis: String, m: Any?): String? = AmplopV1.cekIsiKabar(
        linkedMapOf<String, Any>(
            "mac_id" to "dac41f4ed3e1ec5d", "perangkat_id" to "1f600ae09b7479f9", "urut_mac" to 1L, "dibuat" to 1L,
            "jenis" to jenis, jenis to (m ?: JsonNull),
        ),
    )

    private fun butir(vararg ubah: Pair<String, Any?>): Map<String, Any?> = linkedMapOf<String, Any?>(
        "proyek" to "simpeg", "status" to "menyala", "bisaMulai" to true, "alamat" to "https://macbook.tail1234.ts.net:8443/beranda", "sampai" to 2L,
    ).apply { for ((k, v) in ubah) if (v == null) remove(k) else put(k, v) }

    private fun gambar(vararg ubah: Pair<String, Any?>): Map<String, Any?> = linkedMapOf<String, Any?>(
        "proyek" to "simpeg", "ukuran" to "hp", "jpeg" to "/9j/4AAQSkZJRg==", "lebar" to 390L, "tinggi" to 844L,
    ).apply { for ((k, v) in ubah) if (v == null) remove(k) else put(k, v) }

    @Test
    fun perintahSahDanSalah() {
        for (a in listOf("daftar", "mulai", "henti", "potret")) assertNull(perintah(mapOf("proyek" to "simpeg", "aksi" to a)))
        val t = "perintah_tidak_sah"
        assertEquals(t, perintah(mapOf("proyek" to "simpeg", "aksi" to "shell")))
        assertEquals(t, perintah(mapOf("proyek" to "Simpeg Baru", "aksi" to "mulai")))
        assertEquals(t, perintah(mapOf("proyek" to "simpeg", "aksi" to "mulai", "perintah" to listOf("sh"))))
        assertEquals(t, perintah(mapOf("aksi" to "mulai")))
        assertEquals(180_000L, AmplopV1.masaMaks("perintah", mapOf("jenis" to "pratinjau")))
    }

    @Test
    fun kabarSahDanSalah() {
        assertNull(kabar("pratinjau", mapOf("daftar" to listOf(butir()))))
        assertNull(kabar("pratinjau", mapOf("daftar" to listOf(butir("status" to "mati", "alamat" to null, "sampai" to null)))))
        assertNull(kabar("pratinjau", mapOf("daftar" to listOf(butir("status" to "gagal", "alamat" to null, "galat" to "port dipakai")))))
        assertNull(kabar("pratinjau_gambar", gambar()))
        val t = Alasan.ISI_BENTUK
        assertEquals(t, kabar("pratinjau", mapOf("daftar" to listOf(butir("alamat" to "https://contoh.com:8443/")))))
        assertEquals(t, kabar("pratinjau", mapOf("daftar" to listOf(butir("alamat" to "http://macbook.tail1234.ts.net:8443/")))))
        assertEquals(t, kabar("pratinjau", mapOf("daftar" to listOf(butir("alamat" to "https://macbook.tail1234.ts.net/")))))
        assertEquals(t, kabar("pratinjau", mapOf("daftar" to listOf(butir("status" to "x")))))
        assertEquals(t, kabar("pratinjau", mapOf("daftar" to listOf(butir("perintah" to "npm run dev")))))
        assertEquals(t, kabar("pratinjau", mapOf("daftar" to List(11) { butir() })))
        assertEquals(t, kabar("pratinjau_gambar", gambar("jpeg" to "bukan base64!")))
        assertEquals(t, kabar("pratinjau_gambar", gambar("jpeg" to "A".repeat(56004))))
        assertEquals(t, kabar("pratinjau_gambar", gambar("ukuran" to "tablet")))
        assertEquals(t, kabar("pratinjau_gambar", gambar("lebar" to 0L)))
    }

    @Test
    fun alamatDanButir() {
        assertTrue(Pratinjau.alamatSah("https://macbook.tail1234.ts.net:8443/app/?x=1"))
        assertFalse(Pratinjau.alamatSah("https://macbook.tail1234.ts.net.evil.com:8443/"))
        assertFalse(Pratinjau.alamatSah("javascript:alert(1)"))
        val snap = mapOf<String, Any>("pratinjau" to mapOf("daftar" to listOf(butir())))
        assertNotNull(Pratinjau.cariButir(snap, "simpeg"))
        assertNull(Pratinjau.cariButir(snap, "lain"))
    }
}
