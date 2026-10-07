package pro.padeveloper.studio.kunci

import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import androidx.fragment.app.FragmentActivity
import io.flutter.plugin.common.BinaryMessenger
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel
import java.util.concurrent.Executors

/**
 * Kanal `pro.padeveloper.studio/kunci` — satu-satunya jalan UI Dart ke native (fasad: lib/kunci/kunci.dart).
 * Argumen divalidasi di sini; galat dikirim sebagai kode pendek (tanpa isi/rahasia). Metode `uji*` hanya ada di build debug.
 */
class PluginKunci(messenger: BinaryMessenger, private val aktivitas: FragmentActivity) : MethodChannel.MethodCallHandler {
    private val kanal = MethodChannel(messenger, NAMA)
    private val latar = Executors.newSingleThreadExecutor()
    private val utama = Handler(Looper.getMainLooper())
    private val inti = Inti.dari(aktivitas)

    init {
        kanal.setMethodCallHandler(this)
    }

    fun lepas() {
        kanal.setMethodCallHandler(null)
        latar.shutdown()
    }

    override fun onMethodCall(call: MethodCall, result: MethodChannel.Result) {
        // Jam monoton termasuk waktu tidur (SEC-75). Langsung di thread utama: tidak boleh antre di belakang pindaiQr/BiometricPrompt.
        if (call.method == "jamMonoton") {
            result.success(SystemClock.elapsedRealtime())
            return
        }
        latar.execute {
            val hasil = runCatching { jalankan(call) }
            utama.post {
                hasil.fold(
                    onSuccess = { result.success(it) },
                    onFailure = { e ->
                        when (e) {
                            is TidakDikenal -> result.notImplemented()
                            is GalatKunci -> result.error(e.kode, null, null)
                            is IllegalArgumentException -> result.error("argumen_tidak_sah", null, null)
                            else -> result.error("galat_internal", null, null)
                        }
                    },
                )
            }
        }
    }

    private class TidakDikenal : Exception()

    private fun teks(c: MethodCall, nama: String, maks: Int, boleh_kosong: Boolean = false): String {
        val v = c.argument<String>(nama) ?: throw IllegalArgumentException(nama)
        require(v.length <= maks && (boleh_kosong || v.isNotEmpty())) { nama }
        return v
    }

    /** Bilangan bulat opsional dari Dart (Int/Long) → Long; tipe lain → argumen_tidak_sah. */
    private fun bulat(c: MethodCall, nama: String): Long? = when (val v = c.argument<Any>(nama)) {
        null -> null
        is Int -> v.toLong()
        is Long -> v
        else -> throw IllegalArgumentException(nama)
    }

    /** Field opsional cermin: hanya dimasukkan bila ada (rentang & pola dicek Inti.kirimCermin dengan skema Mac). */
    private fun opsional(c: MethodCall, m: MutableMap<String, Any>, vararg nama: String) {
        for (n in nama) c.argument<Any>(n)?.let { v -> m[n] = if (v is Int) v.toLong() else v }
    }

    private fun jalankan(c: MethodCall): Any? = when (c.method) {
        "statusKeamanan" -> inti.statusKeamanan()
        "bukaKunciAplikasi" -> Biometrik.bukaKunci(
            aktivitas, Biometrik.Teks(c.argument<String>("judul")?.take(60) ?: "Buka PADEV Studio", "Sidik jari atau kunci layar"),
        )
        "statusPasang" -> inti.statusPasang()
        "pindaiQr" -> PemindaiQr.pindai(aktivitas)
        "mulaiPasang" -> inti.mulaiPasang(aktivitas, teks(c, "qr", 4096), c.argument<String>("nama")?.take(60) ?: "HP")
        "halo" -> inti.halo(c.argument<Boolean>("aktif") ?: true)
        "ambilKabar" -> inti.ambilKabar()
        "jumlahPesanTidakSah" -> inti.jumlahTidakSah()
        "kirimRencana" -> inti.kirimPerintah(
            aktivitas, "jalankan",
            linkedMapOf<String, Any>(
                "tugas" to teks(c, "tugas", 200), "proyek" to teks(c, "proyek", 200), "akun" to teks(c, "akun", 200),
                "mode" to "rencana", "pesan" to teks(c, "pesan", AmplopV1.MAKS_PESAN, boleh_kosong = true),
                "baru" to (c.argument<Boolean>("baru") ?: false),
            ).apply { c.argument<String>("model")?.let { put("model", it) } },
        )
        "kirimKerjakan" -> inti.kirimKerjakan(
            aktivitas, teks(c, "tugas", 200), teks(c, "proyek", 200), teks(c, "akun", 200),
            teks(c, "pesan", AmplopV1.MAKS_PESAN, boleh_kosong = true), c.argument<Boolean>("baru") ?: false,
            c.argument<String>("model")?.also { require(it.isNotEmpty() && it.length <= 100) { "model" } },
        )
        "hentikan" -> inti.kirimPerintah(aktivitas, "hentikan", mapOf("tugas" to teks(c, "tugas", 200)))
        "hapusSesi" -> inti.kirimPerintah(aktivitas, "hapus_sesi", mapOf("proyek" to teks(c, "proyek", 200), "akun" to teks(c, "akun", 200)))
        "mintaStatus" -> inti.kirimPerintah(aktivitas, "minta_status", emptyMap())
        "lepasPerangkat" -> { inti.lepasPerangkat(aktivitas); null }
        // ---- cermin sesi (KONTRAK-apk-v2 §6.3, F1)
        "cerminDaftar" -> inti.kirimCermin(
            aktivitas, "cermin_daftar", linkedMapOf<String, Any>().also { opsional(c, it, "sejakJam", "sejakHari", "cari", "proyek") },
        )
        "cerminBuka" -> inti.kirimCermin(
            aktivitas, "cermin_buka",
            linkedMapOf<String, Any>("sesi" to (c.argument<String>("sesi") ?: JsonNull)).also { opsional(c, it, "proyek", "akun") },
        )
        "cerminTutup" -> inti.kirimCermin(aktivitas, "cermin_tutup", emptyMap())
        "cerminRiwayat" -> inti.kirimCermin(
            aktivitas, "cermin_riwayat",
            linkedMapOf<String, Any>(
                "sesi" to teks(c, "sesi", 36), "proyek" to teks(c, "proyek", 40), "akun" to teks(c, "akun", 40),
                "batas" to (bulat(c, "batas") ?: 50L),
            ).also { opsional(c, it, "sebelum") },
        )
        "riwayatLokal" -> inti.riwayatLokal(teks(c, "sesi", 36))
        "hapusRiwayatLokal" -> { inti.hapusRiwayatLokal(); null }
        "simpanChat" -> { inti.simpanChat(teks(c, "proyek", 40), RiwayatChat.cekDaftar(c.argument<Any>("entri"))); null }
        "muatChat" -> inti.muatChat(teks(c, "proyek", 40))
        "hapusChat" -> { inti.hapusChat(teks(c, "proyek", 40)); null }
        "ujiBuatKunci" -> inti.ujiBuatKunci()
        "ujiTanda" -> inti.ujiTanda(aktivitas)
        "ujiKerjakan" -> inti.ujiKerjakan(aktivitas)
        "ujiSegelBuka" -> inti.ujiSegelBuka(aktivitas)
        "ujiHapusKunci" -> { inti.ujiHapusKunci(); null }
        else -> throw TidakDikenal()
    }

    companion object {
        const val NAMA = "pro.padeveloper.studio/kunci"
    }
}
