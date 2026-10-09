package pro.padeveloper.studio.kunci

/** Kode alasan penolakan — sama dengan pelaksana-relay.js / apk/kontrak/vektor-e2e.json. */
object Alasan {
    const val BENTUK = "bentuk"
    const val VERSI = "versi"
    const val JENIS_KOTAK = "jenis_kotak"
    const val KE_SALAH = "ke_salah"
    const val DARI_TIDAK_DIKENAL = "dari_tidak_dikenal"
    const val PERAN_SALAH = "peran_salah"
    const val TANDA_SALAH = "tanda_salah"
    const val DEKRIPSI_GAGAL = "dekripsi_gagal"
    const val ISI_BENTUK = "isi_bentuk"
    const val ISI_TIDAK_COCOK = "isi_tidak_cocok"
    const val KERJAKAN_TANPA_K_KERJAKAN = "kerjakan_tanpa_k_kerjakan"
    const val KEDALUWARSA = "kedaluwarsa"
    const val DIBUAT_MASA_DEPAN = "dibuat_masa_depan"
    const val MASA_TERLALU_PANJANG = "masa_terlalu_panjang"
    const val REPLAY_ID = "replay_id"
    const val URUT_LAMA = "urut_lama"
    const val PENYIMPAN_GAGAL = "penyimpan_gagal"
}

/** Kunci tanda tangan yang dikenal penerima (HP: hanya S_mac dari QR). */
class KunciTanda(val spki: ByteArray, val peran: String, val perangkatId: String? = null, val dicabut: Boolean = false)

/** Anti-replay: null = sah & dicatat; selain itu kode alasan (replay_id / urut_lama / penyimpan_gagal). */
interface PenyimpanReplay {
    fun periksaDanCatat(perangkat: String, id: String, urut: Long, kedaluwarsa: Long, sekarang: Long): String?
}

class HasilPeriksa(
    val ok: Boolean,
    val alasan: String? = null,
    val isi: Map<String, Any>? = null,
    val peran: String? = null,
    val hash: String? = null,
)

/** Amplop PADEV-E2E-v1 (kontrak §2): bentuk 9 field, encrypt-then-sign, urutan pemeriksaan SEC-46. */
object AmplopV1 {
    const val MAKS_BYTE = 96 * 1024
    const val MAKS_PESAN = 8000
    const val TOLERANSI_DIBUAT = 120_000L
    private const val MENIT = 60_000L
    val FIELD = listOf("v", "jenis_kotak", "dari", "ke", "id", "kedaluwarsa", "enc", "ct", "tanda")
    val JENIS_KOTAK = listOf("perintah", "kabar", "pasang", "darurat")
    val JENIS_PERINTAH = listOf(
        "jalankan", "hentikan", "hapus_sesi", "minta_status", "perbarui_fcm", "rotasi_kunci", "lepas_diri", "cabut_perangkat",
    ) + Cermin.JENIS_PERINTAH + Keputusan.JENIS_PERINTAH // KONTRAK-apk-v2 §2.1 (F1), keputusan_jawab (F1b)
    val JENIS_KABAR = listOf("tanda_terima", "kabar", "status", "notif", "pasang_hasil", "kunci_mac") + Cermin.JENIS_KABAR +
        Keputusan.JENIS_KABAR // v2 §2.2, keputusan (F1b)
    val HASIL_TANDA_TERIMA = listOf("diterima", "ditolak", "mulai", "selesai", "gagal", "dihentikan", "batas_waktu")

    /** Masa berlaku maksimum (dipaksakan Mac; HP memakai nilai yang sama saat membuat perintah). */
    val MASA_MAKS = mapOf(
        "jalankan_kerjakan" to 3 * MENIT, "jalankan_rencana" to 10 * MENIT, "hapus_sesi" to 10 * MENIT,
        "rotasi_kunci" to 10 * MENIT, "hentikan" to 30 * MENIT, "lainnya" to 10 * MENIT, "pasang" to 10 * MENIT,
        "kabar" to 72 * 60 * MENIT, "keputusan_jawab" to 3 * MENIT,
    )

