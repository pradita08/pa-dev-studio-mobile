// Sumber data PRATINJAU (demo: build debug & profile, tidak pernah rilis): data contoh agar owner bisa melihat semua layar sebelum relay dipasang.
// v2 F1: juga data contoh tab Sesi (cermin_sesi / cermin / cermin_riwayat), karena cermin nyata mati di non-rilis (K-07).
// Tidak memanggil fasad Kunci sama sekali. Data dimasukkan lewat pengurai yang sama dengan sumber nyata (terapkanStatus /
// terapkanKabar) sehingga bentuk isi kabar kontrak §2 ikut teruji. Titik masuk dipagari !kReleaseMode di AkarAplikasi.
import 'dart:async';

import 'package:flutter/foundation.dart';

import '../kunci/kunci.dart';
import '../layar/data.dart';

class SumberContoh extends SumberData {
  SumberContoh() {
    // REV-38: pagar nyata (assert dibuang di profile/rilis). Titik masuk di AkarAplikasi sudah dipagari !kReleaseMode.
    if (kReleaseMode) throw StateError('SumberContoh hanya untuk build debug/profile (demo)');
    _isiAwal();
  }

  @override
  bool get pratinjau => true;

  KeadaanKhusus keadaan = KeadaanKhusus.normal;
  int _urutPerintah = 0;
  final List<Timer> _simulasi = [];

  int get _kini => DateTime.now().millisecondsSinceEpoch;
  int _lalu(Duration d) => DateTime.now().subtract(d).millisecondsSinceEpoch;

