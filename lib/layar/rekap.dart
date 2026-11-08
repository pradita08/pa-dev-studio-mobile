// Kantor › Rekap (G8, KONTRAK-apk-v2 §10.13 B/D): token SETARA per jenis agen dari `status.rekap` — 7 hari (tanpa selisih) atau
// bulanan (bulan berjalan + selisih vs bulan lalu). Hanya angka + nama agen (tanpa proyek/sesi/isi). Grafik tanpa paket (komponen.dart).
import 'package:flutter/material.dart';

import '../komponen/komponen.dart';
import '../tema/token.dart';
import 'alur.dart';
import 'data.dart';

const _hariPendek = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
const _bulanPendek = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

/// Label 7 batang harian (lama → baru), selaras [RekapAgen.harianAgen] (hari yang tidak ada → '' di depan).
List<String> labelHari(RekapAgen r) => [
      ...List.filled(7 - r.hari.length.clamp(0, 7), ''),
      for (final h in r.hari) _hariPendek[(DateTime.tryParse(h.kunci)?.weekday ?? 1) - 1],
    ];

String _labelBulan(String bln) => _bulanPendek[((int.tryParse(bln.substring(5)) ?? 1) - 1).clamp(0, 11)];

/// Kalimat untuk pembaca layar: "Token per hari: Sen 320 rb, …".
String semantikGrafik(String judul, List<String> label, List<int> nilai) =>
    '$judul: ${[for (final (i, v) in nilai.indexed) '${label[i].isEmpty ? '-' : label[i]} ${tokenBaca(v)}'].join(', ')}';

class LayarRekap extends StatefulWidget {
  const LayarRekap({super.key, required this.sumber});
  final SumberData sumber;

  @override
  State<LayarRekap> createState() => _LayarRekapState();
}

class _LayarRekapState extends State<LayarRekap> {
  bool _bulanan = false;

