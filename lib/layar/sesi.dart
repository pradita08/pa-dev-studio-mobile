// L11 Sesi (KONTRAK-apk-v2 §6.2, F1): daftar sesi Claude Code 48 jam dari kabar `cermin_sesi` + "Cari sesi lama" (≤30 hari).
// Penanda tingkat (ringkas/isi) per sesi. Pita "Butuh keputusan" (F1b) dan Lanjutkan (F3) belum ada di sini.
// Build non-rilis: cermin nyata mati (K-07) → keadaan jujur "Tab Sesi aktif di APK rilis" + contoh tampilan (pratinjau, !kReleaseMode).
// Semua teks dari Mac tampil sebagai Text biasa (A-E1).
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../komponen/komponen.dart';
import '../kunci/kunci.dart';
import '../pratinjau/contoh.dart';
import '../pratinjau/pita.dart';
import '../tema/token.dart';
import 'data.dart';
import 'sesi_detail.dart';

class LayarSesi extends StatefulWidget {
  const LayarSesi({super.key, required this.sumber, required this.aktif});
  final SumberData sumber;

  /// Tab Sesi sedang terlihat (daftar otomatis hanya diminta saat dibuka).
  final bool aktif;

  @override
  State<LayarSesi> createState() => _LayarSesiState();
}

class _LayarSesiState extends State<LayarSesi> {
  String? _akun;

  SumberData get s => widget.sumber;

  @override
  void initState() {
    super.initState();
    NamaPegawai.muat().then((_) {
      if (mounted) setState(() {});
    });
    if (widget.aktif) s.mintaDaftarSesi(otomatis: true);
  }

  @override
  void didUpdateWidget(LayarSesi lama) {
    super.didUpdateWidget(lama);
    if (widget.aktif && !lama.aktif) s.mintaDaftarSesi(otomatis: true);
  }

