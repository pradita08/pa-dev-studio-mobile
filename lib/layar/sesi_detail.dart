// L11b Detail sesi (KONTRAK-apk-v2 §6.2, F1): riwayat per 50 (`cermin_riwayat`) + langsung (`cermin`) selama layar terbuka.
// Hemat (K-04): `cermin_buka` hanya saat layar ini terbuka & aplikasi aktif, kirim ulang 7,5 mnt; `cermin_tutup` saat keluar/latar.
// Celah `urut_cermin` → "Ada bagian yang hilang". Proyek tingkat ringkas → pesan/jawaban tanpa isi + keterangan.
// Kartu keputusan (F1b) sesi ini tampil paling bawah & bisa dijawab di sini. Tombol Lanjutkan (F3) belum ada.
// Semua teks luar via Text (A-E1).
import 'dart:async';

import 'package:flutter/material.dart';

import '../komponen/komponen.dart';
import '../kunci/kunci.dart';
import '../pratinjau/pita.dart';
import '../tema/token.dart';
import 'data.dart';
import 'keputusan.dart';

class LayarSesiDetail extends StatefulWidget {
  const LayarSesiDetail({super.key, required this.sumber, required this.sesi});
  final SumberData sumber;
  final SesiCermin sesi;

  @override
  State<LayarSesiDetail> createState() => _LayarSesiDetailState();
}

class _LayarSesiDetailState extends State<LayarSesiDetail> with WidgetsBindingObserver {
  bool _aktif = true;
  DateTime? _keLatar;
  Timer? _detik;   // sisa waktu kartu keputusan