  Map<String, Object?> _status({bool kosong = false}) {
    final reset = DateTime.now();
    final jamReset = DateTime(reset.year, reset.month, reset.day, 23, 10).millisecondsSinceEpoch;
    return {
      'jenis': 'status',
      'urut_mac': 1,
      'dibuat': _kini,
      'status': {
        'versi': '0.9.0',
        'maksPerangkat': 2,
        'perangkat': [
          {'nama': 'POCO F7', 'mode': 'rencana+kerjakan', 'dipasang': _lalu(const Duration(days: 2)), 'ini': true},
          {'nama': 'Tab Kantor', 'mode': 'rencana', 'dipasang': _lalu(const Duration(days: 9))},
        ],
        // alur kerja live contoh (SIMPEG): perintah → analis selesai → programmer & QA bekerja → menunggu izin
        if (!kosong)
          'kantor': [
            for (final (dtk, e) in <(int, Map<String, Object?>)>[
              (300, {'kind': 'prompt'}),
              (290, {'kind': 'tool', 'tool': 'Read'}),
              (280, {'kind': 'tool', 'tool': 'Agent', 'sub': 'divisi-analis'}),
              (275, {'kind': 'agent_start', 'who': 'divisi-analis', 'agentId': 'c-an'}),
              (250, {'kind': 'tool', 'who': 'divisi-analis', 'agentId': 'c-an', 'tool': 'Grep'}),
              (200, {'kind': 'agent_stop', 'who': 'divisi-analis', 'agentId': 'c-an'}),
              (190, {'kind': 'tool', 'tool': 'Agent', 'sub': 'divisi-programmer'}),
              (185, {'kind': 'agent_start', 'who': 'divisi-programmer', 'agentId': 'c-pr'}),
              (120, {'kind': 'tool', 'who': 'divisi-programmer', 'agentId': 'c-pr', 'tool': 'Edit'}),
              (100, {'kind': 'tool', 'tool': 'Agent', 'sub': 'divisi-qa'}),
              (95, {'kind': 'agent_start', 'who': 'divisi-qa', 'agentId': 'c-qa'}),
              (40, {'kind': 'tool', 'who': 'divisi-qa', 'agentId': 'c-qa', 'tool': 'Bash'}),
              (10, {'kind': 'notify', 'type': 'permission_prompt'}),
            ])
              {'ts': _lalu(Duration(seconds: dtk)), 'session': 'a1b2c3d4e5f60718', 'proyek': 'simpeg', ...e},
          ],
        'limit': [
          {'akun': 'akun2', 'persen5j': 62, 'reset5j': jamReset},
        ],
        'proyek': kosong
            ? <Object>[]
            : [
                {
                  'id': 'simpeg', 'nama': 'SIMPEG', 'grup': 'KOMINFO', 'akun': ['akun2', 'akun1'], 'hp': 'kerjakan', 'sibuk': true, 'mode': 'rencana', 'utama': 'bekerja',
                  'mulai': _lalu(const Duration(minutes: 4)), 'batasMenit': 10,
                  'divisi': [
                    {'nama': 'Bima', 'peran': 'programmer', 'status': 'bekerja', 'ringkas': 'Mengubah PegawaiModel.php'},
                    {'nama': 'Dewi', 'peran': 'QA', 'status': 'bekerja', 'ringkas': 'Menjalankan tes export'},
                    {'nama': 'Laras', 'peran': 'UI', 'status': 'diam'},
                  ],
                },
                {
                  'id': 'simpati', 'nama': 'SIMPATI', 'grup': 'ARDANA', 'akun': ['akun1'], 'hp': 'rencana', 'sibuk': false, 'batasMenit': 10,
                  'terakhir': _lalu(const Duration(minutes: 1)),
                  'divisi': [
                    {'nama': 'Rizky', 'peran': 'programmer', 'status': 'menunggu_izin', 'ringkas': 'Bash · php spark migrate'},
                  ],
                },
                {
                  'id': 'simgaji', 'nama': 'SIM GAJI PPPK', 'grup': 'KOMINFO', 'akun': ['akun2'], 'hp': 'rencana', 'sibuk': false, 'batasMenit': 10,
                  'terakhir': {'hasil': 'selesai', 'waktu': _lalu(const Duration(minutes: 12)), 'ringkas': 'QA: LULUS'},
                  'divisi': <Object>[],
                },
                {
                  'id': 'sinergi', 'nama': 'SINERGI', 'grup': 'Umum', 'akun': ['akun1', 'akun2'], 'hp': 'kerjakan', 'sibuk': false, 'batasMenit': 20,
                  'terakhir': _lalu(const Duration(days: 1, hours: 2)),
                  'divisi': <Object>[],
                },
                // v2: proyek hp:false hanya membawa nama untuk tab Sesi (tidak tampil di Proyek/Chat)
                {'id': 'simukpbj', 'nama': 'SIMUK PBJ', 'hp': false, 'cermin': 'ringkas', 'dataPribadi': false, 'divisi': <Object>[]},
                {'id': 'padev_studio', 'nama': 'PADEV Studio', 'hp': false, 'cermin': 'isi', 'dataPribadi': false, 'divisi': <Object>[]},
              ],
      },
    };
  }

