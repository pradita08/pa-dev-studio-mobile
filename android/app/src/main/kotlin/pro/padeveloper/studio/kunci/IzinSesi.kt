package pro.padeveloper.studio.kunci

/**
 * G7 bebas total Tahap B (KONTRAK-apk-v2 §10.12): izin "PIN sekali per sesi" untuk pasangan bebas (kunci tanpa autentikasi per pakai).
 * Kunci izin = UUID sesi (huruf kecil); Kerjakan baru / Chat tanpa sesi = `chat:<proyek>:<akun>`, dipindah ke UUID `sessionId` dari kabar
 * selesai. SEC-164: per proyek+akun karena Mac melanjutkan sesi terakhir per `proyek|akun` (pelaksana.js kunciSesi). Disimpan Inti di Brankas (AES-GCM Keystore) → tetap berlaku walau aplikasi ditutup/HP restart (Q3).
 * Kedaluwarsa: 12 jam tanpa pesan HP ke sesi itu, sesi `selesai`, `sambung_berakhir`, status tanpa `bebas`, dicabut/pasang ulang.
 * Logika murni (diuji JVM, IzinSesiTest); Inti memegang penyimpanan & prompt.
 */
class IzinSesi private constructor(
    private val izin: LinkedHashMap<String, Long>,     // kunci izin → waktu pesan HP terakhir (ms)
    private val slot: LinkedHashMap<String, String>,   // `<proyek>:<akun>` → UUID sesi Chat terakhir (pesan lanjutan tanpa `sesi`)
    private val tugas: LinkedHashMap<String, String>,  // perintah_id → kunci izin (untuk pindah/hapus dari kabar)
) {
    /** Kunci izin perintah `jalankan` ke [proyek]/[akun]: [sesi] bila ada; baru → `chat:<proyek>:<akun>`; lanjutan Chat → slot proyek+akun. */
    fun kunci(proyek: String, akun: String, sesi: String?, baru: Boolean): String =
        sesi?.lowercase() ?: if (baru) chat(proyek, akun) else slot[slotId(proyek, akun)] ?: chat(proyek, akun)

    /** Kunci [k] masih berizin pada [kini]. Waktu di masa depan (jam HP mundur) dianggap tidak sah. */
    fun berlaku(k: String, kini: Long): Boolean {
        val t = izin[k] ?: return false
        return t <= kini + TOLERANSI && kini - t < MASA
    }

    /** Pesan HP terkirim ke [k] (perintah [perintahId]): izin diperbarui 12 jam. Kerjakan baru mengosongkan slot Chat proyek+akun. */
    fun catat(k: String, kini: Long, perintahId: String?, proyek: String? = null, akun: String? = null, baru: Boolean = false) {
        if (baru && proyek != null && akun != null) slot.remove(slotId(proyek, akun))
        izin.remove(k); izin[k] = kini
        if (perintahId != null) { tugas.remove(perintahId); tugas[perintahId] = k }
        pangkas()
    }

    /** Kabar Chat `selesai` dengan `sessionId`: izin `chat:<proyek>:<akun>` dari perintah ini pindah ke UUID itu (+ slot proyek+akun). */
    fun pindah(perintahId: String, sessionId: String) {
        val dari = tugas[perintahId] ?: return
        if (!dari.startsWith(AWAL_CHAT) || !Cermin.POLA_SESI.matches(sessionId)) return
        val ke = sessionId.lowercase()
        val t = izin.remove(dari) ?: return
        izin.remove(ke); izin[ke] = maxOf(t, izin[ke] ?: 0L)
        slot[dari.removePrefix(AWAL_CHAT)] = ke
        tugas[perintahId] = ke
        pangkas()
    }

    /** Sesi selesai / sambung berakhir → izin sesi itu dicabut (pesan berikutnya meminta PIN lagi). */
    fun hapusSesi(sesi: String) {
        val k = sesi.lowercase()
        izin.remove(k)
        slot.entries.removeAll { it.value == k }
    }

    /** Tanda terima [perintahId] ditolak `sambung_berakhir` → izin sesi perintah itu dicabut. */
    fun hapusPerintah(perintahId: String) {
        val k = tugas.remove(perintahId) ?: return
        if (k.startsWith(AWAL_CHAT)) izin.remove(k) else hapusSesi(k)
    }

    fun kosong(): Boolean = izin.isEmpty() && slot.isEmpty() && tugas.isEmpty()

    fun keJson(): String = Jcs.teks(linkedMapOf("izin" to izin, "slot" to slot, "tugas" to tugas))

    private fun pangkas() {
        while (izin.size > MAKS_IZIN) izin.remove(izin.keys.first())
        while (slot.size > MAKS_IZIN) slot.remove(slot.keys.first())
        while (tugas.size > MAKS_TUGAS) tugas.remove(tugas.keys.first())
    }

    companion object {
        const val MASA = 12 * 60 * 60_000L
        private const val TOLERANSI = 5 * 60_000L
        private const val MAKS_IZIN = 100
        private const val MAKS_TUGAS = 40
        private const val AWAL_CHAT = "chat:"

        /** id proyek/akun = `[a-z0-9-]` (tanpa `:`), jadi `<proyek>:<akun>` tidak ambigu. */
        fun slotId(proyek: String, akun: String) = "$proyek:$akun"

        fun chat(proyek: String, akun: String) = AWAL_CHAT + slotId(proyek, akun)

        fun baru() = IzinSesi(linkedMapOf(), linkedMapOf(), linkedMapOf())

        /** Dari JSON tersimpan; rusak/tidak ada → kosong (aman: gagal ke "minta PIN"). */
        @Suppress("UNCHECKED_CAST")
        fun dari(teks: String?): IzinSesi {
            val o = teks?.let { runCatching { JsonKetat.objek(it) }.getOrNull() } ?: return baru()
            fun <T> peta(n: String, cek: (Any?) -> T?): LinkedHashMap<String, T> = LinkedHashMap<String, T>().also { h ->
                (o[n] as? Map<String, Any>)?.forEach { (k, v) -> cek(v)?.let { h[k] = it } }
            }
            return IzinSesi(peta("izin") { it as? Long }, peta("slot") { it as? String }, peta("tugas") { it as? String })
        }
    }
}