  Future<void> _segarkan() async {
    try {
      await s.mintaDaftarSesi();
    } on GalatKunci catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
          ..hideCurrentSnackBar()
          ..showSnackBar(SnackBar(content: Text(pesanCermin(e.kode))));
      }
    }
  }

  void _buka(SesiCermin x) =>
      Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => LayarSesiDetail(sumber: s, sesi: x)));

  @override
  Widget build(BuildContext context) {
    final w = WarnaPadev.dari(context);
    final semuaAkun = {for (final x in s.daftarSesi) x.akun}.toList()..sort();
    if (_akun != null && !semuaAkun.contains(_akun)) _akun = null;
    final daftar = s.daftarSesi.where((x) => _akun == null || x.akun == _akun).toList();

    final butir = <Widget>[
      Padding(
        padding: const EdgeInsets.fromLTRB(4, 8, 0, 2),
        child: Row(children: [
          Expanded(child: Semantics(header: true, child: Text('Sesi', style: TeksPadev.judulLayar(w)))),
          if (semuaAkun.length > 1)
            PopupMenuButton<String?>(
              tooltip: 'Saring akun',
              onSelected: (v) => setState(() => _akun = v),
              itemBuilder: (c) => [
                CheckedPopupMenuItem<String?>(value: null, checked: _akun == null, child: const Text('Semua akun')),
                for (final a in semuaAkun) CheckedPopupMenuItem<String?>(value: a, checked: _akun == a, child: Text(namaAkun(a))),
              ],
              child: Container(
                constraints: const BoxConstraints(minHeight: 44),
                padding: const EdgeInsets.symmetric(horizontal: 12),
                decoration: BoxDecoration(color: w.panel, borderRadius: BorderRadius.circular(10), border: Border.all(color: w.line)),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  Text(_akun == null ? 'Semua akun' : namaAkun(_akun!), style: TextStyle(color: w.ink, fontSize: 13, fontWeight: FontWeight.w700)),
                  const SizedBox(width: 4),
                  Icon(Simbol.bawah, size: 18, color: w.muted),
                ]),
              ),
            ),
        ]),
      ),
      Padding(
        padding: const EdgeInsets.fromLTRB(4, 0, 4, 12),
        child: Text(
          'Sesi Claude Code 48 jam terakhir di laptop'
          '${s.daftarSesiDiperbarui == null ? '' : ' · diperbarui ${jamMenit(s.daftarSesiDiperbarui!)}'}',
          style: TeksPadev.redup(w, ukuran: 12.5),
        ),
      ),
    ];

    if (s.cerminTersedia == false) {
      butir.add(_TidakTersedia(rilis: kReleaseMode));
    } else if (s.cerminTersedia == null || (s.memuatDaftarSesi && !s.daftarSesiDiterima && !s.daftarLambat)) {
      butir.addAll([for (var i = 0; i < 3; i++) const Padding(padding: EdgeInsets.only(bottom: 10), child: _KartuKerangka())]);
      butir.add(Center(child: Text('Meminta daftar sesi ke Mac…', style: TeksPadev.redup(w, ukuran: 12))));
    } else {
      void spanduk(Widget x) => butir.add(Padding(padding: const EdgeInsets.only(bottom: 10), child: x));
      if (s.macTersambung == false) {
        spanduk(Spanduk(
          jenis: JenisSpanduk.galat,
          ikon: Simbol.putus,
          teks: 'Mac tidak tersambung${s.macTerakhir == null ? '' : ' sejak ${jamMenit(s.macTerakhir!)}'} · daftar bisa usang',
        ));
      } else if (s.tanpaInternet) {
        spanduk(const Spanduk(jenis: JenisSpanduk.netral, ikon: Simbol.tanpaWifi, teks: 'HP tidak ada internet · daftar bisa usang'));
      }
      if (s.galatDaftar != null) {
        spanduk(Spanduk(jenis: JenisSpanduk.galat, ikon: Simbol.galatLingkar, teks: pesanCermin(s.galatDaftar!), aksi: _segarkan));
      } else if (s.daftarLambat) {
        spanduk(const Spanduk(
          jenis: JenisSpanduk.peringatan,
          ikon: Simbol.pasir,
          teks: 'Mac belum menjawab. Pastikan Mac menyala dan pelaksana versi terbaru berjalan.',
        ));
      }
      if (!s.daftarSesiDiterima) {
        butir.add(IsiKosong(
          ikon: Simbol.sesi,
          judul: 'Daftar sesi belum dimuat',
          teks: 'Tarik ke bawah atau ketuk tombol untuk meminta daftar sesi dari Mac.',
          aksi: OutlinedButton(
            onPressed: s.memuatDaftarSesi ? null : _segarkan,
            child: const IsiTombol(Simbol.segarkan, 'Muat daftar sesi'),
          ),
        ));
      } else if (daftar.isEmpty) {
        butir.add(const IsiKosong(
          ikon: Simbol.tidur,
          judul: 'Belum ada sesi 48 jam terakhir',
          teks: 'Sesi VS Code, terminal, dan tugas dari HP di proyek terdaftar akan muncul di sini.',
        ));
      } else {
        for (final x in daftar) {
          butir.add(Padding(padding: const EdgeInsets.only(bottom: 10), child: KartuSesi(sesi: x, sumber: s, onTap: () => _buka(x))));
        }
      }
      butir.add(Padding(
        padding: const EdgeInsets.only(top: 6),
        child: OutlinedButton(
          onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => LayarCariSesi(sumber: s))),
          child: const IsiTombol(Simbol.cariLama, 'Cari sesi lama (≤30 hari)'),
        ),
      ));
    }

    return RefreshIndicator(
      color: w.accent,
      backgroundColor: w.panel,
      onRefresh: s.cerminTersedia == true ? _segarkan : () async {},
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: EdgeInsets.fromLTRB(14, MediaQuery.paddingOf(context).top + 8, 14, 20),
        children: butir,
      ),
    );
  }
}

/// Kartu satu sesi (dipakai daftar 48 jam & hasil cari).
class KartuSesi extends StatelessWidget {
  const KartuSesi({super.key, required this.sesi, required this.sumber, required this.onTap});
  final SesiCermin sesi;
  final SumberData sumber;
  final VoidCallback onTap;

  static String waktuLalu(DateTime? t) {
    final r = waktuRelatif(t);
    return (r.endsWith(' mnt') || r.endsWith(' jam')) ? '$r lalu' : r;
  }

  static String ringkasTim(SesiCermin x) {
    final bagian = <String>[
      if (x.divisi.isNotEmpty) x.divisi.map((d) => '${d.label}${d.status == 'selesai' ? ' selesai' : ''}').join(', '),
      if (x.alat != null) '${alatTampil(x.alat!.alat).$2} ${x.alat!.ringkas}'.trim(),
    ];
    return bagian.join(' · ');
  }

