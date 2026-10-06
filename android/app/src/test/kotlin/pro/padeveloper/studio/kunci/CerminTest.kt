package pro.padeveloper.studio.kunci

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Test
import pro.padeveloper.studio.kunci.UjiBantu.m
import pro.padeveloper.studio.kunci.UjiBantu.s

/**
 * KONTRAK-apk-v2 §2.1–2.2 (F1): perintah cermin_* disusun & dicek dengan skema Mac; kabar cermin_sesi/cermin/cermin_riwayat
 * diurai ketat (field tak dikenal / nilai di luar kontrak → isi_bentuk), termasuk lewat amplop bertanda S_mac utuh.
 */
class CerminTest {
    private val sesiA = "0f8fad5b-d9cb-469f-a165-70867728950e"
    private val umum = linkedMapOf<String, Any>(
        "mac_id" to "dac41f4ed3e1ec5d", "perangkat_id" to "1f600ae09b7479f9", "urut_mac" to 1_791_000_000_001L,
        "dibuat" to 1_791_000_000_000L,
    )

    private fun perintah(jenis: String, tambahan: Map<String, Any>): String? = runCatching {
        Perintah.isi(jenis, "dac41f4ed3e1ec5d", "1f600ae09b7479f9", "0".repeat(32), 1, 1, 2, tambahan)
    }.exceptionOrNull()?.let { (it as GalatKunci).kode }

    // ------------------------------------------------------------------ perintah

    @Test
    fun perintahCerminSah() {
        assertNull(perintah("cermin_daftar", mapOf("sejakJam" to 48L)))
        assertNull(perintah("cermin_daftar", mapOf("sejakHari" to 30L, "cari" to "simpeg", "proyek" to "sim-gaji-2")))
        assertNull(perintah("cermin_buka", mapOf("sesi" to JsonNull)))
        assertNull(perintah("cermin_buka", mapOf("sesi" to sesiA, "proyek" to "kantor", "akun" to "akun2")))
        assertNull(perintah("cermin_tutup", emptyMap()))
        assertNull(perintah("cermin_riwayat", mapOf("sesi" to sesiA, "proyek" to "kantor", "akun" to "akun2", "batas" to 50L)))
        assertNull(perintah("cermin_riwayat", mapOf("sesi" to sesiA, "proyek" to "kantor", "akun" to "akun2", "batas" to 1L, "sebelum" to "k".repeat(64))))
    }

    @Test
    fun perintahCerminSalahDitolak() {
        val t = "perintah_tidak_sah"
        assertEquals(t, perintah("cermin_daftar", emptyMap()))                                     // tanpa sejak*
        assertEquals(t, perintah("cermin_daftar", mapOf("sejakJam" to 1L, "sejakHari" to 1L)))     // keduanya
        assertEquals(t, perintah("cermin_daftar", mapOf("sejakJam" to 49L)))
        assertEquals(t, perintah("cermin_daftar", mapOf("sejakHari" to 31L)))
        assertEquals(t, perintah("cermin_daftar", mapOf("sejakJam" to 2.0)))
        assertEquals(t, perintah("cermin_daftar", mapOf("sejakJam" to 1L, "cari" to "x".repeat(41))))
        assertEquals(t, perintah("cermin_daftar", mapOf("sejakJam" to 1L, "proyek" to "Proyek/../x")))
        assertEquals(t, perintah("cermin_daftar", mapOf("sejakJam" to 1L, "semua" to true)))      // field tak dikenal
        assertEquals(t, perintah("cermin_buka", emptyMap()))                                       // sesi wajib (boleh null)
        assertEquals(t, perintah("cermin_buka", mapOf("sesi" to "../../x.jsonl")))
        assertEquals(t, perintah("cermin_tutup", mapOf("sesi" to sesiA)))
        assertEquals(t, perintah("cermin_riwayat", mapOf("sesi" to sesiA, "proyek" to "kantor", "akun" to "akun2", "batas" to 0L)))
        assertEquals(t, perintah("cermin_riwayat", mapOf("sesi" to sesiA, "proyek" to "kantor", "akun" to "akun2", "batas" to 51L)))
        assertEquals(t, perintah("cermin_riwayat", mapOf("sesi" to sesiA, "proyek" to "kantor", "batas" to 5L)))
        assertEquals(t, perintah("cermin_riwayat", mapOf("sesi" to sesiA, "proyek" to "kantor", "akun" to "akun2", "batas" to 5L, "sebelum" to "")))
        assertEquals(Alasan.ISI_BENTUK, AmplopV1.cekIsiPerintah(mapOf("jenis" to "cermin_hapus")))
    }

