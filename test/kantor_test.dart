// G8 tab Kantor (390px): Segmen Agen | Rekap, kartu agen (urut menunggu izin → bekerja) + lembar detail, alur tahap tetap,
// keadaan Rekap: Mac lama (rekap null), memuat, kosong, data 7 hari / bulanan.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:padev_studio/komponen/komponen.dart';
import 'package:padev_studio/layar/data.dart';
import 'package:padev_studio/layar/kantor.dart';
import 'package:padev_studio/tema/token.dart';

class _SumberUji extends SumberData {
  _SumberUji() {
    memuatAwal = false;
    macTersambung = true;
  }
  void muat(Map<String, Object?> isi) {
    terapkanStatus(isi);
    beritahu();
  }

  void memuat() {
    memuatAwal = true;
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
}

final _t0 = DateTime.now().millisecondsSinceEpoch - 60000;
Map<String, Object?> _ev(int dt, String kind, {String? who, String? agentId, String? tool, String? sub, String? type, String? detail}) => {
      'ts': _t0 + dt * 1000,
      'kind': kind,
      'proyek': 'simpeg',
      'who': ?who,
      'agentId': ?agentId,
      'tool': ?tool,
      'sub': ?sub,
      'type': ?type,
      'detail': ?detail,
    };

String _tgl(DateTime w) => '${w.year}-${w.month.toString().padLeft(2, '0')}-${w.day.toString().padLeft(2, '0')}';

Map<String, Object?> _rekap({bool kosong = false, bool bulan = true}) {
  final kini = DateTime.now();
  final agen = ['kepala', 'divisi-programmer', 'divisi-ui'];
  return {
    'v': 1,
    'dibuat': kini.millisecondsSinceEpoch,
    'zona': '+07:00',
    'awal': _tgl(kini.subtract(const Duration(days: 30))),
    'agen': agen,
    'hari': [
      for (var i = 6; i >= 0; i--)
        {'tgl': _tgl(kini.subtract(Duration(days: i))), 't': kosong ? [0, 0, 0] : [1000 * (i + 1), 2000, 500000], 'n': kosong ? [0, 0, 0] : [1, 1, 2], 'c': [0, 0, 0]},
    ],
    'bulan': bulan
        ? [
            {'bln': '2026-10', 't': [100, 200, 300], 'n': [1, 2, 3], 'c': [1, 2, 3]},
            {'bln': '2026-11', 't': [200, 400, 600], 'n': [2, 2, 2], 'c': [2, 4, 6]},
          ]
        : [],
  };
}

_SumberUji _sumber({Map<String, Object?>? rekap, bool kantor = true}) => _SumberUji()
  ..muat({
    'jenis': 'status',
    'status': {
      'versi': '1',
      'proyek': [
        {'id': 'simpeg', 'nama': 'SIMPEG', 'akun': ['akun1'], 'hp': 'rencana', 'sibuk': false},
      ],
      if (kantor)
        'kantor': [
          _ev(0, 'prompt'),
          _ev(1, 'tool', tool: 'Agent', sub: 'divisi-programmer'),
          _ev(2, 'agent_start', who: 'divisi-programmer', agentId: 'p1'),
          _ev(3, 'tool', who: 'divisi-programmer', agentId: 'p1', tool: 'Edit', detail: 'app/Models/Pegawai.php'),
          _ev(4, 'tool', tool: 'Agent', sub: 'divisi-ui'),
          _ev(5, 'agent_start', who: 'divisi-ui', agentId: 'u1'),
          _ev(6, 'notify', who: 'divisi-ui', agentId: 'u1', type: 'permission_prompt'),
        ],
      'rekap': ?rekap,
    },
  });

Widget _app(SumberData s, {ValueChanged<String>? buka}) => MediaQuery(
      data: const MediaQueryData(size: Size(390, 844)),
      child: MaterialApp(
        theme: temaPadev(Brightness.light),
        home: Scaffold(body: ListenableBuilder(listenable: s, builder: (_, _) => LayarKantor(sumber: s, onBukaChat: buka ?? (_) {}))),
      ),
    );

void main() {
  setUp(() => NamaPegawai.atur(const {'div:programmer#1': 'Zaenal', 'div:ui#1': 'Dinda'}));

  testWidgets('Agen: kartu agen urut menunggu izin → bekerja, alur tahap tetap, detail + buka chat', (t) async {
    t.view.physicalSize = const Size(390, 844);
    t.view.devicePixelRatio = 1;
    addTearDown(t.view.reset);
    String? dibuka;
    await t.pumpWidget(_app(_sumber(rekap: _rekap()), buka: (p) => dibuka = p));
    expect(find.text('Agen'), findsOneWidget);
    expect(find.text('Rekap'), findsOneWidget);
    expect(find.text('3D'), findsNothing);
    expect(find.text('SEDANG BEKERJA · 2'), findsOneWidget);
    final kartu = t.widgetList<KartuAgen>(find.byType(KartuAgen)).toList();
    expect([for (final k in kartu) k.d.kunci], ['ui', 'programmer']);
    expect(find.textContaining('Mengubah berkas · app/Models/Pegawai.php'), findsOneWidget);
    expect(find.text('3,5 jt token 7 hari · divisi ini'), findsOneWidget);
    expect(find.textContaining('Alur kerja divisi'), findsOneWidget);
    await t.tap(find.byType(KartuAgen).last);
    await t.pump();
    await t.pump(const Duration(milliseconds: 600)); // _Denyut berulang: pumpAndSettle tak pernah tenang
    expect(find.text('SEDANG APA'), findsOneWidget);
    expect(find.text('Buka chat SIMPEG'), findsOneWidget);
    await t.ensureVisible(find.text('Buka chat SIMPEG'));
    await t.tap(find.text('Buka chat SIMPEG'));
    await t.pump();
    await t.pump(const Duration(milliseconds: 600)); // _Denyut berulang: pumpAndSettle tak pernah tenang
    expect(dibuka, 'simpeg');
    expect(t.takeException(), isNull);
  });

  testWidgets('Agen tanpa rekap: token "belum tersedia"', (t) async {
    await t.pumpWidget(_app(_sumber()));
    expect(find.text('Token 7 hari belum tersedia'), findsNWidgets(2));
  });

  testWidgets('Rekap: Mac lama, memuat, kosong, 7 hari & bulanan', (t) async {
    t.view.physicalSize = const Size(390, 844);
    t.view.devicePixelRatio = 1;
    addTearDown(t.view.reset);
    final lama = _sumber();
    await t.pumpWidget(_app(lama));
    await t.tap(find.text('Rekap'));
    await t.pump();
    expect(find.textContaining('Rekap butuh pelaksana terbaru di Mac'), findsOneWidget);

    lama.memuat();
    await t.pump();
    expect(find.byType(Kerangka), findsWidgets);

    final kosong = _sumber(rekap: _rekap(kosong: true, bulan: false));
    await t.pumpWidget(_app(kosong));
    await t.tap(find.text('Rekap'));
    await t.pump();
    expect(find.text('Belum ada pemakaian pada periode ini'), findsOneWidget);
    expect(find.textContaining('Bulanan tampil setelah'), findsOneWidget);

    await t.pumpWidget(_app(_sumber(rekap: _rekap())));
    await t.tap(find.text('Rekap'));
    await t.pump();
    expect(find.text('Token 7 hari'), findsOneWidget);
    expect(find.text('Agen aktif'), findsOneWidget);
    expect(find.text('3'), findsOneWidget); // 3 agen dengan token > 0
    expect(find.byType(GrafikBatang), findsOneWidget);
    expect(find.text('UI/UX'), findsOneWidget);
    expect(find.textContaining('vs bulan lalu'), findsNothing); // 7 hari tanpa selisih
    await t.tap(find.text('Bulanan'));
    await t.pump();
    expect(find.text('Token bulan ini'), findsOneWidget);
    expect(find.text('▲ 100% vs bulan lalu'), findsOneWidget);
    expect(t.takeException(), isNull);
  });
}
