// Uji roadmap 2 (review hasil Kerjakan) + pusat proyek: kabar `review`/`review_berkas` → model, aksi (pilihan dicek `boleh`,
// pesan commit), tanda terima ditolak → galat di kartu, kartu review (tombol & dialog commit), layar diff, dan halaman proyek
// yang menampilkan keputusan + review + Claude di Mac untuk proyek itu.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:padev_studio/kunci/kunci.dart';
import 'package:padev_studio/layar/chat.dart';
import 'package:padev_studio/layar/data.dart';
import 'package:padev_studio/layar/review.dart';
import 'package:padev_studio/tema/token.dart';

final _idR = 'c' * 32, _idK = 'a' * 32;
const _sesi = '0f8fad5b-d9cb-469f-a165-70867728950e';

class _SumberUji extends SumberData {
  _SumberUji() {
    memuatAwal = false;
    macTersambung = true;
    cerminTersedia = true;
  }
  final dikirim = <String>[];
  int _n = 0;
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
  Future<void> transportReviewDaftar() async => dikirim.add('daftar');
  @override
  Future<String?> transportReviewBerkas(Review r, String jalur) async {
    dikirim.add('berkas:$jalur');
    return 'pb${_n++}';
  }

  @override
  Future<String?> transportReviewAksi(Review r, String aksi, {String? pesan}) async {
    if (galat != null) throw galat!;
    dikirim.add('aksi:$aksi:${pesan ?? '-'}');
    return 'pa${_n++}';
  }
}

Map<String, Object?> _butir({String status = 'terbuka', List<String> boleh = const ['commit', 'buang'], bool isi = true, String? galat, int belumPush = 0}) => {
      'id': _idR,
      'proyek': 'simpeg',
      'status': status,
      'dibuat': DateTime.now().millisecondsSinceEpoch - 60000,
      'diperbarui': DateTime.now().millisecondsSinceEpoch,
      'tugas': ['t-uji-0000000000000001'],
      'cabang': 'main',
      'hulu': true,
      'belumPush': belumPush,
      'berkas': [
        {'jalur': 'app/Models/Pegawai.php', 'status': 'M', 'tambah': 12, 'kurang': 3, 'biner': false},
        {'jalur': 'app/Views/baru.php', 'status': 'A', 'tambah': 40, 'kurang': 0, 'biner': false},
        {'jalur': 'public/logo.png', 'status': 'M', 'tambah': 0, 'kurang': 0, 'biner': true},
      ],
      'lebih': 0,
      'tes': [
        {'perintah': 'php spark test', 'ok': true},
        {'perintah': 'npm test', 'ok': false},
      ],
      'isi': isi,
      'boleh': boleh,
      'commit': ?(status == 'dikomit' ? 'abc1234' : null),
      'galat': ?galat,
    };

Map<String, Object?> _kabar(int urut, List<Map<String, Object?>> daftar) =>
    {'jenis': 'review', 'urut_mac': urut, 'dibuat': DateTime.now().millisecondsSinceEpoch, 'review': {'daftar': daftar}};

Map<String, Object?> _status() => {
      'jenis': 'status',
      'status': {
        'proyek': [
          {'id': 'simpeg', 'nama': 'SIMPEG', 'akun': ['akun1'], 'hp': 'kerjakan', 'sibuk': false},
        ],
        'versi': '1',
      },
    };

Widget _app(Widget anak) => MaterialApp(theme: temaPadev(Brightness.light), home: anak);

