// L07 Pengaturan: perangkat (+ idKunci 8 heksa, DESAIN §3.6), notifikasi, keamanan, tampilan, panduan POCO/HyperOS,
// tentang (alamat relay baca saja, versi), Lepas perangkat, Pasang perangkat cadangan, Diagnostik (debug saja).
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../debug/layar_uji.dart';
import '../komponen/komponen.dart';
import '../kunci/kunci.dart';
import '../tema/token.dart';
import 'data.dart';

class LayarPengaturan extends StatelessWidget {
  const LayarPengaturan({super.key, required this.sumber, required this.onLepas});
  final SumberData sumber;
  final Future<void> Function() onLepas;

  Future<void> _lepas(BuildContext context) async {
    final w = WarnaPadev.dari(context);
    final nama = sumber.perangkat?.namaMac ?? 'Mac';
    final ya = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        icon: Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(color: w.errb, shape: BoxShape.circle),
          child: Icon(Simbol.putus, color: w.err, size: 22),
        ),
        title: Text('Lepas perangkat ini?', style: TextStyle(color: w.ink, fontWeight: FontWeight.w800)),
        content: Text(
          'HP ini tidak bisa lagi memantau atau memberi perintah ke $nama. Kunci di HP dihapus. '
          'Untuk menyambung lagi, jalankan pemasangan ulang dari Mac.',
          style: TeksPadev.isi(w),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.of(c).pop(false), child: const Text('Batal')),
          FilledButton(
            style: gayaBahaya(w).copyWith(minimumSize: const WidgetStatePropertyAll(Size(96, 44))),
            onPressed: () => Navigator.of(c).pop(true),
            child: const Text('Lepas'),
          ),
        ],
      ),
    );
    if (ya != true) return;
    try {
      await sumber.lepasPerangkat();
      await onLepas();
    } on GalatKunci catch (e) {
      if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.pesan)));
    }
  }

  void _cadangan(BuildContext context) {
    final w = WarnaPadev.dari(context);
    bukaLembar<void>(
      context,
      (c) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Semantics(header: true, child: Text('Pasang perangkat cadangan', style: TextStyle(color: w.ink, fontSize: 19, fontWeight: FontWeight.w800))),
        const SizedBox(height: 10),
        Text('Satu Mac terhubung dengan maksimal ${sumber.maksPerangkat} HP. Untuk menambah HP cadangan:', style: TeksPadev.redup(w, ukuran: 14)),
        const SizedBox(height: 12),
        for (final (i, t) in const [
          'Pasang APK PADEV Studio di HP cadangan.',
          'Di laptop buka kantor, klik "📱 Hubungkan HP" (kanan atas) — QR langsung tampil.',
          'Di HP cadangan, buka PADEV Studio lalu pindai QR itu (berlaku 5 menit).',
          'Bila kode 6 digit sama, klik "Kode sama — pasangkan" di laptop.',
        ].indexed)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Container(
                width: 24,
                height: 24,
                alignment: Alignment.center,
                decoration: BoxDecoration(color: w.chip, shape: BoxShape.circle),
                child: Text('${i + 1}', style: TextStyle(color: w.ink, fontSize: 12, fontWeight: FontWeight.w800)),
              ),
              const SizedBox(width: 10),
              Expanded(child: Text(t, style: TeksPadev.isi(w))),
            ]),
          ),
        const SizedBox(height: 6),
        // SEC-80: status sebenarnya — kode darurat / cabut tanpa laptop belum ada (SEC-52).
        Text('Sudah ${sumber.maksPerangkat} HP? Putuskan salah satu di laptop (dialog Hubungkan HP → Putuskan), atau hubungkan yang baru: HP terlama dilepas otomatis. '
            'Bila HP hilang, putuskan dari laptop.', style: TeksPadev.redup(w, ukuran: 12)),
        const SizedBox(height: 14),
        OutlinedButton(onPressed: () => Navigator.of(c).pop(), child: const Text('Tutup')),
      ]),
    );
  }

  /// "HP terhubung ke Mac (n/maks)" dari status Mac; diputuskan dari laptop (dialog Hubungkan HP).
  List<Widget> _hpTerhubung(WarnaPadev w) {
    final l = sumber.perangkatTerhubung;
    if (l == null) return const [];
    String tgl(DateTime? d) => d == null ? '' : ' · dipasang ${d.day}/${d.month}/${d.year}';
    return [
      JudulBagian('HP terhubung ke Mac · ${l.length}/${sumber.maksPerangkat}'),
      KartuDaftar(anak: [
        for (final e in l)
          BarisPengaturan(
            ikon: Simbol.hp,
            judul: e.nama,
            sub: '${e.kerjakan ? 'Rencana + Kerjakan' : 'Rencana'}${tgl(e.dipasang)}',
            ekor: e.ini
                ? Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(color: w.accent.withValues(alpha: .14), borderRadius: BorderRadius.circular(99)),
                    child: Text('HP ini', style: TextStyle(color: w.accent, fontSize: 11.5, fontWeight: FontWeight.w800)),
                  )
                : null,
          ),
      ]),
      Padding(
        padding: const EdgeInsets.fromLTRB(4, 6, 4, 0),
        child: Text('Putuskan HP lain dari laptop: kantor → 📱 Hubungkan HP → Putuskan.', style: TeksPadev.redup(w, ukuran: 12)),
      ),
    ];
  }

  @override
  Widget build(BuildContext context) {
    final w = WarnaPadev.dari(context);
    final pr = sumber.perangkat;
    String pendek(String? id) => id == null ? '—' : (id.length > 8 ? id.substring(0, 8) : id);

    return ListView(
      padding: EdgeInsets.fromLTRB(14, MediaQuery.paddingOf(context).top + 8, 14, 24),
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(4, 0, 4, 0),
          child: Semantics(header: true, child: Text('Pengaturan', style: TeksPadev.judulLayar(w))),
        ),
        const JudulBagian('Perangkat'),
        KartuDaftar(anak: [
          BarisPengaturan(ikon: Simbol.laptop, judul: pr?.namaMac ?? 'Mac', sub: 'Mac terpasang'),
          BarisPengaturan(
            ikon: Simbol.kunci,
            judul: 'Sidik jari kunci HP',
            sub: 'Rencana ${pendek(pr?.idKRencana)} · Kerjakan ${pendek(pr?.idKKerjakan)}',
            subMono: true,
          ),
          BarisPengaturan(ikon: Simbol.tambah, judul: 'Hubungkan HP cadangan', ekor: Icon(Simbol.kanan, color: w.muted), onTap: () => _cadangan(context)),
          BarisPengaturan(ikon: Simbol.putus, judul: 'Lepas perangkat ini', warnaJudul: w.err, onTap: () => _lepas(context)),
        ]),
        ..._hpTerhubung(w),
        const JudulBagian('Notifikasi'),
        KartuDaftar(anak: [
          BarisPengaturan(
            ikon: Simbol.lonceng,
            judul: 'Notifikasi push',
            sub: (pr?.fcmAktif ?? false) ? 'Aktif · selesai, divisi, menunggu izin, Mac terputus' : 'Belum aktif (Firebase belum dipasang di APK ini)',
            ekor: ChipPadev(
              ikon: (pr?.fcmAktif ?? false) ? Simbol.centangLingkar : Simbol.info,
              label: (pr?.fcmAktif ?? false) ? 'Aktif' : 'Mati',
              fg: (pr?.fcmAktif ?? false) ? w.okt : w.muted,
              bg: (pr?.fcmAktif ?? false) ? w.okb : w.chip,
            ),
          ),
          if (!sumber.pratinjau) const _SakelarPantau(),
          BarisPengaturan(
            ikon: Simbol.terenkripsi,
            judul: 'Isi jawaban tidak pernah di notifikasi',
            sub: 'Notifikasi hanya menyebut proyek dan jenis kabar. Ketuk notifikasi → buka kunci → chat.',
          ),
        ]),
        const JudulBagian('Keamanan'),
        KartuDaftar(anak: [
          BarisPengaturan(ikon: Simbol.gembok, judul: 'Buka aplikasi', sub: 'Sidik jari atau PIN/pola kunci layar HP'),
          BarisPengaturan(ikon: Simbol.jam, judul: 'Kunci otomatis', sub: 'Setelah 2 menit di latar'),
          BarisPengaturan(
            ikon: Simbol.sidikJari,
            judul: 'Wajib sidik jari untuk Kerjakan',
            sub: 'Selalu aktif, tidak bisa dimatikan',
            ekor: Semantics(
              label: 'Selalu aktif',
              // Tampil aktif (biru + gembok) seperti rancangan; tidak bisa diubah (IgnorePointer).
              child: ExcludeSemantics(
                child: IgnorePointer(
                  child: Switch(
                    value: true,
                    onChanged: (_) {},
                    activeTrackColor: w.accent,
                    activeThumbColor: w.panel,
                    thumbIcon: WidgetStatePropertyAll(Icon(Simbol.gembok, size: 14, color: w.accent)),
                  ),
                ),
              ),
            ),
          ),
          if (sumber.pesanTidakSah > 0)
            BarisPengaturan(
              ikon: Simbol.peringatan,
              warnaJudul: w.warnt,
              judul: '${sumber.pesanTidakSah} pesan tidak sah dibuang',
              sub: 'Pesan dengan tanda tangan salah atau urutan lama ditolak otomatis.',
            ),
        ]),
        const JudulBagian('Tampilan'),
        ValueListenableBuilder<ThemeMode>(
          valueListenable: temaAplikasi,
          builder: (context, mode, _) => Kartu(
            padding: const EdgeInsets.all(8),
            anak: Segmen<ThemeMode>(
              label: 'Tema tampilan',
              pilihan: const [
                (ThemeMode.light, Simbol.terang, 'Terang'),
                (ThemeMode.dark, Simbol.gelap, 'Gelap'),
                (ThemeMode.system, Simbol.kontras, 'Ikuti sistem'),
              ],
              nilai: mode,
              onUbah: (v) => temaAplikasi.value = v,
            ),
          ),
        ),
        const JudulBagian('HP POCO / HyperOS'),
        Kartu(
          padding: EdgeInsets.zero,
          anak: Theme(
            data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
            child: ExpansionTile(
              leading: Icon(Simbol.baterai, color: w.muted),
              iconColor: w.ink,
              collapsedIconColor: w.muted,
              title: Text('Agar notifikasi tidak terlambat', style: TextStyle(color: w.ink, fontSize: 14, fontWeight: FontWeight.w600)),
              subtitle: Text('Autostart & penghemat baterai', style: TeksPadev.redup(w, ukuran: 12)),
              childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 14),
              expandedCrossAxisAlignment: CrossAxisAlignment.start,
              children: [
                for (final t in const [
                  'Setelan › Aplikasi › Kelola aplikasi › PADEV Studio › nyalakan "Mulai otomatis" (Autostart).',
                  'Di halaman yang sama: Penghemat baterai › pilih "Tanpa batasan".',
                  'Setelan › Notifikasi › PADEV Studio › izinkan notifikasi dan tampilkan di layar kunci.',
                  'Buka daftar aplikasi terbaru, tahan kartu PADEV Studio, lalu ketuk ikon gembok agar tidak ditutup sistem.',
                ])
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Padding(padding: const EdgeInsets.only(top: 7), child: Container(width: 5, height: 5, decoration: BoxDecoration(color: w.muted, shape: BoxShape.circle))),
                      const SizedBox(width: 8),
                      Expanded(child: Text(t, style: TeksPadev.isi(w).copyWith(fontSize: 13))),
                    ]),
                  ),
              ],
            ),
          ),
        ),
        const JudulBagian('Tentang'),
        KartuDaftar(anak: [
          BarisPengaturan(ikon: Simbol.tautan, judul: 'Alamat relay', sub: (pr?.relay ?? '').isEmpty ? '—' : pr!.relay, subMono: true),
          BarisPengaturan(
            ikon: Simbol.info,
            judul: 'Versi aplikasi',
            ekor: Text(pr == null ? '—' : '${pr.versiApk}${kDebugMode ? ' (debug)' : ''}', style: TeksPadev.redup(w)),
          ),
          if (sumber.versiMac != null)
            BarisPengaturan(ikon: Simbol.laptop, judul: 'Versi pelaksana Mac', ekor: Text(sumber.versiMac!, style: TeksPadev.redup(w))),
        ]),
        if (kDebugMode) ...[
          const JudulBagian('Diagnostik (debug)'),
          KartuDaftar(anak: [
            BarisPengaturan(
              ikon: Simbol.uji,
              judul: 'Layar uji kunci',
              sub: 'Buat kunci uji, tanda tangan, Kerjakan uji, segel-buka amplop',
              ekor: Icon(Simbol.kanan, color: w.muted),
              onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => const LayarUji())),
            ),
          ]),
        ],
      ],
    );
  }
}

