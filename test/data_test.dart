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

/// Sumber uji dengan "cache" di memori (meniru Kunci.simpanChat/muatChat).
class _SumberSimpan extends _SumberUji {
  _SumberSimpan(this.gudang);
  final Map<String, List<Map<String, Object?>>> gudang;

  @override
  Future<void> transportSimpanChat(String proyek, List<Map<String, Object?>> entri) async => gudang[proyek] = entri;
  @override
  Future<List<Map<String, Object?>>?> transportMuatChat(String proyek) async => gudang[proyek];
}

void main() {
  test('riwayat chat tersimpan & tampil lagi setelah aplikasi dibuka ulang (kosong hanya bila memang belum ada)', () async {
    final gudang = <String, List<Map<String, Object?>>>{};
    final status = {
      'status': {
        'proyek': [
          {'id': 'simpeg', 'nama': 'SIMPEG', 'akun': ['akun1'], 'hp': 'kerjakan', 'sibuk': false},
          {'id': 'etpp', 'nama': 'ETPP', 'akun': ['akun1'], 'hp': 'rencana', 'sibuk': false},
        ],
      },
    };
    final a = _SumberSimpan(gudang)..status(status);
    await Future<void>.delayed(Duration.zero);
    final t = await a.kirim(proyekId: 'simpeg', akun: 'akun1', mode: 'rencana', pesan: 'cek modul cuti');
    a.kabarMasuk({'jenis': 'tanda_terima', 'tanda_terima': {'perintah_id': 'p1', 'hasil': 'diterima'}});
    a.kabarMasuk({
      'jenis': 'kabar',
      'kabar': {'perintah_id': 'p1', 'tugas': t.tugas, 'tahap': 'selesai', 'urut': 1, 'teks': 'Modul cuti aman.', 'durasiMs': 900,
        'ditolak': [{'alat': 'Bash', 'ringkas': 'rm'}]},
    });
    await a.simpanChatSekarang();
    expect(gudang['simpeg']!.single['teks'], 'Modul cuti aman.');
    a.dispose();

    final b = _SumberSimpan(gudang)..status(status);
    await Future<void>.delayed(Duration.zero);
    final lama = b.chat('simpeg').single;
    expect(lama.tugas, t.tugas);
    expect(lama.pesan, 'cek modul cuti');
    expect(lama.tahap, TahapTugas.selesai);
    expect(lama.teks.toString(), 'Modul cuti aman.');
    expect(lama.durasi, const Duration(milliseconds: 900));
    expect(lama.ditolak.single.alat, 'Bash');
    expect(b.chat('etpp'), isEmpty);
    b.dispose();
  });

  test('F2b status.kantor → kejadian bersih untuk kantor 3D (field asing/isi dibuang); tanpa field → null', () {
    final s = _SumberUji()
      ..status({
        'status': {
          'proyek': [],
          'kantor': [
            {'ts': 1, 'kind': 'tool', 'tool': 'Edit', 'who': 'divisi-programmer', 'agentId': 'ag1', 'session': 'abc', 'detail': '/Users/x/rahasia.php', 'text': 'isi'},
            {'ts': 2, 'kind': 'notify', 'type': 'permission_prompt'},
            {'ts': 3, 'kind': 'hapus_semua'},
            {'kind': 'prompt'},
            'bukan peta',
          ],
        },
      });
    expect(s.kantor, [
      {'ts': 1, 'kind': 'tool', 'session': 'abc', 'who': 'divisi-programmer', 'agentId': 'ag1', 'tool': 'Edit'},
      {'ts': 2, 'kind': 'notify', 'type': 'permission_prompt'},
    ]);
    s.status({'status': {'proyek': []}});
    expect(s.kantor, isNull);
  });

  test('status.perangkat → HP terhubung (n/maks, HP ini); tanpa field → null', () {
    final s = _SumberUji()
      ..status({
        'status': {
          'proyek': [],
          'maksPerangkat': 2,
          'perangkat': [
            {'nama': 'POCO F7', 'mode': 'rencana+kerjakan', 'dipasang': 1791000000000, 'ini': true},
            {'nama': 'Tab', 'mode': 'rencana', 'dipasang': 1791000001000},
          ],
          'kantor': [{'ts': 5, 'kind': 'prompt', 'proyek': 'simpeg'}],
        },
      });
    expect(s.perangkatTerhubung!.length, 2);
    expect(s.perangkatTerhubung!.first.ini, isTrue);
    expect(s.perangkatTerhubung!.first.kerjakan, isTrue);
    expect(s.perangkatTerhubung!.last.kerjakan, isFalse);
    expect(s.maksPerangkat, 2);
    expect(s.kantor!.single['proyek'], 'simpeg');
    s.status({'status': {'proyek': []}});
    expect(s.perangkatTerhubung, isNull);
  });

  test('tugas yang terputus saat dikirim dipulihkan sebagai gagal kirim; entri rusak dibuang', () {
    final t = Tugas.dariEntri('a', {'id': 't-x-0123456789abcdef', 'waktu': 1, 'akun': 'akun1', 'mode': 'kerjakan', 'pesan': 'p', 'baru': false, 'tahap': 'mengirim'});
    expect(t!.tahap, TahapTugas.gagalKirim);
    expect(t.alasan, isNotNull);
    expect(Tugas.dariEntri('a', {'id': 't-x', 'waktu': 'kemarin'}), isNull);
    expect(Tugas.dariEntri('a', {'id': 't-x', 'waktu': 1, 'akun': 'a', 'mode': 'rencana', 'pesan': '', 'tahap': 'aneh'}), isNull);
  });

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
