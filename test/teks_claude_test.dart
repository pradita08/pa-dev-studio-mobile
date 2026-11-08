// G8 TeksClaude (markdown jawaban Claude, paket `markdown` 7.3.1): subset dirender ke widget, syarat Willy 1-8 —
// batas panjang/kedalaman → teks polos, kasus jahat tidak crash, tanpa tautan yang bisa diketuk, tanpa gambar/jaringan.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:padev_studio/komponen/komponen.dart';
import 'package:padev_studio/tema/token.dart';

Widget _app(Widget anak) => MaterialApp(theme: temaPadev(Brightness.light), home: Scaffold(body: ListView(children: [anak])));

/// Pasang TeksClaude lalu tunggu urai di isolate (waktu nyata) selesai.
Future<void> _pasang(WidgetTester t, String teks) async {
  // dipasang di zona waktu nyata supaya hasil Isolate.run sampai (zona uji palsu tidak memproses port isolat)
  await t.runAsync(() async {
    await t.pumpWidget(_app(TeksClaude(teks)));
    await Future<void>.delayed(const Duration(milliseconds: 1500));
  });
  await t.pump();
}

void _tanpaTautan(WidgetTester t) {
  for (final rt in t.widgetList<RichText>(find.byType(RichText))) {
    rt.text.visitChildren((s) {
      expect(s is TextSpan ? s.recognizer : null, isNull, reason: 'tidak boleh ada tautan yang bisa diketuk');
      return true;
    });
  }
  expect(find.byType(Image), findsNothing, reason: 'tanpa gambar/jaringan');
}

void main() {
  group('uraiMarkdown', () {
    test('subset dasar terurai', () {
      final ast = uraiMarkdown('# Judul\n\n**tebal** dan `kode`\n\n- a\n- b\n\n```sql\nSELECT 1;\n```\n\n| a | b |\n|---|---|\n| 1 | 2 |');
      expect(ast, isNotNull);
      expect(ast!.map((n) => n.textContent).join('|'), contains('SELECT 1;'));
    });
    test('> 8000 huruf → polos tanpa urai', () => expect(uraiMarkdown('a' * (batasUraiMarkdown + 1)), isNull));
    test('SEC-167 tabel besar → polos, cepat (disusun di isolat dengan batas)', () {
      final sw = Stopwatch()..start();
      final lebar = '| ${'a' * 3000} | b |\n|---|---|\n${'| x | y |\n' * 150}'; // 3000 × 151 baris > 16.000
      final baris = '| a | b |\n|---|---|\n${'|x|y|\n' * 1000}'; // > 200 baris
      final kolom = '${'| a ' * 25}|\n${'|---' * 25}|\n'; // > 20 kolom
      for (final t in [lebar, baris, kolom]) {
        expect(t.length, lessThanOrEqualTo(batasUraiMarkdown));
        expect(uraiMarkdown(t), isNull);
      }
      expect(sw.elapsed, lessThan(const Duration(seconds: 2)));
      final kecil = uraiMarkdown('| a | b |\n|---|---|\n| 1 | 2 |');
      expect(kecil!.single.textContent, 'a | b\n--+--\n1 | 2');
    });
    test('kedalaman > 12 → polos', () {
      expect(uraiMarkdown('${'> ' * 14}dalam'), isNull);
      expect(uraiMarkdown('${'> ' * 3}cukup'), isNotNull);
    });
  });

  testWidgets('markdown dirender tanpa simbol mentah; kode & tabel di BlokKode', (t) async {
    await _pasang(t, '## Penyebab\n\nQuery **tanpa indeks**.\n\n1. tambah indeks\n2. uji\n\n```\nCREATE INDEX i ON t(a);\n```\n\n| kol | nilai |\n|---|---|\n| a | 1 |');
    expect(find.text('Penyebab'), findsOneWidget);
    expect(find.text('Query tanpa indeks.'), findsOneWidget);
    expect(find.textContaining('**'), findsNothing);
    expect(find.byType(BlokKode), findsNWidgets(2));
    expect(find.text('CREATE INDEX i ON t(a);'), findsOneWidget);
    expect(find.textContaining('-+-'), findsOneWidget); // tabel → mono rata kolom (ASCII: aman di semua font mono)
    expect(find.text('Salin'), findsNWidgets(2));
    expect(find.byType(SelectionArea), findsOneWidget);
    _tanpaTautan(t);
  });

  testWidgets('tautan & gambar hanya teks/alt, HTML mentah tampil sebagai teks', (t) async {
    await _pasang(t, 'buka [di sini](javascript:alert(1)) ![logo](https://contoh.test/a.png) <b>x</b> https://contoh.test');
    expect(find.textContaining('javascript'), findsNothing);
    expect(find.textContaining('di sini'), findsOneWidget);
    expect(find.textContaining('logo'), findsOneWidget);
    _tanpaTautan(t);
  });

  for (final (nama, teks) in [
    ('> ×6000', '>' * 6000),
    ('- ×1000', '- ' * 1000),
    ('_a ×4000', '_a' * 4000),
    ('[[[]]]', '[[[]]]' * 500),
    ('tabel besar (SEC-167)', '| ${'a' * 3000} | b |\n|---|---|\n${'| x | y |\n' * 150}'),
    ('fence belum ditutup', '```dart\nvoid main() {\n  print(1);\n'),
    ('baris "- " bersarang', [for (var i = 0; i < 40; i++) '${'  ' * i}- x'].join('\n')),
  ]) {
    testWidgets('kasus jahat tidak crash: $nama', (t) async {
      await _pasang(t, teks);
      expect(t.takeException(), isNull);
      expect(find.byType(TeksClaude), findsOneWidget);
      if (nama.startsWith('fence')) expect(find.byType(BlokKode), findsOneWidget, reason: 'fence belum ditutup = kode sampai akhir');
      _tanpaTautan(t);
    });
  }

  testWidgets('> 18 baris dilipat; ketuk = tampilkan semua', (t) async {
    await _pasang(t, [for (var i = 1; i <= 30; i++) 'baris $i'].join('\n\n'));
    expect(find.text('Tampilkan semua (59 baris)'), findsOneWidget);
    await t.tap(find.text('Tampilkan semua (59 baris)'));
    await t.pump();
    expect(find.text('Lipat'), findsOneWidget);
  });

  testWidgets('RingkasLangkah: satu baris ringkas, ketuk = daftar', (t) async {
    await t.pumpWidget(_app(const RingkasLangkah(langkah: [('Read', 'a.dart', false), ('Edit', 'b.dart', false), ('Bash', 'npm test', true)])));
    expect(find.text('3 langkah · 1 mengubah · 1 gagal'), findsOneWidget);
    expect(find.textContaining('b.dart', findRichText: true), findsNothing);
    await t.tap(find.text('3 langkah · 1 mengubah · 1 gagal'));
    await t.pump();
    expect(find.textContaining('b.dart', findRichText: true), findsOneWidget);
    expect(find.textContaining('Bash · gagal', findRichText: true), findsOneWidget);
  });
}