  void _isiAwal() {
    macTersambung = true;
    grupTerbuka = const {'Umum', 'KOMINFO', 'ARDANA'}; // demo: semua bagian grup terbuka
    macTerakhir = DateTime.now().subtract(const Duration(seconds: 5));
    perangkat = const InfoPerangkat(
      namaMac: 'MacBook Pradita',
      relay: 'https://padev-studio.pa-developer.pro/api/v1/',
      versiApk: '0.1.0',
      android: 35,
      fcmAktif: false,
      biometrikKuat: true,
      strongBox: true,
      idKRencana: '7f3ka9e1',
      idKKerjakan: 'c2d40b9f',
      idEHp: '19be66a0',
    );
    terapkanStatus(_status());
    cerminTersedia = true; // data contoh cermin (KONTRAK-apk-v2 §6.3 non-rilis)

    // Kabar (notif) contoh
    void notif(Duration lalu, Map<String, Object?> n, {bool dibaca = true}) {
      terapkanKabar({'jenis': 'notif', 'dibuat': _lalu(lalu), 'notif': n});
      if (dibaca) kabar.first.dibaca = true;
    }

    notif(const Duration(days: 1, hours: 3), {'j': 'mac_terputus'});
    notif(const Duration(days: 1, hours: 2), {'j': 'selesai', 'proyek': 'SINERGI', 'proyekId': 'sinergi', 'durasiDtk': 240});
    notif(const Duration(minutes: 44), {'j': 'selesai', 'proyek': 'SIM GAJI PPPK', 'proyekId': 'simgaji', 'durasiDtk': 410});
    notif(const Duration(minutes: 27), {'j': 'selesai', 'proyek': 'SIMPEG', 'proyekId': 'simpeg', 'durasiDtk': 720});
    notif(const Duration(minutes: 15), {'j': 'divisi', 'proyek': 'SIMPEG', 'proyekId': 'simpeg', 'n': 1}, dibaca: false);
    notif(const Duration(minutes: 3), {'j': 'izin', 'proyek': 'SIMPATI', 'proyekId': 'simpati'}, dibaca: false);

    // SIM GAJI PPPK: tugas selesai + langkah ditolak
    final selesai = tambahTugas(Tugas(
      tugas: 't-contoh-1', proyek: 'simgaji', akun: 'akun2', mode: 'kerjakan', pesan: 'perbaiki query export Excel yang lambat',
      baru: false, dibuat: DateTime.now().subtract(const Duration(minutes: 15)),
    ))
      ..perintahId = 'p-contoh-1';
    _kabarChat(selesai, 'mulai', {});
    _kabarChat(selesai, 'alat', {'alat': 'Edit', 'ringkas': 'PegawaiModel.php'});
    _kabarChat(selesai, 'alat', {'alat': 'Bash', 'ringkas': 'php spark test'});
    _kabarChat(selesai, 'selesai', {
      'teks': 'Query sudah diganti satu join. Export 2.400 pegawai turun dari 38 dtk ke 3 dtk. Tes lulus.',
      'durasiMs': 130000,
      'ditolak': [
        {'alat': 'Bash', 'ringkas': 'rm -rf build/'},
      ],
    });

    // SIMPEG: tugas sedang bekerja (teks mengalir)
    final kerja = tambahTugas(Tugas(
      tugas: 't-contoh-2', proyek: 'simpeg', akun: 'akun2', mode: 'rencana', pesan: 'cek kenapa export Excel lambat, lalu jelaskan penyebabnya',
      baru: false, dibuat: DateTime.now().subtract(const Duration(minutes: 4)),
    ))
      ..perintahId = 'p-contoh-2'
      ..batasMenit = 10;
    _kabarChat(kerja, 'mulai', {});
    kerja.mulai = DateTime.now().subtract(const Duration(minutes: 1, seconds: 42));
    _kabarChat(kerja, 'alat', {'alat': 'Read', 'ringkas': 'PegawaiController.php'});
    _kabarChat(kerja, 'alat', {'alat': 'Grep', 'ringkas': 'exportExcel'});
    _kabarChat(kerja, 'teks', {'teks': 'Penyebabnya query N+1 di exportExcel(): tiap baris pegawai memanggil data golongan satu per satu. '});
    _alirkan(kerja, const [
      'Saya sarankan menggantinya dengan satu query join ',
      'ke tabel golongan, lalu memakai chunk 500 baris ',
      'agar memori tetap rendah.',
    ], selesai: false);
  }

  void _kabarChat(Tugas t, String tahap, Map<String, Object?> isi) {
    terapkanKabar({
      'jenis': 'kabar',
      'dibuat': _kini,
      'kabar': {'perintah_id': t.perintahId, 'tugas': t.tugas, 'tahap': tahap, 'urut': t.urut + 1, ...isi},
    });
  }

  void _tandaTerima(Tugas t, String hasil, {String? alasan}) {
    terapkanKabar({
      'jenis': 'tanda_terima',
      'dibuat': _kini,
      'tanda_terima': {'perintah_id': t.perintahId, 'perintah_sha256': '0' * 64, 'hasil': hasil, 'alasan': ?alasan},
    });
  }

