// Keputusan dari HP (F1b; Mac: pelaksana-keputusan.js): izin & pertanyaan Claude Code saat owner tidak di Mac.
// PitaKeputusan (tab Proyek & Sesi) → LayarKeputusan: kartu per permintaan dengan isi yang diminta (perintah/berkas/rencana,
// sudah disamarkan Mac), pertanyaan + pilihan, sisa waktu, dan tombol sesuai `boleh` dari Mac. Izinkan → Kotlin menampilkan
// BiometricPrompt sendiri (K_kerjakan, SEC-51). Semua teks dari Mac tampil sebagai Text biasa (A-E1).
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../komponen/komponen.dart';
import '../kunci/kunci.dart';
import '../tema/token.dart';
import 'data.dart';

/// Pita di atas tab Proyek/Sesi saat ada keputusan menunggu.
class PitaKeputusan extends StatelessWidget {
  const PitaKeputusan({super.key, required this.sumber});
  final SumberData sumber;

  @override
  Widget build(BuildContext context) {
    final n = sumber.keputusanMenunggu.length;
    if (n == 0) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Spanduk(
        jenis: JenisSpanduk.peringatan,
        ikon: Simbol.tangan,
        teks: n == 1 ? 'Claude butuh keputusan Anda' : 'Claude butuh $n keputusan',
        labelAksi: 'Buka',
        aksi: () => bukaLayarKeputusan(context, sumber),
      ),
    );
  }
}

void bukaLayarKeputusan(BuildContext context, SumberData sumber) =>
    Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => LayarKeputusan(sumber: sumber)));

class LayarKeputusan extends StatefulWidget {
  const LayarKeputusan({super.key, required this.sumber});
  final SumberData sumber;

  @override
  State<LayarKeputusan> createState() => _LayarKeputusanState();
}

class _LayarKeputusanState extends State<LayarKeputusan> {
  Timer? _detik;

  @override
  void initState() {
    super.initState();
    _detik = Timer.periodic(const Duration(seconds: 1), (_) => setState(() {})); // hitung mundur sisa waktu
  }

