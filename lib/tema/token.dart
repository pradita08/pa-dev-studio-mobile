// Token desain PADEV Studio — persis .ai/brief/DESAIN-apk.md §1 (terang / gelap).
// Dipakai layar L01–L10 (lib/layar/**) dan layar uji debug.
import 'package:flutter/material.dart';

@immutable
class WarnaPadev extends ThemeExtension<WarnaPadev> {
  const WarnaPadev({
    required this.bg,
    required this.panel,
    required this.ink,
    required this.muted,
    required this.line,
    required this.chip,
    required this.accent,
    required this.accb,
    required this.ok,
    required this.okt,
    required this.okb,
    required this.warn,
    required this.warnt,
    required this.warnb,
    required this.warnbtn,
    required this.onwarn,
    required this.err,
    required this.errb,
    required this.btn,
    required this.btnt,
    required this.idle,
    required this.skel,
    required this.scrim,
  });

  final Color bg, panel, ink, muted, line, chip, accent, accb;
  final Color ok, okt, okb, warn, warnt, warnb, warnbtn, onwarn, err, errb;
  final Color btn, btnt, idle, skel, scrim;

  static const terang = WarnaPadev(
    bg: Color(0xFFE6EBF0), panel: Color(0xFFFFFFFF), ink: Color(0xFF1D2433), muted: Color(0xFF5B6376),
    line: Color(0xFFE3E7EE), chip: Color(0xFFF2F4F8), accent: Color(0xFF1268E6), accb: Color(0xFFE6F0FF),
    ok: Color(0xFF1F9D6B), okt: Color(0xFF157552), okb: Color(0xFFE7F8EF),
    warn: Color(0xFFF57C00), warnt: Color(0xFFA64B00), warnb: Color(0xFFFFF1E3), warnbtn: Color(0xFFC45200),
    onwarn: Color(0xFFFFFFFF), err: Color(0xFFC93A3A), errb: Color(0xFFFDE6E6),
    btn: Color(0xFF1D2433), btnt: Color(0xFFFFFFFF), idle: Color(0xFFF4F6FB), skel: Color(0xFFE9EDF2),
    scrim: Color.fromRGBO(17, 22, 32, .45),
  );

  static const gelap = WarnaPadev(
    bg: Color(0xFF0F131A), panel: Color(0xFF171C25), ink: Color(0xFFE8ECF3), muted: Color(0xFFA3ACBD),
    line: Color(0xFF2A313D), chip: Color(0xFF222936), accent: Color(0xFF4DA3FF), accb: Color(0xFF10284A),
    ok: Color(0xFF3CCF8E), okt: Color(0xFF3CCF8E), okb: Color(0xFF163A2B),
    warn: Color(0xFFFF9A3C), warnt: Color(0xFFFF9A3C), warnb: Color(0xFF3D2410), warnbtn: Color(0xFFFF9A3C),
    onwarn: Color(0xFF171C25), err: Color(0xFFFF7B7B), errb: Color(0xFF431D20),
    btn: Color(0xFFE8ECF3), btnt: Color(0xFF171C25), idle: Color(0xFF222936), skel: Color(0xFF222936),
    scrim: Color.fromRGBO(0, 0, 0, .6),
  );

  static WarnaPadev dari(BuildContext context) => Theme.of(context).extension<WarnaPadev>()!;

  @override
  WarnaPadev copyWith() => this;

  @override
  WarnaPadev lerp(WarnaPadev? other, double t) => t < .5 ? this : (other ?? this);
}

/// Ukuran tetap dari rancangan.
abstract final class UkuranPadev {
  static const double tinggiTombol = 48;
  static const double radiusKartu = 14;
}

/// Ikon Material Symbols Rounded (dibundel di assets/fonts; titik kode dari berkas .codepoints resmi).
abstract final class Simbol {
  static const _f = 'MaterialSymbolsRounded';
  static const sidikJari = IconData(0xe90d, fontFamily: _f);
  static const kunci = IconData(0xe73c, fontFamily: _f);
  static const gembok = IconData(0xe899, fontFamily: _f);
  static const gembokTerbuka = IconData(0xe898, fontFamily: _f);
  static const hapus = IconData(0xe92e, fontFamily: _f);
  static const centang = IconData(0xf0be, fontFamily: _f);
  static const galat = IconData(0xf8b6, fontFamily: _f);
  static const segarkan = IconData(0xe5d5, fontFamily: _f);
  static const terenkripsi = IconData(0xe593, fontFamily: _f);
  static const tanda = IconData(0xe746, fontFamily: _f);
  static const uji = IconData(0xea4b, fontFamily: _f);

