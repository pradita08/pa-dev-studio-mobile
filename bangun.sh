#!/usr/bin/env bash
# Bangun APK PADEV Studio di Docker (tanpa Android Studio di Mac).
#
#   apk/bangun.sh debug       -> unit test JVM, lalu apk/keluaran/padev-studio-<versi>-debug.apk (kunci debug bawaan)
#   apk/bangun.sh profile     -> apk/keluaran/padev-studio-<versi>-profile.apk (APK demo: AOT, kunci debug, pratinjau ada,
#                                TIDAK debuggable, FLAG_SECURE aktif, QR dipin ke relay resmi — SEC-86)
#   apk/bangun.sh rilis       -> apk/keluaran/padev-studio-<versi>-rilis.apk (butuh keystore owner, lihat di bawah)
#   apk/bangun.sh uji         -> flutter analyze + flutter test + unit test JVM (Gradle :app:testDebugUnitTest)
#   apk/bangun.sh kunci-dep   -> perbarui pubspec.lock + android/app/gradle.lockfile untuk debug, profile, rilis, dan unit test
#                                (setelah mengubah dependensi; rilis dibangun TANPA tanda tangan, tanpa keystore — SEC-78).
#                                Dilewati bila sidik berkas dependensi tidak berubah sejak kunci terakhir; paksa: kunci-dep --paksa
#   apk/bangun.sh cek-kunci   -> cek gradle.lockfile mode STRICT (rilis tanpa tanda tangan + profile + unit test), tanpa menulis
#   apk/bangun.sh image       -> hanya membangun image Docker
#
# Hemat sumber daya (Mac Apple Silicon: image amd64 lewat emulasi qemu; image arm64 tidak layak, lihat README):
#   PADEV_APK_MEMORI (bawaan 3400m) dan PADEV_APK_CPU (bawaan 4) membatasi container agar Docker Desktop tetap responsif.
#   Heap/worker Gradle dibatasi di android/gradle.properties (daemon & daemon Kotlin mati).
#   Setiap varian satu proses Gradle; mode harian (debug/profile/uji) tidak membangun rilis/R8 dan tidak menulis lock.
#
# Rilis: keystore & sandi TIDAK PERNAH di repo. Buat env-file di luar repo (bawaan ~/.padev-apk/rilis.env, chmod 600,
# atau tunjuk dengan PADEV_APK_RAHASIA=/path/rilis.env) berisi:
#   PADEV_KEYSTORE=/Users/<anda>/.padev-apk/padev-studio-rilis.p12   (path di Mac, di luar repo)
#   PADEV_KEYSTORE_SANDI=...
#   PADEV_KUNCI_ALIAS=...
#   PADEV_KUNCI_SANDI=...
# Keduanya di-mount baca saja ke container; sandi tidak dikirim lewat argumen/env docker (tidak terlihat di `docker inspect`).
set -euo pipefail

APK="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
REPO="$(dirname "$APK")"
FLUTTER_VERSI="3.44.0"
IMAGE="padev-apk-bangun:${FLUTTER_VERSI}-2"
VOL_GRADLE="padev-apk-gradle"
VOL_PUB="padev-apk-pub"
VOL_NDK="padev-apk-ndk"   # NDK diunduh AGP sekali (untuk strip libflutter.so), disimpan di volume
VOL_ANDROID="padev-apk-android"   # ANDROID_USER_HOME: debug.keystore tetap sama antar-build (pasang ulang di HP tanpa hapus aplikasi)
MEMORI="${PADEV_APK_MEMORI:-3400m}"   # batas container; Docker Desktop owner ±3,8 GB
CPU="${PADEV_APK_CPU:-4}"             # batas CPU container (Docker Desktop owner 8 CPU); sisanya untuk Mac/Docker tetap responsif
JENIS="${1:-}"

gagal() { printf 'GAGAL: %s\n' "$*" >&2; exit 1; }
info() { printf '==> %s\n' "$*"; }

command -v docker >/dev/null 2>&1 || gagal "docker tidak ditemukan. Jalankan Docker Desktop dulu."
docker info >/dev/null 2>&1 || gagal "Docker Desktop belum berjalan."

pastikan_image() {
  if ! docker image inspect "$IMAGE" >/dev/null 2>&1; then
    info "Membangun image $IMAGE (sekali; unduhan ±2 GB)"
    docker build --platform linux/amd64 -t "$IMAGE" "$APK/docker"
  fi
}

