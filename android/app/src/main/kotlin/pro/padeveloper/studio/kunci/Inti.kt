package pro.padeveloper.studio.kunci

import android.content.Context
import android.os.Build
import androidx.fragment.app.FragmentActivity
import pro.padeveloper.studio.BuildConfig
import java.io.File
import java.security.SignatureException

/**
 * Inti native PADEV Studio: status pemasangan, pembuatan perintah, pemeriksaan kabar, dan klien relay.
 * Semua kunci, token relay, tanda tangan, dan HTTP ke relay hanya ada di sini (kontrak §6); Dart hanya menerima isi
 * yang sudah diverifikasi/didekripsi. Semua metode dipanggil dari thread latar.
 */
class Inti(context: Context) {
    private val ctx = context.applicationContext
    val brankas = Brankas(ctx)
    private val ehp = KunciEhp(ctx)

    /** Cache riwayat cermin terenkripsi (K-06): kunci Keystore ber-syarat layar terbuka, di luar cadangan. */
    private val riwayat = CacheRiwayat(File(ctx.noBackupFilesDir, "riwayat"), KunciRiwayat::dapat)

    // ------------------------------------------------------------------ status pemasangan

    /** Status pemasangan tersimpan (kunci Mac dipin dari QR). */
    class Pasangan(val o: Map<String, Any>) {
        val relay get() = o["relay"] as String
        val macId get() = o["mac_id"] as String
        val namaMac get() = o["nama_mac"] as String
        val sMac get() = B64u.dek(o["s_mac"] as String)!!
        val eMac get() = B64u.dek(o["e_mac"] as String)!!
        val perangkatId get() = o["perangkat_id"] as String
        val status get() = o["status"] as String
    }

    fun pasangan(): Pasangan? = brankas.baca(K_PASANG)?.let { Pasangan(JsonKetat.objek(it)) }

    private fun simpanPasangan(o: Map<String, Any>) = brankas.simpan(K_PASANG, Jcs.teks(o))

    private fun ubahPasangan(f: (LinkedHashMap<String, Any>) -> Unit) {
        val p = pasangan() ?: return
        simpanPasangan(LinkedHashMap(p.o).also(f))
    }

    private fun relay(p: Pasangan) = KlienRelay(p.relay, BuildConfig.VERSION_NAME) { brankas.baca(K_TOKEN) }

    fun statusPasang(): Map<String, Any?>? {
        val p = pasangan() ?: return null
        val kr = KunciKeystore.info(KunciKeystore.RENCANA)
        val kk = KunciKeystore.info(KunciKeystore.KERJAKAN)
        return mapOf(
            "status" to p.status, "namaMac" to p.namaMac, "macId" to p.macId, "perangkatId" to p.perangkatId,
            "relay" to p.relay, "kodeSas" to p.o["sas"],
            // Sidik jari kunci untuk layar Pengaturan: 8 heksa pertama idKunci (Fajar L07)
            "idKRencana" to kr?.id?.substring(0, 8), "idKKerjakan" to kk?.id?.substring(0, 8),
            "idEHp" to if (ehp.ada()) ehp.pasangan().id.substring(0, 8) else null,
            "kunciUtuh" to (kr != null && kk != null && ehp.ada()),
        )
    }

    // ------------------------------------------------------------------ penandatanganan

    private fun tandaRencana(aktivitas: FragmentActivity?, data: ByteArray, alias: String = KunciKeystore.RENCANA): ByteArray {
        for (percobaan in 0..1) {
            try {
                val s = KunciKeystore.signature(alias)
                s.update(data)
                return s.sign()
            } catch (e: KunciKeystore.PerluOtentikasi) {
                // lanjut ke prompt
            } catch (e: SignatureException) {
                if (percobaan == 1) throw GalatKunci("tanda_gagal")
            }
            if (percobaan == 1) break
            val a = aktivitas ?: throw GalatKunci("perlu_otentikasi")
            if (!Biometrik.bukaKunci(a, Biometrik.Teks("Konfirmasi PADEV Studio", "Sidik jari atau kunci layar"))) {
                throw GalatKunci("dibatalkan")
            }
        }
        throw GalatKunci("perlu_otentikasi")
    }

    // ------------------------------------------------------------------ pemasangan (kontrak §3)

