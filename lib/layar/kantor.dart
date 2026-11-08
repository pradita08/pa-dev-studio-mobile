// L10 Kantor (G8, KONTRAK-apk-v2 §10.13): Segmen Agen | Rekap. Agen = alur kerja LIVE per proyek — Kepala, kartu agen yang sedang
// bekerja (ketuk = lembar detail), alur tahap divisi, linimasa. Data = `status.kantor` (kejadian hook laptop tanpa isi + `detail`
// alat ≤80 huruf yang sudah disamarkan Mac; HP menarik status tiap 4 dtk selama tab ini terlihat) dipetakan alur.dart.
// Rekap = rekap.dart (`status.rekap`). Kantor 3D (WebView) dibuang.
import 'package:flutter/material.dart';

import '../komponen/komponen.dart';
import '../tema/token.dart';
import 'alur.dart';
import 'data.dart';
import 'rekap.dart';

class LayarKantor extends StatefulWidget {
  const LayarKantor({super.key, required this.sumber, required this.onBukaChat, this.aktif = true});
  final SumberData sumber;
  final ValueChanged<String> onBukaChat;

  /// Tab Kantor sedang terlihat (status ditarik lebih sering).
  final bool aktif;

  @override
  State<LayarKantor> createState() => _LayarKantorState();
}

class _LayarKantorState extends State<LayarKantor> {
  String? _pilih;
  bool _rekap = false; // pilihan segmen hanya di memori

  @override
  void initState() {
    super.initState();
    NamaPegawai.muat().then((_) {
      if (mounted) setState(() {});
    });
    widget.sumber.kantorTerlihat = widget.aktif;
  }

  @override
  void didUpdateWidget(LayarKantor lama) {
    super.didUpdateWidget(lama);
    widget.sumber.kantorTerlihat = widget.aktif;
  }

