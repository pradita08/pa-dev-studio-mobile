// Review hasil Kerjakan (roadmap 2; Mac: pelaksana-review.js): kartu di halaman proyek → berkas yang berubah (+/−), tes yang
// dijalankan Claude, isi diff per berkas (proyek tingkat "isi", disamarkan Mac), lalu Commit / Push / Buang. Aksi selalu lewat
// Kotlin: BiometricPrompt K_kerjakan dengan teks dari snapshot terverifikasi (SEC-51). Semua teks Mac tampil sebagai Text biasa.
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../komponen/komponen.dart';
import '../kunci/kunci.dart';
import '../tema/token.dart';
import 'data.dart';

String _namaStatus(Review r) => switch (r.status) {
      'terbuka' => 'Belum di-commit',
      'dikomit' => r.commit == null ? 'Sudah di-commit' : 'Commit ${r.commit}',
      'didorong' => 'Sudah di-push',
      'dibuang' => 'Dibuang',
      _ => 'Usang',
    };

(Color, Color) _warnaStatus(WarnaPadev w, Review r) => switch (r.status) {
      'terbuka' => (w.warnt, w.warnb),
      'dikomit' || 'didorong' => (w.okt, w.okb),
      _ => (w.muted, w.chip),
    };

/// Pesan galat aksi review dari Mac (alasan tanda terima / `galat` snapshot) → kalimat untuk owner.
String pesanReview(String alasan) {
  if (alasan.startsWith('push_gagal')) {
    final sebab = alasan.contains(':') ? alasan.substring(alasan.indexOf(':') + 1).trim() : '';
    return 'Push gagal${sebab.isEmpty ? '' : ': $sebab'}. Cek koneksi/izin remote di laptop.';
  }
  if (alasan.startsWith('commit_gagal')) return 'Commit gagal di Mac (${alasan.substring(alasan.indexOf(':') + 1).trim()}).';
  if (alasan.startsWith('buang_gagal')) return 'Buang gagal di Mac (${alasan.substring(alasan.indexOf(':') + 1).trim()}).';
  return GalatKunci(alasan).pesan;
}

class _LencanaBerkas extends StatelessWidget {
  const _LencanaBerkas(this.status);
  final String status;
  @override
  Widget build(BuildContext context) {
    final w = WarnaPadev.dari(context);
    final (fg, bg) = switch (status) { 'A' => (w.okt, w.okb), 'D' => (w.err, w.errb), _ => (w.accent, w.accb) };
    return Container(
      width: 22,
      height: 22,
      alignment: Alignment.center,
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(6)),
      child: Text(status, style: TextStyle(color: fg, fontSize: 12, fontWeight: FontWeight.w800)),
    );
  }
}

class _BarisBerkas extends StatelessWidget {
  const _BarisBerkas({required this.b, this.onTap});
  final BerkasReview b;
  final VoidCallback? onTap;
  @override
  Widget build(BuildContext context) {
    final w = WarnaPadev.dari(context);
    final ket = switch (b.status) { 'A' => 'baru', 'D' => 'dihapus', 'T' => 'jenis berubah', _ => 'diubah' };
    return Semantics(
      button: onTap != null,
      label: '${b.jalur}, $ket${b.biner ? ', biner' : ', ${b.tambah} baris ditambah, ${b.kurang} dihapus'}',
      excludeSemantics: true,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 6),
          child: Row(children: [
            _LencanaBerkas(b.status),
            const SizedBox(width: 8),
            Expanded(child: Text(b.jalur, maxLines: 1, overflow: TextOverflow.ellipsis, style: TeksPadev.mono(w.ink, ukuran: 12.5))),
            const SizedBox(width: 8),
            if (b.biner)
              Text('biner', style: TeksPadev.redup(w, ukuran: 12))
            else ...[
              Text('+${b.tambah}', style: TextStyle(color: w.okt, fontSize: 12.5, fontWeight: FontWeight.w700)),
              const SizedBox(width: 6),
              Text('−${b.kurang}', style: TextStyle(color: w.err, fontSize: 12.5, fontWeight: FontWeight.w700)),
            ],
            if (onTap != null) ...[const SizedBox(width: 4), Icon(Simbol.kanan, size: 18, color: w.muted)],
          ]),
        ),
      ),
    );
  }
}

