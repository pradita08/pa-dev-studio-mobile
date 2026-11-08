// Uji pengurai isi kabar (kontrak §2) → model tampilan.
import 'package:flutter_test/flutter_test.dart';
import 'package:padev_studio/kunci/kunci.dart';
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

  test('F2b/G8 status.kantor → kejadian bersih (field asing/isi dibuang; detail hanya tool ≤80); tanpa field → null', () {
    final s = _SumberUji()
      ..status({
        'status': {
          'proyek': [],
          'kantor': [
            {'ts': 1, 'kind': 'tool', 'tool': 'Edit', 'who': 'divisi-programmer', 'agentId': 'ag1', 'session': 'abc', 'detail': '/Users/x/rahasia.php', 'text': 'isi'},
            {'ts': 2, 'kind': 'notify', 'type': 'permission_prompt', 'detail': 'bukan alat'},
            {'ts': 4, 'kind': 'tool', 'tool': 'Bash', 'detail': 'x' * 81},
            {'ts': 3, 'kind': 'hapus_semua'},
            {'kind': 'prompt'},
            'bukan peta',
          ],
        },
      });
    expect(s.kantor, [
      {'ts': 1, 'kind': 'tool', 'session': 'abc', 'who': 'divisi-programmer', 'agentId': 'ag1', 'tool': 'Edit', 'detail': '/Users/x/rahasia.php'},
      {'ts': 2, 'kind': 'notify', 'type': 'permission_prompt'},
      {'ts': 4, 'kind': 'tool', 'tool': 'Bash'},
    ]);
    s.status({'status': {'proyek': []}});
    expect(s.kantor, isNull);
  });

  group('G8 status.rekap', () {
    Map<String, Object?> hari(String tgl, List<Object?> t) => {'tgl': tgl, 't': t, 'n': [1, 0, 2], 'c': [3, 0, 1]};
    Map<String, Object?> rekap() => {
          'v': 1,
          'dibuat': 1791000000000,
          'zona': '+07:00',
          'awal': '2026-10-01',
          'agen': ['kepala', 'divisi-programmer', 'general-purpose'],
          'hari': [
            for (var i = 2; i <= 7; i++) hari('2026-11-0$i', [i * 10, i, 0]),
            hari('2026-11-08', [100, 5, 7]),
          ],
          'bulan': [
            {'bln': '2026-10', 't': [9, 9, 9], 'n': [1, 1, 1], 'c': [0, 0, 0], 'asing': 'x'},
            {'bln': '2026-11', 't': [8, 8, 8], 'n': [1, 1, 1], 'c': [0, 0, 0]},
          ],
          'proyek': 'rahasia',
        };
    RekapAgen? baca(Map<String, Object?> r) => (_SumberUji()..status({'status': {'proyek': [], 'rekap': r}})).rekap;

    test('agen kosong (Mac baru tanpa pemakaian) → rekap kosong, bukan null (QA-1)', () {
      final kosong = <String, Object?>{'v': 1, 'dibuat': 1791000000000, 'zona': '+07:00', 'agen': [],
        'hari': [for (var i = 2; i <= 8; i++) {'tgl': '2026-11-0$i', 't': [], 'n': [], 'c': []}], 'bulan': []};
      final r = baca(kosong);
      expect(r, isNotNull);
      expect(r!.agen, isEmpty);
      expect(r.token7Hari('kepala'), 0);
    });

    test('bentuk sah → RekapAgen; token7Hari/harianAgen per agen; kelompok', () {
      final r = baca(rekap())!;
      expect(r.dibuat, DateTime.fromMillisecondsSinceEpoch(1791000000000));
      expect(r.awal, '2026-10-01');
      expect(r.agen, ['kepala', 'divisi-programmer', 'general-purpose']);
      expect(r.hari.length, 7);
      expect(r.hari.last.kunci, '2026-11-08');
      expect(r.bulan.map((b) => b.kunci), ['2026-10', '2026-11']);
      expect(r.harianAgen('divisi-programmer'), [2, 3, 4, 5, 6, 7, 5]);
      expect(r.token7Hari('kepala'), 20 + 30 + 40 + 50 + 60 + 70 + 100);
      expect(r.token7Hari('divisi-qa'), 0);
      expect(r.harianAgen('divisi-qa'), List.filled(7, 0));
      expect(RekapAgen.kelompok('kepala'), 'kepala');
      expect(RekapAgen.kelompok('divisi-programmer'), 'programmer');
      expect(RekapAgen.kelompok('divisi-'), 'pendukung');
      expect(RekapAgen.kelompok('general-purpose'), 'pendukung');
      expect(RekapAgen.kelompok('lainnya'), 'pendukung');
    });

    test('periode cacat dibuang (panjang ≠ agen, angka negatif/pecahan/teks, kunci salah); hari kurang → 0 di depan', () {
      final m = rekap();
      final h = m['hari'] as List;
      h[0] = hari('2026-11-02', [1, 2]);
      h[1] = hari('2026-11-03', [1, -2, 0]);
      h[2] = hari('2026-11-04', [1, 2.5, 0]);
      h[3] = hari('2026-11-05', [1, '2', 0]);
      h[4] = hari('5 Nov', [1, 2, 0]);
      final r = baca(m)!;
      expect(r.hari.map((x) => x.kunci), ['2026-11-07', '2026-11-08']);
      expect(r.harianAgen('kepala'), [0, 0, 0, 0, 0, 70, 100]);
      expect(r.bulan.length, 2);
    });

    test('bentuk salah → null (versi, dibuat, agen tidak sah/ganda/>24, bukan peta); tanpa field → null', () {
      expect(baca({...rekap(), 'v': 2}), isNull);
      expect(baca({...rekap(), 'dibuat': '1791000000000'}), isNull);
      expect(baca({...rekap(), 'agen': ['kepala', 'Divisi QA', 'x']}), isNull);
      expect(baca({...rekap(), 'agen': ['kepala', 'kepala', 'x']}), isNull);
      expect(baca({...rekap(), 'agen': [for (var i = 0; i < 25; i++) 'a$i']}), isNull);
      expect((_SumberUji()..status({'status': {'proyek': [], 'rekap': 'x'}})).rekap, isNull);
      expect((_SumberUji()..status({'status': {'proyek': []}})).rekap, isNull);
    });

    test('rekap contoh pratinjau: sah dan 7 hari', () {
      final r = RekapAgen.contoh(DateTime(2026, 11, 8));
      expect(r.hari.length, 7);
      expect(r.hari.last.kunci, '2026-11-08');
      expect(r.bulan.last.kunci, '2026-11');
      expect(r.token7Hari('divisi-programmer'), greaterThan(0));
      for (final p in [...r.hari, ...r.bulan]) {
        expect([p.token.length, p.tugas.length, p.sen.length], everyElement(r.agen.length));
      }
    });
  });

  test('NamaPegawai: kunci tanpa #ke (kepala/resepsionis) dibaca', () {
    NamaPegawai.atur({'kepala': 'Nerro', 'resepsionis': 'Alvio', 'div:programmer#1': 'Bima'});
    expect(NamaPegawai.cari('kepala'), 'Nerro');
    expect(NamaPegawai.cari('resepsionis'), 'Alvio');
    expect(NamaPegawai.cari('divisi-programmer'), 'Bima');
    expect(NamaPegawai.cari('kepala', 2), isNull);
    NamaPegawai.atur(const {});
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

  group('G4 lanjut sesi (S-G4-15, KF-G4-01/02/05)', () {
    const uuid = '3f1c2a9e-5b7d-4c11-9a2e-7d1f0b6c8e01';
    _SumberUji sumber({List<String> fitur = const ['lanjut_sesi', 'akun_otomatis'], bool dataPribadi = false, String hp = 'kerjakan'}) =>
        _SumberUji()
          ..status({
            'status': {
              'fitur': fitur,
              'proyek': [
                {'id': 'simpeg', 'nama': 'SIMPEG', 'akun': ['akun1', 'akun2'], 'hp': hp, 'sibuk': false, 'dataPribadi': dataPribadi},
              ],
            },
          });
    SesiCermin sesi({String bisa = 'cabang', StatusSesi status = StatusSesi.selesai, String akun = 'akun2', String id = uuid}) =>
        SesiCermin(sesi: id, akun: akun, proyek: 'simpeg', judul: 'Perbaiki NIP', asal: 'vscode', status: status, terbuka: false,
            tingkat: 'ringkas', bisaLanjut: bisa);
    void terima(_SumberUji s, String hasil, [String? alasan]) => s.kabarMasuk({
          'jenis': 'tanda_terima',
          'tanda_terima': {'perintah_id': 'p1', 'hasil': hasil, 'alasan': ?alasan},
        });

    test('keadaan tombol: fitur, hp, dataPribadi, UUID, dipakai, akun tidak aktif', () {
      expect(sumber().tombolLanjut(sesi()), TombolLanjut.aktif);
      expect(sumber().tombolLanjut(sesi(bisa: 'sama')), TombolLanjut.aktif);
      expect(sumber(fitur: const []).tombolLanjut(sesi()), TombolLanjut.sembunyi, reason: 'Mac lama');
      expect(sumber(dataPribadi: true).tombolLanjut(sesi()), TombolLanjut.sembunyi);
      expect(sumber(hp: 'baca').tombolLanjut(sesi()), TombolLanjut.sembunyi);
      expect(sumber().tombolLanjut(sesi(id: uuid.toUpperCase())), TombolLanjut.sembunyi);
      expect(sumber().tombolLanjut(sesi(bisa: 'tidak')), TombolLanjut.dipakai);
      expect(sumber().tombolLanjut(sesi(status: StatusSesi.menungguIzin)), TombolLanjut.dipakai);
      expect(sumber().tombolLanjut(sesi(akun: 'akun3')), TombolLanjut.akunMati);
      expect(sumber().mulaiLanjut(sesi(bisa: 'tidak')), isFalse);
    });

    test('sesi hanya di pesan pertama; baru:false, akun sesi, tanpa otomatis; pesan ke-2 tanpa sesi', () async {
      final s = sumber();
      await Future<void>.delayed(Duration.zero);
      s.percakapanBaru('simpeg');
      expect(s.mulaiLanjut(sesi()), isTrue);
      expect(s.baruBerikutnya('simpeg'), isFalse);
      final t1 = await s.kirim(proyekId: 'simpeg', akun: 'akun1', mode: 'rencana', pesan: 'lanjut', otomatis: true);
      expect((t1.sesi, t1.baru, t1.akun, t1.otomatis), (uuid, false, 'akun2', false));
      terima(s, 'diterima');
      final t2 = await s.kirim(proyekId: 'simpeg', akun: 'akun2', mode: 'rencana', pesan: 'berikutnya');
      expect(t2.sesi, isNull);
      expect(s.lanjutan('simpeg')?.judul, 'Perbaiki NIP', reason: 'pita tetap sampai ditutup');
      expect(t1.keEntri().containsKey('sesi'), isFalse);
      s.dispose();
    });

    test('ditolak sesi_* → pita ditutup; ditolak alasan lain → sesi ikut lagi; percakapan baru menutup pita', () async {
      final s = sumber();
      await Future<void>.delayed(Duration.zero);
      s.mulaiLanjut(sesi());
      await s.kirim(proyekId: 'simpeg', akun: 'akun2', mode: 'rencana', pesan: 'a');
      terima(s, 'ditolak', 'proyek_sedang_bekerja');
      expect(s.lanjutan('simpeg'), isNotNull);
      final t2 = await s.kirim(proyekId: 'simpeg', akun: 'akun2', mode: 'rencana', pesan: 'b');
      expect(t2.sesi, uuid);
      s.chat('simpeg').first.perintahId = 'p0';
      terima(s, 'ditolak', 'sesi_sedang_dipakai');
      expect(s.lanjutan('simpeg'), isNull);
      expect(alasanTolak('sesi_sedang_dipakai'), 'Sedang dipakai di Mac — pakai aplikasi Claude (Remote Control)');
      s.mulaiLanjut(sesi());
      s.percakapanBaru('simpeg');
      expect(s.lanjutan('simpeg'), isNull);
      s.dispose();
    });

    test('7 alasan tolak G4 punya teks tanpa path; alasan lain apa adanya', () {
      const kode = ['sesi_dengan_baru', 'sesi_tidak_ada', 'sesi_bukan_milik_proyek', 'sesi_sedang_dipakai', 'cermin_mati', 'sesi_data_pribadi',
        'akun_tidak_aktif'];
      for (final k in kode) {
        expect(alasanTolak(k), isNot(k));
        expect(alasanTolak(k), isNot(contains('/')));
      }
      expect(alasanTolak('proyek_sibuk'), 'proyek_sibuk');
    });
  });

  group('G5 sambung sesi (kontrak §10.2/§10.3, V-S01..05)', () {
    const s1 = '3f1c2a9e-5b7d-4c11-9a2e-7d1f0b6c8e01', s2 = '8a4e0c71-2d3b-4f5a-b6c7-1e9d8f0a2b02', s3 = 'c2d1e0f9-8a7b-4c6d-9e5f-0a1b2c3d4e03';
    final kini = DateTime.now().millisecondsSinceEpoch;
    Map<String, Object?> butir(String sesi, {String keadaan = 'menunggu', int antre = 0, String? giliran, Object? sejak, String proyek = 'simpeg'}) => {
          'sesi': sesi, 'proyek': proyek, 'akun': 'akun1', 'sejak': sejak ?? kini - 60000, 'keadaan': keadaan, 'antre': antre, 'giliran': ?giliran,
        };
    _SumberUji sumber({List<String> fitur = const ['sambung_sesi'], List<Object?>? sambung, Object? sejak, String hp = 'kerjakan'}) => _SumberUji()
      ..status({
        'status': {
          'fitur': fitur,
          'proyek': [
            {'id': 'simpeg', 'nama': 'SIMPEG', 'akun': ['akun1', 'akun2'], 'hp': hp, 'sibuk': false, 'sambung': true, 'sambungSejak': sejak},
          ],
          'sambung': sambung ?? [butir(s1), butir(s2, keadaan: 'bekerja', antre: 2, giliran: 'hp'), butir(s3, keadaan: 'mac')],
        },
      });
    SesiCermin sesi(String id, {String akun = 'akun1'}) =>
        SesiCermin(sesi: id, akun: akun, proyek: 'simpeg', judul: 'Perbaiki NIP', asal: 'vscode', status: StatusSesi.diam, terbuka: true, tingkat: 'isi');

    test('V-S01 status.sambung 3 entri sah → tampil', () {
      final s = sumber();
      expect(s.sambung.map((e) => e.keadaan), ['menunggu', 'bekerja', 'mac']);
      expect((s.sambungSesi(s2)!.antre, s.sambungSesi(s2)!.giliranHp), (2, true));
      expect(s.sambungSesi(s1)!.giliranHp, isFalse);
      expect(s.sambungDidukung, isTrue);
      expect(s.cariProyek('simpeg')!.sambung, isTrue);
    });

    test('V-S02 entri keadaan:"aneh" dibuang, lainnya tetap (juga antre/giliran/sesi/sejak rusak)', () {
      final s = sumber(sambung: [
        butir(s1),
        butir(s2, keadaan: 'aneh'),
        butir(s3, antre: 21),
        butir('bukan-uuid'),
        butir(s3, sejak: 'kemarin'),
        butir(s3, giliran: 'mac'),
        'rusak',
      ]);
      expect(s.sambung.map((e) => e.sesi), [s1]);
      expect(sumber(sambung: [for (var i = 0; i < 60; i++) butir(s1)]).sambung.length, 50);
    });

    test('V-S03 sambungSejak 8 hari lalu → "sejak 8 hari"; <= 7 hari tidak ada teks', () {
      final kiniW = DateTime.now();
      expect(sambungSejakHari(kiniW.subtract(const Duration(days: 8, hours: 1)), kini: kiniW), 'sejak 8 hari');
      expect(sambungSejakHari(kiniW.subtract(const Duration(days: 7, hours: 23)), kini: kiniW), isNull);
      expect(sambungSejakHari(null), isNull);
      final s = sumber(sejak: kini - 8 * 24 * 3600 * 1000 - 1000);
      expect(sambungSejakHari(s.cariProyek('simpeg')!.sambungSejak), 'sejak 8 hari');
    });

    test('V-S04 tanpa fitur sambung_sesi → "Balas di sesi ini" tersembunyi; bypass/akun beda/Kerjakan mati', () {
      expect(sumber().tombolBalas(sesi(s1)), TombolBalas.aktif);
      expect(sumber(fitur: const []).tombolBalas(sesi(s1)), TombolBalas.sembunyi);
      expect(sumber().tombolBalas(sesi('d0d0d0d0-8a7b-4c6d-9e5f-0a1b2c3d4e04')), TombolBalas.sembunyi, reason: 'sesi tidak ada di status.sambung');
      expect(sumber().tombolBalas(sesi(s1, akun: 'akun2')), TombolBalas.sembunyi, reason: 'akun beda');
      expect(sumber(sambung: [butir(s1, keadaan: 'bypass')]).tombolBalas(sesi(s1)), TombolBalas.bypass);
      expect(sumber(hp: 'rencana').tombolBalas(sesi(s1)), TombolBalas.tanpaKerjakan);
      expect(sumber(fitur: const []).mulaiSambung(sesi(s1)), isFalse);
    });

    test('V-S05 alasan §10.3 → teks sehari-hari; kode tak dikenal apa adanya', () {
      const peta = {
        'sesi_tidak_tersambung': 'Sesi ini tidak tersambung lagi. Buka ulang daftar sesi.',
        'terlalu_cepat': 'Terlalu cepat. Tunggu 2 detik lalu kirim lagi.',
        'pesan_kosong': 'Pesannya kosong. Tulis ulang pesannya.',
        'antrean_penuh': 'Antrean sesi ini penuh (20 pesan).',
        'mode_bypass': 'Sesi ini mode lewati-izin, tidak menerima pesan HP.',
        'sambung_berakhir': 'Sambungan proyek ini sudah dimatikan di Mac.',
        'kedaluwarsa': 'Pesan terlalu lama menunggu (30 menit). Kirim ulang?',
        'tidak_terkirim': 'Pesan tidak sampai ke sesi. Kirim ulang?',
        'pelaksana_mulai_ulang': 'Pelaksana di Mac mulai ulang. Kirim ulang?',
        'darurat': 'Dihentikan: kode darurat / jarak jauh dimatikan.',
      };
      peta.forEach((k, v) => expect(alasanTolak(k, sambung: true), v));
      expect(alasanTolak('perangkat_dicabut'), 'perangkat_dicabut');
      expect(alasanTolak('kode_aneh'), 'kode_aneh');
    });

    test('REV-01 teks "Kirim ulang?" hanya untuk tugas sambung; Chat biasa tetap kode apa adanya', () {
      for (final k in ['kedaluwarsa', 'tidak_terkirim', 'pelaksana_mulai_ulang']) {
        expect(alasanTolak(k), k);
        expect(alasanTolak(k, sambung: true), isNot(k));
      }
      expect(alasanTolak('kedaluwarsa'), isNot(contains('30 menit')));
      expect(alasanTolak('mode_bypass'), alasanTolak('mode_bypass', sambung: true), reason: 'alasan lain tidak bergantung sambung');
    });

    test('kirim saat tersambung: sesi+sambung di SETIAP pesan, kerjakan, baru:false, akun sesi, jeda 2 dtk', () async {
      final s = sumber();
      await Future<void>.delayed(Duration.zero);
      s.percakapanBaru('simpeg');
      expect(s.mulaiSambung(sesi(s1)), isTrue);
      expect(s.baruBerikutnya('simpeg'), isFalse);
      final t = await s.kirim(proyekId: 'simpeg', akun: 'akun2', mode: 'rencana', pesan: 'halo', otomatis: true);
      expect((t.sesi, t.sambung, t.baru, t.akun, t.mode, t.otomatis), (s1, true, false, 'akun1', 'kerjakan', false));
      expect(t.keEntri().containsKey('sesi'), isFalse);
      await expectLater(s.kirim(proyekId: 'simpeg', akun: 'akun1', mode: 'kerjakan', pesan: 'lagi'), throwsA(isA<GalatKunci>().having((e) => e.kode, 'kode', 'terlalu_cepat')));
      s.tutupSambung('simpeg');
      expect(s.sambungan('simpeg'), isNull);
      final biasa = await s.kirim(proyekId: 'simpeg', akun: 'akun1', mode: 'rencana', pesan: 'biasa');
      expect((biasa.sesi, biasa.sambung), (null, false));
      s.dispose();
    });

    test('sesi hilang dari status / bypass → kirim ditolak sebelum ke Mac; Kirim ulang tugas gagal membuat tugas baru', () async {
      final s = sumber();
      await Future<void>.delayed(Duration.zero);
      s.mulaiSambung(sesi(s1));
      s.status({'status': {'fitur': ['sambung_sesi'], 'proyek': [{'id': 'simpeg', 'nama': 'SIMPEG', 'akun': ['akun1'], 'hp': 'kerjakan', 'sibuk': false}], 'sambung': []}});
      await expectLater(s.kirim(proyekId: 'simpeg', akun: 'akun1', mode: 'kerjakan', pesan: 'x'), throwsA(isA<GalatKunci>().having((e) => e.kode, 'kode', 'sesi_tidak_tersambung')));
      expect(s.chat('simpeg'), isEmpty);
      s.status({'status': {'fitur': ['sambung_sesi'], 'proyek': [{'id': 'simpeg', 'nama': 'SIMPEG', 'akun': ['akun1'], 'hp': 'kerjakan', 'sibuk': false}], 'sambung': [butir(s1)]}});
      final t = await s.kirim(proyekId: 'simpeg', akun: 'akun1', mode: 'kerjakan', pesan: 'x');
      t.tahap = TahapTugas.gagal;
      t.alasan = 'tidak_terkirim';
      expect(SumberData.alasanBisaKirimUlang.contains(t.alasan), isTrue);
      s.tutupSambung('simpeg');
      expect(() => s.kirimUlangSambung(t), throwsA(isA<GalatKunci>()));
      s.dispose();
    });
  });
}
