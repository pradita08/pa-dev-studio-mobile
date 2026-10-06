package pro.padeveloper.studio.kunci

/** Galat yang diteruskan ke Dart sebagai PlatformException(kode). Pesan tidak pernah memuat rahasia. */
class GalatKunci(val kode: String, pesan: String = kode) : Exception(pesan)

/** Isi QR pemasangan (kontrak §3.2). Kunci Mac dipin dari QR, tidak pernah dari relay. */
class DataQr(
    val relay: String,
    val macId: String,
    val namaMac: String,
    val kodeDaftar: String,
    val rahasia: ByteArray,
    val sMacSpki: ByteArray,
    val eMacRaw: ByteArray,
    val kedaluwarsa: Long,
) {
    val sMacId: String get() = Kripto.idKunciEcdsa(sMacSpki)
    val eMacId: String get() = Kripto.idKunciX25519(eMacRaw)
}

object Pasang {
    private val FIELD_QR = setOf("v", "relay", "mac_id", "nama_mac", "kode_daftar", "rahasia", "s_mac", "e_mac", "kedaluwarsa")
    private const val QR_MAKS_DEPAN = 10 * 60_000L // QR berlaku 5 mnt; toleransi selisih jam HP–Mac

    /**
     * Mengurai & memvalidasi QR. [relayDiizinkan] = URL relay yang dipin di build (rilis); null = terima https apa pun (debug).
     * Galat: qr_tidak_sah, qr_kedaluwarsa.
     */
    fun uraiQr(teks: String, sekarang: Long, relayDiizinkan: String?): DataQr {
        if (teks.length > 4096) throw GalatKunci("qr_tidak_sah")
        val o = try { JsonKetat.objek(teks) } catch (e: JsonSalah) { throw GalatKunci("qr_tidak_sah") }
        if (o.keys != FIELD_QR || o["v"] != 1L) throw GalatKunci("qr_tidak_sah")
        val relay = o["relay"] as? String ?: throw GalatKunci("qr_tidak_sah")
        if (!relay.startsWith("https://") || relay.contains('@') || !relay.endsWith("/") || relay.length > 200) throw GalatKunci("qr_tidak_sah")
        if (relayDiizinkan != null && relay != relayDiizinkan) throw GalatKunci("qr_tidak_sah")
        val macId = (o["mac_id"] as? String)?.takeIf { Heks.POLA16.matches(it) } ?: throw GalatKunci("qr_tidak_sah")
        val nama = (o["nama_mac"] as? String)?.takeIf { it.isNotBlank() && it.length <= 40 } ?: throw GalatKunci("qr_tidak_sah")
        val kode = (o["kode_daftar"] as? String)?.takeIf { Heks.POLA32.matches(it) } ?: throw GalatKunci("qr_tidak_sah")
        val rahasia = (o["rahasia"] as? String)?.let { B64u.dek(it) }?.takeIf { it.size == 32 } ?: throw GalatKunci("qr_tidak_sah")
        val sMac = (o["s_mac"] as? String)?.let { B64u.dek(it) } ?: throw GalatKunci("qr_tidak_sah")
        try { Kripto.publikP256(sMac) } catch (e: Exception) { throw GalatKunci("qr_tidak_sah") }
        val eMac = (o["e_mac"] as? String)?.let { B64u.dek(it) }?.takeIf { it.size == 32 } ?: throw GalatKunci("qr_tidak_sah")
        val kd = o["kedaluwarsa"] as? Long ?: throw GalatKunci("qr_tidak_sah")
        if (sekarang > kd) throw GalatKunci("qr_kedaluwarsa")
        if (kd > sekarang + QR_MAKS_DEPAN) throw GalatKunci("qr_tidak_sah")
        return DataQr(relay, macId, nama, kode, rahasia, sMac, eMac, kd)
    }

    /** Badan `POST hp/daftar` (kontrak v1.1 §4/§7): kode_daftar + mac_id dari QR. */
    fun badanDaftar(qr: DataQr): Map<String, Any> = linkedMapOf("kode_daftar" to qr.kodeDaftar, "mac_id" to qr.macId)

    /** Challenge atestasi = SHA-256(rahasia ‖ UTF-8 mac_id). */
    fun tantanganAtestasi(rahasia: ByteArray, macId: String): ByteArray =
        Kripto.sha256(rahasia, macId.toByteArray(Charsets.UTF_8))

