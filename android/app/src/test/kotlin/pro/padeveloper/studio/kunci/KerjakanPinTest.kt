package pro.padeveloper.studio.kunci

import android.security.keystore.KeyProperties
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Test
import pro.padeveloper.studio.kunci.UjiBantu.m
import pro.padeveloper.studio.kunci.UjiBantu.s

/**
 * G3 (item #10964) Kerjakan mode sesi "buka aplikasi sekali": petunjuk `kerjakan_pin` di QR (kontrak pasang), parameter kunci
 * K_kerjakan (S-G3-5: sesi 300 dtk + BIO|DEVCRED; tanpa petunjuk 0 + BIO), dan "Pasang ulang" (KF-07).
 * Pasangan Mac: uji/pelaksana/uji-pin.js (repo kantor) — atestasi menuntut userAuthType 3 + 1..300 / 2 + 0.
 */
class KerjakanPinTest {
    private fun qrVektor(): Triple<LinkedHashMap<String, Any>, Long, String> {
        assumeTrue("vektor belum ada (kontrak/vektor-e2e.json)", UjiBantu.ada("vektor-e2e.json"))
        val v = UjiBantu.baca("vektor-e2e.json")
        val qr = LinkedHashMap(m(m(v["pasang"])["qr"]))
        return Triple(qr, qr["kedaluwarsa"] as Long - 60_000, s(m(v["konteks"])["relay"]))
    }

    private fun urai(o: Map<String, Any>, sekarang: Long, relay: String): Any =
        runCatching { Pasang.uraiQr(Jcs.teks(o), sekarang, relay) }.getOrElse { (it as GalatKunci).kode }

    @Test
    fun qrTanpaPetunjukTetapSidikJari() {
        val (qr, t, relay) = qrVektor()
        assertFalse((urai(qr, t, relay) as DataQr).kerjakanPin)
    }

    @Test
    fun qrDenganPetunjukPin() {
        val (qr, t, relay) = qrVektor()
        assertTrue((urai(LinkedHashMap(qr).apply { put("kerjakan_pin", true) }, t, relay) as DataQr).kerjakanPin)
        assertFalse((urai(LinkedHashMap(qr).apply { put("kerjakan_pin", false) }, t, relay) as DataQr).kerjakanPin)
    }

    @Test
    fun qrPetunjukRusakDitolak() {
        val (qr, t, relay) = qrVektor()
        assertEquals("qr_tidak_sah", urai(LinkedHashMap(qr).apply { put("kerjakan_pin", "ya") }, t, relay))
        assertEquals("qr_tidak_sah", urai(LinkedHashMap(qr).apply { put("kerjakan_pin", 1L) }, t, relay))
        assertEquals("qr_tidak_sah", urai(LinkedHashMap(qr).apply { put("kerjakan_pin", true); put("tambahan", "x") }, t, relay))
    }

    @Test
    fun parameterKunciKerjakanMengikutiMode() {
        // mode sesi: sama dengan K_rencana (300 dtk, sidik jari ATAU PIN) → atestasi userAuthType 3, authTimeout 300
        assertEquals(300 to (KeyProperties.AUTH_BIOMETRIC_STRONG or KeyProperties.AUTH_DEVICE_CREDENTIAL), KunciKeystore.parameterKerjakan(true))
        assertEquals(3, KunciKeystore.parameterKerjakan(true).second)
        // tanpa petunjuk: tiap pemakaian, sidik jari saja → userAuthType 2, timeout 0 (tidak berubah)
        assertEquals(0 to KeyProperties.AUTH_BIOMETRIC_STRONG, KunciKeystore.parameterKerjakan(false))
        assertEquals(2, KunciKeystore.parameterKerjakan(false).second)
    }

    @Test
    fun pasangUlangBilaKunciTidakSesuaiSetelanMac() {
        assertTrue(Pasang.perluPasangUlang(macPin = true, kunciPin = false))   // HP lama sidik jari, Mac pindah ke mode sesi
        assertTrue(Pasang.perluPasangUlang(macPin = false, kunciPin = true))   // Mac kembali ke sidik jari → kunci sesi ditolak Mac
        assertFalse(Pasang.perluPasangUlang(macPin = true, kunciPin = true))
        assertFalse(Pasang.perluPasangUlang(macPin = false, kunciPin = false))
        assertFalse(Pasang.perluPasangUlang(macPin = null, kunciPin = false))  // status belum ada → tidak diketahui
    }
}