  @override
  void dispose() {
    widget.sumber.kantorTerlihat = false;
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final w = WarnaPadev.dari(context);
    final s = widget.sumber;
    final kepala = Padding(
      padding: EdgeInsets.fromLTRB(18, MediaQuery.paddingOf(context).top + 8, 14, 8),
      child: Semantics(header: true, child: Text('Kantor', style: TeksPadev.judulLayar(w))),
    );
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      kepala,
      Padding(
        padding: const EdgeInsets.fromLTRB(14, 0, 14, 10),
        child: Segmen<bool>(
          label: 'Tampilan kantor',
          pilihan: const [(false, Simbol.tim, 'Agen'), (true, Simbol.grafik, 'Rekap')],
          nilai: _rekap,
          onUbah: (v) => setState(() => _rekap = v),
        ),
      ),
      if (s.macTersambung == false)
        Padding(
          padding: const EdgeInsets.fromLTRB(14, 0, 14, 10),
          child: Spanduk(
            jenis: JenisSpanduk.netral,
            ikon: Simbol.tanpaWifi,
            teks: 'Mac tidak tersambung${s.macTerakhir == null ? '' : ' · data terakhir ${jamMenit(s.macTerakhir!)}'}',
          ),
        ),
      Expanded(child: _rekap ? LayarRekap(sumber: s) : _alur(context, w, s)),
    ]);
  }

  Widget _alur(BuildContext context, WarnaPadev w, SumberData s) {
    final kejadian = s.kantor ?? const <Map<String, Object?>>[];
    final daftar = s.proyek;
    final id = (_pilih != null && daftar.any((p) => p.id == _pilih)) ? _pilih : (AlurKerja.proyekTerbaru(kejadian) ?? daftar.firstOrNull?.id);
    final p = id == null ? null : s.cariProyek(id);
    final alur = id == null ? null : AlurKerja.dari(kejadian, id);
    // urutan kartu: menunggu izin → bekerja → ditugaskan
    const urut = [StatusAlur.menungguIzin, StatusAlur.bekerja, StatusAlur.ditugaskan];
    final aktif = [for (final d in alur?.divisi.values ?? const <DivisiAlur>[]) if (urut.contains(d.status)) d]
      ..sort((a, b) => urut.indexOf(a.status).compareTo(urut.indexOf(b.status)));

    return ListView(
      padding: const EdgeInsets.fromLTRB(14, 0, 14, 24),
      children: [
        if (daftar.length > 1)
          SizedBox(
            height: 44,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: daftar.length,
              separatorBuilder: (_, _) => const SizedBox(width: 8),
              itemBuilder: (c, i) {
                final x = daftar[i];
                final jalan = AlurKerja.dari(kejadian, x.id).berjalan;
                return ChoiceChip(
                  selected: x.id == id,
                  onSelected: (_) => setState(() => _pilih = x.id),
                  avatar: jalan ? _Denyut(child: Icon(Icons.circle, size: 10, color: w.ok)) : null,
                  label: Text(x.nama),
                );
              },
            ),
          ),
        const SizedBox(height: 10),
        if (s.kantor == null && daftar.isNotEmpty && !s.pratinjau)
          const Padding(
            padding: EdgeInsets.only(bottom: 10),
            child: Spanduk(jenis: JenisSpanduk.netral, ikon: Simbol.info, teks: 'Alur kerja live butuh pelaksana terbaru di Mac (git pull, lalu mulai ulang pelaksana).'),
          ),
        if (p == null)
          const IsiKosong(ikon: Simbol.kantor, judul: 'Belum ada proyek untuk HP', teks: 'Izinkan proyek untuk HP di konfigurasi pelaksana di laptop.')
        else if (alur == null || alur.kosong)
          IsiKosong(
            ikon: Simbol.tidur,
            judul: 'Kantor ${p.nama} sedang santai',
            teks: 'Begitu Anda memberi perintah ke Claude (di laptop atau dari HP), alurnya tampil di sini secara langsung: '
                'Kepala menerima perintah, divisi ditugaskan, bekerja, sampai selesai.',
            aksi: OutlinedButton(onPressed: () => widget.onBukaChat(p.id), child: Text('Beri perintah ke ${p.nama}')),
          )
        else ...[
          _KartuKepala(alur: alur, w: w),
          if (aktif.isNotEmpty) ...[
            const SizedBox(height: 4),
            JudulBagian('SEDANG BEKERJA · ${aktif.length}'),
            for (final d in aktif)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: KartuAgen(d: d, rekap: s.rekap, onTap: () => _detail(context, d, alur, p)),
              ),
          ],
          const SizedBox(height: 14),
          JudulBagian('Alur kerja divisi${alur.aktif > 0 ? ' · ${alur.aktif} bekerja' : ''}'),
          Kartu(anak: Column(children: [
            for (final (i, (judul, kunci)) in tahapAlur.indexed)
              _BarisTahap(judul: judul, divisi: [for (final k in kunci) alur.divisi[k] ?? DivisiAlur(k)], terakhir: i == tahapAlur.length - 1, w: w),
          ])),
          if (alur.pendukung.isNotEmpty) ...[
            const SizedBox(height: 14),
            const JudulBagian('Tim pendukung'),
            KartuDaftar(anak: [for (final d in alur.pendukung) _BarisDivisi(d: d, w: w)]),
          ],
          const SizedBox(height: 14),
          const JudulBagian('Linimasa'),
          Kartu(anak: Column(children: [for (final b in alur.linimasa) _BarisLinimasa(b: b, w: w)])),
        ],
      ],
    );
  }

  void _detail(BuildContext context, DivisiAlur d, AlurKerja alur, Proyek p) => bukaLembar<void>(context, (c) {
        final w = WarnaPadev.dari(c);
        final g = _gaya(d.status, w);
        final (judul, peran) = _namaAgen(d);
        final rekap = widget.sumber.rekap;
        final kunci = _kunciRekap(d);
        // shortcut: linimasa dicocokkan lewat nama tampil (ButirLinimasa tanpa kunci agen); tambah kunci di alur.dart bila salah cocok
        final jejak = alur.linimasa.where((b) => b.teks.contains(d.nama)).take(10).toList();
        return Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
          Row(children: [
            AvatarDivisi(nama: judul, aktif: d.status == StatusAlur.bekerja, ukuran: 44),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Semantics(header: true, child: Text(judul, style: TextStyle(color: w.ink, fontSize: 18, fontWeight: FontWeight.w800))),
                Text('$peran · ${p.nama}', style: TeksPadev.redup(w)),
              ]),
            ),
            const SizedBox(width: 8),
            ChipPadev(ikon: g.ikon, label: g.label, fg: g.fg, bg: g.bg),
          ]),
          const JudulBagian('SEDANG APA'),
          Text(d.aktivitas ?? 'Belum ada kegiatan', style: TeksPadev.isi(w)),
          if (d.detail != null) Padding(padding: const EdgeInsets.only(top: 2), child: Text(d.detail!, style: TeksPadev.mono(w.muted))),
          if (d.mulai != null)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text('Mulai ${_jam(d.mulai!)} · ${d.jumlahAlat} langkah', style: TeksPadev.redup(w, ukuran: 12)),
            ),
          JudulBagian('TOKEN 7 HARI · ${d.divisi ? 'DIVISI INI' : 'JENIS AGEN INI'}'),
          if (rekap == null)
            Text('Token 7 hari belum tersedia (butuh pelaksana terbaru di Mac).', style: TeksPadev.redup(w))
          else ...[
            Text('${tokenBaca(rekap.token7Hari(kunci))} token', style: TeksPadev.judulKartu(w)),
            const SizedBox(height: 8),
            GrafikBatang(
              nilai: rekap.harianAgen(kunci),
              label: labelHari(rekap),
              semantik: semantikGrafik('Token per hari', labelHari(rekap), rekap.harianAgen(kunci)),
              tinggi: 90,
            ),
          ],
          if (jejak.isNotEmpty) ...[
            const JudulBagian('LINIMASA'),
            for (final b in jejak) _BarisLinimasa(b: b, w: w),
          ],
          const SizedBox(height: 16),
          OutlinedButton(
            onPressed: () {
              Navigator.of(c).pop();
              widget.onBukaChat(p.id);
            },
            child: Text('Buka chat ${p.nama}'),
          ),
        ]);
      });
}

