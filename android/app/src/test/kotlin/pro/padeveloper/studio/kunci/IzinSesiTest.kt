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
 * G7 bebas total Tahap B (KONTRAK-apk-v2 §10.12): PIN sekali per sesi (IzinSesi), QR `bebas`, kunci tanpa autentikasi per pakai,
 * dan "Pasang ulang" untuk pasangan bebas. Pasangan Mac: uji/pelaksana/uji-pin.js (kunci noAuth hanya diterima saat bebas).
 */
class IzinSesiTest {
    private val sesiA = "0f1e2d3c-4b5a-4968-8776-655443322110"
    private val sesiB = "11111111-2222-4333-8444-555555555555"
    private val id1 = "a".repeat(32)
    private val id2 = "b".repeat(32)
    private val t0 = 1_800_000_000_000L
    private val jam = 3_600_000L

    @Test
    fun izinBerlaku12JamSejakPesanTerakhir() {
        val iz = IzinSesi.baru()
        val k = iz.kunci("simpeg", "akun1", sesiA, baru = false)
        assertEquals(sesiA, k)
        assertFalse(iz.berlaku(k, t0))                          // belum pernah → PIN
        iz.catat(k, t0, id1)
        assertTrue(iz.berlaku(k, t0 + 11 * jam))                 // pesan ke-2 tanpa prompt
        assertFalse(iz.berlaku(k, t0 + 12 * jam))                // 12 jam tanpa pesan → PIN lagi
        iz.catat(k, t0 + 11 * jam, id2)                          // pesan baru memperpanjang
        assertTrue(iz.berlaku(k, t0 + 22 * jam))
        assertFalse(iz.berlaku(sesiB, t0 + jam))                 // sesi lain tetap minta PIN
        assertFalse(iz.berlaku(k, t0 - jam))                     // jam HP mundur jauh → tidak sah
    }

    @Test
    fun kunciSesiHurufKecil() {
        assertEquals(sesiA, IzinSesi.baru().kunci("p", "akun1", sesiA.uppercase(), baru = false))
    }

    @Test
    fun kerjakanBaruPindahKeSessionIdDanLanjutanChatMemakaiSlot() {
        val iz = IzinSesi.baru()
        val k = iz.kunci("simpeg", "akun1", null, baru = true)
        assertEquals("chat:simpeg:akun1", k)
        iz.catat(k, t0, id1, "simpeg", "akun1", baru = true)
        assertTrue(iz.berlaku(iz.kunci("simpeg", "akun1", null, baru = false), t0 + jam))   // lanjutan sebelum selesai: tanpa prompt
        iz.pindah(id1, sesiA.uppercase())
        assertFalse(iz.berlaku("chat:simpeg:akun1", t0 + jam))
        assertTrue(iz.berlaku(sesiA, t0 + jam))                                     // Balas/Lanjutkan sesi itu dari tab Sesi: tanpa prompt
        assertEquals(sesiA, iz.kunci("simpeg", "akun1", null, baru = false))        // pesan Chat berikutnya → sesi yang sama
        iz.catat(iz.kunci("simpeg", "akun1", null, baru = true), t0 + 2 * jam, id2, "simpeg", "akun1", baru = true)
        assertEquals("chat:simpeg:akun1", iz.kunci("simpeg", "akun1", null, baru = false))  // percakapan baru mengosongkan slot
    }

    @Test
    fun sec164LanjutanChatPerProyekDanAkun() {
        // Mac melanjutkan sesi terakhir per proyek|akun: izin akun1 tidak boleh membuka lanjutan Chat akun2 di proyek yang sama
        val iz = IzinSesi.baru()
        iz.catat(iz.kunci("simpeg", "akun1", null, baru = true), t0, id1, "simpeg", "akun1", baru = true)
        iz.pindah(id1, sesiA)
        val kAkun2 = iz.kunci("simpeg", "akun2", null, baru = false)
        assertEquals("chat:simpeg:akun2", kAkun2)
        assertFalse(iz.berlaku(kAkun2, t0 + jam))                                  // belum ada izin untuk pasangan itu → PIN
        assertEquals(sesiA, iz.kunci("simpeg", "akun1", null, baru = false))        // akun1 tetap ke sesinya
        assertFalse(iz.berlaku(iz.kunci("lain", "akun1", null, baru = false), t0 + jam))   // proyek lain → PIN
        // percakapan baru akun2 tidak menghapus slot akun1
        iz.catat(iz.kunci("simpeg", "akun2", null, baru = true), t0 + jam, id2, "simpeg", "akun2", baru = true)
        assertEquals(sesiA, iz.kunci("simpeg", "akun1", null, baru = false))
        // format lama (`chat:<proyek>` / slot per proyek) tidak berlaku lagi → PIN
        val lama = IzinSesi.dari("""{"izin":{"chat:simpeg":$t0},"slot":{"simpeg":"$sesiB"},"tugas":{}}""")
        assertEquals("chat:simpeg:akun1", lama.kunci("simpeg", "akun1", null, baru = false))
        assertFalse(lama.berlaku(lama.kunci("simpeg", "akun1", null, baru = false), t0 + jam))
    }

    @Test
    fun pindahHanyaUntukChatDanUuidSah() {
        val iz = IzinSesi.baru()
        iz.catat(sesiA, t0, id1)
        iz.pindah(id1, sesiB)                                     // izin sesi (bukan chat:) tidak dipindah
        assertTrue(iz.berlaku(sesiA, t0)); assertFalse(iz.berlaku(sesiB, t0))
        iz.catat("chat:p:a", t0, id2, "p", "a", baru = true)
        iz.pindah(id2, "bukan-uuid")
        assertTrue(iz.berlaku("chat:p:a", t0))
        iz.pindah("c".repeat(32), sesiB)                          // perintah tak dikenal → diam
        assertFalse(iz.berlaku(sesiB, t0))
    }