    private val AWALAN_TANDA = "PADEV-STUDIO-AMPLOP-v1\n".toByteArray(Charsets.UTF_8)

    fun info(dari: String, ke: String): ByteArray = "PADEV-STUDIO-v1|$dari|$ke".toByteArray(Charsets.UTF_8)

    fun inputTanda(h: ByteArray, enc: ByteArray, ct: ByteArray): ByteArray = AWALAN_TANDA + h + enc + ct

    fun header(v: Any, jenisKotak: Any, dari: Any, ke: Any, id: Any, kedaluwarsa: Any): Map<String, Any> =
        linkedMapOf("v" to v, "jenis_kotak" to jenisKotak, "dari" to dari, "ke" to ke, "id" to id, "kedaluwarsa" to kedaluwarsa)

    fun hHeader(a: Map<String, Any>): ByteArray =
        Jcs.bytes(header(a["v"]!!, a["jenis_kotak"]!!, a["dari"]!!, a["ke"]!!, a["id"]!!, a["kedaluwarsa"]!!))

    /** hex SHA-256 dari JCS amplop 9 field (untuk `perintah_sha256` tanda terima). */
    fun hash(a: Map<String, Any>): String = Heks.enk(Kripto.sha256(Jcs.bytes(a)))

    fun masaMaks(jenisKotak: String, isi: Map<String, Any>): Long = when (jenisKotak) {
        "kabar" -> MASA_MAKS.getValue("kabar")
        "pasang" -> MASA_MAKS.getValue("pasang")
        else -> if (isi["jenis"] == "jalankan") {
            if (isi["mode"] == "kerjakan") MASA_MAKS.getValue("jalankan_kerjakan") else MASA_MAKS.getValue("jalankan_rencana")
        } else MASA_MAKS[isi["jenis"]] ?: MASA_MAKS.getValue("lainnya")
    }

    // ---------------------------------------------------------------- membuat

    /** Amplop yang sudah dienkripsi tetapi belum ditandatangani (K_kerjakan menandatangani setelah BiometricPrompt). */
    class Draf(val header: Map<String, Any>, val enc: ByteArray, val ct: ByteArray, val inputTanda: ByteArray) {
        fun selesaikan(tandaDer: ByteArray): Map<String, Any> {
            val a = LinkedHashMap(header)
            a["enc"] = B64u.enk(enc)
            a["ct"] = B64u.enk(ct)
            a["tanda"] = B64u.enk(tandaDer)
            if (Jcs.bytes(a).size > MAKS_BYTE) throw IllegalArgumentException("amplop melebihi 96 KB")
            return a
        }
    }

    fun siapkan(
        jenisKotak: String, dariId: String, ePenerimaRaw: ByteArray, isi: Map<String, Any>, kedaluwarsa: Long,
        id: String = idBawaan(isi),
    ): Draf {
        require(jenisKotak == "perintah" || jenisKotak == "kabar" || jenisKotak == "pasang") { "jenis_kotak tidak sah" }
        require(Heks.POLA16.matches(dariId)) { "dari harus 16 heksa" }
        require(Heks.POLA32.matches(id)) { "id harus 32 heksa" }
        // perintah: id & kedaluwarsa header wajib = isi (SEC-46 #5); amplop yang pasti ditolak penerima tidak dibuat.
        if (jenisKotak == "perintah") require(isi["id"] == id && isi["kedaluwarsa"] == kedaluwarsa) { "id/kedaluwarsa header ≠ isi" }
        require(kedaluwarsa in 1..JsonKetat.SAFE_MAKS) { "kedaluwarsa tidak sah" }
        val ke = Kripto.idKunciX25519(ePenerimaRaw)
        val h = header(1L, jenisKotak, dariId, ke, id, kedaluwarsa)
        val hBytes = Jcs.bytes(h)
        val s = Hpke.segel(ePenerimaRaw, info(dariId, ke), hBytes, Jcs.bytes(isi))
        return Draf(h, s.enc, s.ct, inputTanda(hBytes, s.enc, s.ct))
    }

