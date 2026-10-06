package pro.padeveloper.studio.kantor

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Color
import android.net.Uri
import android.view.View
import android.webkit.CookieManager
import android.webkit.RenderProcessGoneDetail
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import io.flutter.FlutterInjector
import io.flutter.plugin.common.BinaryMessenger
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel
import io.flutter.plugin.common.StandardMessageCodec
import io.flutter.plugin.platform.PlatformView
import io.flutter.plugin.platform.PlatformViewFactory
import org.json.JSONObject
import pro.padeveloper.studio.BuildConfig
import java.io.ByteArrayInputStream

/**
 * Kantor 3D di tab Kantor (F2): WebView TERKUNCI yang hanya memuat aset kantor dari APK sendiri (assets/kantor/, dibuat
 * buat-kantor-apk.js di repo kantor). Pagar:
 *  - semua request lewat [shouldInterceptRequest]: hanya GET https://[HOST]/<berkas di daftar tetap> dilayani dari aset; lainnya 403
 *    (tanpa jaringan sama sekali — tidak ada request yang diteruskan ke luar), navigasi selain halaman awal ditolak;
 *  - TANPA addJavascriptInterface (halaman tidak bisa memanggil native/kunci); data hanya mengalir native → halaman lewat
 *    evaluateJavascript dengan string JSON yang di-quote (bukan disisipkan mentah);
 *  - tanpa akses file/content, DOM storage, cookie, geolokasi, jendela baru, cache; CSP ketat di header & meta halaman;
 *  - debugging WebView hanya build debug (PENGEMBANGAN); FLAG_SECURE jendela berlaku juga untuk tampilan ini.
 */
class PabrikKantor3d(private val messenger: BinaryMessenger) : PlatformViewFactory(StandardMessageCodec.INSTANCE) {
    override fun create(context: Context, viewId: Int, args: Any?): PlatformView {
        val gelap = (args as? Map<*, *>)?.get("tema") == "gelap"
        return Kantor3dView(context, viewId, messenger, gelap)
    }

    companion object {
        const val JENIS = "pro.padeveloper.studio/kantor3d"
    }
}

@SuppressLint("SetJavaScriptEnabled")
class Kantor3dView(context: Context, viewId: Int, messenger: BinaryMessenger, gelap: Boolean) : PlatformView, MethodChannel.MethodCallHandler {
    private val kanal = MethodChannel(messenger, "${PabrikKantor3d.JENIS}_$viewId")
    private val web = WebView(context)
    private var siap = false
    private var dataTertunda: String? = null
    private var dijeda = false
    private var mati = false