    /** Kode SAS 6 digit = (uint32BE(SHA-256("padev-sas-v1"‖s_mac‖e_mac‖k_rencana‖k_kerjakan‖e_hp‖mac_id‖perangkat_id)[0:4]) >> 12) mod 10^6. */
    fun kodeSas(
        sMacSpki: ByteArray, eMacRaw: ByteArray, kRencanaSpki: ByteArray, kKerjakanSpki: ByteArray, eHpRaw: ByteArray,
        macId: String, perangkatId: String,
    ): String {
        require(Heks.POLA16.matches(macId) && Heks.POLA16.matches(perangkatId)) { "mac_id/perangkat_id harus 16 heksa" }
        val h = Kripto.sha256(
            "padev-sas-v1".toByteArray(Charsets.UTF_8), sMacSpki, eMacRaw, kRencanaSpki, kKerjakanSpki, eHpRaw,
            macId.toByteArray(Charsets.UTF_8), perangkatId.toByteArray(Charsets.UTF_8),
        )
        val u = ((h[0].toLong() and 0xff) shl 24) or ((h[1].toLong() and 0xff) shl 16) or
            ((h[2].toLong() and 0xff) shl 8) or (h[3].toLong() and 0xff)
        return ((u ushr 12) % 1_000_000).toString().padStart(6, '0')
    }

    /** Isi amplop `pasang` (kontrak §3.3) termasuk `hmac` = b64u(HMAC-SHA256(rahasia, JCS(isi tanpa hmac))). */
    fun isi(
        qr: DataQr, perangkatId: String, dibuat: Long, kedaluwarsa: Long, nama: String,
        kRencanaSpki: ByteArray, kKerjakanSpki: ByteArray, eHpRaw: ByteArray,
        atestasiRencana: List<ByteArray>, atestasiKerjakan: List<ByteArray>, fcm: String,
    ): Map<String, Any> {
        require(nama.isNotBlank() && nama.length <= 60) { "nama perangkat 1..60" }
        val tanpaHmac = linkedMapOf<String, Any>(
            "mac_id" to qr.macId, "perangkat_id" to perangkatId, "dibuat" to dibuat, "kedaluwarsa" to kedaluwarsa, "nama" to nama,
            "k_rencana" to B64u.enk(kRencanaSpki), "k_kerjakan" to B64u.enk(kKerjakanSpki), "e_hp" to B64u.enk(eHpRaw),
            "atestasi" to mapOf(
                "k_rencana" to atestasiRencana.map { B64u.enk(it) }, "k_kerjakan" to atestasiKerjakan.map { B64u.enk(it) },
            ),
            "fcm" to fcm,
        )
        return LinkedHashMap(tanpaHmac).apply { put("hmac", hmac(qr.rahasia, tanpaHmac)) }
    }

    fun hmac(rahasia: ByteArray, isiTanpaHmac: Map<String, Any>): String =
        B64u.enk(Kripto.hmacSha256(rahasia, Jcs.bytes(isiTanpaHmac)))

    /**
     * REV-40 (diuji JVM, REV-49): jalankan [langkah] pemasangan. Bila gagal SETELAH `hp/daftar` berhasil ([terdaftar] true),
     * hapus perangkat `menunggu` di relay dengan token itu (`DELETE hp/perangkat`; galatnya diabaikan) SEBELUM
     * [bersihkanLokal] membuang token/kunci, lalu lempar ulang galat asal. Gagal sebelum terdaftar → hanya bersihkan lokal.
     */
    fun <T> batalkanBilaGagal(
        terdaftar: () -> Boolean,
        panggilRelay: (metode: String, jalur: String) -> Unit,
        bersihkanLokal: () -> Unit,
        langkah: () -> T,
    ): T = try {
        langkah()
    } catch (e: Exception) {
        if (terdaftar()) runCatching { panggilRelay("DELETE", "hp/perangkat") }
        bersihkanLokal()
        throw e
    }
}

/** Penyusun isi perintah HP→Mac (kontrak §2). Divalidasi dengan skema yang sama seperti pemeriksa Mac. */
object Perintah {
    fun kedaluwarsa(jenis: String, mode: String?, dibuat: Long): Long {
        val isi = mapOf<String, Any>("jenis" to jenis, "mode" to (mode ?: ""))
        return dibuat + AmplopV1.masaMaks("perintah", isi)
    }

    fun isi(
        jenis: String, macId: String, perangkatId: String, id: String, urut: Long, dibuat: Long, kedaluwarsa: Long,
        tambahan: Map<String, Any>,
    ): Map<String, Any> {
        val isi = LinkedHashMap<String, Any>()
        isi["mac_id"] = macId; isi["perangkat_id"] = perangkatId; isi["id"] = id; isi["urut"] = urut
        isi["dibuat"] = dibuat; isi["kedaluwarsa"] = kedaluwarsa; isi["jenis"] = jenis
        for ((k, v) in tambahan) if (!isi.containsKey(k)) isi[k] = v else throw GalatKunci("perintah_tidak_sah")
        if (AmplopV1.cekIsiPerintah(isi) != null) throw GalatKunci("perintah_tidak_sah")
        return isi
    }
}