/// Kartu review di halaman proyek: ringkasan, maks 5 berkas, tes, tombol aksi sesuai `boleh`.
class KartuReview extends StatelessWidget {
  const KartuReview({super.key, required this.sumber, required this.review, this.pesanBawaan});
  final SumberData sumber;
  final Review review;

  /// Usulan pesan commit (perintah terakhir dari HP di proyek ini).
  final String? pesanBawaan;

  @override
  Widget build(BuildContext context) {
    final w = WarnaPadev.dari(context);
    final r = review;
    final (fg, bg) = _warnaStatus(w, r);
    final berjalan = sumber.aksiBerjalan(r.id);
    final galat = sumber.galatAksiReview[r.id] ?? r.galat;
    final macPutus = sumber.macTersambung == false;
    return Kartu(
      anak: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [
          Icon(Simbol.berkas, size: 20, color: w.ink),
          const SizedBox(width: 8),
          Expanded(
            child: Semantics(
              header: true,
              child: Text('Hasil Kerjakan · ${r.jumlahBerkas} berkas', style: TeksPadev.judulKartu(w), overflow: TextOverflow.ellipsis),
            ),
          ),
          ChipPadev(ikon: r.terbuka ? Simbol.info : Simbol.centangLingkar, label: _namaStatus(r), fg: fg, bg: bg),
        ]),
        const SizedBox(height: 6),
        Text.rich(TextSpan(style: TeksPadev.redup(w, ukuran: 12.5), children: [
          TextSpan(text: '+${r.tambah}', style: TextStyle(color: w.okt, fontWeight: FontWeight.w700)),
          const TextSpan(text: ' '),
          TextSpan(text: '−${r.kurang}', style: TextStyle(color: w.err, fontWeight: FontWeight.w700)),
          TextSpan(text: '${r.cabang.isEmpty ? '' : ' · cabang ${r.cabang}'} · ${waktuRelatif(r.diperbarui)}'
              '${r.tugas.length > 1 ? ' · ${r.tugas.length} tugas' : ''}'),
        ])),
        const SizedBox(height: 6),
        for (final b in r.berkas.take(5)) _BarisBerkas(b: b, onTap: () => bukaLayarReview(context, sumber, r.id, berkas: b.jalur)),
        if (r.jumlahBerkas > 5 || r.berkas.isNotEmpty)
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton(
              onPressed: () => bukaLayarReview(context, sumber, r.id),
              child: Text(r.jumlahBerkas > 5 ? 'Lihat semua ${r.jumlahBerkas} berkas' : 'Lihat perubahan'),
            ),
          ),
        if (r.tes.isNotEmpty) ...[
          Divider(height: 16, color: w.line),
          for (final t in r.tes) _BarisTes(t),
        ],
        if (galat != null) ...[
          const SizedBox(height: 8),
          Spanduk(jenis: JenisSpanduk.galat, ikon: Simbol.galatLingkar, teks: pesanReview(galat)),
        ],
        if (r.boleh.isNotEmpty) ...[
          const SizedBox(height: 10),
          if (berjalan != null)
            Row(children: [
              const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)),
              const SizedBox(width: 10),
              Text(switch (berjalan) { 'commit' => 'Commit dikirim — menunggu Mac…', 'push' => 'Push dikirim — menunggu Mac…', _ => 'Buang dikirim — menunggu Mac…' },
                  style: TeksPadev.redup(w)),
            ])
          else ...[
            if (r.bisa('commit') || r.bisa('buang'))
              Row(children: [
                if (r.bisa('commit'))
                  Expanded(
                    flex: 3,
                    child: FilledButton(
                      onPressed: macPutus ? null : () => _commit(context, sumber, r, pesanBawaan),
                      child: const IsiTombol(Simbol.centang, 'Commit…'),
                    ),
                  ),
                if (r.bisa('commit') && r.bisa('buang')) const SizedBox(width: 8),
                if (r.bisa('buang'))
                  Expanded(
                    flex: 2,
                    child: OutlinedButton(
                      onPressed: macPutus ? null : () => _buang(context, sumber, r),
                      child: Text('Buang…', style: TextStyle(color: w.err)),
                    ),
                  ),
              ]),
            if (r.bisa('push')) ...[
              if (r.bisa('commit') || r.bisa('buang')) const SizedBox(height: 8),
              FilledButton.tonal(
                onPressed: macPutus ? null : () => _aksi(context, sumber, r, 'push'),
                child: IsiTombol(Simbol.kirim, r.belumPush > 1 ? 'Push ${r.belumPush} commit' : 'Push'),
              ),
            ],
          ],
          const SizedBox(height: 6),
          Text('Sidik jari diminta untuk setiap aksi. Hook git proyek tidak dijalankan dari HP.', style: TeksPadev.redup(w, ukuran: 11.5)),
        ] else if (r.terbuka && sumber.perangkat != null) ...[
          const SizedBox(height: 6),
          Text('Commit/Buang dari HP butuh HP mode Kerjakan & proyek hp:"kerjakan".', style: TeksPadev.redup(w, ukuran: 12)),
        ],
      ]),
    );
  }
}