# jalankan <nama-container> <perintah bash> [opsi docker tambahan...]
jalankan() {
  local nama="$1" perintah="$2"; shift 2
  local kode=0
  docker run --rm --platform linux/amd64 --name "padev-apk-${nama}-$$" \
    --memory "$MEMORI" --memory-swap "$MEMORI" --cpus "$CPU" \
    -v "${VOL_GRADLE}:/cache/gradle" -v "${VOL_PUB}:/cache/pub" -v "${VOL_NDK}:/opt/android-sdk-linux/ndk" \
    -v "${VOL_ANDROID}:/cache/android" -e ANDROID_USER_HOME=/cache/android \
    -v "${APK}:/proyek" "$@" \
    "$IMAGE" bash -euo pipefail -c "$perintah" || kode=$?
  if [ "$kode" -eq 137 ]; then
    gagal "container dihentikan karena kehabisan memori (batas $MEMORI). Naikkan memori Docker Desktop ke minimal 6 GB
(Settings > Resources > Memory), lalu jalankan PADEV_APK_MEMORI=5000m apk/bangun.sh $JENIS"
  fi
  [ "$kode" -eq 0 ] || gagal "perintah di container gagal (kode $kode)."
}

versi() { sed -n 's/^version:[[:space:]]*\([0-9][0-9.]*\).*/\1/p' "$APK/pubspec.yaml" | head -1; }

di_dalam_repo() {  # $1 = path absolut yang sudah di-resolve
  case "$1/" in "$REPO"/*) return 0 ;; *) return 1 ;; esac
}

PUB_GET='flutter pub get --enforce-lockfile >/dev/null'

# Cek lock mode STRICT tanpa tulis: rilis (tanpa tanda tangan, dibuang), profile, unit test.
cek_kunci() {
  info "Cek lock Gradle (STRICT, tanpa tulis): rilis tanpa tanda tangan + profile + unit test"
  # Satu proses Gradle per varian: R8 rilis + JVM unit test dalam satu proses pernah membuat daemon mati kehabisan memori.
  local g='./gradlew --console=plain -Ptarget-platform=android-arm64'
  jalankan kuncicek "$PUB_GET && cd android && $g -PpadevRilisTanpaTanda=true :app:assembleRelease \
    && $g :app:assembleProfile && $g :app:testDebugUnitTest"
  rm -f "$APK/build/app/outputs/apk/release/"*.apk
  sidik_dep > "$SIDIK"
  info "Lock lengkap untuk debug, profile, rilis, dan unit test."
}

# Sidik berkas yang menentukan dependensi (bukan gradle.properties: hanya penyetelan JVM). Disimpan setelah lock terbukti
# lengkap (cek-kunci/kunci-dep); mode harian hanya memberi peringatan bila berubah — kunci-dep (lama) tidak pernah otomatis.
SIDIK="$APK/android/app/gradle.lockfile.sidik"
sidik_dep() {
  (cd "$APK" && shasum -a 256 pubspec.yaml pubspec.lock android/settings.gradle.kts android/build.gradle.kts \
    android/app/build.gradle.kts android/gradle/wrapper/gradle-wrapper.properties) | shasum -a 256 | cut -d' ' -f1
}
periksa_sidik() {
  [ "$(cat "$SIDIK" 2>/dev/null)" = "$(sidik_dep)" ] && return 0
  info "PERHATIAN: berkas pubspec/gradle berubah sejak lock terakhir diperiksa. Bila build gagal \"does not have lock state\","
  info "jalankan apk/bangun.sh kunci-dep (lama); bila build lulus, apk/bangun.sh cek-kunci memperbarui sidik."
}

# kotlin-stdlib-common:<versi kotlin-stdlib> untuk konfigurasi yang memuat kotlin-stdlib-jdk8 (lihat kunci-dep).
tambah_stdlib_common() {
  local kunci="$APK/android/app/gradle.lockfile" v k
  v="$(sed -n 's/^org\.jetbrains\.kotlin:kotlin-stdlib:\([^=]*\)=.*/\1/p' "$kunci" | head -1)"
  k="$(sed -n 's/^org\.jetbrains\.kotlin:kotlin-stdlib-jdk8:[^=]*=//p' "$kunci" | head -1)"
  [ -n "$v" ] && [ -n "$k" ] || return 0
  awk -v baris="org.jetbrains.kotlin:kotlin-stdlib-common:${v}=${k}" '
    /^org\.jetbrains\.kotlin:kotlin-stdlib-common:/ { next }
    !ditulis && $0 > baris && $0 !~ /^#/ { print baris; ditulis = 1 }
    { print }
    END { if (!ditulis) print baris }' "$kunci" > "$kunci.baru" && mv "$kunci.baru" "$kunci"
}

