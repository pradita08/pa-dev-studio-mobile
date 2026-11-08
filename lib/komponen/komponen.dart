// Komponen bersama PADEV Studio (rancangan owner "Komponen", docs/desain-apk). Semua warna dari WarnaPadev (DESAIN §1).
import 'dart:async';
import 'dart:isolate';
import 'dart:math' show max;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:markdown/markdown.dart' as md;

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

// ---------------------------------------------------------------------------------------------------- G8: angka & grafik (Rekap, Kantor)

/// Kotak angka ringkas (Rekap): label redup, angka besar, keterangan opsional.
class KartuAngka extends StatelessWidget {
  const KartuAngka({super.key, required this.label, required this.nilai, this.sub});
  final String label, nilai;
  final String? sub;

  @override
  Widget build(BuildContext context) {
    final w = WarnaPadev.dari(context);
    return Kartu(
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
      anak: Semantics(
        label: '$label $nilai${sub == null ? '' : ', $sub'}',
        excludeSemantics: true,
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label, style: TeksPadev.label(w)),
          const SizedBox(height: 4),
          Text(nilai, style: TextStyle(color: w.ink, fontSize: 22, fontWeight: FontWeight.w800, height: 1.2)),
          if (sub != null) Text(sub!, maxLines: 1, overflow: TextOverflow.ellipsis, style: TeksPadev.redup(w, ukuran: 12)),
        ]),
      ),
    );
  }
}

/// Grafik batang sederhana tanpa paket (satu seri accent, kontras ≥ 3:1 di atas panel). Ketuk batang = nilainya tampil di atas grafik.
/// Pembaca layar mendapat [semantik] (daftar nilai), batang tidak dibacakan satu per satu.
class GrafikBatang extends StatefulWidget {
  const GrafikBatang({super.key, required this.nilai, required this.label, required this.semantik, this.tinggi = 120});
  final List<int> nilai;
  final List<String> label;
  final String semantik;
  final double tinggi;

  @override
  State<GrafikBatang> createState() => _GrafikBatangState();
}

class _GrafikBatangState extends State<GrafikBatang> {
  int? _pilih;

  @override
  Widget build(BuildContext context) {
    final w = WarnaPadev.dari(context);
    final n = widget.nilai;
    if (n.isEmpty) return const SizedBox.shrink();
    final maks = n.fold(0, max);
    final i = (_pilih ?? n.length - 1).clamp(0, n.length - 1);
    return Semantics(
      label: widget.semantik,
      container: true,
      child: ExcludeSemantics(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text('${widget.label[i]}: ${tokenBaca(n[i])} token', style: TextStyle(color: w.ink, fontSize: 13, fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          SizedBox(
            height: widget.tinggi,
            child: Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
              for (final (j, v) in n.indexed)
                Expanded(
                  child: GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onTap: () => setState(() => _pilih = j),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 3),
                      child: Align(
                        alignment: Alignment.bottomCenter,
                        child: FractionallySizedBox(
                          heightFactor: maks == 0 ? 0 : v / maks,
                          child: Container(
                            decoration: BoxDecoration(
                              color: w.accent,
                              borderRadius: const BorderRadius.vertical(top: Radius.circular(4)),
                              border: j == i ? Border.all(color: w.ink, width: 2) : null,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
            ]),
          ),
          Container(height: 1, color: w.line),
          const SizedBox(height: 4),
          Row(children: [
            for (final (j, l) in widget.label.indexed)
              Expanded(
                child: Text(l,
                    textAlign: TextAlign.center,
                    maxLines: 1,
                    overflow: TextOverflow.clip,
                    style: TextStyle(color: j == i ? w.ink : w.muted, fontSize: 11, fontWeight: j == i ? FontWeight.w800 : FontWeight.w500)),
              ),
          ]),
        ]),
      ),
    );
  }
}

/// Baris peringkat: nama | batang (lebar relatif [maks]) | angka token.
class BarisBatang extends StatelessWidget {
  const BarisBatang({super.key, required this.nama, required this.nilai, required this.maks, this.awal});
  final String nama;
  final int nilai, maks;
  final Widget? awal;

  @override
  Widget build(BuildContext context) {
    final w = WarnaPadev.dari(context);
    return Semantics(
      label: '$nama, ${tokenBaca(nilai)} token',
      excludeSemantics: true,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(children: [
          if (awal != null) ...[awal!, const SizedBox(width: 8)],
          SizedBox(
            width: 104,
            child: Text(nama, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(color: w.ink, fontSize: 13, fontWeight: FontWeight.w600)),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Container(
              height: 8,
              alignment: Alignment.centerLeft,
              decoration: BoxDecoration(color: w.chip, borderRadius: BorderRadius.circular(99)),
              child: FractionallySizedBox(
                widthFactor: maks <= 0 ? 0 : (nilai / maks).clamp(0, 1),
                child: Container(decoration: BoxDecoration(color: w.accent, borderRadius: BorderRadius.circular(99))),
              ),
            ),
          ),
          const SizedBox(width: 8),
          SizedBox(
            width: 58,
            child: Text(tokenBaca(nilai),
                textAlign: TextAlign.right,
                style: TextStyle(color: w.ink, fontSize: 12.5, fontWeight: FontWeight.w700, fontFeatures: const [FontFeature.tabularFigures()])),
          ),
        ]),
      ),
    );
  }
}

/// 7 batang mini (token harian di kartu agen); hiasan — angkanya dibacakan oleh kartu induk.
class BatangMini extends StatelessWidget {
  const BatangMini(this.nilai, {super.key});
  final List<int> nilai;

