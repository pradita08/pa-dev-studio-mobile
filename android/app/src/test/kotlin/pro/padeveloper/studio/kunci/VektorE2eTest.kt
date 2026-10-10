package pro.padeveloper.studio.kunci

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Test
import pro.padeveloper.studio.kunci.UjiBantu.l
import pro.padeveloper.studio.kunci.UjiBantu.m
import pro.padeveloper.studio.kunci.UjiBantu.s
import java.io.File

/** Uji silang terhadap apk/kontrak/vektor-e2e.json (Rizky). Dilewati dengan pesan bila vektor belum ada. */
class VektorE2eTest {
    private lateinit var v: Map<String, Any>
    private lateinit var ku: UjiBantu.KunciUji

    @Before
    fun muat() {
        assumeTrue("vektor belum ada (apk/kontrak/vektor-e2e.json) — uji silang final di gelombang B", UjiBantu.ada("vektor-e2e.json"))
        v = UjiBantu.baca("vektor-e2e.json")
        ku = UjiBantu.KunciUji(v)
    }

    @Test
    fun idKunciUji() {
        for (n in listOf("k_rencana", "k_kerjakan", "s_mac", "k_asing")) assertEquals(n, ku.id(n), Kripto.idKunciEcdsa(ku.spki(n)))
        for (n in listOf("e_hp", "e_mac", "e_asing")) {
            assertArrayEquals(n, ku.publikX(n), Hpke.publikDariPrivat(ku.privatX(n)))
            assertEquals(n, ku.id(n), Kripto.idKunciX25519(ku.publikX(n)))
        }
    }

    @Test
    fun amplopSahDibukaDanNilaiAntaraSama() {
        val sah = m(v["sah"])
        val semua = l(sah["perintah"]) + l(sah["kabar"]) + listOf(m(m(v["pasang"])["sah"]))
        for (x in semua) {
            val c = m(x)
            val a = m(c["amplop"])
            val antara = m(c["antara"])
            val label = s(c["label"])
            val h = AmplopV1.hHeader(a)
            assertEquals(label, s(antara["H"]), String(h, Charsets.UTF_8))
            assertEquals(label, s(antara["info"]), String(AmplopV1.info(s(a["dari"]), s(a["ke"])), Charsets.UTF_8))
            val enc = B64u.dek(s(a["enc"]))!!
            val ct = B64u.dek(s(a["ct"]))!!
            val masukTanda = AmplopV1.inputTanda(h, enc, ct)
            assertArrayEquals(label, B64u.dek(s(antara["input_tanda"])), masukTanda)
            val penandaSpki = when (s(a["dari"])) { ku.id("s_mac") -> ku.spki("s_mac"); ku.id("k_kerjakan") -> ku.spki("k_kerjakan"); else -> ku.spki("k_rencana") }
            assertTrue(label, Kripto.verifikasiEcdsa(Kripto.publikP256(penandaSpki), masukTanda, B64u.dek(s(a["tanda"]))!!))
            val sk = if (s(a["jenis_kotak"]) == "kabar") ku.privatX("e_hp") else ku.privatX("e_mac")
            val pt = Hpke.buka(sk, enc, AmplopV1.info(s(a["dari"]), s(a["ke"])), h, ct)
            assertEquals(label, s(antara["plaintext"]), String(pt, Charsets.UTF_8))
        }
    }

    @Test
    fun pemeriksaSahSesuaiHasil() {
        val sah = m(v["sah"])
        for (x in l(sah["perintah"]) + l(sah["kabar"])) {
            val c = m(x)
            val hasil = m(c["hasil"])
            val h = AmplopV1.periksa(c["amplop"], UjiBantu.opsiDariVektor(v, m(c["periksa"]), c["amplop"]))
            assertTrue("${c["label"]}: ${h.alasan}", h.ok)
            assertEquals(hasil["peran"], h.peran)
            assertEquals(hasil["jenis"], h.isi!!["jenis"])
            hasil["hash"]?.let { assertEquals(it, h.hash) }
        }
    }

    @Test
    fun amplopRusakDitolakDenganAlasanSama() {
        val rusak = l(v["rusak"])
        assertTrue(rusak.size >= 6)
        for (x in rusak) {
            val c = m(x)
            val h = AmplopV1.periksa(c["amplop"], UjiBantu.opsiDariVektor(v, m(c["periksa"]), c["amplop"]))
            assertFalse("${c["label"]} harus ditolak", h.ok)
            assertEquals("${c["label"]}", c["alasan"], h.alasan)
        }
    }

