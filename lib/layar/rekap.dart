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

    // per divisi: satu baris jumlah + 3 baris orang (#1..#3, G9); SEMUA divisi dari aset pegawai tampil walau tak ada di rekap (token 0, owner 2026-11-09).
    // Kepala & pendukung satu baris. Urut token terbesar; yang 0 di bawah (nama sebagai pemutus seri).
    final grup = <String, List<(String, int)>>{};
    for (final (i, a) in r.agen.indexed) {
      grup.putIfAbsent(_kunciGrup(a), () => []).add((a, perAgen[i]));
    }
    for (final k in namaDivisi.keys) {
      if (!grup.containsKey('divisi-$k') && [1, 2, 3].any((ke) => NamaPegawai.cari(k, ke) != null)) grup['divisi-$k'] = [];
    }
    final urut = <(String, List<(String, int)>, int, bool)>[];
    for (final e in grup.entries) {
      final orang = _orangDivisi(e.key, e.value);
      urut.add((e.key, orang ?? [(e.key, e.value.fold(0, (s, x) => s + x.$2))], e.value.fold(0, (s, x) => s + x.$2), orang != null));
    }
    urut.sort((a, b) => b.$3 != a.$3 ? b.$3.compareTo(a.$3) : _namaAgen(a.$1).compareTo(_namaAgen(b.$1)));
    final maks = urut.isEmpty ? 0 : urut.first.$3;
    final jumlahBaris = urut.fold(0, (n, g) => n + g.$2.length);

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
        KartuAngka(label: 'Agen aktif', nilai: '${perAgen.where((t) => t > 0).length}', sub: 'agen / orang dengan token > 0'),
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
        JudulBagian('PER AGEN · $jumlahBaris AGEN · ${bulanan ? 'BULAN INI' : '7 HARI'}'),
        Kartu(
          anak: Column(children: [
            for (final (kunci, anggota, total, perOrang) in urut)
              if (!perOrang)
                BarisBatang(
                  awal: AvatarDivisi(nama: _orang(kunci) ?? _namaAgen(kunci), ukuran: 28),
                  nama: _namaAgen(kunci),
                  nilai: total,
                  maks: maks,
                )
              else ...[
                BarisBatang(awal: AvatarDivisi(nama: _namaAgen(kunci), ukuran: 28), nama: _namaAgen(kunci), nilai: total, maks: maks),
                for (final (a, t) in anggota)
                  Padding(
                    padding: const EdgeInsets.only(left: 20),
                    child: BarisBatang(awal: AvatarDivisi(nama: _namaOrang(a), ukuran: 22), nama: _namaOrang(a), nilai: t, maks: maks),
                  ),
              ],
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

  /// 'kepala' → "Nerro (Kepala)" · 'divisi-qa' → "QA" · 'lainnya' → "Lainnya" · agen lain → nama dirapikan ("General purpose").
  static String _namaAgen(String a) => switch (RekapAgen.kelompok(a)) {
        'kepala' => '${NamaPegawai.cari('kepala') ?? 'Nerro'} (Kepala)',
        'pendukung' => a == 'lainnya' ? 'Lainnya' : DivisiAlur(a).nama,
        final k => DivisiAlur(k).nama,
      };

  /// Baris orang sebuah divisi: kunci `divisi-x#1..#3` (3 baris, token 0 bila tak ada di rekap). null = bukan divisi / divisi tak dikenal tanpa `#` → satu baris.
  static List<(String, int)>? _orangDivisi(String kunci, List<(String, int)> anggota) {
    if (!kunci.startsWith('divisi-')) return null;
    final dikenal = namaDivisi.containsKey(kunci.substring(7)) || [1, 2, 3].any((ke) => NamaPegawai.cari(kunci, ke) != null);
    if (!dikenal && !anggota.any((x) => x.$1.contains('#'))) return null;
    int per(int ke) => anggota.where((x) => RekapAgen.orang(x.$1).$2 == ke).fold(0, (s, x) => s + x.$2);
    return [for (final ke in [1, 2, 3]) if (dikenal || anggota.any((x) => RekapAgen.orang(x.$1).$2 == ke)) ('$kunci#$ke', per(ke))];
  }

  /// Kunci baris divisi: 'divisi-x#2' → 'divisi-x'; kepala & pendukung → kuncinya sendiri.
  static String _kunciGrup(String a) {
    final k = RekapAgen.kelompok(a);
    return k == 'kepala' || k == 'pendukung' ? a : 'divisi-$k';
  }

  /// Nama orang dari aset pegawai; belum ada → "Programmer #2".
  static String _namaOrang(String a) {
    final (peran, ke) = RekapAgen.orang(a);
    return NamaPegawai.cari(peran, ke) ?? '${_namaAgen(a)} #$ke';
  }

  static String? _orang(String a) {
    final k = RekapAgen.kelompok(a);
    return a == 'lainnya' ? null : NamaPegawai.cari(k == 'pendukung' ? a : k);
  }
}