  @override
  Widget build(BuildContext context) {
    final w = WarnaPadev.dari(context);
    final maks = nilai.fold(0, max);
    return ExcludeSemantics(
      child: SizedBox(
        height: 20,
        child: Row(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
          for (final v in nilai)
            Padding(
              padding: const EdgeInsets.only(right: 2),
              child: Container(width: 5, height: maks == 0 ? 1 : max(1, 20 * v / maks), color: v > 0 ? w.accent : w.line),
            ),
        ]),
      ),
    );
  }
}

// ---------------------------------------------------------------------------------------------------- G8: jawaban Claude (markdown)

/// Batas syarat paket markdown (Willy, brief G8-bangun 1-8).
const batasUraiMarkdown = 8000;
const _batasKedalaman = 12;
const _lipatBaris = 18;

/// SEC-167: tabel disusun di isolat dengan batas ini; lewat batas → seluruh jawaban teks polos.
const _maksKolom = 20, _maksBarisTabel = 200, _maksTeksTabel = 16000;

/// Urai markdown untuk [TeksClaude] (dijalankan di isolate). null = tampilkan teks polos (terlalu panjang / terlalu dalam / tabel terlalu besar).
/// Set ekstensi sempit (DILARANG gitHubFlavored/gitHubWeb/commonMark); encodeHtml: false karena dirender ke widget, bukan HTML.
/// Tabel diganti `pre` berisi teks mono rata kolom di sini juga, supaya thread UI tidak ikut menyusunnya.
List<md.Node>? uraiMarkdown(String teks) {
  if (teks.length > batasUraiMarkdown) return null;
  final ast = md.Document(
    extensionSet: md.ExtensionSet(const [md.FencedCodeBlockSyntax(), md.TableSyntax()], [md.StrikethroughSyntax()]),
    encodeHtml: false,
  ).parse(teks);
  // node di daftar berkedalaman d (tingkat atas = 1), dihitung iteratif
  final tumpuk = <(List<md.Node>, int)>[(ast, 1)];
  while (tumpuk.isNotEmpty) {
    final (daftar, d) = tumpuk.removeLast();
    if (d > _batasKedalaman) return null;
    for (var i = 0; i < daftar.length; i++) {
      final n = daftar[i];
      if (n is! md.Element) continue;
      if (n.tag == 'table') {
        final t = teksTabel(n);
        if (t == null) return null;
        daftar[i] = md.Element('pre', [md.Text(t)]);
      } else if (n.children case final c?) {
        tumpuk.add((c, d + 1));
      }
    }
  }
  return ast;
}