case "$JENIS" in
  image)
    pastikan_image ;;

  debug)
    pastikan_image; periksa_sidik
    mulai=$SECONDS
    info "Unit test JVM kripto lalu build APK debug (arm64) — Flutter $FLUTTER_VERSI"
    rm -f "$APK/build/app/outputs/flutter-apk/app-debug.apk"   # APK lama tidak boleh tersalin bila build/test gagal
    jalankan debug "$PUB_GET && (cd android && ./gradlew --console=plain -Ptarget-platform=android-arm64 :app:testDebugUnitTest) \
      && flutter build apk --debug --target-platform android-arm64"
    mkdir -p "$APK/keluaran"
    tujuan="$APK/keluaran/padev-studio-$(versi)-debug.apk"
    cp "$APK/build/app/outputs/flutter-apk/app-debug.apk" "$tujuan"
    info "Selesai dalam $((SECONDS - mulai)) dtk: $tujuan ($(du -h "$tujuan" | cut -f1))"
    ;;

  profile)
    pastikan_image; periksa_sidik
    mulai=$SECONDS
    info "Build APK profile/demo (arm64, kunci debug, tidak debuggable) — Flutter $FLUTTER_VERSI"
    rm -f "$APK/build/app/outputs/flutter-apk/app-profile.apk"
    jalankan profile "$PUB_GET && flutter build apk --profile --target-platform android-arm64"
    mkdir -p "$APK/keluaran"
    tujuan="$APK/keluaran/padev-studio-$(versi)-profile.apk"
    cp "$APK/build/app/outputs/flutter-apk/app-profile.apk" "$tujuan"
    info "Selesai dalam $((SECONDS - mulai)) dtk: $tujuan ($(du -h "$tujuan" | cut -f1))"
    info "profile = demo; relay nyata semestinya APK rilis. Bila dipakai untuk demo, isi apkSertifikatDebugSha256"
    info "sementara dan hapus setelahnya (KONTRAK §9 K7, REV-31/SEC-86)."
    ;;

  rilis)
    rahasia="${PADEV_APK_RAHASIA:-$HOME/.padev-apk/rilis.env}"
    [ -f "$rahasia" ] || gagal "env-file rilis tidak ditemukan: $rahasia
