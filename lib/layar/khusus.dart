// L08 Pembaruan wajib (relay menjawab 426 `versi_usang`) dan L01 "perangkat dicabut" (arahkan ke pasang ulang).
// Tanpa tautan unduh publik: APK baru dipasang dari laptop.
import 'package:flutter/material.dart';

import '../komponen/komponen.dart';
import '../kunci/kunci.dart';
import '../pratinjau/pita.dart';
import '../tema/token.dart';
import 'data.dart';

class LayarPembaruanWajib extends StatelessWidget {
  const LayarPembaruanWajib({super.key, required this.sumber, this.onKeluarPratinjau});
  final SumberData sumber;
  final VoidCallback? onKeluarPratinjau;

  @override
  Widget build(BuildContext context) {
    final w = WarnaPadev.dari(context);
    final versi = sumber.perangkat?.versiApk;
    return Scaffold(
      backgroundColor: w.bg,
      body: Column(children: [
        if (sumber.pratinjau) PitaPratinjau(sumber: sumber, onKeluar: onKeluarPratinjau),
        Expanded(
          child: SafeArea(
            top: !sumber.pratinjau,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(24, 32, 24, 20),
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                Align(
                  alignment: Alignment.centerLeft,
                  child: Container(
                    width: 56,
                    height: 56,
                    decoration: BoxDecoration(color: w.warnb, shape: BoxShape.circle),
                    child: Icon(Simbol.perbarui, color: w.warnt, size: 28),
                  ),
                ),
                const SizedBox(height: 18),
                Semantics(header: true, child: Text('Pembaruan wajib', style: TeksPadev.judulLayar(w))),
                const SizedBox(height: 10),
                Text(
                  'Relay menolak versi aplikasi ini karena terlalu lama. Pasang versi terbaru sebelum melanjutkan.',
                  style: TeksPadev.redup(w, ukuran: 14),
                ),
                const SizedBox(height: 18),
                KartuDaftar(anak: [
                  BarisPengaturan(judul: 'Versi terpasang', ekor: Text(versi ?? '—', style: TeksPadev.mono(w.ink, ukuran: 13))),
                  BarisPengaturan(judul: 'Versi minimum', ekor: Text('ditentukan relay', style: TeksPadev.redup(w))),
                ]),
                const SizedBox(height: 18),
                Text('Cara memasang', style: TeksPadev.label(w)),
                const SizedBox(height: 8),
                Text(
                  '1. Di laptop, bangun APK terbaru (apk/bangun.sh).\n'
                  '2. Sambungkan HP dengan kabel USB, jalankan apk/pasang-hp.sh.\n'
                  '3. Buka lagi PADEV Studio. Pemasangan dengan Mac tetap tersimpan.',
                  style: TeksPadev.isi(w).copyWith(height: 1.6),
                ),
                const Spacer(),
                Text('Tidak ada tautan unduh publik. Jangan memasang APK dari sumber lain.',
                    textAlign: TextAlign.center, style: TeksPadev.redup(w, ukuran: 12)),
                const SizedBox(height: 10),
                OutlinedButton(
                  onPressed: () async {
                    sumber.pembaruanWajib = false;
                    try {
                      await sumber.segarkan();
                    } on GalatKunci catch (_) {}
                  },
                  child: const IsiTombol(Simbol.segarkan, 'Periksa lagi'),
                ),
              ]),
            ),
          ),
        ),
      ]),
    );
  }
}

class LayarDicabut extends StatefulWidget {
  const LayarDicabut({super.key, this.namaMac, required this.onPasangUlang});
  final String? namaMac;
  final Future<void> Function() onPasangUlang;

  @override
  State<LayarDicabut> createState() => _LayarDicabutState();
}

class _LayarDicabutState extends State<LayarDicabut> {
  bool _sibuk = false;

  @override
  Widget build(BuildContext context) {
    final w = WarnaPadev.dari(context);
    return Scaffold(
      backgroundColor: w.bg,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 24, 24, 20),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            const Spacer(flex: 3),
            const Center(child: LogoPadev(ukuran: 64)),
            const SizedBox(height: 18),
            Semantics(
              header: true,
              child: Text('Perangkat ini sudah dicabut', textAlign: TextAlign.center, style: TextStyle(color: w.ink, fontSize: 22, fontWeight: FontWeight.w800)),
            ),
            const SizedBox(height: 8),
            Text(
              'Mac${widget.namaMac == null ? '' : ' "${widget.namaMac}"'} sudah mencabut HP ini, jadi HP tidak bisa lagi memantau atau memberi perintah. '
              'Untuk memakai lagi, hapus kunci lama lalu pasangkan ulang dengan QR baru dari Mac.',
              textAlign: TextAlign.center,
              style: TeksPadev.redup(w, ukuran: 14),
            ),
            const Spacer(flex: 4),
            FilledButton(
              onPressed: _sibuk
                  ? null
                  : () async {
                      setState(() => _sibuk = true);
                      try {
                        await Kunci.lepasPerangkat();
                      } on GalatKunci catch (_) {
                        // relay mungkin sudah menghapus perangkat; data lokal tetap dibersihkan Kotlin
                      }
                      await widget.onPasangUlang();
                      if (mounted) setState(() => _sibuk = false);
                    },
              child: IsiTombol(Simbol.pindai, _sibuk ? 'Menghapus kunci lama…' : 'Pasang ulang'),
            ),
          ]),
        ),
      ),
    );
  }
}