/// Tabel markdown → teks mono rata kolom (ASCII). null bila > 20 kolom, > 200 baris, atau hasil > 16.000 huruf (dihitung sebelum disusun).
@visibleForTesting
String? teksTabel(md.Element e) {
  final baris = <List<String>>[];
  final tumpuk = <md.Node>[e];
  while (tumpuk.isNotEmpty) {
    final n = tumpuk.removeLast();
    if (n is! md.Element) continue;
    if (n.tag == 'tr') {
      final sel = n.children ?? const <md.Node>[];
      if (sel.length > _maksKolom || baris.length >= _maksBarisTabel) return null;
      baris.add([for (final c in sel) c.textContent.trim()]);
    } else {
      tumpuk.addAll((n.children ?? const <md.Node>[]).reversed);
    }
  }
  if (baris.isEmpty) return '';
  final kol = baris.fold(0, (a, b) => max(a, b.length));
  final lebar = [for (var i = 0; i < kol; i++) baris.fold(0, (a, b) => i < b.length ? max(a, b[i].length) : a)];
  final perBaris = lebar.fold(0, (a, b) => a + b) + 3 * (kol - 1) + 1;
  if (perBaris * (baris.length + 1) > _maksTeksTabel) return null;
  final keluar = [
    for (final b in baris) [for (var i = 0; i < kol; i++) (i < b.length ? b[i] : '').padRight(lebar[i])].join(' | ').trimRight(),
  ];
  if (keluar.length > 1) keluar.insert(1, [for (final l in lebar) '-' * l].join('-+-'));
  return keluar.join('\n');
}

/// Isi isolat urai (fungsi tingkat atas: closure di metode State ikut membawa `this` dan tidak bisa dikirim).
void _kerjaUrai((SendPort, String) a) => Isolate.exit(a.$1, uraiMarkdown(a.$2));

/// Jawaban Claude: subset markdown dirender ke widget (daftar izin tag; `a`/`img` hanya teks/alt, tanpa tautan/gambar/jaringan;
/// HTML mentah tampil sebagai teks). Selama urai berjalan, gagal, atau melewati batas → teks polos. Bisa dipilih/disalin
/// (SelectionArea). > 18 baris dilipat bila [lipat]. Jangan dipakai untuk teks yang masih mengalir (syarat 7: tampilkan polos).
class TeksClaude extends StatefulWidget {
  const TeksClaude(this.teks, {super.key, this.lipat = true});
  final String teks;
  final bool lipat;

  @override
  State<TeksClaude> createState() => _TeksClaudeState();
}

class _TeksClaudeState extends State<TeksClaude> {
  List<md.Node>? _ast;
  int _urutan = 0;
  Timer? _batas;
  Isolate? _isolat;
  bool _buka = false;

  @override
  void initState() {
    super.initState();
    _urai();
  }

  @override
  void didUpdateWidget(TeksClaude lama) {
    super.didUpdateWidget(lama);
    if (lama.teks != widget.teks) _urai();
  }

  @override
  void dispose() {
    _henti();
    _urutan++;
    super.dispose();
  }

  void _henti() {
    _batas?.cancel();
    _isolat?.kill(priority: Isolate.immediate);
    _isolat = null;
  }

  Future<void> _urai() async {
    _ast = null;
    _henti();
    final ke = ++_urutan, teks = widget.teks;
    if (teks.isEmpty || teks.length > batasUraiMarkdown) return; // syarat 4: polos tanpa urai
    final port = ReceivePort();
    // syarat 5 + QA-3: lewat batas waktu → isolat dihentikan, tetap polos (Timer milik State: dibatalkan saat dispose)
    _batas = Timer(const Duration(seconds: 3), () {
      _urutan++;
      _henti();
      port.close();
    });
    try {
      final iso = await Isolate.spawn(_kerjaUrai, (port.sendPort, teks), onError: port.sendPort, onExit: port.sendPort);
      if (ke != _urutan) {
        iso.kill(priority: Isolate.immediate);
        return;
      }
      _isolat = iso;
      final hasil = await port.first; // AST, null (polos), atau galat isolat (List) → hanya AST yang dipakai
      if (mounted && ke == _urutan && hasil is List<md.Node>) setState(() => _ast = hasil);
    } on Object catch (_) {
      // urai/isolat gagal atau port ditutup batas waktu → tetap teks polos
    } finally {
      if (ke == _urutan) _henti();
      port.close();
    }
  }