  @override
  Widget build(BuildContext context) {
    final w = WarnaPadev.dari(context);
    final s = widget.sumber, r = s.rekap;
    const pad = EdgeInsets.fromLTRB(14, 4, 14, 24);
    if (s.memuatAwal) {
      return Semantics(label: 'Memuat rekap', child: ListView(padding: pad, children: const [
        Row(children: [
          Expanded(child: Kerangka(lebar: double.infinity, tinggi: 76, radius: 14)),
          SizedBox(width: 10),
          Expanded(child: Kerangka(lebar: double.infinity, tinggi: 76, radius: 14)),
        ]),
        SizedBox(height: 10),
        Kerangka(lebar: double.infinity, tinggi: 76, radius: 14),
        SizedBox(height: 18),
        Kerangka(lebar: double.infinity, tinggi: 150, radius: 14),
      ]));
    }
    if (r == null) {
      return ListView(padding: pad, children: const [
        Spanduk(jenis: JenisSpanduk.netral, ikon: Simbol.info, teks: 'Rekap butuh pelaksana terbaru di Mac (git pull, lalu mulai ulang pelaksana).'),
      ]);
    }

    final bulanan = _bulanan && r.bulan.isNotEmpty;
    // angka & daftar: 7 hari = jumlah 7 hari; bulanan = bulan berjalan (terakhir)
    final cakup = bulanan ? [r.bulan.last] : r.hari;
    final lalu = bulanan && r.bulan.length > 1 ? r.bulan[r.bulan.length - 2] : null;
    int jumlah(Iterable<RekapPeriode> ps, List<int> Function(RekapPeriode) f) => ps.fold(0, (a, p) => a + f(p).fold(0, (x, y) => x + y));
    final token = jumlah(cakup, (p) => p.token), tugas = jumlah(cakup, (p) => p.tugas), sen = jumlah(cakup, (p) => p.sen);
    final perAgen = [for (var i = 0; i < r.agen.length; i++) cakup.fold(0, (a, p) => a + p.token[i])];
    String? selisih(int kini, int? dulu) =>
        dulu == null || dulu == 0 ? null : '${kini >= dulu ? '▲' : '▼'} ${((kini - dulu).abs() * 100 / dulu).round()}% vs bulan lalu';

    final grafikNilai = [for (final p in bulanan ? r.bulan : r.hari) p.token.fold(0, (a, b) => a + b)];
    final grafikLabel = bulanan ? [for (final p in r.bulan) _labelBulan(p.kunci)] : labelHari(r).sublist(7 - r.hari.length);
    final judulGrafik = bulanan ? 'Token per bulan' : 'Token per hari';

    // per divisi (RekapAgen.kelompok), maks 8 baris + "Lainnya"
    final kelompok = <String, int>{};
    for (final (i, a) in r.agen.indexed) {
      if (perAgen[i] > 0) kelompok.update(RekapAgen.kelompok(a), (v) => v + perAgen[i], ifAbsent: () => perAgen[i]);
    }
    final urut = kelompok.entries.toList()..sort((a, b) => b.value.compareTo(a.value));
    final tampil = urut.take(urut.length > 8 ? 7 : 8).toList();
    final sisa = urut.skip(tampil.length).fold(0, (a, e) => a + e.value);
    final maks = urut.isEmpty ? 0 : urut.first.value;

    return ListView(padding: pad, children: [
      Segmen<bool>(
        label: 'Periode rekap',
        pilihan: const [(false, Simbol.jam, '7 hari'), (true, Simbol.grafik, 'Bulanan')],
        nilai: bulanan,
        nonaktif: r.bulan.isEmpty ? const {true} : const {},
        onUbah: (v) => setState(() => _bulanan = v),
      ),
      if (r.bulan.isEmpty)
        Padding(
          padding: const EdgeInsets.only(top: 6, left: 4),
          child: Text('Bulanan tampil setelah Mac menyimpan rekap per bulan.', style: TeksPadev.redup(w, ukuran: 12)),
        ),
      const SizedBox(height: 12),
      if (token == 0 && tugas == 0)
        IsiKosong(
          ikon: Simbol.info,
          judul: 'Belum ada pemakaian pada periode ini',
          teks: 'Token tercatat saat Claude Code bekerja di Mac (sesi utama maupun divisi).',
        )
      else ...[
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Expanded(
            child: KartuAngka(
              label: bulanan ? 'Token bulan ini' : 'Token 7 hari',
              nilai: tokenBaca(token),
              sub: bulanan ? selisih(token, lalu?.token.fold<int>(0, (a, b) => a + b)) : 'setara',
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: KartuAngka(
              label: 'Tugas',
              nilai: '$tugas',
              sub: bulanan ? selisih(tugas, lalu?.tugas.fold<int>(0, (a, b) => a + b)) : null,
            ),
          ),
        ]),
        const SizedBox(height: 10),
        KartuAngka(label: 'Agen aktif', nilai: '${perAgen.where((t) => t > 0).length}', sub: 'jenis agen dengan token > 0'),
        Padding(
          padding: const EdgeInsets.fromLTRB(4, 8, 4, 0),
          child: Text('Perkiraan biaya ≈ US\$${(sen / 100).toStringAsFixed(2).replaceAll('.', ',')} (tabel harga di Mac, bukan tagihan)',
              style: TeksPadev.redup(w, ukuran: 12)),
        ),
        JudulBagian(judulGrafik.toUpperCase()),
        Kartu(
          anak: GrafikBatang(
            key: ValueKey(bulanan),
            nilai: grafikNilai,
            label: grafikLabel,
            semantik: semantikGrafik(judulGrafik, grafikLabel, grafikNilai),
          ),
        ),
        JudulBagian(bulanan ? 'PER DIVISI · BULAN INI' : 'PER DIVISI · 7 HARI'),
        Kartu(
          anak: Column(children: [
            for (final e in tampil)
              BarisBatang(
                awal: AvatarDivisi(nama: _orang(e.key) ?? _namaKelompok(e.key), ukuran: 28),
                nama: _namaKelompok(e.key),
                nilai: e.value,
                maks: maks,
              ),
            if (sisa > 0) BarisBatang(awal: const AvatarDivisi(nama: '…', ukuran: 28), nama: 'Lainnya', nilai: sisa, maks: maks),
          ]),
        ),
      ],
      Padding(
        padding: const EdgeInsets.fromLTRB(4, 14, 4, 0),
        child: Text('Token setara · semua proyek, Akun 1 + Akun 2 · diperbarui ${jamMenit(r.dibuat)}${r.awal == null ? '' : ' · data sejak ${r.awal}'}',
            style: TeksPadev.redup(w, ukuran: 12)),
      ),
    ]);
  }

  static String _namaKelompok(String k) => switch (k) {
        'kepala' => 'Kepala',
        'pendukung' => 'Pendukung',
        _ => DivisiAlur(k).nama,
      };

  static String? _orang(String k) => k == 'pendukung' ? null : NamaPegawai.cari(k);
}
