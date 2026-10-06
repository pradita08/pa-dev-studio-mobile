// L02 Pasangkan (kontrak §3, DESAIN §3.3): penjelasan → kamera QR → mengirim → kode 6 digit + menunggu `ya` di Mac → hasil.
// Tidak ada tombol "Cocok, lanjutkan": persetujuan terjadi di Mac. Isi QR mentah diteruskan ke Kotlin (Kunci.mulaiPasang).
// Kamera = layar native Kotlin (Kunci.pindaiQr, CameraX + ZXing offline; kontrak v1.1 §7, SEC-77). Dart tidak memegang kamera;
// kamera mati & layar pindai tertutup saat aplikasi ke latar (SEC-76).
import 'dart:async';

import 'package:flutter/material.dart';

import '../komponen/komponen.dart';
import '../kunci/kunci.dart';
import '../tema/token.dart';

enum _Langkah { penjelasan, mengirim, menunggu, disetujui, ditolak, galat }

class LayarPasang extends StatefulWidget {
  const LayarPasang({super.key, this.awal, required this.onTerpasang, this.onPratinjau});

  /// Status tersimpan saat layar dibuka (menunggu/ditolak) — melanjutkan dari sana.
  final StatusPasang? awal;
  final VoidCallback onTerpasang;

  /// Hanya diisi di build debug/profile (!kReleaseMode) oleh AkarAplikasi.
  final VoidCallback? onPratinjau;

  @override
  State<LayarPasang> createState() => _LayarPasangState();
}

class _LayarPasangState extends State<LayarPasang> {
  _Langkah _langkah = _Langkah.penjelasan;
  String? _kode, _namaMac, _galat;
  bool _memindai = false;
  Timer? _tanya;
  DateTime? _mulaiTunggu;

  @override
  void initState() {
    super.initState();
    final a = widget.awal;
    if (a?.status == 'menunggu') {
      _kode = a!.kodeSas;
      _namaMac = a.namaMac;
      _langkah = _Langkah.menunggu;
      _mulaiTunggu = DateTime.now();
      _mulaiTanya();
    } else if (a?.status == 'ditolak') {
      _namaMac = a!.namaMac;
      _langkah = _Langkah.ditolak;
    }
  }

  @override
  void dispose() {
    _tanya?.cancel();
    super.dispose();
  }

  /// Buka pemindai native; batal/latar/terkunci → tetap di penjelasan.
  Future<void> _pindai() async {
    if (_memindai || _langkah != _Langkah.penjelasan) return;
    _memindai = true;
    try {
      final teks = await Kunci.pindaiQr();
      if (!mounted || teks == null || _langkah != _Langkah.penjelasan) return;
      await _dariQr(teks);
    } on GalatKunci catch (e) {
      if (!mounted) return;
      setState(() {
        _galat = e.pesan;
        _langkah = _Langkah.galat;
      });
    } finally {
      _memindai = false;
    }
  }

  Future<void> _dariQr(String teks) async {
    setState(() => _langkah = _Langkah.mengirim);
    try {
      final h = await Kunci.mulaiPasang(teks, nama: 'HP Android');
      if (!mounted) return;
      setState(() {
        _kode = h.kodeSas;
        _namaMac = h.namaMac;
        _langkah = _Langkah.menunggu;
        _mulaiTunggu = DateTime.now();
      });
      _mulaiTanya();
    } on GalatKunci catch (e) {
      if (!mounted) return;
      setState(() {
        _galat = e.pesan;
        _langkah = _Langkah.galat;
      });
    }
  }

