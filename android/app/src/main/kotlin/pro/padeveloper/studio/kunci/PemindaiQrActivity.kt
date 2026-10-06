package pro.padeveloper.studio.kunci

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Size
import android.util.TypedValue
import android.view.Gravity
import android.view.HapticFeedbackConstants
import android.view.View
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.view.ViewGroup.LayoutParams.WRAP_CONTENT
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.ImageButton
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.Camera
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.core.resolutionselector.ResolutionSelector
import androidx.camera.core.resolutionselector.ResolutionStrategy
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import com.google.zxing.MultiFormatReader
import pro.padeveloper.studio.BuildConfig
import pro.padeveloper.studio.R
import java.util.concurrent.CompletableFuture
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.TimeoutException

/**
 * Sesi pindai QR (dipanggil plugin dari thread latar). Satu sesi pada satu waktu; hasil = teks QR mentah atau null
 * (dibatalkan, aplikasi ke latar, izin ditolak, atau batas waktu). Teks QR tidak pernah dicatat ke log.
 */
object PemindaiQr {
    /** Kamera menutup sendiri setelah ini (privasi; QR berlaku 5 mnt dan gerbang kunci aplikasi 2 mnt). */
    const val BATAS_MS = 90_000L

    private val kunci = Any()
    private var menunggu: CompletableFuture<String?>? = null

    internal val adaSesi: Boolean get() = synchronized(kunci) { menunggu != null }

    fun pindai(aktivitas: Activity): String? {
        if (!aktivitas.packageManager.hasSystemFeature(PackageManager.FEATURE_CAMERA_ANY)) throw GalatKunci("kamera_tidak_tersedia")
        val f = CompletableFuture<String?>()
        synchronized(kunci) {
            if (menunggu != null) throw GalatKunci("sedang_memindai")
            menunggu = f
        }
        Handler(Looper.getMainLooper()).post {
            try {
                aktivitas.startActivity(Intent(aktivitas, PemindaiQrActivity::class.java))
            } catch (e: Exception) {
                selesai(null)
            }
        }
        return try {
            f.get(BATAS_MS + 60_000L, TimeUnit.MILLISECONDS)
        } catch (e: TimeoutException) {
            null
        } finally {
            synchronized(kunci) { if (menunggu === f) menunggu = null }
        }
    }

    fun selesai(teks: String?) {
        synchronized(kunci) {
            menunggu?.complete(teks)
            menunggu = null
        }
    }
}

/**
 * L02 kamera (SEC-77, SEC-76): CameraX + ZXing core di proses ini, tanpa jaringan/ML Kit/Play Services.
 * Kamera dihentikan dan layar ditutup begitu aktivitas berhenti di depan (onPause/onStop) — tidak menyala lagi otomatis
 * saat aplikasi kembali; pengguna harus menekan "Pindai kode QR" lagi dari L02.
 */
class PemindaiQrActivity : ComponentActivity() {
    private val utama = Handler(Looper.getMainLooper())
    private val analisis: ExecutorService = Executors.newSingleThreadExecutor()
    private var penyedia: ProcessCameraProvider? = null
    private var kamera: Camera? = null
    private var memintaIzin = false
    private var selesai = false
    private var senter = false

    @Volatile private var hasilAda = false
    private var penyangga = ByteArray(0) // hanya dipakai thread analisis

    private lateinit var pratinjau: PreviewView
    private lateinit var bidik: View
    private lateinit var tombolSenter: ImageButton
    private lateinit var panelPesan: LinearLayout
    private lateinit var judulPesan: TextView
    private lateinit var isiPesan: TextView
    private lateinit var tombolCoba: TextView

    private val batasWaktu = Runnable { tutup(null) }