class _BarisTes extends StatelessWidget {
  const _BarisTes(this.t);
  final TesReview t;
  @override
  Widget build(BuildContext context) {
    final w = WarnaPadev.dari(context);
    final (ikon, warna, ket) = switch (t.ok) {
      true => (Simbol.centangLingkar, w.okt, 'lulus'),
      false => (Simbol.galatLingkar, w.err, 'gagal'),
      null => (Simbol.info, w.muted, 'hasil tidak diketahui'),
    };
    return Semantics(
      label: 'Tes ${t.perintah}: $ket',
      excludeSemantics: true,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 3),
        child: Row(children: [
          Icon(ikon, size: 16, color: warna),
          const SizedBox(width: 8),
          Expanded(child: Text(t.perintah, maxLines: 1, overflow: TextOverflow.ellipsis, style: TeksPadev.mono(w.ink, ukuran: 12))),
          Text(ket, style: TextStyle(color: warna, fontSize: 12, fontWeight: FontWeight.w700)),
        ]),
      ),
    );
  }
}

Future<void> _aksi(BuildContext context, SumberData s, Review r, String aksi, {String? pesan}) async {
  try {
    await s.aksiReview(r, aksi, pesan: pesan);
  } on GalatKunci catch (e) {
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.kode == 'dibatalkan' ? 'Dibatalkan.' : e.pesan)));
    }
  }
}

Future<void> _commit(BuildContext context, SumberData s, Review r, String? usulan) async {
  final pesan = await showDialog<String>(context: context, builder: (_) => _DialogCommit(review: r, usulan: usulan));
  if (pesan == null || !context.mounted) return;
  await _aksi(context, s, r, 'commit', pesan: pesan);
}

Future<void> _buang(BuildContext context, SumberData s, Review r) async {
  final w = WarnaPadev.dari(context);
  final ya = await showDialog<bool>(
    context: context,
    builder: (c) => AlertDialog(
      title: Text('Buang perubahan ${r.jumlahBerkas} berkas?'),
      content: const Text('Berkas dikembalikan ke isi sebelum tugas Kerjakan (berkas baru dihapus). Tidak bisa dibatalkan.'),
      actions: [
        TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Batal')),
        TextButton(onPressed: () => Navigator.pop(c, true), child: Text('Buang', style: TextStyle(color: w.err))),
      ],
    ),
  );
  if (ya == true && context.mounted) await _aksi(context, s, r, 'buang');
}