    /** id header bawaan: `isi.id` bila ada (perintah), selain itu 128-bit acak (kabar/pasang). */
    fun idBawaan(isi: Map<String, Any>): String = (isi["id"] as? String)?.takeIf { Heks.POLA32.matches(it) } ?: Kripto.acakHeks(16)

    fun buat(
        jenisKotak: String, dariId: String, ePenerimaRaw: ByteArray, isi: Map<String, Any>, kedaluwarsa: Long, penanda: Penanda,
        id: String = idBawaan(isi),
    ): Map<String, Any> {
        val d = siapkan(jenisKotak, dariId, ePenerimaRaw, isi, kedaluwarsa, id)
        return d.selesaikan(penanda.tanda(d.inputTanda))
    }

    // ---------------------------------------------------------------- memeriksa

    private fun intAman(v: Any?): Boolean = v is Long && v >= -JsonKetat.SAFE_MAKS && v <= JsonKetat.SAFE_MAKS
    private fun str(v: Any?, maks: Int): Boolean = v is String && v.isNotEmpty() && v.length <= maks
    private fun heks(p: Regex, v: Any?): Boolean = v is String && p.matches(v)

    /** Bentuk 9 field tanpa kripto. null = sah. */
    fun cekBentuk(a: Any?, boleh: List<String>, ukuranMentah: Int? = null): String? {
        if (ukuranMentah != null && ukuranMentah > MAKS_BYTE) return Alasan.BENTUK
        if (a !is Map<*, *>) return Alasan.BENTUK
        if (a.size != FIELD.size || !FIELD.all { a.containsKey(it) }) return Alasan.BENTUK
        val ukuran = try { Jcs.bytes(a).size } catch (e: Exception) { return Alasan.BENTUK }
        if (ukuran > MAKS_BYTE) return Alasan.BENTUK
        val v = a["v"]
        if (v !is Long && v !is Double) return Alasan.BENTUK
        if (!(v == 1L || v == 1.0)) return Alasan.VERSI
        val jk = a["jenis_kotak"]
        if (jk !is String || jk !in JENIS_KOTAK) return Alasan.BENTUK
        val kd = a["kedaluwarsa"]
        if (!intAman(kd) || (kd as Long) <= 0 || !heks(Heks.POLA32, a["id"])) return Alasan.BENTUK
        if (jk == "darurat") {
            if (a["dari"] !is String || a["ke"] !is String || a["enc"] != "" || a["tanda"] != "") return Alasan.BENTUK
            if ((a["ct"] as? String)?.let { B64u.dek(it) }.let { it == null || it.isEmpty() }) return Alasan.BENTUK
        } else {
            if (!heks(Heks.POLA16, a["dari"]) || !heks(Heks.POLA16, a["ke"])) return Alasan.BENTUK
            val enc = (a["enc"] as? String)?.let { B64u.dek(it) }
            val ct = (a["ct"] as? String)?.let { B64u.dek(it) }
            val tanda = (a["tanda"] as? String)?.let { B64u.dek(it) }
            if (enc == null || enc.size != 32 || ct == null || ct.size < 16 || tanda == null || tanda.size < 8 || tanda.size > 72) {
                return Alasan.BENTUK
            }
        }
        if (jk !in boleh) return Alasan.JENIS_KOTAK
        return null
    }