  /// Menunggu kabar `pasang_hasil`: ambilKabar() menerapkannya di Kotlin, lalu statusPasang() dibaca ulang.
  void _mulaiTanya() {
    _tanya?.cancel();
    _tanya = Timer.periodic(const Duration(seconds: 3), (_) async {
      try {
        await Kunci.ambilKabar();
      } on GalatKunci catch (_) {}
      try {
        final p = await Kunci.statusPasang();
        if (!mounted || p == null) return;
        if (p.status == 'aktif') {
          _tanya?.cancel();
          setState(() {
            _namaMac = p.namaMac;
            _langkah = _Langkah.disetujui;
          });
        } else if (p.status == 'ditolak') {
          _tanya?.cancel();
          setState(() => _langkah = _Langkah.ditolak);
        } else if (_mulaiTunggu != null && DateTime.now().difference(_mulaiTunggu!) > const Duration(minutes: 6)) {
          _tanya?.cancel();
          setState(() {
            _galat = 'Belum ada konfirmasi dari Mac. QR berlaku 5 menit — buat QR baru di Mac lalu ulangi.';
            _langkah = _Langkah.galat;
          });
        }
      } on GalatKunci catch (_) {}
    });
  }

  /// Mulai ulang dari awal. Bila sudah ada pasangan tersimpan (menunggu/ditolak), hapus dulu.
  Future<void> _ulangi() async {
    _tanya?.cancel();
    try {
      if (await Kunci.statusPasang() != null) await Kunci.lepasPerangkat();
    } on GalatKunci catch (_) {}
    if (!mounted) return;
    setState(() {
      _galat = null;
      _kode = null;
      _langkah = _Langkah.penjelasan;
    });
  }

