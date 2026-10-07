// Fasad Dart ke plugin Kotlin `kunci` — SATU-SATUNYA jalan UI ke native (kontrak §6).
// Kunci, token relay, tanda tangan, dan HTTP ke relay hanya ada di Kotlin; Dart menerima isi yang sudah
// diverifikasi/didekripsi. Semua metode bisa melempar [GalatKunci] (kode pendek + pesan Indonesia untuk UI).
import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

class GalatKunci implements Exception {
  const GalatKunci(this.kode);
  final String kode;

  /// Pesan untuk ditampilkan ke pengguna.
  String get pesan => _pesan[kode] ?? (kode.startsWith('relay_') ? 'Relay menolak permintaan ($kode).' : 'Terjadi kesalahan ($kode).');

  static const _pesan = <String, String>{
    'dibatalkan': 'Dibatalkan.',
    'tanpa_kunci_layar': 'Pasang kunci layar (PIN/pola/sandi) di Pengaturan Android dulu.',
    'biometrik_belum_ada': 'Daftarkan sidik jari di Pengaturan Android dulu.',
    'biometrik_tidak_tersedia': 'Sidik jari tidak tersedia di HP ini.',
    'perlu_otentikasi': 'Buka kunci dengan sidik jari atau kunci layar dulu.',
    'qr_tidak_sah': 'QR tidak sah. Jalankan ulang `node pelaksana.js --pasang-hp` di Mac.',
    'qr_kedaluwarsa': 'QR sudah kedaluwarsa (5 menit). Buat QR baru di Mac.',
    'sudah_terpasang': 'HP ini sudah terpasang. Lepas perangkat dulu bila ingin memasang ulang.',
    'belum_terpasang': 'HP belum dipasangkan dengan Mac.',
    'batas_perangkat': 'Sudah ada 2 perangkat terpasang. Cabut salah satu di Mac.',
    'mac_tidak_tersambung': 'Mac sedang tidak tersambung.',
    'jaringan': 'Tidak ada koneksi ke relay. Periksa internet.',
    'kunci_tidak_berlaku': 'Kunci tidak berlaku lagi (sidik jari berubah). Pasang ulang HP.',
    'kunci_tidak_ada': 'Kunci belum dibuat.',
    'status_belum_ada': 'Status proyek belum diterima dari Mac. Segarkan dulu.',
    'proyek_tidak_diizinkan': 'Proyek ini tidak diizinkan untuk HP.',
    'kerjakan_belum_diizinkan': 'Kerjakan belum diizinkan untuk proyek ini (nyalakan di laptop).',
    'akun_tidak_diizinkan': 'Akun ini tidak tersedia untuk proyek tersebut.',
    'versi_usang': 'Versi aplikasi terlalu lama. Pasang versi terbaru dari laptop.',
    'argumen_tidak_sah': 'Isian tidak sah.',
    'tidak_tersedia': 'Tidak tersedia di build ini.',
    'kamera_tidak_tersedia': 'HP ini tidak punya kamera yang bisa dipakai untuk memindai QR.',
    'sedang_memindai': 'Pemindai QR sedang terbuka.',
  };

  @override
  String toString() => 'GalatKunci($kode)';
}

class StatusKeamanan {
  StatusKeamanan._(Map m)
      : kunciLayar = m['kunciLayar'] == true,
        biometrikKuat = m['biometrikKuat'] == true,
        strongBox = m['strongBox'] == true,
        fcmAktif = m['fcmAktif'] == true,
        debug = m['debug'] == true,
        cerminNyata = m['cerminNyata'] == true,
        versiApk = m['versiApk'] as String? ?? '',
        android = m['android'] as int? ?? 0;

  /// false → tampilkan state L01 "HP tanpa kunci layar".
  final bool kunciLayar;
  final bool biometrikKuat, strongBox, fcmAktif, debug;

  /// K-07 (KONTRAK-apk-v2 §6.3): true hanya di build rilis. false → layar Sesi memakai data contoh; metode `cermin*` melempar
  /// `GalatKunci('tidak_tersedia')` dan kabar cermin tidak pernah datang.
  final bool cerminNyata;
  final String versiApk;
  final int android;
}

