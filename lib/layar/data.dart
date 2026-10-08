// Lapisan data tampilan PADEV Studio.
// Mengubah isi kabar terverifikasi dari fasad `Kunci` (kontrak §2: status · kabar · tanda_terima · notif) menjadi model layar.
// Sumber nyata (sumber_nyata.dart) dan sumber pratinjau debug (pratinjau/contoh.dart) memakai pengurai yang SAMA di sini.
// Semua teks dari Mac/Claude diperlakukan sebagai teks biasa (Text), tidak pernah dirender sebagai markup. Tanpa log isi pesan.
import 'dart:async';
import 'dart:convert';
import 'dart:math';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

import '../kunci/kunci.dart';

// ---------------------------------------------------------------------------------------------------- model

enum StatusProyek { bekerja, menungguIzin, selesai, diam, gagal, tidakDiketahui }

class Divisi {
  const Divisi({this.namaMac, required this.peran, required this.status, this.ringkas, this.ke = 1});

  /// Nama yang dikirim Mac (opsional; Mac v2 tidak mengirim).
  final String? namaMac;
  final String peran;

  /// Urutan anggota berperan sama (1 = ketua, maks 3 = slot kantor 3D).
  final int ke;

  /// Nama dari Mac bila ada; Mac v2 hanya mengirim peran + ke → nama pegawai dari aset pegawai-nama.json (F2), lalu peran.
  String get nama => namaMac ?? NamaPegawai.cari(peran, ke) ?? _kapital(peranTampil);

  /// 'divisi-programmer' → 'programmer'.
  String get peranTampil => NamaPegawai.peranPendek(peran);
  static String _kapital(String t) => t.isEmpty ? 'Divisi' : t.length <= 3 ? t.toUpperCase() : t[0].toUpperCase() + t.substring(1);

  /// 'bekerja' | 'diam' | 'menunggu_izin'
  final String status;
  final String? ringkas;
}

class LimitAkun {
  const LimitAkun({required this.akun, required this.persen, this.reset});
  final String akun;
  final double persen;
  final String? reset;
}

class Proyek {
  const Proyek({
    required this.id,
    required this.nama,
    required this.akun,
    required this.hp,
    required this.sibuk,
    this.mode,
    this.mulai,
    this.batasMenit,
    this.terakhir,
    this.hasilTerakhir,
    this.ringkasTerakhir,
    this.divisi,
    this.utama = 'diam',
  });

  final String id, nama;

  /// Claude sesi utama proyek ini (Kepala di kantor 3D): 'bekerja' | 'menunggu_izin' | 'diam'.
  final String utama;
  final List<String> akun;

  /// 'rencana' | 'kerjakan' (izin HP dari konfigurasi laptop)
  final String hp;
  final bool sibuk;
  final String? mode;
  final DateTime? mulai;
  final int? batasMenit;
  final DateTime? terakhir;
  final String? hasilTerakhir, ringkasTerakhir;

  /// null = Mac belum mengirim field `divisi` (DESAIN §5) → bagian tim disembunyikan.
  final List<Divisi>? divisi;

  bool get bolehKerjakan => hp == 'kerjakan';

  StatusProyek get status {
    if ((divisi ?? const []).any((d) => d.status == 'menunggu_izin')) return StatusProyek.menungguIzin;
    if (sibuk) return StatusProyek.bekerja;
    switch (hasilTerakhir) {
      case 'selesai':
        return StatusProyek.selesai;
      case 'gagal':
      case 'batas_waktu':
        return StatusProyek.gagal;
    }
    return StatusProyek.diam;
  }
}

class LangkahAlat {
  const LangkahAlat(this.alat, this.ringkas);
  final String alat, ringkas;

  Map<String, Object?> keEntri() => {
        'alat': alat.length > 80 ? alat.substring(0, 80) : alat,
        'ringkas': ringkas.length > 300 ? ringkas.substring(0, 300) : ringkas,
      };
}

enum TahapTugas { mengirim, gagalKirim, menungguDiambil, diterima, bekerja, selesai, gagal, dihentikan, batasWaktu, ditolak, kedaluwarsa }

class Tugas {
  Tugas({
    required this.tugas,
    required this.proyek,
    required this.akun,
    required this.mode,
    required this.pesan,
    required this.baru,
    required this.dibuat,
  });

  final String tugas, proyek, akun, mode, pesan;
  final bool baru;
  final DateTime dibuat;
  String? perintahId;
  DateTime? kedaluwarsa;
  TahapTugas tahap = TahapTugas.mengirim;
  DateTime? mulai;
  int? batasMenit;
  final StringBuffer teks = StringBuffer();
  final List<LangkahAlat> alat = [];
  final List<LangkahAlat> ditolak = [];
  Duration? durasi;
  String? alasan;
  int urut = -1;

  bool get aktif =>
      tahap == TahapTugas.mengirim || tahap == TahapTugas.menungguDiambil || tahap == TahapTugas.diterima || tahap == TahapTugas.bekerja;

  /// Bentuk simpan riwayat chat (Kotlin RiwayatChat.cekEntri memeriksa kunci & batas yang sama).
  Map<String, Object?> keEntri() {
    final t = teks.toString();
    return {
      'id': tugas,
      'waktu': dibuat.millisecondsSinceEpoch,
      'akun': akun,
      'mode': mode,
      'pesan': pesan,
      'baru': baru,
      'tahap': tahap.name,
      'perintahId': ?perintahId,
      'kedaluwarsa': ?kedaluwarsa?.millisecondsSinceEpoch,
      'mulai': ?mulai?.millisecondsSinceEpoch,
      'batasMenit': ?batasMenit,
      'durasiMs': ?durasi?.inMilliseconds,
      'urut': urut,
      if (t.isNotEmpty) 'teks': t.length > 32000 ? t.substring(t.length - 32000) : t,
      'alasan': ?(alasan == null || alasan!.length <= 500 ? alasan : alasan!.substring(0, 500)),
      if (alat.isNotEmpty) 'alat': [for (final a in alat.skip(alat.length > 50 ? alat.length - 50 : 0)) a.keEntri()],
      if (ditolak.isNotEmpty) 'ditolak': [for (final a in ditolak.take(10)) a.keEntri()],
    };
  }

  /// Dari riwayat tersimpan; null bila bentuk tidak dikenal. Tugas yang terputus saat dikirim → gagal kirim (bisa dicoba lagi).
  static Tugas? dariEntri(String proyek, Map<String, Object?> e) {
    final id = e['id'], waktu = e['waktu'], akun = e['akun'], mode = e['mode'], pesan = e['pesan'];
    if (id is! String || waktu is! int || akun is! String || mode is! String || pesan is! String) return null;
    final tahap = TahapTugas.values.where((x) => x.name == e['tahap']).firstOrNull;
    if (tahap == null) return null;
    DateTime? jam(Object? v) => v is int ? DateTime.fromMillisecondsSinceEpoch(v) : null;
    final t = Tugas(tugas: id, proyek: proyek, akun: akun, mode: mode, pesan: pesan, baru: e['baru'] == true, dibuat: jam(waktu)!)
      ..perintahId = e['perintahId'] as String?
      ..kedaluwarsa = jam(e['kedaluwarsa'])
      ..mulai = jam(e['mulai'])
      ..batasMenit = e['batasMenit'] as int?
      ..alasan = e['alasan'] as String?
      ..urut = e['urut'] is int ? e['urut'] as int : -1
      ..tahap = tahap;
    if (e['durasiMs'] case final int ms) t.durasi = Duration(milliseconds: ms);
    if (e['teks'] case final String x) t.teks.write(x);
    LangkahAlat? langkah(Object? v) => v is Map && v['alat'] is String && v['ringkas'] is String ? LangkahAlat(v['alat'] as String, v['ringkas'] as String) : null;
    if (e['alat'] case final List l) t.alat.addAll(l.map(langkah).whereType<LangkahAlat>());
    if (e['ditolak'] case final List l) t.ditolak.addAll(l.map(langkah).whereType<LangkahAlat>());
    if (t.tahap == TahapTugas.mengirim) {
      t.tahap = TahapTugas.gagalKirim;
      t.alasan = 'Aplikasi ditutup saat mengirim. Coba lagi.';
    }
    return t;
  }
}

