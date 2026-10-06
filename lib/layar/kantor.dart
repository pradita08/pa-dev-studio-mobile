// L10 Kantor v1 (DESAIN §4): daftar "Di kantor sekarang" per proyek + lembar detail divisi. Tanpa gambar 3D/WebView (v1.1).
// Data dari `status.proyek[].divisi` (DESAIN §5); bila Mac belum mengirim field itu, tampil keterangan rapi.
import 'package:flutter/material.dart';

import '../komponen/komponen.dart';
import '../tema/token.dart';
import 'data.dart';

class LayarKantor extends StatefulWidget {
  const LayarKantor({super.key, required this.sumber, required this.onBukaChat});
  final SumberData sumber;
  final ValueChanged<String> onBukaChat;

  @override
  State<LayarKantor> createState() => _LayarKantorState();
}

class _LayarKantorState extends State<LayarKantor> {
  String? _pilih;

  @override
  Widget build(BuildContext context) {
    final w = WarnaPadev.dari(context);
    final s = widget.sumber;
    final daftarProyek = s.proyek;
    final Proyek? p = (_pilih == null ? null : s.cariProyek(_pilih!)) ??
        daftarProyek.where((x) => (x.divisi ?? const []).any((d) => d.status != 'diam')).firstOrNull ??
        daftarProyek.firstOrNull;
    final divisi = p?.divisi;
    final aktif = (divisi ?? const <Divisi>[]).where((d) => d.status != 'diam').length;

    return ListView(
      padding: EdgeInsets.fromLTRB(14, MediaQuery.paddingOf(context).top + 8, 14, 20),
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(4, 0, 0, 12),
          child: Row(children: [
            Expanded(child: Semantics(header: true, child: Text('Kantor', style: TeksPadev.judulLayar(w)))),
            if (daftarProyek.isNotEmpty)
              PopupMenuButton<String>(
                tooltip: 'Pilih proyek',
                onSelected: (v) => setState(() => _pilih = v),
                itemBuilder: (c) => [for (final x in daftarProyek) PopupMenuItem(value: x.id, child: Text(x.nama))],
                child: Container(
                  constraints: const BoxConstraints(minHeight: 44),
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  decoration: BoxDecoration(color: w.panel, borderRadius: BorderRadius.circular(10), border: Border.all(color: w.line)),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    Text(p?.nama ?? '-', style: TextStyle(color: w.ink, fontSize: 13, fontWeight: FontWeight.w700)),
                    const SizedBox(width: 4),
                    Icon(Simbol.bawah, size: 18, color: w.muted),
                  ]),
                ),
              ),
          ]),
        ),
        if (p == null)
          const IsiKosong(ikon: Simbol.kantor, judul: 'Belum ada proyek untuk HP', teks: 'Izinkan proyek untuk HP di konfigurasi pelaksana di laptop.')
        else if (divisi == null)
          IsiKosong(
            ikon: Simbol.tim,
            judul: 'Data tim belum dikirim Mac',
            teks: 'Daftar divisi butuh pelaksana versi terbaru di Mac. Chat ${p.nama} tetap bisa dipakai.',
            aksi: OutlinedButton(onPressed: () => widget.onBukaChat(p.id), child: Text('Buka chat ${p.nama}')),
          )
        else ...[
          Row(children: [
            Container(width: 8, height: 8, decoration: BoxDecoration(color: aktif > 0 ? w.ok : w.muted, shape: BoxShape.circle)),
            const SizedBox(width: 6),
            Text(aktif > 0 ? 'Di kantor sekarang · $aktif aktif' : 'Di kantor sekarang', style: TeksPadev.label(w)),
          ]),
          const SizedBox(height: 8),
          if (divisi.isEmpty)
            IsiKosong(ikon: Simbol.tidur, judul: 'Kantor sepi', teks: 'Belum ada divisi yang bekerja di ${p.nama}.')
          else
            KartuDaftar(anak: [
              for (final d in divisi)
                _BarisDivisi(divisi: d, onTap: () => _detail(context, p, d)),
            ]),
          const SizedBox(height: 14),
          Text('Tampilan 3D kantor menyusul di versi berikutnya.', textAlign: TextAlign.center, style: TeksPadev.redup(w, ukuran: 12)),
        ],
      ],
    );
  }

  void _detail(BuildContext context, Proyek p, Divisi d) {
    final w = WarnaPadev.dari(context);
    bukaLembar<void>(
      context,
      (c) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [
          AvatarDivisi(nama: d.nama, aktif: d.status == 'bekerja', ukuran: 44),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(d.nama, style: TextStyle(color: w.ink, fontSize: 18, fontWeight: FontWeight.w800)),
              Text('${_kapital(d.peran)} · ${p.nama}', style: TeksPadev.redup(w)),
            ]),
          ),
          ChipPadev.divisi(context, d.status),
        ]),
        const SizedBox(height: 14),
        if (d.ringkas != null && d.ringkas!.isNotEmpty)
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Icon(Simbol.ubah, size: 15, color: w.warnt),
            const SizedBox(width: 6),
            Expanded(child: Text(d.ringkas!, style: TeksPadev.mono(w.warnt, ukuran: 12.5))),
          ])
        else
          Text(d.status == 'diam' ? 'Menunggu tugas.' : 'Belum ada ringkasan langkah.', style: TeksPadev.redup(w)),
        if (d.status == 'menunggu_izin') ...[
          const SizedBox(height: 10),
          const Spanduk(jenis: JenisSpanduk.peringatan, ikon: Simbol.tangan, teks: 'Menunggu izin — setujui di laptop'),
        ],
        const SizedBox(height: 18),
        FilledButton(
          onPressed: () {
            Navigator.of(c).pop();
            widget.onBukaChat(p.id);
          },
          child: IsiTombol(Simbol.obrolan, 'Buka chat ${p.nama}'),
        ),
      ]),
    );
  }

  static String _kapital(String t) => t.isEmpty ? t : t[0].toUpperCase() + t.substring(1);
}

class _BarisDivisi extends StatelessWidget {
  const _BarisDivisi({required this.divisi, required this.onTap});
  final Divisi divisi;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final w = WarnaPadev.dari(context);
    final d = divisi;
    return Semantics(
      button: true,
      label: '${d.nama}, ${d.peran}${d.ringkas == null ? '' : ', ${d.ringkas}'}',
      child: InkWell(
        onTap: onTap,
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 60),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            child: Row(children: [
              AvatarDivisi(nama: d.nama, aktif: d.status == 'bekerja'),
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text.rich(TextSpan(children: [
                    TextSpan(text: d.nama, style: TextStyle(color: w.ink, fontSize: 14, fontWeight: FontWeight.w800)),
                    TextSpan(text: d.peran.isEmpty ? '' : ' · ${d.peran}', style: TeksPadev.redup(w, ukuran: 13.5)),
                  ])),
                  Text(d.ringkas ?? (d.status == 'diam' ? 'Menunggu tugas' : ''),
                      maxLines: 1, overflow: TextOverflow.ellipsis, style: TeksPadev.redup(w, ukuran: 12)),
                ]),
              ),
              const SizedBox(width: 8),
              ExcludeSemantics(child: ChipPadev.divisi(context, d.status)),
            ]),
          ),
        ),
      ),
    );
  }
}
