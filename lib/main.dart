// PADEV Studio — titik masuk. Layar L01–L10 ada di lib/layar/**; fasad native di lib/kunci/kunci.dart (milik Putri).
import 'package:flutter/material.dart';

import 'kunci/kunci.dart';
import 'layar/akar.dart';
import 'layar/kunci.dart';
import 'tema/token.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const AplikasiPadev());
}

class AplikasiPadev extends StatelessWidget {
  const AplikasiPadev({super.key});

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<ThemeMode>(
      valueListenable: temaAplikasi,
      builder: (context, mode, _) => MaterialApp(
        title: 'PADEV Studio',
        debugShowCheckedModeBanner: false,
        theme: temaPadev(Brightness.light),
        darkTheme: temaPadev(Brightness.dark),
        themeMode: mode,
        // Gerbang membungkus Navigator: saat terkunci lagi, layar kunci menutup SEMUA rute (termasuk chat yang sedang terbuka).
        builder: (context, navigator) => GerbangKunci(anak: navigator ?? const SizedBox.shrink()),
        home: const AkarAplikasi(),
      ),
    );
  }
}

/// Kunci aplikasi saat dibuka & setelah 2 menit di latar (kontrak §6, SEC-54).
/// Isi aplikasi baru dibangun setelah buka kunci pertama; saat terkunci lagi isi disembunyikan (Offstage, tanpa semantik/animasi).
/// SEC-75: lama di latar diukur dengan jam monoton (Stopwatch + jam boot Android yang ikut menghitung waktu tidur); jam dinding
/// hanya lapis tambahan (mundur atau ≥ 2 mnt = kunci). "Tirai" menutup isi sejak paused/hidden dan baru dilepas saat kembali < 2 mnt.
class GerbangKunci extends StatefulWidget {
  const GerbangKunci({super.key, required this.anak});
  final Widget anak;

  static const batasLatar = Duration(minutes: 2);

  @override
  State<GerbangKunci> createState() => _GerbangKunciState();
}

class _GerbangKunciState extends State<GerbangKunci> with WidgetsBindingObserver {
  bool _terkunci = true;
  bool _tirai = false;
  bool _pernahBuka = false;
  bool _sedangMembuka = false;
  bool? _adaKunciLayar;
  String? _galat;
  final _latar = Stopwatch();
  DateTime? _keLatarDinding;
  Future<int?>? _keLatarBoot;

  /// setState + umumkan keadaan gerbang ke fasad (hasil pindai QR dibuang bila tidak terbuka, SEC-76).
  void _atur(VoidCallback f) {
    setState(f);
    Kunci.gerbang.value = _terkunci
        ? KeadaanGerbang.terkunci
        : _tirai
            ? KeadaanGerbang.tirai
            : KeadaanGerbang.terbuka;
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    Kunci.gerbang.value = KeadaanGerbang.terkunci;
    WidgetsBinding.instance.addPostFrameCallback((_) => _buka());
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState s) {
    // Tirai dipasang sejak inactive: setelah hidden/paused Flutter tidak menggambar frame lagi, jadi tirai yang baru diset
    // di sana tidak pernah tampil (mis. di pratinjau "aplikasi terbaru" build debug yang tanpa FLAG_SECURE).
    if (s == AppLifecycleState.inactive) {
      if (!_tirai) _atur(() => _tirai = true);
    } else if (s == AppLifecycleState.paused || s == AppLifecycleState.hidden) {
      if (!_latar.isRunning) {
        _latar
          ..reset()
          ..start();
        _keLatarDinding = DateTime.now();
        _keLatarBoot = Kunci.jamMonoton();
      }
      if (!_tirai) _atur(() => _tirai = true);
    } else if (s == AppLifecycleState.resumed) {
      if (_latar.isRunning) {
        _kembali();
      } else if (_tirai) {
        _atur(() => _tirai = false); // hanya inactive sesaat (dialog sidik jari, tarik notifikasi): tidak ke latar
      }
    }
  }

  Future<void> _kembali() async {
    _latar.stop();
    final lamaJam = _latar.elapsed;
    final dinding = DateTime.now().difference(_keLatarDinding ?? DateTime.now());
    final boot0 = await _keLatarBoot;
    final boot1 = await Kunci.jamMonoton();
    if (!mounted) return;
    const batas = GerbangKunci.batasLatar;
    final lamaBoot = boot0 != null && boot1 != null ? Duration(milliseconds: boot1 - boot0) : Duration.zero;
    final kunci = lamaJam >= batas || lamaBoot >= batas || lamaBoot.isNegative || dinding >= batas || dinding.isNegative;
    if (_latar.isRunning) {
      // sudah ke latar lagi selagi menilai: tirai tetap; layar kunci menunggu pengguna kembali
      if (kunci && !_terkunci) _atur(() => _terkunci = true);
      return;
    }
    if (kunci && !_terkunci) {
      FocusManager.instance.primaryFocus?.unfocus(); // keyboard tidak boleh tetap terbuka di atas layar kunci
      _atur(() {
        _terkunci = true;
        _tirai = false;
      });
      _buka();
    } else {
      _atur(() => _tirai = false);
    }
  }

  Future<void> _buka() async {
    if (_sedangMembuka || !mounted) return;
    setState(() {
      _sedangMembuka = true;
      _galat = null;
    });
    try {
      final st = await Kunci.statusKeamanan();
      _adaKunciLayar = st.kunciLayar;
      if (!st.kunciLayar) return;
      final ok = await Kunci.bukaKunciAplikasi();
      if (ok) {
        _terkunci = false;
        _pernahBuka = true;
      }
    } on GalatKunci catch (e) {
      _galat = e.kode == 'dibatalkan' ? null : e.pesan;
    } finally {
      if (mounted) _atur(() => _sedangMembuka = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final kunci = LayarKunci(
      onBuka: _buka,
      sedangMembuka: _sedangMembuka,
      tanpaKunciLayar: _adaKunciLayar == false,
      galat: _galat,
    );
    if (!_pernahBuka) return kunci;
    final sembunyi = _terkunci || _tirai;
    return Stack(fit: StackFit.expand, children: [
      Offstage(
        offstage: sembunyi,
        child: TickerMode(enabled: !sembunyi, child: ExcludeSemantics(excluding: sembunyi, child: widget.anak)),
      ),
      if (_terkunci)
        kunci
      else if (_tirai)
        ColoredBox(color: WarnaPadev.dari(context).bg, child: const SizedBox.expand()),
    ]);
  }
}