  @override
  Widget build(BuildContext context) {
    final w = WarnaPadev.dari(context);
    final gaya = TextStyle(color: w.ink, fontSize: 14, height: 1.45);
    final ast = _ast;
    Widget isi = ast == null ? Text(widget.teks, style: gaya) : _Md(w).blok(ast, gaya);
    final baris = '\n'.allMatches(widget.teks).length + 1;
    final lipat = widget.lipat && baris > _lipatBaris;
    if (lipat && !_buka) {
      isi = ConstrainedBox(
        constraints: BoxConstraints(maxHeight: MediaQuery.textScalerOf(context).scale(14) * 1.45 * _lipatBaris),
        child: SingleChildScrollView(physics: const NeverScrollableScrollPhysics(), child: isi),
      );
    }
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
      SelectionArea(child: isi),
      if (lipat)
        Align(
          alignment: Alignment.centerLeft,
          child: TextButton.icon(
            onPressed: () => setState(() => _buka = !_buka),
            icon: Icon(_buka ? Simbol.atas : Simbol.bawah, size: 18),
            label: Text(_buka ? 'Lipat' : 'Tampilkan semua ($baris baris)'),
          ),
        ),
    ]);
  }
}

const _tagBlok = {'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'pre', 'hr', 'table'};

/// Penerjemah AST → widget (rekursi aman: kedalaman sudah dibatasi [uraiMarkdown]).
class _Md {
  const _Md(this.w);
  final WarnaPadev w;

  Widget blok(List<md.Node> nodes, TextStyle g) {
    final anak = <Widget>[];
    var sebaris = <md.Node>[];
    void tutup() {
      if (sebaris.isEmpty) return;
      anak.add(Text.rich(TextSpan(children: spans(sebaris, g))));
      sebaris = [];
    }

    for (final n in nodes) {
      if (n is md.Element && _tagBlok.contains(n.tag)) {
        tutup();
        anak.add(satu(n, g));
      } else {
        sebaris.add(n);
      }
    }
    tutup();
    if (anak.length == 1) return anak.first;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      for (final (i, a) in anak.indexed) i == 0 ? a : Padding(padding: const EdgeInsets.only(top: 8), child: a),
    ]);
  }

  Widget satu(md.Element e, TextStyle g) {
    final anak = e.children ?? const <md.Node>[];
    switch (e.tag) {
      case 'h1' || 'h2' || 'h3' || 'h4' || 'h5' || 'h6':
        final uk = switch (e.tag) { 'h1' => 18.0, 'h2' => 16.5, _ => 15.0 };
        return Semantics(header: true, child: Text.rich(TextSpan(children: spans(anak, g.copyWith(fontSize: uk, fontWeight: FontWeight.w800, height: 1.3)))));
      case 'ul' || 'ol':
        final butir = [for (final c in anak) if (c is md.Element && c.tag == 'li') c];
        return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          for (final (i, li) in butir.indexed)
            Padding(
              padding: EdgeInsets.only(top: i == 0 ? 0 : 4),
              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                SizedBox(width: 20, child: Text(e.tag == 'ol' ? '${i + 1}.' : '•', style: g.copyWith(color: w.muted))),
                Expanded(child: blok(li.children ?? const [], g)),
              ]),
            ),
        ]);
      case 'li':
        return blok(anak, g);
      case 'blockquote':
        return Container(
          padding: const EdgeInsets.only(left: 10),
          decoration: BoxDecoration(border: Border(left: BorderSide(color: w.line, width: 3))),
          child: blok(anak, g.copyWith(color: w.muted)),
        );
      case 'pre':
        return BlokKode(e.textContent.replaceFirst(RegExp(r'\n$'), ''));
      case 'hr':
        return Divider(height: 9, color: w.line);
      default: // 'p'
        return Text.rich(TextSpan(children: spans(anak, g)));
    }
  }

  List<InlineSpan> spans(List<md.Node>? nodes, TextStyle g) => [
        for (final n in nodes ?? const <md.Node>[])
          if (n is md.Element)
            switch (n.tag) {
              'strong' => TextSpan(children: spans(n.children, g.copyWith(fontWeight: FontWeight.w800))),
              'em' => TextSpan(children: spans(n.children, g.copyWith(fontStyle: FontStyle.italic))),
              'del' => TextSpan(children: spans(n.children, g.copyWith(decoration: TextDecoration.lineThrough))),
              'code' => TextSpan(text: n.textContent, style: TeksPadev.mono(w.ink, ukuran: (g.fontSize ?? 14) - 1).copyWith(backgroundColor: w.chip)),
              'br' => TextSpan(text: '\n', style: g),
              'img' => TextSpan(text: n.attributes['alt'] ?? '', style: g),
              _ => TextSpan(children: spans(n.children, g)), // 'a' & tag lain: teksnya saja (tanpa tautan/recognizer)
            }
          else
            TextSpan(text: n.textContent, style: g),
      ];
}