    private val SKEMA_PERINTAH: Map<String, Map<String, Pair<Boolean, (Any?) -> Boolean>>> = mapOf(
        "jalankan" to mapOf(
            "tugas" to (true to { v: Any? -> str(v, 200) }), "proyek" to (true to { v: Any? -> str(v, 200) }),
            "akun" to (true to { v: Any? -> str(v, 200) }),
            "mode" to (true to { v: Any? -> v == "rencana" || v == "kerjakan" }),
            "pesan" to (true to { v: Any? -> v is String && v.length <= MAKS_PESAN }),
            "baru" to (true to { v: Any? -> v is Boolean }), "model" to (false to { v: Any? -> str(v, 100) }),
        ),
        "hentikan" to mapOf("tugas" to (true to { v: Any? -> str(v, 200) })),
        "hapus_sesi" to mapOf("proyek" to (true to { v: Any? -> str(v, 200) }), "akun" to (true to { v: Any? -> str(v, 200) })),
        "minta_status" to emptyMap(),
        "perbarui_fcm" to mapOf("fcm" to (true to { v: Any? -> str(v, 4096) })),
        "rotasi_kunci" to mapOf("e_hp_baru" to (true to { v: Any? -> (v as? String)?.let { B64u.dek(it) }?.size == 32 })),
        "lepas_diri" to emptyMap(),
        "cabut_perangkat" to mapOf("perangkat_id_sasaran" to (true to { v: Any? -> heks(Heks.POLA16, v) })),
    )
    private val UMUM_PERINTAH: Map<String, Pair<Boolean, (Any?) -> Boolean>> = mapOf(
        "mac_id" to (true to { v: Any? -> heks(Heks.POLA16, v) }),
        "perangkat_id" to (true to { v: Any? -> heks(Heks.POLA16, v) }),
        "id" to (true to { v: Any? -> heks(Heks.POLA32, v) }),
        "urut" to (true to { v: Any? -> intAman(v) && (v as Long) >= 0 }),
        "dibuat" to (true to { v: Any? -> intAman(v) && (v as Long) > 0 }),
        "kedaluwarsa" to (true to { v: Any? -> intAman(v) && (v as Long) > 0 }),
        "jenis" to (true to { v: Any? -> v in JENIS_PERINTAH }),
    )

    /** Isi perintah HP→Mac (ketat: field asing ditolak). null = sah. */
    fun cekIsiPerintah(isi: Any?): String? {
        if (isi !is Map<*, *> || isi["jenis"] !in JENIS_PERINTAH) return Alasan.ISI_BENTUK
        val skema = UMUM_PERINTAH + (isi["jenis"] as String).let {
            SKEMA_PERINTAH[it] ?: Cermin.SKEMA_PERINTAH[it] ?: Keputusan.SKEMA_PERINTAH.getValue(it)
        }
        for (k in isi.keys) if (k !in skema) return Alasan.ISI_BENTUK
        for ((k, aturan) in skema) {
            val (wajib, cek) = aturan
            if (isi.containsKey(k)) { if (!cek(isi[k])) return Alasan.ISI_BENTUK } else if (wajib) return Alasan.ISI_BENTUK
        }
        return Cermin.cekSilangPerintah(isi) ?: Keputusan.cekSilangPerintah(isi)
    }

    /** Isi kabar Mac→HP (field umum + tanda_terima ketat; jenis lain bentuk bebas). null = sah. */
    fun cekIsiKabar(isi: Any?): String? {
        if (isi !is Map<*, *> || isi["jenis"] !in JENIS_KABAR) return Alasan.ISI_BENTUK
        if (!heks(Heks.POLA16, isi["mac_id"]) || !heks(Heks.POLA16, isi["perangkat_id"])) return Alasan.ISI_BENTUK
        val um = isi["urut_mac"]; val db = isi["dibuat"]
        if (!intAman(um) || (um as Long) < 0 || !intAman(db) || (db as Long) <= 0) return Alasan.ISI_BENTUK
        if (isi["jenis"] == "tanda_terima") {
            val t = isi["tanda_terima"] as? Map<*, *> ?: return Alasan.ISI_BENTUK
            if (!heks(Heks.POLA32, t["perintah_id"]) || !heks(Heks.POLA64, t["perintah_sha256"]) ||
                t["hasil"] !in HASIL_TANDA_TERIMA || (t.containsKey("alasan") && !str(t["alasan"], 200))
            ) return Alasan.ISI_BENTUK
        }
        if (isi["jenis"] in Cermin.JENIS_KABAR) return Cermin.cekIsiKabar(isi) // v2: ketat, field tak dikenal ditolak
        if (isi["jenis"] in Keputusan.JENIS_KABAR) return Keputusan.cekIsiKabar(isi) // F1b: ketat
        return null
    }

