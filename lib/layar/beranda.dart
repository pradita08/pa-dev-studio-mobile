// L03 Beranda — tab Proyek: kartu Mac (+ Blok 5 jam bila `limit` ada), cari proyek (nama/id, lokal di HP), kartu proyek,
// tarik-segarkan, kosong, memuat, dan state L08: Mac tidak tersambung, tanpa internet (data terakhir), status belum diterima.
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../komponen/komponen.dart';
import '../kunci/kunci.dart';
import '../tema/token.dart';
import 'data.dart';
import 'keputusan.dart';

/// Proyek yang nama/id-nya memuat kata cari (tanpa beda huruf besar/kecil); kata kosong → semua.
List<Proyek> saringProyek(List<Proyek> proyek, String kata) {
  final k = kata.trim().toLowerCase();
  if (k.isEmpty) return proyek;
  return proyek.where((p) => p.nama.toLowerCase().contains(k) || p.id.toLowerCase().contains(k)).toList();
}

class LayarBeranda extends StatefulWidget {
  const LayarBeranda({super.key, required this.sumber, required this.onBukaChat});
  final SumberData sumber;
  final ValueChanged<String> onBukaChat;

  @override
  State<LayarBeranda> createState() => _LayarBerandaState();
}

class _LayarBerandaState extends State<LayarBeranda> {
  final _ketik = TextEditingController();
  String _kata = '';

  SumberData get sumber => widget.sumber;

  @override
  void dispose() {
    _ketik.dispose();
    super.dispose();
  }

  Future<void> _segarkan(BuildContext context) async {
    try {
      await sumber.segarkan();
    } on GalatKunci catch (e) {
      if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.pesan)));
    }
  }

  @override
  Widget build(BuildContext context) {
    final w = WarnaPadev.dari(context);
    final s = sumber;
    final butir = <Widget>[
      Padding(
        padding: const EdgeInsets.fromLTRB(4, 8, 4, 12),
        child: Semantics(header: true, child: Text('Proyek', style: TeksPadev.judulLayar(w))),
      ),
    ];

    if (s.memuatAwal) {
      butir.addAll([for (var i = 0; i < 4; i++) const Padding(padding: EdgeInsets.only(bottom: 10), child: _KartuKerangka())]);
      butir.add(Center(child: Text('Memuat proyek…', style: TeksPadev.redup(w, ukuran: 12))));
    } else {
      if (s.macTersambung == false) {
        butir.add(Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: Spanduk(
            jenis: JenisSpanduk.galat,
            ikon: Simbol.putus,
            teks: 'Mac tidak tersambung${s.macTerakhir == null ? '' : ' sejak ${jamMenit(s.macTerakhir!)}'}',
            anak: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('Pastikan Mac menyala dan pelaksana berjalan. Perintah tidak bisa dikirim sementara.',
                  style: TextStyle(color: w.ink, fontSize: 13, height: 1.4)),
              const SizedBox(height: 8),
              OutlinedButton(
                style: OutlinedButton.styleFrom(minimumSize: const Size(0, 40)),
                onPressed: () => _segarkan(context),
                child: const IsiTombol(Simbol.segarkan, 'Coba sambungkan'),
              ),
            ]),
          ),
        ));
      } else {
        butir.add(Padding(padding: const EdgeInsets.only(bottom: 10), child: _KartuMac(sumber: s)));
        butir.add(PitaKeputusan(sumber: s)); // F1b: izin/pertanyaan Claude menunggu jawaban HP
      }

      if (s.statusBelumAda) {
        butir.add(Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: Spanduk(
            jenis: JenisSpanduk.peringatan,
            ikon: Simbol.info,
            teks: 'Status proyek belum diterima dari Mac.',
            labelAksi: 'Minta status',
            aksi: () async {
              try {
                await s.mintaStatus();
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Permintaan status dikirim ke Mac.')));
                }
              } on GalatKunci catch (e) {
                if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.pesan)));
              }
            },
          ),
        ));
      } else if (s.proyek.isEmpty) {
        butir.add(const IsiKosong(
          ikon: Simbol.folder,
          judul: 'Belum ada proyek untuk HP',
          teks: 'Izinkan proyek di laptop: setel hp: "rencana" pada proyek di konfigurasi pelaksana, lalu tarik untuk menyegarkan.',
        ));
      }
      if (s.proyek.isNotEmpty) butir.add(Padding(padding: const EdgeInsets.only(bottom: 10), child: _kolomCari(w)));
      final tampil = saringProyek(s.proyek, _kata);
      if (s.proyek.isNotEmpty && tampil.isEmpty) {
        butir.add(IsiKosong(
          ikon: Simbol.cari,
          judul: 'Tidak ada proyek cocok',
          teks: '"${_kata.trim()}" tidak ada di nama proyek.',
        ));
      }
      for (final p in tampil) {
        butir.add(Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: _KartuProyek(proyek: p, macPutus: s.macTersambung == false, onTap: () => widget.onBukaChat(p.id)),
        ));
      }
    }

    return Column(children: [
      if (s.tanpaInternet) _PitaTanpaInternet(terakhir: s.terakhirSegar),
      Expanded(
        child: RefreshIndicator(
          color: w.accent,
          backgroundColor: w.panel,
          onRefresh: () => _segarkan(context),
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
            padding: EdgeInsets.fromLTRB(14, MediaQuery.paddingOf(context).top + 8, 14, 20),
            children: butir,
          ),
        ),
      ),
    ]);
  }

  Widget _kolomCari(WarnaPadev w) => TextField(
        controller: _ketik,
        onChanged: (v) => setState(() => _kata = v),
        textInputAction: TextInputAction.search,
        enableIMEPersonalizedLearning: false,
        inputFormatters: [LengthLimitingTextInputFormatter(40)],
        style: TextStyle(color: w.ink, fontSize: 14.5),
        decoration: InputDecoration(
          hintText: 'Cari proyek',
          hintStyle: TextStyle(color: w.muted),
          prefixIcon: Icon(Simbol.cari, color: w.muted),
          suffixIcon: _kata.isEmpty
              ? null
              : IconButton(
                  tooltip: 'Hapus pencarian',
                  icon: Icon(Simbol.tutup, color: w.muted),
                  onPressed: () => setState(() {
                    _ketik.clear();
                    _kata = '';
                  }),
                ),
          isDense: true,
          filled: true,
          fillColor: w.panel,
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: w.line)),
          enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: w.line)),
          focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: w.accent, width: 1.5)),
        ),
      );
}

