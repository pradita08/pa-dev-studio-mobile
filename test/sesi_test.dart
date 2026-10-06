// Uji tab Sesi v2 F1 (KONTRAK-apk-v2 §2.2, §6.1–6.2): pengurai cermin_sesi/cermin/cermin_riwayat, celah urut, ringkas vs isi,
// hemat perintah, proyek hp:false, navigasi 5 tab (Kantor indeks 2), dan widget L11/L11b.
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:padev_studio/kunci/kunci.dart';
import 'package:padev_studio/layar/cangkang.dart';
import 'package:padev_studio/layar/data.dart';
import 'package:padev_studio/layar/sesi.dart';
import 'package:padev_studio/layar/sesi_detail.dart';
import 'package:padev_studio/tema/token.dart';

const _s1 = '3f1c2a9e-5b7d-4c11-9a2e-7d1f0b6c8e01';
const _s2 = '8a4e0c71-2d3b-4f5a-b6c7-1e9d8f0a2b02';

class _SumberUji extends SumberData {
  _SumberUji({bool cermin = true}) {
    cerminTersedia = cermin;
    memuatAwal = false;
    macTersambung = true;
  }
  final terkirim = <String>[];

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
  Future<void> transportCerminDaftar({int? sejakJam, int? sejakHari, String? cari, String? proyek}) async =>
      terkirim.add(sejakJam != null ? 'daftar:jam$sejakJam' : 'daftar:hari$sejakHari:${cari ?? ''}');
  @override
  Future<void> transportCerminBuka(String? sesi, {String? proyek, String? akun}) async => terkirim.add('buka:$sesi');
  @override
  Future<void> transportCerminTutup() async => terkirim.add('tutup');
  @override
  Future<void> transportCerminRiwayat({required String sesi, required String proyek, required String akun, String? sebelum, int batas = 50}) async =>
      terkirim.add('riwayat:$sesi:${sebelum ?? '-'}:$batas');
}

Map<String, Object?> _butir(String sesi, {String status = 'bekerja', String tingkat = 'isi', String judul = 'Perbaiki validasi NIP', int laluMnt = 1}) => {
      'sesi': sesi,
      'akun': 'akun2',
      'proyek': 'simpeg',
      'judul': judul,
      'asal': 'vscode',
      'status': status,
      'terbuka': true,
      'mulai': DateTime.now().subtract(const Duration(hours: 1)).millisecondsSinceEpoch,
      'terakhir': DateTime.now().subtract(Duration(minutes: laluMnt)).millisecondsSinceEpoch,
      'divisi': [
        {'peran': 'programmer', 'status': 'bekerja'},
        {'peran': 'programmer', 'status': 'bekerja'},
        {'peran': 'qa', 'status': 'selesai'},
      ],
      'alat': {'alat': 'Edit', 'ringkas': 'PegawaiModel.php'},
      'bisaLanjut': 'tidak',
      'keputusan_n': 0,
      'tingkat': tingkat,
    };

Map<String, Object?> _kabarSesi(List<Map<String, Object?>> sesi) => {'jenis': 'cermin_sesi', 'cermin_sesi': {'sesi': sesi, 'lagi': false}};

Map<String, Object?> _kabarRiwayat(String sesi, List<Map<String, Object?>> entri, {String? sebelum, bool lagi = false, String? galat}) => {
      'jenis': 'cermin_riwayat',
      'cermin_riwayat': {'sesi': sesi, 'entri': entri, 'sebelum': sebelum, 'lagi': lagi, 'versiParser': 1, 'galat': galat},
    };

Map<String, Object?> _kabarCermin(int urut, List<Map<String, Object?>> ev) => {'jenis': 'cermin', 'cermin': {'urut_cermin': urut, 'ev': ev}};

int _ms(int menitLalu) => DateTime.now().subtract(Duration(minutes: menitLalu)).millisecondsSinceEpoch;