Buat file itu DI LUAR repo (chmod 600) berisi PADEV_KEYSTORE, PADEV_KEYSTORE_SANDI, PADEV_KUNCI_ALIAS, PADEV_KUNCI_SANDI
(lihat komentar di atas apk/bangun.sh). Untuk uji di HP pakai: apk/bangun.sh debug"
    rahasia="$(cd "$(dirname "$rahasia")" && pwd -P)/$(basename "$rahasia")"
    di_dalam_repo "$rahasia" && gagal "env-file rilis berada di dalam repo ($rahasia). Pindahkan ke luar repo."
    izin="$(stat -f '%Lp' "$rahasia" 2>/dev/null || stat -c '%a' "$rahasia")"
    case "$izin" in 600|400) ;; *) gagal "izin env-file rilis $izin; jalankan: chmod 600 \"$rahasia\"" ;; esac
    ks="$(sed -n 's/^PADEV_KEYSTORE=//p' "$rahasia" | head -1)"
    [ -n "$ks" ] || gagal "PADEV_KEYSTORE kosong di $rahasia"
    [ -f "$ks" ] || gagal "keystore rilis tidak ditemukan: $ks"
    ks="$(cd "$(dirname "$ks")" && pwd -P)/$(basename "$ks")"
    di_dalam_repo "$ks" && gagal "keystore rilis berada di dalam repo ($ks). Pindahkan ke luar repo."
    for k in PADEV_KEYSTORE_SANDI PADEV_KUNCI_ALIAS PADEV_KUNCI_SANDI; do
      grep -q "^${k}=." "$rahasia" || gagal "$k kosong/tidak ada di $rahasia"
    done
    pastikan_image; periksa_sidik
    mulai=$SECONDS
    info "Build APK rilis (arm64, obfuscate + split-debug-info)"
    jalankan rilis "$PUB_GET && flutter build apk --release --target-platform android-arm64 \
        --obfuscate --split-debug-info=build/simbol-rilis \
      && apksigner verify --print-certs build/app/outputs/flutter-apk/app-release.apk | grep -i 'SHA-256'" \
      -v "${rahasia}:/rahasia/rilis.env:ro" -v "${ks}:/rahasia/rilis.keystore:ro" \
      -e PADEV_RILIS_ENV=/rahasia/rilis.env -e PADEV_RILIS_KEYSTORE=/rahasia/rilis.keystore
    mkdir -p "$APK/keluaran"
    tujuan="$APK/keluaran/padev-studio-$(versi)-rilis.apk"
    cp "$APK/build/app/outputs/flutter-apk/app-release.apk" "$tujuan"
    info "Selesai dalam $((SECONDS - mulai)) dtk: $tujuan ($(du -h "$tujuan" | cut -f1))"
    info "Catat SHA-256 sertifikat di atas ke konfigurasi pelaksana (apkSertifikatSha256). Simbol: apk/build/simbol-rilis (jangan dibagikan)."
    ;;

  uji)
    pastikan_image; periksa_sidik
    mulai=$SECONDS
    info "flutter analyze + flutter test + unit test JVM"
    jalankan uji "$PUB_GET && flutter analyze && flutter test \
      && cd android && ./gradlew --console=plain -Ptarget-platform=android-arm64 :app:testDebugUnitTest"
    info "Lulus dalam $((SECONDS - mulai)) dtk. Laporan: apk/build/app/reports/tests/testDebugUnitTest/index.html"
    ;;

  kunci-dep)
    # Catatan: mode tulis-lock tidak memasang constraint lock, sedangkan mode enforce menarik juga
    # org.jetbrains.kotlin:kotlin-stdlib-common (versi = kotlin-stdlib, lewat kotlin-stdlib-jdk7/jdk8:1.8.0). Baris itu ditambahkan
    # otomatis di bawah (konfigurasi sama dengan kotlin-stdlib-jdk8) sebelum cek ulang STRICT.
    # Rilis: `assembleRelease -PpadevRilisTanpaTanda=true` (APK tanpa tanda tangan, tidak disalin ke keluaran) agar
    # releaseRuntimeClasspath dkk. ikut dikunci tanpa keystore owner. Langkah terakhir = cek ulang mode STRICT tanpa tulis.
    if [ "${2:-}" != "--paksa" ] && [ -f "$APK/android/app/gradle.lockfile" ] \
      && [ "$(cat "$SIDIK" 2>/dev/null)" = "$(sidik_dep)" ]; then
      info "Berkas dependensi tidak berubah sejak lock terakhir (sidik sama) — dilewati. Paksa: apk/bangun.sh kunci-dep --paksa"
      exit 0
    fi
    pastikan_image
    info "Memperbarui pubspec.lock dan android/app/gradle.lockfile (debug, profile, rilis, unit test)"
    # Lock lama disimpan: bila salah satu langkah gagal, lock dikembalikan (bukan lock setengah jadi).
    cp "$APK/android/app/gradle.lockfile" "$APK/android/app/gradle.lockfile.lama" 2>/dev/null || true
    rm -f "$APK/android/app/gradle.lockfile"
    GRADLE_ARM64='./gradlew --console=plain -Ptarget-platform=android-arm64'
    # Satu proses Gradle per langkah (rilis/R8 dan unit test dipisah) agar memori puncak tetap di bawah batas container.
    ( jalankan kuncidep "flutter pub get \
      && export ORG_GRADLE_PROJECT_padevTulisKunci=true \
      && flutter build apk --debug --target-platform android-arm64 \
      && flutter build apk --profile --target-platform android-arm64 \
      && cd android && $GRADLE_ARM64 -PpadevRilisTanpaTanda=true :app:assembleRelease \
      && $GRADLE_ARM64 :app:testDebugUnitTest" ) || {
      [ -f "$APK/android/app/gradle.lockfile.lama" ] && mv "$APK/android/app/gradle.lockfile.lama" "$APK/android/app/gradle.lockfile"
      gagal "kunci-dep gagal; gradle.lockfile lama dikembalikan."
    }
    rm -f "$APK/android/app/gradle.lockfile.lama"
    tambah_stdlib_common
    cek_kunci
    ;;

  cek-kunci)
    pastikan_image
    cek_kunci ;;

  *)
    echo "Pakai: apk/bangun.sh debug|profile|rilis|uji|kunci-dep|cek-kunci|image" >&2
    exit 2 ;;
esac
