// L06 Kabar — kotak notifikasi lokal dari isi `notif` (kontrak §2), filter Semua/Selesai/Butuh izin, dikelompokkan per hari.
// "Menunggu izin" tidak bisa disetujui dari HP (v1, DESAIN §3.5): ketuk hanya membuka chat proyek.
import 'package:flutter/material.dart';

import '../komponen/komponen.dart';
import '../tema/token.dart';
import 'data.dart';

enum _Saring { semua, selesai, izin }

class LayarKabar extends StatefulWidget {
  const LayarKabar({super.key, required this.sumber, required this.onBukaChat});
  final SumberData sumber;
  final ValueChanged<String> onBukaChat;

  @override
  State<LayarKabar> createState() => _LayarKabarState();
}

class _LayarKabarState extends State<LayarKabar> {
  _Saring _saring = _Saring.semua;

  static String _hari(DateTime w) {
    final k = DateTime.now();
    final hariIni = DateTime(k.year, k.month, k.day);
    final d = DateTime(w.year, w.month, w.day);
    if (d == hariIni) return 'Hari ini';
    if (d == hariIni.subtract(const Duration(days: 1))) return 'Kemarin';
    return tanggalPendek(w);
  }

  @override
  Widget build(BuildContext context) {
    final w = WarnaPadev.dari(context);
    final s = widget.sumber;
    final daftar = s.kabar.where((k) => switch (_saring) {
          _Saring.semua => true,
          _Saring.selesai => k.jenis == JenisKabar.selesai || k.jenis == JenisKabar.divisi,
          _Saring.izin => k.jenis == JenisKabar.izin,
        }).toList()
      ..sort((a, b) => b.waktu.compareTo(a.waktu));

    final kelompok = <String, List<ButirKabar>>{};
    for (final k in daftar) {
      (kelompok[_hari(k.waktu)] ??= []).add(k);
    }

    return ListView(
      padding: EdgeInsets.fromLTRB(14, MediaQuery.paddingOf(context).top + 8, 14, 20),
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(4, 0, 4, 12),
          child: Row(children: [
            Expanded(child: Semantics(header: true, child: Text('Kabar', style: TeksPadev.judulLayar(w)))),
            if (s.belumDibaca > 0) TextButton(onPressed: s.tandaiSemuaDibaca, child: const Text('Tandai dibaca')),
          ]),
        ),
        Wrap(spacing: 8, children: [
          for (final (v, label) in const [(_Saring.semua, 'Semua'), (_Saring.selesai, 'Selesai'), (_Saring.izin, 'Butuh izin')])
            ChoiceChip(
              label: Text(label),
              selected: _saring == v,
              showCheckmark: true,
              checkmarkColor: w.btnt,
              selectedColor: w.btn,
              backgroundColor: w.panel,
              side: BorderSide(color: _saring == v ? w.btn : w.line),
              labelStyle: TextStyle(color: _saring == v ? w.btnt : w.ink, fontWeight: FontWeight.w700, fontSize: 13),
              shape: const StadiumBorder(),
              onSelected: (_) => setState(() => _saring = v),
            ),
        ]),
        if (daftar.isEmpty)
          IsiKosong(
            ikon: Simbol.lonceng,
            judul: _saring == _Saring.izin ? 'Tidak ada yang menunggu izin' : 'Belum ada kabar',
            teks: 'Kabar muncul saat sesi selesai, divisi selesai, Claude menunggu izin, limit akun hampir habis, atau Mac terputus. '
                'Isi jawaban Claude tidak pernah ditampilkan di notifikasi.',
          ),
        for (final e in kelompok.entries) ...[
          JudulBagian(e.key),
          KartuDaftar(anak: [for (final k in e.value) _BarisKabar(kabar: k, sumber: s, onBukaChat: widget.onBukaChat)]),
        ],
      ],
    );
  }
}

class _BarisKabar extends StatelessWidget {
  const _BarisKabar({required this.kabar, required this.sumber, required this.onBukaChat});
  final ButirKabar kabar;
  final SumberData sumber;
  final ValueChanged<String> onBukaChat;

  @override
  Widget build(BuildContext context) {
    final w = WarnaPadev.dari(context);
    final k = kabar;
    final (ikon, fg, bg) = switch (k.jenis) {
      JenisKabar.selesai => (Simbol.centangLingkar, w.okt, w.okb),
      JenisKabar.divisi => (Simbol.tim, w.okt, w.okb),
      JenisKabar.izin => (Simbol.tangan, w.warnt, w.warnb),
      JenisKabar.macTerputus => (Simbol.putus, w.err, w.errb),
      JenisKabar.limit => (Simbol.peringatan, (k.n ?? 0) >= 95 ? w.err : w.warnt, (k.n ?? 0) >= 95 ? w.errb : w.warnb),
      JenisKabar.antre => (Simbol.putar, w.okt, w.okb),
    };
    final teks = switch (k.jenis) {
      JenisKabar.selesai => 'Selesai${k.durasiDtk == null ? '' : ' (${durasiBaca(Duration(seconds: k.durasiDtk!))})'}',
      JenisKabar.divisi => k.n == null ? 'Divisi selesai' : '${k.n} divisi selesai',
      JenisKabar.izin => 'Claude menunggu izin Anda (setujui di laptop)',
      JenisKabar.macTerputus => 'Mac tidak tersambung',
      JenisKabar.limit => 'Limit ${k.akun == null ? 'akun' : namaAkun(k.akun!)} ${k.batas == '7h' ? '7 hari' : 'blok 5 jam'} '
          '${k.n == null ? 'hampir habis' : '${k.n}%'}${k.reset == null ? '' : ' · reset ${k.batas == '7h' ? tanggalPendek(k.reset!) : jamMenit(k.reset!)}'}',
      JenisKabar.antre => 'Tugas antrean mulai — limit pulih${k.akun == null ? '' : ' (${namaAkun(k.akun!)})'}',
    };
    final proyekId = k.proyekId;
    final bisaBuka = proyekId != null && sumber.cariProyek(proyekId) != null;
    return Semantics(
      button: bisaBuka,
      label: '${k.proyek ?? ''} $teks, ${jamMenit(k.waktu)}${k.dibaca ? '' : ', belum dibaca'}',
      excludeSemantics: true,
      child: InkWell(
        onTap: () {
          sumber.tandaiDibaca(k);
          if (bisaBuka) onBukaChat(proyekId);
        },
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 60),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            child: Row(children: [
              Container(width: 34, height: 34, decoration: BoxDecoration(color: bg, shape: BoxShape.circle), child: Icon(ikon, size: 18, color: fg)),
              const SizedBox(width: 12),
              Expanded(
                child: Text.rich(TextSpan(style: TextStyle(color: w.ink, fontSize: 13.5, height: 1.35), children: [
                  if (k.proyek != null) TextSpan(text: k.proyek, style: const TextStyle(fontWeight: FontWeight.w800)),
                  if (k.proyek != null) const TextSpan(text: ' · '),
                  TextSpan(text: teks),
                ])),
              ),
              const SizedBox(width: 8),
              Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text(jamMenit(k.waktu), style: TeksPadev.redup(w, ukuran: 12)),
                if (!k.dibaca) ...[
                  const SizedBox(height: 5),
                  Container(width: 8, height: 8, decoration: BoxDecoration(color: w.accent, shape: BoxShape.circle)),
                ],
              ]),
            ]),
          ),
        ),
      ),
    );
  }
}
