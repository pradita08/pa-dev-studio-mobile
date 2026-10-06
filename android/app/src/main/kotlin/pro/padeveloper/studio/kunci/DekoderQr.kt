package pro.padeveloper.studio.kunci

import com.google.zxing.BarcodeFormat
import com.google.zxing.BinaryBitmap
import com.google.zxing.DecodeHintType
import com.google.zxing.MultiFormatReader
import com.google.zxing.PlanarYUVLuminanceSource
import com.google.zxing.ReaderException
import com.google.zxing.common.HybridBinarizer

/**
 * Dekoder QR offline (ZXing core, Java murni; SEC-77). Tanpa jaringan, tanpa model, tanpa telemetri.
 * Masukan = bidang luminans (Y) satu bingkai kamera; dipotong persegi tengah agar sesuai bingkai bidik di layar.
 * Hanya QR; juga mencoba versi terbalik warnanya (QR terang di atas latar gelap Terminal).
 */
object DekoderQr {
    private val petunjuk: Map<DecodeHintType, Any> = mapOf(
        DecodeHintType.POSSIBLE_FORMATS to listOf(BarcodeFormat.QR_CODE),
        DecodeHintType.ALSO_INVERTED to true,
        DecodeHintType.CHARACTER_SET to "UTF-8",
    )

    /** Pembaca untuk satu thread (MultiFormatReader tidak aman dipakai bersamaan). */
    fun pembaca(): MultiFormatReader = MultiFormatReader().apply { setHints(petunjuk) }

    /**
     * Mengembalikan teks QR atau null bila tidak ada QR terbaca di persegi tengah bingkai.
     * [langkahBaris] = rowStride bidang Y (bisa > [lebar]).
     */
    fun dekode(pembaca: MultiFormatReader, y: ByteArray, lebar: Int, tinggi: Int, langkahBaris: Int = lebar): String? {
        require(lebar > 0 && tinggi > 0 && langkahBaris >= lebar) { "ukuran bingkai" }
        val sisi = minOf(lebar, tinggi)
        val kiri = (lebar - sisi) / 2
        val atas = (tinggi - sisi) / 2
        require(y.size >= (atas + sisi - 1) * langkahBaris + kiri + sisi) { "bidang Y terlalu pendek" }
        val potong = ByteArray(sisi * sisi)
        for (r in 0 until sisi) System.arraycopy(y, (atas + r) * langkahBaris + kiri, potong, r * sisi, sisi)
        val sumber = PlanarYUVLuminanceSource(potong, sisi, sisi, 0, 0, sisi, sisi, false)
        return try {
            pembaca.decodeWithState(BinaryBitmap(HybridBinarizer(sumber))).text
        } catch (e: ReaderException) {
            null
        } finally {
            pembaca.reset()
        }
    }
}