class _PitaTanpaInternet extends StatelessWidget {
  const _PitaTanpaInternet({this.terakhir});
  final DateTime? terakhir;
  @override
  Widget build(BuildContext context) {
    final w = WarnaPadev.dari(context);
    return Semantics(
      liveRegion: true,
      child: Container(
        width: double.infinity,
        color: w.chip,
        padding: EdgeInsets.fromLTRB(16, MediaQuery.paddingOf(context).top + 8, 16, 8),
        child: Row(children: [
          Icon(Simbol.tanpaWifi, size: 18, color: w.ink),
          const SizedBox(width: 8),
          Expanded(
            child: Text('Tidak ada internet${terakhir == null ? '' : ' · data terakhir ${jamMenit(terakhir!)}'}',
                style: TextStyle(color: w.ink, fontSize: 13, fontWeight: FontWeight.w700)),
          ),
        ]),
      ),
    );
  }
}

class _KartuMac extends StatelessWidget {
  const _KartuMac({required this.sumber});
  final SumberData sumber;

  @override
  Widget build(BuildContext context) {
    final w = WarnaPadev.dari(context);
    final s = sumber;
    final tahu = s.macTersambung != null && !s.tanpaInternet;
    final rel = waktuRelatif(s.macTerakhir);
    final terakhir = s.macTerakhir == null ? '' : ' · terakhir aktif ${rel == 'baru saja' ? rel : '$rel lalu'}';
    return Kartu(
      anak: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(color: w.chip, borderRadius: BorderRadius.circular(10)),
            child: Icon(Simbol.laptop, color: w.ink, size: 22),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(s.perangkat?.namaMac ?? 'Mac', style: TeksPadev.judulKartu(w), overflow: TextOverflow.ellipsis),
              const SizedBox(height: 2),
              if (tahu)
                Row(children: [
                  Container(width: 8, height: 8, decoration: BoxDecoration(color: w.ok, shape: BoxShape.circle)),
                  const SizedBox(width: 5),
                  Text('Tersambung', style: TextStyle(color: w.okt, fontSize: 12.5, fontWeight: FontWeight.w700)),
                  Flexible(child: Text(terakhir, style: TeksPadev.redup(w, ukuran: 12), overflow: TextOverflow.ellipsis)),
                ])
              else
                Row(children: [
                  Icon(Simbol.info, size: 14, color: w.muted),
                  const SizedBox(width: 4),
                  Text('Status belum bisa dicek', style: TeksPadev.redup(w, ukuran: 12)),
                ]),
            ]),
          ),
        ]),
        for (final l in s.limit ?? const <LimitAkun>[]) ...[
          const SizedBox(height: 12),
          Divider(height: 1, color: w.line),
          const SizedBox(height: 10),
          Semantics(
            label: 'Blok 5 jam ${namaAkun(l.akun)}: ${l.persen.round()} persen${l.reset == null ? '' : ', reset ${l.reset}'}',
            excludeSemantics: true,
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Row(children: [
                Text.rich(TextSpan(style: TeksPadev.redup(w, ukuran: 12), children: [
                  TextSpan(text: (s.limit!.length > 1 && l.akun.isNotEmpty) ? '${namaAkun(l.akun)} · Blok 5 jam: ' : 'Blok 5 jam: '),
                  TextSpan(text: '${l.persen.round()}%', style: TextStyle(color: w.ink, fontWeight: FontWeight.w800)),
                ])),
                const Spacer(),
                if (l.reset != null) Text('reset ${l.reset}', style: TeksPadev.redup(w, ukuran: 12)),
              ]),
              const SizedBox(height: 6),
              ClipRRect(
                borderRadius: BorderRadius.circular(3),
                child: LinearProgressIndicator(
                  value: (l.persen / 100).clamp(0, 1),
                  minHeight: 5,
                  color: l.persen >= 90 ? w.err : (l.persen >= 75 ? w.warn : w.accent),
                ),
              ),
            ]),
          ),
        ],
      ]),
    );
  }
}

