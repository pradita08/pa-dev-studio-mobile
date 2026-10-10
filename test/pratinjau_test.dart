// Uji roadmap 2b/2c (pratinjau langsung & screenshot): kabar `pratinjau` / `pratinjau_gambar` → model, aksi & tanda terima,
// kartu "Coba di HP" (nyalakan, buka di browser, screenshot, matikan, galat).
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:padev_studio/layar/data.dart';
import 'package:padev_studio/layar/pratinjau.dart';
import 'package:padev_studio/tema/token.dart';

class _SumberUji extends SumberData {
  _SumberUji() {
    memuatAwal = false;
    macTersambung = true;
  }
  final dikirim = <String>[];
  int _n = 0;

  void kabarMasuk(Map<String, Object?> isi) {
    terapkanKabar(isi);
    beritahu();
  }

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
  @override
  Future<String?> transportPratinjau(String proyek, String aksi) async {
    dikirim.add('$proyek:$aksi');
    return 'pp${_n++}';
  }

  @override
  Future<void> transportBukaPratinjau(String proyek) async => dikirim.add('$proyek:buka');
}

Map<String, Object?> _kabar(int urut, String status, {bool bisaMulai = true, String? galat}) => {
      'jenis': 'pratinjau',
      'urut_mac': urut,
      'dibuat': DateTime.now().millisecondsSinceEpoch,
      'pratinjau': {
        'daftar': [
          {
            'proyek': 'simpeg',
            'status': status,
            'bisaMulai': bisaMulai,
            if (status == 'menyala') 'alamat': 'https://macbook.tail1234.ts.net:8443/beranda',
            if (status == 'menyala') 'sampai': DateTime.now().add(const Duration(minutes: 25)).millisecondsSinceEpoch,
            'galat': ?galat,
          },
        ],
      },
    };

Widget _app(_SumberUji s) => MaterialApp(
      theme: temaPadev(Brightness.light),
      home: Scaffold(
        body: ListenableBuilder(
          listenable: s,
          builder: (_, _) => SingleChildScrollView(child: KartuPratinjau(sumber: s, pratinjau: s.pratinjauProyek('simpeg')!)),
        ),
      ),
    );

void main() {
  test('model: snapshot & urut, gambar, tanda terima ditolak → galat', () async {
    final s = _SumberUji();
    s.kabarMasuk(_kabar(5, 'menyala'));
    expect(s.pratinjauProyek('simpeg')!.menyala, isTrue);
    expect(s.pratinjauProyek('simpeg')!.alamat, 'https://macbook.tail1234.ts.net:8443/beranda');
    s.kabarMasuk(_kabar(4, 'mati'));
    expect(s.pratinjauProyek('simpeg')!.status, 'menyala'); // lebih lama → diabaikan
    s.kabarMasuk({'jenis': 'pratinjau_gambar', 'pratinjau_gambar': {'proyek': 'simpeg', 'ukuran': 'hp', 'jpeg': 'AQID', 'lebar': 390, 'tinggi': 844}});
    expect(s.gambarProyek('simpeg')['hp']!.jpeg, [1, 2, 3]);
    await s.aksiPratinjau('simpeg', 'henti');
    expect(s.aksiPratinjauBerjalan('simpeg'), 'henti');
    s.kabarMasuk({'jenis': 'tanda_terima', 'tanda_terima': {'perintah_id': 'pp0', 'hasil': 'ditolak', 'alasan': 'tailscale_tidak_tersambung'}});
    expect(s.aksiPratinjauBerjalan('simpeg'), isNull);
    expect(s.galatPratinjau['simpeg'], 'tailscale_tidak_tersambung');
  });

  testWidgets('mati + bisaMulai → Nyalakan (aksi mulai); galat Mac tampil', (t) async {
    final s = _SumberUji();
    s.kabarMasuk(_kabar(1, 'gagal', galat: 'port 8080 sudah dipakai program lain'));
    await t.pumpWidget(_app(s));
    expect(find.text('Gagal'), findsOneWidget);
    expect(find.textContaining('port 8080 sudah dipakai'), findsOneWidget);
    await t.tap(find.text('Nyalakan pratinjau'));
    await t.pump();
    expect(s.dikirim, ['simpeg:mulai']);
    expect(find.textContaining('Menyalakan server di Mac'), findsOneWidget);
  });

  testWidgets('menyala → Buka di browser, Screenshot, Matikan; gambar tampil', (t) async {
    final s = _SumberUji();
    s.kabarMasuk(_kabar(1, 'menyala'));
    await t.pumpWidget(_app(s));
    expect(find.textContaining('Menyala · 2'), findsOneWidget);
    expect(find.text('https://macbook.tail1234.ts.net:8443/beranda'), findsOneWidget);
    await t.tap(find.text('Buka di browser'));
    await t.tap(find.text('Screenshot'));
    await t.pump();
    expect(s.dikirim, ['simpeg:buka', 'simpeg:potret']);
    expect(find.text('Memotret…'), findsOneWidget);
    s.kabarMasuk({'jenis': 'pratinjau_gambar', 'pratinjau_gambar': {'proyek': 'simpeg', 'ukuran': 'desktop', 'jpeg': 'AQID', 'lebar': 1280, 'tinggi': 800}});
    await t.pump();
    expect(find.textContaining('Desktop ·'), findsOneWidget);
    expect(find.text('Screenshot'), findsOneWidget);
    await t.tap(find.text('Matikan'));
    await t.pump();
    expect(s.dikirim.last, 'simpeg:henti');
  });

  testWidgets('HP mode Rencana: tanpa tombol Nyalakan', (t) async {
    final s = _SumberUji();
    s.kabarMasuk(_kabar(1, 'mati', bisaMulai: false));
    await t.pumpWidget(_app(s));
    expect(find.text('Nyalakan pratinjau'), findsNothing);
    expect(find.textContaining('butuh HP mode Kerjakan'), findsOneWidget);
  });
}