enum JenisKabar { selesai, divisi, izin, macTerputus }

class ButirKabar {
  ButirKabar({required this.jenis, required this.waktu, this.proyek, this.proyekId, this.n, this.durasiDtk});
  final JenisKabar jenis;
  final DateTime waktu;
  final String? proyek, proyekId;
  final int? n, durasiDtk;
  bool dibaca = false;
}

/// HP yang terhubung ke Mac (dari `status.perangkat`; maks [SumberData.maksPerangkat]). [ini] = HP ini sendiri.
class PerangkatTerhubung {
  const PerangkatTerhubung({required this.nama, required this.kerjakan, this.dipasang, this.ini = false});
  final String nama;
  final bool kerjakan, ini;
  final DateTime? dipasang;
}

class InfoPerangkat {
  const InfoPerangkat({
    required this.namaMac,
    required this.relay,
    required this.versiApk,
    required this.android,
    required this.fcmAktif,
    required this.biometrikKuat,
    this.idKRencana,
    this.idKKerjakan,
    this.idEHp,
    this.strongBox = false,
  });
  final String namaMac, relay, versiApk;
  final int android;
  final bool fcmAktif, biometrikKuat, strongBox;
  final String? idKRencana, idKKerjakan, idEHp;
}

/// Keadaan khusus L08 yang bisa dipaksakan dari pita pratinjau (demo: debug & profile).
enum KeadaanKhusus { normal, macPutus, tanpaInternet, memuat, pembaruanWajib, kosong }

// ---------------------------------------------------------------------------------------------------- model cermin sesi (v2 F1)
// KONTRAK-apk-v2 §2.2: cermin_sesi (daftar) · cermin (kejadian langsung) · cermin_riwayat (halaman riwayat).

enum StatusSesi { bekerja, menungguIzin, diam, selesai }

/// Nama pegawai kantor (peran → nama) dari aset `assets/pegawai-nama.json` bila ada (dibuat `buat-kantor-apk.js`, F2);
/// tanpa aset → hanya peran yang tampil.
abstract final class NamaPegawai {
  static Map<String, String> _peta = const {};
  static bool _dimuat = false;

  static Future<void> muat() async {
    if (_dimuat) return;
    _dimuat = true;
    try {
      final j = jsonDecode(await rootBundle.loadString('assets/pegawai-nama.json'));
      final orang = j is Map ? j['orang'] : null;
      if (orang is Map) {
        _peta = {
          for (final e in orang.entries)
            if (e.value is Map && (e.value as Map)['nama'] is String) e.key.toString(): (e.value as Map)['nama'] as String,
        };
      }
    } catch (_) {
      _peta = const {}; // aset belum ada → tampil peran
    }
  }

  @visibleForTesting
  static void atur(Map<String, String> peta) {
    _peta = peta;
    _dimuat = true;
  }

  /// 'divisi-programmer'/'programmer' → 'programmer'.
  static String peranPendek(String peran) => peran.startsWith('divisi-') ? peran.substring(7) : peran;

  /// [ke] = urutan divisi berperan sama di satu sesi (1 = ketua).
  static String? cari(String peran, [int ke = 1]) {
    final p = peranPendek(peran);
    return _peta['div:$p#$ke'] ?? _peta['$p#$ke'];
  }

  /// "Bima (programmer)" · "QA" bila nama tidak diketahui.
  static String label(String peran, [int ke = 1]) {
    final p = peranPendek(peran);
    final tampil = p.length <= 3 ? p.toUpperCase() : p;
    final n = cari(peran, ke);
    return n == null ? (tampil.isEmpty ? 'Divisi' : tampil) : '$n ($tampil)';
  }
}

class DivisiSesi {
  const DivisiSesi({required this.peran, required this.status, this.ke = 1});
  final String peran, status;
  final int ke;
  String get label => NamaPegawai.label(peran, ke);
}

class SesiCermin {
  SesiCermin({
    required this.sesi,
    required this.akun,
    required this.proyek,
    required this.judul,
    required this.asal,
    required this.status,
    required this.terbuka,
    required this.tingkat,
    this.mulai,
    this.terakhir,
    this.divisi = const [],
    this.alat,
    this.bisaLanjut = 'tidak',
    this.keputusanN = 0,
  });

  final String sesi, akun, proyek, judul;

  /// 'vscode' | 'cli' | 'pelaksana' | 'hp' | 'lain'
  final String asal;
  StatusSesi status;
  bool terbuka;
  final DateTime? mulai;
  DateTime? terakhir;
  final List<DivisiSesi> divisi;
  LangkahAlat? alat;

  /// 'sama' | 'cabang' | 'tidak' (F3) · jumlah keputusan menunggu (F1b).
  final String bisaLanjut;
  final int keputusanN;

  /// 'ringkas' (bawaan) | 'isi' (proyek dicentang owner di laptop).
  final String tingkat;
  bool get isi => tingkat == 'isi';
}

enum PeranEntri { owner, claude, alat, divisi, izin, sistem, celah }

class EntriSesi {
  const EntriSesi({
    required this.id,
    required this.peran,
    this.waktu,
    this.teks,
    this.alat,
    this.ringkas,
    this.divisi,
    this.langsung = false,
    this.gagal = false,
  });
  final String id;
  final PeranEntri peran;
  final DateTime? waktu;
  final String? teks, alat, ringkas, divisi;

  /// Dari kabar `cermin` (langsung), bukan halaman riwayat.
  final bool langsung;
  final bool gagal;
}

class RiwayatSesi {
  final List<EntriSesi> entri = [];
  String? sebelum;
  bool lagi = false;

  /// 'format_tidak_dikenal' | 'sesi_bukan_milik_proyek' | 'tidak_tersedia' (dari Mac) atau kode GalatKunci saat mengirim.
  String? galat;
  bool memuat = false;
  DateTime? diminta;

  /// Permintaan yang sedang berjalan memakai kursor `sebelum` (halaman lebih lama).
  bool mintaLebihLama = false;
  bool halamanDiterima = false;

  /// Isi sementara dari cache terenkripsi HP (K-06) sebelum halaman baru tiba.
  bool dariLokal = false;
  DateTime? lokalDiperbarui;

  bool get lambat => memuat && diminta != null && DateTime.now().difference(diminta!) > const Duration(seconds: 30);
}

// ---------------------------------------------------------------------------------------------------- sumber data

/// Satu kelas sumber data untuk semua layar. Turunan hanya mengganti "transport" (fasad Kunci atau data contoh).
abstract class SumberData extends ChangeNotifier {
  SumberData();

  /// true hanya untuk sumber pratinjau (demo: debug & profile); dipakai untuk pita "PRATINJAU · data contoh".
  bool get pratinjau => false;

  // ---- keadaan yang dibaca layar
  bool memuatAwal = true;
  bool? macTersambung;
  DateTime? macTerakhir;
  bool tanpaInternet = false;
  bool pembaruanWajib = false;
  bool statusBelumAda = false;
  DateTime? terakhirSegar;
  int pesanTidakSah = 0;
  bool dicabut = false;
  InfoPerangkat? perangkat;
  List<Proyek> proyek = const [];

  /// id → nama untuk SEMUA proyek terdaftar di status (termasuk `hp:false`); dipakai tab Sesi.
  Map<String, String> namaProyekSemua = const {};
  String namaProyek(String id) => namaProyekSemua[id] ?? cariProyek(id)?.nama ?? id;
  List<LimitAkun>? limit;

