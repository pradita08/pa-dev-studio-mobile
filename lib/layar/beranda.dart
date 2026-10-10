// L03 Beranda — tab Proyek: kartu Mac (+ Blok 5 jam bila `limit` ada), cari proyek (nama/id, lokal di HP), kartu proyek
// per bagian grup folder (KOMINFO/ARDANA/PRIVATE/Umum… dari Mac; bisa dilipat & diurutkan, disimpan di HP),
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
      final semuaGrup = kelompokkanProyek(s.proyek, s.urutGrup);
      final pakaiGrup = semuaGrup.length > 1; // satu grup saja (pelaksana lama / satu folder) → daftar biasa
      if (s.proyek.isNotEmpty) {
        butir.add(Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: Row(children: [
            Expanded(child: _kolomCari(w)),
            if (pakaiGrup)
              IconButton(
                tooltip: 'Atur grup',
                icon: Icon(Simbol.urutkan, color: w.ink),
                onPressed: () => _aturGrup(context),
              ),
          ]),
        ));
      }
      final tampil = saringProyek(s.proyek, _kata);
      if (s.proyek.isNotEmpty && tampil.isEmpty) {
        butir.add(IsiKosong(
          ikon: Simbol.cari,
          judul: 'Tidak ada proyek cocok',
          teks: '"${_kata.trim()}" tidak ada di nama proyek.',
        ));
      }
      Widget kartu(Proyek p) => Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: _KartuProyek(proyek: p, macPutus: s.macTersambung == false, onTap: () => widget.onBukaChat(p.id)),
          );
      if (!pakaiGrup) {
        butir.addAll(tampil.map(kartu));
      } else {
        // sedang mencari → semua bagian yang cocok terbuka (status lipat tersimpan tidak diubah)
        final cari = _kata.trim().isNotEmpty;
        for (final (g, daftar) in kelompokkanProyek(tampil, s.urutGrup)) {
          final buka = cari || s.grupTerbuka.contains(g);
          butir.add(_KepalaGrup(
            nama: g,
            proyek: daftar,
            buka: buka,
            macPutus: s.macTersambung == false,
            onTap: cari ? null : () => s.bukaGrup(g, !buka),
          ));
          if (buka) butir.addAll(daftar.map(kartu));
        }
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

  Future<void> _aturGrup(BuildContext context) => showModalBottomSheet<void>(
        context: context,
        showDragHandle: true,
        isScrollControlled: true,
        builder: (_) => LembarAturGrup(sumber: sumber),
      );

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

/// Kepala bagian grup: nama folder, jumlah proyek, ringkasan yang butuh izin / bekerja (tetap terlihat saat dilipat).
class _KepalaGrup extends StatelessWidget {
  const _KepalaGrup({required this.nama, required this.proyek, required this.buka, required this.macPutus, this.onTap});
  final String nama;
  final List<Proyek> proyek;
  final bool buka, macPutus;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final w = WarnaPadev.dari(context);
    final bekerja = macPutus ? 0 : proyek.where((p) => p.status == StatusProyek.bekerja).length;
    final izin = macPutus ? 0 : proyek.where((p) => p.status == StatusProyek.menungguIzin).length;
    final ket = [if (izin > 0) '$izin butuh izin', if (bekerja > 0) '$bekerja bekerja'];
    return Semantics(
      button: onTap != null,
      expanded: buka,
      label: '$nama, ${proyek.length} proyek${ket.isEmpty ? '' : ', ${ket.join(', ')}'}',
      excludeSemantics: true,
      child: InkWell(
        borderRadius: BorderRadius.circular(10),
        onTap: onTap,
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 44),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(4, 4, 4, 6),
            child: Row(children: [
              Icon(buka ? Simbol.folderBuka : Simbol.folder, size: 20, color: w.muted),
              const SizedBox(width: 8),
              Flexible(
                child: Text(nama,
                    style: TextStyle(color: w.ink, fontSize: 14, fontWeight: FontWeight.w800, letterSpacing: .3),
                    overflow: TextOverflow.ellipsis),
              ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 1),
                decoration: BoxDecoration(color: w.chip, borderRadius: BorderRadius.circular(99)),
                child: Text('${proyek.length}', style: TextStyle(color: w.muted, fontSize: 12, fontWeight: FontWeight.w700)),
              ),
              if (izin > 0) ...[
                const SizedBox(width: 6),
                ChipPadev(ikon: Simbol.tangan, label: '$izin', fg: w.warnt, bg: w.warnb),
              ],
              if (bekerja > 0) ...[
                const SizedBox(width: 6),
                ChipPadev(ikon: Simbol.putar, label: '$bekerja', fg: w.accent, bg: w.accb),
              ],
              const Spacer(),
              if (onTap != null)
                AnimatedRotation(
                  turns: buka ? .5 : 0,
                  duration: const Duration(milliseconds: 150),
                  child: Icon(Simbol.bawah, color: w.muted),
                ),
            ]),
          ),
        ),
      ),
    );
  }
}