    @Test
    fun pasangHmacSasTantangan() {
        val p = m(v["pasang"])
        val qr = Pasang.uraiQr(Jcs.teks(p["qr"]), m(p["qr"])["kedaluwarsa"] as Long - 60_000, s(m(v["konteks"])["relay"]))
        val isi = m(p["isi"])
        val tanpaHmac = LinkedHashMap(isi).apply { remove("hmac") }
        assertEquals(s(p["hmac_input_jcs"]), Jcs.teks(tanpaHmac))
        assertEquals(s(isi["hmac"]), Pasang.hmac(qr.rahasia, tanpaHmac))
        assertEquals(s(p["tantangan_atestasi_heks"]), Heks.enk(Pasang.tantanganAtestasi(qr.rahasia, qr.macId)))
        // kontrak v1.1: POST hp/daftar {kode_daftar, mac_id} — mac_id dari QR
        assertEquals(
            Jcs.teks(mapOf("kode_daftar" to s(m(p["qr"])["kode_daftar"]), "mac_id" to s(m(p["qr"])["mac_id"]))),
            Jcs.teks(Pasang.badanDaftar(qr)),
        )
        assertEquals(listOf("kode_daftar", "mac_id"), Pasang.badanDaftar(qr).keys.toList())
        val sas = Pasang.kodeSas(
            qr.sMacSpki, qr.eMacRaw, B64u.dek(s(isi["k_rencana"]))!!, B64u.dek(s(isi["k_kerjakan"]))!!, B64u.dek(s(isi["e_hp"]))!!,
            qr.macId, s(isi["perangkat_id"]),
        )
        assertEquals(s(p["sas"]), sas)
        // susunan isi oleh Kotlin identik dengan vektor
        val susun = Pasang.isi(
            qr, s(isi["perangkat_id"]), isi["dibuat"] as Long, isi["kedaluwarsa"] as Long, s(isi["nama"]),
            B64u.dek(s(isi["k_rencana"]))!!, B64u.dek(s(isi["k_kerjakan"]))!!, B64u.dek(s(isi["e_hp"]))!!,
            emptyList(), emptyList(), s(isi["fcm"]),
        )
        assertEquals(Jcs.teks(isi), Jcs.teks(susun))
    }

    @Test
    fun qrBurukDitolak() {
        val qr = LinkedHashMap(m(m(v["pasang"])["qr"]))
        val kd = qr["kedaluwarsa"] as Long
        val relay = s(m(v["konteks"])["relay"])
        fun kode(o: Map<String, Any>, sekarang: Long = kd - 60_000, izin: String? = relay) =
            runCatching { Pasang.uraiQr(Jcs.teks(o), sekarang, izin) }.exceptionOrNull()?.let { (it as GalatKunci).kode }
        assertEquals(null, kode(qr))
        assertEquals("qr_kedaluwarsa", kode(qr, sekarang = kd + 1))
        assertEquals("qr_tidak_sah", kode(qr, izin = "https://relay-lain.contoh/api/v1/"))
        assertEquals("qr_tidak_sah", kode(LinkedHashMap(qr).apply { put("relay", "http://padev-studio.pa-developer.pro/api/v1/") }, izin = null))
        assertEquals("qr_tidak_sah", kode(LinkedHashMap(qr).apply { put("tambahan", "x") }))
        assertEquals("qr_tidak_sah", kode(LinkedHashMap(qr).apply { put("s_mac", s(qr["e_mac"])) }))
        assertEquals("qr_tidak_sah", kode(LinkedHashMap(qr).apply { put("v", 2L) }))
    }