    fun mulaiPasang(aktivitas: FragmentActivity, teksQr: String, nama: String): Map<String, Any?> {
        val sekarang = System.currentTimeMillis()
        val ada = pasangan()
        val menungguBasi = ada?.status == "menunggu" && sekarang - ((ada.o["dipasang"] as? Long) ?: 0L) > 2 * MASA_PASANG
        if (ada != null && (ada.status == "aktif" || ada.status == "menunggu") && !menungguBasi) throw GalatKunci("sudah_terpasang")
        val namaBersih = nama.trim().take(60).ifEmpty { "HP" }
        // SEC-86: alamat relay QR dipin ke RELAY_URL di profile & rilis; hanya build debug boleh relay uji lokal.
        val qr = Pasang.uraiQr(teksQr, sekarang, if (BuildConfig.PENGEMBANGAN) null else BuildConfig.RELAY_URL)
        val tantangan = Pasang.tantanganAtestasi(qr.rahasia, qr.macId)
        bersihkanLokal()
        val klien = KlienRelay(qr.relay, BuildConfig.VERSION_NAME) { brankas.baca(K_TOKEN) }
        var terdaftar = false
        // REV-40: gagal sesudah hp/daftar (hp/kirim, sidik jari dibatalkan, …) → DELETE hp/perangkat dengan token itu (agar tidak
        // memakan batas perangkat; gagal → abaikan), lalu bersihkanLokal(): pemasangan setengah jalan tidak meninggalkan kunci/token.
        return Pasang.batalkanBilaGagal({ terdaftar }, { m, j -> klien.panggil(m, j) }, ::bersihkanLokal) {
            val kr = KunciKeystore.buat(ctx, KunciKeystore.RENCANA, kerjakan = false, tantangan = tantangan)
            val kk = KunciKeystore.buat(ctx, KunciKeystore.KERJAKAN, kerjakan = true, tantangan = tantangan)
            val e = ehp.buatBaru()
            val daftar = klien.panggil("POST", "hp/daftar", Pasang.badanDaftar(qr), pakaiToken = false).data
                ?: throw GalatKunci("relay_jawaban_rusak")
            val perangkatId = (daftar["perangkat_id"] as? String)?.takeIf { Heks.POLA16.matches(it) } ?: throw GalatKunci("relay_jawaban_rusak")
            val token = (daftar["token"] as? String)?.takeIf { Heks.POLA64.matches(it) } ?: throw GalatKunci("relay_jawaban_rusak")
            brankas.simpan(K_TOKEN, token)
            terdaftar = true
            val kd = sekarang + MASA_PASANG
            val isi = Pasang.isi(
                qr, perangkatId, sekarang, kd, namaBersih, kr.spki, kk.spki, e.publik, kr.rantai, kk.rantai,
                brankas.baca(K_FCM) ?: "",
            )
            val draf = AmplopV1.siapkan("pasang", kr.id, qr.eMacRaw, isi, kd)
            val amplop = draf.selesaikan(tandaRencana(aktivitas, draf.inputTanda))
            klien.panggil("POST", "hp/kirim", mapOf("amplop" to amplop))
            val sas = Pasang.kodeSas(qr.sMacSpki, qr.eMacRaw, kr.spki, kk.spki, e.publik, qr.macId, perangkatId)
            simpanPasangan(
                linkedMapOf(
                    "relay" to qr.relay, "mac_id" to qr.macId, "nama_mac" to qr.namaMac, "s_mac" to B64u.enk(qr.sMacSpki),
                    "e_mac" to B64u.enk(qr.eMacRaw), "perangkat_id" to perangkatId, "status" to "menunggu", "sas" to sas,
                    "dipasang" to sekarang,
                ),
            )
            mapOf<String, Any?>("kodeSas" to sas, "namaMac" to qr.namaMac, "perangkatId" to perangkatId)
        }
    }

    // ------------------------------------------------------------------ perintah (kontrak §2)

    private fun urutBerikut(): Long {
        val u = brankas.bacaLong(K_URUT) + 1
        brankas.simpan(K_URUT, u.toString()) // dicatat sebelum dikirim: urut tidak pernah dipakai ulang
        return u
    }

    private fun pasanganAktif(): Pasangan = pasangan()?.takeIf { it.status == "aktif" } ?: throw GalatKunci("belum_terpasang")

