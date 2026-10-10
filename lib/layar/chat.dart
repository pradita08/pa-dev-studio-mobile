// L04 Chat perintah per proyek + L05a lembar ringkasan Kerjakan. Halaman proyek juga menjadi pusat proyek: di atas kolom ketik
// tampil keputusan (izin/pertanyaan Claude di Mac, dijawab di sini — F1b), review hasil Kerjakan (roadmap 2), dan Claude yang
// sedang berjalan di Mac untuk proyek ini (cermin sesi → detail & riwayat langsung).
// Kerjakan: setelah L05a, Kotlin menampilkan BiometricPrompt sistem sendiri (wajib sidik jari, tanpa PIN — DESAIN §3.1, SEC-51).
// Teks Claude ditampilkan sebagai teks biasa.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../komponen/komponen.dart';
import '../kunci/kunci.dart';
import '../pratinjau/pita.dart';
import '../tema/token.dart';
import 'data.dart';
import 'keputusan.dart';
import 'review.dart';
import 'sesi.dart';
import 'sesi_detail.dart';

const _batasPesan = 8000;

class LayarChat extends StatefulWidget {
  const LayarChat({super.key, required this.sumber, required this.proyekId});
  final SumberData sumber;
  final String proyekId;

  @override
  State<LayarChat> createState() => _LayarChatState();
}

class _LayarChatState extends State<LayarChat> {
  final _ketik = TextEditingController();
  final _fokus = FocusNode();
  String _mode = 'rencana';
  String? _akun;
  bool _mengirim = false;
  Timer? _detik;

  SumberData get s => widget.sumber;

  @override
  void initState() {
    super.initState();
    _ketik.addListener(() => setState(() {}));
    _detik = Timer.periodic(const Duration(seconds: 1), (_) {
      // detik berjalan: lama tugas & sisa waktu kartu keputusan
      if (mounted && (s.tugasAktif(widget.proyekId) != null || _keputusan().isNotEmpty)) setState(() {});
    });
    // pusat proyek: daftar sesi Mac (dibatasi 1×/2 mnt) & langganan review (bila belum) — tanpa galat ke layar
    WidgetsBinding.instance.addPostFrameCallback((_) {
      unawaited(s.mintaDaftarSesi(otomatis: true));
      unawaited(s.langgananReview(olehOwner: true));
    });
  }

  List<Keputusan> _keputusan() => s.keputusan.where((k) => k.proyek == widget.proyekId && !k.kedaluwarsa).toList();

  /// Claude yang berjalan di Mac untuk proyek ini (VS Code/terminal; tugas dari HP sudah tampil sebagai chat).
  List<SesiCermin> _sesiMac() {
    final l = s.daftarSesi
        .where((x) => x.proyek == widget.proyekId && x.asal != 'hp' && x.asal != 'pelaksana' && (x.terbuka || x.status != StatusSesi.selesai))
        .toList()
      ..sort((a, b) => (b.terakhir ?? DateTime(0)).compareTo(a.terakhir ?? DateTime(0)));
    return l.take(3).toList();
  }

