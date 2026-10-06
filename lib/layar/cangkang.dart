// Cangkang 5 tab (KONTRAK-apk-v2 §6.1): Proyek · Sesi · Kantor (tengah, indeks 2) · Kabar · Pengaturan. Tanpa tombol tengah "Pindai".
import 'package:flutter/material.dart';

import '../pratinjau/pita.dart';
import '../tema/token.dart';
import 'beranda.dart';
import 'chat.dart';
import 'data.dart';
import 'kabar.dart';
import 'kantor.dart';
import 'pengaturan.dart';
import 'sesi.dart';

class Cangkang extends StatefulWidget {
  const Cangkang({super.key, required this.sumber, required this.onLepas, this.onKeluarPratinjau});
  final SumberData sumber;
  final Future<void> Function() onLepas;
  final VoidCallback? onKeluarPratinjau;

  @override
  State<Cangkang> createState() => _CangkangState();
}

class _CangkangState extends State<Cangkang> {
  int _tab = 0;

  void bukaChat(String proyekId) {
    Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => LayarChat(sumber: widget.sumber, proyekId: proyekId)));
  }

  @override
  Widget build(BuildContext context) {
    final w = WarnaPadev.dari(context);
    final s = widget.sumber;
    final halaman = [
      LayarBeranda(sumber: s, onBukaChat: bukaChat),
      LayarSesi(sumber: s, aktif: _tab == 1),
      LayarKantor(sumber: s, onBukaChat: bukaChat, aktif: _tab == 2),
      LayarKabar(sumber: s, onBukaChat: bukaChat),
      LayarPengaturan(sumber: s, onLepas: widget.onLepas),
    ];
    return Scaffold(
      backgroundColor: w.bg,
      body: Column(children: [
        if (s.pratinjau) PitaPratinjau(sumber: s, onKeluar: widget.onKeluarPratinjau),
        Expanded(
          child: MediaQuery.removePadding(
            context: context,
            removeTop: s.pratinjau,
            child: IndexedStack(index: _tab, children: halaman),
          ),
        ),
      ]),
      bottomNavigationBar: _NavBawah(
        indeks: _tab,
        belumDibaca: s.belumDibaca,
        onPilih: (i) => setState(() => _tab = i),
      ),
    );
  }
}

class _NavBawah extends StatelessWidget {
  const _NavBawah({required this.indeks, required this.belumDibaca, required this.onPilih});
  final int indeks, belumDibaca;
  final ValueChanged<int> onPilih;

  /// Indeks tab Kabar (lencana belum dibaca).
  static const _kabar = 3;

  static const _butir = [
    (Simbol.folder, 'Proyek'),
    (Simbol.sesi, 'Sesi'),
    (Simbol.kantor, 'Kantor'),
    (Simbol.lonceng, 'Kabar'),
    (Simbol.pengaturan, 'Pengaturan'),
  ];

  @override
  Widget build(BuildContext context) {
    final w = WarnaPadev.dari(context);
    return Container(
      decoration: BoxDecoration(color: w.panel, border: Border(top: BorderSide(color: w.line))),
      child: SafeArea(
        top: false,
        child: SizedBox(
          height: 64,
          child: Row(children: [
            for (var i = 0; i < _butir.length; i++)
              Expanded(
                child: Semantics(
                  button: true,
                  selected: i == indeks,
                  label: '${_butir[i].$2}${i == _kabar && belumDibaca > 0 ? ', $belumDibaca belum dibaca' : ''}',
                  excludeSemantics: true,
                  child: InkWell(
                    onTap: () => onPilih(i),
                    child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                      AnimatedContainer(
                        duration: MediaQuery.disableAnimationsOf(context) ? Duration.zero : const Duration(milliseconds: 180),
                        width: i == indeks ? 28 : 0,
                        height: 3,
                        margin: const EdgeInsets.only(bottom: 7),
                        decoration: BoxDecoration(color: w.accent, borderRadius: BorderRadius.circular(2)),
                      ),
                      Badge(
                        isLabelVisible: i == _kabar && belumDibaca > 0,
                        backgroundColor: w.err,
                        textColor: w.btnt,
                        label: Text(belumDibaca > 9 ? '9+' : '$belumDibaca'),
                        child: Icon(_butir[i].$1, size: 22, color: i == indeks ? w.accent : w.muted),
                      ),
                      const SizedBox(height: 3),
                      Text(_butir[i].$2,
                          maxLines: 1,
                          softWrap: false,
                          overflow: TextOverflow.fade, // 5 tab di 360 dp: "Pengaturan" tetap satu baris
                          style: TextStyle(
                              color: i == indeks ? w.accent : w.muted,
                              fontSize: 11.5,
                              fontWeight: i == indeks ? FontWeight.w800 : FontWeight.w600)),
                    ]),
                  ),
                ),
              ),
          ]),
        ),
      ),
    );
  }
}