    /** Perintah selain Kerjakan: ditandatangani K_rencana. Mengembalikan {id, kode}. */
    fun kirimPerintah(aktivitas: FragmentActivity?, jenis: String, tambahan: Map<String, Any>): Map<String, Any?> {
        require(jenis != "jalankan" || tambahan["mode"] == "rencana") { "Kerjakan wajib lewat kirimKerjakan" }
        if (jenis == "jalankan") cekProyek(tambahan["proyek"] as? String, tambahan["akun"] as? String, "rencana")
        val p = pasanganAktif()
        val kr = KunciKeystore.info(KunciKeystore.RENCANA) ?: throw GalatKunci("kunci_tidak_ada")
        val sekarang = System.currentTimeMillis()
        val id = Kripto.acakHeks(16)
        val kd = Perintah.kedaluwarsa(jenis, tambahan["mode"] as? String, sekarang)
        val isi = Perintah.isi(jenis, p.macId, p.perangkatId, id, urutBerikut(), sekarang, kd, tambahan)
        val draf = AmplopV1.siapkan("perintah", kr.id, p.eMac, isi, kd, id)
        val amplop = draf.selesaikan(tandaRencana(aktivitas, draf.inputTanda))
        return kirimAmplop(p, id, amplop)
    }

    /**
     * Kerjakan (SEC-51): Kotlin menampilkan sendiri proyek/akun/model/200 karakter pesan + panjang di BiometricPrompt
     * (BIOMETRIC_STRONG + CryptoObject K_kerjakan), lalu menandatangani plaintext yang disusun dari nilai yang sama.
     */
    fun kirimKerjakan(aktivitas: FragmentActivity, tugas: String, proyek: String, akun: String, pesan: String, baru: Boolean, model: String?): Map<String, Any?> {
        val p = pasanganAktif()
        val namaProyek = cekProyek(proyek, akun, "kerjakan")
        val kk = KunciKeystore.info(KunciKeystore.KERJAKAN) ?: throw GalatKunci("kunci_tidak_ada")
        val tambahan = linkedMapOf<String, Any>("tugas" to tugas, "proyek" to proyek, "akun" to akun, "mode" to "kerjakan", "pesan" to pesan, "baru" to baru)
        model?.let { tambahan["model"] = it }
        val sekarang = System.currentTimeMillis()
        val id = Kripto.acakHeks(16)
        val kd = Perintah.kedaluwarsa("jalankan", "kerjakan", sekarang)
        val isi = Perintah.isi("jalankan", p.macId, p.perangkatId, id, urutBerikut(), sekarang, kd, tambahan)
        val draf = AmplopV1.siapkan("perintah", kk.id, p.eMac, isi, kd, id)
        val potongan = pesan.replace(Regex("\\s+"), " ").trim().let { if (it.length > 200) it.take(200) + "…" else it }
        val teks = Biometrik.Teks(
            judul = "Kerjakan di ${namaProyek.take(40)}",
            subjudul = "Akun: ${akun.take(40)} · Model: ${(model ?: "bawaan").take(30)}",
            keterangan = "$potongan\n(${pesan.length} karakter)",
        )
        val sig = Biometrik.konfirmasiKerjakan(aktivitas, teks, KunciKeystore.signature(KunciKeystore.KERJAKAN))
            ?: throw GalatKunci("dibatalkan")
        sig.update(draf.inputTanda)
        val amplop = draf.selesaikan(sig.sign())
        return kirimAmplop(p, id, amplop)
    }

    private fun kirimAmplop(p: Pasangan, id: String, amplop: Map<String, Any>): Map<String, Any?> {
        val j = relay(p).panggil("POST", "hp/kirim", mapOf("amplop" to amplop))
        return mapOf("id" to id, "kode" to j.data?.get("kode"), "hash" to AmplopV1.hash(amplop))
    }

    /** Proyek & akun harus ada di status terakhir yang terverifikasi; Kerjakan hanya bila hp == "kerjakan". Mengembalikan nama proyek. */
    private fun cekProyek(proyek: String?, akun: String?, mode: String): String {
        val status = brankas.baca(K_STATUS)?.let { JsonKetat.objek(it) }
        if (status == null) {
            if (mode == "kerjakan") throw GalatKunci("status_belum_ada")
            return proyek ?: ""
        }
        @Suppress("UNCHECKED_CAST")
        val daftar = ((status["status"] as? Map<String, Any>)?.get("proyek") as? List<Map<String, Any>>) ?: emptyList()
        val pr = daftar.firstOrNull { it["id"] == proyek } ?: throw GalatKunci("proyek_tidak_diizinkan")
        val hp = pr["hp"]
        if (mode == "kerjakan" && hp != "kerjakan") throw GalatKunci("kerjakan_belum_diizinkan")
        if (hp != "rencana" && hp != "kerjakan") throw GalatKunci("proyek_tidak_diizinkan")
        if ((pr["akun"] as? List<*>)?.contains(akun) != true) throw GalatKunci("akun_tidak_diizinkan")
        return pr["nama"] as? String ?: proyek!!
    }

