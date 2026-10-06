package pro.padeveloper.studio.kunci

import java.io.File
import javax.crypto.AEADBadTagException
import javax.crypto.Cipher
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * Cermin sesi (KONTRAK-apk-v2 §2.1–2.2, §6.3; fase F1): skema perintah `cermin_*`, pemeriksa KETAT isi kabar
 * `cermin_sesi`/`cermin`/`cermin_riwayat` (field tak dikenal → isi_bentuk, gagal-tertutup), dan aturan cache riwayat lokal (K-06).
 * Semua fungsi di sini murni (tanpa Android) agar teruji JVM; kunci Keystore cache ada di Penyimpanan.kt (KunciRiwayat).
 */
object Cermin {
    /** = POLA_SESI pelaksana.js (UUID, huruf besar/kecil). */
    val POLA_SESI = Regex("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")

    /** = POLA_ID pelaksana.js (id proyek/akun). */
    val POLA_ID = Regex("^[a-z0-9-]{1,40}$")

    val JENIS_PERINTAH = listOf("cermin_daftar", "cermin_buka", "cermin_tutup", "cermin_riwayat")
    val JENIS_KABAR = listOf("cermin_sesi", "cermin", "cermin_riwayat")

    val ASAL = listOf("vscode", "cli", "pelaksana", "hp", "lain")
    val STATUS_SESI = listOf("bekerja", "menunggu_izin", "diam", "selesai")
    val BISA_LANJUT = listOf("sama", "cabang", "tidak")
    val TINGKAT = listOf("ringkas", "isi")
    val PERAN_RIWAYAT = listOf("owner", "claude", "alat", "divisi", "izin", "sistem")
    val GALAT_RIWAYAT = listOf("format_tidak_dikenal", "sesi_bukan_milik_proyek", "tidak_tersedia")

    /** `kind` bentuk normalize() server.js:190. */
    val KIND = listOf("session", "session_end", "prompt", "tool", "tool_done", "tool_fail", "agent_start", "agent_stop", "stop", "notify")

    const val MAKS_SESI = 50
    const val MAKS_DIVISI = 10
    const val MAKS_EV = 60
    const val MAKS_ENTRI = 50

    // ---------------------------------------------------------------- pemeriksa dasar

    private fun bulat(v: Any?, min: Long, maks: Long = JsonKetat.SAFE_MAKS): Boolean = v is Long && v in min..maks
    private fun teks(v: Any?, maks: Int, min: Int = 1): Boolean = v is String && v.length in min..maks
    private fun salah1(v: Any?, daftar: List<String>): Boolean = v is String && v in daftar
    private fun sesi(v: Any?): Boolean = v is String && POLA_SESI.matches(v)
    private fun id(v: Any?): Boolean = v is String && POLA_ID.matches(v)
    private fun bool(v: Any?): Boolean = v is Boolean

    /** Opsional di kabar: tidak ada, null, atau lolos [f]. */
    private fun atauNull(f: (Any?) -> Boolean): (Any?) -> Boolean = { v -> v == null || v == JsonNull || f(v) }

    /** Aturan: true = wajib. Field di luar skema → tolak. */
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

    private fun daftar(v: Any?, maks: Int, butir: (Any?) -> Boolean): Boolean = v is List<*> && v.size <= maks && v.all(butir)

    // ---------------------------------------------------------------- perintah HP → Mac (§2.1)

    /**
     * Skema field khusus perintah cermin (digabung ke AmplopV1.SKEMA_PERINTAH; field umum ada di sana).
     * Pasangan: (wajib, pemeriksa) — bentuk yang sama dengan AmplopV1.
     */
    val SKEMA_PERINTAH: Map<String, Map<String, Pair<Boolean, (Any?) -> Boolean>>> = mapOf(
        "cermin_daftar" to mapOf(
            "sejakJam" to (false to { v: Any? -> bulat(v, 1, 48) }),
            "sejakHari" to (false to { v: Any? -> bulat(v, 1, 30) }),
            "cari" to (false to { v: Any? -> teks(v, 40) }),
            "proyek" to (false to { v: Any? -> id(v) }),
        ),
        // sesi: uuid | null (null = pembaruan daftar)
        "cermin_buka" to mapOf(
            "sesi" to (true to { v: Any? -> v == JsonNull || sesi(v) }),
            "proyek" to (false to { v: Any? -> id(v) }),
            "akun" to (false to { v: Any? -> id(v) }),
        ),
        "cermin_tutup" to emptyMap(),
        "cermin_riwayat" to mapOf(
            "sesi" to (true to { v: Any? -> sesi(v) }),
            "proyek" to (true to { v: Any? -> id(v) }),
            "akun" to (true to { v: Any? -> id(v) }),
            "sebelum" to (false to { v: Any? -> teks(v, 64) }),
            "batas" to (true to { v: Any? -> bulat(v, 1, 50) }),
        ),
    )

