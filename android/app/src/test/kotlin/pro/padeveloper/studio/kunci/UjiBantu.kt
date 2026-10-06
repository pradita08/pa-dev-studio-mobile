package pro.padeveloper.studio.kunci

import java.io.File

/** Pemuat berkas kontrak bersama (apk/kontrak/, milik Rizky) untuk unit test JVM. */
@Suppress("UNCHECKED_CAST")
object UjiBantu {
    val folderKontrak: File = File(System.getProperty("padev.kontrak") ?: "../../kontrak")
    val folderKeluaran: File = File(System.getProperty("padev.keluaran") ?: "../../build/uji-kotlin")

    fun ada(nama: String): Boolean = File(folderKontrak, nama).isFile

    fun baca(nama: String): Map<String, Any> = JsonKetat.objek(File(folderKontrak, nama).readText(Charsets.UTF_8))

    fun m(o: Any?): Map<String, Any> = o as Map<String, Any>
    fun l(o: Any?): List<Any> = o as List<Any>
    fun s(o: Any?): String = o as String

    /** Kunci uji vektor-e2e.json. */
    class KunciUji(private val v: Map<String, Any>) {
        private fun k(n: String) = m(m(v["kunci"])[n])
        fun spki(n: String): ByteArray = B64u.dek(s(k(n)["spki"]))!!
        fun penanda(n: String): Penanda {
            val p = Kripto.privatP256(B64u.dek(s(k(n)["pkcs8"]))!!)
            return Penanda { Kripto.tandaEcdsa(p, it) }
        }
        fun privatX(n: String): ByteArray = B64u.dek(s(k(n)["privat_raw"]))!!
        fun publikX(n: String): ByteArray = B64u.dek(s(k(n)["publik_raw"]))!!
        fun id(n: String): String = s(k(n)["id"])
    }

    fun kunciTandaDari(peta: Map<String, Any>): (String) -> KunciTanda? = { id ->
        (peta[id] as? Map<String, Any>)?.let {
            KunciTanda(B64u.dek(s(it["publik"]))!!, s(it["peran"]), it["perangkat_id"] as? String)
        }
    }

    /** Padanan opsiDariVektor() di apk/kontrak/uji-kripto.js. */
    fun opsiDariVektor(v: Map<String, Any>, p: Map<String, Any>, amplop: Any?): AmplopV1.Opsi {
        val ku = KunciUji(v)
        val mac = p["penerima"] == "mac"
        val konteks = m(v["konteks"])
        val dikenal = m(v["kunci_tanda_dikenal"])
        val sandi = listOf(ku.privatX(if (mac) "e_mac" else "e_hp")) +
            ((p["kunciSandiTambahan"] as? List<Any>) ?: emptyList()).map { ku.privatX(s(it)) }
        val jk = s(p["jenisKotak"])
        val sekarang = p["sekarang"] as Long
        val penyimpan = (p["penyimpan_awal"] as? Map<String, Any>)?.let { pa ->
            val kunciUrut = if (jk == "perintah") s(konteks["perangkat_id"]) else "mac:" + s(m(amplop)["dari"])
            PenyimpanReplayMemori(
                urutAwal = mapOf(kunciUrut to pa["urut_terakhir"] as Long),
                idAwal = l(pa["id_terlihat"]).associate { s(it) to sekarang + 3_600_000L },
            )
        } ?: PenyimpanReplayMemori()
        return AmplopV1.Opsi(
            jenisKotak = jk,
            kunciTandaDikenal = kunciTandaDari(m(dikenal[if (mac) "mac" else "hp"])),
            kunciSandiSaya = sandi,
            macId = s(konteks["mac_id"]),
            perangkatId = if (mac) null else s(konteks["perangkat_id"]),
            sekarang = sekarang,
            penyimpan = penyimpan,
        )
    }
}