  SumberData get s => widget.sumber;
  SesiCermin get x => s.cariSesi(widget.sesi.sesi) ?? widget.sesi;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _detik = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted && _keputusan().isNotEmpty) setState(() {});
    });
    NamaPegawai.muat().then((_) {
      if (mounted) setState(() {});
    });
    _mulai(halaman: true);
  }

  Future<void> _mulai({required bool halaman}) async {
    if (halaman) {
      s.muatRiwayatLokal(x.sesi);
      await _muat();
    }
    if (mounted && _aktif) await s.ikutiSesi(x);
  }

  Future<void> _muat({bool lebihLama = false}) async {
    try {
      await s.muatRiwayat(x, lebihLama: lebihLama);
    } on GalatKunci catch (e) {
      _pesan(pesanCermin(e.kode));
    }
  }

  void _pesan(String t) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(t)));
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState k) {
    if ((k == AppLifecycleState.paused || k == AppLifecycleState.hidden) && _aktif) {
      _aktif = false;
      _keLatar = DateTime.now();
      s.berhentiIkuti();
    } else if (k == AppLifecycleState.resumed && !_aktif) {
      _aktif = true;
      final lama = _keLatar != null && DateTime.now().difference(_keLatar!) > const Duration(minutes: 1);
      _mulai(halaman: lama); // kejadian selama di latar tidak dikirim → isi lubang dengan halaman terbaru
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _detik?.cancel();
    s.berhentiIkuti();
    super.dispose();
  }

  List<Keputusan> _keputusan() => s.keputusan.where((k) => k.sesi == widget.sesi.sesi && !k.kedaluwarsa).toList();

  @override
  Widget build(BuildContext context) => ListenableBuilder(listenable: s, builder: (c, _) => _bangun(c));

  Widget _bangun(BuildContext context) {
    final w = WarnaPadev.dari(context);
    final sesi = x;
    final r = s.riwayatSesi(sesi.sesi);
    final (ikonAsal, asal) = asalTampil(sesi.asal);
    final langsung = s.langsung(sesi.sesi);

    final kp = _keputusan();
    final atas = <Widget>[
      if (sesi.status == StatusSesi.menungguIzin && s.macTersambung != false && !kp.any((k) => !k.terkirim))
        const Spanduk(
          jenis: JenisSpanduk.peringatan,
          ikon: Simbol.tangan,
          teks: 'Claude menunggu izin di Mac. Kartu jawaban muncul di bawah bila Mac tidak dipakai ≥ 1 menit '
              '(atau bash siapkan-hp.sh --keputusan izinkan 0: semua pertanyaan ke HP).',
        ),
      if (!sesi.isi)
        const Spanduk(jenis: JenisSpanduk.netral, ikon: Simbol.tersembunyi, teks: 'Isi percakapan hanya untuk proyek yang dicentang di laptop'),
      if (s.macTersambung == false)
        Spanduk(
          jenis: JenisSpanduk.galat,
          ikon: Simbol.putus,
          teks: 'Mac tidak tersambung${s.macTerakhir == null ? '' : ' sejak ${jamMenit(s.macTerakhir!)}'}',
        )
      else if (s.galatLangsung != null)
        Spanduk(
          jenis: JenisSpanduk.peringatan,
          ikon: Simbol.langsung,
          teks: 'Pembaruan langsung tidak aktif · ${pesanCermin(s.galatLangsung!)}',
          aksi: s.bukaLangsungLagi,
        ),
    ];

    return Scaffold(
      backgroundColor: w.bg,
      appBar: AppBar(
        backgroundColor: w.panel,
        foregroundColor: w.ink,
        surfaceTintColor: Colors.transparent,
        titleSpacing: 0,
        leading: IconButton(icon: const Icon(Simbol.kembali), tooltip: 'Kembali', onPressed: () => Navigator.of(context).maybePop()),
        title: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(sesi.judul.isEmpty ? 'Sesi tanpa judul' : sesi.judul,
              maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(color: w.ink, fontSize: 16.5, fontWeight: FontWeight.w800)),
          Row(children: [
            Icon(ikonAsal, size: 13, color: w.muted),
            const SizedBox(width: 4),
            Flexible(
              child: Text('${s.namaProyek(sesi.proyek)} · ${namaAkun(sesi.akun)} · $asal',
                  maxLines: 1, overflow: TextOverflow.ellipsis, style: TeksPadev.redup(w, ukuran: 12)),
            ),
          ]),
        ]),
        actions: [Padding(padding: const EdgeInsets.only(right: 12), child: ChipPadev.sesi(context, sesi.status))],
        bottom: PreferredSize(preferredSize: const Size.fromHeight(1), child: Divider(height: 1, color: w.line)),
      ),
      body: SafeArea(
        top: false,
        child: Column(children: [
          if (s.pratinjau) PitaPratinjau(sumber: s),
          _BarisKeadaan(langsung: langsung, sesi: sesi, riwayat: r),
          for (final a in atas) Padding(padding: const EdgeInsets.fromLTRB(12, 8, 12, 0), child: a),
          Expanded(child: _isi(context, w, sesi, r, kp)),
        ]),
      ),
    );
  }

  Widget _isi(BuildContext context, WarnaPadev w, SesiCermin sesi, RiwayatSesi r, List<Keputusan> kp) {
    final kartu = [
      for (final k in kp) Padding(padding: const EdgeInsets.only(top: 10), child: KartuKeputusan(key: ValueKey('kp-${k.id}'), sumber: s, k: k)),
    ];
    if (r.entri.isEmpty && kartu.isNotEmpty) {
      return ListView(reverse: true, padding: const EdgeInsets.fromLTRB(12, 2, 12, 16), children: kartu);
    }
    if (r.entri.isEmpty) {
      if (r.galat != null) {
        return Center(
          child: SingleChildScrollView(
            child: IsiKosong(
              ikon: Simbol.galatLingkar,
              judul: 'Riwayat tidak bisa dimuat',
              teks: pesanCermin(r.galat!, riwayat: true),
              aksi: OutlinedButton(onPressed: r.memuat ? null : _muat, child: const IsiTombol(Simbol.segarkan, 'Coba lagi')),
            ),
          ),
        );
      }
      if (r.memuat || !r.halamanDiterima) {
        return Center(
          child: Semantics(
            liveRegion: true,
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              const CircularProgressIndicator(),
              const SizedBox(height: 14),
              Text(r.lambat ? 'Mac belum menjawab. Pastikan pelaksana berjalan.' : 'Memuat riwayat sesi…', style: TeksPadev.redup(w)),
            ]),
          ),
        );
      }
      return const Center(
        child: SingleChildScrollView(child: IsiKosong(ikon: Simbol.obrolan, judul: 'Belum ada percakapan di sesi ini')),
      );
    }
    final n = r.entri.length, m = kartu.length;
    return ListView.builder(
      reverse: true,
      padding: const EdgeInsets.fromLTRB(12, 12, 12, 16),
      itemCount: m + n + 1,
      itemBuilder: (c, j) {
        if (j < m) return kartu[j];   // keputusan sesi ini: paling bawah
        final i = j - m;
        if (i == n) return _KepalaRiwayat(riwayat: r, onMuat: () => _muat(lebihLama: true));
        return Padding(padding: const EdgeInsets.only(top: 8), child: ButirEntriSesi(entri: r.entri[n - 1 - i]));
      },
    );
  }
}