/// Lembar "Atur grup": urutan bagian (naik/turun), buka/lipat semua, kembali ke urutan bawaan. Langsung disimpan di HP.
class LembarAturGrup extends StatelessWidget {
  const LembarAturGrup({super.key, required this.sumber});
  final SumberData sumber;

  @override
  Widget build(BuildContext context) {
    final w = WarnaPadev.dari(context);
    return ListenableBuilder(
      listenable: sumber,
      builder: (context, _) {
        final s = sumber;
        final grup = kelompokkanProyek(s.proyek, s.urutGrup);
        final nama = [for (final (g, _) in grup) g];
        // pindahkan bagian ke-i ke sebelum posisi [ke] (urutan lama)
        void pindah(int i, int ke) {
          final baru = [...nama]..insert(ke, nama[i]);
          baru.removeAt(i < ke ? i : i + 1);
          s.aturUrutGrup(baru);
        }

        return SafeArea(
          child: ConstrainedBox(
            constraints: BoxConstraints(maxHeight: MediaQuery.sizeOf(context).height * .8),
            child: ListView(
              shrinkWrap: true,
              padding: const EdgeInsets.fromLTRB(16, 0, 8, 16),
              children: [
                Text('Atur grup', style: TeksPadev.judulKartu(w)),
                const SizedBox(height: 4),
                Text('Urutan & bagian terbuka disimpan di HP ini. Grup = folder proyek di Mac (bisa diganti lewat "grup" di konfigurasi).',
                    style: TeksPadev.redup(w, ukuran: 12.5)),
                const SizedBox(height: 8),
                for (final (i, (g, daftar)) in grup.indexed)
                  Row(children: [
                    Icon(Simbol.folder, size: 20, color: w.muted),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text('$g · ${daftar.length}',
                          style: TextStyle(color: w.ink, fontSize: 14.5, fontWeight: FontWeight.w700), overflow: TextOverflow.ellipsis),
                    ),
                    IconButton(
                      tooltip: 'Naikkan $g',
                      icon: const Icon(Simbol.panahAtas),
                      onPressed: i == 0 ? null : () => pindah(i, i - 1),
                    ),
                    IconButton(
                      tooltip: 'Turunkan $g',
                      icon: const Icon(Simbol.panahBawah),
                      onPressed: i == grup.length - 1 ? null : () => pindah(i, i + 2),
                    ),
                  ]),
                const SizedBox(height: 8),
                Wrap(spacing: 8, runSpacing: 8, children: [
                  OutlinedButton(onPressed: () => s.aturGrupTerbuka(nama), child: const Text('Buka semua')),
                  OutlinedButton(onPressed: () => s.aturGrupTerbuka(const []), child: const Text('Lipat semua')),
                  TextButton(onPressed: s.urutGrup.isEmpty ? null : () => s.aturUrutGrup(const []), child: const Text('Urutan bawaan')),
                ]),
              ],
            ),
          ),
        );
      },
    );
  }
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