class StatusPasang {
  StatusPasang._(Map m)
      : status = m['status'] as String,
        namaMac = m['namaMac'] as String,
        macId = m['macId'] as String,
        perangkatId = m['perangkatId'] as String,
        relay = m['relay'] as String,
        kodeSas = m['kodeSas'] as String?,
        idKRencana = m['idKRencana'] as String?,
        idKKerjakan = m['idKKerjakan'] as String?,
        idEHp = m['idEHp'] as String?,
        kunciUtuh = m['kunciUtuh'] == true;

  /// 'menunggu' (kode 6 digit tampil, tunggu `ya` di Mac) | 'aktif' | 'ditolak' | 'dicabut'
  final String status;
  final String namaMac, macId, perangkatId, relay;

  /// Kode SAS 6 digit selama status 'menunggu'.
  final String? kodeSas;

  /// Sidik jari kunci (8 heksa) untuk layar Pengaturan.
  final String? idKRencana, idKKerjakan, idEHp;
  final bool kunciUtuh;
}

class HasilPasang {
  HasilPasang._(Map m)
      : kodeSas = m['kodeSas'] as String,
        namaMac = m['namaMac'] as String,
        perangkatId = m['perangkatId'] as String;
  final String kodeSas, namaMac, perangkatId;
}

class HasilHalo {
  HasilHalo._(Map m)
      : macTersambung = m['macTersambung'] == true,
        macTerakhir = m['macTerakhir'] as int?,
        perangkat = m['perangkat'] as String?,
        status = (m['status'] as Map?)?.cast<String, Object?>();
  final bool macTersambung;
  final int? macTerakhir;

  /// Status perangkat menurut relay: 'menunggu' | 'aktif' | 'dicabut'.
  final String? perangkat;

  /// Isi kabar `status` terakhir yang terverifikasi (kontrak §2: {jenis:'status', status:{proyek:[…], versi}, …}).
  final Map<String, Object?>? status;
}

class HasilKirim {
  HasilKirim._(Map m)
      : id = m['id'] as String,
        kode = m['kode'] as String?,
        hash = m['hash'] as String;

  /// id perintah (dirujuk tanda_terima.perintah_id).
  final String id;
  final String? kode;

  /// SHA-256 amplop (dirujuk tanda_terima.perintah_sha256).
  final String hash;
}

/// Riwayat satu sesi dari cache lokal terenkripsi (K-06: ≤7 hari, ≤20 sesi, ≤5 MB; hanya terbaca saat layar HP terbuka).
class RiwayatLokal {
  RiwayatLokal._(Map m)
      : sesi = m['sesi'] as String,
        diperbarui = DateTime.fromMillisecondsSinceEpoch(m['diperbarui'] as int),
        entri = (m['entri'] as List).map((e) => (e as Map).cast<String, Object?>()).toList();
  final String sesi;
  final DateTime diperbarui;

  /// Bentuk entri `cermin_riwayat` (KONTRAK-apk-v2 §2.2): {id, waktu (ms), peran, teks?, alat?, ringkas?, divisi?}, urut naik per waktu.
  final List<Map<String, Object?>> entri;
}

/// Keadaan gerbang kunci aplikasi (diatur GerbangKunci di main.dart): terkunci, tirai (aplikasi di latar / baru kembali,
/// isi disembunyikan), atau terbuka.
enum KeadaanGerbang { terkunci, tirai, terbuka }

abstract final class Kunci {
  static const _kanal = MethodChannel('pro.padeveloper.studio/kunci');

  /// Hanya diubah oleh GerbangKunci. Hasil pindai QR dibuang bila gerbang tidak terbuka (SEC-76).
  static final gerbang = ValueNotifier<KeadaanGerbang>(KeadaanGerbang.terkunci);

  static Future<T?> _p<T>(String metode, [Map<String, Object?>? arg]) async {
    try {
      return await _kanal.invokeMethod<T>(metode, arg);
    } on PlatformException catch (e) {
      throw GalatKunci(e.code);
    } on MissingPluginException {
      throw const GalatKunci('tidak_tersedia');
    }
  }

  static Future<Map> _peta(String metode, [Map<String, Object?>? arg]) async => (await _p<Map>(metode, arg)) ?? const {};

  static Future<StatusKeamanan> statusKeamanan() async => StatusKeamanan._(await _peta('statusKeamanan'));

