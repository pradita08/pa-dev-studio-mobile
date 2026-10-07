// Sumber data nyata: hanya lewat fasad `Kunci` (kontrak §6). Token, kunci, dan HTTP relay ada di Kotlin.
import '../kunci/kunci.dart';
import 'data.dart';

class SumberNyata extends SumberData {
  SumberNyata();

  bool _statusDiminta = false;

  @override
  Future<void> transportSegarkan() async {
    final halo = await Kunci.halo(aktif: true);
    macTersambung = halo.macTersambung;
    final t = halo.macTerakhir;
    if (t != null) macTerakhir = DateTime.fromMillisecondsSinceEpoch(t < 100000000000 ? t * 1000 : t);
    if (halo.perangkat == 'dicabut') dicabut = true;
    terapkanStatus(halo.status);
    for (final isi in await Kunci.ambilKabar()) {
      terapkanKabar(isi);
    }
    pesanTidakSah = await Kunci.jumlahPesanTidakSah();
    if (perangkat == null) await _muatPerangkat();
    // Status belum pernah diterima: minta sekali per sesi (hp/kirim dibatasi 6/mnt di relay).
    if (statusBelumAda && !_statusDiminta && macTersambung == true) {
      _statusDiminta = true;
      try {
        await Kunci.mintaStatus();
      } on GalatKunci catch (_) {}
    }
  }

  Future<void> _muatPerangkat() async {
    final k = await Kunci.statusKeamanan();
    final p = await Kunci.statusPasang();
    cerminTersedia = k.cerminNyata; // K-07: false di debug/profile → tab Sesi tidak memanggil cermin*
    perangkat = InfoPerangkat(
      namaMac: p?.namaMac ?? 'Mac',
      relay: p?.relay ?? '',
      versiApk: k.versiApk,
      android: k.android,
      fcmAktif: k.fcmAktif,
      biometrikKuat: k.biometrikKuat,
      strongBox: k.strongBox,
      idKRencana: p?.idKRencana,
      idKKerjakan: p?.idKKerjakan,
      idEHp: p?.idEHp,
    );
  }

  @override
  Future<void> mintaStatus() async {
    await Kunci.mintaStatus();
  }

  @override
  Future<String> transportKirim(Tugas t) async {
    if (t.mode == 'kerjakan') {
      // Kotlin menampilkan BiometricPrompt sendiri (proyek/akun/model/200 karakter pesan) — bukan layar Flutter (SEC-51).
      return (await Kunci.kirimKerjakan(tugas: t.tugas, proyek: t.proyek, akun: t.akun, pesan: t.pesan, baru: t.baru)).id;
    }
    return (await Kunci.kirimRencana(tugas: t.tugas, proyek: t.proyek, akun: t.akun, pesan: t.pesan, baru: t.baru)).id;
  }

  @override
  Future<void> transportHentikan(Tugas t) => Kunci.hentikan(t.tugas);

  @override
  Future<void> transportHapusSesi(String proyek, String akun) => Kunci.hapusSesi(proyek: proyek, akun: akun);

  @override
  Future<void> lepasPerangkat() => Kunci.lepasPerangkat();

  // ---- cermin sesi (KONTRAK-apk-v2 §6.3; jawaban lewat ambilKabar)
  @override
  Future<void> transportCerminDaftar({int? sejakJam, int? sejakHari, String? cari, String? proyek}) =>
      Kunci.cerminDaftar(sejakJam: sejakJam, sejakHari: sejakHari, cari: cari, proyek: proyek);

  @override
  Future<void> transportCerminBuka(String? sesi, {String? proyek, String? akun}) => Kunci.cerminBuka(sesi, proyek: proyek, akun: akun);

  @override
  Future<void> transportCerminTutup() => Kunci.cerminTutup();

  @override
  Future<void> transportCerminRiwayat({required String sesi, required String proyek, required String akun, String? sebelum, int batas = 50}) =>
      Kunci.cerminRiwayat(sesi: sesi, proyek: proyek, akun: akun, sebelum: sebelum, batas: batas);

  @override
  Future<void> transportSimpanChat(String proyek, List<Map<String, Object?>> entri) => Kunci.simpanChat(proyek, entri);

  @override
  Future<List<Map<String, Object?>>?> transportMuatChat(String proyek) => Kunci.muatChat(proyek);

  @override
  Future<void> transportHapusChat(String proyek) => Kunci.hapusChat(proyek);

  @override
  Future<(DateTime, List<Map<String, Object?>>)?> transportRiwayatLokal(String sesi) async {
    final r = await Kunci.riwayatLokal(sesi);
    return r == null ? null : (r.diperbarui, r.entri);
  }
}