  /// HP yang terhubung ke Mac (null = Mac belum mengirim field ini / pelaksana lama).
  List<PerangkatTerhubung>? perangkatTerhubung;
  int maksPerangkat = 2;

  /// Kejadian kantor terbaru dari Mac (`status.kantor`, F2b) untuk kantor 3D = office.html: bentuk normalize() server.js TANPA
  /// isi (tanpa detail/teks/path; sesi di-hash). null = Mac belum mengirim field ini (pelaksana lama).
  List<Map<String, Object?>>? kantor;
  String? versiMac;
  final List<ButirKabar> kabar = [];
  final Map<String, List<Tugas>> _chat = {};
  final Map<String, bool> _baruBerikutnya = {};

  List<Tugas> chat(String proyekId) => _chat[proyekId] ?? const [];
  int get belumDibaca => kabar.where((k) => !k.dibaca).length;
  bool get adaTugasAktif => _chat.values.any((l) => l.any((t) => t.aktif));
  Proyek? cariProyek(String id) => proyek.where((p) => p.id == id).firstOrNull;
  Tugas? tugasAktif(String proyekId) => chat(proyekId).where((t) => t.aktif).lastOrNull;

  /// Percakapan baru: perintah berikutnya ke proyek ini dikirim dengan `baru:true`.
  bool baruBerikutnya(String proyekId) => _baruBerikutnya[proyekId] ?? false;

  // ---- transport (diisi turunan)
  @protected
  Future<void> transportSegarkan();
  /// Mengirim perintah; mengembalikan id perintah (dirujuk `tanda_terima.perintah_id`).
  @protected
  Future<String> transportKirim(Tugas t);
  @protected
  Future<void> transportHentikan(Tugas t);
  @protected
  Future<void> transportHapusSesi(String proyek, String akun);
  Future<void> lepasPerangkat();
  Future<void> mintaStatus();

  // transport cermin (v2 F1). Bawaan: tidak tersedia (turunan yang tidak mendukung cermin).
  @protected
  Future<void> transportCerminDaftar({int? sejakJam, int? sejakHari, String? cari, String? proyek}) async =>
      throw const GalatKunci('tidak_tersedia');
  @protected
  Future<void> transportCerminBuka(String? sesi, {String? proyek, String? akun}) async => throw const GalatKunci('tidak_tersedia');
  @protected
  Future<void> transportCerminTutup() async => throw const GalatKunci('tidak_tersedia');
  @protected
  Future<void> transportCerminRiwayat({required String sesi, required String proyek, required String akun, String? sebelum, int batas = 50}) async =>
      throw const GalatKunci('tidak_tersedia');

  /// (diperbarui, entri) dari cache lokal, atau null.
  @protected
  Future<(DateTime, List<Map<String, Object?>>)?> transportRiwayatLokal(String sesi) async => null;

  // riwayat chat HP tersimpan (per proyek). Bawaan: tidak disimpan (pratinjau & uji).
  @protected
  Future<void> transportSimpanChat(String proyek, List<Map<String, Object?>> entri) async {}
  @protected
  Future<List<Map<String, Object?>>?> transportMuatChat(String proyek) async => null;
  @protected
  Future<void> transportHapusChat(String proyek) async {}

  // ---- riwayat chat tersimpan: dimuat sekali per proyek, disimpan utuh (≤200 tugas terbaru) 1 dtk setelah berubah
  final Set<String> _chatDimuat = {};
  final Set<String> _chatBerubah = {};
  Timer? _jamSimpanChat;

  /// Muat riwayat chat tersimpan [proyekId] (sekali). Tugas yang sudah ada di memori (id sama) tidak ditimpa.
  Future<void> muatChat(String proyekId) async {
    if (!_chatDimuat.add(proyekId)) return;
    List<Map<String, Object?>>? entri;
    try {
      entri = await transportMuatChat(proyekId);
    } catch (_) {
      entri = null; // layar terkunci / cache rusak → riwayat kosong, aplikasi tetap jalan
    }
    if (entri == null || entri.isEmpty || _dibuang) return;
    final l = _chat[proyekId] ??= [];
    final ada = {for (final t in l) t.tugas};
    final lama = [for (final e in entri) ?Tugas.dariEntri(proyekId, e)].where((t) => !ada.contains(t.tugas));
    l
      ..insertAll(0, lama)
      ..sort((a, b) => a.dibuat.compareTo(b.dibuat));
    beritahu();
  }

  void _tandaiChat(String proyekId) {
    _chatBerubah.add(proyekId);
    _jamSimpanChat ??= Timer(const Duration(seconds: 1), simpanChatSekarang);
  }

  /// Tulis riwayat yang berubah sekarang (juga dipanggil saat aplikasi ke latar).
  Future<void> simpanChatSekarang() async {
    _jamSimpanChat?.cancel();
    _jamSimpanChat = null;
    final daftar = _chatBerubah.toList();
    _chatBerubah.clear();
    for (final p in daftar) {
      final l = _chat[p] ?? const <Tugas>[];
      try {
        await transportSimpanChat(p, [for (final t in l.skip(l.length > 200 ? l.length - 200 : 0)) t.keEntri()]);
      } catch (_) {
        // layar terkunci / argumen ditolak: riwayat tetap di memori, dicoba lagi saat berubah berikutnya
      }
    }
  }

  // ---- siklus hidup & polling
  Timer? _jam;
  bool _jalan = false;
  bool _sedangSegar = false;
  bool _dibuang = false;

  void mulai() {
    if (_jalan) return;
    _jalan = true;
    segarkan(diam: true);
    _jadwalkan();
  }

  void berhenti() {
    if (_chatBerubah.isNotEmpty) unawaited(simpanChatSekarang()); // aplikasi ke latar: riwayat chat langsung ditulis
    _jalan = false;
    _jam?.cancel();
    _jam = null;
  }

  /// 3 dtk saat ada tugas aktif, sesi sedang diikuti, atau jawaban cermin ditunggu.
  bool get _butuhCepat => adaTugasAktif || _diikuti != null || _antreDaftar.isNotEmpty || _riwayat.values.any((r) => r.memuat);

  bool _kantorTerlihat = false;

  /// Tab Kantor (3D) sedang terlihat → status ditarik tiap 4 dtk agar kantor bergerak mengikuti laptop (Mac mengirim status
  /// segera saat tim/Kepala berubah).
  set kantorTerlihat(bool v) {
    if (v == _kantorTerlihat) return;
    _kantorTerlihat = v;
    if (v && _jalan) _jadwalkan();
  }

  /// Polling hemat (batas relay HP 60/mnt): 3 dtk saat ada tugas aktif, 4 dtk saat tab Kantor terlihat, 15 dtk saat diam.
  void _jadwalkan() {
    _jam?.cancel();
    if (!_jalan) return;
    final jeda = _butuhCepat ? const Duration(seconds: 3) : _kantorTerlihat ? const Duration(seconds: 4) : const Duration(seconds: 15);
    _jam = Timer(jeda, () async {
      await segarkan(diam: true);
      _jadwalkan();
    });
  }

  Future<void> segarkan({bool diam = false}) async {
    if (_sedangSegar) return;
    _sedangSegar = true;
    try {
      await transportSegarkan();
      tanpaInternet = false;
      terakhirSegar = DateTime.now();
    } on GalatKunci catch (e) {
      tanganiGalat(e);
      if (!diam && e.kode != 'jaringan' && e.kode != 'versi_usang') rethrow;
    } finally {
      _sedangSegar = false;
      memuatAwal = false;
      _periksaKedaluwarsa();
      beritahu();
    }
  }

  @protected
  void tanganiGalat(GalatKunci e) {
    if (e.kode == 'jaringan') tanpaInternet = true;
    if (e.kode == 'versi_usang') pembaruanWajib = true;
    if (e.kode == 'mac_tidak_tersambung') macTersambung = false;
  }

