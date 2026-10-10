// Uji tab Proyek: cari proyek (lokal di HP: nama/id, tanpa beda huruf besar/kecil) + bagian per grup folder.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:padev_studio/layar/beranda.dart';
import 'package:padev_studio/layar/data.dart';
import 'package:padev_studio/tema/token.dart';

Proyek _p(String id, String nama) => Proyek(id: id, nama: nama, akun: const ['akun1'], hp: 'rencana', sibuk: false);

void main() {
  final daftar = [_p('simpeg', 'SIMPEG'), _p('simukpbj', 'SIMUK PBJ'), _p('web-dkk-v2', 'Web DKK v2')];

  test('kata kosong/spasi → semua proyek', () {
    expect(saringProyek(daftar, ''), daftar);
    expect(saringProyek(daftar, '   '), daftar);
  });

  test('cocok nama atau id, tanpa beda huruf besar/kecil', () {
    expect(saringProyek(daftar, 'sim').map((p) => p.id), ['simpeg', 'simukpbj']);
    expect(saringProyek(daftar, 'PBJ').map((p) => p.id), ['simukpbj']);
    expect(saringProyek(daftar, 'dkk-v2').map((p) => p.id), ['web-dkk-v2']);
    expect(saringProyek(daftar, ' dkk ').map((p) => p.id), ['web-dkk-v2']);
  });

  test('tidak ada yang cocok → kosong', () {
    expect(saringProyek(daftar, 'labkesda'), isEmpty);
  });

  grupMain();
}

// ---- grup per folder (label `grup` dari Mac; urutan & bagian terbuka disimpan di HP)

Proyek _g(String id, String? grup) => Proyek(id: id, nama: id.toUpperCase(), akun: const ['akun1'], hp: 'rencana', sibuk: false, grup: grup);

class _SumberUji extends SumberData {
  _SumberUji({this.tersimpan}) {
    memuatAwal = false;
    macTersambung = true;
  }
  String? tersimpan;
  final disimpan = <String>[];

  void status(List<Map<String, Object?>> proyek) {
    terapkanStatus({
      'status': {'proyek': proyek, 'versi': '1'},
    });
    beritahu();
  }

  @override
  Future<String?> transportMuatTampilan() async => tersimpan;
  @override
  Future<void> transportSimpanTampilan(String isi) async => disimpan.add(isi);
  @override
  Future<void> transportSegarkan() async {}
  @override
  Future<String> transportKirim(Tugas t) async => 'p1';
  @override
  Future<void> transportHentikan(Tugas t) async {}
  @override
  Future<void> transportHapusSesi(String proyek, String akun) async {}
  @override
  Future<void> lepasPerangkat() async {}
  @override
  Future<void> mintaStatus() async {}
}

Map<String, Object?> _st(String id, [String? grup]) => {'id': id, 'nama': id.toUpperCase(), 'akun': ['akun1'], 'hp': 'rencana', 'sibuk': false, 'grup': ?grup};

// seperti akar.dart: seluruh pohon dibangun ulang saat sumber berubah
Widget _app(SumberData s) => MaterialApp(
      theme: temaPadev(Brightness.light),
      home: Scaffold(body: ListenableBuilder(listenable: s, builder: (_, _) => LayarBeranda(sumber: s, onBukaChat: (_) {}))),
    );