    private val mintaIzinKamera = registerForActivityResult(ActivityResultContracts.RequestPermission()) { boleh ->
        memintaIzin = false
        if (selesai) return@registerForActivityResult
        if (boleh) mulaiKamera() else tampilPesan(
            "Izin kamera ditolak",
            "Kamera hanya dipakai untuk memindai QR pemasangan. Izinkan di Setelan Android › Aplikasi › PADEV Studio › Izin › Kamera, lalu coba lagi.",
        )
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        // QR memuat rahasia pemasangan: tanpa tangkapan layar/pratinjau di profile & rilis (sama dengan MainActivity, SEC-54/86).
        if (!BuildConfig.PENGEMBANGAN) window.setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE)
        super.onCreate(savedInstanceState)
        if (!PemindaiQr.adaSesi) { // dipulihkan sistem tanpa permintaan dari aplikasi → jangan nyalakan kamera
            selesai = true
            finish()
            return
        }
        WindowCompat.setDecorFitsSystemWindows(window, false)
        setContentView(bangunTampilan())
        utama.postDelayed(batasWaktu, PemindaiQr.BATAS_MS)
        if (izinAda()) mulaiKamera() else mintaIzin()
    }

    override fun onPause() {
        super.onPause()
        if (!memintaIzin) tutup(null) // SEC-76: ke latar/tertutup → kamera mati, layar ditutup
    }

    override fun onStop() {
        super.onStop()
        // Dialog izin (di beberapa ROM) bisa menghentikan aktivitas; kamera belum menyala selama itu, dan batas waktu
        // BATAS_MS tetap menutup layar ini.
        if (!memintaIzin) tutup(null)
    }

    override fun onDestroy() {
        utama.removeCallbacks(batasWaktu)
        hentikanKamera()
        analisis.shutdownNow()
        if (!selesai) {
            selesai = true
            PemindaiQr.selesai(null)
        }
        super.onDestroy()
    }

    private fun tutup(teks: String?) {
        if (selesai) return
        selesai = true
        utama.removeCallbacks(batasWaktu)
        hentikanKamera()
        PemindaiQr.selesai(teks)
        finish()
    }

    private fun izinAda() = ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED

    private fun mintaIzin() {
        memintaIzin = true
        mintaIzinKamera.launch(Manifest.permission.CAMERA)
    }

    private fun hentikanKamera() {
        try {
            if (senter) kamera?.cameraControl?.enableTorch(false)
        } catch (e: Exception) {
            // abaikan
        }
        senter = false
        kamera = null
        try {
            penyedia?.unbindAll()
        } catch (e: Exception) {
            // abaikan
        }
    }

    private fun mulaiKamera() {
        panelPesan.visibility = View.GONE
        pratinjau.visibility = View.VISIBLE
        bidik.visibility = View.VISIBLE
        val masa = ProcessCameraProvider.getInstance(this)
        masa.addListener({
            if (selesai || isFinishing) return@addListener
            val p = try {
                masa.get()
            } catch (e: Exception) {
                tampilPesan("Kamera tidak bisa dibuka", "Tutup aplikasi lain yang memakai kamera, lalu coba lagi.")
                return@addListener
            }
            penyedia = p
            val tampil = Preview.Builder().build().also { it.setSurfaceProvider(pratinjau.surfaceProvider) }
            val resolusi = ResolutionSelector.Builder()
                .setResolutionStrategy(ResolutionStrategy(Size(1920, 1080), ResolutionStrategy.FALLBACK_RULE_CLOSEST_LOWER_THEN_HIGHER))
                .build()
            val analisa = ImageAnalysis.Builder()
                .setResolutionSelector(resolusi)
                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                .build()
            val pembaca = DekoderQr.pembaca()
            analisa.setAnalyzer(analisis) { g -> periksa(g, pembaca) }
            try {
                p.unbindAll()
                kamera = p.bindToLifecycle(this, CameraSelector.DEFAULT_BACK_CAMERA, tampil, analisa)
                tombolSenter.visibility = if (kamera?.cameraInfo?.hasFlashUnit() == true) View.VISIBLE else View.GONE
            } catch (e: Exception) {
                tampilPesan("Kamera tidak bisa dibuka", "Tutup aplikasi lain yang memakai kamera, lalu coba lagi.")
            }
        }, ContextCompat.getMainExecutor(this))
    }

    /** Thread analisis: bingkai Y → ZXing. Hanya teks berbentuk objek JSON yang diteruskan (QR lain diabaikan, kamera lanjut). */
    private fun periksa(g: ImageProxy, pembaca: MultiFormatReader) {
        try {
            if (hasilAda) return
            val bidang = g.planes[0]
            val buf = bidang.buffer
            val n = buf.remaining()
            if (penyangga.size < n) penyangga = ByteArray(n)
            buf.get(penyangga, 0, n)
            val teks = DekoderQr.dekode(pembaca, penyangga, g.width, g.height, bidang.rowStride) ?: return
            if (teks.length > 4096 || !teks.trimStart().startsWith("{")) return
            hasilAda = true
            utama.post {
                if (!selesai) {
                    window.decorView.performHapticFeedback(HapticFeedbackConstants.CONFIRM)
                    tutup(teks)
                }
            }
        } catch (e: Exception) {
            // bingkai rusak/ukuran tak terduga: lewati bingkai ini
        } finally {
            g.close()
        }
    }

    private fun tampilPesan(judul: String, isi: String) {
        hentikanKamera()
        pratinjau.visibility = View.GONE
        bidik.visibility = View.GONE
        tombolSenter.visibility = View.GONE
        judulPesan.text = judul
        isiPesan.text = isi
        panelPesan.visibility = View.VISIBLE
    }

    // ------------------------------------------------------------------ tampilan (token DESAIN-apk, sama dengan kamera L02 lama)

    private fun dp(v: Int): Int = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v.toFloat(), resources.displayMetrics).toInt()

    private fun huruf(berat: String): Typeface? =
        runCatching { Typeface.createFromAsset(assets, "flutter_assets/assets/fonts/PlusJakartaSans-$berat.ttf") }.getOrNull()

    private fun teks(isi: String, sp: Float, warna: Int, berat: String): TextView = TextView(this).apply {
        text = isi
        setTextColor(warna)
        setTextSize(TypedValue.COMPLEX_UNIT_SP, sp)
        huruf(berat)?.let { typeface = it }
        gravity = Gravity.CENTER
    }

    private fun tombolBulat(ikon: Int, label: String, aksi: () -> Unit): ImageButton = ImageButton(this).apply {
        setImageResource(ikon)
        contentDescription = label
        scaleType = ImageView.ScaleType.CENTER
        background = GradientDrawable().apply {
            shape = GradientDrawable.OVAL
            setColor(0x991D2433.toInt())
        }
        setPadding(dp(13), dp(13), dp(13), dp(13))
        setOnClickListener { aksi() }
        layoutParams = FrameLayout.LayoutParams(dp(48), dp(48))
    }

    private fun bangunTampilan(): View {
        val putih = Color.WHITE
        val akar = FrameLayout(this).apply { setBackgroundColor(0xFF0F131A.toInt()) }

        pratinjau = PreviewView(this).apply {
            implementationMode = PreviewView.ImplementationMode.COMPATIBLE
            scaleType = PreviewView.ScaleType.FILL_CENTER
        }
        akar.addView(pratinjau, FrameLayout.LayoutParams(MATCH_PARENT, MATCH_PARENT))

        bidik = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
            addView(View(this@PemindaiQrActivity).apply {
                background = GradientDrawable().apply {
                    setStroke(dp(3), putih)
                    cornerRadius = dp(20).toFloat()
                }
            }, LinearLayout.LayoutParams(dp(240), dp(240)))
            addView(teks("Arahkan ke kode QR di Terminal Mac", 14f, putih, "SemiBold"),
                LinearLayout.LayoutParams(WRAP_CONTENT, WRAP_CONTENT).apply { topMargin = dp(22) })
        }
        akar.addView(bidik, FrameLayout.LayoutParams(WRAP_CONTENT, WRAP_CONTENT, Gravity.CENTER))

        judulPesan = teks("", 18f, putih, "ExtraBold")
        isiPesan = teks("", 14f, 0xFFC9D0DC.toInt(), "Regular").apply { setLineSpacing(0f, 1.4f) }
        tombolCoba = teks("Coba lagi", 14f, putih, "SemiBold").apply {
            isClickable = true
            isFocusable = true
            background = GradientDrawable().apply {
                setStroke(dp(1), 0xFF5B6376.toInt())
                cornerRadius = dp(12).toFloat()
            }
            minHeight = dp(48)
            setPadding(dp(22), 0, dp(22), 0)
            setOnClickListener { if (izinAda()) mulaiKamera() else mintaIzin() }
        }
        panelPesan = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            visibility = View.GONE
            setPadding(dp(28), dp(28), dp(28), dp(28))
            addView(ImageView(this@PemindaiQrActivity).apply {
                setImageResource(R.drawable.ic_tanpa_kamera)
                importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
            }, LinearLayout.LayoutParams(dp(40), dp(40)))
            addView(judulPesan, LinearLayout.LayoutParams(WRAP_CONTENT, WRAP_CONTENT).apply { topMargin = dp(14) })
            addView(isiPesan, LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT).apply { topMargin = dp(8) })
            addView(tombolCoba, LinearLayout.LayoutParams(WRAP_CONTENT, WRAP_CONTENT).apply { topMargin = dp(18) })
        }
        akar.addView(panelPesan, FrameLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT, Gravity.CENTER))

        val bilah = FrameLayout(this)
        bilah.addView(tombolBulat(R.drawable.ic_tutup, "Tutup kamera") { tutup(null) })
        tombolSenter = tombolBulat(R.drawable.ic_senter, "Nyalakan senter") {
            val k = kamera ?: return@tombolBulat
            senter = !senter
            k.cameraControl.enableTorch(senter)
            tombolSenter.contentDescription = if (senter) "Matikan senter" else "Nyalakan senter"
            tombolSenter.alpha = if (senter) 1f else 0.85f
        }.apply {
            visibility = View.GONE
            alpha = 0.85f
            layoutParams = FrameLayout.LayoutParams(dp(48), dp(48), Gravity.END)
        }
        bilah.addView(tombolSenter)
        akar.addView(bilah, FrameLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT, Gravity.TOP))
        ViewCompat.setOnApplyWindowInsetsListener(bilah) { v, insets ->
            val i = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
            v.setPadding(dp(8) + i.left, dp(8) + i.top, dp(8) + i.right, 0)
            insets
        }
        return akar
    }
}