  /// Buka aplikasi: sidik jari ATAU kunci layar sistem (BIOMETRIC_STRONG | DEVICE_CREDENTIAL). Saat dibuka & setelah 2 mnt di latar.
  static Future<bool> bukaKunciAplikasi({String? judul}) async => (await _p<bool>('bukaKunciAplikasi', {'judul': judul})) ?? false;

  /// Jam monoton Android (ms sejak boot, termasuk waktu tidur; tidak ikut berubah bila jam HP diubah — SEC-75).
  /// null bila native tidak tersedia (mis. uji widget).
  static Future<int?> jamMonoton() async {
    try {
      return await _p<int>('jamMonoton');
    } on GalatKunci {
      return null;
    }
  }

  /// Membuka pemindai QR native (CameraX + ZXing, offline; Dart tidak memegang kamera — kontrak v1.1 §7, SEC-77).
  /// Mengembalikan teks QR mentah, atau null bila dibatalkan / aplikasi ke latar / batas waktu / gerbang terkunci.
  static Future<String?> pindaiQr() async {
    final teks = await _p<String>('pindaiQr');
    if (teks == null || teks.isEmpty) return null;
    if (gerbang.value == KeadaanGerbang.tirai) await _tungguGerbang();
    return gerbang.value == KeadaanGerbang.terbuka ? teks : null;
  }

  /// Hasil pindai bisa tiba sebelum GerbangKunci selesai menilai lama di latar: tunggu tirai berganti (maks 5 dtk).
  static Future<void> _tungguGerbang() async {
    final c = Completer<void>();
    void dengar() {
      if (gerbang.value != KeadaanGerbang.tirai && !c.isCompleted) c.complete();
    }

    gerbang.addListener(dengar);
    try {
      await c.future.timeout(const Duration(seconds: 5), onTimeout: () {});
    } finally {
      gerbang.removeListener(dengar);
    }
  }

  static Future<StatusPasang?> statusPasang() async {
    final m = await _p<Map>('statusPasang');
    return m == null ? null : StatusPasang._(m);
  }

  /// [qr] = teks mentah hasil pindai. Membuat kunci, mendaftar ke relay, mengirim amplop `pasang`; tampilkan [HasilPasang.kodeSas].
  static Future<HasilPasang> mulaiPasang(String qr, {required String nama}) async =>
      HasilPasang._(await _peta('mulaiPasang', {'qr': qr, 'nama': nama}));

  static Future<HasilHalo> halo({bool aktif = true}) async => HasilHalo._(await _peta('halo', {'aktif': aktif}));

  /// Kabar yang sah saja (tanda S_mac + dekripsi + urut_mac sudah dicek di Kotlin), lalu diakui ke relay.
  static Future<List<Map<String, Object?>>> ambilKabar() async =>
      ((await _p<List>('ambilKabar')) ?? const []).map((e) => (e as Map).cast<String, Object?>()).toList();

  static Future<int> jumlahPesanTidakSah() async => (await _p<int>('jumlahPesanTidakSah')) ?? 0;

  static Future<HasilKirim> kirimRencana({
    required String tugas,
    required String proyek,
    required String akun,
    required String pesan,
    bool baru = false,
    String? model,
  }) async =>
      HasilKirim._(await _peta('kirimRencana', {'tugas': tugas, 'proyek': proyek, 'akun': akun, 'pesan': pesan, 'baru': baru, 'model': model}));

  /// Kerjakan: Kotlin menampilkan BiometricPrompt sendiri (proyek/akun/model/200 karakter pesan) dan menandatangani nilai itu.
  static Future<HasilKirim> kirimKerjakan({
    required String tugas,
    required String proyek,
    required String akun,
    required String pesan,
    bool baru = false,
    String? model,
  }) async =>
      HasilKirim._(await _peta('kirimKerjakan', {'tugas': tugas, 'proyek': proyek, 'akun': akun, 'pesan': pesan, 'baru': baru, 'model': model}));

  static Future<HasilKirim> hentikan(String tugas) async => HasilKirim._(await _peta('hentikan', {'tugas': tugas}));

  static Future<HasilKirim> hapusSesi({required String proyek, required String akun}) async =>
      HasilKirim._(await _peta('hapusSesi', {'proyek': proyek, 'akun': akun}));

  static Future<HasilKirim> mintaStatus() async => HasilKirim._(await _peta('mintaStatus'));

