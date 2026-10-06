// Akar setelah buka kunci: belum terpasang/menunggu/ditolak → L02 Pasangkan · dicabut → pasang ulang · aktif → 5 tab.
// Mode pratinjau (data contoh) hanya ada di build debug & profile (!kReleaseMode di titik masuk; dibuang tree-shaking di rilis).
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../komponen/komponen.dart';
import '../kunci/kunci.dart';
import '../pratinjau/contoh.dart';
import '../tema/token.dart';
import 'cangkang.dart';
import 'data.dart';
import 'khusus.dart';
import 'pasang.dart';
import 'sumber_nyata.dart';

class AkarAplikasi extends StatefulWidget {
  const AkarAplikasi({super.key});

  @override
  State<AkarAplikasi> createState() => _AkarAplikasiState();
}

enum _Tahap { memeriksa, pasang, dicabut, aktif, galat }

class _AkarAplikasiState extends State<AkarAplikasi> with WidgetsBindingObserver {
  _Tahap _tahap = _Tahap.memeriksa;
  StatusPasang? _pasang;
  String? _galat;
  SumberData? _sumber;
  bool _pratinjau = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _periksa();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _sumber?.removeListener(_dariSumber);
    _sumber?.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState s) {
    if (s == AppLifecycleState.paused || s == AppLifecycleState.hidden) {
      _sumber?.berhenti();
    } else if (s == AppLifecycleState.resumed) {
      _sumber?.mulai();
    }
  }

  Future<void> _periksa() async {
    setState(() {
      _tahap = _Tahap.memeriksa;
      _galat = null;
    });
    try {
      final p = await Kunci.statusPasang();
      if (!mounted) return;
      _pasang = p;
      if (p == null || p.status == 'menunggu' || p.status == 'ditolak') {
        _ganti(_Tahap.pasang);
      } else if (p.status == 'dicabut') {
        _ganti(_Tahap.dicabut);
      } else {
        _pasangSumber(SumberNyata());
        _ganti(_Tahap.aktif);
      }
    } on GalatKunci catch (e) {
      if (!mounted) return;
      setState(() {
        _tahap = _Tahap.galat;
        _galat = e.pesan;
      });
    }
  }

  void _ganti(_Tahap t) {
    Navigator.of(context).popUntil((r) => r.isFirst);
    setState(() => _tahap = t);
  }

  void _pasangSumber(SumberData s) {
    _sumber?.removeListener(_dariSumber);
    _sumber?.dispose();
    _sumber = s..addListener(_dariSumber);
    s.mulai();
  }

  void _lepasSumber() {
    _sumber?.removeListener(_dariSumber);
    _sumber?.dispose();
    _sumber = null;
  }

  void _dariSumber() {
    final s = _sumber;
    if (s == null || s.pratinjau) return;
    if (s.dicabut && _tahap == _Tahap.aktif) {
      _lepasSumber();
      _ganti(_Tahap.dicabut);
    }
  }

  void _masukPratinjau() {
    if (kReleaseMode) return; // pagar titik masuk: tidak terjangkau di rilis
    _pratinjau = true;
    _pasangSumber(SumberContoh());
    _ganti(_Tahap.aktif);
  }

  void _keluarPratinjau() {
    _pratinjau = false;
    _lepasSumber();
    _periksa();
  }

  Future<void> _setelahLepas() async {
    _pratinjau = false;
    _lepasSumber();
    await _periksa();
  }

  @override
  Widget build(BuildContext context) {
    final w = WarnaPadev.dari(context);
    switch (_tahap) {
      case _Tahap.memeriksa:
        return Scaffold(backgroundColor: w.bg, body: const Center(child: CircularProgressIndicator()));
      case _Tahap.galat:
        return Scaffold(
          backgroundColor: w.bg,
          body: SafeArea(
            child: Center(
              child: IsiKosong(
                ikon: Simbol.galatLingkar,
                judul: 'Status perangkat tidak bisa dibaca',
                teks: _galat,
                aksi: OutlinedButton(onPressed: _periksa, child: const Text('Coba lagi')),
              ),
            ),
          ),
        );
      case _Tahap.pasang:
        return LayarPasang(
          awal: _pasang,
          onTerpasang: _periksa,
          onPratinjau: kReleaseMode ? null : _masukPratinjau,
        );
      case _Tahap.dicabut:
        return LayarDicabut(namaMac: _pasang?.namaMac, onPasangUlang: _setelahLepas);
      case _Tahap.aktif:
        final s = _sumber!;
        return ListenableBuilder(
          listenable: s,
          builder: (context, _) {
            if (s.pembaruanWajib) {
              return LayarPembaruanWajib(sumber: s, onKeluarPratinjau: _pratinjau ? _keluarPratinjau : null);
            }
            return Cangkang(
              sumber: s,
              onLepas: _setelahLepas,
              onKeluarPratinjau: _pratinjau ? _keluarPratinjau : null,
            );
          },
        );
    }
  }
}
