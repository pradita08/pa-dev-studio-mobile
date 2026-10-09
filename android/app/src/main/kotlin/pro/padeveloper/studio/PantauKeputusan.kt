package pro.padeveloper.studio

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import pro.padeveloper.studio.kunci.Inti

/**
 * Pemantau latar keputusan (F1b): saat owner menyalakannya di Pengaturan, layanan foreground ini mengintip kabar relay tiap
 * [JEDA_MS] (Inti.intipKeputusanBaru: tanpa akui, amplop diverifikasi S_mac + didekripsi E_hp seperti jalur FCM) dan memunculkan
 * notifikasi "Claude butuh keputusan" untuk permintaan baru. Notifikasi tanpa aksi & tanpa isi perintah (SEC-56): ketuk =
 * membuka aplikasi, jawaban tetap lewat kartu + sidik jari. Pengganti FCM selama Mac belum mengirim push.
 */
class PantauKeputusan : Service() {
    private var utas: HandlerThread? = null
    private var h: Handler? = null

    private val putaran = object : Runnable {
        override fun run() {
            val inti = Inti.dari(this@PantauKeputusan)
            if (!inti.pantauNyala || inti.pasangan()?.status != "aktif") { stopSelf(); return }
            runCatching { inti.intipKeputusanBaru() }.getOrNull()?.forEach { b ->
                val proyek = (b["proyek"] as? String ?: "").take(40)
                val apa = when (b["jenis"]) {
                    "tanya" -> "Claude bertanya"
                    "rencana" -> "Rencana siap disetujui"
                    else -> "Claude minta izin ${(b["alat"] as? String ?: "").take(30)}"
                }
                tampilkanKeputusan(this@PantauKeputusan, if (proyek.isEmpty()) apa else "$proyek · $apa")
            }
            h?.postDelayed(this, JEDA_MS)
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val nm = getSystemService(NotificationManager::class.java)
        nm?.createNotificationChannel(NotificationChannel(KANAL_PANTAU, "Pemantau keputusan", NotificationManager.IMPORTANCE_MIN))
        val notif = NotificationCompat.Builder(this, KANAL_PANTAU)
            .setSmallIcon(R.drawable.ic_notif)
            .setContentTitle("PADEV Studio")
            .setContentText("Memantau permintaan dari Mac")
            .setOngoing(true)
            .setContentIntent(bukaAplikasi(this))
            .build()
        ServiceCompat.startForeground(
            this, ID_PANTAU, notif,
            if (Build.VERSION.SDK_INT >= 34) ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE else 0,
        )
        if (utas == null) {
            utas = HandlerThread("pantau-keputusan").also { it.start() }
            h = Handler(utas!!.looper).also { it.post(putaran) }
        }
        return START_STICKY
    }

    override fun onDestroy() {
        h?.removeCallbacksAndMessages(null)
        utas?.quitSafely()
        utas = null
        h = null
        super.onDestroy()
    }

    companion object {
        private const val JEDA_MS = 30_000L
        private const val KANAL_PANTAU = "pantau"
        private const val KANAL_KEPUTUSAN = "keputusan"
        private const val ID_PANTAU = 7001

        fun mulai(context: Context) {
            val i = Intent(context, PantauKeputusan::class.java)
            runCatching { context.startForegroundService(i) }
        }

        fun hentikan(context: Context) {
            runCatching { context.stopService(Intent(context, PantauKeputusan::class.java)) }
        }

        private fun bukaAplikasi(context: Context): PendingIntent = PendingIntent.getActivity(
            context, 0, Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )

        fun tampilkanKeputusan(context: Context, teks: String) {
            val nm = context.getSystemService(NotificationManager::class.java) ?: return
            nm.createNotificationChannel(NotificationChannel(KANAL_KEPUTUSAN, "Keputusan untuk Claude", NotificationManager.IMPORTANCE_HIGH))
            val publik = NotificationCompat.Builder(context, KANAL_KEPUTUSAN).setSmallIcon(R.drawable.ic_notif)
                .setContentTitle("PADEV Studio").setContentText("Claude butuh keputusan").build()
            val notif = NotificationCompat.Builder(context, KANAL_KEPUTUSAN)
                .setSmallIcon(R.drawable.ic_notif)
                .setContentTitle("Claude butuh keputusan")
                .setContentText(teks)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_REMINDER)
                .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
                .setPublicVersion(publik)
                .setAutoCancel(true)
                .setContentIntent(bukaAplikasi(context))
                .build()
            runCatching { nm.notify((System.currentTimeMillis() and 0x7fffffff).toInt(), notif) }
        }
    }
}
