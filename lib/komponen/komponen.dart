// Komponen bersama PADEV Studio (rancangan owner "Komponen", docs/desain-apk). Semua warna dari WarnaPadev (DESAIN §1).
import 'package:flutter/material.dart';

import '../layar/data.dart';
import '../tema/token.dart';

const _mono = TextStyle(fontFamily: 'monospace', fontFamilyFallback: ['RobotoMono', 'Roboto']);

/// Gaya teks yang dipakai berulang.
abstract final class TeksPadev {
  static TextStyle judulLayar(WarnaPadev w) => TextStyle(color: w.ink, fontSize: 26, fontWeight: FontWeight.w800, height: 1.2);
  static TextStyle judulKartu(WarnaPadev w) => TextStyle(color: w.ink, fontSize: 15, fontWeight: FontWeight.w800);
  static TextStyle isi(WarnaPadev w) => TextStyle(color: w.ink, fontSize: 14, height: 1.4);
  static TextStyle redup(WarnaPadev w, {double ukuran = 13}) => TextStyle(color: w.muted, fontSize: ukuran, height: 1.4);
  static TextStyle label(WarnaPadev w) => TextStyle(color: w.muted, fontSize: 12, fontWeight: FontWeight.w700);
  static TextStyle mono(Color c, {double ukuran = 12}) => _mono.copyWith(color: c, fontSize: ukuran);
}

/// Logo PA (meniru docs/desain-apk/assets/logo-pa.png tanpa berkas gambar; lihat catatan progres).
class LogoPadev extends StatelessWidget {
  const LogoPadev({super.key, this.ukuran = 56});
  final double ukuran;

  @override
  Widget build(BuildContext context) {
    final f = ukuran * .5;
    Widget huruf(String h, List<Color> g) => ShaderMask(
          shaderCallback: (r) => LinearGradient(colors: g, begin: Alignment.topCenter, end: Alignment.bottomCenter).createShader(r),
          child: Text(h, style: TextStyle(fontSize: f, fontWeight: FontWeight.w800, fontStyle: FontStyle.italic, color: Colors.white, height: 1)),
        );
    return Semantics(
      label: 'Logo PADEV Studio',
      child: Container(
        width: ukuran,
        height: ukuran,
        decoration: BoxDecoration(color: const Color(0xFF1D2433), borderRadius: BorderRadius.circular(ukuran * .24)),
        alignment: Alignment.center,
        padding: EdgeInsets.all(ukuran * .14),
        child: ExcludeSemantics(
          child: FittedBox(
            fit: BoxFit.scaleDown,
            child: Row(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
              huruf('P', const [Color(0xFF00A3FF), Color(0xFF1560E0)]),
              Transform.translate(
                offset: Offset(-f * .12, f * .08),
                child: huruf('A', const [Color(0xFFFFB300), Color(0xFFFF5A00)]),
              ),
            ]),
          ),
        ),
      ),
    );
  }
}

class Kartu extends StatelessWidget {
  const Kartu({super.key, required this.anak, this.padding = const EdgeInsets.all(14), this.onTap, this.warna, this.semantik});
  final Widget anak;
  final EdgeInsetsGeometry padding;
  final VoidCallback? onTap;
  final Color? warna;
  final String? semantik;

  @override
  Widget build(BuildContext context) {
    final w = WarnaPadev.dari(context);
    final r = BorderRadius.circular(UkuranPadev.radiusKartu);
    return Material(
      color: warna ?? w.panel,
      shape: RoundedRectangleBorder(borderRadius: r, side: BorderSide(color: w.line)),
      clipBehavior: Clip.antiAlias,
      child: onTap == null
          ? Padding(padding: padding, child: anak)
          : Semantics(button: true, label: semantik, child: InkWell(onTap: onTap, child: Padding(padding: padding, child: anak))),
    );
  }
}

