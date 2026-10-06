package pro.padeveloper.studio.kunci

import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.google.zxing.qrcode.QRCodeWriter
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/** Pemindai QR offline (SEC-77): bingkai luminans sintetis → DekoderQr. */
class DekoderQrTest {
    // Bentuk & panjang setara QR pemasangan kontrak §3.2 (nilai uji, bukan rahasia asli).
    private val isiQr = "{\"v\":1,\"relay\":\"https://padev-studio.pa-developer.pro/api/v1/\",\"mac_id\":\"0123456789abcdef\"," +
        "\"nama_mac\":\"MacBook Uji\",\"kode_daftar\":\"00112233445566778899aabbccddeeff\"," +
        "\"rahasia\":\"" + "A".repeat(43) + "\",\"s_mac\":\"" + "B".repeat(122) + "\",\"e_mac\":\"" + "C".repeat(43) +
        "\",\"kedaluwarsa\":1791000300000}"

    /** Bingkai lebar×tinggi (+ padding baris) berisi QR di tengah; [terbalik] = modul terang di latar gelap (Terminal gelap). */
    private fun bingkai(lebar: Int, tinggi: Int, sisiQr: Int, langkah: Int = lebar, terbalik: Boolean = false, teks: String = isiQr): ByteArray {
        val m = QRCodeWriter().encode(teks, BarcodeFormat.QR_CODE, sisiQr, sisiQr, mapOf(EncodeHintType.MARGIN to 4, EncodeHintType.CHARACTER_SET to "UTF-8"))
        val gelap: Byte = if (terbalik) 0xF0.toByte() else 0x10
        val terang: Byte = if (terbalik) 0x10 else 0xF0.toByte()
        val y = ByteArray(langkah * tinggi) { if (terbalik) 0x10 else 0xC8.toByte() }
        val x0 = (lebar - m.width) / 2
        val y0 = (tinggi - m.height) / 2
        for (r in 0 until m.height) for (c in 0 until m.width) y[(y0 + r) * langkah + x0 + c] = if (m.get(c, r)) gelap else terang
        return y
    }

    @Test
    fun qrPemasanganTerbaca() {
        assertEquals(isiQr, DekoderQr.dekode(DekoderQr.pembaca(), bingkai(1280, 720, 600), 1280, 720))
    }

    @Test
    fun rowStrideLebihBesarDariLebar() {
        val p = DekoderQr.pembaca()
        assertEquals(isiQr, DekoderQr.dekode(p, bingkai(1280, 720, 600, langkah = 1344), 1280, 720, 1344))
        // pembaca yang sama bisa dipakai ulang untuk bingkai berikutnya
        assertEquals(isiQr, DekoderQr.dekode(p, bingkai(720, 1280, 600), 720, 1280))
    }

    @Test
    fun qrTerbalikTerbaca() {
        assertEquals(isiQr, DekoderQr.dekode(DekoderQr.pembaca(), bingkai(1280, 720, 600, terbalik = true), 1280, 720))
    }

    @Test
    fun bingkaiTanpaQrNull() {
        val kosong = ByteArray(640 * 480) { ((it * 31) % 251).toByte() }
        assertNull(DekoderQr.dekode(DekoderQr.pembaca(), kosong, 640, 480))
    }

    @Test(expected = IllegalArgumentException::class)
    fun bidangTerlaluPendekDitolak() {
        DekoderQr.dekode(DekoderQr.pembaca(), ByteArray(100), 640, 480)
    }
}
