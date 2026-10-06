package pro.padeveloper.studio

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import pro.padeveloper.studio.kunci.Inti

/**
 * FCM data-only (kontrak §0.4, §2 `notif`): `data.a` = amplop kabar ≤ 3 KB → diperiksa (tanda S_mac, dekripsi E_hp,
 * urut_mac) → notifikasi lokal tanpa isi jawaban Claude. Amplop tidak sah dibuang diam-diam.
 * Tanpa google-services.json FirebaseApp tidak terinisialisasi sehingga layanan ini tidak pernah dipanggil (FCM nonaktif).
 */
class LayananFcm : FirebaseMessagingService() {
    override fun onNewToken(token: String) {
        Inti.dari(this).simpanTokenFcm(token) // dikirim ke Mac lewat perintah perbarui_fcm (gelombang B)
    }

    override fun onMessageReceived(pesan: RemoteMessage) {
        val a = pesan.data["a"]?.takeIf { it.length <= 3 * 1024 } ?: return
        val isi = runCatching { Inti.dari(this).periksaKabar(a, catat = false) }.getOrNull() ?: return
        if (isi["jenis"] != "notif") return
        @Suppress("UNCHECKED_CAST")
        val n = isi["notif"] as? Map<String, Any> ?: return
        tampilkan(this, teksNotif(n))
    }

    companion object {
        private const val KANAL = "kabar"

        fun teksNotif(n: Map<String, Any>): String {
            val proyek = (n["proyek"] as? String)?.take(40)
            val apa = when (n["j"]) {
                "selesai" -> "Selesai"
                "divisi" -> "Divisi selesai"
                "izin" -> "Menunggu izin di laptop"
                "mac_terputus" -> return "Mac terputus"
                else -> "Ada kabar baru"
            }
            return if (proyek.isNullOrBlank()) apa else "$proyek · $apa"
        }

        fun tampilkan(context: Context, teks: String) {
            val nm = context.getSystemService(NotificationManager::class.java) ?: return
            nm.createNotificationChannel(NotificationChannel(KANAL, "Kabar pekerjaan", NotificationManager.IMPORTANCE_HIGH))
            // Ketuk = hanya membuka APK (yang lalu meminta buka kunci); tanpa aksi & tanpa data perintah (SEC-56).
            val buka = PendingIntent.getActivity(
                context, 0, Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP),
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
            )
            val publik = NotificationCompat.Builder(context, KANAL).setSmallIcon(R.drawable.ic_notif)
                .setContentTitle("PADEV Studio").setContentText("Ada kabar baru").build()
            val notif = NotificationCompat.Builder(context, KANAL)
                .setSmallIcon(R.drawable.ic_notif)
                .setContentTitle("PADEV Studio")
                .setContentText(teks)
                .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
                .setPublicVersion(publik)
                .setAutoCancel(true)
                .setContentIntent(buka)
                .build()
            runCatching { nm.notify((System.currentTimeMillis() and 0x7fffffff).toInt(), notif) }
        }
    }
}