  /// Item yang disematkan di atas kolom ketik (urutan dari bawah ke atas, ListView terbalik).
  List<Widget> _sematan(BuildContext context, WarnaPadev w, Proyek p) {
    final kp = _keputusan();
    final menungguTanpaKartu = p.status == StatusProyek.menungguIzin && s.macTersambung != false && !kp.any((k) => !k.terkirim);
    final rv = s.reviewProyek(p.id).where((r) => r.terbuka || DateTime.now().difference(r.diperbarui) < const Duration(hours: 6)).toList();
    final sesi = _sesiMac();
    final usulan = s.chat(p.id).where((t) => t.mode == 'kerjakan').lastOrNull?.pesan;
    Widget jarak(Widget c) => Padding(padding: const EdgeInsets.only(top: 10), child: c);
    return [
      for (final k in kp) jarak(KartuKeputusan(key: ValueKey('kp-${k.id}'), sumber: s, k: k)),
      if (menungguTanpaKartu)
        jarak(const Spanduk(
          jenis: JenisSpanduk.peringatan,
          ikon: Simbol.tangan,
          teks: 'Claude menunggu izin di Mac. Kartu jawaban muncul di sini bila Mac tidak dipakai ≥ 1 menit — '
              'atau di Mac jalankan: bash siapkan-hp.sh --keputusan izinkan 0 (semua pertanyaan ke HP).',
        )),
      for (final r in rv) jarak(KartuReview(key: ValueKey('rv-${r.id}'), sumber: s, review: r, pesanBawaan: usulan)),
      if (sesi.isNotEmpty)
        jarak(Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Padding(
            padding: const EdgeInsets.only(left: 4, bottom: 6),
            child: Row(children: [
              Icon(Simbol.laptop, size: 16, color: w.muted),
              const SizedBox(width: 6),
              Expanded(child: Text('Claude di Mac · ketuk untuk melihat aktivitas & riwayat', style: TeksPadev.label(w))),
            ]),
          ),
          for (final x in sesi)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: KartuSesi(
                sesi: x,
                sumber: s,
                onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => LayarSesiDetail(sumber: s, sesi: x))),
              ),
            ),
        ])),
    ];
  }

  @override
  void dispose() {
    _detik?.cancel();
    _ketik.dispose();
    _fokus.dispose();
    super.dispose();
  }

  void _pesan(String t) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(t)));
  }

  Future<void> _kirim(Proyek p) async {
    final pesan = _ketik.text.trim();
    final akun = _akun ?? (p.akun.isEmpty ? '' : p.akun.first);
    if (pesan.isEmpty || _mengirim) return;
    if (_mode == 'kerjakan') {
      final ya = await _lembarKerjakan(p, akun, pesan);
      if (ya != true) return;
    }
    setState(() => _mengirim = true);
    try {
      await s.kirim(proyekId: p.id, akun: akun, mode: _mode, pesan: pesan);
      _ketik.clear();
    } on GalatKunci catch (e) {
      if (e.kode == 'dibatalkan') {
        _pesan(_mode == 'kerjakan' ? 'Kerjakan dibatalkan. Pesan tidak dikirim.' : 'Dibatalkan.');
      } else {
        _pesan(e.pesan);
      }
    } finally {
      if (mounted) setState(() => _mengirim = false);
    }
  }

  /// L05a — ringkasan sebelum prompt sidik jari sistem.
  Future<bool?> _lembarKerjakan(Proyek p, String akun, String pesan) {
    final w = WarnaPadev.dari(context);
    final cuplikan = pesan.length > 200 ? '${pesan.substring(0, 200)}…' : pesan;
    Widget baris(String k, Widget v) => Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            SizedBox(width: 72, child: Text(k, style: TeksPadev.redup(w))),
            Expanded(child: Align(alignment: Alignment.centerRight, child: v)),
          ]),
        );
    return bukaLembar<bool>(
      context,
      (c) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(color: w.warnb, shape: BoxShape.circle),
            child: Icon(Simbol.kilat, color: w.warnt, size: 22),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Semantics(
              header: true,
              child: Text('Jalankan mode Kerjakan?', style: TextStyle(color: w.ink, fontSize: 19, fontWeight: FontWeight.w800)),
            ),
          ),
        ]),
        const SizedBox(height: 10),
        Text.rich(TextSpan(style: TeksPadev.redup(w), children: [
          const TextSpan(text: 'Claude boleh membaca dan mengubah file di proyek ini. '),
          TextSpan(text: 'git push', style: TeksPadev.mono(w.ink, ukuran: 12.5)),
          const TextSpan(text: ' tetap ditolak.'),
        ])),
        const SizedBox(height: 14),
        Container(
          decoration: BoxDecoration(border: Border.all(color: w.line), borderRadius: BorderRadius.circular(12)),
          child: Column(children: [
            baris('Proyek', Text(p.nama, style: TextStyle(color: w.ink, fontWeight: FontWeight.w700))),
            Divider(height: 1, color: w.line),
            baris(
              'Mode',
              Row(mainAxisSize: MainAxisSize.min, children: [
                Icon(Simbol.kilat, size: 15, color: w.warnt),
                const SizedBox(width: 4),
                Text('Kerjakan (mengubah file)', style: TextStyle(color: w.warnt, fontWeight: FontWeight.w700)),
              ]),
            ),
            Divider(height: 1, color: w.line),
            baris('Akun', Text(namaAkun(akun), style: TextStyle(color: w.ink, fontWeight: FontWeight.w700))),
            Divider(height: 1, color: w.line),
            Padding(
              padding: const EdgeInsets.all(12),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('Pesan · ${pesan.length} karakter', style: TeksPadev.redup(w)),
                const SizedBox(height: 4),
                Text('"$cuplikan"', style: TextStyle(color: w.ink, fontSize: 13.5, fontStyle: FontStyle.italic, height: 1.4)),
              ]),
            ),
          ]),
        ),
        const SizedBox(height: 12),
        Row(children: [
          Icon(Simbol.sidikJari, size: 16, color: w.muted),
          const SizedBox(width: 6),
          Expanded(child: Text('Berikutnya HP meminta sidik jari (wajib, tanpa PIN).', style: TeksPadev.redup(w, ukuran: 12))),
        ]),
        const SizedBox(height: 14),
        FilledButton(
          style: gayaKerjakan(w),
          onPressed: () => Navigator.of(c).pop(true),
          child: const IsiTombol(Simbol.sidikJari, 'Ya, kerjakan'),
        ),
        const SizedBox(height: 8),
        OutlinedButton(onPressed: () => Navigator.of(c).pop(false), child: const Text('Batal')),
      ]),
    );
  }

  Future<void> _hapusRiwayat(Proyek p) async {
    final akun = _akun ?? (p.akun.isEmpty ? '' : p.akun.first);
    final w = WarnaPadev.dari(context);
    final ya = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: Text('Hapus riwayat?', style: TextStyle(color: w.ink, fontWeight: FontWeight.w800)),
        content: Text('Sesi Claude untuk ${namaAkun(akun)} di ${p.nama} dihapus di Mac, dan percakapan di HP ini dikosongkan.', style: TeksPadev.isi(w)),
        actions: [
          TextButton(onPressed: () => Navigator.of(c).pop(false), child: const Text('Batal')),
          FilledButton(style: gayaBahaya(w).copyWith(minimumSize: const WidgetStatePropertyAll(Size(96, 44))),
              onPressed: () => Navigator.of(c).pop(true), child: const Text('Hapus')),
        ],
      ),
    );
    if (ya != true) return;
    try {
      await s.hapusRiwayat(p.id, akun);
      _pesan('Riwayat dihapus.');
    } on GalatKunci catch (e) {
      _pesan(e.pesan);
    }
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(listenable: s, builder: (context, _) => _bangun(context));
  }

  Widget _bangun(BuildContext context) {
    final w = WarnaPadev.dari(context);
    final p = s.cariProyek(widget.proyekId);
    if (p == null) {
      return Scaffold(
        backgroundColor: w.bg,
        appBar: AppBar(backgroundColor: w.panel, foregroundColor: w.ink),
        body: const Center(child: IsiKosong(ikon: Simbol.folder, judul: 'Proyek tidak lagi diizinkan untuk HP')),
      );
    }
    if (!p.bolehKerjakan && _mode == 'kerjakan') _mode = 'rencana';
    if (_akun != null && !p.akun.contains(_akun)) _akun = null;
    final daftar = s.chat(p.id);
    final aktif = s.tugasAktif(p.id);
    final tim = (p.divisi ?? const []).where((d) => d.status != 'diam').toList();
    // ListView terbalik: indeks 0 = paling bawah (dekat kolom ketik) → keputusan, review, lalu Claude di Mac, lalu chat terbaru
    final sematan = _sematan(context, w, p);

    return Scaffold(
      backgroundColor: w.bg,
      appBar: AppBar(
        backgroundColor: w.panel,
        foregroundColor: w.ink,
        surfaceTintColor: Colors.transparent,
        titleSpacing: 0,
        leading: IconButton(icon: const Icon(Simbol.kembali), tooltip: 'Kembali', onPressed: () => Navigator.of(context).maybePop()),
        title: Row(children: [
          Flexible(child: Text(p.nama, overflow: TextOverflow.ellipsis, style: TextStyle(color: w.ink, fontSize: 18, fontWeight: FontWeight.w800))),
          const SizedBox(width: 8),
          ChipPadev.status(
            context,
            s.macTersambung == false
                ? StatusProyek.tidakDiketahui
                : _keputusan().any((k) => !k.terkirim)
                    ? StatusProyek.menungguIzin
                    : p.status,
          ),
        ]),
        actions: [
          PopupMenuButton<int>(
            icon: const Icon(Simbol.menu),
            tooltip: 'Menu percakapan',
            onSelected: (v) {
              if (v == 1) {
                s.percakapanBaru(p.id);
                _pesan('Pesan berikutnya memulai percakapan baru.');
              } else {
                _hapusRiwayat(p);
              }
            },
            itemBuilder: (c) => [
              PopupMenuItem(value: 1, child: Row(children: [Icon(Simbol.obrolanBaru, size: 20, color: w.ink), const SizedBox(width: 10), const Text('Percakapan baru')])),
              PopupMenuItem(
                value: 2,
                child: Row(children: [
                  Icon(Simbol.tempatSampah, size: 20, color: w.err),
                  const SizedBox(width: 10),
                  Text('Hapus riwayat', style: TextStyle(color: w.err)),
                ]),
              ),
            ],
          ),
        ],
        bottom: PreferredSize(preferredSize: const Size.fromHeight(1), child: Divider(height: 1, color: w.line)),
      ),
      body: SafeArea(
        top: false,
        bottom: false, // panel ketik sendiri yang mengisi inset bawah (warna panel sampai tepi)
        child: Column(children: [
          if (s.pratinjau) PitaPratinjau(sumber: s),
          if (s.macTersambung == false)
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 10, 12, 0),
              child: Spanduk(
                jenis: JenisSpanduk.galat,
                ikon: Simbol.putus,
                teks: 'Mac tidak tersambung${s.macTerakhir == null ? '' : ' sejak ${jamMenit(s.macTerakhir!)}'}',
                aksi: () => s.segarkan(diam: true),
              ),
            )
          else if (s.tanpaInternet)
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 10, 12, 0),
              child: Spanduk(jenis: JenisSpanduk.netral, ikon: Simbol.tanpaWifi, teks: 'HP tidak ada internet', aksi: () => s.segarkan(diam: true)),
            ),
          if (tim.isNotEmpty) _BarisTim(tim: tim),
          Expanded(
            child: daftar.isEmpty && sematan.isEmpty
                ? Center(
                    child: SingleChildScrollView(
                      child: IsiKosong(
                        ikon: Simbol.obrolan,
                        judul: 'Belum ada percakapan.',
                        teks: 'HP hanya menampilkan perintah yang dikirim dari HP.',
                        aksi: ActionChip(
                          backgroundColor: w.panel,
                          side: BorderSide(color: w.line),
                          label: Text.rich(TextSpan(style: TeksPadev.redup(w), children: [
                            const TextSpan(text: 'Coba: '),
                            TextSpan(text: "'cek kenapa export Excel lambat'", style: TextStyle(color: w.ink, fontWeight: FontWeight.w700)),
                          ])),
                          onPressed: () {
                            _ketik.text = 'cek kenapa export Excel lambat';
                            _fokus.requestFocus();
                          },
                        ),
                      ),
                    ),
                  )
                : ListView.builder(
                    reverse: true,
                    padding: const EdgeInsets.fromLTRB(12, 2, 12, 12),
                    itemCount: sematan.length + daftar.length,
                    itemBuilder: (c, j) => j < sematan.length ? sematan[j] : _ButirTugas(
                      tugas: daftar[daftar.length - 1 - (j - sematan.length)],
                      onKirimUlang: (t) async {
                        try {
                          await s.kirimUlang(t);
                        } on GalatKunci catch (e) {
                          _pesan(e.kode == 'dibatalkan' ? 'Dibatalkan.' : e.pesan);
                        }
                      },
                    ),
                  ),
          ),
          _panelKetik(w, p, aktif),
        ]),
      ),
    );
  }

  Widget _panelKetik(WarnaPadev w, Proyek p, Tugas? aktif) {
    final akun = _akun ?? (p.akun.isEmpty ? '' : p.akun.first);
    final macPutus = s.macTersambung == false;
    final sibukLain = p.sibuk && aktif == null;
    final bisaKetik = !macPutus && !sibukLain && aktif == null;
    final panjang = _ketik.text.length;
    String petunjuk = daftarKosong(p) ? 'Tulis perintah…' : 'Tulis perintah lanjutan…';
    if (macPutus) petunjuk = 'Menunggu Mac tersambung…';
    if (sibukLain) petunjuk = 'Proyek sedang mengerjakan tugas lain';
    if (aktif != null) petunjuk = 'Tunggu tugas ini selesai…';

    return Container(
      decoration: BoxDecoration(color: w.panel, border: Border(top: BorderSide(color: w.line))),
      padding: EdgeInsets.fromLTRB(12, 10, 12, 10 + MediaQuery.paddingOf(context).bottom),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [
          Expanded(
            child: Segmen<String>(
              label: 'Mode perintah',
              pilihan: const [('rencana', Simbol.daftarCek, 'Rencana saja'), ('kerjakan', Simbol.kilat, 'Kerjakan')],
              nilai: _mode,
              sorot: 'kerjakan',
              nonaktif: p.bolehKerjakan ? const {} : const {'kerjakan'},
              onUbah: (v) => setState(() => _mode = v),
            ),
          ),
          const SizedBox(width: 8),
          PopupMenuButton<String>(
            tooltip: 'Pilih akun',
            enabled: p.akun.length > 1,
            onSelected: (v) => setState(() => _akun = v),
            itemBuilder: (c) => [for (final a in p.akun) PopupMenuItem(value: a, child: Text(namaAkun(a)))],
            child: ConstrainedBox(
              constraints: const BoxConstraints(minHeight: 48, minWidth: 48),
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                Icon(Simbol.akun, size: 16, color: w.muted),
                const SizedBox(width: 4),
                Text(namaAkun(akun), style: TextStyle(color: w.ink, fontSize: 13, fontWeight: FontWeight.w600)),
                if (p.akun.length > 1) Icon(Simbol.bawah, size: 18, color: w.muted),
              ]),
            ),
          ),
        ]),
        if (!p.bolehKerjakan)
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Text('Kerjakan belum diizinkan untuk proyek ini (nyalakan di laptop).', style: TeksPadev.redup(w, ukuran: 12)),
          ),
        if (s.baruBerikutnya(p.id))
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Row(children: [
              Icon(Simbol.obrolanBaru, size: 14, color: w.accent),
              const SizedBox(width: 4),
              Text('Pesan berikutnya memulai percakapan baru', style: TextStyle(color: w.accent, fontSize: 12, fontWeight: FontWeight.w600)),
            ]),
          ),
        if (aktif != null && aktif.tahap == TahapTugas.bekerja) _BarisTimer(tugas: aktif, batasMenit: aktif.batasMenit ?? p.batasMenit),
        const SizedBox(height: 8),
        Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
          Expanded(
            child: TextField(
              controller: _ketik,
              focusNode: _fokus,
              enabled: bisaKetik,
              minLines: 1,
              maxLines: 5,
              textCapitalization: TextCapitalization.sentences,
              enableIMEPersonalizedLearning: false, // SEC-79: isi perintah tidak masuk kamus/riwayat keyboard
              inputFormatters: [LengthLimitingTextInputFormatter(_batasPesan)],
              style: TextStyle(color: w.ink, fontSize: 14.5),
              decoration: InputDecoration(
                hintText: petunjuk,
                hintStyle: TextStyle(color: w.muted),
                filled: true,
                fillColor: bisaKetik ? w.panel : w.chip,
                isDense: true,
                contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 13),
                counterText: '',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: w.line)),
                enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: w.line)),
                disabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: w.line)),
                focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: w.accent, width: 1.5)),
              ),
            ),
          ),
          const SizedBox(width: 8),
          if (aktif != null && (aktif.tahap == TahapTugas.bekerja || aktif.tahap == TahapTugas.diterima))
            SizedBox(
              height: 48,
              child: FilledButton(
                style: gayaBahaya(w).copyWith(minimumSize: const WidgetStatePropertyAll(Size(0, 48))),
                onPressed: () async {
                  try {
                    await s.hentikan(aktif);
                    _pesan('Permintaan berhenti dikirim.');
                  } on GalatKunci catch (e) {
                    _pesan(e.pesan);
                  }
                },
                child: const IsiTombol(Simbol.henti, 'Hentikan'),
              ),
            )
          else
            Semantics(
              button: true,
              label: _mode == 'kerjakan' ? 'Kirim (Kerjakan)' : 'Kirim',
              excludeSemantics: true,
              child: SizedBox(
                width: 48,
                height: 48,
                child: FilledButton(
                  style: (_mode == 'kerjakan' ? gayaKerjakan(w) : FilledButton.styleFrom()).copyWith(
                    padding: const WidgetStatePropertyAll(EdgeInsets.zero),
                    minimumSize: const WidgetStatePropertyAll(Size(48, 48)),
                  ),
                  onPressed: bisaKetik && panjang > 0 && !_mengirim ? () => _kirim(p) : null,
                  child: _mengirim
                      ? SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: w.muted))
                      : Icon(_mode == 'kerjakan' ? Simbol.kilat : Simbol.kirim, size: 20),
                ),
              ),
            ),
        ]),
        if (panjang > 0)
          Padding(
            padding: const EdgeInsets.only(top: 4, right: 56),
            child: Text('$panjang/$_batasPesan',
                textAlign: TextAlign.right, style: TextStyle(color: panjang >= _batasPesan ? w.err : w.muted, fontSize: 11.5)),
          ),
      ]),
    );
  }

  bool daftarKosong(Proyek p) => s.chat(p.id).isEmpty;
}