void main() {
  group('model review', () {
    test('snapshot diurai; snapshot lama diabaikan; jumlah +/−', () {
      final s = _SumberUji();
      s.kabarMasuk(_kabar(5, [_butir()]));
      final r = s.reviewProyek('simpeg').single;
      expect(r.jumlahBerkas, 3);
      expect((r.tambah, r.kurang), (52, 3));
      expect(r.tes.map((t) => t.ok), [true, false]);
      expect(r.bisa('commit') && !r.bisa('push'), isTrue);
      s.kabarMasuk(_kabar(4, const []));
      expect(s.review.length, 1);
    });

    test('aksi: di luar boleh / pesan commit tidak sah ditolak; tanda terima ditolak → galat; snapshot baru melepas aksi', () async {
      final s = _SumberUji();
      s.kabarMasuk(_kabar(1, [_butir()]));
      var r = s.review.single;
      await expectLater(s.aksiReview(r, 'push'), throwsA(isA<GalatKunci>().having((e) => e.kode, 'kode', 'aksi_tidak_diizinkan')));
      await expectLater(s.aksiReview(r, 'commit', pesan: '  '), throwsA(isA<GalatKunci>().having((e) => e.kode, 'kode', 'pesan_tidak_sah')));
      await s.aksiReview(r, 'commit', pesan: ' Fitur ekspor ');
      expect(s.dikirim.last, 'aksi:commit:Fitur ekspor');
      expect(s.aksiBerjalan(r.id), 'commit');
      s.kabarMasuk({'jenis': 'tanda_terima', 'tanda_terima': {'perintah_id': 'pa0', 'hasil': 'ditolak', 'alasan': 'berkas_berubah_sejak_review'}});
      expect(s.aksiBerjalan(r.id), isNull);
      expect(s.galatAksiReview[r.id], 'berkas_berubah_sejak_review');
      await s.aksiReview(r, 'buang');
      expect(s.galatAksiReview[r.id], isNull);
      s.kabarMasuk(_kabar(2, [_butir(status: 'dibuang', boleh: const [])]));
      r = s.review.single;
      expect(s.aksiBerjalan(r.id), isNull);
      expect(r.status, 'dibuang');
    });

    test('diff: hanya bila isi; diminta sekali; kabar review_berkas mengisi', () async {
      final s = _SumberUji();
      s.kabarMasuk(_kabar(1, [_butir(isi: false)]));
      await expectLater(s.mintaDiff(s.review.single, 'a'), throwsA(isA<GalatKunci>().having((e) => e.kode, 'kode', 'isi_tidak_diizinkan')));
      s.kabarMasuk(_kabar(2, [_butir()]));
      final r = s.review.single;
      await s.mintaDiff(r, 'app/Models/Pegawai.php');
      await s.mintaDiff(r, 'app/Models/Pegawai.php');
      expect(s.dikirim.where((x) => x.startsWith('berkas:')).length, 1);
      expect(s.memuatDiff(r, 'app/Models/Pegawai.php'), isTrue);
      s.kabarMasuk({
        'jenis': 'review_berkas',
        'review_berkas': {'review': _idR, 'jalur': 'app/Models/Pegawai.php', 'teks': '@@ -1 +1 @@\n-lama\n+baru\n', 'terpotong': false, 'biner': false, 'disamarkan': true},
      });
      expect(s.diffBerkas(r, 'app/Models/Pegawai.php')!.teks, contains('+baru'));
      expect(s.memuatDiff(r, 'app/Models/Pegawai.php'), isFalse);
    });

    test('langganan review: otomatis sekali per sesi; dari layar proyek boleh dicoba lagi bila belum berhasil', () async {
      final s = _SumberUji();
      await s.langgananReview();
      await s.langgananReview();
      expect(s.dikirim.where((x) => x == 'daftar').length, 1);
      await s.langgananReview(olehOwner: true);
      expect(s.dikirim.where((x) => x == 'daftar').length, 1); // sudah berhasil
    });
  });

  group('kartu review', () {
    testWidgets('tombol sesuai boleh; Commit → dialog berisi usulan → kirim pesan', (t) async {
      final s = _SumberUji();
      s.kabarMasuk(_kabar(1, [_butir()]));
      await t.pumpWidget(_app(Scaffold(body: SingleChildScrollView(child: KartuReview(sumber: s, review: s.review.single, pesanBawaan: 'Perbaiki ekspor Excel pegawai')))));
      expect(find.text('Hasil Kerjakan · 3 berkas'), findsOneWidget);
      expect(find.text('Belum di-commit'), findsOneWidget);
      expect(find.text('Commit…'), findsOneWidget);
      expect(find.text('Buang…'), findsOneWidget);
      expect(find.textContaining('Push'), findsNothing);
      expect(find.text('php spark test'), findsOneWidget);
      expect(find.text('gagal'), findsOneWidget);
      await t.tap(find.text('Commit…'));
      await t.pumpAndSettle();
      expect(find.widgetWithText(TextField, 'Perbaiki ekspor Excel pegawai'), findsOneWidget);
      await t.tap(find.widgetWithText(FilledButton, 'Commit'));
      await t.pumpAndSettle();
      expect(s.dikirim.last, 'aksi:commit:Perbaiki ekspor Excel pegawai');
      await t.pumpWidget(_app(Scaffold(body: SingleChildScrollView(child: KartuReview(sumber: s, review: s.review.single)))));
      expect(find.text('Commit dikirim — menunggu Mac…'), findsOneWidget);
    });

    testWidgets('dikomit + belum push → hanya Push; galat Mac tampil', (t) async {
      final s = _SumberUji();
      s.kabarMasuk(_kabar(1, [_butir(status: 'dikomit', boleh: const ['push'], belumPush: 2, galat: 'push_gagal: rejected')]));
      await t.pumpWidget(_app(Scaffold(body: SingleChildScrollView(child: KartuReview(sumber: s, review: s.review.single)))));
      expect(find.text('Commit abc1234'), findsOneWidget);
      expect(find.text('Push 2 commit'), findsOneWidget);
      expect(find.text('Commit…'), findsNothing);
      expect(find.textContaining('Push gagal: rejected'), findsOneWidget);
    });

    testWidgets('layar review: ketuk berkas → minta diff → baris +/− tampil', (t) async {
      final s = _SumberUji();
      s.kabarMasuk(_kabar(1, [_butir()]));
      await t.pumpWidget(_app(LayarReview(sumber: s, reviewId: _idR)));
      await t.tap(find.text('app/Models/Pegawai.php'));
      await t.pump();
      expect(s.dikirim, contains('berkas:app/Models/Pegawai.php'));
      expect(find.text('Mengambil perubahan dari Mac…'), findsOneWidget);
      s.kabarMasuk({
        'jenis': 'review_berkas',
        'review_berkas': {'review': _idR, 'jalur': 'app/Models/Pegawai.php', 'teks': 'diff --git a b\n@@ -1 +1 @@\n-lama\n+baru', 'terpotong': true, 'biner': false, 'disamarkan': false},
      });
      await t.pump();
      expect(find.text('+baru'), findsOneWidget);
      expect(find.text('-lama'), findsOneWidget);
      expect(find.text('diff --git a b'), findsNothing);
      expect(find.textContaining('dipotong'), findsOneWidget);
    });
  });

  group('halaman proyek (pusat)', () {
    testWidgets('keputusan proyek bisa dijawab di sini + review + Claude di Mac', (t) async {
      final s = _SumberUji();
      s.kabarMasuk(_status());
      s.kabarMasuk(_kabar(1, [_butir()]));
      final kini = DateTime.now().millisecondsSinceEpoch;
      s.kabarMasuk({
        'jenis': 'keputusan',
        'urut_mac': 1,
        'dibuat': kini,
        'keputusan': {
          'daftar': [
            {'id': _idK, 'sesi': _sesi, 'proyek': 'simpeg', 'akun': 'akun1', 'jenis': 'izin', 'alat': 'Bash', 'ringkas': 'php spark migrate',
              'boleh': ['tolak', 'izinkan'], 'dibuat': kini - 1000, 'sampai': kini + 300000},
            {'id': 'b' * 32, 'sesi': _sesi, 'proyek': 'lain', 'akun': 'akun1', 'jenis': 'izin', 'alat': 'Bash', 'ringkas': 'proyek lain',
              'boleh': ['tolak'], 'dibuat': kini - 1000, 'sampai': kini + 300000},
          ],
          'selesai': [],
        },
      });
      s.daftarSesi = [
        SesiCermin(sesi: _sesi, akun: 'akun1', proyek: 'simpeg', judul: 'Standar pemanggilan AJAX', asal: 'vscode', status: StatusSesi.menungguIzin,
            terbuka: true, tingkat: 'ringkas', terakhir: DateTime.now()),
        SesiCermin(sesi: 'f' * 8 + _sesi.substring(8), akun: 'akun1', proyek: 'lain', judul: 'Sesi proyek lain', asal: 'vscode', status: StatusSesi.bekerja,
            terbuka: true, tingkat: 'ringkas', terakhir: DateTime.now()),
      ];
      await t.pumpWidget(_app(LayarChat(sumber: s, proyekId: 'simpeg')));
      await t.pump();
      expect(find.text('php spark migrate'), findsOneWidget);       // keputusan proyek ini
      expect(find.text('proyek lain'), findsNothing);               // keputusan proyek lain tidak
      expect(find.text('Izinkan sekali'), findsOneWidget);
      final daftar = find.descendant(of: find.byType(ListView), matching: find.byType(Scrollable)).first;
      await t.scrollUntilVisible(find.text('Hasil Kerjakan · 3 berkas'), 200, scrollable: daftar);
      expect(find.text('Hasil Kerjakan · 3 berkas'), findsOneWidget);
      await t.scrollUntilVisible(find.text('Standar pemanggilan AJAX'), 200, scrollable: daftar);
      expect(find.text('Standar pemanggilan AJAX'), findsOneWidget);
      expect(find.text('Sesi proyek lain'), findsNothing);
      expect(find.textContaining('setujui di laptop'), findsNothing);
      await t.pumpWidget(const SizedBox());
    });

    testWidgets('menunggu izin tanpa kartu → penjelasan cara mengirim pertanyaan ke HP', (t) async {
      final s = _SumberUji();
      s.kabarMasuk({
        'jenis': 'status',
        'status': {
          'proyek': [
            {'id': 'simpeg', 'nama': 'SIMPEG', 'akun': ['akun1'], 'hp': 'kerjakan', 'sibuk': false, 'divisi': [
              {'peran': 'programmer', 'status': 'menunggu_izin'},
            ]},
          ],
          'versi': '1',
        },
      });
      await t.pumpWidget(_app(LayarChat(sumber: s, proyekId: 'simpeg')));
      await t.pump();
      expect(find.textContaining('--keputusan izinkan 0'), findsOneWidget);
      await t.pumpWidget(const SizedBox());
    });
  });
}
