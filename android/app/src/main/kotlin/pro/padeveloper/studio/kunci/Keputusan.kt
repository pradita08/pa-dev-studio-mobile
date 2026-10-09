package pro.padeveloper.studio.kunci

/**
 * Keputusan dari HP (APK v2 F1b; Mac: pelaksana-keputusan.js): skema perintah `keputusan_jawab` dan pemeriksa KETAT kabar
 * `keputusan` (snapshot permintaan izin/pertanyaan Claude Code yang menunggu jawaban HP ini). Sama persis dengan
 * pelaksana-relay.js (SKEMA_PERINTAH.keputusan_jawab, SKEMA_KABAR_KEPUTUSAN): field tak dikenal → isi_bentuk.
 * Murni (tanpa Android) agar teruji JVM.
 */
object Keputusan {
    val JENIS_PERINTAH = listOf("keputusan_jawab")
    val JENIS_KABAR = listOf("keputusan")

    val PILIH = listOf("tolak", "jawab", "izinkan", "izinkan_selalu")

    /** Pilihan yang wajib ditandatangani K_kerjakan (BIOMETRIC_STRONG tiap pemakaian), sama dengan Kerjakan. */
    val PILIH_KERJAKAN = listOf("izinkan", "izinkan_selalu")
    val JENIS = listOf("izin", "tanya", "rencana")
    val ALASAN_SELESAI = listOf("dijawab_hp", "dijawab_mac", "kedaluwarsa", "batal")

    const val MAKS_DAFTAR = 10
    const val MAKS_SELESAI = 20
    const val MAKS_PERTANYAAN = 4
    const val MAKS_PILIHAN = 6
    const val MAKS_JAWABAN = 500
    const val MAKS_PESAN = 500

    private val POLA32 = Regex("^[0-9a-f]{32}$")

    private fun bulat(v: Any?, min: Long, maks: Long = JsonKetat.SAFE_MAKS): Boolean = v is Long && v in min..maks
    private fun teks(v: Any?, maks: Int, min: Int = 1): Boolean = v is String && v.length in min..maks
    private fun id32(v: Any?): Boolean = v is String && POLA32.matches(v)
    private fun daftar(v: Any?, maks: Int, butir: (Any?) -> Boolean): Boolean = v is List<*> && v.size <= maks && v.all(butir)

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

    /** jawaban[i] = label terpilih / teks bebas untuk pertanyaan ke-i (1–4 soal, 1–6 pilihan, ≤500 karakter). */
    fun jawabanSah(v: Any?): Boolean =
        v is List<*> && v.size in 1..MAKS_PERTANYAAN && v.all { x -> x is List<*> && x.size in 1..MAKS_PILIHAN && x.all { teks(it, MAKS_JAWABAN) } }

    val SKEMA_PERINTAH: Map<String, Map<String, Pair<Boolean, (Any?) -> Boolean>>> = mapOf(
        "keputusan_jawab" to mapOf(
            "keputusan" to (true to { v: Any? -> id32(v) }),
            "pilih" to (true to { v: Any? -> v is String && v in PILIH }),
            "jawaban" to (false to { v: Any? -> jawabanSah(v) }),
            "pesan" to (false to { v: Any? -> teks(v, MAKS_PESAN) }),
        ),
    )

    /** Aturan lintas field: `jawaban` ada ⇔ pilih "jawab". null = sah. */
    fun cekSilangPerintah(isi: Map<*, *>): String? {
        if (isi["jenis"] == "keputusan_jawab" && isi.containsKey("jawaban") != (isi["pilih"] == "jawab")) return Alasan.ISI_BENTUK
        return null
    }

    // ---------------------------------------------------------------- kabar Mac → HP

    private val SKEMA_PILIHAN = mapOf("label" to w { teks(it, 120) }, "ket" to w { teks(it, 300, 0) })
    private val SKEMA_TANYA = mapOf(
        "teks" to w { teks(it, 500) }, "judul" to w { teks(it, 40, 0) }, "banyak" to w { it is Boolean },
        "pilihan" to w { daftar(it, MAKS_PILIHAN) { p -> cocok(p, SKEMA_PILIHAN) } },
    )
    private val SKEMA_BUTIR = mapOf(
        "id" to w(::id32), "sesi" to w { it is String && Cermin.POLA_SESI.matches(it) },
        "proyek" to w { it is String && Cermin.POLA_ID.matches(it) }, "akun" to w { it is String && Cermin.POLA_ID.matches(it) },
        "jenis" to w { it is String && it in JENIS }, "alat" to w { teks(it, 120) }, "ringkas" to w { teks(it, 4000, 0) },
        "pertanyaan" to o { daftar(it, MAKS_PERTANYAAN) { q -> cocok(q, SKEMA_TANYA) } },
        "boleh" to w { daftar(it, 4) { p -> p is String && p in PILIH } && (it as List<*>).contains("tolak") },
        "dibuat" to w { bulat(it, 0) }, "sampai" to w { bulat(it, 0) },
    )
    private val SKEMA_SELESAI = mapOf("id" to w(::id32), "alasan" to w { it is String && it in ALASAN_SELESAI })
    private val SKEMA_KABAR = mapOf(
        "daftar" to w { daftar(it, MAKS_DAFTAR) { b -> b is Map<*, *> && cocok(b, SKEMA_BUTIR) && (b["jenis"] == "tanya") == (b["pertanyaan"] is List<*>) } },
        "selesai" to w { daftar(it, MAKS_SELESAI) { s -> cocok(s, SKEMA_SELESAI) } },
    )
    private val UMUM_KABAR = setOf("mac_id", "perangkat_id", "urut_mac", "dibuat", "jenis")

    /** Isi kabar `keputusan` (field umum sudah dicek AmplopV1.cekIsiKabar). null = sah. */
    fun cekIsiKabar(isi: Map<*, *>): String? {
        if (isi["jenis"] != "keputusan") return Alasan.ISI_BENTUK
        for (k in isi.keys) if (k !in UMUM_KABAR && k != "keputusan") return Alasan.ISI_BENTUK
        if (!cocok(isi["keputusan"], SKEMA_KABAR)) return Alasan.ISI_BENTUK
        return null
    }

    /** Butir keputusan [id] dari snapshot terakhir yang terverifikasi (untuk teks BiometricPrompt, SEC-51), atau null. */
    @Suppress("UNCHECKED_CAST")
    fun cariButir(snapshot: Map<String, Any>?, id: String): Map<String, Any>? =
        ((snapshot?.get("keputusan") as? Map<String, Any>)?.get("daftar") as? List<Map<String, Any>>)?.firstOrNull { it["id"] == id }
}
