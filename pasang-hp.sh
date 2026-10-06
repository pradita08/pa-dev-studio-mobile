#!/usr/bin/env bash
# Pasang APK PADEV Studio terbaru dari apk/keluaran/ ke HP lewat USB (dijalankan di Mac, BUKAN di Docker:
# Docker Desktop di Mac tidak bisa memakai USB). Tidak mengubah setelan HP (tanpa `adb shell`).
#   apk/pasang-hp.sh            -> APK terbaru (debug, profile, atau rilis, mana yang paling baru)
#   apk/pasang-hp.sh debug|profile|rilis
set -euo pipefail

APK="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
JENIS="${1:-}"

gagal() { printf 'GAGAL: %s\n' "$*" >&2; exit 1; }

# 1) cari adb: $ADB, PATH, lalu SDK bawaan Android Studio
adb_bin=""
if [ -n "${ADB:-}" ] && [ -x "$ADB" ]; then adb_bin="$ADB"
elif command -v adb >/dev/null 2>&1; then adb_bin="$(command -v adb)"
elif [ -x "$HOME/Library/Android/sdk/platform-tools/adb" ]; then adb_bin="$HOME/Library/Android/sdk/platform-tools/adb"
fi
[ -n "$adb_bin" ] || gagal "adb tidak ditemukan. Pasang Android platform-tools atau set ADB=/path/ke/adb."

# 2) APK terbaru
case "$JENIS" in
  debug|profile|rilis) pola="padev-studio-*-${JENIS}.apk" ;;
  "") pola="padev-studio-*.apk" ;;
  *) gagal "pakai: apk/pasang-hp.sh [debug|profile|rilis]" ;;
esac
berkas="$(ls -t "$APK"/keluaran/$pola 2>/dev/null | head -1 || true)"
[ -n "$berkas" ] || gagal "belum ada APK di apk/keluaran/. Jalankan dulu: apk/bangun.sh debug"

# 3) perangkat berstatus `device`
daftar="$("$adb_bin" devices | awk 'NR>1 && $2=="device" {print $1}')"
jumlah="$(printf '%s' "$daftar" | grep -c . || true)"
if [ "$jumlah" -eq 0 ]; then
  belum_izin="$("$adb_bin" devices | awk 'NR>1 && $2=="unauthorized"' | wc -l | tr -d ' ')"
  cat >&2 <<PESAN
GAGAL: tidak ada HP yang siap (status "device") di adb.
$( [ "$belum_izin" != "0" ] && echo "HP terdeteksi tetapi belum mengizinkan Mac ini: buka kunci HP dan ketuk \"Izinkan\" pada dialog USB debugging." )
Langkah di POCO/HyperOS (sekali saja):
  1. Setelan > Tentang ponsel > ketuk "Versi OS" 7x sampai mode pengembang aktif.
  2. Setelan > Setelan tambahan > Opsi pengembang: nyalakan "USB debugging" dan "Instal via USB"
     (HyperOS bisa meminta login akun Mi dan SIM aktif untuk "Instal via USB").
  3. Sambungkan kabel USB data, pilih mode "Transfer file", ketuk "Izinkan" pada dialog sidik RSA Mac ini.
  4. Jalankan lagi: apk/pasang-hp.sh
PESAN
  exit 3
fi
if [ -n "${ANDROID_SERIAL:-}" ]; then
  printf '%s\n' "$daftar" | grep -qx "$ANDROID_SERIAL" || gagal "ANDROID_SERIAL=$ANDROID_SERIAL tidak berstatus device."
  daftar="$ANDROID_SERIAL"; jumlah=1
fi
[ "$jumlah" -eq 1 ] || gagal "lebih dari satu perangkat tersambung; cabut yang lain (atau set ANDROID_SERIAL=<serial>)."

echo "==> Memasang $(basename "$berkas") ($(du -h "$berkas" | cut -f1)) ke $daftar"
"$adb_bin" -s "$daftar" install -r "$berkas" \
  || gagal "pemasangan ditolak. Bila \"INSTALL_FAILED_UPDATE_INCOMPATIBLE\" (tanda tangan debug vs rilis berbeda), hapus aplikasi PADEV Studio di HP dulu lalu ulangi."
echo "==> Terpasang. Buka \"PADEV Studio\" di HP."