Widget _app(Widget anak) => MaterialApp(theme: temaPadev(Brightness.light), home: anak);

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    NamaPegawai.atur({'div:programmer#1': 'Bima', 'div:programmer#2': 'Rizky', 'div:qa#1': 'Dewi'});
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(const MethodChannel('pro.padeveloper.studio/kunci'), (c) async => null);
  });

  group('pengurai cermin', () {
    test('cermin_sesi → daftar urut terbaru, status, tingkat, divisi bernama pegawai', () {
      final s = _SumberUji()
        ..kabarMasuk(_kabarSesi([
          _butir(_s2, status: 'menunggu_izin', tingkat: 'ringkas', laluMnt: 9),
          _butir(_s1),
        ]));
      expect(s.daftarSesiDiterima, isTrue);
      expect(s.daftarSesi.map((x) => x.sesi), [_s1, _s2]);
      expect(s.daftarSesi.first.status, StatusSesi.bekerja);
      expect(s.daftarSesi.first.isi, isTrue);
      expect(s.daftarSesi.last.status, StatusSesi.menungguIzin);
      expect(s.daftarSesi.last.isi, isFalse);
      expect(s.daftarSesi.first.divisi.map((d) => d.label), ['Bima (programmer)', 'Rizky (programmer)', 'Dewi (QA)']);
    });

    test('tanpa aset pegawai-nama → peran saja', () {
      NamaPegawai.atur(const {});
      expect(NamaPegawai.label('divisi-programmer'), 'programmer');
      expect(NamaPegawai.label('qa'), 'QA');
    });

    test('jawaban daftar dicocokkan dengan permintaan: cari → hasilCari, 48 jam → daftarSesi', () async {
      final s = _SumberUji();
      await s.cariSesiLama(hari: 30, cari: 'migrasi');
      expect(s.terkirim, ['daftar:hari30:migrasi']);
      expect(s.memuatCari, isTrue);
      s.kabarMasuk(_kabarSesi([_butir(_s2, judul: 'Migrasi tabel')]));
      expect(s.hasilCari!.single.judul, 'Migrasi tabel');
      expect(s.daftarSesiDiterima, isFalse);
      await s.mintaDaftarSesi();
      s.kabarMasuk(_kabarSesi([_butir(_s1)]));
      expect(s.daftarSesi.single.sesi, _s1);
      expect(s.memuatDaftarSesi, isFalse);
    });

    test('celah urut_cermin → penanda "ada bagian yang hilang"; urut lama/ganda dibuang', () async {
      final s = _SumberUji()..kabarMasuk(_kabarSesi([_butir(_s1)]));
      await s.ikutiSesi(s.daftarSesi.single);
      s.kabarMasuk(_kabarCermin(5, [
        {'sesi': _s1, 'ts': _ms(0), 'kind': 'tool', 'tool': 'Read', 'detail': 'a.php'},
      ]));
      s.kabarMasuk(_kabarCermin(6, [
        {'sesi': _s1, 'ts': _ms(0), 'kind': 'prompt', 'text': 'lanjut'},
      ]));
      expect(s.riwayatSesi(_s1).entri.where((e) => e.peran == PeranEntri.celah), isEmpty);
      s.kabarMasuk(_kabarCermin(6, [
        {'sesi': _s1, 'ts': _ms(0), 'kind': 'tool', 'tool': 'Bash', 'detail': 'ganda'},
      ]));
      expect(s.riwayatSesi(_s1).entri.length, 2, reason: 'urut ganda dibuang');
      s.kabarMasuk(_kabarCermin(9, [
        {'sesi': _s1, 'ts': _ms(0), 'kind': 'stop', 'text': 'selesai'},
      ]));
      final e = s.riwayatSesi(_s1).entri;
      expect(e.where((x) => x.peran == PeranEntri.celah).length, 1);
      expect(e.last.peran, PeranEntri.claude);
      expect(s.daftarSesi.single.status, StatusSesi.diam);
      s.kabarMasuk(_kabarCermin(7, [
        {'sesi': _s1, 'ts': _ms(0), 'kind': 'prompt', 'text': 'lama'},
      ]));
      expect(s.riwayatSesi(_s1).entri.length, e.length, reason: 'urut lebih kecil dibuang');
    });

    test('riwayat: halaman digabung per id, kursor maju hanya ke halaman lebih lama, galat Mac', () async {
      final s = _SumberUji()..kabarMasuk(_kabarSesi([_butir(_s1)]));
      final x = s.daftarSesi.single;
      await s.muatRiwayat(x);
      s.kabarMasuk(_kabarRiwayat(_s1, [
        {'id': 'b2', 'waktu': _ms(5), 'peran': 'claude', 'teks': 'jawab'},
        {'id': 'b1', 'waktu': _ms(6), 'peran': 'owner', 'teks': 'tanya'},
      ], sebelum: 'k1', lagi: true));
      final r = s.riwayatSesi(_s1);
      expect(r.entri.map((e) => e.id), ['b1', 'b2']);
      expect(r.lagi, isTrue);
      await s.muatRiwayat(x, lebihLama: true);
      expect(s.terkirim.last, 'riwayat:$_s1:k1:50');
      s.kabarMasuk(_kabarRiwayat(_s1, [
        {'id': 'a1', 'waktu': _ms(60), 'peran': 'sistem', 'teks': 'Sesi dibuka'},
      ]));
      expect(r.entri.first.id, 'a1');
      expect(r.lagi, isFalse);
      // halaman pertama diminta ulang → kursor lama tidak ditimpa
      await s.muatRiwayat(x);
      s.kabarMasuk(_kabarRiwayat(_s1, [
        {'id': 'b2', 'waktu': _ms(5), 'peran': 'claude', 'teks': 'jawab'},
      ], sebelum: 'k1', lagi: true));
      expect(r.lagi, isFalse);
      expect(r.entri.length, 3);
      s.kabarMasuk(_kabarRiwayat(_s2, const [], galat: 'format_tidak_dikenal'));
      expect(s.riwayatSesi(_s2).galat, 'format_tidak_dikenal');
    });

    test('status hp:false → disembunyikan dari proyek, nama tetap untuk tab Sesi', () {
      final s = _SumberUji()
        ..kabarMasuk({
          'jenis': 'status',
          'status': {
            'proyek': [
              {'id': 'simpeg', 'nama': 'SIMPEG', 'akun': ['akun2'], 'hp': 'rencana', 'sibuk': false},
              {'id': 'simukpbj', 'nama': 'SIMUK PBJ', 'hp': false, 'cermin': 'ringkas', 'dataPribadi': false, 'divisi': <Object>[]},
            ],
          },
        });
      expect(s.proyek.map((p) => p.id), ['simpeg']);
      expect(s.cariProyek('simukpbj'), isNull);
      expect(s.namaProyek('simukpbj'), 'SIMUK PBJ');
      expect(s.namaProyek('tak_dikenal'), 'tak_dikenal');
    });
  });

  group('hemat perintah (K-04)', () {
    test('tidak tersedia (non-rilis) → tidak ada perintah cermin', () async {
      final s = _SumberUji(cermin: false);
      await s.mintaDaftarSesi(otomatis: true);
      await expectLater(s.mintaDaftarSesi(), throwsA(isA<GalatKunci>().having((e) => e.kode, 'kode', 'tidak_tersedia')));
      await s.ikutiSesi(SesiCermin(sesi: _s1, akun: 'a', proyek: 'p', judul: '', asal: 'vscode', status: StatusSesi.bekerja, terbuka: true, tingkat: 'isi'));
      expect(s.terkirim, isEmpty);
    });

    test('daftar otomatis maks 1× per 2 mnt; manual tetap boleh', () async {
      final s = _SumberUji();
      await s.mintaDaftarSesi(otomatis: true);
      s.kabarMasuk(_kabarSesi([_butir(_s1)]));
      await s.mintaDaftarSesi(otomatis: true);
      expect(s.terkirim, ['daftar:jam48']);
      await s.mintaDaftarSesi();
      expect(s.terkirim, ['daftar:jam48', 'daftar:jam48']);
    });

    test('ikuti → buka; berhenti → tutup; sesi selesai & tertutup tidak dibuka; anggaran 30/jam', () async {
      final s = _SumberUji()
        ..kabarMasuk(_kabarSesi([
          _butir(_s1),
          {..._butir(_s2, status: 'selesai'), 'terbuka': false},
        ]));
      await s.ikutiSesi(s.cariSesi(_s1)!);
      expect(s.langsung(_s1), isTrue);
      await s.berhentiIkuti();
      expect(s.terkirim, ['buka:$_s1', 'tutup']);
      await s.ikutiSesi(s.cariSesi(_s2)!);
      await s.berhentiIkuti();
      expect(s.terkirim, ['buka:$_s1', 'tutup'], reason: 'sesi selesai: tanpa buka/tutup');
      while (s.sisaAnggaranCermin > 0) {
        await s.mintaDaftarSesi();
      }
      await expectLater(s.mintaDaftarSesi(), throwsA(isA<GalatKunci>().having((e) => e.kode, 'kode', 'batas_laju')));
      s.dispose();
    });
  });

  group('widget', () {
    testWidgets('navigasi 5 tab: Proyek · Sesi · Kantor · Kabar · Pengaturan, Kantor indeks 2', (t) async {
      final s = _SumberUji();
      await t.pumpWidget(_app(Cangkang(sumber: s, onLepas: () async {})));
      final label = ['Proyek', 'Sesi', 'Kantor', 'Kabar', 'Pengaturan'];
      final x = [for (final l in label) t.getCenter(find.text(l).last).dx];
      for (var i = 1; i < x.length; i++) {
        expect(x[i], greaterThan(x[i - 1]), reason: 'urutan ${label[i]}');
      }
      await t.tap(find.text('Kantor').last);
      await t.pump();
      expect(t.widget<IndexedStack>(find.byType(IndexedStack)).index, 2);
      await t.tap(find.text('Sesi').last);
      await t.pump();
      expect(t.widget<IndexedStack>(find.byType(IndexedStack)).index, 1);
      expect(s.terkirim, ['daftar:jam48'], reason: 'daftar diminta saat tab Sesi dibuka');
    });

    testWidgets('L11 daftar sesi dari kabar: judul, status, penanda ringkas/isi, nama divisi', (t) async {
      final s = _SumberUji()
        ..kabarMasuk(_kabarSesi([
          _butir(_s1),
          _butir(_s2, status: 'menunggu_izin', tingkat: 'ringkas', judul: 'Audit modul paket', laluMnt: 3),
        ]));
      await t.pumpWidget(_app(Scaffold(body: LayarSesi(sumber: s, aktif: false))));
      expect(find.text('Perbaiki validasi NIP'), findsOneWidget);
      expect(find.text('Audit modul paket'), findsOneWidget);
      expect(find.text('Menunggu izin'), findsOneWidget);
      expect(find.text('Ringkas'), findsOneWidget);
      expect(find.text('Isi'), findsOneWidget);
      expect(find.textContaining('Bima (programmer)'), findsNWidgets(2));
      expect(find.text('Cari sesi lama (≤30 hari)'), findsOneWidget);
    });

    testWidgets('L11 non-rilis: keadaan jujur + contoh tampilan', (t) async {
      final s = _SumberUji(cermin: false);
      await t.pumpWidget(_app(Scaffold(body: LayarSesi(sumber: s, aktif: true))));
      expect(find.text('Tab Sesi aktif di APK rilis'), findsOneWidget);
      expect(find.text('Lihat contoh tampilan'), findsOneWidget);
      expect(s.terkirim, isEmpty);
    });

    Future<_SumberUji> detail(WidgetTester t, String tingkat) async {
      final s = _SumberUji()..kabarMasuk(_kabarSesi([_butir(_s1, tingkat: tingkat)]));
      await t.pumpWidget(_app(LayarSesiDetail(sumber: s, sesi: s.daftarSesi.single)));
      await t.pump();
      final isi = tingkat == 'isi';
      s.kabarMasuk(_kabarRiwayat(_s1, [
        {'id': 'b1', 'waktu': _ms(6), 'peran': 'owner', if (isi) 'teks': 'Tolong cek validasi NIP'},
        {'id': 'b2', 'waktu': _ms(5), 'peran': 'claude', if (isi) 'teks': 'Saya periksa controller dulu.'},
        {'id': 'b3', 'waktu': _ms(4), 'peran': 'alat', 'alat': 'Read', 'ringkas': 'Pegawai.php'},
      ]));
      await t.pump();
      return s;
    }

    testWidgets('L11b ringkas: tanpa isi + keterangan proyek dicentang', (t) async {
      final s = await detail(t, 'ringkas');
      expect(find.text('Isi percakapan hanya untuk proyek yang dicentang di laptop'), findsOneWidget);
      expect(find.textContaining('Pesan Anda'), findsOneWidget);
      expect(find.textContaining('Jawaban Claude'), findsOneWidget);
      expect(find.text('Tolong cek validasi NIP'), findsNothing);
      expect(s.terkirim, ['riwayat:$_s1:-:50', 'buka:$_s1']);
      await t.pumpWidget(const SizedBox());
      expect(s.terkirim.last, 'tutup', reason: 'keluar dari detail → cermin_tutup');
    });

    testWidgets('L11b isi: teks pesan & jawaban tampil; celah urut ditandai; latar → tutup', (t) async {
      final s = await detail(t, 'isi');
      expect(find.text('Isi percakapan hanya untuk proyek yang dicentang di laptop'), findsNothing);
      expect(find.text('Tolong cek validasi NIP'), findsOneWidget);
      expect(find.text('Saya periksa controller dulu.'), findsOneWidget);
      expect(find.textContaining('Langsung'), findsOneWidget);
      s.kabarMasuk(_kabarCermin(1, [
        {'sesi': _s1, 'ts': _ms(0), 'kind': 'tool', 'tool': 'Bash', 'detail': 'php spark test'},
      ]));
      s.kabarMasuk(_kabarCermin(3, [
        {'sesi': _s1, 'ts': _ms(0), 'kind': 'stop', 'text': 'Tes lulus.'},
      ]));
      await t.pump();
      expect(find.text('Ada bagian yang hilang'), findsOneWidget);
      expect(find.text('Tes lulus.'), findsOneWidget);
      t.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
      t.binding.handleAppLifecycleStateChanged(AppLifecycleState.hidden);
      t.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
      await t.pump();
      expect(s.terkirim.last, 'tutup');
      expect(s.langsung(_s1), isFalse);
      t.binding.handleAppLifecycleStateChanged(AppLifecycleState.hidden);
      t.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
      t.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await t.pump();
      expect(s.terkirim.last, 'buka:$_s1');
      await t.pumpWidget(const SizedBox());
      s.dispose();
    });

    testWidgets('L11b galat riwayat dari Mac', (t) async {
      final s = _SumberUji()..kabarMasuk(_kabarSesi([_butir(_s1)]));
      await t.pumpWidget(_app(LayarSesiDetail(sumber: s, sesi: s.daftarSesi.single)));
      s.kabarMasuk(_kabarRiwayat(_s1, const [], galat: 'sesi_bukan_milik_proyek'));
      await t.pump();
      expect(find.text('Riwayat tidak bisa dimuat'), findsOneWidget);
      expect(find.text(pesanCermin('sesi_bukan_milik_proyek', riwayat: true)), findsOneWidget);
      await t.pumpWidget(const SizedBox());
      s.dispose();
    });
  });
}