  void _jadwal(Duration d, void Function() f) {
    _simulasi.add(Timer(d, () {
      f();
      beritahu();
    }));
  }

  void _alirkan(Tugas t, List<String> potongan, {required bool selesai, int mulaiMs = 1500}) {
    var ms = mulaiMs;
    for (final p in potongan) {
      _jadwal(Duration(milliseconds: ms), () {
        if (t.aktif) _kabarChat(t, 'teks', {'teks': p});
      });
      ms += 1400;
    }
    if (selesai) {
      _jadwal(Duration(milliseconds: ms), () {
        if (!t.aktif) return;
        _kabarChat(t, 'selesai', {'durasiMs': DateTime.now().difference(t.mulai ?? t.dibuat).inMilliseconds});
        _tandaTerima(t, 'selesai');
        terapkanKabar({
          'jenis': 'notif',
          'dibuat': _kini,
          'notif': {'j': 'selesai', 'proyek': cariProyek(t.proyek)?.nama, 'proyekId': t.proyek, 'durasiDtk': 9},
        });
      });
    }
  }

  // ---- keadaan khusus L08 (dipilih dari pita pratinjau)
  void aturKeadaan(KeadaanKhusus k) {
    keadaan = k;
    macTersambung = k != KeadaanKhusus.macPutus;
    macTerakhir = k == KeadaanKhusus.macPutus ? DateTime.now().subtract(const Duration(minutes: 25)) : DateTime.now();
    tanpaInternet = k == KeadaanKhusus.tanpaInternet;
    memuatAwal = k == KeadaanKhusus.memuat;
    pembaruanWajib = k == KeadaanKhusus.pembaruanWajib;
    terapkanStatus(_status(kosong: k == KeadaanKhusus.kosong));
    beritahu();
  }

  @override
  Future<void> segarkan({bool diam = false}) async {
    if (keadaan == KeadaanKhusus.memuat) return;
    await super.segarkan(diam: diam);
  }

  @override
  Future<void> transportSegarkan() async {
    await Future<void>.delayed(const Duration(milliseconds: 500));
    switch (keadaan) {
      case KeadaanKhusus.tanpaInternet:
        throw const GalatKunci('jaringan');
      case KeadaanKhusus.pembaruanWajib:
        throw const GalatKunci('versi_usang');
      case KeadaanKhusus.macPutus:
        macTersambung = false;
      default:
        macTersambung = true;
        macTerakhir = DateTime.now();
    }
  }

  @override
  Future<String> transportKirim(Tugas t) async {
    await Future<void>.delayed(const Duration(milliseconds: 600));
    if (keadaan == KeadaanKhusus.tanpaInternet) throw const GalatKunci('jaringan');
    if (keadaan == KeadaanKhusus.macPutus) throw const GalatKunci('mac_tidak_tersambung');
    final id = 'p-pratinjau-${++_urutPerintah}';
    t.batasMenit = cariProyek(t.proyek)?.batasMenit;
    // Simulasi: diterima → mulai → alat → teks mengalir → selesai.
    _jadwal(const Duration(milliseconds: 900), () => _tandaTerima(t, 'diterima'));
    _jadwal(const Duration(milliseconds: 1800), () {
      _tandaTerima(t, 'mulai');
      _kabarChat(t, 'mulai', {});
    });
    _jadwal(const Duration(milliseconds: 2600), () => _kabarChat(t, 'alat', {'alat': 'Read', 'ringkas': 'app/Controllers/Pegawai.php'}));
    _jadwal(const Duration(milliseconds: 3400), () => _kabarChat(t, 'alat', {'alat': t.mode == 'kerjakan' ? 'Edit' : 'Grep', 'ringkas': 'exportExcel'}));
    _alirkan(t, const ['Ini jawaban contoh dari mode pratinjau. ', 'Data nyata akan muncul setelah relay ', 'dan Mac tersambung.'],
        selesai: true, mulaiMs: 4200);
    return id;
  }