  @protected
  void beritahu() {
    if (!_dibuang) notifyListeners();
  }

  @override
  void dispose() {
    _dibuang = true;
    _jamIkuti?.cancel();
    berhenti();
    super.dispose();
  }

  // ---- perintah dari layar

  static final _acak = Random.secure();
  // Format sama dengan server.js/pelaksana (POLA_TUGAS): t-<waktu base36>-<16 heksa>. Publik hanya untuk uji (QA-8).
  @visibleForTesting
  static String idTugas() =>
      't-${DateTime.now().millisecondsSinceEpoch.toRadixString(36)}-${List.generate(16, (_) => _acak.nextInt(16).toRadixString(16)).join()}';

  /// Rencana: langsung. Kerjakan: Kotlin menampilkan BiometricPrompt sendiri (SEC-51) di dalam transportKirim.
  /// Melempar GalatKunci (mis. 'dibatalkan') agar layar bisa memberi tahu pengguna.
  Future<Tugas> kirim({required String proyekId, required String akun, required String mode, required String pesan}) async {
    final t = Tugas(
      tugas: idTugas(),
      proyek: proyekId,
      akun: akun,
      mode: mode,
      pesan: pesan,
      baru: baruBerikutnya(proyekId),
      dibuat: DateTime.now(),
    );
    (_chat[proyekId] ??= []).add(t);
    _tandaiChat(proyekId);
    beritahu();
    await _kirimTugas(t);
    return t;
  }

  Future<void> kirimUlang(Tugas t) async {
    t.tahap = TahapTugas.mengirim;
    t.alasan = null;
    beritahu();
    await _kirimTugas(t);
  }

  Future<void> _kirimTugas(Tugas t) async {
    try {
      t.perintahId = await transportKirim(t);
      t.kedaluwarsa = DateTime.now().add(t.mode == 'kerjakan' ? const Duration(minutes: 3) : const Duration(minutes: 10));
      t.tahap = TahapTugas.menungguDiambil;
      _baruBerikutnya.remove(t.proyek);
      _jadwalkan();
    } on GalatKunci catch (e) {
      tanganiGalat(e);
      if (e.kode == 'dibatalkan') {
        _chat[t.proyek]?.remove(t);
      } else {
        t.tahap = TahapTugas.gagalKirim;
        t.alasan = e.pesan;
      }
      rethrow;
    } finally {
      _tandaiChat(t.proyek);
      beritahu();
    }
  }

  Future<void> hentikan(Tugas t) async {
    try {
      await transportHentikan(t);
    } on GalatKunci catch (e) {
      tanganiGalat(e);
      rethrow;
    } finally {
      beritahu();
    }
  }

  /// Untuk sumber pratinjau: menaruh tugas contoh ke riwayat chat.
  @protected
  Tugas tambahTugas(Tugas t) {
    (_chat[t.proyek] ??= []).add(t);
    return t;
  }

  void percakapanBaru(String proyekId) {
    _baruBerikutnya[proyekId] = true;
    beritahu();
  }

  Future<void> hapusRiwayat(String proyekId, String akun) async {
    await transportHapusSesi(proyekId, akun);
    _chat[proyekId]?.removeWhere((t) => !t.aktif);
    _baruBerikutnya[proyekId] = true;
    _tandaiChat(proyekId);
    beritahu();
  }

  void tandaiDibaca(ButirKabar k) {
    k.dibaca = true;
    beritahu();
  }

  void tandaiSemuaDibaca() {
    for (final k in kabar) {
      k.dibaca = true;
    }
    beritahu();
  }

  void _periksaKedaluwarsa() {
    final kini = DateTime.now();
    // Perintah cermin hangus 10 mnt (§2.1): jawaban tak akan datang lagi.
    _antreDaftar.removeWhere((e) => kini.difference(e.$2) > const Duration(minutes: 10));
    for (final r in _riwayat.values) {
      if (r.memuat && r.diminta != null && kini.difference(r.diminta!) > const Duration(minutes: 10)) {
        r.memuat = false;
        r.galat ??= 'tidak_dijawab';
      }
    }
    for (final l in _chat.values) {
      for (final t in l) {
        if (t.tahap == TahapTugas.menungguDiambil && t.kedaluwarsa != null && kini.isAfter(t.kedaluwarsa!)) {
          t.tahap = TahapTugas.kedaluwarsa;
          _tandaiChat(t.proyek);
        }
      }
    }
  }

  // ---- pengurai isi (kontrak §2)

  /// Isi `status` terverifikasi (`{jenis:'status', status:{proyek:[…], versi, limit?}, …}`).
  @protected
  void terapkanStatus(Map<String, Object?>? isi) {
    final st = _peta(isi?['status']);
    if (st == null) {
      statusBelumAda = true;
      return;
    }
    statusBelumAda = false;
    versiMac = st['versi']?.toString();
    final daftar = <Proyek>[];
    final nama = <String, String>{};
    for (final p in _daftar(st['proyek'])) {
      final m = _peta(p);
      if (m == null) continue;
      final id = _teks(m['id']);
      if (id == null || id.isEmpty) continue;
      nama[id] = _teks(m['nama']) ?? id;
      // v2: proyek `hp:false` ikut dikirim hanya agar tab Sesi tahu namanya — tidak tampil di Proyek/Chat/Kantor
      // (perintah ke proyek itu pasti ditolak Mac/Kotlin `proyek_tidak_diizinkan`).
      if (m['hp'] == false || m['hp'] == 'false') continue;
      final ter = m['terakhir'];
      final terPeta = _peta(ter);
      daftar.add(Proyek(
        id: id,
        nama: _teks(m['nama']) ?? id,
        akun: _daftar(m['akun']).map((e) => e.toString()).toList(),
        hp: _teks(m['hp']) ?? 'rencana',
        sibuk: m['sibuk'] == true,
        mode: _teks(m['mode']),
        mulai: _waktu(m['mulai']),
        batasMenit: _angka(m['batasMenit'])?.toInt(),
        terakhir: terPeta != null ? _waktu(terPeta['waktu'] ?? terPeta['selesai']) : _waktu(ter),
        hasilTerakhir: terPeta != null ? _teks(terPeta['hasil']) : null,
        ringkasTerakhir: terPeta != null ? _teks(terPeta['ringkas']) : null,
        divisi: m.containsKey('divisi') ? _divisi(m['divisi']) : null,
        utama: switch (_teks(m['utama'])) { final u? when u == 'bekerja' || u == 'menunggu_izin' => u, _ => 'diam' },
      ));
    }
    proyek = daftar;
    // riwayat chat tersimpan dimuat begitu proyek dikenal (sebelum kabar tugas lama diproses — kanal Kunci berurutan)
    for (final p in daftar) {
      if (!_chatDimuat.contains(p.id)) unawaited(muatChat(p.id));
    }
    namaProyekSemua = nama;
    kantor = st.containsKey('kantor') ? kejadianKantor(st['kantor']) : null;
    perangkatTerhubung = st.containsKey('perangkat')
        ? [
            for (final e in _daftar(st['perangkat']).take(4))
              if (_peta(e) case final m?)
                PerangkatTerhubung(
                  nama: _teks(m['nama']) ?? 'HP',
                  kerjakan: m['mode'] == 'rencana+kerjakan',
                  dipasang: _waktu(m['dipasang']),
                  ini: m['ini'] == true,
                ),
          ]
        : null;
    maksPerangkat = _angka(st['maksPerangkat'])?.toInt().clamp(1, 10) ?? 2;
    final lim = st['limit'];
    if (lim == null) {
      limit = null;
    } else {
      final butir = lim is List ? lim : [lim];
      limit = [
        for (final b in butir)
          if (_peta(b) case final m?)
            if (_angka(m['persen5j']) case final p?) LimitAkun(akun: _teks(m['akun']) ?? '', persen: p.toDouble(), reset: _jamReset(m['reset5j'])),
      ];
    }
  }

