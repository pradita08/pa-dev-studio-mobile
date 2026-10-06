#!/usr/bin/env python3
"""Membuat aset ikon adaptif Android dari logo PA (sekali jalan, hasil disimpan di repo).

Pakai: python3 apk/alat/buat-ikon.py   (butuh Pillow; jalankan dari venv sementara, bukan dependensi APK)
Masukan : docs/desain-apk/assets/logo-pa.png (latar transparan)
Keluaran: apk/android/app/src/main/res/mipmap-*/ic_launcher_foreground.png (108 dp, logo di zona aman 66 dp),
          ic_launcher_monochrome.png (siluet putih untuk ikon bertema), drawable-*/ic_notif.png (24 dp, siluet putih).
Latar ikon (#1d2433) ada di res/values/warna_ikon.xml.
"""
from pathlib import Path

from PIL import Image

AKAR = Path(__file__).resolve().parents[2]
LOGO = AKAR / "docs/desain-apk/assets/logo-pa.png"
RES = AKAR / "apk/android/app/src/main/res"
KEPADATAN = {"mdpi": 1.0, "hdpi": 1.5, "xhdpi": 2.0, "xxhdpi": 3.0, "xxxhdpi": 4.0}
ZONA_LOGO_DP = 60  # sedikit di dalam zona aman 66 dp agar tidak terpotong masker bulat


def siluet(im: Image.Image) -> Image.Image:
    putih = Image.new("RGBA", im.size, (255, 255, 255, 0))
    putih.putalpha(im.split()[3])
    return putih


def taruh(logo: Image.Image, kanvas_px: int, isi_px: int) -> Image.Image:
    l = logo.copy()
    l.thumbnail((isi_px, isi_px), Image.LANCZOS)
    kanvas = Image.new("RGBA", (kanvas_px, kanvas_px), (0, 0, 0, 0))
    kanvas.paste(l, ((kanvas_px - l.width) // 2, (kanvas_px - l.height) // 2), l)
    return kanvas


def main() -> None:
    logo = Image.open(LOGO).convert("RGBA")
    logo = logo.crop(logo.split()[3].getbbox())
    for nama, k in KEPADATAN.items():
        folder = RES / f"mipmap-{nama}"
        folder.mkdir(parents=True, exist_ok=True)
        depan = taruh(logo, round(108 * k), round(ZONA_LOGO_DP * k))
        depan.save(folder / "ic_launcher_foreground.png", optimize=True)
        siluet(depan).save(folder / "ic_launcher_monochrome.png", optimize=True)
        notif = RES / f"drawable-{nama}"
        notif.mkdir(parents=True, exist_ok=True)
        siluet(taruh(logo, round(24 * k), round(20 * k))).save(notif / "ic_notif.png", optimize=True)
    print("ikon dibuat di", RES)


if __name__ == "__main__":
    main()