  @override
  Future<void> transportHentikan(Tugas t) async {
    await Future<void>.delayed(const Duration(milliseconds: 400));
    _jadwal(const Duration(milliseconds: 800), () {
      _kabarChat(t, 'dihentikan', {'oleh': 'owner'});
      _tandaTerima(t, 'dihentikan');
    });
  }

  @override
  Future<void> transportHapusSesi(String proyek, String akun) => Future<void>.delayed(const Duration(milliseconds: 400));

  @override
  Future<void> mintaStatus() async {}

  /// Pratinjau tidak menyentuh kunci asli.
  @override
  Future<void> lepasPerangkat() async {}

  // ---- cermin sesi contoh (L11/L11b): jawaban dimasukkan lewat pengurai yang sama (terapkanKabar cermin_sesi/cermin/cermin_riwayat)
  static const _s1 = '3f1c2a9e-5b7d-4c11-9a2e-7d1f0b6c8e01';
  static const _s2 = '8a4e0c71-2d3b-4f5a-b6c7-1e9d8f0a2b02';
  static const _s3 = 'c5d6e7f8-0a1b-4c2d-8e3f-4a5b6c7d8e03';
  static const _s4 = '1b2c3d4e-5f6a-4b7c-9d8e-0f1a2b3c4d04';
  static const _s5 = '9e8d7c6b-5a4f-4e3d-a2c1-b0a9f8e7d605';
  static const _s6 = '2a3b4c5d-6e7f-4a8b-9c0d-1e2f3a4b5c06';
  static const _s7 = '7f6e5d4c-3b2a-4f1e-8d0c-9b8a7f6e5d07';

  int _urutCerminContoh = 0;
  final List<Timer> _langsungContoh = [];

  Map<String, Object?> _butirSesi(String sesi, String proyek, String akun, String judul, String asal, String status, Duration lalu,
          {bool terbuka = true, List<Map<String, Object?>> divisi = const [], Map<String, Object?>? alat, String tingkat = 'isi'}) =>
      {
        'sesi': sesi, 'akun': akun, 'proyek': proyek, 'judul': judul, 'asal': asal, 'status': status, 'terbuka': terbuka,
        'mulai': _lalu(lalu + const Duration(minutes: 40)), 'terakhir': _lalu(lalu), 'divisi': divisi, 'alat': alat,
        'bisaLanjut': status == 'bekerja' || status == 'menunggu_izin' ? 'tidak' : (terbuka ? 'cabang' : 'sama'),
        'keputusan_n': 0, 'tingkat': tingkat,
      };

  List<Map<String, Object?>> get _sesi48 => keadaan == KeadaanKhusus.kosong
      ? const []
      : [
          _butirSesi(_s1, 'simpeg', 'akun2', 'Perbaiki validasi NIP di form pegawai', 'vscode', 'bekerja', const Duration(seconds: 40),
              divisi: [
                {'peran': 'programmer', 'status': 'bekerja'},
                {'peran': 'qa', 'status': 'bekerja'},
              ],
              alat: {'alat': 'Edit', 'ringkas': 'app/Models/PegawaiModel.php (+12 −3)'}),
          _butirSesi(_s2, 'simukpbj', 'akun1', 'Audit modul paket', 'vscode', 'menunggu_izin', const Duration(minutes: 3),
              alat: {'alat': 'Bash', 'ringkas': 'php spark routes'}, tingkat: 'ringkas'),
          _butirSesi(_s3, 'padev_studio', 'akun1', 'Rancang APK v2', 'vscode', 'diam', const Duration(minutes: 25),
              divisi: [
                {'peran': 'analis', 'status': 'selesai'},
              ]),
          _butirSesi(_s4, 'simukpbj', 'akun2', 'Cek laporan realisasi', 'hp', 'selesai', const Duration(hours: 1), terbuka: false, tingkat: 'ringkas'),
          _butirSesi(_s5, 'sinergi', 'akun1', 'Rapikan seeder menu', 'cli', 'selesai', const Duration(hours: 30), terbuka: false),
        ];

