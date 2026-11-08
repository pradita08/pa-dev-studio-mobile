// Uji F1b: kabar `keputusan` → model, jawab (pilihan dicek `boleh`), dan kartu keputusan (tombol & jawaban pertanyaan).
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:padev_studio/kunci/kunci.dart';
import 'package:padev_studio/layar/data.dart';
import 'package:padev_studio/layar/keputusan.dart';
import 'package:padev_studio/tema/token.dart';

const _sesi = '0f8fad5b-d9cb-469f-a165-70867728950e';
final _idA = 'a' * 32, _idB = 'b' * 32;

class _SumberUji extends SumberData {
  _SumberUji() {
    memuatAwal = false;
    macTersambung = true;
  }
  final dikirim = <String>[];
  GalatKunci? galat;

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
  Future<void> transportJawabKeputusan(Keputusan k, String pilih, {List<List<String>>? jawaban, String? pesan}) async {
    if (galat != null) throw galat!;
    dikirim.add('${k.id.substring(0, 4)}:$pilih:${jawaban ?? '-'}:${pesan ?? '-'}');
  }
}

Map<String, Object?> _butir(String id, {String jenis = 'izin', List<String> boleh = const ['tolak', 'izinkan', 'izinkan_selalu'], int sisaDtk = 300}) {
  final kini = DateTime.now().millisecondsSinceEpoch;
  return {
    'id': id,
    'sesi': _sesi,
    'proyek': 'simpeg',
    'akun': 'akun2',
    'jenis': jenis,
    'alat': jenis == 'tanya' ? 'AskUserQuestion' : jenis == 'rencana' ? 'ExitPlanMode' : 'Bash',
    'ringkas': jenis == 'tanya' ? '' : 'git push origin main',
    'boleh': boleh,
    'dibuat': kini - 5000,
    'sampai': kini + sisaDtk * 1000,
    if (jenis == 'tanya')
      'pertanyaan': [
        {
          'teks': 'Pakai database mana?',
          'judul': 'DB',
          'banyak': false,
          'pilihan': [
            {'label': 'MySQL', 'ket': 'yang lama'},
            {'label': 'Postgres', 'ket': ''},
          ],
        },
        {
          'teks': 'Fitur apa saja?',
          'judul': 'Fitur',
          'banyak': true,
          'pilihan': [
            {'label': 'Login', 'ket': ''},
            {'label': 'Ekspor', 'ket': ''},
          ],
        },
      ],
  };
}

Map<String, Object?> _kabar(int urut, List<Map<String, Object?>> daftar, [List<Map<String, Object?>> selesai = const []]) => {
      'jenis': 'keputusan',
      'urut_mac': urut,
      'dibuat': DateTime.now().millisecondsSinceEpoch,
      'keputusan': {'daftar': daftar, 'selesai': selesai},
    };

Widget _app(Widget anak) => MaterialApp(theme: temaPadev(Brightness.light), home: anak);

