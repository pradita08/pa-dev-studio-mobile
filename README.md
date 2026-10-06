# APK PADEV Studio (Flutter + plugin Kotlin `kunci`)

Kontrak: `.ai/brief/KONTRAK-apk.md` (§2 kripto, §3 pemasangan, §6 APK). Paket `pro.padeveloper.studio`, minSdk 30.

## Build (Docker, tanpa Android Studio)
| Perintah | Hasil |
|---|---|
| `apk/bangun.sh debug` | `apk/keluaran/padev-studio-<versi>-debug.apk` (arm64, kunci debug bawaan) |
| `apk/bangun.sh profile` | `apk/keluaran/padev-studio-<versi>-profile.apk` (APK demo: AOT, kunci debug, pratinjau data contoh ada; tidak debuggable, FLAG_SECURE aktif, QR dipin relay resmi — SEC-86). profile = demo; relay nyata semestinya APK rilis; bila dipakai untuk demo, isi `apkSertifikatDebugSha256` sementara dan hapus setelahnya (KONTRAK §9 K7) |
| `apk/bangun.sh uji` | `flutter analyze` + `flutter test` + unit test JVM (RFC 9180, Wycheproof, `vektor-e2e.json`, `vektor-rusak.json`, dekoder QR) |
| `apk/bangun.sh rilis` | APK rilis (obfuscate + split-debug-info); butuh env-file & keystore owner **di luar repo** (lihat kepala `bangun.sh`) |
| `apk/bangun.sh kunci-dep [--paksa]` | perbarui `pubspec.lock` + `android/app/gradle.lockfile` (debug, profile, rilis tanpa tanda tangan, unit test) setelah mengubah dependensi; Gradle lock mode STRICT. Lama (±1 jam); dilewati bila sidik berkas dependensi sama (`android/app/gradle.lockfile.sidik`); gagal → lock lama dikembalikan |
| `apk/bangun.sh cek-kunci` | cek lock STRICT tanpa menulis (rilis tanpa tanda tangan, profile, unit test; satu proses Gradle per langkah), lalu simpan sidik |
| `apk/pasang-hp.sh [debug\|profile\|rilis]` | dijalankan di Mac: `adb install -r` APK terbaru ke HP lewat USB |

Image: `ghcr.io/cirruslabs/flutter:3.44.0` dipin digest, `linux/amd64` (emulasi qemu di Mac Apple Silicon). Cache: volume
`padev-apk-gradle`, `padev-apk-pub`, `padev-apk-ndk`, `padev-apk-android`. Container: `padev-apk-*` (sekali pakai, `--rm`).

### Hemat memori/CPU (build harian)
- Batas container: `PADEV_APK_MEMORI` (bawaan 3400m) dan `PADEV_APK_CPU` (bawaan 4 dari 8 CPU Docker Desktop).
- Gradle: heap 1536m/metaspace 512m, 2 worker, daemon & daemon Kotlin mati (`android/gradle.properties`). Gradle 9 tetap
  memforking satu JVM build sekali pakai (±260 MB klien + daemon) karena argumen `--add-opens` daemon; menyamakan `GRADLE_OPTS`
  sudah dicoba dan tidak menghilangkannya.
- `debug`/`profile`/`uji` hanya membangun varian itu; R8/rilis hanya di `rilis`; lint vital profile dimatikan (REV-52; rilis
  tetap menjalankan `lintVitalAnalyzeRelease`). `kunci-dep` tidak pernah otomatis; mode harian hanya memperingatkan bila
  berkas pubspec/gradle berubah sejak lock terakhir diperiksa.
- Image arm64 asli (tanpa qemu) tidak layak per 2026-10-06: `gen_snapshot` Android AOT (profile/rilis) Flutter tidak tersedia
  untuk host linux-arm64 (`android-arm64-profile/linux-arm64.zip` 404, hanya `linux-x64`), `aapt2` Maven hanya
  `linux`(x86_64)/`osx`/`windows`, NDK Linux hanya x86_64. Alternatif percepatan (keputusan owner): aktifkan "Use Rosetta for
  x86_64/amd64 emulation" di Docker Desktop, atau build langsung di Mac dengan Flutter + Android SDK host.

Uji silang dengan Node (amplop buatan Kotlin): setelah `bangun.sh uji`, jalankan
`node apk/kontrak/uji-kripto.js --periksa apk/build/uji-kotlin/amplop-kotlin.json`.

## Struktur
- `lib/kunci/kunci.dart` — fasad Dart, satu-satunya jalan UI ke native (kanal `pro.padeveloper.studio/kunci`).
- Pemindai QR pemasangan: `android/.../kunci/PemindaiQrActivity.kt` + `DekoderQr.kt` (CameraX + ZXing core, offline, tanpa
  ML Kit/Play Services; kontrak v1.1 §7). Dipanggil `Kunci.pindaiQr()`; kamera mati & layar ditutup saat aplikasi ke latar.
- `lib/tema/token.dart` — token warna/ukuran DESAIN-apk §1 + ikon Material Symbols Rounded (dibundel).
- `lib/debug/layar_uji.dart` — layar uji (hanya debug). `lib/layar/**` — layar L01–L08 (divisi UI).
- `android/app/src/main/kotlin/pro/padeveloper/studio/kunci/` — JCS, ID kunci, HPKE (Tink), amplop (buat/periksa urutan
  SEC-46), pemasangan (HMAC/SAS/atestasi), Keystore, Brankas, BiometricPrompt, klien relay, plugin.
- `android/app/src/main/kotlin/com/google/crypto/tink/hybrid/internal/JembatanHpkePadev.kt` — akses HPKE Tink dengan `aad`
  (API publik Tink tidak menerima aad). Bila Tink dinaikkan, jalankan ulang `bangun.sh uji`.
- Cermin sesi (v2, `KONTRAK-apk-v2.md` §2.1–2.2, §6.3): `kunci/Cermin.kt` — skema perintah `cermin_*`, pemeriksa ketat kabar
  `cermin_sesi`/`cermin`/`cermin_riwayat` (field tak dikenal ditolak), cache riwayat terenkripsi (K-06: AES-256-GCM, kunci Keystore
  `KunciRiwayat` ber-`setUnlockedDeviceRequired`, ≤7 hari/20 sesi/5 MB, dihapus saat dicabut/darurat/lepas). Penanda build
  `BuildConfig.CERMIN_NYATA` (K-07) = true hanya rilis; debug & profile memakai data contoh (`StatusKeamanan.cerminNyata`).
- `alat/buat-ikon.py` — membuat ikon adaptif dari `docs/desain-apk/assets/logo-pa.png` (butuh Pillow; hasil sudah di repo).
- Font: Plus Jakarta Sans (OFL 1.1) & Material Symbols Rounded (Apache 2.0) di `assets/fonts/` beserta lisensinya.

## FCM
Tanpa `android/app/google-services.json` (tidak pernah di repo) build tetap jalan dan FCM nonaktif. Untuk mengaktifkan:
owner menaruh file itu di `android/app/` lalu build ulang.