class _DialogCommit extends StatefulWidget {
  const _DialogCommit({required this.review, this.usulan});
  final Review review;
  final String? usulan;
  @override
  State<_DialogCommit> createState() => _DialogCommitState();
}

class _DialogCommitState extends State<_DialogCommit> {
  late final _ketik = TextEditingController(text: _rapikan(widget.usulan ?? ''));

  static String _rapikan(String s) {
    final satu = s.replaceAll(RegExp(r'\s+'), ' ').trim();
    return satu.length > 72 ? '${satu.substring(0, 71).trimRight()}…' : satu;
  }

  @override
  void dispose() {
    _ketik.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final w = WarnaPadev.dari(context);
    final ok = _ketik.text.trim().isNotEmpty;
    return AlertDialog(
      title: Text('Commit ${widget.review.jumlahBerkas} berkas'),
      content: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('Hanya berkas dalam review ini yang di-commit${widget.review.cabang.isEmpty ? '' : ' ke cabang ${widget.review.cabang}'}.',
            style: TeksPadev.redup(w)),
        const SizedBox(height: 10),
        TextField(
          controller: _ketik,
          autofocus: true,
          maxLength: 200,
          enableIMEPersonalizedLearning: false,
          inputFormatters: [FilteringTextInputFormatter.deny(RegExp(r'[\n\r\t]'))],
          onChanged: (_) => setState(() {}),
          decoration: const InputDecoration(labelText: 'Pesan commit', border: OutlineInputBorder()),
        ),
      ]),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('Batal')),
        FilledButton(onPressed: ok ? () => Navigator.pop(context, _ketik.text.trim()) : null, child: const Text('Commit')),
      ],
    );
  }
}

void bukaLayarReview(BuildContext context, SumberData sumber, String reviewId, {String? berkas}) =>
    Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => LayarReview(sumber: sumber, reviewId: reviewId, buka: berkas)));

/// Semua berkas review; ketuk berkas → isi diff (diminta dari Mac sekali, warna +/−).
class LayarReview extends StatefulWidget {
  const LayarReview({super.key, required this.sumber, required this.reviewId, this.buka});
  final SumberData sumber;
  final String reviewId;
  final String? buka;
  @override
  State<LayarReview> createState() => _LayarReviewState();
}

class _LayarReviewState extends State<LayarReview> {
  late final Set<String> _terbuka = {if (widget.buka != null) widget.buka!};

  @override
  void initState() {
    super.initState();
    if (widget.buka != null) WidgetsBinding.instance.addPostFrameCallback((_) => _minta(widget.buka!));
  }

  Review? get _r => widget.sumber.review.where((x) => x.id == widget.reviewId).firstOrNull;