  List<Map<String, Object?>> get _sesiLama => [
        _butirSesi(_s6, 'simpeg', 'akun2', 'Migrasi tabel riwayat jabatan', 'vscode', 'selesai', const Duration(days: 12), terbuka: false),
        _butirSesi(_s7, 'simgaji', 'akun2', 'Perbaikan export Excel gaji', 'vscode', 'selesai', const Duration(days: 20), terbuka: false),
      ];

  /// Tanpa internet → galat jaringan; Mac putus → relay menerima tetapi Mac tidak menjawab (layar menampilkan "Mac belum menjawab").
  bool _cerminDijawab() {
    if (keadaan == KeadaanKhusus.tanpaInternet) throw const GalatKunci('jaringan');
    return keadaan != KeadaanKhusus.macPutus;
  }

  @override
  Future<void> transportCerminDaftar({int? sejakJam, int? sejakHari, String? cari, String? proyek}) async {
    await Future<void>.delayed(const Duration(milliseconds: 300));
    if (!_cerminDijawab()) return;
    final q = cari?.toLowerCase();
    final daftar = sejakHari == null
        ? _sesi48
        : [
            for (final m in [..._sesi48, ..._sesiLama])
              if ((q == null || (m['judul'] as String).toLowerCase().contains(q)) &&
                  DateTime.now().difference(DateTime.fromMillisecondsSinceEpoch(m['terakhir'] as int)).inDays < sejakHari)
                m,
          ];
    _jadwal(const Duration(milliseconds: 900), () {
      terapkanKabar({'jenis': 'cermin_sesi', 'dibuat': _kini, 'cermin_sesi': {'sesi': daftar, 'lagi': false}});
    });
  }

  Map<String, Object?> _e(String id, Duration lalu, String peran, {String? teks, String? alat, String? ringkas, String? divisi}) => {
        'id': id, 'waktu': _lalu(lalu), 'peran': peran, 'teks': ?teks, 'alat': ?alat, 'ringkas': ?ringkas, 'divisi': ?divisi,
      };

  /// (entri, sebelum, lagi, galat)
  (List<Map<String, Object?>>, String?, bool, String?) _halamanContoh(String sesi, String? sebelum) {
    const m = Duration(minutes: 1);
    switch (sesi) {
      case _s5:
        return (const [], null, false, 'format_tidak_dikenal');
      case _s7:
        return (const [], null, false, 'tidak_tersedia');
      case _s2 || _s4: // tingkat ringkas: owner/claude tanpa teks
        return (
          [
            _e('r1', m * 14, 'owner'),
            _e('r2', m * 13, 'claude'),
            _e('r3', m * 12, 'alat', alat: 'Read', ringkas: 'app/Controllers/Paket.php'),
            _e('r4', m * 10, 'alat', alat: 'Grep', ringkas: '"hapus" di app/'),
            _e('r5', m * 8, 'claude'),
            if (sesi == _s2) _e('r6', m * 3, 'izin', alat: 'Bash', ringkas: 'php spark routes'),
          ],
          null,
          false,
          null,
        );
    }
    if (sebelum != null) {
      return (
        [
          _e('a1', m * 58, 'sistem', teks: 'Sesi dibuka di VS Code'),
          _e('a2', m * 57, 'owner', teks: 'Halo, kita lanjutkan modul pegawai hari ini.'),
          _e('a3', m * 56, 'claude', teks: 'Siap. Modul pegawai ada di app/Controllers/Pegawai.php dan app/Models/PegawaiModel.php.'),
        ],
        null,
        false,
        null,
      );
    }
    return (
      [
        _e('b1', m * 14, 'owner', teks: 'Tolong cek validasi NIP 18 digit di form tambah pegawai. NIP yang benar malah ditolak.'),
        _e('b2', m * 13, 'claude', teks: 'Saya periksa controller dan model dulu.'),
        _e('b3', m * 13, 'alat', alat: 'Read', ringkas: 'app/Controllers/Pegawai.php'),
        _e('b4', m * 12, 'alat', alat: 'Grep', ringkas: '"nip" di app/'),
        _e('b5', m * 9, 'divisi', divisi: 'programmer', ringkas: 'mulai · Perbaiki aturan validasi NIP'),
        _e('b6', m * 7, 'claude',
            teks: 'Penyebabnya: aturan max_length[16] di PegawaiModel, padahal NIP 18 digit. Bima sedang mengubahnya, Dewi menyiapkan tes.'),
        _e('b7', m * 2, 'alat', alat: 'Edit', ringkas: 'app/Models/PegawaiModel.php (+12 −3)'),
      ],
      'k-contoh-1',
      true,
      null,
    );
  }