class _BarisTim extends StatelessWidget {
  const _BarisTim({required this.tim});
  final List<Divisi> tim;
  @override
  Widget build(BuildContext context) {
    final w = WarnaPadev.dari(context);
    return Container(
      width: double.infinity,
      color: w.panel,
      padding: const EdgeInsets.fromLTRB(14, 8, 14, 10),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('Tim sedang bekerja', style: TeksPadev.label(w)),
        const SizedBox(height: 6),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(children: [
            for (final d in tim)
              Padding(
                padding: const EdgeInsets.only(right: 14),
                child: Semantics(
                  label: '${d.nama}, ${d.peranTampil}, ${d.status == 'menunggu_izin' ? 'menunggu izin' : d.status}',
                  excludeSemantics: true,
                  child: Row(children: [
                    AvatarDivisi(nama: d.nama, aktif: d.status == 'bekerja', ukuran: 30),
                    const SizedBox(width: 6),
                    Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(d.nama, style: TextStyle(color: w.ink, fontSize: 12.5, fontWeight: FontWeight.w700)),
                      Text(d.peranTampil, style: TeksPadev.redup(w, ukuran: 11)),
                    ]),
                  ]),
                ),
              ),
          ]),
        ),
      ]),
    );
  }
}

class _BarisTimer extends StatelessWidget {
  const _BarisTimer({required this.tugas, this.batasMenit});
  final Tugas tugas;
  final int? batasMenit;
  @override
  Widget build(BuildContext context) {
    final w = WarnaPadev.dari(context);
    final jalan = DateTime.now().difference(tugas.mulai ?? tugas.dibuat);
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Row(children: [
        Container(width: 8, height: 8, decoration: BoxDecoration(color: w.accent, shape: BoxShape.circle)),
        const SizedBox(width: 6),
        Text.rich(TextSpan(style: TeksPadev.redup(w, ukuran: 12.5), children: [
          TextSpan(text: tugas.mode == 'kerjakan' ? 'Bekerja (Kerjakan) · ' : 'Bekerja · '),
          TextSpan(text: lamaJalan(jalan), style: TextStyle(color: w.ink, fontWeight: FontWeight.w800, fontFeatures: const [FontFeature.tabularFigures()])),
          if (batasMenit != null) TextSpan(text: ' / batas ${lamaJalan(Duration(minutes: batasMenit!))}'),
        ])),
      ]),
    );
  }
}