  @override
  Widget build(BuildContext context) {
    final w = WarnaPadev.dari(context);
    final x = sesi;
    final (ikonAsal, asal) = asalTampil(x.asal);
    final proyek = sumber.namaProyek(x.proyek);
    final judul = x.judul.isEmpty ? 'Sesi tanpa judul' : x.judul;
    final tim = ringkasTim(x);
    final waktu = waktuLalu(x.terakhir);
    final status = switch (x.status) {
      StatusSesi.bekerja => 'bekerja',
      StatusSesi.menungguIzin => 'menunggu izin',
      StatusSesi.diam => 'diam',
      StatusSesi.selesai => 'selesai',
    };
    return Kartu(
      onTap: onTap,
      semantik: '$judul, $status, $proyek, ${namaAkun(x.akun)}, $asal, ${x.isi ? 'isi percakapan' : 'ringkas'}${waktu.isEmpty ? '' : ', $waktu'}'
          '${tim.isEmpty ? '' : ', $tim'}',
      anak: ExcludeSemantics(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            ChipPadev.sesi(context, x.status),
            const Spacer(),
            Text(waktu, style: TeksPadev.redup(w, ukuran: 12)),
          ]),
          const SizedBox(height: 8),
          Text(judul, maxLines: 2, overflow: TextOverflow.ellipsis, style: TeksPadev.judulKartu(w).copyWith(height: 1.3)),
          const SizedBox(height: 4),
          Row(children: [
            Icon(ikonAsal, size: 14, color: w.muted),
            const SizedBox(width: 4),
            Expanded(
              child: Text('$proyek · ${namaAkun(x.akun)} · $asal',
                  maxLines: 1, overflow: TextOverflow.ellipsis, style: TeksPadev.redup(w, ukuran: 12.5)),
            ),
            const SizedBox(width: 8),
            PenandaTingkat(isi: x.isi),
          ]),
          if (tim.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(tim, maxLines: 1, overflow: TextOverflow.ellipsis, style: TeksPadev.redup(w, ukuran: 12)),
          ],
        ]),
      ),
    );
  }
}

/// Penanda tingkat cermin: "Ringkas" (judul, status, alat, divisi) atau "Isi" (+ pesan & jawaban).
class PenandaTingkat extends StatelessWidget {
  const PenandaTingkat({super.key, required this.isi});
  final bool isi;
  @override
  Widget build(BuildContext context) {
    final w = WarnaPadev.dari(context);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
      decoration: BoxDecoration(color: w.chip, borderRadius: BorderRadius.circular(99), border: Border.all(color: w.line)),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(isi ? Simbol.obrolan : Simbol.tersembunyi, size: 12, color: w.muted),
        const SizedBox(width: 3),
        Text(isi ? 'Isi' : 'Ringkas', style: TextStyle(color: w.muted, fontSize: 11.5, fontWeight: FontWeight.w700)),
      ]),
    );
  }
}

class _KartuKerangka extends StatelessWidget {
  const _KartuKerangka();
  @override
  Widget build(BuildContext context) => const Kartu(
        anak: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [Kerangka(lebar: 84, tinggi: 20, radius: 99), Spacer(), Kerangka(lebar: 40)]),
          SizedBox(height: 12),
          Kerangka(lebar: 220, tinggi: 14),
          SizedBox(height: 8),
          Kerangka(lebar: 160),
        ]),
      );
}

/// Build non-rilis: cermin nyata mati (K-07). Jujur + contoh tampilan (data contoh, hanya !kReleaseMode — REV-38).
class _TidakTersedia extends StatelessWidget {
  const _TidakTersedia({required this.rilis});
  final bool rilis;
  @override
  Widget build(BuildContext context) => IsiKosong(
        ikon: Simbol.sesi,
        judul: 'Tab Sesi aktif di APK rilis',
        teks: rilis
            ? 'Cermin sesi tidak tersedia di build ini.'
            : 'Build debug/profile sengaja tidak menerima isi sesi dari Mac. Pasang APK rilis untuk melihat sesi Claude Code di laptop.',
        aksi: rilis
            ? null
            : OutlinedButton(
                onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => const _PratinjauSesi())),
                child: const IsiTombol(Simbol.info, 'Lihat contoh tampilan'),
              ),
      );
}

/// Contoh tab Sesi dengan data contoh (pratinjau). Tidak terjangkau di rilis; SumberContoh juga menolak dibuat di rilis.
class _PratinjauSesi extends StatefulWidget {
  const _PratinjauSesi();
  @override
  State<_PratinjauSesi> createState() => _PratinjauSesiState();
}

class _PratinjauSesiState extends State<_PratinjauSesi> {
  late final SumberContoh _s = SumberContoh();

  @override
  void dispose() {
    _s.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final w = WarnaPadev.dari(context);
    return Scaffold(
      backgroundColor: w.bg,
      body: Column(children: [
        PitaPratinjau(sumber: _s, onKeluar: () => Navigator.of(context).maybePop()),
        Expanded(
          child: MediaQuery.removePadding(
            context: context,
            removeTop: true,
            child: ListenableBuilder(listenable: _s, builder: (c, _) => LayarSesi(sumber: _s, aktif: true)),
          ),
        ),
      ]),
    );
  }
}

// ---------------------------------------------------------------------------------------------------- Cari sesi lama

class LayarCariSesi extends StatefulWidget {
  const LayarCariSesi({super.key, required this.sumber});
  final SumberData sumber;

