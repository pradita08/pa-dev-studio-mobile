// Uji roadmap 3 (limit token): status limit 5 jam/7 hari + fitur + antrean + pemakaian, kabar tugas `antre` (kirim ulang
// jam coba-lagi, mulai dengan akun lain), simpan riwayat, notifikasi limit/antre, akun otomatis hanya bila Mac mendukung,
// kartu Mac (bar per akun, laporan 7 hari), dan chat (pilihan Otomatis, status antre + Batalkan, pemakaian).
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:padev_studio/layar/beranda.dart';
import 'package:padev_studio/layar/chat.dart';
import 'package:padev_studio/layar/data.dart';
import 'package:padev_studio/tema/token.dart';

class _SumberUji extends SumberData {
  _SumberUji() {
    memuatAwal = false;
    macTersambung = true;
  }
  final dikirim = <Tugas>[];
  final dihentikan = <String>[];

  void kabarMasuk(Map<String, Object?> isi) {
    terapkanKabar(isi);
    beritahu();
  }

  @override
  Future<void> transportSegarkan() async {}
  @override
  Future<String> transportKirim(Tugas t) async {
    dikirim.add(t);
    return 'p${dikirim.length}';
  }

  @override
  Future<void> transportHentikan(Tugas t) async => dihentikan.add(t.tugas);
  @override
  Future<void> transportHapusSesi(String proyek, String akun) async {}
  @override
  Future<void> lepasPerangkat() async {}
  @override
  Future<void> mintaStatus() async {}
}

final _kini = DateTime.now().millisecondsSinceEpoch;
const _jam = 3600 * 1000;

Map<String, Object?> _status({bool fitur = true, List<String> akun = const ['akun1', 'akun2'], int antre = 0}) => {
      'jenis': 'status',
      'status': {
        'proyek': [
          {'id': 'simpeg', 'nama': 'SIMPEG', 'akun': akun, 'hp': 'rencana', 'sibuk': false},
        ],
        'versi': '1',
        'limit': [
          {'akun': 'akun1', 'persen5j': 97, 'reset5j': _kini + _jam, 'persen7h': 40.5, 'reset7h': _kini + 50 * _jam, 'waktu': _kini},
          {'akun': 'akun2', 'persen7h': 20, 'reset7h': _kini + 80 * _jam, 'waktu': _kini - 40 * 60000, 'lama': true},
          {'akun': 'akun3'},
        ],
        if (fitur) 'fitur': ['akun_otomatis', 'antre_limit'],
        if (fitur) 'antre': [for (var i = 0; i < antre; i++) {'tugas': 't-uji-000000000000000$i', 'proyek': 'simpeg', 'mode': 'rencana', 'sampai': _kini + _jam}],
        if (fitur)
          'pemakaian': {
            'hariIni': {'token': 1250000, 'biaya': 2.5, 'tugas': 4},
            'proyek': [{'proyek': 'simpeg', 'token': 3400000, 'biaya': 6.1, 'tugas': 11}],
            'akun': [{'akun': 'akun1', 'token': 3400000, 'biaya': 6.1, 'tugas': 11}],
          },
      },
    };

Map<String, Object?> _kabar(Tugas t, String tahap, int urut, [Map<String, Object?> isi = const {}]) => {
      'jenis': 'kabar',
      'kabar': {'perintah_id': t.perintahId, 'tugas': t.tugas, 'tahap': tahap, 'urut': urut, ...isi},
    };

Widget _app(Widget anak) => MaterialApp(theme: temaPadev(Brightness.light), home: anak);