class _BarisKeadaan extends StatelessWidget {
  const _BarisKeadaan({required this.langsung, required this.sesi, required this.riwayat});
  final bool langsung;
  final SesiCermin sesi;
  final RiwayatSesi riwayat;

  @override
  Widget build(BuildContext context) {
    final w = WarnaPadev.dari(context);
    final String teks;
    final Color warna;
    if (langsung) {
      teks = 'Langsung · pembaruan dari laptop';
      warna = w.accent;
    } else if (sesi.status == StatusSesi.selesai && !sesi.terbuka) {
      teks = 'Sesi sudah selesai';
      warna = w.muted;
    } else {
      teks = 'Tidak langsung';
      warna = w.muted;
    }
    return Container(
      width: double.infinity,
      color: w.panel,
      padding: const EdgeInsets.fromLTRB(14, 6, 14, 7),
      child: Semantics(
        liveRegion: true,
        child: Row(children: [
          Icon(Simbol.langsung, size: 15, color: warna),
          const SizedBox(width: 6),
          Expanded(
            child: Text(
              riwayat.dariLokal && riwayat.lokalDiperbarui != null ? '$teks · tersimpan di HP ${jamMenit(riwayat.lokalDiperbarui!)}' : teks,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(color: warna, fontSize: 12.5, fontWeight: FontWeight.w700),
            ),
          ),
          PenandaTingkatKecil(isi: sesi.isi),
        ]),
      ),
    );
  }
}

/// Penanda tingkat ringkas/isi (versi baris keadaan).
class PenandaTingkatKecil extends StatelessWidget {
  const PenandaTingkatKecil({super.key, required this.isi});
  final bool isi;
  @override
  Widget build(BuildContext context) {
    final w = WarnaPadev.dari(context);
    return Row(mainAxisSize: MainAxisSize.min, children: [
      Icon(isi ? Simbol.obrolan : Simbol.tersembunyi, size: 13, color: w.muted),
      const SizedBox(width: 3),
      Text(isi ? 'Isi' : 'Ringkas', style: TextStyle(color: w.muted, fontSize: 12, fontWeight: FontWeight.w700)),
    ]);
  }
}

class _KepalaRiwayat extends StatelessWidget {
  const _KepalaRiwayat({required this.riwayat, required this.onMuat});
  final RiwayatSesi riwayat;
  final VoidCallback onMuat;
  @override
  Widget build(BuildContext context) {
    final w = WarnaPadev.dari(context);
    final r = riwayat;
    if (r.memuat) {
      return const Padding(padding: EdgeInsets.all(12), child: Center(child: SizedBox(width: 24, height: 24, child: CircularProgressIndicator(strokeWidth: 2.5))));
    }
    if (r.lagi) {
      return Center(
        child: TextButton(onPressed: onMuat, child: const IsiTombol(Simbol.atas, 'Muat 50 entri sebelumnya')),
      );
    }
    if (!r.halamanDiterima) return const SizedBox(height: 8);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Center(child: Text('Awal riwayat', style: TeksPadev.redup(w, ukuran: 12))),
    );
  }
}

String _waktu(DateTime? t) {
  if (t == null) return '';
  final k = DateTime.now();
  final hariIni = t.year == k.year && t.month == k.month && t.day == k.day;
  return hariIni ? jamMenit(t) : '${tanggalPendek(t)} ${jamMenit(t)}';
}

/// Satu entri riwayat/langsung.
class ButirEntriSesi extends StatelessWidget {
  const ButirEntriSesi({super.key, required this.entri});
  final EntriSesi entri;

