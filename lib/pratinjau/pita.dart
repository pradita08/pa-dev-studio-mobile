// Pita "PRATINJAU · data contoh" (demo: debug & profile saja): penanda jelas + pilihan keadaan khusus L08 + keluar.
import 'package:flutter/material.dart';

import '../layar/data.dart';
import '../tema/token.dart';
import 'contoh.dart';

class PitaPratinjau extends StatelessWidget {
  const PitaPratinjau({super.key, required this.sumber, this.onKeluar});
  final SumberData sumber;
  final VoidCallback? onKeluar;

  static const _label = {
    KeadaanKhusus.normal: 'Normal',
    KeadaanKhusus.macPutus: 'Mac tidak tersambung',
    KeadaanKhusus.tanpaInternet: 'Tanpa internet',
    KeadaanKhusus.memuat: 'Memuat',
    KeadaanKhusus.pembaruanWajib: 'Pembaruan wajib',
    KeadaanKhusus.kosong: 'Belum ada proyek',
  };

  @override
  Widget build(BuildContext context) {
    final w = WarnaPadev.dari(context);
    final s = sumber;
    final keadaan = s is SumberContoh ? s.keadaan : KeadaanKhusus.normal;
    return Semantics(
      container: true,
      label: 'Mode pratinjau, data contoh',
      child: Container(
        color: w.warnb,
        padding: EdgeInsets.fromLTRB(14, MediaQuery.paddingOf(context).top + 2, 4, 2),
        child: Row(children: [
          Icon(Simbol.info, size: 16, color: w.warnt),
          const SizedBox(width: 6),
          Expanded(
            child: Text(
              keadaan == KeadaanKhusus.normal ? 'PRATINJAU · data contoh' : 'PRATINJAU · ${_label[keadaan]}',
              overflow: TextOverflow.ellipsis,
              style: TextStyle(color: w.warnt, fontSize: 12.5, fontWeight: FontWeight.w800, letterSpacing: .3),
            ),
          ),
          if (s is SumberContoh)
            PopupMenuButton<KeadaanKhusus>(
              tooltip: 'Pilih keadaan',
              onSelected: s.aturKeadaan,
              itemBuilder: (c) => [
                for (final e in _label.entries)
                  CheckedPopupMenuItem(value: e.key, checked: e.key == keadaan, child: Text(e.value)),
              ],
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 12),
                child: Text('Keadaan', style: TextStyle(color: w.warnt, fontSize: 12.5, fontWeight: FontWeight.w700, decoration: TextDecoration.underline)),
              ),
            ),
          if (onKeluar != null)
            TextButton(
              onPressed: onKeluar,
              style: TextButton.styleFrom(foregroundColor: w.warnt, minimumSize: const Size(48, 44)),
              child: const Text('Keluar'),
            ),
        ]),
      ),
    );
  }
}