/// Kunci agen di `status.rekap`: divisi `p` → 'divisi-p' (token per JENIS agen, bukan per pegawai); pendukung → nama agennya.
String _kunciRekap(DivisiAlur d) => d.divisi ? 'divisi-${d.kunci}' : d.kunci.toLowerCase();

/// (judul kartu, peran): nama pegawai bila dikenal.
(String, String) _namaAgen(DivisiAlur d) {
  final orang = d.divisi ? NamaPegawai.cari(d.kunci) : null;
  return (orang ?? (d.divisi ? 'Divisi ${d.nama}' : d.nama), d.divisi ? d.nama : 'Agen pendukung');
}

/// Kartu agen yang sedang bekerja (Kantor › Agen): nama, divisi, status, sedang apa, token 7 hari jenis agen ini. Ketuk = lembar detail.
class KartuAgen extends StatelessWidget {
  const KartuAgen({super.key, required this.d, required this.rekap, required this.onTap});
  final DivisiAlur d;
  final RekapAgen? rekap;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final w = WarnaPadev.dari(context);
    final g = _gaya(d.status, w);
    final (judul, peran) = _namaAgen(d);
    final apa = [?d.aktivitas, ?d.detail].join(' · ');
    final kunci = _kunciRekap(d);
    final r = rekap;
    final teksToken = r == null ? 'Token 7 hari belum tersedia' : '${tokenBaca(r.token7Hari(kunci))} token 7 hari · ${d.divisi ? 'divisi ini' : 'jenis agen ini'}';
    final chip = ChipPadev(ikon: g.ikon, label: g.label, fg: g.fg, bg: g.bg);
    return Kartu(
      onTap: onTap,
      semantik: '$judul, $peran, ${g.label}${apa.isEmpty ? '' : ', $apa'}, $teksToken. Ketuk untuk detail',
      anak: ExcludeSemantics(
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          AvatarDivisi(nama: judul, aktif: d.status == StatusAlur.bekerja),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Expanded(child: Text(judul, maxLines: 1, overflow: TextOverflow.ellipsis, style: TeksPadev.judulKartu(w))),
                const SizedBox(width: 8),
                d.status == StatusAlur.bekerja ? _Denyut(child: chip) : chip,
              ]),
              Text(peran, style: TeksPadev.redup(w, ukuran: 12)),
              if (apa.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 2),
                  child: Text(apa, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(color: w.ink, fontSize: 13)),
                ),
              const SizedBox(height: 6),
              Row(children: [
                if (r != null) ...[BatangMini(r.harianAgen(kunci)), const SizedBox(width: 8)],
                Expanded(child: Text(teksToken, maxLines: 1, overflow: TextOverflow.ellipsis, style: TeksPadev.redup(w, ukuran: 12))),
              ]),
            ]),
          ),
        ]),
      ),
    );
  }
}