void main() {
  test('tokenBaca', () {
    expect(tokenBaca(950), '950');
    expect(tokenBaca(12340), '12,3 rb');
    expect(tokenBaca(1000), '1 rb');
    expect(tokenBaca(1250000), '1,3 jt');
    expect(tokenBaca(245000000), '245 jt');
  });

  test('status: limit 5j/7h per akun, data lama, fitur, antrean, pemakaian', () {
    final s = _SumberUji()..kabarMasuk(_status(antre: 2));
    expect(s.limit!.length, 2); // akun3 tanpa persen dilewati
    final a1 = s.limit!.first, a2 = s.limit!.last;
    expect(a1.persen, 97);
    expect(a1.persen7h, 40.5);
    expect(a1.waktuReset5j!.millisecondsSinceEpoch, _kini + _jam);
    expect(a2.persen, isNull);
    expect(a2.persen7h, 20);
    expect(a2.lama, isTrue);
    expect(s.akunOtomatisDidukung, isTrue);
    expect(s.antreLimit, 2);
    expect(s.pemakaian!.hariIni.token, 1250000);
    expect(s.pemakaian!.proyek.single.nama, 'simpeg');
    expect(s.pemakaian!.akun.single.tugas, 11);
    s.kabarMasuk(_status(fitur: false));
    expect(s.akunOtomatisDidukung, isFalse);
    expect(s.pemakaian, isNull);
    expect(s.antreLimit, 0);
  });

  test('otomatis hanya dikirim bila Mac mendukung', () async {
    final s = _SumberUji()..kabarMasuk(_status(fitur: false));
    expect((await s.kirim(proyekId: 'simpeg', akun: 'akun1', mode: 'rencana', pesan: 'a', otomatis: true)).otomatis, isFalse);
    s.kabarMasuk(_status());
    expect((await s.kirim(proyekId: 'simpeg', akun: 'akun1', mode: 'rencana', pesan: 'b', otomatis: true)).otomatis, isTrue);
  });

  test('kabar antre → antre (jam coba-lagi diperbarui), mulai dengan akun lain, selesai + pemakaian, riwayat', () async {
    final s = _SumberUji()..kabarMasuk(_status());
    final t = await s.kirim(proyekId: 'simpeg', akun: 'akun1', mode: 'rencana', pesan: 'cek', otomatis: true);
    s.kabarMasuk({'jenis': 'tanda_terima', 'tanda_terima': {'perintah_id': t.perintahId, 'hasil': 'diterima'}});
    s.kabarMasuk(_kabar(t, 'antre', 0, {'sampai': _kini + _jam, 'alasan': 'menunggu limit akun pulih: akun1: 5 jam 97%, akun2: 7 hari 99%'}));
    expect(t.tahap, TahapTugas.antre);
    expect(t.aktif, isTrue);
    expect(t.antreSampai!.millisecondsSinceEpoch, _kini + _jam);
    s.kabarMasuk(_kabar(t, 'antre', 0, {'sampai': _kini + 2 * _jam, 'alasan': 'menunggu limit akun pulih: akun1: 5 jam 99%'}));
    expect(t.antreSampai!.millisecondsSinceEpoch, _kini + 2 * _jam); // kirim ulang urut 0 diterima selama masih antre
    // simpan & muat ulang riwayat saat antre
    final e = t.keEntri();
    expect(e['tahap'], 'antre');
    expect(e['otomatis'], true);
    final m = Tugas.dariEntri('simpeg', e)!;
    expect(m.tahap, TahapTugas.antre);
    expect(m.antreSampai, t.antreSampai);
    expect(m.otomatis, isTrue);
    s.kabarMasuk(_kabar(t, 'mulai', 1, {'mode': 'rencana', 'model': '', 'lanjut': false, 'akun': 'akun2'}));
    expect(t.tahap, TahapTugas.bekerja);
    expect(t.akunDipakai, 'akun2');
    expect(t.antreSampai, isNull);
    expect(t.alasan, isNull);
    s.kabarMasuk(_kabar(t, 'antre', 0, {'sampai': _kini}));
    expect(t.tahap, TahapTugas.bekerja); // antre lama setelah mulai diabaikan
    s.kabarMasuk(_kabar(t, 'selesai', 2, {
      'teks': 'beres', 'durasiMs': 1000, 'ditolak': [],
      'pemakaian': {'masuk': 100, 'keluar': 900, 'cacheBaca': 20000, 'cacheTulis': 3000, 'giliran': 4, 'biaya': 0.12},
    }));
    expect(t.pemakaian!.token, 24000);
    expect(t.pemakaian!.giliran, 4);
    final m2 = Tugas.dariEntri('simpeg', t.keEntri())!;
    expect(m2.akunDipakai, 'akun2');
    expect(m2.pemakaian!.token, 24000);
    expect(m2.pemakaian!.biaya, 0.12);
  });

  test('notif limit & antre → kabar', () {
    final s = _SumberUji();
    s.kabarMasuk({'jenis': 'notif', 'dibuat': _kini, 'notif': {'j': 'limit', 'akun': 'akun1', 'batas': '7h', 'ambang': 95, 'persen': 96, 'reset': _kini + 30 * _jam}});
    s.kabarMasuk({'jenis': 'notif', 'dibuat': _kini, 'notif': {'j': 'antre', 'proyekId': 'simpeg', 'proyek': 'SIMPEG', 'akun': 'akun2'}});
    expect(s.kabar.map((k) => k.jenis), [JenisKabar.antre, JenisKabar.limit]);
    final l = s.kabar.last;
    expect((l.akun, l.batas, l.n), ('akun1', '7h', 96));
    expect(l.reset!.millisecondsSinceEpoch, _kini + 30 * _jam);
  });

  testWidgets('kartu Mac: bar 5 jam & 7 hari per akun, antrean, laporan 7 hari', (t) async {
    final s = _SumberUji()..kabarMasuk(_status(antre: 1));
    await t.pumpWidget(_app(Scaffold(body: ListenableBuilder(listenable: s, builder: (_, _) => LayarBeranda(sumber: s, onBukaChat: (_) {})))));
    expect(find.text('Akun 1'), findsOneWidget);
    expect(find.text('5 jam'), findsOneWidget);
    expect(find.text('7 hari'), findsNWidgets(2));
    expect(find.text('97%'), findsOneWidget);
    expect(find.text('41%'), findsOneWidget);
    expect(find.text('data lama'), findsOneWidget);
    expect(find.textContaining('1 tugas dari HP ini menunggu limit'), findsOneWidget);
    expect(find.textContaining('4 tugas · 1,3 jt token'), findsOneWidget);
    await t.tap(find.text('Laporan 7 hari'));
    await t.pumpAndSettle();
    expect(find.text('Pemakaian token'), findsOneWidget);
    expect(find.text('SIMPEG'), findsNWidgets(2)); // kartu proyek + laporan (nama, bukan id)
    expect(find.text('3,4 jt token'), findsNWidgets(2));
  });

  testWidgets('chat: akun Otomatis (bawaan bila Mac mendukung), antre + Batalkan, akun pindah, pemakaian', (t) async {
    final s = _SumberUji()..kabarMasuk(_status());
    await t.pumpWidget(_app(ListenableBuilder(listenable: s, builder: (_, _) => LayarChat(sumber: s, proyekId: 'simpeg'))));
    expect(find.text('Otomatis'), findsOneWidget);
    await t.enterText(find.byType(TextField), 'cek limit');
    await t.pump(); // kolom ketik → tombol kirim aktif
    await t.tap(find.byIcon(Simbol.kirim));
    await t.pump();
    final tg = s.dikirim.single;
    expect((tg.akun, tg.otomatis), ('akun1', true));
    s.kabarMasuk(_kabar(tg, 'antre', 0, {'sampai': _kini + _jam, 'alasan': 'menunggu limit akun pulih: akun1: 5 jam 97%'}));
    await t.pump();
    expect(find.textContaining('Antre: limit akun hampir habis', findRichText: true), findsOneWidget);
    expect(find.textContaining('akun1: 5 jam 97%', findRichText: true), findsOneWidget);
    await t.tap(find.text('Batalkan'));
    await t.pump();
    expect(s.dihentikan, [tg.tugas]);
    s.kabarMasuk(_kabar(tg, 'mulai', 1, {'akun': 'akun2'}));
    s.kabarMasuk(_kabar(tg, 'selesai', 2, {'teks': 'ok', 'durasiMs': 5000, 'ditolak': [], 'pemakaian': {'masuk': 10, 'keluar': 20, 'cacheBaca': 12000, 'cacheTulis': 0, 'giliran': 3, 'biaya': 0.02}}));
    await t.pump();
    expect(find.textContaining('Akun dipindah otomatis: Akun 1 → Akun 2'), findsOneWidget);
    expect(find.textContaining('12 rb token · 3 giliran', findRichText: true), findsOneWidget);
    expect(find.textContaining('Akun 2 (otomatis)'), findsOneWidget);
    // pilih akun tertentu → bukan otomatis
    await t.tap(find.text('Otomatis'));
    await t.pumpAndSettle();
    await t.tap(find.text('Akun 1').last);
    await t.pumpAndSettle();
    expect(find.text('Otomatis'), findsNothing);
    await t.pumpWidget(const SizedBox());
  });

  testWidgets('chat: Mac lama (tanpa fitur) → tanpa pilihan Otomatis', (t) async {
    final s = _SumberUji()..kabarMasuk(_status(fitur: false));
    await t.pumpWidget(_app(ListenableBuilder(listenable: s, builder: (_, _) => LayarChat(sumber: s, proyekId: 'simpeg'))));
    expect(find.text('Otomatis'), findsNothing);
    expect(find.text('Akun 1'), findsOneWidget);
    await t.pumpWidget(const SizedBox());
  });
}
