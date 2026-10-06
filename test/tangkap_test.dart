// Tangkapan layar pratinjau (bukti visual saat HP tidak bisa dipakai). Dilewati kecuali TANGKAP=1:
//   TANGKAP=1 flutter test test/tangkap_test.dart --update-goldens   → build/tangkap/*.png
// Font aplikasi (Plus Jakarta Sans + Material Symbols) dimuat dari assets; teks monospace memakai Plus Jakarta Sans (perkiraan).
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:padev_studio/layar/cangkang.dart';
import 'package:padev_studio/layar/chat.dart';
import 'package:padev_studio/pratinjau/contoh.dart';
import 'package:padev_studio/tema/token.dart';

final _lewati = Platform.environment['TANGKAP'] != '1';

Future<void> _muatFont() async {
  Future<ByteData> b(String p) async => ByteData.sublistView(Uint8List.fromList(await File(p).readAsBytes()));
  for (final keluarga in ['PlusJakartaSans', 'monospace']) {
    final l = FontLoader(keluarga);
    for (final f in ['Regular', 'Medium', 'SemiBold', 'Bold', 'ExtraBold']) {
      l.addFont(b('assets/fonts/PlusJakartaSans-$f.ttf'));
    }
    await l.load();
  }
  await (FontLoader('MaterialSymbolsRounded')..addFont(b('assets/fonts/MaterialSymbolsRounded.ttf'))).load();
}

Widget _app(Brightness k, Widget anak) => MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: temaPadev(k),
      darkTheme: temaPadev(Brightness.dark),
      themeMode: k == Brightness.dark ? ThemeMode.dark : ThemeMode.light,
      home: anak,
    );

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  const kanal = MethodChannel('pro.padeveloper.studio/kunci');

  setUpAll(() async {
    if (_lewati) return;
    await _muatFont();
  });

  setUp(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(kanal, (c) async => null);
  });

  var lebar390 = false;

  Future<void> ukuran(WidgetTester t) async {
    // 412 dp (tangkapan lama) atau 390 dp (v2 F1, STANDAR_KODE §7.2)
    t.view.physicalSize = lebar390 ? const Size(1170, 2532) : const Size(1080, 2400);
    t.view.devicePixelRatio = lebar390 ? 3 : 2.625;
    t.view.padding = const FakeViewPadding(top: 110, bottom: 60);
    addTearDown(t.view.reset);
  }

  Future<void> tangkap(WidgetTester t, Brightness k, Widget Function(SumberContoh) layar, String nama, {Future<void> Function()? aksi}) async {
    await ukuran(t);
    final s = SumberContoh()..memuatAwal = false;
    await t.runAsync(() async {
      await t.pumpWidget(_app(k, layar(s)));
    });
    await t.pump(const Duration(milliseconds: 300));
    if (aksi != null) await aksi();
    await t.pump(const Duration(milliseconds: 400));
    await expectLater(find.byType(MaterialApp), matchesGoldenFile('../build/tangkap/$nama.png'));
    await t.pumpWidget(const SizedBox());
    s.dispose();
  }

  Cangkang cangkang(SumberContoh s) => Cangkang(sumber: s, onLepas: () async {}, onKeluarPratinjau: () {});

  testWidgets('beranda terang', (t) async {
    await tangkap(t, Brightness.light, cangkang, 'ui-apk-beranda-412');
  }, skip: _lewati);

  testWidgets('chat terang (bekerja)', (t) async {
    await tangkap(t, Brightness.light, (s) => LayarChat(sumber: s, proyekId: 'simpeg'), 'ui-apk-chat-412');
  }, skip: _lewati);

  testWidgets('pengaturan terang', (t) async {
    await tangkap(t, Brightness.light, cangkang, 'ui-apk-pengaturan-412', aksi: () async {
      await t.tap(find.text('Pengaturan').last);
      await t.pump(const Duration(milliseconds: 300));
    });
  }, skip: _lewati);

  testWidgets('kantor gelap', (t) async {
    await tangkap(t, Brightness.dark, cangkang, 'ui-apk-kantor-gelap-412', aksi: () async {
      await t.tap(find.text('Kantor').last);
      await t.pump(const Duration(milliseconds: 300));
    });
  }, skip: _lewati);

  // ---- v2 F1: tab Sesi (390 dp)
  Future<void> jalan(WidgetTester t, int ms) async {
    for (var i = 0; i < ms ~/ 100; i++) {
      await t.pump(const Duration(milliseconds: 100));
    }
  }

  Future<void> muatDaftar(WidgetTester t, SumberContoh s) async {
    s.mintaDaftarSesi(); // jangan ditunggu: jawaban contoh memakai jam palsu yang hanya maju lewat pump
    await jalan(t, 1600);
  }

  testWidgets('sesi daftar terang 390', (t) async {
    lebar390 = true;
    addTearDown(() => lebar390 = false);
    late SumberContoh sumber;
    await tangkap(t, Brightness.light, (s) {
      sumber = s;
      return cangkang(s);
    }, 'ui-apk-sesi-390', aksi: () async {
      await muatDaftar(t, sumber);
      await t.tap(find.text('Sesi').last);
      await jalan(t, 400);
    });
  }, skip: _lewati);

  testWidgets('sesi detail isi terang 390 (langsung + celah)', (t) async {
    lebar390 = true;
    addTearDown(() => lebar390 = false);
    late SumberContoh sumber;
    await tangkap(t, Brightness.light, (s) {
      sumber = s;
      return cangkang(s);
    }, 'ui-apk-sesi-detail-390', aksi: () async {
      await muatDaftar(t, sumber);
      await t.tap(find.text('Sesi').last);
      await t.pump();
      await t.tap(find.text('Perbaiki validasi NIP di form pegawai'));
      await jalan(t, 12000);
    });
  }, skip: _lewati);

  testWidgets('sesi detail ringkas terang 390', (t) async {
    lebar390 = true;
    addTearDown(() => lebar390 = false);
    late SumberContoh sumber;
    await tangkap(t, Brightness.light, (s) {
      sumber = s;
      return cangkang(s);
    }, 'ui-apk-sesi-ringkas-390', aksi: () async {
      await muatDaftar(t, sumber);
      await t.tap(find.text('Sesi').last);
      await t.pump();
      await t.tap(find.text('Audit modul paket'));
      await jalan(t, 6000);
    });
  }, skip: _lewati);
}