  // Layar L01–L10 (titik kode diambil dari tabel cmap MaterialSymbolsRounded.ttf yang dibundel)
  static const folder = IconData(0xe2c7, fontFamily: _f);
  static const folderBuka = IconData(0xe2c8, fontFamily: _f); // folder_open (bagian grup terbuka)
  static const urutkan = IconData(0xe8d5, fontFamily: _f); // swap_vert (atur grup)
  static const panahAtas = IconData(0xe5d8, fontFamily: _f); // arrow_upward
  static const panahBawah = IconData(0xe5db, fontFamily: _f); // arrow_downward
  static const kantor = IconData(0xf720, fontFamily: _f); // deployed_code
  static const lonceng = IconData(0xe7f4, fontFamily: _f);
  static const pengaturan = IconData(0xe8b8, fontFamily: _f);
  static const pindai = IconData(0xf206, fontFamily: _f);
  static const laptop = IconData(0xe320, fontFamily: _f);
  static const putar = IconData(0xe627, fontFamily: _f); // sync (Bekerja)
  static const tangan = IconData(0xe769, fontFamily: _f); // front_hand (Menunggu izin)
  static const centangLingkar = IconData(0xe86c, fontFamily: _f);
  static const tidur = IconData(0xe1f9, fontFamily: _f); // bedtime (Diam)
  static const gelap = IconData(0xe51c, fontFamily: _f);
  static const terang = IconData(0xe518, fontFamily: _f);
  static const kontras = IconData(0xeb37, fontFamily: _f);
  static const galatLingkar = IconData(0xe000, fontFamily: _f);
  static const larang = IconData(0xe033, fontFamily: _f); // block
  static const kirim = IconData(0xe163, fontFamily: _f);
  static const henti = IconData(0xef71, fontFamily: _f); // stop_circle
  static const kembali = IconData(0xe5c4, fontFamily: _f);
  static const menu = IconData(0xe5d4, fontFamily: _f); // more_vert
  static const ubah = IconData(0xe150, fontFamily: _f);
  static const cari = IconData(0xe8b6, fontFamily: _f);
  static const berkas = IconData(0xe873, fontFamily: _f);
  static const terminal = IconData(0xeb8e, fontFamily: _f);
  static const obrolanBaru = IconData(0xe266, fontFamily: _f);
  static const tempatSampah = IconData(0xe872, fontFamily: _f);
  static const obrolan = IconData(0xe0bf, fontFamily: _f); // forum
  static const putus = IconData(0xe16f, fontFamily: _f); // link_off
  static const tanpaWifi = IconData(0xe648, fontFamily: _f);
  static const senter = IconData(0xf00b, fontFamily: _f);
  static const tutup = IconData(0xe14c, fontFamily: _f);
  static const daftarCek = IconData(0xe6b1, fontFamily: _f); // checklist (Rencana)
  static const kilat = IconData(0xea0b, fontFamily: _f); // bolt (Kerjakan)
  static const akun = IconData(0xe853, fontFamily: _f);
  static const bawah = IconData(0xe5cf, fontFamily: _f); // expand_more
  static const kanan = IconData(0xe409, fontFamily: _f); // chevron_right
  static const info = IconData(0xe88e, fontFamily: _f);
  static const baterai = IconData(0xe1a4, fontFamily: _f);
  static const hp = IconData(0xe0d4, fontFamily: _f); // mobile
  static const perbarui = IconData(0xe923, fontFamily: _f); // update
  static const jam = IconData(0xe192, fontFamily: _f);
  static const pasir = IconData(0xea5b, fontFamily: _f); // hourglass_top
  static const gambar = IconData(0xe251, fontFamily: _f);
  static const tim = IconData(0xe7ef, fontFamily: _f);
  static const perisai = IconData(0xe8e8, fontFamily: _f); // verified_user
  static const tautan = IconData(0xe157, fontFamily: _f);
  static const tanpaKamera = IconData(0xf1a8, fontFamily: _f);
  static const peringatan = IconData(0xe002, fontFamily: _f);
  static const ulang = IconData(0xf053, fontFamily: _f); // restart_alt
  static const tambah = IconData(0xe145, fontFamily: _f);