    fun cekWaktu(jenisKotak: String, isi: Map<String, Any>, kedaluwarsa: Long, sekarang: Long): String? {
        val dibuat = isi["dibuat"] as Long
        if (sekarang > kedaluwarsa) return Alasan.KEDALUWARSA
        if (dibuat > sekarang + TOLERANSI_DIBUAT) return Alasan.DIBUAT_MASA_DEPAN
        if (kedaluwarsa <= dibuat || kedaluwarsa - dibuat > masaMaks(jenisKotak, isi)) return Alasan.MASA_TERLALU_PANJANG
        return null
    }

    class Opsi(
        val jenisKotak: String,
        val kunciTandaDikenal: (String) -> KunciTanda?,
        /** Kunci privat X25519 penerima (raw 32 B); lebih dari satu saat masa rotasi. */
        val kunciSandiSaya: List<ByteArray>,
        val macId: String,
        /** Wajib untuk kabar (= perangkat HP ini). */
        val perangkatId: String? = null,
        val sekarang: Long = System.currentTimeMillis(),
        val penyimpan: PenyimpanReplay? = null,
    )

    /**
     * Teks amplop dari jawaban relay: relay mengembalikan `amplop` sebagai objek JSON (KONTRAK §4) → JCS; teks lama tetap
     * diterima apa adanya; bentuk lain (null, angka, daftar) → null. Fungsi murni agar teruji JVM (QA-7).
     */
    fun teks(v: Any?): String? = when (v) {
        is String -> v
        is Map<*, *> -> runCatching { Jcs.teks(v) }.getOrNull()
        else -> null
    }

    fun periksa(teks: String, opsi: Opsi): HasilPeriksa {
        val mentah = teks.toByteArray(Charsets.UTF_8).size
        if (mentah > MAKS_BYTE) return tolak(Alasan.BENTUK)
        val a = try { JsonKetat.parse(teks) } catch (e: JsonSalah) { return tolak(Alasan.BENTUK) }
        return periksa(a, opsi)
    }

    /** Urutan SEC-46; tidak pernah melempar untuk masukan buruk. */
    @Suppress("UNCHECKED_CAST")
    fun periksa(masuk: Any?, opsi: Opsi): HasilPeriksa {
        val jk = opsi.jenisKotak
        require(jk == "perintah" || jk == "kabar") { "opsi.jenisKotak harus perintah|kabar" }
        // 1. bentuk
        cekBentuk(masuk, listOf(jk))?.let { return tolak(it) }
        val a = masuk as Map<String, Any>
        // 2. ke & dari
        val ke = a["ke"] as String
        val dari = a["dari"] as String
        val sandi = opsi.kunciSandiSaya.firstOrNull { Kripto.idKunciX25519(Hpke.publikDariPrivat(it)) == ke }
            ?: return tolak(Alasan.KE_SALAH)
        val entri = opsi.kunciTandaDikenal(dari)?.takeIf { !it.dicabut } ?: return tolak(Alasan.DARI_TIDAK_DIKENAL)
        val perluPeran = if (jk == "kabar") listOf("s_mac") else listOf("k_rencana", "k_kerjakan")
        if (entri.peran !in perluPeran) return tolak(Alasan.PERAN_SALAH)
        val pub = try { Kripto.publikP256(entri.spki) } catch (e: Exception) { return tolak(Alasan.DARI_TIDAK_DIKENAL) }
        if (Kripto.idKunciEcdsa(entri.spki) != dari) return tolak(Alasan.DARI_TIDAK_DIKENAL)
        // 3. tanda SEBELUM dekripsi
        val h = hHeader(a)
        val enc = B64u.dek(a["enc"] as String)!!
        val ct = B64u.dek(a["ct"] as String)!!
        val tanda = B64u.dek(a["tanda"] as String)!!
        if (!Kripto.verifikasiEcdsa(pub, inputTanda(h, enc, ct), tanda)) return tolak(Alasan.TANDA_SALAH)
        // 4. dekripsi
        val pt = try { Hpke.buka(sandi, enc, info(dari, ke), h, ct) } catch (e: Exception) { return tolak(Alasan.DEKRIPSI_GAGAL) }
        // 5. isi & kecocokan
        val isi = try { JsonKetat.objek(JsonKetat.utf8(pt)) } catch (e: JsonSalah) { return tolak(Alasan.ISI_BENTUK) }
        (if (jk == "perintah") cekIsiPerintah(isi) else cekIsiKabar(isi))?.let { return tolak(it) }
        if (isi["mac_id"] != opsi.macId) return tolak(Alasan.ISI_TIDAK_COCOK)
        if (jk == "perintah") {
            if (isi["id"] != a["id"] || isi["kedaluwarsa"] != a["kedaluwarsa"]) return tolak(Alasan.ISI_TIDAK_COCOK)
            if (entri.perangkatId != null && isi["perangkat_id"] != entri.perangkatId) return tolak(Alasan.ISI_TIDAK_COCOK)
            // 6. kerjakan hanya dengan K_kerjakan
            if (isi["jenis"] == "jalankan" && isi["mode"] == "kerjakan" && entri.peran != "k_kerjakan") {
                return tolak(Alasan.KERJAKAN_TANPA_K_KERJAKAN)
            }
        } else if (isi["perangkat_id"] != opsi.perangkatId) return tolak(Alasan.ISI_TIDAK_COCOK)
        // 7. waktu
        cekWaktu(jk, isi, a["kedaluwarsa"] as Long, opsi.sekarang)?.let { return tolak(it) }
        // 8. anti-replay (dicatat hanya bila semua lolos)
        opsi.penyimpan?.let { p ->
            val perangkat = if (jk == "perintah") isi["perangkat_id"] as String else "mac:$dari"
            val urut = (if (jk == "perintah") isi["urut"] else isi["urut_mac"]) as Long
            val r = try {
                p.periksaDanCatat(perangkat, a["id"] as String, urut, a["kedaluwarsa"] as Long, opsi.sekarang)
            } catch (e: Exception) {
                Alasan.PENYIMPAN_GAGAL
            }
            if (r != null) return tolak(r)
        }
        return HasilPeriksa(true, isi = isi, peran = entri.peran, hash = hash(a))
    }

