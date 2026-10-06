// Layar uji SEMENTARA (hanya build debug; di rilis tidak dirender dan metode uji* ditolak native).
// Untuk memeriksa plugin `kunci` di HP asli: buat kunci, tanda tangan uji, Kerjakan (sidik jari), segel-buka amplop.
import 'package:flutter/material.dart';

import '../kunci/kunci.dart';
import '../tema/token.dart';

class LayarUji extends StatefulWidget {
  const LayarUji({super.key});

  @override
  State<LayarUji> createState() => _LayarUjiState();
}

class _LayarUjiState extends State<LayarUji> {
  final List<(bool, String)> _log = [];
  bool _sibuk = false;

  Future<void> _jalankan(String nama, Future<Object?> Function() f) async {
    setState(() => _sibuk = true);
    try {
      final h = await f();
      _tulis(true, '$nama: ${h ?? 'selesai'}');
    } on GalatKunci catch (e) {
      _tulis(false, '$nama: ${e.kode} — ${e.pesan}');
    } finally {
      if (mounted) setState(() => _sibuk = false);
    }
  }

  void _tulis(bool ok, String t) => setState(() => _log.insert(0, (ok, t)));

  @override
  Widget build(BuildContext context) {
    final w = WarnaPadev.dari(context);
    Widget tombol(IconData ikon, String label, Future<Object?> Function() f, {bool utama = false}) {
      final isi = Row(mainAxisAlignment: MainAxisAlignment.center, children: [Icon(ikon, size: 20), const SizedBox(width: 8), Text(label)]);
      final aksi = _sibuk ? null : () => _jalankan(label, f);
      return Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: utama ? FilledButton(onPressed: aksi, child: isi) : OutlinedButton(onPressed: aksi, child: isi),
      );
    }

    return Scaffold(
      appBar: AppBar(
        backgroundColor: w.bg,
        foregroundColor: w.ink,
        title: const Text('Uji kunci (debug)', style: TextStyle(fontWeight: FontWeight.w800)),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: w.panel,
                borderRadius: BorderRadius.circular(UkuranPadev.radiusKartu),
                border: Border.all(color: w.line),
              ),
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                tombol(Simbol.uji, 'Status keamanan', () async {
                  final s = await Kunci.statusKeamanan();
                  return 'kunci layar ${s.kunciLayar}, sidik jari ${s.biometrikKuat}, StrongBox ${s.strongBox}, '
                      'FCM ${s.fcmAktif}, Android API ${s.android}, versi ${s.versiApk}';
                }),
                tombol(Simbol.kunci, 'Buat kunci uji', Kunci.ujiBuatKunci, utama: true),
                tombol(Simbol.tanda, 'Tanda tangan uji (K_rencana)', Kunci.ujiTanda),
                tombol(Simbol.sidikJari, 'Kerjakan uji (sidik jari)', Kunci.ujiKerjakan),
                tombol(Simbol.terenkripsi, 'Segel-buka amplop uji', Kunci.ujiSegelBuka),
                tombol(Simbol.hapus, 'Hapus kunci uji', () async {
                  await Kunci.ujiHapusKunci();
                  return 'kunci uji dihapus';
                }),
              ]),
            ),
            const SizedBox(height: 16),
            for (final (ok, t) in _log)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(color: ok ? w.okb : w.errb, borderRadius: BorderRadius.circular(10)),
                  child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Icon(ok ? Simbol.centang : Simbol.galat, size: 18, color: ok ? w.okt : w.err),
                    const SizedBox(width: 8),
                    Expanded(child: Text(t, style: TextStyle(color: w.ink, fontSize: 13))),
                  ]),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
