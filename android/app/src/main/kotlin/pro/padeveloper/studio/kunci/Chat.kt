package pro.padeveloper.studio.kunci

/**
 * Riwayat chat HP per proyek (tugas yang dikirim dari HP + jawaban Claude) agar tetap tampil setelah aplikasi ditutup.
 * Disimpan di [CacheRiwayat] terpisah (folder `chat`, kunci Keystore & aturan K-06 yang sama: AES-256-GCM, ≤7 hari, ≤20 proyek,
 * ≤5 MB, dihapus saat dicabut/lepas/kode darurat). Entri dari Dart dicek ketat di sini: kunci tak dikenal / tipe salah →
 * IllegalArgumentException (argumen_tidak_sah); bilangan Dart (Int/Long) → Long. Murni (teruji JVM).
 */
object RiwayatChat {
    const val MAKS_ENTRI = 200
    private val POLA_PROYEK = Regex("^[a-z0-9-]{1,40}$")
    private val POLA_TUGAS = Regex("^t-[a-z0-9]{1,12}-[0-9a-f]{16}$")
    private val TAHAP = setOf(
        "mengirim", "gagalKirim", "menungguDiambil", "diterima", "bekerja", "selesai", "gagal", "dihentikan", "batasWaktu", "ditolak",
        "kedaluwarsa",
    )

    /** Kunci cache untuk proyek (ruang nama terpisah dari id sesi cermin). */
    fun kunci(proyek: String): String {
        require(POLA_PROYEK.matches(proyek)) { "proyek" }
        return "chat|$proyek"
    }

    private fun teks(v: Any?, maks: Int, kosong: Boolean = true): Boolean = v is String && v.length <= maks && (kosong || v.isNotEmpty())

    private fun bulat(v: Any?): Long? = when (v) {
        is Int -> v.toLong()
        is Long -> v
        else -> null
    }

    private fun langkah(v: Any?, maks: Int): List<Map<String, Any>> {
        require(v is List<*> && v.size <= maks) { "langkah" }
        return v.map { x ->
            require(x is Map<*, *> && x.keys.all { it == "alat" || it == "ringkas" }) { "langkah" }
            require(teks(x["alat"], 80) && teks(x["ringkas"], 300)) { "langkah" }
            linkedMapOf<String, Any>("alat" to x["alat"] as String, "ringkas" to x["ringkas"] as String)
        }
    }

    /** Satu entri tugas → peta bersih; melempar bila tidak sah. */
    fun cekEntri(e: Any?): Map<String, Any> {
        require(e is Map<*, *>) { "entri" }
        val o = linkedMapOf<String, Any>()
        for ((k, v) in e) {
            if (v == null) continue
            when (k) {
                "id" -> require(v is String && POLA_TUGAS.matches(v)) { "id" }
                "akun" -> require(v is String && POLA_PROYEK.matches(v)) { "akun" }
                "mode" -> require(v == "rencana" || v == "kerjakan") { "mode" }
                "pesan" -> require(teks(v, AmplopV1.MAKS_PESAN)) { "pesan" }
                "tahap" -> require(v is String && v in TAHAP) { "tahap" }
                "perintahId" -> require(teks(v, 80, kosong = false)) { "perintahId" }
                "teks" -> require(teks(v, 32_000)) { "teks" }
                "alasan" -> require(teks(v, 500)) { "alasan" }
                "baru" -> require(v is Boolean) { "baru" }
                "waktu", "kedaluwarsa", "mulai" -> require((bulat(v) ?: -1L) in 0..JsonKetat.SAFE_MAKS) { k.toString() }
                "batasMenit", "durasiMs" -> require((bulat(v) ?: -1L) in 0..JsonKetat.SAFE_MAKS) { k.toString() }
                "urut" -> require((bulat(v) ?: -2L) in -1..JsonKetat.SAFE_MAKS) { "urut" }
                "alat" -> { o["alat"] = langkah(v, 50); continue }
                "ditolak" -> { o["ditolak"] = langkah(v, 10); continue }
                else -> throw IllegalArgumentException("kunci")
            }
            o[k as String] = bulat(v) ?: v
        }
        for (wajib in listOf("id", "waktu", "akun", "mode", "pesan", "tahap", "baru")) require(o.containsKey(wajib)) { wajib }
        return o
    }

    /** Daftar entri (≤200, id unik) → daftar bersih. */
    fun cekDaftar(v: Any?): List<Map<String, Any>> {
        require(v is List<*> && v.size <= MAKS_ENTRI) { "entri" }
        val hasil = v.map(::cekEntri)
        require(hasil.map { it["id"] }.toSet().size == hasil.size) { "id ganda" }
        return hasil
    }
}