  @override
  State<LayarCariSesi> createState() => _LayarCariSesiState();
}

class _LayarCariSesiState extends State<LayarCariSesi> {
  final _ketik = TextEditingController();
  int _hari = 30;

  SumberData get s => widget.sumber;

  @override
  void dispose() {
    _ketik.dispose();
    super.dispose();
  }

  Future<void> _cari() async {
    FocusScope.of(context).unfocus();
    try {
      await s.cariSesiLama(hari: _hari, cari: _ketik.text);
    } on GalatKunci catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
          ..hideCurrentSnackBar()
          ..showSnackBar(SnackBar(content: Text(pesanCermin(e.kode))));
      }
    }
  }

  @override
  Widget build(BuildContext context) => ListenableBuilder(listenable: s, builder: (c, _) => _bangun(c));

  Widget _bangun(BuildContext context) {
    final w = WarnaPadev.dari(context);
    final hasil = s.hasilCari;
    final tersedia = s.cerminTersedia == true;
    final isi = <Widget>[
      TextField(
        controller: _ketik,
        enabled: tersedia,
        textInputAction: TextInputAction.search,
        onSubmitted: (_) => _cari(),
        enableIMEPersonalizedLearning: false,
        inputFormatters: [LengthLimitingTextInputFormatter(40)],
        style: TextStyle(color: w.ink, fontSize: 14.5),
        decoration: InputDecoration(
          labelText: 'Kata di judul sesi (boleh kosong)',
          labelStyle: TextStyle(color: w.muted),
          prefixIcon: Icon(Simbol.cari, color: w.muted),
          filled: true,
          fillColor: w.panel,
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: w.line)),
          enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: w.line)),
          focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: w.accent, width: 1.5)),
        ),
      ),
      const SizedBox(height: 10),
      Segmen<int>(
        label: 'Rentang waktu',
        pilihan: const [(7, Simbol.jam, '7 hari'), (14, Simbol.jam, '14 hari'), (30, Simbol.jam, '30 hari')],
        nilai: _hari,
        onUbah: (v) => setState(() => _hari = v),
      ),
      const SizedBox(height: 10),
      FilledButton(
        onPressed: !tersedia || s.memuatCari ? null : _cari,
        child: IsiTombol(Simbol.cariLama, s.memuatCari ? 'Mencari di Mac…' : 'Cari'),
      ),
      const SizedBox(height: 6),
      Text('Sesi ≤30 hari selama transkripnya masih ada di Mac (Claude Code menghapus yang lebih lama).',
          style: TeksPadev.redup(w, ukuran: 12)),
      const SizedBox(height: 8),
    ];
    if (!tersedia) {
      isi.add(IsiKosong(ikon: Simbol.sesi, judul: 'Tab Sesi aktif di APK rilis', teks: pesanCermin('tidak_tersedia')));
    } else if (s.cariLambat) {
      isi.add(const Spanduk(jenis: JenisSpanduk.peringatan, ikon: Simbol.pasir, teks: 'Mac belum menjawab. Pastikan Mac menyala dan pelaksana berjalan.'));
    } else if (s.memuatCari) {
      isi.add(const Padding(padding: EdgeInsets.all(24), child: Center(child: CircularProgressIndicator())));
    } else if (hasil != null && hasil.isEmpty) {
      isi.add(const IsiKosong(ikon: Simbol.cariLama, judul: 'Tidak ada sesi yang cocok', teks: 'Coba kata lain atau rentang waktu lebih panjang.'));
    }
    if (hasil != null && hasil.isNotEmpty) {
      isi.add(JudulBagian('${hasil.length} sesi ditemukan'));
      for (final x in hasil) {
        isi.add(Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: KartuSesi(
            sesi: x,
            sumber: s,
            onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => LayarSesiDetail(sumber: s, sesi: x))),
          ),
        ));
      }
    }
    return Scaffold(
      backgroundColor: w.bg,
      appBar: AppBar(
        backgroundColor: w.panel,
        foregroundColor: w.ink,
        surfaceTintColor: Colors.transparent,
        leading: IconButton(icon: const Icon(Simbol.kembali), tooltip: 'Kembali', onPressed: () => Navigator.of(context).maybePop()),
        title: Text('Cari sesi lama', style: TextStyle(color: w.ink, fontSize: 18, fontWeight: FontWeight.w800)),
        bottom: PreferredSize(preferredSize: const Size.fromHeight(1), child: Divider(height: 1, color: w.line)),
      ),
      body: Column(children: [
        if (s.pratinjau) PitaPratinjau(sumber: s),
        Expanded(child: ListView(padding: const EdgeInsets.fromLTRB(14, 14, 14, 24), children: isi)),
      ]),
    );
  }
}