    /**
     * Amplop buatan Kotlin (kunci uji, jam nyata) → diperiksa pemeriksa Kotlin sisi Mac, lalu ditulis ke
     * apk/build/uji-kotlin/amplop-kotlin.json untuk: node apk/kontrak/uji-kripto.js --periksa <berkas>.
     */
    @Test
    fun amplopBuatanKotlin() {
        val konteks = m(v["konteks"])
        val macId = s(konteks["mac_id"]); val perangkatId = s(konteks["perangkat_id"])
        val sekarang = System.currentTimeMillis()
        val hasil = ArrayList<Map<String, Any>>()
        val penyimpan = PenyimpanReplayMemori()
        var urut = 0L
        val kasus = listOf(
            Triple("jalankan", "k_rencana", mapOf<String, Any>("tugas" to "t1", "proyek" to "p1", "akun" to "akun-uji", "mode" to "rencana", "pesan" to "Rencanakan perbaikan ✓", "baru" to true)),
            Triple("jalankan", "k_kerjakan", mapOf<String, Any>("tugas" to "t2", "proyek" to "p1", "akun" to "akun-uji", "mode" to "kerjakan", "pesan" to "Kerjakan", "baru" to false, "model" to "opus")),
            Triple("jalankan", "k_rencana", mapOf<String, Any>("tugas" to "t3", "proyek" to "p1", "akun" to "akun-uji", "mode" to "rencana", "pesan" to "Akun otomatis", "baru" to false, "otomatis" to true)),
            Triple("hentikan", "k_rencana", mapOf<String, Any>("tugas" to "t1")),
            Triple("minta_status", "k_rencana", emptyMap()),
        )
        for ((jenis, kunci, tambahan) in kasus) {
            val id = Kripto.acakHeks(16)
            val kd = Perintah.kedaluwarsa(jenis, tambahan["mode"] as? String, sekarang)
            val isi = Perintah.isi(jenis, macId, perangkatId, id, ++urut, sekarang, kd, tambahan)
            val d = AmplopV1.siapkan("perintah", ku.id(kunci), ku.publikX("e_mac"), isi, kd, id)
            val a = d.selesaikan(ku.penanda(kunci).tanda(d.inputTanda))
            val opsi = AmplopV1.Opsi(
                "perintah", UjiBantu.kunciTandaDari(m(m(v["kunci_tanda_dikenal"])["mac"])), listOf(ku.privatX("e_mac")), macId,
                sekarang = sekarang, penyimpan = penyimpan,
            )
            val h = AmplopV1.periksa(JsonKetat.parse(Jcs.teks(a)), opsi)
            assertTrue("$jenis/$kunci: ${h.alasan}", h.ok)
            hasil += a
        }
        // kerjakan bertanda K_rencana harus ditolak oleh pemeriksa sendiri
        run {
            val id = Kripto.acakHeks(16)
            val kd = Perintah.kedaluwarsa("jalankan", "kerjakan", sekarang)
            val isi = Perintah.isi("jalankan", macId, perangkatId, id, ++urut, sekarang, kd, kasus[1].third)
            val a = AmplopV1.buat("perintah", ku.id("k_rencana"), ku.publikX("e_mac"), isi, kd, ku.penanda("k_rencana"))
            val opsi = AmplopV1.Opsi("perintah", UjiBantu.kunciTandaDari(m(m(v["kunci_tanda_dikenal"])["mac"])), listOf(ku.privatX("e_mac")), macId, sekarang = sekarang)
            assertEquals(Alasan.KERJAKAN_TANPA_K_KERJAKAN, AmplopV1.periksa(a, opsi).alasan)
        }
        // pasang (kunci Mac dari QR vektor, rahasia QR)
        run {
            val p = m(v["pasang"])
            val qrObj = LinkedHashMap(m(p["qr"])).apply { put("kedaluwarsa", sekarang + 300_000) }
            val qr = Pasang.uraiQr(Jcs.teks(qrObj), sekarang, s(konteks["relay"]))
            val kd = sekarang + 300_000
            val isi = Pasang.isi(
                qr, perangkatId, sekarang, kd, "HP Uji Kotlin", ku.spki("k_rencana"), ku.spki("k_kerjakan"), ku.publikX("e_hp"),
                emptyList(), emptyList(), "token-fcm-uji",
            )
            hasil += AmplopV1.buat("pasang", ku.id("k_rencana"), qr.eMacRaw, isi, kd, ku.penanda("k_rencana"))
        }
        // kabar dari "Mac" (kunci uji S_mac) → pemeriksa HP: sah, lalu ulangan ditolak (urut_mac lama / replay)
        run {
            val isi = linkedMapOf<String, Any>("mac_id" to macId, "perangkat_id" to perangkatId, "urut_mac" to 10L, "dibuat" to sekarang, "jenis" to "notif",
                "notif" to mapOf("j" to "selesai", "proyek" to "SIMPEG"))
            val a = AmplopV1.buat("kabar", ku.id("s_mac"), ku.publikX("e_hp"), isi, sekarang + 60_000, ku.penanda("s_mac"))
            val pHp = PenyimpanReplayMemori()
            val opsi = AmplopV1.Opsi("kabar", UjiBantu.kunciTandaDari(m(m(v["kunci_tanda_dikenal"])["hp"])), listOf(ku.privatX("e_hp")), macId,
                perangkatId = perangkatId, sekarang = sekarang, penyimpan = pHp)
            assertTrue(AmplopV1.periksa(a, opsi).ok)
            assertEquals(Alasan.REPLAY_ID, AmplopV1.periksa(a, opsi).alasan)
            val dipulihkan = PenyimpanReplayMemori.dariJson(pHp.keJson())
            assertEquals(10L, dipulihkan.urut["mac:" + ku.id("s_mac")])
        }
        val berkas = File(UjiBantu.folderKeluaran, "amplop-kotlin.json")
        berkas.parentFile!!.mkdirs()
        berkas.writeText(Jcs.teks(hasil), Charsets.UTF_8)
        println("amplop buatan Kotlin ditulis: ${berkas.path} (${hasil.size} amplop)")
    }
}