  static const _kindKantor = {'session', 'session_end', 'prompt', 'tool', 'tool_done', 'tool_fail', 'agent_start', 'agent_stop', 'stop', 'notify'};

  /// Saring `status.kantor`: hanya field & tipe yang dikenal (≤60 kejadian), panjang teks dibatasi.
  @visibleForTesting
  static List<Map<String, Object?>> kejadianKantor(Object? v) {
    String? t(Object? x, int n) => x is String && x.isNotEmpty && x.length <= n ? x : null;
    final hasil = <Map<String, Object?>>[];
    for (final e in v is List ? v.take(60) : const []) {
      if (e is! Map || e['ts'] is! num || !_kindKantor.contains(e['kind'])) continue;
      hasil.add({
        'ts': (e['ts'] as num).toInt(),
        'kind': e['kind'],
        'session': ?t(e['session'], 64),
        'who': ?t(e['who'], 80),
        'agentId': ?t(e['agentId'], 64),
        'tool': ?t(e['tool'], 120),
        'sub': ?t(e['sub'], 80),
        'type': ?t(e['type'], 40),
        'proyek': ?t(e['proyek'], 40),
      });
    }
    return hasil;
  }

  List<Divisi> _divisi(Object? v) => [
        for (final d in _daftar(v))
          if (_peta(d) case final m?)
            Divisi(
              namaMac: _teks(m['nama']),
              peran: _teks(m['peran']) ?? '',
              status: _teks(m['status']) ?? 'diam',
              ringkas: _teks(m['ringkas']),
              ke: switch (_angka(m['ke'])?.toInt()) { final k? when k >= 1 && k <= 3 => k, _ => 1 },
            ),
      ];

  /// Satu isi kabar dari `Kunci.ambilKabar()` (sudah diverifikasi Kotlin).
  @protected
  void terapkanKabar(Map<String, Object?> isi) {
    switch (isi['jenis']) {
      case 'status':
        terapkanStatus(isi);
      case 'tanda_terima':
        _tandaTerima(_peta(isi['tanda_terima']));
      case 'kabar':
        _kabarChat(_peta(isi['kabar']));
      case 'notif':
        _notif(_peta(isi['notif']), _waktu(isi['dibuat']) ?? DateTime.now());
      case 'cermin_sesi':
        _cerminSesi(_peta(isi['cermin_sesi']));
      case 'cermin':
        _cermin(_peta(isi['cermin']));
      case 'cermin_riwayat':
        _cerminRiwayat(_peta(isi['cermin_riwayat']));
    }
  }

  Tugas? _cariTugas({String? perintahId, String? tugas}) {
    for (final l in _chat.values) {
      for (final t in l) {
        if (perintahId != null && t.perintahId == perintahId) return t;
        if (tugas != null && t.tugas == tugas) return t;
      }
    }
    return null;
  }

  void _tandaTerima(Map<String, Object?>? m) {
    if (m == null) return;
    final t = _cariTugas(perintahId: _teks(m['perintah_id']));
    if (t == null) return;
    _tandaiChat(t.proyek);
    final alasan = _teks(m['alasan']);
    switch (m['hasil']) {
      case 'diterima':
        if (t.tahap == TahapTugas.menungguDiambil) t.tahap = TahapTugas.diterima;
      case 'mulai':
        t.tahap = TahapTugas.bekerja;
        t.mulai ??= DateTime.now();
      case 'ditolak' when alasan == 'tugas_ulang':
        _tugasUlang(t, _teks(m['hasil_terakhir']));
      case 'ditolak':
        t.tahap = TahapTugas.ditolak;
        t.alasan = alasan;
      case 'selesai':
        t.tahap = TahapTugas.selesai;
      case 'gagal':
        t.tahap = TahapTugas.gagal;
        t.alasan ??= alasan;
      case 'dihentikan':
        t.tahap = TahapTugas.dihentikan;
      case 'batas_waktu':
        t.tahap = TahapTugas.batasWaktu;
    }
  }

  /// KONTRAK §9 K1 (SEC-87): `tugas` ini sudah pernah diterima Mac (mis. "Coba lagi" setelah galat jaringan padahal
  /// kiriman pertama sampai). Bukan galat: tahap diambil dari `hasil_terakhir`; tugas tidak dijalankan ulang di Mac.
  void _tugasUlang(Tugas t, String? hasilTerakhir) {
    switch (hasilTerakhir) {
      case 'mulai':
        t.tahap = TahapTugas.bekerja;
        t.mulai ??= DateTime.now();
      case 'selesai':
        t.tahap = TahapTugas.selesai;
      case 'gagal':
        t.tahap = TahapTugas.gagal;
      case 'dihentikan':
        t.tahap = TahapTugas.dihentikan;
      case 'batas_waktu':
        t.tahap = TahapTugas.batasWaktu;
      case 'ditolak':
        t.tahap = TahapTugas.ditolak;
      default: // 'diterima', kosong, atau nilai tak dikenal: Mac sudah menerima tugas ini
        if (!t.aktif || t.tahap == TahapTugas.menungguDiambil) t.tahap = TahapTugas.diterima;
    }
  }

  /// Event chat (docs/sdlc/chat-perintah.md §4.3) di dalam kabar Mac→HP.
  void _kabarChat(Map<String, Object?>? m) {
    if (m == null) return;
    final t = _cariTugas(perintahId: _teks(m['perintah_id']), tugas: _teks(m['tugas']));
    if (t == null) return;
    final urut = _angka(m['urut'])?.toInt() ?? 0;
    if (urut <= t.urut) return; // buang urut lama
    t.urut = urut;
    _tandaiChat(t.proyek);
    switch (m['tahap']) {
      case 'mulai':
        t.tahap = TahapTugas.bekerja;
        t.mulai ??= DateTime.now();
      case 'teks':
        if (t.tahap != TahapTugas.bekerja) t.tahap = TahapTugas.bekerja;
        t.teks.write(_teks(m['teks']) ?? '');
      case 'alat':
        t.alat.add(LangkahAlat(_teks(m['alat']) ?? 'Alat', _teks(m['ringkas']) ?? ''));
      case 'selesai':
        t.tahap = TahapTugas.selesai;
        final akhir = _teks(m['teks']);
        if (akhir != null && akhir.isNotEmpty) {
          t.teks
            ..clear()
            ..write(akhir);
        }
        final ms = _angka(m['durasiMs']);
        if (ms != null) t.durasi = Duration(milliseconds: ms.toInt());
        t.ditolak
          ..clear()
          ..addAll([
            for (final d in _daftar(m['ditolak']).take(10))
              if (_peta(d) case final x?) LangkahAlat(_teks(x['alat']) ?? 'Alat', _teks(x['ringkas']) ?? ''),
          ]);
      case 'gagal':
        t.tahap = TahapTugas.gagal;
        t.alasan = _teks(m['alasan']);
      case 'dihentikan':
        t.tahap = TahapTugas.dihentikan;
      case 'batas_waktu':
        t.tahap = TahapTugas.batasWaktu;
        t.batasMenit = _angka(m['menit'])?.toInt() ?? t.batasMenit;
    }
  }

  void _notif(Map<String, Object?>? m, DateTime waktu) {
    if (m == null) return;
    final jenis = switch (m['j']) {
      'selesai' => JenisKabar.selesai,
      'divisi' => JenisKabar.divisi,
      'izin' => JenisKabar.izin,
      'mac_terputus' => JenisKabar.macTerputus,
      _ => null,
    };
    if (jenis == null) return;
    kabar.insert(
      0,
      ButirKabar(
        jenis: jenis,
        waktu: waktu,
        proyek: _teks(m['proyek']),
        proyekId: _teks(m['proyekId']),
        n: _angka(m['n'])?.toInt(),
        durasiDtk: _angka(m['durasiDtk'])?.toInt(),
      ),
    );
    if (kabar.length > 200) kabar.removeRange(200, kabar.length);
  }