    /** Aturan lintas field perintah cermin (null = sah). `cermin_daftar`: tepat satu dari sejakJam/sejakHari. */
    fun cekSilangPerintah(isi: Map<*, *>): String? {
        if (isi["jenis"] == "cermin_daftar" && (isi.containsKey("sejakJam") == isi.containsKey("sejakHari"))) return Alasan.ISI_BENTUK
        return null
    }

    // ---------------------------------------------------------------- kabar Mac → HP (§2.2)

    private val SKEMA_DIVISI = mapOf("peran" to w { teks(it, 80) }, "status" to w { teks(it, 40) })
    private val SKEMA_ALAT = mapOf("alat" to w { teks(it, 120) }, "ringkas" to w { teks(it, 80, 0) })

    private val SKEMA_BUTIR_SESI = mapOf(
        "sesi" to w(::sesi), "akun" to w(::id), "proyek" to w(::id), "judul" to w { teks(it, 60, 0) },
        "asal" to w { salah1(it, ASAL) }, "status" to w { salah1(it, STATUS_SESI) }, "terbuka" to w(::bool),
        "mulai" to w { bulat(it, 0) }, "terakhir" to w { bulat(it, 0) },
        "divisi" to w { daftar(it, MAKS_DIVISI) { d -> cocok(d, SKEMA_DIVISI) } },
        "alat" to o(atauNull { cocok(it, SKEMA_ALAT) }),
        "bisaLanjut" to w { salah1(it, BISA_LANJUT) }, "keputusan_n" to w { bulat(it, 0, 10_000) },
        "tingkat" to w { salah1(it, TINGKAT) },
    )
    private val SKEMA_CERMIN_SESI = mapOf(
        "sesi" to w { daftar(it, MAKS_SESI) { b -> cocok(b, SKEMA_BUTIR_SESI) } }, "lagi" to w(::bool),
    )

    private val SKEMA_EV = mapOf(
        "sesi" to w(::sesi), "ts" to w { bulat(it, 0) }, "kind" to w { salah1(it, KIND) },
        "who" to o(atauNull { teks(it, 80, 0) }), "agentId" to o(atauNull { teks(it, 120, 0) }),
        "tool" to o(atauNull { teks(it, 120, 0) }), "detail" to o(atauNull { teks(it, 300, 0) }),
        "sub" to o(atauNull { teks(it, 80, 0) }), "text" to o(atauNull { teks(it, 4000, 0) }),
    )
    private val SKEMA_CERMIN = mapOf(
        "urut_cermin" to w { bulat(it, 0) }, "ev" to w { daftar(it, MAKS_EV) { e -> cocok(e, SKEMA_EV) } },
    )

    /** id entri: teks ≤64 atau bilangan bulat ≥0 (kontrak tidak menetapkan tipe; keduanya diterima, lainnya ditolak). */
    private fun idEntri(v: Any?): Boolean = teks(v, 64) || bulat(v, 0)

    private val SKEMA_ENTRI = mapOf(
        "id" to w(::idEntri), "waktu" to w { bulat(it, 0) }, "peran" to w { salah1(it, PERAN_RIWAYAT) },
        "teks" to o(atauNull { teks(it, 4000, 0) }), "alat" to o(atauNull { teks(it, 120, 0) }),
        "ringkas" to o(atauNull { teks(it, 1500, 0) }), "divisi" to o(atauNull { teks(it, 80, 0) }),
    )
    private val SKEMA_CERMIN_RIWAYAT = mapOf(
        "sesi" to w(::sesi), "entri" to w { daftar(it, MAKS_ENTRI) { e -> cocok(e, SKEMA_ENTRI) } },
        "sebelum" to o(atauNull { teks(it, 64) }), "lagi" to w(::bool),
        "versiParser" to w { teks(it, 40) || bulat(it, 0) },
        "galat" to o(atauNull { salah1(it, GALAT_RIWAYAT) }),
    )

    private val SKEMA_KABAR = mapOf(
        "cermin_sesi" to SKEMA_CERMIN_SESI, "cermin" to SKEMA_CERMIN, "cermin_riwayat" to SKEMA_CERMIN_RIWAYAT,
    )
    private val UMUM_KABAR = setOf("mac_id", "perangkat_id", "urut_mac", "dibuat", "jenis")