class _KartuProyek extends StatelessWidget {
  const _KartuProyek({required this.proyek, required this.macPutus, required this.onTap});
  final Proyek proyek;
  final bool macPutus;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final w = WarnaPadev.dari(context);
    final p = proyek;
    final bekerja = (p.divisi ?? const []).where((d) => d.status != 'diam').toList();
    String? sub;
    if (macPutus) {
      sub = 'Status terakhir: ${_namaStatus(p.status)}';
    } else if (p.status == StatusProyek.menungguIzin) {
      sub = 'Claude butuh izin menjalankan perintah (setujui di laptop)';
    } else if (bekerja.isNotEmpty) {
      sub = bekerja.map((d) => d.peran.isEmpty ? d.nama : '${d.nama} (${d.peranTampil})').join(', ');
    } else if (p.ringkasTerakhir != null) {
      sub = p.ringkasTerakhir;
    }
    final waktu = p.sibuk ? p.mulai : p.terakhir;
    final rel = waktuRelatif(waktu);
    return Kartu(
      onTap: onTap,
      semantik: 'Buka chat ${p.nama}',
      anak: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(child: Text(p.nama, style: TeksPadev.judulKartu(w), overflow: TextOverflow.ellipsis)),
          if (rel.isNotEmpty)
            Text(macPutus && waktu != null ? jamMenit(waktu) : _label(rel, p.sibuk), style: TeksPadev.redup(w, ukuran: 12)),
        ]),
        const SizedBox(height: 8),
        Wrap(spacing: 6, runSpacing: 6, children: [
          macPutus ? ChipPadev.status(context, StatusProyek.tidakDiketahui) : ChipPadev.status(context, p.status),
          if (!p.bolehKerjakan) ChipPadev(ikon: Simbol.daftarCek, label: 'Rencana saja', fg: w.muted, bg: w.chip),
        ]),
        if (sub != null) ...[
          const SizedBox(height: 8),
          Text(sub, style: TeksPadev.redup(w), maxLines: 2, overflow: TextOverflow.ellipsis),
        ],
      ]),
    );
  }

  /// Sedang bekerja → lama berjalan ("4 mnt"); selain itu → "12 mnt lalu" / "kemarin" / "3 Okt".
  static String _label(String rel, bool sibuk) => sibuk || !(rel.endsWith('mnt') || rel.endsWith('jam')) ? rel : '$rel lalu';

  static String _namaStatus(StatusProyek s) => switch (s) {
        StatusProyek.bekerja => 'Bekerja',
        StatusProyek.menungguIzin => 'Menunggu izin',
        StatusProyek.selesai => 'Selesai',
        StatusProyek.gagal => 'Gagal',
        StatusProyek.diam => 'Diam',
        StatusProyek.tidakDiketahui => 'Tidak diketahui',
      };
}

class _KartuKerangka extends StatelessWidget {
  const _KartuKerangka();
  @override
  Widget build(BuildContext context) => ExcludeSemantics(
        child: Kartu(
          anak: Column(crossAxisAlignment: CrossAxisAlignment.start, children: const [
            Kerangka(lebar: 110, tinggi: 14),
            SizedBox(height: 10),
            Kerangka(lebar: 70, tinggi: 18, radius: 9),
            SizedBox(height: 10),
            Kerangka(lebar: 190),
          ]),
        ),
      );
}