/// Blok kode / tabel: mono, digulir mendatar (tidak dilipat per kata), tombol Salin.
class BlokKode extends StatelessWidget {
  const BlokKode(this.teks, {super.key});
  final String teks;

  @override
  Widget build(BuildContext context) {
    final w = WarnaPadev.dari(context);
    return Container(
      decoration: BoxDecoration(color: w.chip, borderRadius: BorderRadius.circular(10), border: Border.all(color: w.line)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Align(
          alignment: Alignment.centerRight,
          child: SelectionContainer.disabled(
            child: TextButton.icon(
              style: TextButton.styleFrom(foregroundColor: w.muted, minimumSize: const Size(48, 40), padding: const EdgeInsets.symmetric(horizontal: 10)),
              onPressed: () async {
                await Clipboard.setData(ClipboardData(text: teks));
                if (context.mounted) ScaffoldMessenger.maybeOf(context)?.showSnackBar(const SnackBar(content: Text('Disalin')));
              },
              icon: const Icon(Simbol.salin, size: 16),
              label: const Text('Salin'),
            ),
          ),
        ),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
          child: Text(teks, softWrap: false, style: TeksPadev.mono(w.ink, ukuran: 12.5).copyWith(height: 1.45)),
        ),
      ]),
    );
  }
}

/// Ringkasan langkah alat (chat & detail sesi): satu baris "N langkah · M mengubah", ketuk = daftar lengkap.
class RingkasLangkah extends StatefulWidget {
  const RingkasLangkah({super.key, required this.langkah, this.berjalan = false});

  /// (nama alat Claude Code, ringkasan, gagal)
  final List<(String, String, bool)> langkah;

  /// Tugas masih bekerja: langkah terakhir tampil langsung di bawah ringkasan.
  final bool berjalan;

  @override
  State<RingkasLangkah> createState() => _RingkasLangkahState();
}

class _RingkasLangkahState extends State<RingkasLangkah> {
  bool _buka = false;

  Widget _baris(WarnaPadev w, (String, String, bool) l) {
    final (alat, ringkas, gagal) = l;
    final (ikon, label) = alatTampil(alat);
    final warna = gagal ? w.err : label == 'Mengubah' ? w.warnt : w.muted;
    return Padding(
      padding: const EdgeInsets.only(top: 4),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Icon(gagal ? Simbol.galatLingkar : ikon, size: 15, color: warna),
        const SizedBox(width: 6),
        Expanded(
          child: Text.rich(TextSpan(children: [
            TextSpan(text: gagal ? '$label · gagal' : '$label · ', style: TextStyle(color: warna, fontSize: 12.5)),
            if (!gagal && ringkas.isNotEmpty) TextSpan(text: ringkas, style: TeksPadev.mono(warna)),
          ])),
        ),
      ]),
    );
  }

  @override
  Widget build(BuildContext context) {
    final w = WarnaPadev.dari(context);
    final l = widget.langkah;
    final ubah = l.where((x) => alatTampil(x.$1).$2 == 'Mengubah').length;
    final gagal = l.where((x) => x.$3).length;
    final judul = ['${l.length} langkah', if (ubah > 0) '$ubah mengubah', if (gagal > 0) '$gagal gagal'].join(' · ');
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
      Semantics(
        button: true,
        label: '$judul. ${_buka ? 'Sembunyikan' : 'Tampilkan'} daftar langkah',
        excludeSemantics: true,
        child: InkWell(
          borderRadius: BorderRadius.circular(8),
          onTap: () => setState(() => _buka = !_buka),
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 44),
            child: Row(children: [
              Icon(Simbol.pengaturan, size: 15, color: w.muted),
              const SizedBox(width: 6),
              Expanded(child: Text(judul, style: TextStyle(color: w.muted, fontSize: 12.5, fontWeight: FontWeight.w700))),
              Icon(_buka ? Simbol.atas : Simbol.bawah, size: 18, color: w.muted),
            ]),
          ),
        ),
      ),
      if (_buka)
        for (final x in l) _baris(w, x)
      else if (widget.berjalan && l.isNotEmpty)
        _baris(w, l.last),
    ]);
  }
}