/// Chip kecil berikon (status).
class ChipPadev extends StatelessWidget {
  const ChipPadev({super.key, required this.ikon, required this.label, required this.fg, required this.bg});
  final IconData ikon;
  final String label;
  final Color fg, bg;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(99)),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(ikon, size: 13, color: fg),
        const SizedBox(width: 4),
        Text(label, style: TextStyle(color: fg, fontSize: 12, fontWeight: FontWeight.w700)),
      ]),
    );
  }

  factory ChipPadev.status(BuildContext context, StatusProyek s) {
    final w = WarnaPadev.dari(context);
    return switch (s) {
      StatusProyek.bekerja => ChipPadev(ikon: Simbol.putar, label: 'Bekerja', fg: w.accent, bg: w.accb),
      StatusProyek.menungguIzin => ChipPadev(ikon: Simbol.tangan, label: 'Menunggu izin', fg: w.warnt, bg: w.warnb),
      StatusProyek.selesai => ChipPadev(ikon: Simbol.centangLingkar, label: 'Selesai', fg: w.okt, bg: w.okb),
      StatusProyek.gagal => ChipPadev(ikon: Simbol.galatLingkar, label: 'Gagal', fg: w.err, bg: w.errb),
      StatusProyek.diam => ChipPadev(ikon: Simbol.tidur, label: 'Diam', fg: w.muted, bg: w.chip),
      StatusProyek.tidakDiketahui => ChipPadev(ikon: Simbol.info, label: 'Tidak diketahui', fg: w.muted, bg: w.chip),
    };
  }

  /// Status sesi cermin (L11/L11b): bekerja / menunggu izin / diam / selesai.
  factory ChipPadev.sesi(BuildContext context, StatusSesi s) => ChipPadev.status(
        context,
        switch (s) {
          StatusSesi.bekerja => StatusProyek.bekerja,
          StatusSesi.menungguIzin => StatusProyek.menungguIzin,
          StatusSesi.selesai => StatusProyek.selesai,
          StatusSesi.diam => StatusProyek.diam,
        },
      );

  factory ChipPadev.divisi(BuildContext context, String status) => ChipPadev.status(
        context,
        switch (status) {
          'bekerja' => StatusProyek.bekerja,
          'menunggu_izin' => StatusProyek.menungguIzin,
          _ => StatusProyek.diam,
        },
      );
}

enum JenisSpanduk { galat, netral, peringatan, sukses }

/// Banner (Mac putus / tanpa internet / menunggu izin / info).
class Spanduk extends StatelessWidget {
  const Spanduk({super.key, required this.jenis, required this.ikon, required this.teks, this.anak, this.aksi, this.labelAksi});
  final JenisSpanduk jenis;
  final IconData ikon;
  final String teks;
  final Widget? anak;
  final VoidCallback? aksi;
  final String? labelAksi;

  @override
  Widget build(BuildContext context) {
    final w = WarnaPadev.dari(context);
    final (fg, bg) = switch (jenis) {
      JenisSpanduk.galat => (w.err, w.errb),
      JenisSpanduk.netral => (w.ink, w.panel),
      JenisSpanduk.peringatan => (w.warnt, w.warnb),
      JenisSpanduk.sukses => (w.okt, w.okb),
    };
    return Semantics(
      liveRegion: true,
      container: true,
      child: Container(
        padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(12),
          border: jenis == JenisSpanduk.netral ? Border.all(color: w.line) : null,
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Icon(ikon, size: 18, color: fg),
            const SizedBox(width: 8),
            Expanded(child: Text(teks, style: TextStyle(color: fg, fontSize: 13, fontWeight: FontWeight.w700))),
            if (aksi != null && anak == null)
              TextButton(
                onPressed: aksi,
                style: TextButton.styleFrom(foregroundColor: fg, minimumSize: const Size(48, 40), padding: const EdgeInsets.symmetric(horizontal: 8)),
                child: Text(labelAksi ?? 'Coba lagi', style: const TextStyle(decoration: TextDecoration.underline)),
              ),
          ]),
          if (anak != null) ...[const SizedBox(height: 6), anak!],
        ]),
      ),
    );
  }
}

/// Ikon + label alat Claude Code (baris alat di chat dan riwayat sesi).
(IconData, String) alatTampil(String a) => switch (a) {
      'Read' => (Simbol.berkas, 'Membaca'),
      'Grep' => (Simbol.cari, 'Grep'),
      'Glob' => (Simbol.cari, 'Mencari berkas'),
      'Edit' || 'Write' || 'MultiEdit' || 'NotebookEdit' => (Simbol.ubah, 'Mengubah'),
      'Bash' => (Simbol.terminal, 'Bash'),
      'Task' || 'Agent' => (Simbol.tim, 'Divisi'),
      _ => (Simbol.info, a),
    };

/// Asal sesi (KONTRAK-apk-v2 §2.2 `asal`) → ikon + label.
(IconData, String) asalTampil(String asal) => switch (asal) {
      'vscode' => (Simbol.kode, 'VS Code'),
      'cli' => (Simbol.terminal, 'Terminal'),
      'pelaksana' => (Simbol.laptop, 'Pelaksana'),
      'hp' => (Simbol.hp, 'Dari HP'),
      _ => (Simbol.info, 'Lainnya'),
    };

