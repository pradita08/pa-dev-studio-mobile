package pro.padeveloper.studio.kunci

/**
 * Review hasil Kerjakan (roadmap 2; Mac: pelaksana-review.js): skema perintah `review_daftar` / `review_berkas` / `review_aksi`
 * dan pemeriksa KETAT kabar `review` (daftar review per proyek) & `review_berkas` (isi diff satu berkas). Sama persis dengan
 * pelaksana-relay.js (SKEMA_PERINTAH.review_*, SKEMA_KABAR_REVIEW*): field tak dikenal → isi_bentuk.
 * `review_aksi` (commit/buang/push) selalu ditandatangani K_kerjakan + sidik jari; Mac menolak tanda K_rencana.
 * Murni (tanpa Android) agar teruji JVM.
 */
object Review {
    val JENIS_PERINTAH = listOf("review_daftar", "review_berkas", "review_aksi")
    val JENIS_KABAR = listOf("review", "review_berkas")
    val AKSI = listOf("commit", "buang", "push")
    val STATUS = listOf("terbuka", "dikomit", "didorong", "dibuang", "usang")
    val STATUS_BERKAS = listOf("A", "M", "D", "T")

    const val MAKS_REVIEW = 6
    const val MAKS_BERKAS = 60
    const val MAKS_TES = 10
    const val MAKS_PESAN = 200
    const val MAKS_JALUR = 300
    const val MAKS_DIFF = 40000

    private val POLA32 = Regex("^[0-9a-f]{32}$")
    private val POLA_COMMIT = Regex("^[0-9a-f]{4,12}$")
    private val KENDALI = Regex("[\\u0000-\\u001f\\u007f]")

    private fun bulat(v: Any?, min: Long, maks: Long = JsonKetat.SAFE_MAKS): Boolean = v is Long && v in min..maks
    private fun teks(v: Any?, maks: Int, min: Int = 1): Boolean = v is String && v.length in min..maks
    private fun id32(v: Any?): Boolean = v is String && POLA32.matches(v)
    private fun daftar(v: Any?, maks: Int, butir: (Any?) -> Boolean): Boolean = v is List<*> && v.size <= maks && v.all(butir)
    private fun tanpaKendali(v: Any?): Boolean = v is String && !KENDALI.containsMatchIn(v)

    private class Aturan(val wajib: Boolean, val cek: (Any?) -> Boolean)

    private fun w(cek: (Any?) -> Boolean) = Aturan(true, cek)
    private fun o(cek: (Any?) -> Boolean) = Aturan(false, cek)

    private fun cocok(v: Any?, skema: Map<String, Aturan>): Boolean {
        if (v !is Map<*, *>) return false
        for (k in v.keys) if (k !is String || k !in skema) return false
        for ((k, a) in skema) {
            if (v.containsKey(k)) { if (!a.cek(v[k])) return false } else if (a.wajib) return false
        }
        return true
    }

    // ---------------------------------------------------------------- perintah HP → Mac

    /** Pesan commit: 1–200 karakter, satu baris, tanpa spasi di tepi. */
    fun pesanSah(v: Any?): Boolean = teks(v, MAKS_PESAN) && tanpaKendali(v) && (v as String).trim() == v

    val SKEMA_PERINTAH: Map<String, Map<String, Pair<Boolean, (Any?) -> Boolean>>> = mapOf(
        "review_daftar" to emptyMap<String, Pair<Boolean, (Any?) -> Boolean>>(),
        "review_berkas" to mapOf(
            "review" to (true to { v: Any? -> id32(v) }),
            "jalur" to (true to { v: Any? -> teks(v, MAKS_JALUR) && tanpaKendali(v) }),
        ),
        "review_aksi" to mapOf(
            "review" to (true to { v: Any? -> id32(v) }),
            "aksi" to (true to { v: Any? -> v is String && v in AKSI }),
            "pesan" to (false to { v: Any? -> pesanSah(v) }),
        ),
    )

    /** Aturan lintas field: `pesan` ada ⇔ aksi "commit". null = sah. */
    fun cekSilangPerintah(isi: Map<*, *>): String? {
        if (isi["jenis"] == "review_aksi" && isi.containsKey("pesan") != (isi["aksi"] == "commit")) return Alasan.ISI_BENTUK
        return null
    }

    // ---------------------------------------------------------------- kabar Mac → HP