  // ---- cermin sesi (KONTRAK-apk-v2 §2.1–2.2, §6.2 L11/L11b). Perintah bertanda K_rencana; jawaban lewat ambilKabar.
  // Hemat (K-04): daftar otomatis maks 1×/2 mnt saat tab Sesi dibuka; buka langsung hanya selama detail terbuka & aplikasi
  // aktif (kirim ulang 7,5 mnt); tutup saat keluar/latar; anggaran lokal ±30 perintah cermin per jam (sama dengan relay/Mac).

  /// null = belum diketahui · false = build non-rilis (K-07) atau tidak didukung · true = cermin nyata / data contoh.
  bool? cerminTersedia;

  List<SesiCermin> daftarSesi = const [];
  bool daftarSesiDiterima = false;
  DateTime? daftarSesiDiperbarui;

  /// Hasil "Cari sesi lama"; null = belum pernah mencari.
  List<SesiCermin>? hasilCari;

  /// Kode galat terakhir saat meminta daftar 48 jam (untuk spanduk "Coba lagi").
  String? galatDaftar;

  /// Kode galat terakhir pembaruan langsung sesi yang diikuti.
  String? galatLangsung;

  final List<(String, DateTime)> _antreDaftar = [];
  final Map<String, RiwayatSesi> _riwayat = {};
  final List<DateTime> _kirimCermin = [];
  int? _urutCermin;
  String? _diikuti;
  SesiCermin? _sesiDiikuti;
  bool _bukaTerkirim = false;
  Timer? _jamIkuti;
  DateTime? _mintaDaftarTerakhir;

  static const anggaranCerminPerJam = 30;
  static const kirimUlangBuka = Duration(minutes: 7, seconds: 30);

  bool get memuatDaftarSesi => _antreDaftar.any((e) => e.$1 == 'jam');
  bool get memuatCari => _antreDaftar.any((e) => e.$1 == 'cari');

  /// Permintaan daftar sudah >30 dtk tanpa jawaban (Mac mati / pelaksana lama).
  bool get daftarLambat =>
      _antreDaftar.any((e) => e.$1 == 'jam' && DateTime.now().difference(e.$2) > const Duration(seconds: 30));
  bool get cariLambat =>
      _antreDaftar.any((e) => e.$1 == 'cari' && DateTime.now().difference(e.$2) > const Duration(seconds: 30));

  /// Sedang menerima pembaruan langsung untuk [sesi].
  bool langsung(String sesi) => _diikuti == sesi && _bukaTerkirim;

  RiwayatSesi riwayatSesi(String sesi) => _riwayat[sesi] ??= RiwayatSesi();

  SesiCermin? cariSesi(String sesi) =>
      daftarSesi.where((x) => x.sesi == sesi).firstOrNull ?? hasilCari?.where((x) => x.sesi == sesi).firstOrNull;

  /// Sisa anggaran perintah cermin satu jam terakhir.
  int get sisaAnggaranCermin {
    final batas = DateTime.now().subtract(const Duration(hours: 1));
    _kirimCermin.removeWhere((t) => t.isBefore(batas));
    return anggaranCerminPerJam - _kirimCermin.length;
  }

  /// Perintah otomatis menyisakan 4 untuk tindakan owner (tarik-segarkan, cari, muat lebih lama).
  void _cekAnggaran({required bool otomatis}) {
    if (sisaAnggaranCermin <= (otomatis ? 4 : 0)) throw const GalatKunci('batas_laju');
  }

  void _catatKirim() {
    _kirimCermin.add(DateTime.now());
    _jadwalkan();
  }

  /// Daftar sesi 48 jam. [otomatis] = dipanggil saat tab Sesi dibuka (tidak melempar; dibatasi 1×/2 mnt).
  Future<void> mintaDaftarSesi({bool otomatis = false}) async {
    if (cerminTersedia != true) {
      if (otomatis) return;
      throw const GalatKunci('tidak_tersedia');
    }
    if (otomatis) {
      if (memuatDaftarSesi) return;
      final t = _mintaDaftarTerakhir;
      if (t != null && DateTime.now().difference(t) < const Duration(minutes: 2)) return;
    }
    await _kirimDaftar('jam', () => transportCerminDaftar(sejakJam: 48), otomatis: otomatis);
  }

  /// "Cari sesi lama": [hari] 1..30, [cari] ≤40 karakter (judul).
  Future<void> cariSesiLama({required int hari, String? cari}) async {
    if (cerminTersedia != true) throw const GalatKunci('tidak_tersedia');
    final q = cari?.trim();
    await _kirimDaftar(
      'cari',
      () => transportCerminDaftar(sejakHari: hari.clamp(1, 30), cari: (q == null || q.isEmpty) ? null : (q.length > 40 ? q.substring(0, 40) : q)),
    );
  }

  Future<void> _kirimDaftar(String jenis, Future<void> Function() kirim, {bool otomatis = false}) async {
    final butir = (jenis, DateTime.now());
    try {
      _cekAnggaran(otomatis: otomatis);
      if (jenis == 'jam') {
        _mintaDaftarTerakhir = butir.$2;
        galatDaftar = null;
      }
      _antreDaftar.add(butir);
      beritahu();
      await kirim();
      _catatKirim();
    } on GalatKunci catch (e) {
      _antreDaftar.remove(butir);
      tanganiGalat(e);
      if (jenis == 'jam') galatDaftar = e.kode;
      if (!otomatis) rethrow;
    } finally {
      beritahu();
    }
  }

  /// Riwayat dari cache terenkripsi HP (tanpa jaringan) — ditampilkan sambil menunggu halaman baru.
  Future<void> muatRiwayatLokal(String sesi) async {
    final r = riwayatSesi(sesi);
    if (r.halamanDiterima || r.entri.isNotEmpty) return;
    try {
      final l = await transportRiwayatLokal(sesi);
      if (l == null || r.halamanDiterima) return;
      _gabungEntri(r, [for (final e in l.$2) ?_entri(e)]);
      r.dariLokal = r.entri.isNotEmpty;
      r.lokalDiperbarui = l.$1;
    } on GalatKunci catch (_) {
      // cache tidak terbaca (layar terkunci / rusak) → abaikan
    } finally {
      beritahu();
    }
  }

  /// Satu halaman riwayat (50 entri). [lebihLama] memakai kursor `sebelum` halaman terakhir.
  Future<void> muatRiwayat(SesiCermin x, {bool lebihLama = false}) async {
    if (cerminTersedia != true) return;
    final r = riwayatSesi(x.sesi);
    if (r.memuat) return;
    final kursor = lebihLama ? r.sebelum : null;
    if (lebihLama && (kursor == null || !r.lagi)) return;
    try {
      _cekAnggaran(otomatis: false);
      r
        ..memuat = true
        ..diminta = DateTime.now()
        ..mintaLebihLama = kursor != null
        ..galat = null;
      beritahu();
      await transportCerminRiwayat(sesi: x.sesi, proyek: x.proyek, akun: x.akun, sebelum: kursor, batas: 50);
      _catatKirim();
    } on GalatKunci catch (e) {
      r
        ..memuat = false
        ..galat = e.kode;
      tanganiGalat(e);
      rethrow;
    } finally {
      beritahu();
    }
  }

  /// Mulai mengikuti sesi (detail terbuka & aplikasi aktif). Sesi yang sudah selesai & tertutup tidak dibuka langsung.
  Future<void> ikutiSesi(SesiCermin x) async {
    if (cerminTersedia != true) return;
    _jamIkuti?.cancel();
    _diikuti = x.sesi;
    _sesiDiikuti = x;
    galatLangsung = null;
    if (x.status == StatusSesi.selesai && !x.terbuka) {
      beritahu();
      return;
    }
    await _bukaLangsung();
  }