    // ------------------------------------------------------------------ kabar & status (kontrak §2, §4)

    private fun opsiKabar(p: Pasangan, penyimpan: PenyimpanReplay?): AmplopV1.Opsi {
        val sMac = p.sMac
        val idSMac = Kripto.idKunciEcdsa(sMac)
        return AmplopV1.Opsi(
            jenisKotak = "kabar",
            kunciTandaDikenal = { id -> if (id == idSMac) KunciTanda(sMac, "s_mac") else null },
            kunciSandiSaya = listOf(ehp.pasangan().privat),
            macId = p.macId, perangkatId = p.perangkatId, penyimpan = penyimpan,
        )
    }

    private fun penyimpanReplay(): PenyimpanReplayMemori =
        brankas.baca(K_REPLAY)?.let { runCatching { PenyimpanReplayMemori.dariJson(it) }.getOrNull() } ?: PenyimpanReplayMemori()

    private fun tambahTidakSah() = brankas.simpan(K_TIDAK_SAH, (brankas.bacaLong(K_TIDAK_SAH) + 1).toString())

    fun jumlahTidakSah(): Long = brankas.bacaLong(K_TIDAK_SAH)

    /** Memeriksa satu amplop kabar. [catat] = false untuk jalur FCM (tidak mengonsumsi anti-replay; kabar yang sama datang lagi lewat relay). */
    fun periksaKabar(teks: String, catat: Boolean): Map<String, Any>? {
        val p = pasangan() ?: return null
        val penyimpan = penyimpanReplay()
        val h = AmplopV1.periksa(teks, opsiKabar(p, penyimpan))
        if (!h.ok) {
            if (catat && h.alasan !in BUKAN_SERANGAN) tambahTidakSah()
            return null
        }
        if (catat) brankas.simpan(K_REPLAY, penyimpan.keJson())
        // K-07/SEC-86: kabar cermin hanya diteruskan di build rilis (build lain = data contoh); dibuang diam (bukan serangan).
        if (h.isi!!["jenis"] in Cermin.JENIS_KABAR && !BuildConfig.CERMIN_NYATA) return null
        if (catat) terapkanKabar(h.isi)
        return h.isi
    }

    private fun terapkanKabar(isi: Map<String, Any>) {
        when (isi["jenis"]) {
            "pasang_hasil" -> {
                @Suppress("UNCHECKED_CAST")
                val ok = (isi["pasang_hasil"] as? Map<String, Any>)?.get("disetujui") == true
                ubahPasangan { it["status"] = if (ok) "aktif" else "ditolak"; it.remove("sas") }
            }
            "status" -> simpanStatus(isi)
            // Riwayat cermin → cache terenkripsi. Layar terkunci/kunci tak bisa dipakai → dilewati (kabar tetap diteruskan ke Dart).
            "cermin_riwayat" -> {
                @Suppress("UNCHECKED_CAST")
                (isi["cermin_riwayat"] as? Map<String, Any>)?.let { r -> runCatching { riwayat.simpan(r) } }
            }
            "kunci_mac" -> {
                @Suppress("UNCHECKED_CAST")
                val baru = ((isi["kunci_mac"] as? Map<String, Any>)?.get("e_mac_baru") as? String)?.let { B64u.dek(it) }
                if (baru != null && baru.size == 32) ubahPasangan { it["e_mac"] = B64u.enk(baru) }
            }
        }
    }

    private fun simpanStatus(isi: Map<String, Any>) {
        val lama = brankas.baca(K_STATUS)?.let { JsonKetat.objek(it)["urut_mac"] as? Long } ?: -1L
        if ((isi["urut_mac"] as Long) > lama) brankas.simpan(K_STATUS, Jcs.teks(isi))
    }