    private val SKEMA_BERKAS = mapOf(
        "jalur" to w { teks(it, 240) }, "status" to w { it is String && it in STATUS_BERKAS }, "tambah" to w { bulat(it, 0) },
        "kurang" to w { bulat(it, 0) }, "biner" to w { it is Boolean },
    )
    private val SKEMA_TES = mapOf("perintah" to w { teks(it, 120) }, "ok" to w { it == null || it == JsonNull || it is Boolean })
    private val SKEMA_BUTIR = mapOf(
        "id" to w(::id32), "proyek" to w { it is String && Cermin.POLA_ID.matches(it) }, "status" to w { it is String && it in STATUS },
        "dibuat" to w { bulat(it, 0) }, "diperbarui" to w { bulat(it, 0) }, "tugas" to w { daftar(it, 20) { t -> teks(t, 64) } },
        "cabang" to w { teks(it, 100, 0) }, "hulu" to w { it is Boolean }, "belumPush" to w { bulat(it, 0, 100_000) },
        "berkas" to w { daftar(it, MAKS_BERKAS) { b -> cocok(b, SKEMA_BERKAS) } }, "lebih" to w { bulat(it, 0, 100_000) },
        "tes" to w { daftar(it, MAKS_TES) { x -> cocok(x, SKEMA_TES) } }, "isi" to w { it is Boolean },
        "boleh" to w { daftar(it, 3) { a -> a is String && a in AKSI } },
        "commit" to o { it is String && POLA_COMMIT.matches(it) }, "galat" to o { teks(it, 200) },
    )
    private val SKEMA_KABAR_REVIEW = mapOf("daftar" to w { daftar(it, MAKS_REVIEW) { b -> cocok(b, SKEMA_BUTIR) } })
    private val SKEMA_KABAR_BERKAS = mapOf(
        "review" to w(::id32), "jalur" to w { teks(it, MAKS_JALUR) }, "teks" to w { teks(it, MAKS_DIFF, 0) },
        "terpotong" to w { it is Boolean }, "biner" to w { it is Boolean }, "disamarkan" to w { it is Boolean }, "rahasia" to o { it == true },
    )
    private val UMUM_KABAR = setOf("mac_id", "perangkat_id", "urut_mac", "dibuat", "jenis")

    /** Isi kabar `review` / `review_berkas` (field umum sudah dicek AmplopV1.cekIsiKabar). null = sah. */
    fun cekIsiKabar(isi: Map<*, *>): String? {
        val jenis = isi["jenis"] as? String ?: return Alasan.ISI_BENTUK
        if (jenis !in JENIS_KABAR) return Alasan.ISI_BENTUK
        for (k in isi.keys) if (k !in UMUM_KABAR && k != jenis) return Alasan.ISI_BENTUK
        val m = isi[jenis]
        if (!cocok(m, if (jenis == "review") SKEMA_KABAR_REVIEW else SKEMA_KABAR_BERKAS)) return Alasan.ISI_BENTUK
        if (jenis == "review_berkas" && (m as Map<*, *>)["rahasia"] == true && m["teks"] != "") return Alasan.ISI_BENTUK // rahasia → tanpa isi
        return null
    }

    /** Butir review [id] dari snapshot `review` terakhir yang terverifikasi (untuk teks BiometricPrompt, SEC-51), atau null. */
    @Suppress("UNCHECKED_CAST")
    fun cariButir(snapshot: Map<String, Any>?, id: String): Map<String, Any>? =
        ((snapshot?.get("review") as? Map<String, Any>)?.get("daftar") as? List<Map<String, Any>>)?.firstOrNull { it["id"] == id }

    /** Teks sidik jari aksi (judul, subjudul, keterangan) disusun dari butir terverifikasi — bukan dari Dart. */
    fun teksSidikJari(butir: Map<String, Any>, aksi: String, pesan: String?): Triple<String, String, String?> {
        val proyek = (butir["proyek"] as? String ?: "").take(40)
        val berkas = butir["berkas"] as? List<*> ?: emptyList<Any>()
        val n = berkas.size + ((butir["lebih"] as? Long) ?: 0L).toInt()
        val cabang = (butir["cabang"] as? String)?.takeIf { it.isNotEmpty() }?.take(60) ?: "(tanpa cabang)"
        val contoh = berkas.take(3).mapNotNull { (it as? Map<*, *>)?.get("jalur") as? String }.joinToString(", ").let {
            if (it.length > 160) it.take(160) + "…" else it
        }
        return when (aksi) {
            "commit" -> Triple("Commit $n berkas · $proyek", "Cabang $cabang", listOfNotNull(pesan?.let { "\"${it.take(120)}\"" }, contoh.ifEmpty { null }).joinToString("\n").ifEmpty { null })
            "buang" -> Triple("Buang perubahan $n berkas · $proyek", "Berkas dikembalikan ke sebelum tugas — tidak bisa dibatalkan", contoh.ifEmpty { null })
            else -> Triple("Push ${(butir["belumPush"] as? Long) ?: 0L} commit · $proyek", "Cabang $cabang ke upstream-nya", null)
        }
    }
}
