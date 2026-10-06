import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:padev_studio/kunci/kunci.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  const kanal = MethodChannel('pro.padeveloper.studio/kunci');

  final argumen = <String, Map<String, Object?>>{};
  var cerminMati = false;

  setUp(() {
    argumen.clear();
    cerminMati = false;
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(kanal, (c) async {
      switch (c.method) {
        case 'statusKeamanan':
          return {'kunciLayar': false, 'biometrikKuat': true, 'strongBox': true, 'fcmAktif': false, 'debug': true, 'versiApk': '0.1.0', 'android': 35};
        case 'kirimKerjakan':
          throw PlatformException(code: 'kerjakan_belum_diizinkan');
        case 'statusPasang':
          return null;
        case 'pindaiQr':
          return '{"v":1}';
        case 'jamMonoton':
          return 123456;
        case 'cerminDaftar' || 'cerminBuka' || 'cerminTutup' || 'cerminRiwayat':
          argumen[c.method] = (c.arguments as Map?)?.cast<String, Object?>() ?? const {};
          if (cerminMati) throw PlatformException(code: 'tidak_tersedia');
          return {'id': 'p-${c.method}', 'hash': '0' * 64};
        case 'riwayatLokal':
          return {
            'sesi': (c.arguments as Map)['sesi'],
            'diperbarui': 1760000000000,
            'entri': [
              {'id': 'e1', 'waktu': 1760000000000, 'peran': 'owner', 'teks': 'halo'},
            ],
          };
      }
      return null;
    });
  });

  test('statusKeamanan diurai', () async {
    final s = await Kunci.statusKeamanan();
    expect(s.kunciLayar, isFalse);
    expect(s.android, 35);
  });

  test('galat native menjadi GalatKunci berpesan Indonesia', () async {
    await expectLater(
      Kunci.kirimKerjakan(tugas: 't', proyek: 'p', akun: 'a', pesan: 'x'),
      throwsA(isA<GalatKunci>().having((e) => e.pesan, 'pesan', contains('nyalakan di laptop'))),
    );
  });

  test('belum terpasang → null', () async {
    expect(await Kunci.statusPasang(), isNull);
  });

  test('jamMonoton dari native', () async {
    expect(await Kunci.jamMonoton(), 123456);
  });

  test('pindaiQr: hasil hanya diteruskan bila gerbang terbuka (SEC-76)', () async {
    Kunci.gerbang.value = KeadaanGerbang.terbuka;
    expect(await Kunci.pindaiQr(), '{"v":1}');
    Kunci.gerbang.value = KeadaanGerbang.terkunci;
    expect(await Kunci.pindaiQr(), isNull);
  });

  test('pindaiQr: saat tirai, tunggu penilaian gerbang', () async {
    Kunci.gerbang.value = KeadaanGerbang.tirai;
    final f = Kunci.pindaiQr();
    await Future<void>.delayed(const Duration(milliseconds: 20));
    Kunci.gerbang.value = KeadaanGerbang.terbuka;
    expect(await f, '{"v":1}');
    Kunci.gerbang.value = KeadaanGerbang.tirai;
    final g = Kunci.pindaiQr();
    await Future<void>.delayed(const Duration(milliseconds: 20));
    Kunci.gerbang.value = KeadaanGerbang.terkunci;
    expect(await g, isNull);
  });

  group('fasad cermin (KONTRAK-apk-v2 §6.3)', () {
    test('cerminDaftar/Buka/Tutup/Riwayat meneruskan argumen persis', () async {
      final h = await Kunci.cerminDaftar(sejakJam: 48);
      expect(h.id, 'p-cerminDaftar');
      expect(argumen['cerminDaftar'], {'sejakJam': 48, 'sejakHari': null, 'cari': null, 'proyek': null});
      await Kunci.cerminBuka('3f1c2a9e-5b7d-4c11-9a2e-7d1f0b6c8e01', proyek: 'simpeg', akun: 'akun2');
      expect(argumen['cerminBuka'], {'sesi': '3f1c2a9e-5b7d-4c11-9a2e-7d1f0b6c8e01', 'proyek': 'simpeg', 'akun': 'akun2'});
      await Kunci.cerminTutup();
      expect(argumen.containsKey('cerminTutup'), isTrue);
      await Kunci.cerminRiwayat(sesi: 's', proyek: 'p', akun: 'a', sebelum: 'k1');
      expect(argumen['cerminRiwayat'], {'sesi': 's', 'proyek': 'p', 'akun': 'a', 'sebelum': 'k1', 'batas': 50});
    });

    test('non-rilis: tidak_tersedia menjadi GalatKunci', () async {
      cerminMati = true;
      await expectLater(Kunci.cerminDaftar(sejakJam: 48), throwsA(isA<GalatKunci>().having((e) => e.kode, 'kode', 'tidak_tersedia')));
    });

    test('riwayatLokal diurai', () async {
      final r = await Kunci.riwayatLokal('s1');
      expect(r!.sesi, 's1');
      expect(r.entri.single['teks'], 'halo');
      expect(r.diperbarui.millisecondsSinceEpoch, 1760000000000);
    });

    test('statusKeamanan.cerminNyata bawaan false', () async {
      expect((await Kunci.statusKeamanan()).cerminNyata, isFalse);
    });
  });
}