    /** POST hp/halo → status Mac + status proyek terbaru (amplop status diverifikasi tanpa anti-replay, tetapi tidak boleh mundur). */
    fun halo(aktif: Boolean): Map<String, Any?> {
        val p = pasangan() ?: throw GalatKunci("belum_terpasang")
        val d = relay(p).panggil("POST", "hp/halo", mapOf("aktif" to aktif, "versiApk" to BuildConfig.VERSION_NAME)).data ?: emptyMap()
        @Suppress("UNCHECKED_CAST")
        val mac = d["mac"] as? Map<String, Any>
        @Suppress("UNCHECKED_CAST")
        val st = d["status"] as? Map<String, Any>
        @Suppress("UNCHECKED_CAST")
        val perangkat = (d["perangkat"] as? Map<String, Any>)?.get("status") as? String
        if (perangkat == "dicabut") {
            ubahPasangan { it["status"] = "dicabut" }
            hapusRiwayatLokal() // K-06: dicabut (termasuk kode darurat) → riwayat lokal dihapus
        }
        AmplopV1.teks(st?.get("amplop"))?.let { a ->
            val h = AmplopV1.periksa(a, opsiKabar(p, null))
            if (h.ok && h.isi!!["jenis"] == "status") simpanStatus(h.isi) else if (!h.ok && h.alasan !in BUKAN_SERANGAN) tambahTidakSah()
        }
        return mapOf(
            "macTersambung" to (mac?.get("tersambung") == true), "macTerakhir" to mac?.get("terakhir"),
            "perangkat" to perangkat, "status" to brankas.baca(K_STATUS)?.let { petaKeDart(JsonKetat.objek(it)) },
        )
    }

    /** GET hp/kabar → periksa setiap amplop (tanda, dekripsi, urut_mac) → akui → isi yang sah saja. */
    fun ambilKabar(): List<Map<String, Any?>> {
        val p = pasangan() ?: throw GalatKunci("belum_terpasang")
        val r = relay(p)
        val hasil = ArrayList<Map<String, Any?>>()
        var lagi = true
        var putaran = 0
        while (lagi && putaran++ < 5) {
            val setelah = brankas.baca(K_KABAR_SETELAH)?.takeIf { Regex("^[0-9A-Za-z_-]{1,64}$").matches(it) }
            val jalur = "hp/kabar?batas=20" + (setelah?.let { "&setelah=$it" } ?: "")
            val d = r.panggil("GET", jalur).data ?: break
            @Suppress("UNCHECKED_CAST")
            val daftar = d["kabar"] as? List<Map<String, Any>> ?: break
            var terakhir: Any? = null
            for (k in daftar) {
                terakhir = k["id"] ?: continue
                val a = AmplopV1.teks(k["amplop"])
                if (a == null) { tambahTidakSah(); continue }
                periksaKabar(a, catat = true)?.let { hasil += petaKeDart(it) }
            }
            if (terakhir != null) {
                // `sampai` dikirim dengan tipe yang sama seperti `id` dari relay (angka/string)
                r.panggil("POST", "hp/kabar/akui", mapOf("sampai" to terakhir))
                brankas.simpan(K_KABAR_SETELAH, terakhir.toString())
            }
            lagi = d["lagi"] == true && daftar.isNotEmpty()
        }
        return hasil
    }

    // ------------------------------------------------------------------ cermin sesi (KONTRAK-apk-v2 §2.1, §6.3; F1)

    /**
     * Perintah `cermin_daftar|cermin_buka|cermin_tutup|cermin_riwayat` (READ, ditandatangani K_rencana). [tambahan] dicek dulu
     * dengan skema yang sama seperti pemeriksa Mac (salah → argumen_tidak_sah, urut tidak terpakai). Hanya build rilis (K-07).
     */
    fun kirimCermin(aktivitas: FragmentActivity?, jenis: String, tambahan: Map<String, Any>): Map<String, Any?> {
        if (jenis !in Cermin.JENIS_PERINTAH) throw GalatKunci("argumen_tidak_sah")
        if (!BuildConfig.CERMIN_NYATA) throw GalatKunci("tidak_tersedia")
        try {
            Perintah.isi(jenis, NOL16, NOL16, NOL32, 0, 1, 2, tambahan)
        } catch (e: GalatKunci) {
            throw GalatKunci("argumen_tidak_sah")
        }
        return kirimPerintah(aktivitas, jenis, tambahan)
    }