void main() {
  group('model keputusan', () {
    test('snapshot diurai; snapshot lama diabaikan; selesai dicatat', () {
      final s = _SumberUji();
      s.kabarMasuk(_kabar(10, [_butir(_idA), _butir(_idB, jenis: 'tanya', boleh: ['tolak', 'jawab'])]));
      expect(s.keputusan.length, 2);
      final t = s.keputusan.firstWhere((k) => k.jenis == 'tanya');
      expect(t.pertanyaan.length, 2);
      expect(t.pertanyaan[0].pilihan.first, ('MySQL', 'yang lama'));
      expect(t.pertanyaan[1].banyak, isTrue);
      expect(s.keputusanMenunggu.length, 2);
      s.kabarMasuk(_kabar(9, const [])); // lebih lama → diabaikan
      expect(s.keputusan.length, 2);
      s.kabarMasuk(_kabar(11, [_butir(_idB, jenis: 'tanya', boleh: ['tolak', 'jawab'])], [
        {'id': _idA, 'alasan': 'dijawab_mac'},
      ]));
      expect(s.keputusan.map((k) => k.id), [_idB]);
      expect(s.keputusanSelesai[_idA], 'dijawab_mac');
    });

    test('kedaluwarsa tidak dihitung menunggu', () {
      final s = _SumberUji();
      s.kabarMasuk(_kabar(1, [_butir(_idA, sisaDtk: -1)]));
      expect(s.keputusan.length, 1);
      expect(s.keputusanMenunggu, isEmpty);
    });

    test('jawab: pilihan di luar boleh ditolak; terkirim keluar dari menunggu; galat keputusan_tidak_ada → dibuang', () async {
      final s = _SumberUji();
      s.kabarMasuk(_kabar(1, [_butir(_idA, boleh: ['tolak'])]));
      final k = s.keputusan.single;
      await expectLater(s.jawabKeputusan(k, 'izinkan'), throwsA(isA<GalatKunci>().having((e) => e.kode, 'kode', 'pilihan_tidak_diizinkan')));
      await s.jawabKeputusan(k, 'tolak', pesan: 'jangan');
      expect(s.dikirim, ['aaaa:tolak:-:jangan']);
      expect(k.terkirim, isTrue);
      expect(s.keputusanMenunggu, isEmpty);
      // terkirim bertahan saat snapshot berikutnya masih memuat butir yang sama
      s.kabarMasuk(_kabar(2, [_butir(_idA, boleh: ['tolak'])]));
      expect(s.keputusan.single.terkirim, isTrue);
      s.kabarMasuk(_kabar(3, [_butir(_idB)]));
      s.galat = const GalatKunci('keputusan_tidak_ada');
      await expectLater(s.jawabKeputusan(s.keputusan.single, 'tolak'), throwsA(isA<GalatKunci>()));
      expect(s.keputusan, isEmpty);
    });
  });

  group('kartu keputusan', () {
    testWidgets('izin: tombol sesuai boleh; Izinkan sekali mengirim izinkan', (t) async {
      final s = _SumberUji();
      s.kabarMasuk(_kabar(1, [_butir(_idA)]));
      await t.pumpWidget(_app(LayarKeputusan(sumber: s)));
      await t.pump();
      expect(find.text('git push origin main'), findsOneWidget);
      expect(find.text('Tolak'), findsOneWidget);
      expect(find.text('Izinkan sekali'), findsOneWidget);
      expect(find.text('Izinkan selalu'), findsOneWidget);
      expect(find.text('Kirim jawaban'), findsNothing);
      await t.tap(find.text('Izinkan sekali'));
      await t.pump();
      expect(s.dikirim, ['aaaa:izinkan:-:-']);
      expect(find.text('Terkirim — menunggu Mac…'), findsOneWidget);
      await t.pumpWidget(const SizedBox());
    });

    testWidgets('tanya: Kirim jawaban aktif setelah semua soal dijawab; jawaban per soal', (t) async {
      final s = _SumberUji();
      s.kabarMasuk(_kabar(1, [_butir(_idB, jenis: 'tanya', boleh: ['tolak', 'jawab'])]));
      await t.pumpWidget(_app(LayarKeputusan(sumber: s)));
      await t.pump();
      FilledButton tombol() => t.widget<FilledButton>(find.ancestor(of: find.text('Kirim jawaban'), matching: find.byType(FilledButton)));
      expect(tombol().onPressed, isNull);
      await t.tap(find.text('Postgres'));
      await t.pump();
      expect(tombol().onPressed, isNull); // soal kedua belum
      await t.tap(find.text('Login'));
      await t.tap(find.text('Ekspor'));
      await t.pump();
      expect(tombol().onPressed, isNotNull);
      await t.ensureVisible(find.text('Kirim jawaban'));
      await t.pump();
      await t.tap(find.text('Kirim jawaban'));
      await t.pump();
      expect(s.dikirim, ['bbbb:jawab:[[Postgres], [Login, Ekspor]]:-']);
      await t.pumpWidget(const SizedBox());
    });

    testWidgets('pita muncul hanya bila ada yang menunggu', (t) async {
      final s = _SumberUji();
      await t.pumpWidget(_app(Scaffold(body: PitaKeputusan(sumber: s))));
      expect(find.textContaining('keputusan'), findsNothing);
      s.kabarMasuk(_kabar(1, [_butir(_idA), _butir(_idB)]));
      await t.pumpWidget(_app(Scaffold(body: PitaKeputusan(sumber: s))));
      expect(find.text('Claude butuh 2 keputusan'), findsOneWidget);
    });
  });

  group('G5 kartu izin giliran HP (kontrak §10.4)', () {
    Map<String, Object?> hp(String id, {String sebab = 'internet', List<String> boleh = const ['tolak', 'izinkan']}) =>
        _butir(id, boleh: boleh)..addAll({'giliran_hp': true, 'sebab': sebab});

    test('giliran_hp/sebab diurai; izinkan_selalu tidak pernah dianggap boleh; kartu biasa tidak berubah', () {
      final s = _SumberUji();
      s.kabarMasuk(_kabar(1, [hp(_idA, boleh: ['tolak', 'izinkan', 'izinkan_selalu']), _butir(_idB)]));
      final a = s.keputusan.firstWhere((k) => k.id == _idA), b = s.keputusan.firstWhere((k) => k.id == _idB);
      expect((a.giliranHp, a.sebab, a.bisa('izinkan_selalu'), a.bisa('izinkan')), (true, 'internet', false, true));
      expect((b.giliranHp, b.sebab, b.bisa('izinkan_selalu')), (false, null, true));
    });

    test('8 sebab → teks sehari-hari persis kontrak; kode tak dikenal apa adanya', () {
      const peta = {
        'internet': 'Perintah ke internet',
        'rahasia': 'Menyentuh berkas yang mungkin rahasia',
        'pembungkus': 'Perintah yang tidak bisa diperiksa otomatis',
        'karakter': 'Perintah memuat karakter tersembunyi',
        'skrip_baru': 'Menjalankan skrip yang baru diubah',
        'mcp': 'Alat layanan luar (MCP)',
        'di_luar_proyek': 'Berkas di luar folder proyek',
        'izin': 'Claude Code meminta izin',
      };
      peta.forEach((k, v) => expect(teksSebab(k), v));
      expect(teksSebab('aneh'), 'aneh');
    });

    testWidgets('pita "Dari pesan HP Anda" + sebab, hanya Tolak / Izinkan, hitung mundur; Izinkan mengirim izinkan', (t) async {
      t.view.physicalSize = const Size(390 * 3, 844 * 3); // 390px: tanpa overflow
      t.view.devicePixelRatio = 3;
      addTearDown(t.view.reset);
      final s = _SumberUji();
      s.kabarMasuk(_kabar(1, [hp(_idA, sebab: 'skrip_baru', boleh: ['tolak', 'izinkan', 'izinkan_selalu'])]));
      await t.pumpWidget(_app(LayarKeputusan(sumber: s)));
      await t.pump();
      expect(find.text('Dari pesan HP Anda'), findsOneWidget);
      expect(find.text('Menjalankan skrip yang baru diubah'), findsOneWidget);
      expect(find.text('git push origin main'), findsOneWidget, reason: 'ringkas utuh');
      expect(find.text('Tolak'), findsOneWidget);
      expect(find.text('Izinkan'), findsOneWidget);
      expect(find.text('Izinkan sekali'), findsNothing);
      expect(find.text('Izinkan selalu'), findsNothing);
      expect(find.byWidgetPredicate((x) => x is Text && RegExp(r'^[3-5]:\d\d$').hasMatch(x.data ?? '')), findsOneWidget, reason: 'hitung mundur dari sampai');
      t.view.reset(); // baris "Terkirim…" selebar font uji (Ahem) bisa meluap di 390px; bukan galat tampilan nyata
      await t.pump();
      await t.tap(find.text('Izinkan'));
      await t.pump();
      expect(s.dikirim, ['aaaa:izinkan:-:-']);
      await t.pumpWidget(const SizedBox());
    });

    testWidgets('kartu izin biasa tidak punya pita', (t) async {
      final s = _SumberUji();
      s.kabarMasuk(_kabar(1, [_butir(_idA)]));
      await t.pumpWidget(_app(LayarKeputusan(sumber: s)));
      await t.pump();
      expect(find.text('Dari pesan HP Anda'), findsNothing);
      await t.pumpWidget(const SizedBox());
    });
  });

  // G7 §10.12: status Mac `bebas` → "Izinkan selalu" tampil lagi pada kartu izin biasa (mode sesi kerjakanPin menyembunyikannya).
  group('mode bebas', () {
    const kanal = MethodChannel('pro.padeveloper.studio/kunci');
    void pasang({required bool bebas}) =>
        TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(kanal, (c) async {
          if (c.method != 'statusPasang') return null;
          return {
            'status': 'aktif', 'namaMac': 'Mac', 'macId': '0' * 16, 'perangkatId': '1' * 16, 'relay': 'https://r/',
            'kerjakanPin': true, 'bebas': bebas, 'macBebas': bebas,
          };
        });
    tearDown(() => TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(kanal, null));

    test('perintah baca ditolak kerjakan_perlu_pasang_ulang (bebas dimatikan) → ajakan pasang ulang di tab Sesi', () {
      final s = _SumberUji();
      s.kabarMasuk({
        'jenis': 'tanda_terima',
        'tanda_terima': {'perintah_id': 'c' * 32, 'hasil': 'ditolak', 'alasan': 'kerjakan_perlu_pasang_ulang'},
      });
      expect(s.galatDaftar, 'kerjakan_perlu_pasang_ulang');
      expect(pesanCermin(s.galatDaftar!), contains('Pasang ulang HP'));
    });

    test('status bebas → macBebas (teks PIN sekali per sesi di lembar Kerjakan)', () {
      final s = _SumberUji();
      Map<String, Object?> st(bool bebas) => {
            'jenis': 'status',
            'status': {'proyek': [], 'versi': '1', if (bebas) 'bebas': true},
          };
      s.kabarMasuk(st(true));
      expect(s.macBebas, isTrue);
      s.kabarMasuk(st(false));
      expect(s.macBebas, isFalse);
    });

    for (final bebas in [false, true]) {
      testWidgets('kerjakanPin${bebas ? ' + bebas' : ''}: Izinkan selalu ${bebas ? 'tampil' : 'tersembunyi'}', (t) async {
        pasang(bebas: bebas);
        final s = _SumberUji();
        s.kabarMasuk(_kabar(1, [_butir(_idA)]));
        await t.pumpWidget(_app(LayarKeputusan(sumber: s)));
        await t.pump();
        await t.pump();
        expect(find.text('Izinkan selalu'), bebas ? findsOneWidget : findsNothing);
        expect(find.text('Izinkan sekali'), findsOneWidget);
        await t.pumpWidget(const SizedBox());
      });
    }
  });
}