class _ButirTugas extends StatelessWidget {
  const _ButirTugas({required this.tugas, required this.onKirimUlang});
  final Tugas tugas;
  final ValueChanged<Tugas> onKirimUlang;

  static (IconData, String) _alat(String a) => alatTampil(a);

  @override
  Widget build(BuildContext context) {
    final w = WarnaPadev.dari(context);
    final t = tugas;
    final anak = <Widget>[
      // Gelembung pesan saya
      Align(
        alignment: Alignment.centerRight,
        child: ConstrainedBox(
          constraints: BoxConstraints(maxWidth: MediaQuery.sizeOf(context).width * .8),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
            decoration: BoxDecoration(
              color: t.tahap == TahapTugas.gagalKirim ? w.muted : w.btn,
              borderRadius: const BorderRadius.only(
                  topLeft: Radius.circular(14), topRight: Radius.circular(14), bottomLeft: Radius.circular(14), bottomRight: Radius.circular(4)),
            ),
            child: Text(t.pesan, style: TextStyle(color: w.btnt, fontSize: 14, height: 1.4)),
          ),
        ),
      ),
      Align(
        alignment: Alignment.centerRight,
        child: Padding(
          padding: const EdgeInsets.only(top: 3, right: 2),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            if (t.mode == 'kerjakan') Icon(Simbol.kilat, size: 12, color: w.warnt),
            Text('${t.mode == 'kerjakan' ? 'Kerjakan' : 'Rencana'} · ${namaAkun(t.akun)} · ${jamMenit(t.dibuat)}${t.baru ? ' · percakapan baru' : ''}',
                style: TeksPadev.redup(w, ukuran: 11)),
          ]),
        ),
      ),
    ];

    void baris(Widget x) => anak.add(Padding(padding: const EdgeInsets.only(top: 8), child: x));

    switch (t.tahap) {
      case TahapTugas.mengirim:
        baris(_StatusKecil(ikon: null, teks: t.mode == 'kerjakan' ? 'Menunggu sidik jari & mengirim…' : 'Mengirim…'));
      case TahapTugas.gagalKirim:
        baris(Align(
          alignment: Alignment.centerRight,
          child: Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
            Row(mainAxisSize: MainAxisSize.min, children: [
              Icon(Simbol.galatLingkar, size: 14, color: w.err),
              const SizedBox(width: 4),
              Flexible(child: Text('Gagal terkirim${t.alasan == null ? '' : ' · ${t.alasan}'}', style: TextStyle(color: w.err, fontSize: 12, fontWeight: FontWeight.w600))),
            ]),
            const SizedBox(height: 6),
            OutlinedButton(
              style: OutlinedButton.styleFrom(minimumSize: const Size(0, 40)),
              onPressed: () => onKirimUlang(t),
              child: const IsiTombol(Simbol.segarkan, 'Coba lagi'),
            ),
          ]),
        ));
      case TahapTugas.menungguDiambil:
        final lama = DateTime.now().difference(t.dibuat) > const Duration(seconds: 5);
        baris(_StatusKecil(
          ikon: Simbol.pasir,
          teks: lama
              ? 'Mac belum mengambil perintah. Berlaku sampai ${t.kedaluwarsa == null ? '-' : jamMenit(t.kedaluwarsa!)}.'
              : 'Menunggu diambil Mac…',
        ));
      case TahapTugas.diterima:
        baris(const _StatusKecil(ikon: Simbol.pasir, teks: 'Diterima Mac, menunggu mulai…'));
      default:
        break;
    }

    for (final a in t.alat) {
      final (ikon, label) = _alat(a.alat);
      final ubah = label == 'Mengubah';
      baris(Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Icon(ikon, size: 15, color: ubah ? w.warnt : w.muted),
        const SizedBox(width: 6),
        Expanded(
          child: Text.rich(TextSpan(children: [
            TextSpan(text: '$label · ', style: TextStyle(color: ubah ? w.warnt : w.muted, fontSize: 12.5)),
            TextSpan(text: a.ringkas, style: TeksPadev.mono(ubah ? w.warnt : w.muted)),
          ])),
        ),
      ]));
    }

    final teks = t.teks.toString();
    if (teks.isNotEmpty || t.tahap == TahapTugas.bekerja) {
      baris(Align(
        alignment: Alignment.centerLeft,
        child: ConstrainedBox(
          constraints: BoxConstraints(maxWidth: MediaQuery.sizeOf(context).width * .86),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(
              color: w.panel,
              border: Border.all(color: w.line),
              borderRadius: const BorderRadius.only(
                  topLeft: Radius.circular(14), topRight: Radius.circular(14), bottomRight: Radius.circular(14), bottomLeft: Radius.circular(4)),
            ),
            child: Semantics(
              liveRegion: t.tahap == TahapTugas.selesai,
              child: Text.rich(TextSpan(children: [
                TextSpan(text: teks.isEmpty ? 'Claude sedang bekerja' : teks, style: TextStyle(color: teks.isEmpty ? w.muted : w.ink, fontSize: 14, height: 1.45)),
                if (t.tahap == TahapTugas.bekerja)
                  WidgetSpan(
                    alignment: PlaceholderAlignment.middle,
                    child: Padding(padding: const EdgeInsets.only(left: 3), child: Container(width: 7, height: 15, color: w.accent)),
                  ),
              ])),
            ),
          ),
        ),
      ));
    }

    switch (t.tahap) {
      case TahapTugas.selesai:
        baris(_Kotak(
          fg: w.okt,
          bg: w.okb,
          ikon: Simbol.centangLingkar,
          teks: 'Selesai${t.durasi == null ? '' : ' · ${durasiBaca(t.durasi!)}'}',
        ));
        if (t.ditolak.isNotEmpty) {
          baris(_Kotak(
            fg: w.err,
            bg: w.errb,
            ikon: Simbol.larang,
            teks: '${t.ditolak.length} langkah ditolak (butuh izin): ',
            mono: t.ditolak.map((d) => '${d.alat} ${d.ringkas}').join('\n'),
          ));
        }
      case TahapTugas.gagal:
        baris(_Kotak(fg: w.err, bg: w.errb, ikon: Simbol.galatLingkar, teks: 'Gagal${t.alasan == null ? '' : ': ${t.alasan}'}'));
      case TahapTugas.dihentikan:
        baris(_Kotak(fg: w.ink, bg: w.chip, ikon: Simbol.henti, teks: 'Dihentikan'));
      case TahapTugas.batasWaktu:
        baris(_Kotak(
            fg: w.warnt, bg: w.warnb, ikon: Simbol.jam, teks: 'Dihentikan otomatis: batas waktu${t.batasMenit == null ? '' : ' ${t.batasMenit} mnt'}'));
      case TahapTugas.ditolak:
        baris(_Kotak(
          fg: w.err,
          bg: w.errb,
          ikon: Simbol.larang,
          teks: 'Ditolak Mac${t.alasan == null ? '' : ': ${t.alasan}'}',
        ));
      case TahapTugas.kedaluwarsa:
        baris(Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          _Kotak(
            fg: w.warnt,
            bg: w.warnb,
            ikon: Simbol.jam,
            teks: 'Tidak diambil Mac sebelum kedaluwarsa (${t.mode == 'kerjakan' ? '3' : '10'} mnt). Perintah dibatalkan.',
          ),
          const SizedBox(height: 6),
          Align(
            alignment: Alignment.centerRight,
            child: OutlinedButton(
              style: OutlinedButton.styleFrom(minimumSize: const Size(0, 40)),
              onPressed: () => onKirimUlang(t),
              child: const IsiTombol(Simbol.segarkan, 'Kirim ulang'),
            ),
          ),
        ]));
      default:
        break;
    }

    return Padding(
      padding: const EdgeInsets.only(bottom: 18),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: anak),
    );
  }
}

