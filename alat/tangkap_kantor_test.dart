// Tangkapan layar (manual, bukan uji CI): flutter test alat/tangkap_kantor_test.dart --update-goldens → alat/*.png (jangan di-commit)
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:padev_studio/layar/cangkang.dart';
import 'package:padev_studio/pratinjau/contoh.dart';
import 'package:padev_studio/tema/token.dart';

Future<void> _font(String keluarga, List<String> berkas) async {
  final l = FontLoader(keluarga);
  for (final b in berkas) {
    l.addFont(rootBundle.load(b));
  }
  await l.load();
}

void main() {
  testWidgets('tab Kantor (alur live) + menu bawah', (t) async {
    await _font('PlusJakartaSans', ['assets/fonts/PlusJakartaSans-Regular.ttf', 'assets/fonts/PlusJakartaSans-SemiBold.ttf', 'assets/fonts/PlusJakartaSans-Bold.ttf', 'assets/fonts/PlusJakartaSans-ExtraBold.ttf']);
    await _font('MaterialSymbolsRounded', ['assets/fonts/MaterialSymbolsRounded.ttf']);
    t.view.physicalSize = const Size(1080, 2340);
    t.view.devicePixelRatio = 2.75;
    addTearDown(t.view.reset);
    final s = SumberContoh();
    await t.pumpWidget(MaterialApp(theme: temaPadev(Brightness.light), debugShowCheckedModeBanner: false,
        home: Cangkang(sumber: s, onLepas: () async {})));
    await t.pump(const Duration(milliseconds: 300));
    await t.tap(find.text('Kantor').last);
    await t.pump(const Duration(milliseconds: 600));
    await expectLater(find.byType(Cangkang), matchesGoldenFile('kantor.png'));
    await t.tap(find.text('Pengaturan').last);
    await t.pump(const Duration(milliseconds: 600));
    await t.drag(find.byType(ListView).last, const Offset(0, -300));
    await t.pump(const Duration(milliseconds: 300));
    await expectLater(find.byType(Cangkang), matchesGoldenFile('pengaturan.png'));
    s.dispose();
  });
}