  // L11/L11b Sesi (v2 F1)
  static const sesi = IconData(0xe889, fontFamily: _f); // history (tab Sesi)
  static const orang = IconData(0xe7fd, fontFamily: _f); // person (pesan owner)
  static const claude = IconData(0xf06c, fontFamily: _f); // smart_toy (jawaban Claude)
  static const tersembunyi = IconData(0xe8f5, fontFamily: _f); // visibility_off (tingkat ringkas)
  static const langsung = IconData(0xe51e, fontFamily: _f); // sensors (pembaruan langsung)
  static const cariLama = IconData(0xf02f, fontFamily: _f); // manage_search (Cari sesi lama)
  static const atas = IconData(0xe5ce, fontFamily: _f); // expand_less (muat lebih lama)
  static const kode = IconData(0xe86f, fontFamily: _f); // code (VS Code)
}

/// Pilihan tampilan Pengaturan (Terang/Gelap/Ikuti sistem). Disimpan di memori saja — penyimpanan permanen butuh fasad (lihat progres UI).
final temaAplikasi = ValueNotifier<ThemeMode>(ThemeMode.system);

ThemeData temaPadev(Brightness kecerahan) {
  final w = kecerahan == Brightness.dark ? WarnaPadev.gelap : WarnaPadev.terang;
  final skema = ColorScheme(
    brightness: kecerahan,
    primary: w.btn,
    onPrimary: w.btnt,
    secondary: w.accent,
    onSecondary: w.panel,
    error: w.err,
    onError: w.panel,
    surface: w.panel,
    onSurface: w.ink,
  );
  return ThemeData(
    useMaterial3: true,
    colorScheme: skema,
    scaffoldBackgroundColor: w.bg,
    fontFamily: 'PlusJakartaSans',
    dividerColor: w.line,
    extensions: [w],
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: w.btn,
        foregroundColor: w.btnt,
        // Catatan uji 0.1.0: tombol nonaktif bawaan M3 (12%/38%) terlalu redup. muted di atas chip ≥ 5:1 (terang & gelap).
        disabledBackgroundColor: w.chip,
        disabledForegroundColor: w.muted,
        minimumSize: const Size.fromHeight(UkuranPadev.tinggiTombol),
        textStyle: const TextStyle(fontFamily: 'PlusJakartaSans', fontWeight: FontWeight.w700, fontSize: 15),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: w.ink,
        minimumSize: const Size.fromHeight(UkuranPadev.tinggiTombol),
        backgroundColor: w.panel,
        disabledForegroundColor: w.muted,
        side: BorderSide(color: w.line),
        textStyle: const TextStyle(fontFamily: 'PlusJakartaSans', fontWeight: FontWeight.w600, fontSize: 15),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: w.accent,
        minimumSize: const Size(48, 48),
        textStyle: const TextStyle(fontFamily: 'PlusJakartaSans', fontWeight: FontWeight.w600, fontSize: 14),
      ),
    ),
    bottomSheetTheme: BottomSheetThemeData(
      backgroundColor: w.panel,
      modalBarrierColor: w.scrim,
      showDragHandle: true,
      dragHandleColor: w.line,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
    ),
    dialogTheme: DialogThemeData(
      backgroundColor: w.panel,
      barrierColor: w.scrim,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
    ),
    popupMenuTheme: PopupMenuThemeData(
      color: w.panel,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: BorderSide(color: w.line)),
      textStyle: TextStyle(fontFamily: 'PlusJakartaSans', color: w.ink, fontSize: 14),
    ),
    snackBarTheme: SnackBarThemeData(
      backgroundColor: w.btn,
      contentTextStyle: TextStyle(fontFamily: 'PlusJakartaSans', color: w.btnt, fontSize: 14),
      behavior: SnackBarBehavior.floating,
    ),
    progressIndicatorTheme: ProgressIndicatorThemeData(color: w.accent, linearTrackColor: w.line),
    textSelectionTheme: TextSelectionThemeData(cursorColor: w.accent),
  );
}
