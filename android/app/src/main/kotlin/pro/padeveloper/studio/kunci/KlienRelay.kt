package pro.padeveloper.studio.kunci

import java.io.ByteArrayOutputStream
import java.io.IOException
import java.io.InputStream
import java.net.URL
import javax.net.ssl.HttpsURLConnection

/**
 * Klien HTTP relay (kontrak §4): HTTPS saja (juga dipaksa Network Security Config), tanpa ikut redirect, header
 * `X-Padev-Klien: apk/<semver>`, token Bearer hanya di header (tidak pernah di URL), batas ukuran kirim/terima.
 * Isi permintaan/jawaban tidak pernah ditulis ke log.
 */
class KlienRelay(private val dasar: String, private val versiApk: String, private val token: () -> String?) {
    class Jawaban(val kode: Int, val data: Map<String, Any>?)

    init {
        require(dasar.startsWith("https://") && dasar.endsWith("/")) { "relay harus https" }
    }

    fun panggil(metode: String, jalur: String, body: Map<String, Any>? = null, pakaiToken: Boolean = true): Jawaban {
        require(Regex("^[a-z0-9/_?=&.-]+$").matches(jalur) && !jalur.startsWith("/") && !jalur.contains("..")) { "jalur tidak sah" }
        val muatan = body?.let { Jcs.bytes(it) }
        if (muatan != null && muatan.size > MAKS_KIRIM) throw GalatKunci("terlalu_besar")
        val url = URL(dasar + jalur)
        if (url.protocol != "https") throw GalatKunci("relay_tidak_aman")
        val k = try { url.openConnection() as HttpsURLConnection } catch (e: IOException) { throw GalatKunci("jaringan") }
        try {
            k.instanceFollowRedirects = false
            k.useCaches = false
            k.connectTimeout = 10_000
            k.readTimeout = 20_000
            k.requestMethod = metode
            k.setRequestProperty("X-Padev-Klien", "apk/$versiApk")
            k.setRequestProperty("Accept", "application/json")
            if (pakaiToken) {
                val t = token()?.takeIf { Heks.POLA64.matches(it) } ?: throw GalatKunci("belum_terpasang")
                k.setRequestProperty("Authorization", "Bearer $t")
            }
            if (muatan != null) {
                k.doOutput = true
                k.setRequestProperty("Content-Type", "application/json; charset=utf-8")
                k.setFixedLengthStreamingMode(muatan.size)
                k.outputStream.use { it.write(muatan) }
            }
            val kode = k.responseCode
            if (kode in 300..399) throw GalatKunci("relay_alihkan")
            val aliran = if (kode >= 400) k.errorStream else k.inputStream
            val teks = aliran?.let { bacaTerbatas(it) }?.takeIf { it.isNotEmpty() }?.let { JsonKetat.utf8(it) }
            val o = teks?.let { try { JsonKetat.objek(it) } catch (e: JsonSalah) { throw GalatKunci("relay_jawaban_rusak") } }
            if (kode >= 400) {
                @Suppress("UNCHECKED_CAST")
                val galat = (o?.get("galat") as? Map<String, Any>)?.get("kode") as? String
                throw GalatKunci(galat?.takeIf { Regex("^[a-z_]{1,40}$").matches(it) } ?: "relay_$kode")
            }
            @Suppress("UNCHECKED_CAST")
            return Jawaban(kode, o?.get("data") as? Map<String, Any>)
        } catch (e: GalatKunci) {
            throw e
        } catch (e: IOException) {
            throw GalatKunci("jaringan")
        } finally {
            k.disconnect()
        }
    }

    private fun bacaTerbatas(s: InputStream): ByteArray = s.use {
        val keluar = ByteArrayOutputStream()
        val buf = ByteArray(8192)
        while (true) {
            val n = it.read(buf)
            if (n < 0) break
            keluar.write(buf, 0, n)
            if (keluar.size() > MAKS_TERIMA) throw GalatKunci("terlalu_besar")
        }
        keluar.toByteArray()
    }

    companion object {
        const val MAKS_KIRIM = 300 * 1024
        const val MAKS_TERIMA = 3 * 1024 * 1024 // hp/kabar diminta batas=20 × ≤ 96 KB + bungkus JSON
    }
}
