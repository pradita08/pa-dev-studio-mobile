// L01 Kunci — tampilan saja. Logika buka kunci tetap di GerbangKunci (main.dart) lewat Kunci.bukaKunciAplikasi():
// sidik jari ATAU kunci layar sistem (BIOMETRIC_STRONG | DEVICE_CREDENTIAL). Tidak ada papan PIN buatan aplikasi (DESAIN §3.2).
// Dirender di atas Navigator (MaterialApp.builder): jangan memakai Navigator/Overlay/Tooltip di sini.
import 'package:flutter/material.dart';

import '../komponen/komponen.dart';
import '../tema/token.dart';

class LayarKunci extends StatelessWidget {
  const LayarKunci({
    super.key,
    required this.onBuka,
    required this.sedangMembuka,
    this.tanpaKunciLayar = false,
    this.galat,
  });

  final VoidCallback onBuka;
  final bool sedangMembuka;
  final bool tanpaKunciLayar;
  final String? galat;

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
            Center(child: LogoPadev(ukuran: tanpaKunciLayar ? 64 : 76)),
            const SizedBox(height: 18),
            Semantics(
              header: true,
              child: Text(
                tanpaKunciLayar ? 'Pasang kunci layar dulu' : 'PADEV Studio',
                textAlign: TextAlign.center,
                style: TextStyle(color: w.ink, fontSize: 22, fontWeight: FontWeight.w800),
              ),
            ),
            const SizedBox(height: 8),
            if (tanpaKunciLayar)
              Text(
                'HP ini belum punya kunci layar. PADEV Studio hanya bisa dibuka dengan sidik jari atau PIN/pola/sandi HP.\n'
                'Buka Setelan Android › Sandi & keamanan › Kunci layar, lalu kembali ke sini.',
                textAlign: TextAlign.center,
                style: TeksPadev.redup(w, ukuran: 14),
              )
            else
              Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                Icon(Simbol.gembok, size: 16, color: w.muted),
                const SizedBox(width: 6),
                Text('Terkunci', style: TeksPadev.redup(w, ukuran: 14)),
              ]),
            if (galat != null && !tanpaKunciLayar) ...[
              const SizedBox(height: 16),
              Spanduk(jenis: JenisSpanduk.galat, ikon: Simbol.galatLingkar, teks: galat!),
            ],
            const Spacer(flex: 4),
            // Tombol selalu tampil penuh (kontras btn/btnt ≥ 12:1). Saat prompt sistem terbuka, ketukan diabaikan oleh GerbangKunci.
            Semantics(
              hint: sedangMembuka ? 'Jendela sidik jari sedang terbuka' : null,
              child: FilledButton(
                onPressed: onBuka,
                child: IsiTombol(
                  tanpaKunciLayar ? Simbol.segarkan : Simbol.sidikJari,
                  tanpaKunciLayar ? 'Periksa lagi' : (sedangMembuka ? 'Menunggu sidik jari…' : 'Buka dengan sidik jari'),
                ),
              ),
            ),
            if (!tanpaKunciLayar) ...[
              const SizedBox(height: 12),
              Text(
                'Atau pilih "Pakai PIN" di jendela sistem untuk memakai PIN/pola kunci layar HP.',
                textAlign: TextAlign.center,
                style: TeksPadev.redup(w, ukuran: 12),
              ),
            ],
          ]),
        ),
      ),
    );
  }
}