  @override
  Widget build(BuildContext context) {
    final w = WarnaPadev.dari(context);
    final e = entri;
    final lebar = MediaQuery.sizeOf(context).width;
    final waktu = _waktu(e.waktu);

    Widget meta(String siapa, {required bool kanan}) => Padding(
          padding: EdgeInsets.only(top: 3, left: kanan ? 0 : 2, right: kanan ? 2 : 0),
          child: Text(waktu.isEmpty ? siapa : '$siapa · $waktu', style: TeksPadev.redup(w, ukuran: 11)),
        );

    Widget tanpaIsi(IconData ikon, String teks, {required bool kanan}) => Align(
          alignment: kanan ? Alignment.centerRight : Alignment.centerLeft,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(color: w.chip, borderRadius: BorderRadius.circular(10), border: Border.all(color: w.line)),
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              Icon(ikon, size: 14, color: w.muted),
              const SizedBox(width: 6),
              Text(waktu.isEmpty ? teks : '$teks · $waktu', style: TextStyle(color: w.muted, fontSize: 12.5, fontStyle: FontStyle.italic)),
            ]),
          ),
        );

    Widget baris(IconData ikon, Color warna, List<InlineSpan> isi) => Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Padding(padding: const EdgeInsets.only(top: 1), child: Icon(ikon, size: 15, color: warna)),
          const SizedBox(width: 6),
          Expanded(child: Text.rich(TextSpan(style: TextStyle(color: warna, fontSize: 12.5, height: 1.35), children: isi))),
          if (waktu.isNotEmpty) ...[const SizedBox(width: 6), Text(waktu, style: TeksPadev.redup(w, ukuran: 11))],
        ]);

    switch (e.peran) {
      case PeranEntri.owner:
        if (e.teks == null) return tanpaIsi(Simbol.orang, 'Pesan Anda', kanan: true);
        return Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
          ConstrainedBox(
            constraints: BoxConstraints(maxWidth: lebar * .8),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
              decoration: BoxDecoration(
                color: w.btn,
                borderRadius: const BorderRadius.only(
                    topLeft: Radius.circular(14), topRight: Radius.circular(14), bottomLeft: Radius.circular(14), bottomRight: Radius.circular(4)),
              ),
              child: Text(e.teks!, style: TextStyle(color: w.btnt, fontSize: 14, height: 1.4)),
            ),
          ),
          meta('Anda', kanan: true),
        ]);
      case PeranEntri.claude:
        if (e.teks == null) return tanpaIsi(Simbol.claude, 'Jawaban Claude', kanan: false);
        return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          ConstrainedBox(
            constraints: BoxConstraints(maxWidth: lebar * .86),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                color: w.panel,
                border: Border.all(color: w.line),
                borderRadius: const BorderRadius.only(
                    topLeft: Radius.circular(14), topRight: Radius.circular(14), bottomRight: Radius.circular(14), bottomLeft: Radius.circular(4)),
              ),
              child: Text(e.teks!, style: TextStyle(color: w.ink, fontSize: 14, height: 1.45)),
            ),
          ),
          meta('Claude', kanan: false),
        ]);
      case PeranEntri.alat:
        final (ikon, label) = alatTampil(e.alat ?? 'Alat');
        final ubah = label == 'Mengubah';
        final warna = e.gagal ? w.err : (ubah ? w.warnt : w.muted);
        return baris(e.gagal ? Simbol.galatLingkar : ikon, warna, [
          TextSpan(text: e.gagal ? '$label · gagal' : '$label · '),
          if (!e.gagal && (e.ringkas ?? '').isNotEmpty) TextSpan(text: e.ringkas, style: TeksPadev.mono(warna)),
        ]);
      case PeranEntri.divisi:
        return baris(Simbol.tim, w.ink, [
          TextSpan(text: NamaPegawai.label(e.divisi ?? 'divisi'), style: const TextStyle(fontWeight: FontWeight.w800)),
          if ((e.alat ?? '').isNotEmpty) TextSpan(text: ' ${e.alat}'),
          if ((e.ringkas ?? '').isNotEmpty) TextSpan(text: ' · ${e.ringkas}', style: TextStyle(color: w.muted)),
        ]);
      case PeranEntri.izin:
        return baris(Simbol.tangan, w.warnt, [
          const TextSpan(text: 'Menunggu izin di laptop', style: TextStyle(fontWeight: FontWeight.w700)),
          if ((e.alat ?? '').isNotEmpty) TextSpan(text: ' · ${e.alat}'),
          if ((e.ringkas ?? '').isNotEmpty) TextSpan(text: ' · ${e.ringkas}'),
        ]);
      case PeranEntri.sistem:
        return Center(
          child: Text(
            waktu.isEmpty ? (e.teks ?? e.ringkas ?? '') : '${e.teks ?? e.ringkas ?? ''} · $waktu',
            textAlign: TextAlign.center,
            style: TeksPadev.redup(w, ukuran: 12),
          ),
        );
      case PeranEntri.celah:
        return Center(
          child: Semantics(
            liveRegion: true,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
              decoration: BoxDecoration(color: w.warnb, borderRadius: BorderRadius.circular(99)),
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                Icon(Simbol.peringatan, size: 14, color: w.warnt),
                const SizedBox(width: 5),
                Text('Ada bagian yang hilang', style: TextStyle(color: w.warnt, fontSize: 12, fontWeight: FontWeight.w700)),
              ]),
            ),
          ),
        );
    }
  }
}