  @override
  Widget build(BuildContext context) {
    final w = WarnaPadev.dari(context);
    return Scaffold(
      backgroundColor: w.bg,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 32, 24, 20),
          child: switch (_langkah) {
            _Langkah.penjelasan => _penjelasan(w),
            _Langkah.mengirim => _tengah(w, const CircularProgressIndicator(), 'Mendaftarkan HP…',
                'Membuat kunci di HP dan mengirim permintaan pasang ke relay. Jangan tutup aplikasi.'),
            _Langkah.menunggu => _menunggu(w),
            _Langkah.disetujui => _hasil(w, true),
            _Langkah.ditolak => _hasil(w, false),
            _Langkah.galat => _gagal(w),
          },
        ),
      ),
    );
  }

  Widget _penjelasan(WarnaPadev w) {
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      const Align(alignment: Alignment.centerLeft, child: LogoPadev(ukuran: 56)),
      const SizedBox(height: 22),
      Semantics(header: true, child: Text('Pasangkan dengan Mac', style: TeksPadev.judulLayar(w))),
      const SizedBox(height: 10),
      Text.rich(
        TextSpan(style: TeksPadev.redup(w, ukuran: 14), children: [
          const TextSpan(text: 'Di Mac jalankan '),
          TextSpan(text: 'node pelaksana.js --pasang-hp', style: TeksPadev.mono(w.ink, ukuran: 13)),
          const TextSpan(text: ', lalu pindai QR yang tampil di Terminal.'),
        ]),
      ),
      const SizedBox(height: 18),
      Kartu(
        anak: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Icon(Simbol.terenkripsi, size: 20, color: w.accent),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              'Sambungan terenkripsi ujung-ke-ujung. Hanya HP ini yang bisa mengirim perintah ke Mac Anda. '
              'QR berlaku 5 menit; maksimal 2 HP per Mac.',
              style: TeksPadev.redup(w),
            ),
          ),
        ]),
      ),
      const Spacer(),
      FilledButton(
        onPressed: _pindai,
        child: const IsiTombol(Simbol.pindai, 'Pindai kode QR'),
      ),
      if (widget.onPratinjau != null) ...[
        const SizedBox(height: 8),
        TextButton(onPressed: widget.onPratinjau, child: const Text('Lihat pratinjau dengan data contoh (demo)')),
      ],
    ]);
  }

  Widget _tengah(WarnaPadev w, Widget atas, String judul, String teks) => Center(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          atas,
          const SizedBox(height: 18),
          Text(judul, textAlign: TextAlign.center, style: TextStyle(color: w.ink, fontSize: 18, fontWeight: FontWeight.w800)),
          const SizedBox(height: 6),
          Text(teks, textAlign: TextAlign.center, style: TeksPadev.redup(w)),
        ]),
      );

  Widget _menunggu(WarnaPadev w) {
    final k = _kode ?? '------';
    final tampil = k.length == 6 ? '${k.substring(0, 3)} ${k.substring(3)}' : k;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Semantics(header: true, child: Text('Cocokkan kode di Mac', style: TeksPadev.judulLayar(w))),
      const SizedBox(height: 8),
      Text.rich(TextSpan(style: TeksPadev.redup(w, ukuran: 14), children: [
        TextSpan(text: 'Pastikan kode ini sama dengan di Terminal Mac${_namaMac == null ? '' : ' "$_namaMac"'}, lalu ketik '),
        TextSpan(text: 'ya', style: TeksPadev.mono(w.ink, ukuran: 14).copyWith(fontWeight: FontWeight.w700)),
        const TextSpan(text: ' di Mac.'),
      ])),
      const SizedBox(height: 22),
      Kartu(
        padding: const EdgeInsets.symmetric(vertical: 22, horizontal: 14),
        anak: Column(children: [
          Text('Kode pemasangan', style: TeksPadev.label(w)),
          const SizedBox(height: 8),
          Semantics(
            label: 'Kode pemasangan ${k.split('').join(' ')}',
            child: ExcludeSemantics(
              child: Text(tampil, style: TeksPadev.mono(w.ink, ukuran: 40).copyWith(fontWeight: FontWeight.w700, letterSpacing: 4)),
            ),
          ),
        ]),
      ),
      const SizedBox(height: 18),
      Semantics(
        liveRegion: true,
        child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
          const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)),
          const SizedBox(width: 10),
          Text('Menunggu konfirmasi di Mac…', style: TeksPadev.redup(w, ukuran: 14)),
        ]),
      ),
      const Spacer(),
      Text('Kode berbeda? Jangan ketik ya di Mac. Batalkan lalu buat QR baru.', textAlign: TextAlign.center, style: TeksPadev.redup(w, ukuran: 12)),
      const SizedBox(height: 8),
      OutlinedButton(onPressed: _ulangi, child: const Text('Batalkan pemasangan')),
    ]);
  }

  Widget _hasil(WarnaPadev w, bool ok) {
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      const SizedBox(height: 12),
      Align(
        alignment: Alignment.centerLeft,
        child: Container(
          width: 56,
          height: 56,
          decoration: BoxDecoration(color: ok ? w.okb : w.errb, shape: BoxShape.circle),
          child: Icon(ok ? Simbol.centangLingkar : Simbol.larang, color: ok ? w.ok : w.err, size: 30),
        ),
      ),
      const SizedBox(height: 18),
      Semantics(
        header: true,
        liveRegion: true,
        child: Text(ok ? "Terpasang dengan Mac '${_namaMac ?? 'Mac'}'" : 'Pemasangan ditolak di Mac', style: TeksPadev.judulLayar(w)),
      ),
      const SizedBox(height: 10),
      Text(
        ok
            ? 'HP ini sekarang bisa memantau proyek dan mengirim perintah Rencana. Kerjakan menyala per proyek dari laptop.'
            : 'Mac menolak pemasangan HP ini. Bila itu bukan Anda, abaikan. Untuk mencoba lagi, buat QR baru di Mac.',
        style: TeksPadev.redup(w, ukuran: 14),
      ),
      const Spacer(),
      FilledButton(
        onPressed: ok ? widget.onTerpasang : _ulangi,
        child: Text(ok ? 'Mulai' : 'Ulangi pemasangan'),
      ),
    ]);
  }

  Widget _gagal(WarnaPadev w) {
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Expanded(
        child: Center(
          child: IsiKosong(ikon: Simbol.galatLingkar, judul: 'Pemasangan belum berhasil', teks: _galat),
        ),
      ),
      FilledButton(onPressed: _ulangi, child: const IsiTombol(Simbol.pindai, 'Pindai ulang')),
    ]);
  }
}