  Future<void> _minta(String jalur) async {
    final r = _r;
    if (r == null || !r.isi) return;
    try {
      await widget.sumber.mintaDiff(r, jalur);
    } on GalatKunci catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.pesan)));
    }
  }

  @override
  Widget build(BuildContext context) => ListenableBuilder(listenable: widget.sumber, builder: (c, _) => _bangun(c));

  Widget _bangun(BuildContext context) {
    final w = WarnaPadev.dari(context);
    final s = widget.sumber, r = _r;
    return Scaffold(
      backgroundColor: w.bg,
      appBar: AppBar(
        backgroundColor: w.panel,
        foregroundColor: w.ink,
        surfaceTintColor: Colors.transparent,
        title: Text(r == null ? 'Review' : '${s.namaProyek(r.proyek)} · ${r.jumlahBerkas} berkas', overflow: TextOverflow.ellipsis),
      ),
      body: r == null
          ? const Center(child: IsiKosong(ikon: Simbol.berkas, judul: 'Review tidak ada lagi', teks: 'Tarik untuk menyegarkan halaman proyek.'))
          : ListView(
              padding: const EdgeInsets.fromLTRB(12, 12, 12, 24),
              children: [
                if (!r.isi)
                  const Padding(
                    padding: EdgeInsets.only(bottom: 10),
                    child: Spanduk(
                      jenis: JenisSpanduk.netral,
                      ikon: Simbol.tersembunyi,
                      teks: 'Isi perubahan hanya untuk proyek bertanda "Isi" (bukan data pribadi). Daftar berkas & jumlah baris tetap tampil.',
                    ),
                  ),
                for (final b in r.berkas)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Kartu(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      anak: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                        _BarisBerkas(
                          b: b,
                          onTap: !r.isi
                              ? null
                              : () {
                                  setState(() => _terbuka.contains(b.jalur) ? _terbuka.remove(b.jalur) : _terbuka.add(b.jalur));
                                  if (_terbuka.contains(b.jalur)) _minta(b.jalur);
                                },
                        ),
                        if (_terbuka.contains(b.jalur)) _IsiDiff(sumber: s, review: r, berkas: b),
                      ]),
                    ),
                  ),
                if (r.lebih > 0)
                  Text('+${r.lebih} berkas lain tidak ditampilkan (daftar dipangkas). Lihat lengkapnya di laptop.', style: TeksPadev.redup(w)),
              ],
            ),
    );
  }
}

class _IsiDiff extends StatelessWidget {
  const _IsiDiff({required this.sumber, required this.review, required this.berkas});
  final SumberData sumber;
  final Review review;
  final BerkasReview berkas;

  @override
  Widget build(BuildContext context) {
    final w = WarnaPadev.dari(context);
    final d = sumber.diffBerkas(review, berkas.jalur);
    if (d == null) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 12),
        child: sumber.memuatDiff(review, berkas.jalur)
            ? Row(children: [
                const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)),
                const SizedBox(width: 10),
                Text('Mengambil perubahan dari Mac…', style: TeksPadev.redup(w)),
              ])
            : Text('Ketuk lagi untuk memuat.', style: TeksPadev.redup(w)),
      );
    }
    if (d.rahasia) return _ket(w, 'Berkas rahasia (.env, kunci, …) — isinya tidak pernah dikirim ke HP.');
    if (d.biner) return _ket(w, 'Berkas biner — tidak ada isi teks.');
    final baris = d.teks.split('\n');
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      const SizedBox(height: 6),
      if (d.disamarkan) _ket(w, 'Sebagian baris disamarkan (kata sandi, token, data pribadi).'),
      ClipRRect(
        borderRadius: BorderRadius.circular(8),
        child: Container(
          color: w.chip,
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(vertical: 6),
            child: SelectionArea(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                for (final l in baris.take(1500))
                  if (!l.startsWith('diff --git') && !l.startsWith('index ') && !l.startsWith('--- ') && !l.startsWith('+++ '))
                    Container(
                      color: l.startsWith('+') ? w.okb : l.startsWith('-') ? w.errb : null,
                      padding: const EdgeInsets.symmetric(horizontal: 8),
                      child: Text(l.isEmpty ? ' ' : l,
                          softWrap: false,
                          style: TeksPadev.mono(l.startsWith('@@') ? w.accent : l.startsWith('-') ? w.err : l.startsWith('+') ? w.okt : w.ink, ukuran: 11.5)),
                    ),
              ]),
            ),
          ),
        ),
      ),
      if (d.terpotong || baris.length > 1500) _ket(w, 'Perubahan dipotong (terlalu panjang untuk HP). Lihat lengkapnya di laptop.'),
      const SizedBox(height: 6),
    ]);
  }

  Widget _ket(WarnaPadev w, String t) => Padding(padding: const EdgeInsets.symmetric(vertical: 6), child: Text(t, style: TeksPadev.redup(w, ukuran: 12)));
}
