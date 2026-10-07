// Kantor 3D (F2, tab Kantor): PlatformView native `pro.padeveloper.studio/kantor3d` = WebView terkunci yang memuat aset
// assets/kantor/ (dibuat buat-kantor-apk.js di repo kantor). Data mengalir SATU ARAH ke halaman (kanal per tampilan, metode
// `terima` berisi JSON tim proyek); halaman tidak punya jalan ke native/kunci. Render dijeda saat tab tidak terlihat / aplikasi
// ke latar. Di luar Android (uji widget, tangkapan layar) tampil pengganti statis.
import 'dart:convert';
import 'dart:io' show Platform;

import 'package:flutter/foundation.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';

import '../komponen/komponen.dart';
import '../tema/token.dart';
import 'data.dart';

class Kantor3d extends StatefulWidget {
  const Kantor3d({super.key, required this.proyek, required this.divisi, required this.aktif, this.utama = 'diam'});
  final String proyek;
  final List<Divisi> divisi;

  /// Status Claude utama (Kepala): 'bekerja' | 'menunggu_izin' | 'diam'.
  final String utama;

  /// false = tab Kantor tidak terlihat → render dijeda (hemat baterai).
  final bool aktif;

  static const jenis = 'pro.padeveloper.studio/kantor3d';
  static bool get tersedia => !kIsWeb && Platform.isAndroid;

  @override
  State<Kantor3d> createState() => _Kantor3dState();
}

class _Kantor3dState extends State<Kantor3d> with WidgetsBindingObserver {
  MethodChannel? _kanal;
  bool _latar = false, _hilang = false;
  int _generasi = 0;
  String? _terkirim;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _kanal?.setMethodCallHandler(null);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    _latar = state != AppLifecycleState.resumed;
    _aturJeda();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _kirim();   // tema terang/gelap berubah
  }

  @override
  void didUpdateWidget(Kantor3d lama) {
    super.didUpdateWidget(lama);
    _kirim();
    if (lama.aktif != widget.aktif) _aturJeda();
  }

  String _json(BuildContext context) => jsonEncode({
        'tema': Theme.of(context).brightness == Brightness.dark ? 'gelap' : 'terang',
        'proyek': widget.proyek,
        'utama': widget.utama,
        'divisi': [
          for (final d in widget.divisi.take(10))
            {'nama': d.nama, 'peran': d.peran, 'status': d.status, 'ke': d.ke, if (d.ringkas != null) 'ringkas': d.ringkas},
        ],
      });

  void _kirim() {
    final k = _kanal;
    if (k == null || !mounted) return;
    final j = _json(context);
    if (j == _terkirim) return;
    _terkirim = j;
    k.invokeMethod<void>('terima', j).catchError((_) {});
  }

  void _aturJeda() => _kanal?.invokeMethod<void>('jeda', !widget.aktif || _latar).catchError((_) {});

  void _dibuat(int id) {
    final k = MethodChannel('${Kantor3d.jenis}_$id');
    k.setMethodCallHandler((c) async {
      if (c.method == 'hilang' && mounted) setState(() => _hilang = true);
    });
    _kanal = k;
    _terkirim = null;
    _kirim();
    _aturJeda();
  }

  @override
  Widget build(BuildContext context) {
    final w = WarnaPadev.dari(context);
    if (!Kantor3d.tersedia) {
      return _Pengganti(w: w, teks: 'Tampilan 3D kantor tampil di HP Android.');
    }
    if (_hilang) {
      return _Pengganti(
        w: w,
        teks: 'Tampilan 3D berhenti (memori grafis HP penuh).',
        aksi: OutlinedButton(
          onPressed: () => setState(() {
            _hilang = false;
            _kanal = null;
            _generasi++;
          }),
          child: const Text('Muat ulang'),
        ),
      );
    }
    return AndroidView(
      key: ValueKey(_generasi),
      viewType: Kantor3d.jenis,
      layoutDirection: TextDirection.ltr,
      creationParams: {'tema': Theme.of(context).brightness == Brightness.dark ? 'gelap' : 'terang'},
      creationParamsCodec: const StandardMessageCodec(),
      onPlatformViewCreated: _dibuat,
      // seret/putar/zoom di area 3D tidak ikut menggulir daftar
      gestureRecognizers: {Factory<OneSequenceGestureRecognizer>(EagerGestureRecognizer.new)},
      hitTestBehavior: PlatformViewHitTestBehavior.opaque,
    );
  }
}

class _Pengganti extends StatelessWidget {
  const _Pengganti({required this.w, required this.teks, this.aksi});
  final WarnaPadev w;
  final String teks;
  final Widget? aksi;

  @override
  Widget build(BuildContext context) => ColoredBox(
        color: w.panel,
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              Icon(Simbol.kantor, size: 34, color: w.muted),
              const SizedBox(height: 8),
              Text(teks, textAlign: TextAlign.center, style: TeksPadev.redup(w)),
              if (aksi != null) ...[const SizedBox(height: 10), aksi!],
            ]),
          ),
        ),
      );
}