  /// Kirim `lepas_diri` + hapus di relay (upaya terbaik), lalu hapus semua kunci & data lokal.
  static Future<void> lepasPerangkat() => _p<void>('lepasPerangkat');

  // ---- cermin sesi (KONTRAK-apk-v2 §2.1, §6.3; F1). Perintah READ bertanda K_rencana (bisa memunculkan prompt kunci bila
  // otentikasi terakhir > 300 dtk). Jawaban datang lewat [ambilKabar] sebagai isi `jenis` cermin_sesi / cermin / cermin_riwayat
  // (sudah diverifikasi & dicek ketat di Kotlin). Hanya build rilis ([StatusKeamanan.cerminNyata]); selain itu GalatKunci('tidak_tersedia').

  /// Daftar sesi: tepat satu dari [sejakJam] (1..48) / [sejakHari] (1..30); [cari] ≤40; [proyek] = id proyek.
  static Future<HasilKirim> cerminDaftar({int? sejakJam, int? sejakHari, String? cari, String? proyek}) async =>
      HasilKirim._(await _peta('cerminDaftar', {'sejakJam': sejakJam, 'sejakHari': sejakHari, 'cari': cari, 'proyek': proyek}));

  /// Ikuti satu sesi secara langsung ([sesi] = UUID) atau hanya pembaruan daftar ([sesi] null). Mac mengirim ≤10 mnt lalu berhenti:
  /// kirim ulang ≤8 mnt selama layar terbuka; maks 2 sesi per perangkat.
  static Future<HasilKirim> cerminBuka(String? sesi, {String? proyek, String? akun}) async =>
      HasilKirim._(await _peta('cerminBuka', {'sesi': sesi, 'proyek': proyek, 'akun': akun}));

  /// Berhenti mengikuti (layar ditutup).
  static Future<HasilKirim> cerminTutup() async => HasilKirim._(await _peta('cerminTutup'));

  /// Satu halaman riwayat ([batas] 1..50); [sebelum] = kursor dari `cermin_riwayat.sebelum` sebelumnya.
  static Future<HasilKirim> cerminRiwayat({
    required String sesi,
    required String proyek,
    required String akun,
    String? sebelum,
    int batas = 50,
  }) async =>
      HasilKirim._(await _peta('cerminRiwayat', {'sesi': sesi, 'proyek': proyek, 'akun': akun, 'sebelum': sebelum, 'batas': batas}));

  /// Riwayat sesi dari cache lokal (tanpa jaringan). null = belum ada / layar terkunci / cache rusak (dibuang).
  static Future<RiwayatLokal?> riwayatLokal(String sesi) async {
    final m = await _p<Map>('riwayatLokal', {'sesi': sesi});
    return m == null ? null : RiwayatLokal._(m);
  }

  /// Hapus semua riwayat lokal + kuncinya (Pengaturan). Otomatis juga saat dicabut / kode darurat / lepas perangkat.
  static Future<void> hapusRiwayatLokal() => _p<void>('hapusRiwayatLokal');

  /// Riwayat chat HP per proyek (terenkripsi di HP, ≤7 hari, ≤200 tugas; dihapus saat dicabut/lepas). Gagal → diam (null/no-op).
  static Future<void> simpanChat(String proyek, List<Map<String, Object?>> entri) => _p<void>('simpanChat', {'proyek': proyek, 'entri': entri});
  static Future<List<Map<String, Object?>>?> muatChat(String proyek) async {
    final l = await _p<List>('muatChat', {'proyek': proyek});
    return l?.whereType<Map>().map((m) => m.map((k, v) => MapEntry(k.toString(), v as Object?))).toList();
  }

  static Future<void> hapusChat(String proyek) => _p<void>('hapusChat', {'proyek': proyek});

  // ---- hanya build debug (layar uji); di profile & rilis melempar GalatKunci('tidak_tersedia') (SEC-86)
  static Future<Map> ujiBuatKunci() => _peta('ujiBuatKunci');
  static Future<Map> ujiTanda() => _peta('ujiTanda');
  static Future<Map> ujiKerjakan() => _peta('ujiKerjakan');
  static Future<Map> ujiSegelBuka() => _peta('ujiSegelBuka');
  static Future<void> ujiHapusKunci() => _p<void>('ujiHapusKunci');
}
