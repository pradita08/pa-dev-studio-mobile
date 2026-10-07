// Uji pengurai isi kabar (kontrak §2) → model tampilan.
import 'package:flutter_test/flutter_test.dart';
import 'package:padev_studio/layar/data.dart';

class _SumberUji extends SumberData {
  void status(Map<String, Object?> isi) => terapkanStatus(isi);
  void kabarMasuk(Map<String, Object?> isi) => terapkanKabar(isi);
  Tugas tambah(Tugas t) => tambahTugas(t);

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

void main() {
  test('status tanpa field divisi/limit → disembunyikan (null), hp & sibuk terbaca', () {
    final s = _SumberUji()
      ..status({
        'jenis': 'status',
        'status': {
          'proyek': [
            {'id': 'a', 'nama': 'A', 'akun': ['akun1'], 'hp': 'rencana', 'sibuk': true, 'batasMenit': 10},
          ],
          'versi': '1',
        },
      });
    expect(s.proyek.single.divisi, isNull);
    expect(s.limit, isNull);
    expect(s.proyek.single.bolehKerjakan, isFalse);
    expect(s.proyek.single.status, StatusProyek.bekerja);
  });

  test('status dengan divisi menunggu_izin & limit', () {
    final s = _SumberUji()
      ..status({
        'status': {
          'proyek': [
            {
              'id': 'b', 'nama': 'B', 'akun': [], 'hp': 'kerjakan', 'sibuk': false,
              'divisi': [{'nama': 'Bima', 'peran': 'programmer', 'status': 'menunggu_izin'}],
            },
          ],
          'limit': [{'akun': 'akun2', 'persen5j': 62, 'reset5j': 'x'}],
        },
      });
    expect(s.proyek.single.status, StatusProyek.menungguIzin);
    expect(s.limit!.single.persen, 62);
    expect(namaAkun('akun2'), 'Akun 2');
  });

  test('F2: divisi dari Mac v2 [{peran, status, ke}] → nama dari pegawai-nama.json; angka lama → daftar kosong', () {
    NamaPegawai.atur({'div:programmer#1': 'Bima', 'div:programmer#2': 'Rizky'});
    final s = _SumberUji()
      ..status({
        'status': {
          'proyek': [
            {
              'id': 'a', 'nama': 'A', 'akun': [], 'hp': 'rencana', 'sibuk': true,
              'divisi': [
                {'peran': 'divisi-programmer', 'status': 'bekerja', 'ke': 1},
                {'peran': 'divisi-programmer', 'status': 'diam', 'ke': 2},
                {'peran': 'divisi-qa', 'status': 'bekerja', 'ke': 9},
                {'peran': 'general-purpose', 'status': 'bekerja'},
              ],
            },
            {'id': 'b', 'nama': 'B', 'akun': [], 'hp': 'rencana', 'sibuk': false, 'divisi': 2, 'utama': 'menunggu_izin'},
            {'id': 'c', 'nama': 'C', 'akun': [], 'hp': 'rencana', 'sibuk': false, 'utama': '<script>'},
          ],
        },
      });
    final d = s.proyek.first.divisi!;
    expect(d.map((x) => x.nama), ['Bima', 'Rizky', 'QA', 'General-purpose']);
    expect(d.map((x) => x.ke), [1, 2, 1, 1]);
    expect(d.first.peranTampil, 'programmer');
    expect(s.proyek[1].divisi, isEmpty);
    expect(s.proyek[1].utama, 'menunggu_izin');
    expect(s.proyek.last.utama, 'diam');
    expect(s.proyek.first.utama, 'diam');
    NamaPegawai.atur(const {});
  });

  test('kabar chat & tanda_terima memperbarui tugas; urut lama dibuang', () {
    final s = _SumberUji();
    final t = s.tambah(Tugas(tugas: 't1', proyek: 'a', akun: 'akun1', mode: 'rencana', pesan: 'halo', baru: false, dibuat: DateTime.now()))
      ..perintahId = 'p1'
      ..tahap = TahapTugas.menungguDiambil;
    s.kabarMasuk({'jenis': 'tanda_terima', 'tanda_terima': {'perintah_id': 'p1', 'hasil': 'diterima'}});
    expect(t.tahap, TahapTugas.diterima);
    s.kabarMasuk({'jenis': 'kabar', 'kabar': {'perintah_id': 'p1', 'tugas': 't1', 'tahap': 'teks', 'urut': 2, 'teks': 'ab'}});
    s.kabarMasuk({'jenis': 'kabar', 'kabar': {'perintah_id': 'p1', 'tugas': 't1', 'tahap': 'teks', 'urut': 1, 'teks': 'XX'}});
    expect(t.teks.toString(), 'ab');
    s.kabarMasuk({
      'jenis': 'kabar',
      'kabar': {'perintah_id': 'p1', 'tugas': 't1', 'tahap': 'selesai', 'urut': 3, 'teks': 'akhir', 'durasiMs': 1500, 'ditolak': [{'alat': 'Bash', 'ringkas': 'rm'}]},
    });
    expect(t.tahap, TahapTugas.selesai);
    expect(t.teks.toString(), 'akhir');
    expect(t.ditolak.single.alat, 'Bash');
    expect(t.aktif, isFalse);
  });

  group('SEC-87 tanda_terima ditolak + tugas_ulang (KONTRAK §9 K1)', () {
    Tugas tugasUlang(_SumberUji s, String? hasilTerakhir) {
      final t = s.tambah(Tugas(tugas: 't2', proyek: 'a', akun: 'akun1', mode: 'kerjakan', pesan: 'x', baru: false, dibuat: DateTime.now()))
        ..perintahId = 'p2'
        ..tahap = TahapTugas.menungguDiambil;
      s.kabarMasuk({
        'jenis': 'tanda_terima',
        'tanda_terima': {
          'perintah_id': 'p2',
          'hasil': 'ditolak',
          'alasan': 'tugas_ulang',
          'hasil_terakhir': ?hasilTerakhir,
        },
      });
      return t;
    }

    const peta = {
      'diterima': TahapTugas.diterima,
      'mulai': TahapTugas.bekerja,
      'selesai': TahapTugas.selesai,
      'gagal': TahapTugas.gagal,
      'dihentikan': TahapTugas.dihentikan,
      'batas_waktu': TahapTugas.batasWaktu,
      'ditolak': TahapTugas.ditolak,
    };
    for (final e in peta.entries) {
      test('hasil_terakhir ${e.key} → ${e.value.name}, tanpa pesan galat', () {
        final t = tugasUlang(_SumberUji(), e.key);
        expect(t.tahap, e.value);
        expect(t.alasan, isNull);
      });
    }

    test('tanpa hasil_terakhir → diterima (bukan ditolak/galat)', () {
      final t = tugasUlang(_SumberUji(), null);
      expect(t.tahap, TahapTugas.diterima);
      expect(t.alasan, isNull);
    });

    test('ditolak dengan alasan lain tetap ditolak + alasan', () {
      final s = _SumberUji();
      final t = s.tambah(Tugas(tugas: 't3', proyek: 'a', akun: 'akun1', mode: 'rencana', pesan: 'x', baru: false, dibuat: DateTime.now()))
        ..perintahId = 'p3'
        ..tahap = TahapTugas.menungguDiambil;
      s.kabarMasuk({'jenis': 'tanda_terima', 'tanda_terima': {'perintah_id': 'p3', 'hasil': 'ditolak', 'alasan': 'proyek_sibuk'}});
      expect(t.tahap, TahapTugas.ditolak);
      expect(t.alasan, 'proyek_sibuk');
    });

    test('"Coba lagi" memakai tugas yang sama', () async {
      final s = _SumberUji();
      final t = s.tambah(Tugas(tugas: 't4', proyek: 'a', akun: 'akun1', mode: 'rencana', pesan: 'x', baru: false, dibuat: DateTime.now()))
        ..tahap = TahapTugas.gagalKirim;
      await s.kirimUlang(t);
      expect(t.tugas, 't4');
      expect(t.tahap, TahapTugas.menungguDiambil);
      s.dispose();
    });
  });

  test('QA-8: idTugas cocok POLA_TUGAS pelaksana.js:53 dan unik (1000 id)', () {
    final pola = RegExp(r'^t-[a-z0-9]{1,12}-[0-9a-f]{16}$');
    final semua = <String>{};
    for (var i = 0; i < 1000; i++) {
      final id = SumberData.idTugas();
      expect(pola.hasMatch(id), isTrue, reason: id);
      semua.add(id);
    }
    expect(semua.length, 1000);
  });

  test('notif → butir kabar belum dibaca; jenis tak dikenal diabaikan', () {
    final s = _SumberUji()
      ..kabarMasuk({'jenis': 'notif', 'dibuat': 1759480000000, 'notif': {'j': 'selesai', 'proyek': 'A', 'durasiDtk': 30}})
      ..kabarMasuk({'jenis': 'notif', 'notif': {'j': 'aneh'}});
    expect(s.kabar.length, 1);
    expect(s.belumDibaca, 1);
  });
}