String _jam(DateTime d) => '${d.hour.toString().padLeft(2, '0')}.${d.minute.toString().padLeft(2, '0')}';

String _durasi(Duration d) => d.inMinutes < 1 ? '${d.inSeconds} dtk' : d.inHours < 1 ? '${d.inMinutes} mnt' : '${d.inHours} j ${d.inMinutes % 60} mnt';

({IconData ikon, String label, Color fg, Color bg}) _gaya(StatusAlur s, WarnaPadev w) => switch (s) {
      StatusAlur.bekerja => (ikon: Simbol.putar, label: 'Bekerja', fg: w.accent, bg: w.accb),
      StatusAlur.ditugaskan => (ikon: Simbol.pasir, label: 'Ditugaskan', fg: w.accent, bg: w.accb),
      StatusAlur.menungguIzin => (ikon: Simbol.tangan, label: 'Menunggu izin', fg: w.warnt, bg: w.warnb),
      StatusAlur.selesai => (ikon: Simbol.centangLingkar, label: 'Selesai', fg: w.okt, bg: w.okb),
      StatusAlur.gagal => (ikon: Simbol.galatLingkar, label: 'Gagal', fg: w.err, bg: w.errb),
      StatusAlur.belum => (ikon: Simbol.tidur, label: 'Belum', fg: w.muted, bg: w.chip),
    };

class _KartuKepala extends StatelessWidget {
  const _KartuKepala({required this.alur, required this.w});
  final AlurKerja alur;
  final WarnaPadev w;

  @override
  Widget build(BuildContext context) {
    final g = _gaya(alur.kepala == StatusAlur.belum ? StatusAlur.belum : alur.kepala, w);
    final mulai = alur.mulai, selesai = alur.selesai;
    final waktu = mulai == null
        ? null
        : selesai != null && !alur.berjalan
            ? 'Perintah ${_jam(mulai)} · selesai ${_jam(selesai)} (${_durasi(selesai.difference(mulai))})'
            : 'Perintah ${_jam(mulai)} · berjalan ${_durasi(DateTime.now().difference(mulai))}';
    return Kartu(
      anak: Row(children: [
        Container(
          width: 44,
          height: 44,
          alignment: Alignment.center,
          decoration: BoxDecoration(color: const Color(0xFFC9A227).withValues(alpha: .18), shape: BoxShape.circle),
          child: const Text('👑', style: TextStyle(fontSize: 22)),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Claude · Kepala', style: TextStyle(color: w.ink, fontSize: 15, fontWeight: FontWeight.w800)),
            if (alur.aktivitasKepala != null) Text(alur.aktivitasKepala!, style: TeksPadev.redup(w, ukuran: 13)),
            if (alur.detailKepala != null && alur.berjalan)
              Text(alur.detailKepala!, maxLines: 1, overflow: TextOverflow.ellipsis, style: TeksPadev.mono(w.muted)),
            if (waktu != null) Text(waktu, style: TeksPadev.redup(w, ukuran: 12)),
          ]),
        ),
        const SizedBox(width: 8),
        alur.berjalan ? _Denyut(child: ChipPadev(ikon: g.ikon, label: g.label, fg: g.fg, bg: g.bg)) : ChipPadev(ikon: g.ikon, label: g.label, fg: g.fg, bg: g.bg),
      ]),
    );
  }
}

class _BarisTahap extends StatelessWidget {
  const _BarisTahap({required this.judul, required this.divisi, required this.terakhir, required this.w});
  final String judul;
  final List<DivisiAlur> divisi;
  final bool terakhir;
  final WarnaPadev w;

  @override
  Widget build(BuildContext context) {
    final aktif = divisi.any((d) => d.status == StatusAlur.bekerja || d.status == StatusAlur.ditugaskan || d.status == StatusAlur.menungguIzin);
    final terlibat = divisi.where((d) => d.status != StatusAlur.belum).toList();
    final selesai = terlibat.isNotEmpty && terlibat.every((d) => d.status == StatusAlur.selesai);
    final warna = aktif ? w.accent : selesai ? w.ok : w.line;
    final simpul = Container(
      width: 22,
      height: 22,
      alignment: Alignment.center,
      decoration: BoxDecoration(color: aktif || selesai ? warna : w.panel, shape: BoxShape.circle, border: Border.all(color: warna, width: 2)),
      child: selesai ? Icon(Simbol.centang, size: 14, color: w.btnt) : null,
    );
    return IntrinsicHeight(
      child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        SizedBox(
          width: 26,
          child: Column(children: [
            aktif ? _Denyut(child: simpul) : simpul,
            if (!terakhir) Expanded(child: Container(width: 2, color: selesai ? w.ok : w.line)),
          ]),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Padding(
            padding: EdgeInsets.only(bottom: terakhir ? 0 : 14),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(judul, style: TextStyle(color: aktif || selesai ? w.ink : w.muted, fontSize: 13.5, fontWeight: FontWeight.w800)),
              const SizedBox(height: 6),
              for (final d in divisi) _BarisDivisi(d: d, w: w, ringkas: true),
            ]),
          ),
        ),
      ]),
    );
  }
}