  Future<void> _bukaLangsung() async {
    final x = _sesiDiikuti;
    if (x == null || _dibuang) return;
    try {
      _cekAnggaran(otomatis: true);
      await transportCerminBuka(x.sesi, proyek: x.proyek, akun: x.akun);
      _catatKirim();
      if (_diikuti != x.sesi) {
        // owner sudah keluar saat perintah buka masih dikirim
        try {
          await transportCerminTutup();
          _catatKirim();
        } on GalatKunci catch (_) {}
        return;
      }
      _bukaTerkirim = true;
      galatLangsung = null;
      _jamIkuti?.cancel();
      _jamIkuti = Timer(kirimUlangBuka, () {
        if (_diikuti == x.sesi) _bukaLangsung();
      });
    } on GalatKunci catch (e) {
      tanganiGalat(e);
      if (_diikuti == x.sesi) {
        _bukaTerkirim = false;
        galatLangsung = e.kode;
      }
    } finally {
      beritahu();
    }
  }

  /// Coba lagi pembaruan langsung (dari spanduk).
  Future<void> bukaLangsungLagi() async {
    if (_sesiDiikuti == null) return;
    galatLangsung = null;
    beritahu();
    await _bukaLangsung();
  }

  /// Berhenti mengikuti (keluar dari detail / aplikasi ke latar). `cermin_tutup` hanya bila `cermin_buka` sempat terkirim.
  Future<void> berhentiIkuti() async {
    _jamIkuti?.cancel();
    _jamIkuti = null;
    final kirim = _bukaTerkirim;
    _diikuti = null;
    _sesiDiikuti = null;
    _bukaTerkirim = false;
    galatLangsung = null;
    if (kirim) {
      try {
        await transportCerminTutup();
        _kirimCermin.add(DateTime.now());
      } on GalatKunci catch (_) {
        // Mac tetap berhenti sendiri ≤10 mnt / bila perangkat tidak aktif ≥2 mnt (K-04)
      }
    }
    beritahu();
  }

  // ---- pengurai cermin

  SesiCermin? _sesiDari(Map<String, Object?> m) {
    final id = _teks(m['sesi']);
    final proyekId = _teks(m['proyek']);
    if (id == null || id.isEmpty || proyekId == null) return null;
    final ke = <String, int>{};
    final divisi = <DivisiSesi>[];
    for (final d in _daftar(m['divisi']).take(10)) {
      final x = _peta(d);
      if (x == null) continue;
      final peran = _teks(x['peran']) ?? '';
      final n = ke[NamaPegawai.peranPendek(peran)] = (ke[NamaPegawai.peranPendek(peran)] ?? 0) + 1;
      divisi.add(DivisiSesi(peran: peran, status: _teks(x['status']) ?? 'diam', ke: n));
    }
    final alat = _peta(m['alat']);
    return SesiCermin(
      sesi: id,
      akun: _teks(m['akun']) ?? '',
      proyek: proyekId,
      judul: _teks(m['judul']) ?? '',
      asal: _teks(m['asal']) ?? 'lain',
      status: _statusSesi(m['status']),
      terbuka: m['terbuka'] == true,
      mulai: _waktu(m['mulai']),
      terakhir: _waktu(m['terakhir']),
      divisi: divisi,
      alat: alat == null ? null : LangkahAlat(_teks(alat['alat']) ?? 'Alat', _teks(alat['ringkas']) ?? ''),
      bisaLanjut: _teks(m['bisaLanjut']) ?? 'tidak',
      keputusanN: _angka(m['keputusan_n'])?.toInt() ?? 0,
      tingkat: _teks(m['tingkat']) == 'isi' ? 'isi' : 'ringkas',
    );
  }

  static StatusSesi _statusSesi(Object? v) => switch (v) {
        'bekerja' => StatusSesi.bekerja,
        'menunggu_izin' => StatusSesi.menungguIzin,
        'selesai' => StatusSesi.selesai,
        _ => StatusSesi.diam,
      };

  void _cerminSesi(Map<String, Object?>? m) {
    if (m == null) return;
    final daftar = [
      for (final b in _daftar(m['sesi']).take(50))
        if (_peta(b) case final x?) ?_sesiDari(x),
    ]..sort((a, b) => (b.terakhir ?? DateTime(0)).compareTo(a.terakhir ?? DateTime(0)));
    // Jawaban dicocokkan dengan permintaan tertua yang belum terjawab (kabar tidak membawa salinan kueri).
    final jenis = _antreDaftar.isEmpty ? 'jam' : _antreDaftar.removeAt(0).$1;
    if (jenis == 'cari') {
      hasilCari = daftar;
      return;
    }
    daftarSesi = daftar;
    daftarSesiDiterima = true;
    daftarSesiDiperbarui = DateTime.now();
    galatDaftar = null;
  }

  EntriSesi? _entri(Map<String, Object?> m, {bool langsung = false}) {
    final peran = switch (m['peran']) {
      'owner' => PeranEntri.owner,
      'claude' => PeranEntri.claude,
      'alat' => PeranEntri.alat,
      'divisi' => PeranEntri.divisi,
      'izin' => PeranEntri.izin,
      'sistem' => PeranEntri.sistem,
      _ => null,
    };
    final id = _teks(m['id']);
    if (peran == null || id == null) return null;
    final teks = _teks(m['teks']);
    return EntriSesi(
      id: id,
      peran: peran,
      waktu: _waktu(m['waktu']),
      teks: (teks == null || teks.isEmpty) ? null : teks,
      alat: _teks(m['alat']),
      ringkas: _teks(m['ringkas']),
      divisi: _teks(m['divisi']),
      langsung: langsung,
    );
  }

  /// Gabung per id (yang baru menimpa), urut naik per waktu; entri tanpa waktu (penanda celah) tetap di posisinya.
  void _gabungEntri(RiwayatSesi r, List<EntriSesi> baru, {bool halaman = false}) {
    if (halaman && baru.isNotEmpty) {
      // Kejadian langsung yang sudah tercakup halaman riwayat dibuang (riwayat Mac lebih lengkap).
      final akhir = baru.map((e) => e.waktu).whereType<DateTime>().fold<DateTime?>(null, (a, b) => a == null || b.isAfter(a) ? b : a);
      if (akhir != null) r.entri.removeWhere((e) => e.langsung && e.waktu != null && !e.waktu!.isAfter(akhir));
    }
    for (final e in baru) {
      final i = r.entri.indexWhere((x) => x.id == e.id);
      if (i >= 0) {
        r.entri[i] = e;
      } else {
        r.entri.add(e);
      }
    }
    _urutkan(r.entri);
  }

  static void _urutkan(List<EntriSesi> l) {
    // urut stabil: penanda celah (tanpa waktu) memakai waktu entri sebelumnya
    final kunci = <EntriSesi, int>{};
    var akhir = 0;
    for (final e in l) {
      akhir = e.waktu?.millisecondsSinceEpoch ?? akhir;
      kunci[e] = akhir;
    }
    final idx = {for (var i = 0; i < l.length; i++) l[i]: i};
    l.sort((a, b) {
      final c = kunci[a]!.compareTo(kunci[b]!);
      return c != 0 ? c : idx[a]!.compareTo(idx[b]!);
    });
  }

  void _cerminRiwayat(Map<String, Object?>? m) {
    if (m == null) return;
    final id = _teks(m['sesi']);
    if (id == null) return;
    final r = riwayatSesi(id);
    r
      ..memuat = false
      ..diminta = null;
    final galat = _teks(m['galat']);
    if (galat != null) {
      r.galat = galat;
      return;
    }
    r.galat = null;
    _gabungEntri(r, [for (final e in _daftar(m['entri']).take(50)) if (_peta(e) case final x?) ?_entri(x)], halaman: true);
    // Kursor hanya maju ke halaman yang lebih lama (halaman pertama yang diminta ulang tidak menimpa kursor lama).
    if (!r.halamanDiterima || r.mintaLebihLama) {
      r.sebelum = _teks(m['sebelum']);
      r.lagi = m['lagi'] == true && r.sebelum != null;
    }
    r
      ..halamanDiterima = true
      ..mintaLebihLama = false
      ..dariLokal = false;
  }