class _StatusKecil extends StatelessWidget {
  const _StatusKecil({required this.ikon, required this.teks});
  final IconData? ikon;
  final String teks;
  @override
  Widget build(BuildContext context) {
    final w = WarnaPadev.dari(context);
    return Semantics(
      liveRegion: true,
      child: Row(children: [
        if (ikon == null)
          SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: w.muted))
        else
          Icon(ikon, size: 15, color: w.muted),
        const SizedBox(width: 6),
        Expanded(child: Text(teks, style: TeksPadev.redup(w, ukuran: 12.5))),
      ]),
    );
  }
}

class _Kotak extends StatelessWidget {
  const _Kotak({required this.fg, required this.bg, required this.ikon, required this.teks, this.mono});
  final Color fg, bg;
  final IconData ikon;
  final String teks;
  final String? mono;
  @override
  Widget build(BuildContext context) => Semantics(
        liveRegion: true,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(12)),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Icon(ikon, size: 16, color: fg),
            const SizedBox(width: 8),
            Expanded(
              child: Text.rich(TextSpan(children: [
                TextSpan(text: teks, style: TextStyle(color: fg, fontSize: 13, fontWeight: FontWeight.w700, height: 1.4)),
                if (mono != null) TextSpan(text: mono, style: TeksPadev.mono(fg, ukuran: 12)),
              ])),
            ),
          ]),
        ),
      );
}
