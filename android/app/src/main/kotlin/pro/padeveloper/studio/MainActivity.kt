package pro.padeveloper.studio

import android.os.Bundle
import android.view.WindowManager
import io.flutter.embedding.android.FlutterFragmentActivity
import io.flutter.embedding.engine.FlutterEngine
import pro.padeveloper.studio.kunci.PluginKunci

/** FlutterFragmentActivity: dibutuhkan androidx.biometric (BiometricPrompt). */
class MainActivity : FlutterFragmentActivity() {
    private var plugin: PluginKunci? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        // FLAG_SECURE di profile & rilis: tanpa tangkapan layar/rekaman & pratinjau di daftar aplikasi terbaru (SEC-54, SEC-86).
        // Hanya build debug (PENGEMBANGAN) membiarkannya mati agar QA/UI bisa mengambil tangkapan layar.
        if (!BuildConfig.PENGEMBANGAN) window.setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE)
        super.onCreate(savedInstanceState)
    }

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        plugin = PluginKunci(flutterEngine.dartExecutor.binaryMessenger, this)
    }

    override fun cleanUpFlutterEngine(flutterEngine: FlutterEngine) {
        plugin?.lepas()
        plugin = null
        super.cleanUpFlutterEngine(flutterEngine)
    }
}