    /**
     * Isi kabar cermin (field umum sudah dicek AmplopV1.cekIsiKabar). Ketat: di tingkat atas hanya field umum + objek bernama
     * `jenis` (konvensi v1, mis. `tanda_terima`), di dalamnya hanya field kontrak. null = sah.
     */
    fun cekIsiKabar(isi: Map<*, *>): String? {
        val jenis = isi["jenis"] as? String ?: return Alasan.ISI_BENTUK
        val skema = SKEMA_KABAR[jenis] ?: return Alasan.ISI_BENTUK
        for (k in isi.keys) if (k !in UMUM_KABAR && k != jenis) return Alasan.ISI_BENTUK
        val muatan = isi[jenis]
        if (!cocok(muatan, skema)) return Alasan.ISI_BENTUK
        // galat riwayat → tanpa entri (parser tidak mengenal format / sesi bukan milik proyek)
        if (jenis == "cermin_riwayat") {
            muatan as Map<*, *>
            val galat = muatan["galat"]
            if (galat != null && galat != JsonNull && (muatan["entri"] as List<*>).isNotEmpty()) return Alasan.ISI_BENTUK
        }
        return null
    }
}

/**
 * Aturan cache riwayat lokal (K-06, KONTRAK-apk-v2 §6.3): ≤7 hari, ≤20 sesi, ≤5 MB; entri per sesi digabung per id
 * (yang baru menimpa), diurutkan per waktu. Murni (teruji JVM).
 */
object AturanRiwayat {
    const val UMUR_MAKS = 7 * 24 * 3_600_000L
    const val MAKS_SESI = 20
    const val MAKS_BYTE = 5L * 1024 * 1024
    /** 1000 × teks ≤4000 ≈ 4 MB: satu sesi tidak pernah melebihi batas total sendirian. */
    const val MAKS_ENTRI_SESI = 1000

    private fun kunciEntri(e: Map<*, *>): String = when (val v = e["id"]) {
        is String -> "s:$v"
        else -> "n:$v"
    }

    @Suppress("UNCHECKED_CAST")
    fun gabung(lama: List<Map<String, Any>>, baru: List<Map<String, Any>>, sekarang: Long): List<Map<String, Any>> {
        val peta = LinkedHashMap<String, Map<String, Any>>()
        for (e in lama + baru) peta[kunciEntri(e)] = e
        return saring(peta.values.toList(), sekarang)
    }

    /** Buang entri lebih tua dari 7 hari, urutkan (waktu, id), simpan paling banyak 1000 terbaru. */
    fun saring(entri: List<Map<String, Any>>, sekarang: Long): List<Map<String, Any>> =
        entri.filter { (it["waktu"] as? Long ?: 0L) >= sekarang - UMUR_MAKS }
            .sortedWith(compareBy<Map<String, Any>>({ it["waktu"] as Long }, { kunciEntri(it) }))
            .takeLast(MAKS_ENTRI_SESI)

    class Berkas(val nama: String, val diperbarui: Long, val ukuran: Long)

    /** Nama berkas yang harus dihapus: lebih tua dari 7 hari, lalu yang terlama di luar 20 sesi / 5 MB. */
    fun pangkas(berkas: List<Berkas>, sekarang: Long): Set<String> {
        val hapus = HashSet<String>()
        var jumlah = 0
        var total = 0L
        for (b in berkas.sortedByDescending { it.diperbarui }) {
            if (b.diperbarui < sekarang - UMUR_MAKS || jumlah + 1 > MAKS_SESI || total + b.ukuran > MAKS_BYTE) {
                hapus += b.nama
                continue
            }
            jumlah++
            total += b.ukuran
        }
        return hapus
    }
}

/**
 * Cache riwayat terenkripsi (K-06): satu berkas per sesi di [folder] (noBackupFilesDir), isi JSON dibungkus AES-256-GCM
 * dengan kunci dari [kunci] (Keystore `setUnlockedDeviceRequired(true)` di aplikasi; kunci perangkat lunak di uji JVM).
 * Format: "PRL1" ‖ iv(12) ‖ ct+tag; AAD = "padev-riwayat-v1|" + sesi (berkas tidak bisa ditukar antar-sesi).
 * Nama berkas = hash sesi (id sesi tidak terlihat di sistem berkas). Isi tidak pernah ditulis ke log.
 */