    /** Riwayat sesi dari cache lokal terenkripsi: {sesi, diperbarui, entri} atau null (tidak ada / layar terkunci / rusak). */
    fun riwayatLokal(sesi: String): Map<String, Any?>? {
        if (!Cermin.POLA_SESI.matches(sesi)) throw GalatKunci("argumen_tidak_sah")
        return runCatching { riwayat.baca(sesi) }.getOrNull()?.let { petaKeDart(it) }
    }

    /** Hapus semua riwayat lokal + kuncinya (Pengaturan, dicabut, kode darurat, lepas_diri, pasang ulang). */
    fun hapusRiwayatLokal() {
        runCatching { riwayat.hapusSemua() }
        KunciRiwayat.hapus()
    }

    // ------------------------------------------------------------------ lepas & bersihkan

    fun lepasPerangkat(aktivitas: FragmentActivity?) {
        val p = pasangan()
        if (p != null && p.status == "aktif") runCatching { kirimPerintah(aktivitas, "lepas_diri", emptyMap()) }
        if (p != null) runCatching { relay(p).panggil("DELETE", "hp/perangkat") }
        bersihkanLokal()
    }

    private fun bersihkanLokal() {
        hapusRiwayatLokal()
        KunciKeystore.hapus(KunciKeystore.RENCANA)
        KunciKeystore.hapus(KunciKeystore.KERJAKAN)
        ehp.hapus()
        val fcm = brankas.baca(K_FCM)
        brankas.hapusSemua()
        fcm?.let { brankas.simpan(K_FCM, it) }
    }

    fun simpanTokenFcm(token: String) {
        if (token.length in 1..4096) brankas.simpan(K_FCM, token)
    }

    fun statusKeamanan(): Map<String, Any?> = mapOf(
        "kunciLayar" to (Biometrik.bisa(ctx, Biometrik.BUKA) == androidx.biometric.BiometricManager.BIOMETRIC_SUCCESS),
        "biometrikKuat" to (Biometrik.bisa(ctx, androidx.biometric.BiometricManager.Authenticators.BIOMETRIC_STRONG) ==
            androidx.biometric.BiometricManager.BIOMETRIC_SUCCESS),
        "strongBox" to KunciKeystore.adaStrongBox(ctx),
        "fcmAktif" to BuildConfig.FCM_AKTIF,
        "debug" to BuildConfig.PENGEMBANGAN, // true hanya build debug (metode uji* tersedia)
        "cerminNyata" to BuildConfig.CERMIN_NYATA, // K-07: false → layar Sesi memakai data contoh
        "versiApk" to BuildConfig.VERSION_NAME,
        "android" to Build.VERSION.SDK_INT,
    )

    // ------------------------------------------------------------------ uji (hanya build debug: BuildConfig.PENGEMBANGAN, SEC-86)

    fun ujiBuatKunci(): Map<String, Any?> {
        hanyaDebug()
        val tantangan = Kripto.acakBytes(32)
        val kr = KunciKeystore.buat(ctx, KunciKeystore.UJI_RENCANA, kerjakan = false, tantangan = tantangan)
        val kk = KunciKeystore.buat(ctx, KunciKeystore.UJI_KERJAKAN, kerjakan = true, tantangan = tantangan)
        val e = KunciEhp(ctx, "padev_uji_ehp").buatBaru()
        return mapOf(
            "idKRencana" to kr.id, "idKKerjakan" to kk.id, "idEHp" to e.id, "strongBox" to kr.strongBox,
            "rantaiRencana" to kr.rantai.size, "rantaiKerjakan" to kk.rantai.size,
        )
    }

    fun ujiTanda(aktivitas: FragmentActivity): Map<String, Any?> {
        hanyaDebug()
        val kr = KunciKeystore.info(KunciKeystore.UJI_RENCANA) ?: throw GalatKunci("kunci_tidak_ada")
        val data = Kripto.acakBytes(64)
        val t = tandaRencana(aktivitas, data, KunciKeystore.UJI_RENCANA)
        return mapOf("ok" to Kripto.verifikasiEcdsa(Kripto.publikP256(kr.spki), data, t), "idKunci" to kr.id)
    }