    @Test
    fun sesiSelesaiDanSambungBerakhirMencabutIzin() {
        val iz = IzinSesi.baru()
        iz.catat(sesiA, t0, id1); iz.catat(sesiB, t0, id2)
        iz.hapusSesi(sesiA.uppercase())
        assertFalse(iz.berlaku(sesiA, t0))
        iz.hapusPerintah(id2)                                     // tanda terima sambung_berakhir
        assertFalse(iz.berlaku(sesiB, t0))
    }

    @Test
    fun simpanMuatUlangTetapBerlakuDanRusakGagalKePin() {
        val iz = IzinSesi.baru()
        iz.catat("chat:p:a", t0, id1, "p", "a", baru = true)
        iz.pindah(id1, sesiA)
        val muat = IzinSesi.dari(iz.keJson())                     // aplikasi ditutup / HP restart (Q3)
        assertTrue(muat.berlaku(sesiA, t0 + jam))
        assertEquals(sesiA, muat.kunci("p", "a", null, baru = false))
        assertTrue(IzinSesi.dari(null).kosong())
        assertTrue(IzinSesi.dari("{rusak").kosong())
        assertFalse(IzinSesi.dari("""{"izin":{"$sesiA":"x"}}""").berlaku(sesiA, t0))
    }

    @Test
    fun jumlahDibatasi() {
        val iz = IzinSesi.baru()
        for (i in 0 until 150) iz.catat("chat:p$i", t0 + i, i.toString(16).padStart(32, '0'))
        assertFalse(iz.berlaku("chat:p0", t0 + 200))              // terlama dibuang
        assertTrue(iz.berlaku("chat:p149", t0 + 200))
    }

    // ---------------------------------------------------------------- QR `bebas` & parameter kunci

    private fun qrVektor(): Triple<LinkedHashMap<String, Any>, Long, String> {
        assumeTrue("vektor belum ada (kontrak/vektor-e2e.json)", UjiBantu.ada("vektor-e2e.json"))
        val v = UjiBantu.baca("vektor-e2e.json")
        val qr = LinkedHashMap(m(m(v["pasang"])["qr"]))
        return Triple(qr, qr["kedaluwarsa"] as Long - 60_000, s(m(v["konteks"])["relay"]))
    }

    private fun urai(o: Map<String, Any>, sekarang: Long, relay: String): Any =
        runCatching { Pasang.uraiQr(Jcs.teks(o), sekarang, relay) }.getOrElse { (it as GalatKunci).kode }

    @Test
    fun qrBebas() {
        val (qr, t, relay) = qrVektor()
        assertFalse((urai(qr, t, relay) as DataQr).bebas)                                         // penawaran lama = perilaku lama
        val b = urai(LinkedHashMap(qr).apply { put("kerjakan_pin", true); put("bebas", true) }, t, relay) as DataQr
        assertTrue(b.bebas); assertTrue(b.kerjakanPin)
        assertTrue((urai(LinkedHashMap(qr).apply { put("bebas", true) }, t, relay) as DataQr).bebas)
        assertEquals("qr_tidak_sah", urai(LinkedHashMap(qr).apply { put("bebas", "ya") }, t, relay))
        assertEquals("qr_tidak_sah", urai(LinkedHashMap(qr).apply { put("bebas", true); put("lain", true) }, t, relay))
        assertEquals("qr_tidak_sah", urai(LinkedHashMap(qr).apply { remove("mac_id"); put("bebas", true) }, t, relay))
    }

    @Test
    fun parameterKunciBebasTanpaAutentikasi() {
        assertNull(KunciKeystore.parameterKunci(kerjakan = true, pin = true, bebas = true))
        assertNull(KunciKeystore.parameterKunci(kerjakan = false, pin = false, bebas = true))
        // tanpa bebas: persis seperti sebelumnya
        assertEquals(KunciKeystore.parameterKerjakan(true), KunciKeystore.parameterKunci(kerjakan = true, pin = true, bebas = false))
        assertEquals(KunciKeystore.parameterKerjakan(false), KunciKeystore.parameterKunci(kerjakan = true, pin = false, bebas = false))
        assertEquals(300 to 3, KunciKeystore.parameterKunci(kerjakan = false, pin = false, bebas = false))
    }

    @Test
    fun pasangUlangPasanganBebas() {
        assertTrue(Pasang.perluPasangUlang(macPin = true, kunciPin = true, macBebas = false, kunciBebas = true))   // bebas dimatikan
        assertFalse(Pasang.perluPasangUlang(macPin = true, kunciPin = true, macBebas = true, kunciBebas = true))
        assertFalse(Pasang.perluPasangUlang(macPin = false, kunciPin = true, macBebas = true, kunciBebas = true))  // pin tak relevan
        assertFalse(Pasang.perluPasangUlang(macPin = null, kunciPin = false, macBebas = null, kunciBebas = true))
        assertTrue(Pasang.perluPasangUlang(macPin = true, kunciPin = true, macBebas = true, kunciBebas = false))   // kunci lama → PIN per sesi
        assertFalse(Pasang.perluPasangUlang(macPin = true, kunciPin = true, macBebas = false, kunciBebas = false))
    }
}