/// F1b: pemantau latar keputusan (layanan foreground PantauKeputusan). Tidak tersedia (pratinjau/uji/build lama) → disembunyikan.
class _SakelarPantau extends StatefulWidget {
  const _SakelarPantau();
  @override
  State<_SakelarPantau> createState() => _SakelarPantauState();
}

class _SakelarPantauState extends State<_SakelarPantau> {
  bool? _nyala;
  bool _sibuk = false;

  @override
  void initState() {
    super.initState();
    Kunci.statusPantau().then((v) {
      if (mounted) setState(() => _nyala = v);
    }, onError: (_) {});
  }

  Future<void> _ubah(bool v) async {
    setState(() => _sibuk = true);
    try {
      final hasil = await Kunci.pantauKeputusan(v);
      if (mounted) setState(() => _nyala = hasil);
    } catch (_) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Pemantau tidak bisa diubah di build ini.')));
    } finally {
      if (mounted) setState(() => _sibuk = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final w = WarnaPadev.dari(context);
    final nyala = _nyala;
    if (nyala == null) return const SizedBox.shrink();
    return BarisPengaturan(
      ikon: Simbol.tangan,
      judul: 'Beri tahu saat Claude butuh keputusan',
      sub: nyala
          ? 'Aktif · cek ke Mac tiap 30 dtk walau aplikasi ditutup. POCO/HyperOS: Baterai PADEV Studio → Tanpa batasan.'
          : 'Izin & pertanyaan Claude saat Anda tidak di Mac (aplikasi ditutup)',
      ekor: Switch(value: nyala, activeTrackColor: w.accent, onChanged: _sibuk ? null : _ubah),
    );
  }
}