    private fun tolak(alasan: String) = HasilPeriksa(false, alasan = alasan)
}

/**
 * Logika anti-replay yang sama dengan pelaksana-relay.js (id terlihat disimpan sampai kedaluwarsa + 1 jam; urut naik ketat
 * per pengirim). Status bisa diserialisasi ke JSON agar disimpan terenkripsi di Brankas.
 */
class PenyimpanReplayMemori(
    urutAwal: Map<String, Long> = emptyMap(),
    idAwal: Map<String, Long> = emptyMap(),
    private val urutBawaan: Long? = null,
) : PenyimpanReplay {
    val urut = LinkedHashMap(urutAwal)
    val id = LinkedHashMap(idAwal)

    override fun periksaDanCatat(perangkat: String, id: String, urut: Long, kedaluwarsa: Long, sekarang: Long): String? {
        this.id.entries.removeIf { it.value + SIMPAN_SETELAH < sekarang }
        if (this.id.containsKey(id)) return Alasan.REPLAY_ID
        val terakhir = this.urut[perangkat] ?: urutBawaan
        if (terakhir != null && urut <= terakhir) return Alasan.URUT_LAMA
        if (this.id.size >= MAKS_ID) {
            this.id.entries.sortedBy { it.value }.take(this.id.size - MAKS_ID + 1).map { it.key }.forEach { this.id.remove(it) }
        }
        this.id[id] = kedaluwarsa
        this.urut[perangkat] = urut
        return null
    }

    fun keJson(): String = Jcs.teks(mapOf("v" to 1L, "urut" to urut, "id" to id))

    companion object {
        const val SIMPAN_SETELAH = 3_600_000L
        const val MAKS_ID = 2000

        @Suppress("UNCHECKED_CAST")
        fun dariJson(teks: String): PenyimpanReplayMemori {
            val o = JsonKetat.objek(teks)
            return PenyimpanReplayMemori(o["urut"] as Map<String, Long>, o["id"] as Map<String, Long>)
        }
    }
}