void grupMain() {
  group('kelompokkanProyek', () {
    final daftar = [_g('simpeg', 'KOMINFO'), _g('mpp', 'ARDANA'), _g('sandbox', 'Umum'), _g('etpp', 'KOMINFO'), _g('lama', null)];
    String bentuk(List<(String, List<Proyek>)> b) => b.map((e) => '${e.$1}:${e.$2.map((p) => p.id).join(',')}').join(' ');

    test('bawaan: Umum (termasuk tanpa grup) dulu, lalu urutan kemunculan; urutan proyek dalam grup tetap', () {
      expect(bentuk(kelompokkanProyek(daftar, const [])), 'Umum:sandbox,lama KOMINFO:simpeg,etpp ARDANA:mpp');
    });

    test('urutan pilihan owner dulu; grup tak dikenal diabaikan; sisanya bawaan', () {
      expect(bentuk(kelompokkanProyek(daftar, const ['ARDANA', 'HILANG', 'KOMINFO'])), 'ARDANA:mpp KOMINFO:simpeg,etpp Umum:sandbox,lama');
    });

    test('pelaksana lama (tanpa grup) → satu grup Umum', () {
      expect(kelompokkanProyek([_g('a', null), _g('b', null)], const []).length, 1);
    });
  });

  group('tampilan tersimpan', () {
    test('dimuat sekali; isi rusak → bawaan; simpan menulis JSON', () async {
      final s = _SumberUji(tersimpan: '{"v":1,"urut":["ARDANA","KOMINFO",7,""],"buka":["KOMINFO"]}');
      await s.muatTampilanProyek();
      expect(s.urutGrup, ['ARDANA', 'KOMINFO']);
      expect(s.grupTerbuka, {'KOMINFO'});
      s.tersimpan = '{"urut":["X"]}';
      await s.muatTampilanProyek(); // sekali saja
      expect(s.urutGrup, ['ARDANA', 'KOMINFO']);
      s.bukaGrup('ARDANA', true);
      s.bukaGrup('KOMINFO', false);
      expect(s.grupTerbuka, {'ARDANA'});
      expect(s.disimpan.last, '{"v":1,"urut":["ARDANA","KOMINFO"],"buka":["ARDANA"]}');
      final r = _SumberUji(tersimpan: 'bukan json');
      await r.muatTampilanProyek();
      expect(r.urutGrup, isEmpty);
      expect(r.grupTerbuka, isEmpty);
    });

    test('status: grup dibaca (dipangkas, maks 30); kosong → null', () {
      final s = _SumberUji();
      s.status([_st('a', '  KOMINFO '), _st('b', ''), _st('c', 'x' * 40), _st('d')]);
      expect(s.proyek.map((p) => p.grup), ['KOMINFO', null, 'x' * 30, null]);
    });
  });

  group('tab Proyek per grup', () {
    testWidgets('bagian terlipat bawaan; ketuk kepala → terbuka & disimpan; satu grup → tanpa kepala', (t) async {
      final s = _SumberUji();
      s.status([_st('simpeg', 'KOMINFO'), _st('etpp', 'KOMINFO'), _st('mpp', 'ARDANA'), _st('sandbox', 'Umum')]);
      await t.pumpWidget(_app(s));
      expect(find.text('KOMINFO'), findsOneWidget);
      expect(find.text('ARDANA'), findsOneWidget);
      expect(find.text('Umum'), findsOneWidget);
      expect(find.text('SIMPEG'), findsNothing);
      expect(find.byTooltip('Atur grup'), findsOneWidget);
      await t.tap(find.text('KOMINFO'));
      await t.pump();
      expect(find.text('SIMPEG'), findsOneWidget);
      expect(find.text('ETPP'), findsOneWidget);
      expect(find.text('MPP'), findsNothing);
      expect(s.disimpan.last, contains('"buka":["KOMINFO"]'));
      s.status([_st('a'), _st('b')]); // pelaksana lama
      await t.pump();
      expect(find.text('Umum'), findsNothing);
      expect(find.text('A'), findsOneWidget);
      expect(find.byTooltip('Atur grup'), findsNothing);
    });

    testWidgets('mencari → bagian yang cocok terbuka; status lipat tidak berubah', (t) async {
      final s = _SumberUji();
      s.status([_st('simpeg', 'KOMINFO'), _st('mpp', 'ARDANA'), _st('simami', 'ARDANA')]);
      await t.pumpWidget(_app(s));
      await t.enterText(find.byType(TextField), 'sim');
      await t.pump();
      expect(find.text('SIMPEG'), findsOneWidget);
      expect(find.text('SIMAMI'), findsOneWidget);
      expect(find.text('MPP'), findsNothing);
      expect(s.grupTerbuka, isEmpty);
      expect(s.disimpan, isEmpty);
    });

    testWidgets('Atur grup: turunkan / buka semua / urutan bawaan', (t) async {
      final s = _SumberUji();
      s.status([_st('sandbox', 'Umum'), _st('simpeg', 'KOMINFO'), _st('mpp', 'ARDANA')]);
      await t.pumpWidget(_app(s));
      await t.tap(find.byTooltip('Atur grup'));
      await t.pumpAndSettle();
      await t.tap(find.byTooltip('Turunkan Umum'));
      await t.pump();
      expect(s.urutGrup, ['KOMINFO', 'Umum', 'ARDANA']);
      await t.tap(find.byTooltip('Naikkan ARDANA'));
      await t.pump();
      expect(s.urutGrup, ['KOMINFO', 'ARDANA', 'Umum']);
      await t.tap(find.text('Buka semua'));
      await t.pump();
      expect(s.grupTerbuka, {'KOMINFO', 'ARDANA', 'Umum'});
      await t.tap(find.text('Urutan bawaan'));
      await t.pump();
      expect(s.urutGrup, isEmpty);
      expect(kelompokkanProyek(s.proyek, s.urutGrup).map((e) => e.$1), ['Umum', 'KOMINFO', 'ARDANA']);
    });
  });
}