  /// Kejadian langsung (`normalize()` server.js). Celah `urut_cermin` → penanda "ada bagian yang hilang".
  void _cermin(Map<String, Object?>? m) {
    if (m == null) return;
    final urut = _angka(m['urut_cermin'])?.toInt();
    if (urut == null) return;
    final akhir = _urutCermin;
    if (akhir != null && urut <= akhir) return; // ganda / lama
    _urutCermin = urut;
    final evs = [for (final e in _daftar(m['ev']).take(60)) ?_peta(e)];
    if (akhir != null && urut > akhir + 1) {
      final kena = {?_diikuti, for (final e in evs) ?_teks(e['sesi'])};
      for (final sesi in kena) {
        final r = riwayatSesi(sesi);
        r.entri.add(EntriSesi(id: 'celah-$urut', peran: PeranEntri.celah, langsung: true));
      }
    }
    var i = 0;
    for (final e in evs) {
      final sesi = _teks(e['sesi']);
      if (sesi == null) continue;
      final ts = _waktu(e['ts']);
      final kind = _teks(e['kind']);
      final x = cariSesi(sesi);
      if (x != null) {
        if (ts != null) x.terakhir = ts;
        switch (kind) {
          case 'prompt' || 'tool' || 'agent_start':
            x.status = StatusSesi.bekerja;
          case 'stop' when e['agentId'] == null:
            x.status = StatusSesi.diam;
          case 'session_end':
            x
              ..status = StatusSesi.selesai
              ..terbuka = false;
        }
        final alat = kind == 'tool' ? _teks(e['tool']) : null;
        if (alat != null) x.alat = LangkahAlat(alat, _teks(e['detail']) ?? '');
      }
      final entri = _entriDariEv(e, kind, ts, 'l-$urut-${i++}');
      if (entri != null) riwayatSesi(sesi).entri.add(entri);
    }
  }

  EntriSesi? _entriDariEv(Map<String, Object?> e, String? kind, DateTime? ts, String id) {
    String? t(String k) {
      final v = _teks(e[k]);
      return (v == null || v.isEmpty) ? null : v;
    }

    final tool = t('tool');
    return switch (kind) {
      'prompt' => EntriSesi(id: id, peran: PeranEntri.owner, waktu: ts, teks: t('text'), langsung: true),
      'stop' when e['agentId'] == null => EntriSesi(id: id, peran: PeranEntri.claude, waktu: ts, teks: t('text'), langsung: true),
      'tool' when tool == 'Agent' || tool == 'Task' =>
        EntriSesi(id: id, peran: PeranEntri.divisi, waktu: ts, divisi: t('sub') ?? 'general-purpose', ringkas: t('detail'), alat: 'mulai', langsung: true),
      'tool' => EntriSesi(id: id, peran: PeranEntri.alat, waktu: ts, alat: tool ?? 'Alat', ringkas: t('detail'), langsung: true),
      'tool_fail' => EntriSesi(id: id, peran: PeranEntri.alat, waktu: ts, alat: tool ?? 'Alat', ringkas: 'gagal', gagal: true, langsung: true),
      'agent_stop' => EntriSesi(id: id, peran: PeranEntri.divisi, waktu: ts, divisi: t('who') ?? 'divisi', alat: 'selesai', langsung: true),
      'notify' => EntriSesi(id: id, peran: PeranEntri.izin, waktu: ts, ringkas: t('text'), langsung: true),
      'session_end' => EntriSesi(id: id, peran: PeranEntri.sistem, waktu: ts, teks: 'Sesi ditutup', langsung: true),
      _ => null,
    };
  }

  // ---- pembantu tipe (isi kabar bentuk bebas → baca defensif)
  static Map<String, Object?>? _peta(Object? v) => v is Map ? v.cast<String, Object?>() : null;
  static List<Object?> _daftar(Object? v) => v is List ? v : const [];
  static String? _teks(Object? v) => v?.toString();
  static num? _angka(Object? v) => v is num ? v : (v is String ? num.tryParse(v) : null);

  /// ms epoch (atau detik epoch) → DateTime lokal.
  static DateTime? _waktu(Object? v) {
    final n = _angka(v);
    if (n == null || n <= 0) return null;
    final ms = n < 100000000000 ? n * 1000 : n;
    return DateTime.fromMillisecondsSinceEpoch(ms.toInt());
  }

  static String? _jamReset(Object? v) {
    final w = _waktu(v);
    if (w != null) return jamMenit(w);
    return v?.toString();
  }
}

// ---------------------------------------------------------------------------------------------------- format waktu (tanpa intl)

/// 'akun2' → 'Akun 2'; id lain ditampilkan apa adanya.
String namaAkun(String id) {
  final m = RegExp(r'^akun[ _-]?(\d+)$', caseSensitive: false).firstMatch(id);
  return m == null ? id : 'Akun ${m.group(1)}';
}

/// Pesan untuk kode galat cermin (kode Mac di `cermin_riwayat.galat` + kode lokal) — selebihnya pesan GalatKunci.
String pesanCermin(String kode, {bool riwayat = false}) => switch (kode) {
      'tidak_tersedia' when riwayat => 'Riwayat sesi ini sudah tidak ada di Mac (dihapus Claude Code setelah 30 hari).',
      'tidak_tersedia' => 'Tab Sesi aktif di APK rilis.',
      'format_tidak_dikenal' => 'Format riwayat sesi ini belum dikenali pelaksana di Mac. Perbarui pelaksana.',
      'sesi_bukan_milik_proyek' => 'Sesi ini tidak berada di folder proyek yang terdaftar di Mac.',
      'batas_laju' => 'Terlalu banyak permintaan sesi dalam satu jam. Coba lagi beberapa menit lagi.',
      'tidak_dijawab' => 'Mac tidak menjawab dalam 10 menit.',
      'dibatalkan' => 'Dibatalkan. Buka kunci untuk memuat sesi.',
      _ => GalatKunci(kode).pesan,
    };

String duaDigit(int n) => n.toString().padLeft(2, '0');

/// "21.40" (gaya Indonesia).
String jamMenit(DateTime w) => '${duaDigit(w.hour)}.${duaDigit(w.minute)}';

/// "baru saja" · "4 mnt" · "2 jam" · "kemarin" · "3 Okt".
String waktuRelatif(DateTime? w, {DateTime? kini}) {
  if (w == null) return '';
  final k = kini ?? DateTime.now();
  final d = k.difference(w);
  if (d.inSeconds < 45) return 'baru saja';
  if (d.inMinutes < 60) return '${max(1, d.inMinutes)} mnt';
  final hariIni = DateTime(k.year, k.month, k.day);
  if (!w.isBefore(hariIni)) return '${d.inHours} jam';
  if (!w.isBefore(hariIni.subtract(const Duration(days: 1)))) return 'kemarin';
  return tanggalPendek(w);
}

const _bulan = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
String tanggalPendek(DateTime w) => '${w.day} ${_bulan[w.month - 1]}';

/// "1:42" / "1:02:05".
String lamaJalan(Duration d) {
  final j = d.inHours, m = d.inMinutes % 60, s = d.inSeconds % 60;
  return j > 0 ? '$j:${duaDigit(m)}:${duaDigit(s)}' : '$m:${duaDigit(s)}';
}

/// "2 mnt 10 dtk" / "48 dtk".
String durasiBaca(Duration d) {
  final m = d.inMinutes, s = d.inSeconds % 60;
  if (m == 0) return '$s dtk';
  if (m >= 60) return '${d.inHours} jam ${m % 60} mnt';
  return '$m mnt ${duaDigit(s)} dtk';
}