    init {
        WebView.setWebContentsDebuggingEnabled(BuildConfig.PENGEMBANGAN)
        with(web.settings) {
            javaScriptEnabled = true
            domStorageEnabled = false
            allowFileAccess = false
            allowContentAccess = false
            javaScriptCanOpenWindowsAutomatically = false
            setSupportMultipleWindows(false)
            setGeolocationEnabled(false)
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            cacheMode = WebSettings.LOAD_NO_CACHE
            mediaPlaybackRequiresUserGesture = true
            safeBrowsingEnabled = false   // halaman lokal saja; Safe Browsing butuh jaringan
            setSupportZoom(false)
            builtInZoomControls = false
            displayZoomControls = false
        }
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, false)
        web.isLongClickable = false
        web.setOnLongClickListener { true }   // tanpa menu salin/pilih teks
        web.isHapticFeedbackEnabled = false
        web.importantForAutofill = View.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS
        web.setBackgroundColor(if (gelap) Color.rgb(0x12, 0x16, 0x1d) else Color.rgb(0xe6, 0xeb, 0xf0))
        web.setDownloadListener(null)
        web.webViewClient = Klien()
        kanal.setMethodCallHandler(this)
        web.loadUrl(ASAL)
    }

    override fun getView(): View = web

    override fun onMethodCall(call: MethodCall, result: MethodChannel.Result) {
        if (mati) { result.success(null); return }   // proses render sudah mati: WebView tidak boleh disentuh lagi
        when (call.method) {
            "terima" -> {
                val json = call.arguments as? String
                if (json == null || json.length > MAKS_DATA) { result.error("argumen_tidak_sah", null, null); return }
                dataTertunda = json
                if (siap) kirim()
                result.success(null)
            }
            "jeda" -> {
                val ya = call.arguments == true
                if (ya != dijeda) {
                    dijeda = ya
                    if (ya) web.onPause() else web.onResume()
                    if (siap) web.evaluateJavascript("window.kantorHp&&window.kantorHp.jeda($ya)", null)
                }
                result.success(null)
            }
            else -> result.notImplemented()
        }
    }

    private fun kirim() {
        val json = dataTertunda ?: return
        if (mati) return
        // JSONObject.quote → literal string JS yang aman (kutip, garis miring balik, karakter kontrol, "</" di-escape)
        web.evaluateJavascript("window.kantorHp&&window.kantorHp.terima(${JSONObject.quote(json)})", null)
    }

    override fun dispose() {
        mati = true
        kanal.setMethodCallHandler(null)
        web.stopLoading()
        web.webViewClient = WebViewClient()
        web.destroy()
    }

    private inner class Klien : WebViewClient() {
        override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse =
            AsetKantor.layani(view.context, request.url, request.method)

        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean = request.url.toString() != ASAL

        override fun onPageFinished(view: WebView, url: String) {
            if (url != ASAL || mati) return
            siap = true
            if (dijeda) web.evaluateJavascript("window.kantorHp&&window.kantorHp.jeda(true)", null)
            kirim()
        }

        // Proses render WebView mati (mis. kehabisan memori grafis): jangan ikut menjatuhkan aplikasi; WebView ini tidak dipakai
        // lagi (dihancurkan di dispose) dan Flutter membuat tampilan baru saat owner memuat ulang.
        override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
            mati = true
            siap = false
            kanal.invokeMethod("hilang", null)   // Flutter mengganti tampilan dengan pesan + tombol muat ulang
            return true
        }
    }

    companion object {
        const val HOST = "kantor.padev-apk.invalid"
        const val ASAL = "https://$HOST/"
        private const val MAKS_DATA = 64 * 1024
    }
}

/** Penyaji aset kantor: daftar TETAP (bukan path bebas) → tidak ada traversal; selain itu 403 tanpa isi. */
internal object AsetKantor {
    private const val CSP = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; font-src 'self'; " +
        "connect-src 'none'; media-src 'none'; object-src 'none'; frame-src 'none'; worker-src 'none'; base-uri 'none'; form-action 'none'"
    private val BERKAS = mapOf(
        "/" to Pair("assets/kantor/index.html", "text/html"),
        "/kantor-hp.css" to Pair("assets/kantor/kantor-hp.css", "text/css"),
        "/kantor-hp.js" to Pair("assets/kantor/kantor-hp.js", "text/javascript"),
        "/three-kantor.js" to Pair("assets/kantor/three-kantor.js", "text/javascript"),
        "/orang3d.js" to Pair("assets/kantor/orang3d.js", "text/javascript"),
        "/kantor3d.js" to Pair("assets/kantor/kantor3d.js", "text/javascript"),
        "/peta.js" to Pair("assets/kantor/peta.js", "text/javascript"),
        "/font/PlusJakartaSans-SemiBold.ttf" to Pair("assets/fonts/PlusJakartaSans-SemiBold.ttf", "font/ttf"),
        "/font/PlusJakartaSans-ExtraBold.ttf" to Pair("assets/fonts/PlusJakartaSans-ExtraBold.ttf", "font/ttf"),
    )

    fun layani(context: Context, url: Uri, metode: String?): WebResourceResponse {
        val b = if (metode == "GET" && url.scheme == "https" && url.host == Kantor3dView.HOST && url.port == -1 &&
            url.userInfo == null && url.query == null) BERKAS[url.path ?: ""] else null
        if (b == null) return tolak()
        return try {
            val kunci = FlutterInjector.instance().flutterLoader().getLookupKeyForAsset(b.first)
            val isi = context.assets.open(kunci)
            val kepala = mapOf("Content-Security-Policy" to CSP, "X-Content-Type-Options" to "nosniff", "Cache-Control" to "no-store",
                "Referrer-Policy" to "no-referrer")
            WebResourceResponse(b.second, if (b.second.startsWith("font/")) null else "utf-8", 200, "OK", kepala, isi)
        } catch (e: Exception) {
            tolak()
        }
    }

    private fun tolak() = WebResourceResponse("text/plain", "utf-8", 403, "Forbidden", emptyMap(), ByteArrayInputStream(ByteArray(0)))
}
