package pro.padeveloper.studio.kunci

import org.junit.Assert.assertEquals
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test

/**
 * REV-49 (uji untuk perbaikan REV-40): `Pasang.batalkanBilaGagal` yang dipakai `Inti.mulaiPasang`.
 * Klien relay tiruan mencatat panggilan; urutan DELETE → bersihkan lokal penting karena token dibaca dari brankas.
 */
class BatalPasangTest {
    private val catatan = mutableListOf<String>()
    private var terdaftar = false

    private fun <T> jalankan(panggilRelay: (String, String) -> Unit = { m, j -> catatan += "$m $j" }, langkah: () -> T): T =
        Pasang.batalkanBilaGagal({ terdaftar }, panggilRelay, { catatan += "bersihkan" }, langkah)

    private fun harapGagal(blok: () -> Unit): Throwable {
        try {
            blok()
        } catch (e: Throwable) {
            return e
        }
        fail("seharusnya melempar galat")
        throw IllegalStateException()
    }

    @Test
    fun gagalSesudahDaftar_hapusDiRelayLaluBersihkan() {
        val asal = GalatKunci("jaringan") // mis. hp/kirim gagal
        val e = harapGagal {
            jalankan {
                catatan += "POST hp/daftar"
                terdaftar = true
                throw asal
            }
        }
        assertSame("galat asal dilempar ulang", asal, e)
        assertEquals(listOf("POST hp/daftar", "DELETE hp/perangkat", "bersihkan"), catatan)
    }

    @Test
    fun gagalSebelumDaftar_hanyaBersihkanLokal() {
        val e = harapGagal { jalankan<Unit> { throw GalatKunci("relay_jawaban_rusak") } }
        assertEquals("relay_jawaban_rusak", (e as GalatKunci).kode)
        assertEquals(listOf("bersihkan"), catatan)
    }

    @Test
    fun deleteGagal_diabaikan_galatAsalTetap() {
        val asal = GalatKunci("perlu_otentikasi") // mis. sidik jari dibatalkan
        val e = harapGagal {
            jalankan(panggilRelay = { m, j -> catatan += "$m $j"; throw GalatKunci("jaringan") }) {
                terdaftar = true
                throw asal
            }
        }
        assertSame(asal, e)
        assertEquals(listOf("DELETE hp/perangkat", "bersihkan"), catatan)
    }

    @Test
    fun berhasil_tanpaHapusDanTanpaBersihkan() {
        val hasil = jalankan {
            terdaftar = true
            mapOf("kodeSas" to "123456")
        }
        assertEquals("123456", hasil["kodeSas"])
        assertTrue(catatan.isEmpty())
    }
}