  @override
  Future<void> transportCerminRiwayat({required String sesi, required String proyek, required String akun, String? sebelum, int batas = 50}) async {
    await Future<void>.delayed(const Duration(milliseconds: 300));
    if (!_cerminDijawab()) return;
    final (entri, kursor, lagi, galat) = _halamanContoh(sesi, sebelum);
    _jadwal(const Duration(milliseconds: 900), () {
      terapkanKabar({
        'jenis': 'cermin_riwayat',
        'dibuat': _kini,
        'cermin_riwayat': {'sesi': sesi, 'entri': entri, 'sebelum': kursor, 'lagi': lagi, 'versiParser': 1, 'galat': galat},
      });
    });
  }

  void _kejadianContoh(Duration d, List<Map<String, Object?>> ev, {bool lompat = false}) {
    _langsungContoh.add(Timer(d, () {
      _urutCerminContoh += lompat ? 2 : 1; // lompat = contoh celah urut_cermin ("ada bagian yang hilang")
      terapkanKabar({'jenis': 'cermin', 'dibuat': _kini, 'cermin': {'urut_cermin': _urutCerminContoh, 'ev': ev}});
      beritahu();
    }));
  }

  @override
  Future<void> transportCerminBuka(String? sesi, {String? proyek, String? akun}) async {
    await Future<void>.delayed(const Duration(milliseconds: 200));
    if (!_cerminDijawab() || sesi == null) return;
    for (final t in _langsungContoh) {
      t.cancel();
    }
    _langsungContoh.clear();
    if (sesi == _s1) {
      _kejadianContoh(const Duration(seconds: 3), [
        {'sesi': sesi, 'ts': _kini, 'kind': 'tool', 'tool': 'Bash', 'detail': 'php spark test --filter PegawaiTest', 'who': 'qa'},
      ]);
      _kejadianContoh(const Duration(seconds: 7), [
        {'sesi': sesi, 'ts': _kini, 'kind': 'agent_stop', 'who': 'qa', 'agentId': 'a-qa-1'},
      ], lompat: true);
      _kejadianContoh(const Duration(seconds: 10), [
        {'sesi': sesi, 'ts': _kini, 'kind': 'stop', 'text': 'Validasi NIP sudah 18 digit dan tes PegawaiTest lulus (6/6). Silakan coba lagi di form.'},
      ]);
    } else if (sesi == _s2) {
      _kejadianContoh(const Duration(seconds: 4), [
        {'sesi': sesi, 'ts': _kini, 'kind': 'notify', 'text': 'Claude butuh izin untuk Bash'},
      ]);
    }
  }

  @override
  Future<void> transportCerminTutup() async {
    for (final t in _langsungContoh) {
      t.cancel();
    }
    _langsungContoh.clear();
  }

  @override
  void dispose() {
    for (final t in _langsungContoh) {
      t.cancel();
    }
    for (final t in _simulasi) {
      t.cancel();
    }
    super.dispose();
  }
}