  @override
  void dispose() {
    _detik?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => ListenableBuilder(listenable: widget.sumber, builder: (c, _) => _bangun(c));

  Widget _bangun(BuildContext context) {
    final w = WarnaPadev.dari(context);
    final s = widget.sumber;
    final daftar = s.keputusan.where((k) => !k.kedaluwarsa).toList();
    return Scaffold(
      backgroundColor: w.bg,
      appBar: AppBar(title: const Text('Keputusan untuk Claude'), backgroundColor: w.bg, foregroundColor: w.ink, elevation: 0),
      body: RefreshIndicator(
        color: w.accent,
        onRefresh: () => s.segarkan(diam: true),
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(14, 6, 14, 24),
          children: [
            if (daftar.isEmpty)
              const IsiKosong(
                ikon: Simbol.centangLingkar,
                judul: 'Tidak ada yang menunggu',
                teks: 'Saat Claude di Mac minta izin atau bertanya ketika Anda sedang pergi, permintaannya muncul di sini.',
              ),
            for (final k in daftar)
              Padding(padding: const EdgeInsets.only(bottom: 12), child: KartuKeputusan(key: ValueKey(k.id), sumber: s, k: k)),
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(
                'Tidak dijawab sampai waktunya habis → Claude kembali menunggu di Mac. '
                'Izinkan selalu berarti input yang sama persis diizinkan otomatis di proyek itu.',
                style: TeksPadev.redup(w, ukuran: 12),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class KartuKeputusan extends StatefulWidget {
  const KartuKeputusan({super.key, required this.sumber, required this.k});
  final SumberData sumber;
  final Keputusan k;

  @override
  State<KartuKeputusan> createState() => _KartuKeputusanState();
}

class _KartuKeputusanState extends State<KartuKeputusan> {
  late final List<Set<String>> _pilihan = [for (final _ in widget.k.pertanyaan) <String>{}];
  late final List<TextEditingController> _lain = [for (final _ in widget.k.pertanyaan) TextEditingController()];
  bool _kirim = false;

  @override
  void dispose() {
    for (final c in _lain) {
      c.dispose();
    }
    super.dispose();
  }

  Keputusan get k => widget.k;

  /// Jawaban per pertanyaan: pilihan tercentang + teks bebas (bila diisi). null = ada pertanyaan yang belum dijawab.
  List<List<String>>? get _jawaban {
    final hasil = <List<String>>[];
    for (var i = 0; i < k.pertanyaan.length; i++) {
      final l = [..._pilihan[i]];
      final t = _lain[i].text.trim();
      if (t.isNotEmpty) {
        if (!k.pertanyaan[i].banyak) l.clear();
        l.add(t);
      }
      if (l.isEmpty) return null;
      hasil.add(l);
    }
    return hasil;
  }

  Future<void> _jawab(String pilih, {List<List<String>>? jawaban, String? pesan}) async {
    setState(() => _kirim = true);
    try {
      await widget.sumber.jawabKeputusan(k, pilih, jawaban: jawaban, pesan: pesan);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(switch (pilih) {
          'tolak' => 'Penolakan dikirim ke Mac.',
          'jawab' => 'Jawaban dikirim ke Mac.',
          'izinkan_selalu' => 'Diizinkan selalu untuk input yang sama.',
          _ => 'Izin dikirim ke Mac.',
        })));
      }
    } on GalatKunci catch (e) {
      if (mounted && e.kode != 'dibatalkan') ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.pesan)));
    } finally {
      if (mounted) setState(() => _kirim = false);
    }
  }

  Future<void> _tolak() async {
    final c = TextEditingController();
    final pesan = await showDialog<String>(
      context: context,
      builder: (d) => AlertDialog(
        title: const Text('Tolak permintaan ini?'),
        content: TextField(
          controller: c,
          maxLines: 3,
          inputFormatters: [LengthLimitingTextInputFormatter(500)],
          decoration: const InputDecoration(labelText: 'Alasan / arahan untuk Claude (opsional)', hintText: 'mis. pakai cara lain, jangan hapus data'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.of(d).pop(), child: const Text('Batal')),
          FilledButton(onPressed: () => Navigator.of(d).pop(c.text.trim()), child: const Text('Tolak')),
        ],
      ),
    );
    c.dispose();
    if (pesan == null) return;
    await _jawab('tolak', pesan: pesan.isEmpty ? null : pesan);
  }

  Future<void> _izinkanSelalu() async {
    final ya = await showDialog<bool>(
      context: context,
      builder: (d) => AlertDialog(
        title: const Text('Izinkan selalu?'),
        content: Text('${widget.sumber.namaProyek(k.proyek)}: ${k.alat} dengan input yang SAMA PERSIS akan diizinkan otomatis '
            '(juga saat Anda di Mac) sampai aturan kedaluwarsa. Input berbeda tetap ditanyakan.'),
        actions: [
          TextButton(onPressed: () => Navigator.of(d).pop(false), child: const Text('Batal')),
          FilledButton(onPressed: () => Navigator.of(d).pop(true), child: const Text('Lanjut')),
        ],
      ),
    );
    if (ya == true) await _jawab('izinkan_selalu');
  }

  @override
  Widget build(BuildContext context) {
    final w = WarnaPadev.dari(context);
    final s = widget.sumber;
    final (ikon, judul) = switch (k.jenis) {
      'tanya' => (Simbol.claude, 'Claude bertanya'),
      'rencana' => (Simbol.daftarCek, 'Rencana siap disetujui'),
      _ => (Simbol.tangan, 'Minta izin: ${alatTampil(k.alat).$2 == k.alat ? k.alat : '${alatTampil(k.alat).$2} (${k.alat})'}'),
    };
    final sisa = k.sisa;
    final teksSisa = sisa.isNegative ? 'habis' : '${sisa.inMinutes}:${duaDigit(sisa.inSeconds % 60)}';
    final sibuk = _kirim || k.terkirim;
    return Kartu(
      anak: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Icon(ikon, size: 20, color: w.warnt),
          const SizedBox(width: 8),
          Expanded(child: Text(judul, style: TeksPadev.judulKartu(w), overflow: TextOverflow.ellipsis)),
          ChipPadev(ikon: Simbol.jam, label: teksSisa, fg: sisa.inSeconds < 60 ? w.err : w.muted, bg: sisa.inSeconds < 60 ? w.errb : w.chip),
        ]),
        const SizedBox(height: 4),
        Text('${s.namaProyek(k.proyek)} · ${namaAkun(k.akun)} · ${jamMenit(k.dibuat)}', style: TeksPadev.redup(w, ukuran: 12)),
        if (k.ringkas.isNotEmpty) ...[
          const SizedBox(height: 10),
          Container(
            constraints: const BoxConstraints(maxHeight: 240),
            width: double.infinity,
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(color: w.chip, borderRadius: BorderRadius.circular(10)),
            child: SingleChildScrollView(
              child: SelectableText(k.ringkas, style: TextStyle(color: w.ink, fontSize: 12.5, fontFamily: 'monospace', height: 1.35)),
            ),
          ),
        ],
        for (var i = 0; i < k.pertanyaan.length; i++) ..._soal(w, i),
        const SizedBox(height: 12),
        if (k.terkirim)
          Row(children: [
            SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: w.accent)),
            const SizedBox(width: 8),
            Text('Terkirim — menunggu Mac…', style: TeksPadev.redup(w)),
          ])
        else
          Wrap(spacing: 8, runSpacing: 8, children: [
            if (k.bisa('tolak'))
              OutlinedButton(onPressed: sibuk ? null : _tolak, child: const IsiTombol(Simbol.larang, 'Tolak')),
            if (k.bisa('jawab'))
              FilledButton(
                onPressed: sibuk || _jawaban == null ? null : () => _jawab('jawab', jawaban: _jawaban),
                child: const IsiTombol(Simbol.kirim, 'Kirim jawaban'),
              ),
            if (k.bisa('izinkan'))
              FilledButton(
                style: gayaKerjakan(w),
                onPressed: sibuk ? null : () => _jawab('izinkan'),
                child: IsiTombol(Simbol.sidikJari, k.jenis == 'rencana' ? 'Setujui rencana' : 'Izinkan sekali'),
              ),
            if (k.bisa('izinkan_selalu'))
              TextButton(onPressed: sibuk ? null : _izinkanSelalu, child: const Text('Izinkan selalu')),
          ]),
      ]),
    );
  }

  List<Widget> _soal(WarnaPadev w, int i) {
    final q = k.pertanyaan[i];
    final sibuk = _kirim || k.terkirim;
    return [
      const SizedBox(height: 12),
      if (q.judul.isNotEmpty) Text(q.judul.toUpperCase(), style: TeksPadev.redup(w, ukuran: 11)),
      Text(q.teks, style: TextStyle(color: w.ink, fontSize: 14.5, fontWeight: FontWeight.w700, height: 1.35)),
      const SizedBox(height: 4),
      if (q.banyak)
        for (final (label, ket) in q.pilihan)
          CheckboxListTile(
            dense: true,
            contentPadding: EdgeInsets.zero,
            value: _pilihan[i].contains(label),
            onChanged: sibuk ? null : (v) => setState(() => v == true ? _pilihan[i].add(label) : _pilihan[i].remove(label)),
            title: Text(label, style: TextStyle(color: w.ink)),
            subtitle: ket.isEmpty ? null : Text(ket, style: TeksPadev.redup(w, ukuran: 12)),
          )
      else
        RadioGroup<String>(
          groupValue: _pilihan[i].isEmpty ? null : _pilihan[i].first,
          onChanged: (v) {
            if (sibuk || v == null) return;
            setState(() => _pilihan[i]
              ..clear()
              ..add(v));
          },
          child: Column(children: [
            for (final (label, ket) in q.pilihan)
              RadioListTile<String>(
                dense: true,
                contentPadding: EdgeInsets.zero,
                value: label,
                enabled: !sibuk,
                title: Text(label, style: TextStyle(color: w.ink)),
                subtitle: ket.isEmpty ? null : Text(ket, style: TeksPadev.redup(w, ukuran: 12)),
              ),
          ]),
        ),
      TextField(
        controller: _lain[i],
        enabled: !sibuk,
        onChanged: (_) => setState(() {}),
        inputFormatters: [LengthLimitingTextInputFormatter(500)],
        style: TextStyle(color: w.ink, fontSize: 14),
        decoration: InputDecoration(
          isDense: true,
          labelText: q.banyak ? 'Tambahan lain (opsional)' : 'Atau tulis jawaban sendiri',
          labelStyle: TextStyle(color: w.muted),
        ),
      ),
    ];
  }
}