    // ------------------------------------------------------------------ kabar

    private fun butirSesi(): LinkedHashMap<String, Any> = linkedMapOf(
        "sesi" to sesiA, "akun" to "akun2", "proyek" to "kantor", "judul" to "Perbaiki kartu sesi", "asal" to "vscode",
        "status" to "bekerja", "terbuka" to true, "mulai" to 1_790_990_000_000L, "terakhir" to 1_790_999_000_000L,
        "divisi" to listOf(mapOf("peran" to "divisi-programmer", "status" to "bekerja")),
        "alat" to mapOf("alat" to "Bash", "ringkas" to "npm test"), "bisaLanjut" to "cabang", "keputusan_n" to 0L, "tingkat" to "ringkas",
    )

    private fun ev(): LinkedHashMap<String, Any> = linkedMapOf(
        "sesi" to sesiA, "ts" to 1_790_999_000_000L, "kind" to "tool", "who" to JsonNull, "agentId" to JsonNull,
        "tool" to "Edit", "detail" to "lib/a.dart", "sub" to JsonNull,
    )

    private fun entri(id: Any, waktu: Long, teks: String? = null): LinkedHashMap<String, Any> =
        linkedMapOf<String, Any>("id" to id, "waktu" to waktu, "peran" to "claude").also { e -> teks?.let { e["teks"] = it } }

    private fun kabar(jenis: String, muatan: Any): LinkedHashMap<String, Any> =
        LinkedHashMap(umum).apply { put("jenis", jenis); put(jenis, muatan) }

    private fun cerminSesi(vararg b: Map<String, Any>) = kabar("cermin_sesi", linkedMapOf("sesi" to b.toList(), "lagi" to false))
    private fun cermin(vararg e: Map<String, Any>) = kabar("cermin", linkedMapOf("urut_cermin" to 7L, "ev" to e.toList()))
    private fun riwayat(entri: List<Map<String, Any>>, tambah: Map<String, Any> = emptyMap()) = kabar(
        "cermin_riwayat",
        linkedMapOf<String, Any>("sesi" to sesiA, "entri" to entri, "lagi" to true, "sebelum" to "c-12", "versiParser" to "2.1.286").apply { putAll(tambah) },
    )

    @Test
    fun kabarCerminSahDiurai() {
        assertNull(AmplopV1.cekIsiKabar(cerminSesi(butirSesi())))
        assertNull(AmplopV1.cekIsiKabar(cerminSesi(butirSesi().apply { remove("alat") })))
        assertNull(AmplopV1.cekIsiKabar(cerminSesi(butirSesi().apply { put("alat", JsonNull) })))
        assertNull(AmplopV1.cekIsiKabar(cerminSesi()))
        assertNull(AmplopV1.cekIsiKabar(cermin(ev(), ev().apply { put("kind", "stop"); put("text", "Selesai."); remove("tool"); remove("detail") })))
        assertNull(AmplopV1.cekIsiKabar(riwayat(listOf(entri("a1", 1L, "halo"), entri(2L, 2L)))))
        assertNull(AmplopV1.cekIsiKabar(riwayat(emptyList(), mapOf("galat" to "format_tidak_dikenal", "versiParser" to 3L))))
    }

    @Test
    fun kabarCerminFieldTakDikenalDitolak() {
        val tolak = Alasan.ISI_BENTUK
        // tingkat atas
        assertEquals(tolak, AmplopV1.cekIsiKabar(cerminSesi(butirSesi()).apply { put("ekstra", 1L) }))
        assertEquals(tolak, AmplopV1.cekIsiKabar(cerminSesi(butirSesi()).apply { put("cermin", "x") }))
        // muatan & butir
        assertEquals(tolak, AmplopV1.cekIsiKabar(kabar("cermin_sesi", linkedMapOf("sesi" to emptyList<Any>(), "lagi" to false, "cwd" to "/x"))))
        assertEquals(tolak, AmplopV1.cekIsiKabar(cerminSesi(butirSesi().apply { put("cwd", "/Users/x/proyek") })))
        assertEquals(tolak, AmplopV1.cekIsiKabar(cerminSesi(butirSesi().apply { put("transcript_path", "/x.jsonl") })))
        assertEquals(tolak, AmplopV1.cekIsiKabar(cerminSesi(butirSesi().apply { put("alat", mapOf("alat" to "Bash", "ringkas" to "x", "tool_input" to "rm")) })))
        assertEquals(tolak, AmplopV1.cekIsiKabar(cerminSesi(butirSesi().apply { put("divisi", listOf(mapOf("peran" to "x", "status" to "y", "email" to "a@b.c"))) })))
        assertEquals(tolak, AmplopV1.cekIsiKabar(cermin(ev().apply { put("session", sesiA) })))
        assertEquals(tolak, AmplopV1.cekIsiKabar(cermin(ev().apply { put("type", "permission_prompt") })))
        assertEquals(tolak, AmplopV1.cekIsiKabar(riwayat(listOf(entri("a", 1L).apply { put("toolUseResult", "isi") }))))
        assertEquals(tolak, AmplopV1.cekIsiKabar(riwayat(listOf(entri("a", 1L)), mapOf("cwd" to "/x"))))
    }