/// Tombol oranye "Ya, kerjakan" dan merah "Hentikan".
ButtonStyle gayaKerjakan(WarnaPadev w) => FilledButton.styleFrom(backgroundColor: w.warnbtn, foregroundColor: w.onwarn);
ButtonStyle gayaBahaya(WarnaPadev w) => FilledButton.styleFrom(backgroundColor: w.err, foregroundColor: w.btnt);

/// Isi tombol: ikon + label.
class IsiTombol extends StatelessWidget {
  const IsiTombol(this.ikon, this.label, {super.key});
  final IconData ikon;
  final String label;
  @override
  Widget build(BuildContext context) =>
      Row(mainAxisSize: MainAxisSize.min, mainAxisAlignment: MainAxisAlignment.center, children: [
        Icon(ikon, size: 20),
        const SizedBox(width: 8),
        Flexible(child: Text(label, overflow: TextOverflow.ellipsis)),
      ]);
}

/// Segmen pilihan (Rencana⇄Kerjakan, Terang/Gelap/Sistem).
class Segmen<T> extends StatelessWidget {
  const Segmen({super.key, required this.pilihan, required this.nilai, required this.onUbah, this.label, this.nonaktif = const {}, this.sorot});
  final List<(T, IconData, String)> pilihan;
  final T nilai;
  final ValueChanged<T> onUbah;
  final String? label;
  final Set<T> nonaktif;

  /// Nilai yang disorot oranye saat terpilih (Kerjakan).
  final T? sorot;

  @override
  Widget build(BuildContext context) {
    final w = WarnaPadev.dari(context);
    return Semantics(
      label: label,
      container: true,
      child: Container(
        padding: const EdgeInsets.all(3),
        decoration: BoxDecoration(color: w.chip, borderRadius: BorderRadius.circular(12), border: Border.all(color: w.line)),
        child: Row(children: [
          for (final (v, ikon, teks) in pilihan)
            Expanded(
              child: _SegmenButir(
                ikon: ikon,
                teks: teks,
                terpilih: v == nilai,
                oranye: v == sorot,
                nonaktif: nonaktif.contains(v),
                onTap: () => onUbah(v),
              ),
            ),
        ]),
      ),
    );
  }
}

class _SegmenButir extends StatelessWidget {
  const _SegmenButir({required this.ikon, required this.teks, required this.terpilih, required this.oranye, required this.nonaktif, required this.onTap});
  final IconData ikon;
  final String teks;
  final bool terpilih, oranye, nonaktif;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final w = WarnaPadev.dari(context);
    final fg = nonaktif ? w.muted : (terpilih ? (oranye ? w.warnt : w.ink) : w.muted);
    final bg = terpilih ? (oranye ? w.warnb : w.panel) : Colors.transparent;
    return Semantics(
      button: true,
      selected: terpilih,
      enabled: !nonaktif,
      child: Material(
        color: bg,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(9),
          side: terpilih && oranye ? BorderSide(color: w.warn, width: 1.5) : BorderSide.none,
        ),
        child: InkWell(
          borderRadius: BorderRadius.circular(9),
          onTap: nonaktif ? null : onTap,
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 40),
            child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
              Icon(ikon, size: 16, color: fg),
              const SizedBox(width: 6),
              Flexible(
                child: Text(teks,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(color: fg, fontSize: 13, fontWeight: terpilih ? FontWeight.w800 : FontWeight.w600,
                        decoration: nonaktif ? TextDecoration.lineThrough : null)),
              ),
            ]),
          ),
        ),
      ),
    );
  }
}

/// Bingkai kerangka (memuat).
class Kerangka extends StatelessWidget {
  const Kerangka({super.key, required this.lebar, this.tinggi = 12, this.radius = 6});
  final double lebar, tinggi, radius;
  @override
  Widget build(BuildContext context) => Container(
        width: lebar,
        height: tinggi,
        decoration: BoxDecoration(color: WarnaPadev.dari(context).skel, borderRadius: BorderRadius.circular(radius)),
      );
}

/// Avatar inisial divisi (+ titik hijau bila bekerja).
class AvatarDivisi extends StatelessWidget {
  const AvatarDivisi({super.key, required this.nama, this.aktif = false, this.ukuran = 36});
  final String nama;
  final bool aktif;
  final double ukuran;

