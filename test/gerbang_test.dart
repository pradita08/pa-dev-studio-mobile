// Widget test alur gerbang (brief Laras): kunci → belum terpasang → L02; aktif → beranda; tanpa kunci layar → state L01.
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:padev_studio/kunci/kunci.dart';
import 'package:padev_studio/main.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  const kanal = MethodChannel('pro.padeveloper.studio/kunci');

  late bool kunciLayar;
  late int jam;
  late Map<String, Object?>? pasang;
  final panggilan = <String>[];

  setUp(() {
    kunciLayar = true;
    jam = 1000;
    pasang = null;
    panggilan.clear();
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(kanal, (c) async {
      panggilan.add(c.method);
      switch (c.method) {
        case 'statusKeamanan':
          return {'kunciLayar': kunciLayar, 'biometrikKuat': true, 'strongBox': true, 'fcmAktif': false, 'debug': true, 'versiApk': '0.1.0', 'android': 35};
        case 'bukaKunciAplikasi':
          return true;
        case 'statusPasang':
          return pasang;
        case 'halo':
          return {
            'macTersambung': true,
            'macTerakhir': DateTime.now().millisecondsSinceEpoch,
            'perangkat': 'aktif',
            'status': {
              'jenis': 'status',
              'urut_mac': 3,
              'status': {
                'versi': '0.9.0',
                'proyek': [
                  {'id': 'simpeg', 'nama': 'SIMPEG', 'akun': ['akun2'], 'hp': 'rencana', 'sibuk': false, 'batasMenit': 10},
                  // v2: proyek hp:false hanya nama untuk tab Sesi — tidak boleh tampil di Proyek
                  {'id': 'simukpbj', 'nama': 'SIMUK PBJ', 'hp': false, 'cermin': 'ringkas', 'dataPribadi': false, 'divisi': <Object>[]},
                ],
              },
            },
          };
        case 'ambilKabar':
          return <Object>[];
        case 'jumlahPesanTidakSah':
          return 0;
        case 'jamMonoton':
          return jam;
      }
      return null;
    });
  });

  Future<void> jalankan(WidgetTester t) async {
    await t.pumpWidget(const AplikasiPadev());
    for (var i = 0; i < 6; i++) {
      await t.pump(const Duration(milliseconds: 50));
    }
  }

  Future<void> bersihkan(WidgetTester t) async {
    await t.pumpWidget(const SizedBox());
    await t.pump();
  }

  testWidgets('belum terpasang → L02 Pasangkan', (t) async {
    await jalankan(t);
    expect(panggilan, contains('bukaKunciAplikasi'));
    expect(find.text('Pasangkan dengan Mac'), findsOneWidget);
    expect(find.text('Pindai kode QR'), findsOneWidget);
    // tidak ada tombol persetujuan di HP (persetujuan terjadi di Mac, DESAIN §3.3)
    expect(find.text('Cocok, lanjutkan'), findsNothing);
    await bersihkan(t);
  });

  testWidgets('aktif → beranda 5 tab dengan proyek dari status; hp:false disembunyikan; Sesi jujur di non-rilis', (t) async {
    pasang = {
      'status': 'aktif',
      'namaMac': 'MacBook Uji',
      'macId': '0123456789abcdef',
      'perangkatId': 'fedcba9876543210',
      'relay': 'https://padev-studio.pa-developer.pro/api/v1/',
      'idKRencana': 'a1b2c3d4',
      'idKKerjakan': 'e5f6a7b8',
      'kunciUtuh': true,
    };
    await jalankan(t);
    expect(find.text('Proyek'), findsWidgets);
    expect(find.text('SIMPEG'), findsOneWidget);
    expect(find.text('MacBook Uji'), findsOneWidget);
    for (final tab in ['Sesi', 'Kantor', 'Kabar', 'Pengaturan']) {
      expect(find.text(tab), findsWidgets);
    }
    // proyek hp:"rencana" → penanda Rencana saja; proyek hp:false tidak tampil (perintah pasti ditolak)
    expect(find.text('Rencana saja'), findsOneWidget);
    expect(find.text('SIMUK PBJ'), findsNothing);
    // K-07: debug → cerminNyata false → keadaan jujur, tidak ada perintah cermin* ke native
    await t.tap(find.text('Sesi').last);
    for (var i = 0; i < 4; i++) {
      await t.pump(const Duration(milliseconds: 50));
    }
    expect(find.text('Tab Sesi aktif di APK rilis'), findsOneWidget);
    expect(find.text('Lihat contoh tampilan'), findsOneWidget);
    expect(panggilan.where((m) => m.startsWith('cermin')), isEmpty);
    await bersihkan(t);
  });

  testWidgets('HP tanpa kunci layar → minta pasang kunci layar, aplikasi tetap terkunci', (t) async {
    kunciLayar = false;
    await jalankan(t);
    expect(find.text('Pasang kunci layar dulu'), findsOneWidget);
    expect(panggilan, isNot(contains('bukaKunciAplikasi')));
    expect(panggilan, isNot(contains('statusPasang')));
    await bersihkan(t);
  });

  testWidgets('dicabut → arahkan pasang ulang', (t) async {
    pasang = {'status': 'dicabut', 'namaMac': 'MacBook Uji', 'macId': 'x', 'perangkatId': 'y', 'relay': 'r'};
    await jalankan(t);
    expect(find.text('Perangkat ini sudah dicabut'), findsOneWidget);
    expect(find.text('Pasang ulang'), findsOneWidget);
    await bersihkan(t);
  });

  Future<void> keLatar(WidgetTester t) async {
    for (final s in [AppLifecycleState.inactive, AppLifecycleState.hidden, AppLifecycleState.paused]) {
      t.binding.handleAppLifecycleStateChanged(s);
      await t.pump();
    }
  }

  Future<void> kembali(WidgetTester t) async {
    for (final s in [AppLifecycleState.hidden, AppLifecycleState.inactive, AppLifecycleState.resumed]) {
      t.binding.handleAppLifecycleStateChanged(s);
      await t.pump();
    }
    for (var i = 0; i < 4; i++) {
      await t.pump(const Duration(milliseconds: 50));
    }
  }

  int jumlahBuka() => panggilan.where((m) => m == 'bukaKunciAplikasi').length;

  testWidgets('SEC-75: tirai menutup isi di latar; kembali < 2 mnt (jam monoton) → isi tampil tanpa buka kunci ulang', (t) async {
    await jalankan(t);
    expect(Kunci.gerbang.value, KeadaanGerbang.terbuka);
    await keLatar(t);
    expect(find.text('Pasangkan dengan Mac'), findsNothing);
    expect(Kunci.gerbang.value, KeadaanGerbang.tirai);
    jam += 60 * 1000;
    await kembali(t);
    expect(find.text('Pasangkan dengan Mac'), findsOneWidget);
    expect(Kunci.gerbang.value, KeadaanGerbang.terbuka);
    expect(jumlahBuka(), 1);
    await bersihkan(t);
  });

  testWidgets('REV-39: inactive → resumed (dialog sidik jari, tanpa ke latar) → tirai lepas tanpa mengunci', (t) async {
    await jalankan(t);
    expect(find.text('Pasangkan dengan Mac'), findsOneWidget);
    final jamSebelum = panggilan.where((m) => m == 'jamMonoton').length;
    t.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
    await t.pump();
    // tirai sejak inactive: isi tertutup, gerbang berstatus tirai (bukan terkunci)
    expect(find.text('Pasangkan dengan Mac'), findsNothing);
    expect(Kunci.gerbang.value, KeadaanGerbang.tirai);
    jam += 5 * 60 * 1000; // jam monoton tidak dinilai: aplikasi tidak pernah ke latar
    t.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    for (var i = 0; i < 4; i++) {
      await t.pump(const Duration(milliseconds: 50));
    }
    expect(find.text('Pasangkan dengan Mac'), findsOneWidget);
    expect(Kunci.gerbang.value, KeadaanGerbang.terbuka);
    expect(jumlahBuka(), 1);
    expect(panggilan.where((m) => m == 'jamMonoton').length, jamSebelum);
    await bersihkan(t);
  });

  testWidgets('SEC-75: jam monoton ≥ 2 mnt → terkunci lagi walau jam dinding tidak bergerak jauh', (t) async {
    await jalankan(t);
    await keLatar(t);
    jam += 3 * 60 * 1000;
    await kembali(t);
    expect(jumlahBuka(), 2);
    await bersihkan(t);
  });
}
