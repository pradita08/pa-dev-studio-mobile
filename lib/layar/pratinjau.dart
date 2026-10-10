// Pratinjau langsung (roadmap 2b/2c; Mac: pelaksana-pratinjau.js): kartu "Coba di HP" di halaman proyek. Nyalakan (Kotlin minta
// sidik jari K_kerjakan) → server dev proyek jalan di Mac dalam sandbox & terbuka di tailnet owner 30 menit → Buka di browser
// (alamat diambil Kotlin dari snapshot terverifikasi) · Screenshot ukuran HP & desktop · Perpanjang · Matikan.
import 'package:flutter/material.dart';

import '../komponen/komponen.dart';
import '../kunci/kunci.dart';
import '../tema/token.dart';
import 'data.dart';

String _sisa(DateTime? sampai) {
  if (sampai == null) return '';
  final m = sampai.difference(DateTime.now()).inMinutes;
  return m <= 0 ? 'segera mati' : '$m mnt lagi';
}

class KartuPratinjau extends StatelessWidget {
  const KartuPratinjau({super.key, required this.sumber, required this.pratinjau});
  final SumberData sumber;
  final PratinjauProyek pratinjau;

  Future<void> _aksi(BuildContext context, String aksi) async {
    try {
      if (aksi == 'buka') {
        await sumber.bukaPratinjau(pratinjau.proyek);
      } else {
        await sumber.aksiPratinjau(pratinjau.proyek, aksi);
      }
    } on GalatKunci catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.kode == 'dibatalkan' ? 'Dibatalkan.' : e.pesan)));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final w = WarnaPadev.dari(context);
    final x = pratinjau;
    final berjalan = sumber.aksiPratinjauBerjalan(x.proyek);
    final galat = sumber.galatPratinjau[x.proyek] ?? (x.status == 'gagal' ? x.galat : null);
    final gambar = sumber.gambarProyek(x.proyek);
    final macPutus = sumber.macTersambung == false;
    final (label, fg, bg) = switch (x.status) {
      'menyala' => ('Menyala · ${_sisa(x.sampai)}', w.okt, w.okb),
      'mulai' => ('Menyalakan…', w.accent, w.accb),
      'gagal' => ('Gagal', w.err, w.errb),
      _ => ('Mati', w.muted, w.chip),
    };
    return Kartu(
      anak: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [
          Icon(Simbol.hp, size: 20, color: w.ink),
          const SizedBox(width: 8),
          Expanded(child: Semantics(header: true, child: Text('Coba di HP', style: TeksPadev.judulKartu(w)))),
          ChipPadev(ikon: x.menyala ? Simbol.langsung : Simbol.tidur, label: label, fg: fg, bg: bg),
        ]),
        const SizedBox(height: 6),
        Text(
          x.menyala
              ? 'Website proyek jalan di Mac dan terbuka di HP lewat Tailscale (akun yang sama).'
              : 'Jalankan website/aplikasi proyek di Mac (sandbox), lalu coba langsung dari HP lewat Tailscale.',
          style: TeksPadev.redup(w, ukuran: 12.5),
        ),
        if (x.menyala && x.alamat != null) ...[
          const SizedBox(height: 6),
          Text(x.alamat!, maxLines: 1, overflow: TextOverflow.ellipsis, style: TeksPadev.mono(w.muted, ukuran: 11.5)),
        ],
        if (galat != null) ...[
          const SizedBox(height: 8),
          Spanduk(jenis: JenisSpanduk.galat, ikon: Simbol.galatLingkar, teks: _pesan(galat)),
        ],
        if (gambar.isNotEmpty) ...[
          const SizedBox(height: 10),
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            for (final u in const ['hp', 'desktop'])
              if (gambar[u] case final g?)
                Expanded(
                  flex: u == 'hp' ? 2 : 3,
                  child: Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: _Gambar(g: g, onTap: () => _bukaGambar(context, g)),
                  ),
                ),
          ]),
        ],
        const SizedBox(height: 10),
        if (berjalan != null && berjalan != 'potret')
          Row(children: [
            const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)),
            const SizedBox(width: 10),
            Expanded(
              child: Text(berjalan == 'henti' ? 'Mematikan…' : 'Menyalakan server di Mac… (bisa sampai 1 menit)', style: TeksPadev.redup(w)),
            ),
          ])
        else if (x.menyala) ...[
          Row(children: [
            Expanded(
              flex: 3,
              child: FilledButton(
                onPressed: macPutus ? null : () => _aksi(context, 'buka'),
                child: const IsiTombol(Simbol.tautan, 'Buka di browser'),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              flex: 2,
              child: OutlinedButton(
                onPressed: macPutus || berjalan == 'potret' ? null : () => _aksi(context, 'potret'),
                child: Text(berjalan == 'potret' ? 'Memotret…' : 'Screenshot'),
              ),
            ),
          ]),
          const SizedBox(height: 4),
          Row(children: [
            if (x.bisaMulai)
              TextButton(onPressed: macPutus ? null : () => _aksi(context, 'mulai'), child: const Text('Perpanjang 30 mnt')),
            const Spacer(),
            TextButton(onPressed: macPutus ? null : () => _aksi(context, 'henti'), child: Text('Matikan', style: TextStyle(color: w.err))),
          ]),
        ] else if (x.bisaMulai)
          FilledButton(
            onPressed: macPutus || x.status == 'mulai' ? null : () => _aksi(context, 'mulai'),
            child: const IsiTombol(Simbol.sidikJari, 'Nyalakan pratinjau'),
          )
        else
          Text('Menyalakan butuh HP mode Kerjakan & proyek hp:"kerjakan".', style: TeksPadev.redup(w, ukuran: 12)),
      ]),
    );
  }

  static String _pesan(String alasan) {
    if (alasan.startsWith('pratinjau_gagal')) {
      final sebab = alasan.contains(':') ? alasan.substring(alasan.indexOf(':') + 1).trim() : '';
      return 'Server gagal menyala${sebab.isEmpty ? '' : ': $sebab'}';
    }
    return GalatKunci(alasan).pesan;
  }

  void _bukaGambar(BuildContext context, GambarPratinjau g) => Navigator.of(context).push(MaterialPageRoute<void>(
        builder: (c) => Scaffold(
          backgroundColor: Colors.black,
          appBar: AppBar(
            backgroundColor: Colors.black,
            foregroundColor: Colors.white,
            title: Text('Screenshot ${g.ukuran == 'hp' ? 'HP' : 'desktop'} · ${jamMenit(g.diterima)}'),
          ),
          body: InteractiveViewer(maxScale: 5, child: Center(child: Image.memory(g.jpeg, gaplessPlayback: true))),
        ),
      ));
}

class _Gambar extends StatelessWidget {
  const _Gambar({required this.g, required this.onTap});
  final GambarPratinjau g;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    final w = WarnaPadev.dari(context);
    return Semantics(
      button: true,
      label: 'Screenshot ${g.ukuran == 'hp' ? 'ukuran HP' : 'desktop'}, ketuk untuk memperbesar',
      excludeSemantics: true,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: Container(
              constraints: const BoxConstraints(maxHeight: 180),
              decoration: BoxDecoration(border: Border.all(color: w.line)),
              child: Image.memory(g.jpeg, fit: BoxFit.cover, alignment: Alignment.topCenter, gaplessPlayback: true,
                  errorBuilder: (c, e, s) => SizedBox(height: 60, child: Center(child: Icon(Simbol.gambar, color: w.muted)))),
            ),
          ),
          const SizedBox(height: 4),
          Text('${g.ukuran == 'hp' ? 'HP' : 'Desktop'} · ${jamMenit(g.diterima)}', style: TeksPadev.redup(w, ukuran: 11.5)),
        ]),
      ),
    );
  }
}