class CacheRiwayat(
    private val folder: File,
    private val kunci: () -> SecretKey,
    private val jam: () -> Long = System::currentTimeMillis,
) {
    private fun aad(sesi: String) = (AWALAN + sesi.lowercase()).toByteArray(Charsets.UTF_8)

    fun berkas(sesi: String): File = File(folder, Heks.enk(Kripto.sha256(aad(sesi))).substring(0, 32) + ".bin")

    private fun segel(sesi: String, teks: String): ByteArray {
        val c = Cipher.getInstance("AES/GCM/NoPadding")
        c.init(Cipher.ENCRYPT_MODE, kunci())
        c.updateAAD(aad(sesi))
        val ct = c.doFinal(teks.toByteArray(Charsets.UTF_8))
        return MAGIC + c.iv + ct
    }

    private fun buka(sesi: String, b: ByteArray): String {
        if (b.size < MAGIC.size + 12 + 16 || !b.copyOfRange(0, MAGIC.size).contentEquals(MAGIC)) throw AEADBadTagException("format")
        val c = Cipher.getInstance("AES/GCM/NoPadding")
        c.init(Cipher.DECRYPT_MODE, kunci(), GCMParameterSpec(128, b, MAGIC.size, 12))
        c.updateAAD(aad(sesi))
        return String(c.doFinal(b, MAGIC.size + 12, b.size - MAGIC.size - 12), Charsets.UTF_8)
    }

    /**
     * Isi kabar `cermin_riwayat` yang SUDAH lolos Cermin.cekIsiKabar. Entri digabung dengan cache lama sesi itu.
     * Galat/entri kosong → cache tidak diubah. Melempar bila kunci tidak bisa dipakai (mis. layar terkunci) — pemanggil mengabaikan.
     */
    @Synchronized
    @Suppress("UNCHECKED_CAST")
    fun simpan(riwayat: Map<String, Any>) {
        val sesi = (riwayat["sesi"] as String).lowercase()
        if (riwayat["galat"].let { it != null && it != JsonNull }) return
        val baru = (riwayat["entri"] as List<Map<String, Any>>).map { e -> e.filterValues { it != JsonNull } }
        if (baru.isEmpty()) return
        val sekarang = jam()
        val lama = bacaMentah(sesi)?.let { it["entri"] as? List<Map<String, Any>> } ?: emptyList()
        val entri = AturanRiwayat.gabung(lama, baru, sekarang)
        if (entri.isEmpty()) return
        val isi = linkedMapOf<String, Any>("v" to 1L, "sesi" to sesi, "diperbarui" to sekarang, "entri" to entri)
        folder.mkdirs()
        val f = berkas(sesi)
        val tmp = File(folder, f.name + ".tmp")
        tmp.writeBytes(segel(sesi, Jcs.teks(isi)))
        if (!tmp.renameTo(f)) { tmp.delete(); throw IllegalStateException("cache gagal ditulis") }
        f.setLastModified(sekarang) // batas umur & urutan pangkas memakai jam yang sama dengan isi
        rapikan()
    }

    /** {sesi, diperbarui, entri} (entri >7 hari sudah dibuang) atau null bila tidak ada / rusak / kunci tak bisa dipakai. */
    @Synchronized
    @Suppress("UNCHECKED_CAST")
    fun baca(sesi: String): Map<String, Any>? {
        val o = bacaMentah(sesi.lowercase()) ?: return null
        val entri = AturanRiwayat.saring(o["entri"] as? List<Map<String, Any>> ?: return null, jam())
        if (entri.isEmpty()) return null
        return linkedMapOf("sesi" to o["sesi"] as String, "diperbarui" to o["diperbarui"] as Long, "entri" to entri)
    }

    private fun bacaMentah(sesi: String): Map<String, Any>? {
        val f = berkas(sesi)
        if (!f.isFile) return null
        if (f.lastModified() < jam() - AturanRiwayat.UMUR_MAKS) { f.delete(); return null }
        return try {
            val o = JsonKetat.objek(buka(sesi, f.readBytes()))
            if (o["v"] != 1L || o["sesi"] != sesi) { f.delete(); null } else o
        } catch (e: AEADBadTagException) {
            f.delete() // diubah/ditukar/kunci lama → buang
            null
        } catch (e: JsonSalah) {
            f.delete()
            null
        }
    }

    /** Terapkan batas 7 hari / 20 sesi / 5 MB (berdasarkan waktu tulis berkas). */
    @Synchronized
    fun rapikan() {
        val daftar = folder.listFiles()?.filter { it.isFile } ?: return
        daftar.filter { it.name.endsWith(".tmp") }.forEach { it.delete() }
        val bin = daftar.filter { it.name.endsWith(".bin") }
        val hapus = AturanRiwayat.pangkas(bin.map { AturanRiwayat.Berkas(it.name, it.lastModified(), it.length()) }, jam())
        bin.filter { it.name in hapus }.forEach { it.delete() }
    }

    /** Hapus semua berkas cache (pemanggil juga menghapus kunci Keystore-nya). */
    @Synchronized
    fun hapusSemua() {
        folder.listFiles()?.forEach { it.delete() }
    }

    companion object {
        private const val AWALAN = "padev-riwayat-v1|"
        private val MAGIC = "PRL1".toByteArray(Charsets.US_ASCII)
    }
}
