package pro.padeveloper.studio.kunci

/**
 * Pratinjau langsung & screenshot (roadmap 2b/2c; Mac: pelaksana-pratinjau.js): skema perintah `pratinjau` dan pemeriksa KETAT
 * kabar `pratinjau` (keadaan per proyek) & `pratinjau_gambar` (JPEG base64 ≤ 40 KB). Sama persis dengan pelaksana-relay.js
 * (SKEMA_PERINTAH.pratinjau, SKEMA_KABAR_PRATINJAU*): field tak dikenal → isi_bentuk. Aksi "mulai" menjalankan server dev di Mac
 * → selalu K_kerjakan + sidik jari. Alamat yang boleh dibuka HP hanya https://…​.ts.net:<port>/… dari snapshot terverifikasi.
 * Murni (tanpa Android) agar teruji JVM.
 */
object Pratinjau {
    val JENIS_PERINTAH = listOf("pratinjau")
    val JENIS_KABAR = listOf("pratinjau", "pratinjau_gambar")
    val AKSI = listOf("daftar", "mulai", "henti", "potret")
    val STATUS = listOf("mati", "mulai", "menyala", "gagal")
    val UKURAN = listOf("hp", "desktop")

    private val POLA_ALAMAT = Regex("^https://[a-z0-9.-]+\\.ts\\.net:\\d{2,5}/\\S*$")
    private val POLA_B64 = Regex("^[A-Za-z0-9+/]+={0,2}$")

    private fun bulat(v: Any?, min: Long, maks: Long = JsonKetat.SAFE_MAKS): Boolean = v is Long && v in min..maks
    private fun teks(v: Any?, maks: Int, min: Int = 1): Boolean = v is String && v.length in min..maks
    private fun idProyek(v: Any?): Boolean = v is String && Cermin.POLA_ID.matches(v)
    private fun daftar(v: Any?, maks: Int, butir: (Any?) -> Boolean): Boolean = v is List<*> && v.size <= maks && v.all(butir)

    /** Alamat pratinjau yang boleh dibuka di browser: https, host *.ts.net (tailnet owner), dengan port. */
    fun alamatSah(v: Any?): Boolean = teks(v, 300) && POLA_ALAMAT.matches(v as String)

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

    val SKEMA_PERINTAH: Map<String, Map<String, Pair<Boolean, (Any?) -> Boolean>>> = mapOf(
        "pratinjau" to mapOf(
            "proyek" to (true to { v: Any? -> idProyek(v) }),
            "aksi" to (true to { v: Any? -> v is String && v in AKSI }),
        ),
    )

    private val SKEMA_BUTIR = mapOf(
        "proyek" to w(::idProyek), "status" to w { it is String && it in STATUS }, "bisaMulai" to w { it is Boolean },
        "alamat" to o(::alamatSah), "sampai" to o { bulat(it, 0) }, "galat" to o { teks(it, 200) },
    )
    private val SKEMA_KABAR = mapOf("daftar" to w { daftar(it, 10) { b -> cocok(b, SKEMA_BUTIR) } })
    private val SKEMA_GAMBAR = mapOf(
        "proyek" to w(::idProyek), "ukuran" to w { it is String && it in UKURAN },
        "jpeg" to w { it is String && it.length in 4..56000 && POLA_B64.matches(it) },
        "lebar" to w { bulat(it, 1, 4000) }, "tinggi" to w { bulat(it, 1, 4000) },
    )
    private val UMUM_KABAR = setOf("mac_id", "perangkat_id", "urut_mac", "dibuat", "jenis")

    /** Isi kabar `pratinjau` / `pratinjau_gambar` (field umum sudah dicek AmplopV1.cekIsiKabar). null = sah. */
    fun cekIsiKabar(isi: Map<*, *>): String? {
        val jenis = isi["jenis"] as? String ?: return Alasan.ISI_BENTUK
        if (jenis !in JENIS_KABAR) return Alasan.ISI_BENTUK
        for (k in isi.keys) if (k !in UMUM_KABAR && k != jenis) return Alasan.ISI_BENTUK
        if (!cocok(isi[jenis], if (jenis == "pratinjau") SKEMA_KABAR else SKEMA_GAMBAR)) return Alasan.ISI_BENTUK
        return null
    }

    /** Butir proyek [proyek] dari snapshot `pratinjau` terakhir yang terverifikasi, atau null. */
    @Suppress("UNCHECKED_CAST")
    fun cariButir(snapshot: Map<String, Any>?, proyek: String): Map<String, Any>? =
        ((snapshot?.get("pratinjau") as? Map<String, Any>)?.get("daftar") as? List<Map<String, Any>>)?.firstOrNull { it["proyek"] == proyek }
}