    fun ujiKerjakan(aktivitas: FragmentActivity): Map<String, Any?> {
        hanyaDebug()
        val kk = KunciKeystore.info(KunciKeystore.UJI_KERJAKAN) ?: throw GalatKunci("kunci_tidak_ada")
        val data = "uji kerjakan".toByteArray()
        val sig = Biometrik.konfirmasiKerjakan(
            aktivitas, Biometrik.Teks("Kerjakan di Proyek Uji", "Akun: uji · Model: bawaan", "Ini hanya uji tanda tangan K_kerjakan\n(38 karakter)"),
            KunciKeystore.signature(KunciKeystore.UJI_KERJAKAN),
        ) ?: throw GalatKunci("dibatalkan")
        sig.update(data)
        return mapOf("ok" to Kripto.verifikasiEcdsa(Kripto.publikP256(kk.spki), data, sig.sign()), "idKunci" to kk.id)
    }

    /** Amplop uji: perintah bertanda K_rencana uji → E uji, lalu diperiksa dengan pemeriksa yang sama seperti Mac. */
    fun ujiSegelBuka(aktivitas: FragmentActivity): Map<String, Any?> {
        hanyaDebug()
        val kr = KunciKeystore.info(KunciKeystore.UJI_RENCANA) ?: throw GalatKunci("kunci_tidak_ada")
        val e = KunciEhp(ctx, "padev_uji_ehp").pasangan()
        val macId = Kripto.acakHeks(8); val perangkatId = Kripto.acakHeks(8)
        val sekarang = System.currentTimeMillis()
        val id = Kripto.acakHeks(16)
        val kd = Perintah.kedaluwarsa("minta_status", null, sekarang)
        val isi = Perintah.isi("minta_status", macId, perangkatId, id, 1, sekarang, kd, emptyMap())
        val draf = AmplopV1.siapkan("perintah", kr.id, e.publik, isi, kd, id)
        val amplop = draf.selesaikan(tandaRencana(aktivitas, draf.inputTanda, KunciKeystore.UJI_RENCANA))
        val h = AmplopV1.periksa(
            Jcs.teks(amplop),
            AmplopV1.Opsi("perintah", { if (it == kr.id) KunciTanda(kr.spki, "k_rencana", perangkatId) else null }, listOf(e.privat), macId, sekarang = sekarang),
        )
        val rusak = LinkedHashMap(amplop).apply { put("kedaluwarsa", kd + 1) }
        val hRusak = AmplopV1.periksa(
            Jcs.teks(rusak),
            AmplopV1.Opsi("perintah", { if (it == kr.id) KunciTanda(kr.spki, "k_rencana", perangkatId) else null }, listOf(e.privat), macId, sekarang = sekarang),
        )
        return mapOf("ok" to h.ok, "alasan" to h.alasan, "rusakDitolak" to hRusak.alasan, "ukuran" to Jcs.bytes(amplop).size)
    }

    fun ujiHapusKunci() {
        hanyaDebug()
        KunciKeystore.hapus(KunciKeystore.UJI_RENCANA)
        KunciKeystore.hapus(KunciKeystore.UJI_KERJAKAN)
        KunciEhp(ctx, "padev_uji_ehp").hapus()
    }

    private fun hanyaDebug() {
        if (!BuildConfig.PENGEMBANGAN) throw GalatKunci("tidak_tersedia")
    }

    companion object {
        private const val K_PASANG = "pasang"
        private const val K_TOKEN = "token"
        private const val K_URUT = "urut"
        private const val K_REPLAY = "replay"
        private const val K_STATUS = "status"
        private const val K_KABAR_SETELAH = "kabar_setelah"
        private const val K_TIDAK_SAH = "tidak_sah"
        private const val K_FCM = "fcm"
        private const val MASA_PASANG = 5 * 60_000L
        private const val NOL16 = "0000000000000000"
        private const val NOL32 = "00000000000000000000000000000000"

        /** Penolakan wajar (kabar basi/ganda) tidak dihitung sebagai "pesan tidak sah". */
        private val BUKAN_SERANGAN = setOf(Alasan.REPLAY_ID, Alasan.URUT_LAMA, Alasan.KEDALUWARSA)

        @Volatile private var satu: Inti? = null
        fun dari(context: Context): Inti = satu ?: synchronized(this) { satu ?: Inti(context).also { satu = it } }

        /** JsonNull → null agar bisa lewat StandardMessageCodec. */
        fun keDart(v: Any?): Any? = when (v) {
            JsonNull -> null
            is Map<*, *> -> v.entries.associate { it.key as String to keDart(it.value) }
            is List<*> -> v.map { keDart(it) }
            else -> v
        }

        @Suppress("UNCHECKED_CAST")
        fun petaKeDart(m: Map<String, Any>): Map<String, Any?> = keDart(m) as Map<String, Any?>
    }
}