  @override
  Widget build(BuildContext context) {
    final w = WarnaPadev.dari(context);
    final inisial = nama.isEmpty ? '?' : nama.characters.first.toUpperCase();
    return ExcludeSemantics(
      child: SizedBox(
        width: ukuran,
        height: ukuran,
        child: Stack(children: [
          Container(
            width: ukuran,
            height: ukuran,
            alignment: Alignment.center,
            decoration: BoxDecoration(color: aktif ? w.accb : w.chip, shape: BoxShape.circle),
            child: Text(inisial, style: TextStyle(color: aktif ? w.accent : w.muted, fontWeight: FontWeight.w800, fontSize: ukuran * .38)),
          ),
          if (aktif)
            Positioned(
              right: 0,
              bottom: 0,
              child: Container(
                width: ukuran * .3,
                height: ukuran * .3,
                decoration: BoxDecoration(color: w.ok, shape: BoxShape.circle, border: Border.all(color: w.panel, width: 2)),
              ),
            ),
        ]),
      ),
    );
  }
}

/// Label bagian kecil di atas kelompok kartu.
class JudulBagian extends StatelessWidget {
  const JudulBagian(this.teks, {super.key});
  final String teks;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(4, 18, 4, 8),
        child: Semantics(header: true, child: Text(teks, style: TeksPadev.label(WarnaPadev.dari(context)))),
      );
}

/// Baris di dalam kartu pengaturan.
class BarisPengaturan extends StatelessWidget {
  const BarisPengaturan({super.key, this.ikon, required this.judul, this.sub, this.ekor, this.onTap, this.warnaJudul, this.subMono = false});
  final IconData? ikon;
  final String judul;
  final String? sub;
  final Widget? ekor;
  final VoidCallback? onTap;
  final Color? warnaJudul;
  final bool subMono;

  @override
  Widget build(BuildContext context) {
    final w = WarnaPadev.dari(context);
    final isi = ConstrainedBox(
      constraints: const BoxConstraints(minHeight: 52),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        child: Row(children: [
          if (ikon != null) ...[Icon(ikon, size: 20, color: warnaJudul ?? w.muted), const SizedBox(width: 12)],
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(judul, style: TextStyle(color: warnaJudul ?? w.ink, fontSize: 14, fontWeight: FontWeight.w600)),
              if (sub != null) ...[
                const SizedBox(height: 2),
                Text(sub!, style: subMono ? TeksPadev.mono(w.muted) : TeksPadev.redup(w, ukuran: 12)),
              ],
            ]),
          ),
          if (ekor != null) ...[const SizedBox(width: 8), ekor!],
        ]),
      ),
    );
    return onTap == null ? isi : InkWell(onTap: onTap, child: isi);
  }
}

/// Kartu berisi beberapa baris dipisah garis.
class KartuDaftar extends StatelessWidget {
  const KartuDaftar({super.key, required this.anak});
  final List<Widget> anak;
  @override
  Widget build(BuildContext context) {
    final w = WarnaPadev.dari(context);
    return Kartu(
      padding: EdgeInsets.zero,
      anak: Column(children: [
        for (var i = 0; i < anak.length; i++) ...[
          if (i > 0) Divider(height: 1, thickness: 1, color: w.line, indent: 14, endIndent: 14),
          anak[i],
        ],
      ]),
    );
  }
}

/// Isi kosong / galat di tengah layar.
class IsiKosong extends StatelessWidget {
  const IsiKosong({super.key, required this.ikon, required this.judul, this.teks, this.aksi});
  final IconData ikon;
  final String judul;
  final String? teks;
  final Widget? aksi;

  @override
  Widget build(BuildContext context) {
    final w = WarnaPadev.dari(context);
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 32),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Container(
          width: 52,
          height: 52,
          decoration: BoxDecoration(color: w.panel, shape: BoxShape.circle, border: Border.all(color: w.line)),
          child: Icon(ikon, color: w.ink, size: 24),
        ),
        const SizedBox(height: 14),
        Text(judul, textAlign: TextAlign.center, style: TextStyle(color: w.ink, fontSize: 16, fontWeight: FontWeight.w800)),
        if (teks != null) ...[
          const SizedBox(height: 6),
          Text(teks!, textAlign: TextAlign.center, style: TeksPadev.redup(w)),
        ],
        if (aksi != null) ...[const SizedBox(height: 16), aksi!],
      ]),
    );
  }
}

/// Garis judul lembar bawah (judul + teks).
Future<T?> bukaLembar<T>(BuildContext context, WidgetBuilder isi) => showModalBottomSheet<T>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (c) => Padding(
        padding: EdgeInsets.fromLTRB(20, 0, 20, 20 + MediaQuery.viewInsetsOf(c).bottom),
        child: SingleChildScrollView(child: isi(c)),
      ),
    );