class _BarisDivisi extends StatelessWidget {
  const _BarisDivisi({required this.d, required this.w, this.ringkas = false});
  final DivisiAlur d;
  final WarnaPadev w;
  final bool ringkas;

  @override
  Widget build(BuildContext context) {
    final g = _gaya(d.status, w);
    final orang = d.divisi ? NamaPegawai.cari(d.kunci) : null;
    final redup = d.status == StatusAlur.belum;
    final sub = [
      ?orang,
      if (d.aktivitas != null && !redup) d.aktivitas!,
      if (d.status == StatusAlur.selesai && d.mulai != null && d.selesai != null) _durasi(d.selesai!.difference(d.mulai!)),
    ].join(' · ');
    return Semantics(
      label: '${d.nama}, ${g.label}${sub.isEmpty ? '' : ', $sub'}',
      excludeSemantics: true,
      child: Padding(
        padding: EdgeInsets.symmetric(vertical: ringkas ? 4 : 10, horizontal: ringkas ? 0 : 12),
        child: Row(children: [
          Opacity(opacity: redup ? .45 : 1, child: AvatarDivisi(nama: orang ?? d.nama, aktif: d.status == StatusAlur.bekerja, ukuran: 32)),
          const SizedBox(width: 10),
          Expanded(
            child: Opacity(
              opacity: redup ? .55 : 1,
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(d.divisi ? 'Divisi ${d.nama}' : d.nama, style: TextStyle(color: w.ink, fontSize: 13.5, fontWeight: FontWeight.w700)),
                if (sub.isNotEmpty) Text(sub, maxLines: 1, overflow: TextOverflow.ellipsis, style: TeksPadev.redup(w, ukuran: 12)),
              ]),
            ),
          ),
          if (!redup) ...[
            const SizedBox(width: 6),
            ChipPadev(ikon: g.ikon, label: g.label, fg: g.fg, bg: g.bg),
          ],
        ]),
      ),
    );
  }
}

class _BarisLinimasa extends StatelessWidget {
  const _BarisLinimasa({required this.b, required this.w});
  final ButirLinimasa b;
  final WarnaPadev w;

  @override
  Widget build(BuildContext context) {
    final (ikon, warna) = switch (b.jenis) {
      'perintah' => (Simbol.kirim, w.accent),
      'tugas' => (Simbol.tim, w.accent),
      'mulai' => (Simbol.putar, w.accent),
      'selesai' => (Simbol.centangLingkar, w.ok),
      'lapor' => (Simbol.centangLingkar, w.ok),
      'izin' => (Simbol.tangan, w.warnt),
      _ => (Simbol.galatLingkar, w.err),
    };
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(children: [
        Icon(ikon, size: 16, color: warna),
        const SizedBox(width: 8),
        Expanded(child: Text(b.teks, style: TextStyle(color: w.ink, fontSize: 13))),
        Text(_jam(b.waktu), style: TeksPadev.redup(w, ukuran: 12)),
      ]),
    );
  }
}

/// Denyut lembut untuk yang sedang berjalan (mati bila "kurangi gerakan" aktif).
class _Denyut extends StatefulWidget {
  const _Denyut({required this.child});
  final Widget child;

  @override
  State<_Denyut> createState() => _DenyutState();
}

class _DenyutState extends State<_Denyut> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 1100));

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (MediaQuery.disableAnimationsOf(context)) {
      _c.stop();
      _c.value = 1;
    } else if (!_c.isAnimating) {
      _c.repeat(reverse: true);
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) =>
      FadeTransition(opacity: Tween<double>(begin: .45, end: 1).animate(CurvedAnimation(parent: _c, curve: Curves.easeInOut)), child: widget.child);
}