    @Test
    fun kabarCerminNilaiDiLuarKontrakDitolak() {
        val tolak = Alasan.ISI_BENTUK
        assertEquals(tolak, AmplopV1.cekIsiKabar(cerminSesi(butirSesi().apply { put("sesi", "bukan-uuid") })))
        assertEquals(tolak, AmplopV1.cekIsiKabar(cerminSesi(butirSesi().apply { put("status", "aneh") })))
        assertEquals(tolak, AmplopV1.cekIsiKabar(cerminSesi(butirSesi().apply { put("tingkat", "semua") })))
        assertEquals(tolak, AmplopV1.cekIsiKabar(cerminSesi(butirSesi().apply { put("judul", "x".repeat(61)) })))
        assertEquals(tolak, AmplopV1.cekIsiKabar(cerminSesi(butirSesi().apply { remove("bisaLanjut") })))
        assertEquals(tolak, AmplopV1.cekIsiKabar(cerminSesi(*Array(51) { butirSesi() })))
        assertEquals(tolak, AmplopV1.cekIsiKabar(cermin(ev().apply { put("kind", "rahasia") })))
        assertEquals(tolak, AmplopV1.cekIsiKabar(cermin(*Array(61) { ev() })))
        assertEquals(tolak, AmplopV1.cekIsiKabar(riwayat(listOf(entri("a", 1L, "x".repeat(4001))))))
        assertEquals(tolak, AmplopV1.cekIsiKabar(riwayat(listOf(entri("a", 1L).apply { put("peran", "root") }))))
        assertEquals(tolak, AmplopV1.cekIsiKabar(riwayat(List(51) { entri("e$it", it.toLong()) })))
        // galat wajib tanpa entri
        assertEquals(tolak, AmplopV1.cekIsiKabar(riwayat(listOf(entri("a", 1L)), mapOf("galat" to "format_tidak_dikenal"))))
        assertEquals(tolak, AmplopV1.cekIsiKabar(riwayat(emptyList(), mapOf("galat" to "lain"))))
    }

    /** Amplop kabar utuh (kunci uji vektor-e2e.json): bertanda S_mac → lolos; isi dengan field tak dikenal → isi_bentuk. */
    @Test
    fun amplopKabarCerminLewatPemeriksa() {
        assumeTrue("apk/kontrak/vektor-e2e.json tidak ada", UjiBantu.ada("vektor-e2e.json"))
        val v = UjiBantu.baca("vektor-e2e.json")
        val ku = UjiBantu.KunciUji(v)
        val konteks = m(v["konteks"])
        val sekarang = konteks["sekarang"] as Long
        fun periksa(isi: Map<String, Any>): HasilPeriksa {
            val a = AmplopV1.buat("kabar", ku.id("s_mac"), ku.publikX("e_hp"), isi, sekarang + 600_000, ku.penanda("s_mac"))
            return AmplopV1.periksa(
                Jcs.teks(a),
                AmplopV1.Opsi(
                    "kabar", { if (it == ku.id("s_mac")) KunciTanda(ku.spki("s_mac"), "s_mac") else null }, listOf(ku.privatX("e_hp")),
                    s(konteks["mac_id"]), s(konteks["perangkat_id"]), sekarang, PenyimpanReplayMemori(),
                ),
            )
        }
        val sah = periksa(riwayat(listOf(entri("a", 1L, "halo"))).apply { put("urut_mac", sekarang); put("dibuat", sekarang) })
        assertTrue(sah.alasan, sah.ok)
        assertEquals("cermin_riwayat", sah.isi!!["jenis"])
        val asing = periksa(cerminSesi(butirSesi().apply { put("cwd", "/x") }).apply { put("urut_mac", sekarang); put("dibuat", sekarang) })
        assertFalse(asing.ok)
        assertEquals(Alasan.ISI_BENTUK, asing.alasan)
    }
}
