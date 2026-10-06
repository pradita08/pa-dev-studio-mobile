#!/usr/bin/env node
// Pembuat vektor uji bersama PADEV-E2E-v1 → apk/kontrak/vektor-e2e.json (kontrak §2 "Vektor uji")
// + apk/kontrak/vektor-rusak.json (REV-21: amplop rusak tambahan `[{label, amplop, galat, keterangan, periksa}]`; kunci & konteks = vektor-e2e.json)
// + apk/kontrak/vektor-cermin.json (APK v2 F1, KONTRAK-apk-v2 §2.1–2.2: perintah cermin_* & kabar cermin_sesi/cermin/cermin_riwayat sah + rusak).
// Semua kunci di sini KUNCI UJI (diturunkan dari label publik, "hanya_uji": true) — tidak pernah dipakai di Mac/HP sungguhan.
// Deterministik: kunci, id, waktu, kunci efemeral HPKE (ikm_e) → enc/ct/H/info sama setiap dijalankan. Tanda ECDSA acak (k acak), jadi
// tanda lama dari berkas yang ada DIPAKAI ULANG bila input tandanya sama dan tandanya masih sah → berkas stabil antar-jalan.
// Pakai: node apk/kontrak/buat-vektor.js            (tulis ulang vektor-e2e.json + vektor-rusak.json)
//        node apk/kontrak/buat-vektor.js --cek      (hanya bandingkan; keluar 1 bila salah satu berkas usang)
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const R = require('../../_app_padev_studio_3d/pelaksana-relay.js');
const U = R._uji;

const BERKAS = path.join(__dirname, 'vektor-e2e.json');
const BERKAS_RUSAK = path.join(__dirname, 'vektor-rusak.json');
const BERKAS_CERMIN = path.join(__dirname, 'vektor-cermin.json');
const T0 = 1791000000000;                 // "sekarang" tetap untuk semua vektor (ms epoch, 2026-10-03)
const MENIT = 60 * 1000;
const turunan = label => crypto.createHash('sha256').update('PADEV-VEKTOR-UJI-v1|' + label).digest();
const heksDari = (label, n) => turunan(label).toString('hex').slice(0, n);

// keluar.rusak ← isi vektor-rusak.json, keluar.cermin ← isi vektor-cermin.json (berkas terpisah agar vektor-e2e.json tidak berubah)
function susun(lama, lamaRusak = null, keluar = {}, lamaCermin = null) {
  // tanda dari berkas lama: input_tanda (b64u) → tanda (b64u)
  const cacheTanda = new Map();
  (function kumpul(o) {
    if (Array.isArray(o)) return o.forEach(kumpul);
    if (o && typeof o === 'object') {
      if (o.antara?.input_tanda && o.amplop?.tanda) cacheTanda.set(o.antara.input_tanda, o.amplop.tanda);
      Object.values(o).forEach(kumpul);
    }
  })([lama, lamaCermin]);
  for (const r of Array.isArray(lamaRusak) ? lamaRusak : []) {
    try {
      const a = r.amplop;
      cacheTanda.set(R.b64u(U.inputTanda(Buffer.from(R.jcs(U.headerDari(a))), Buffer.from(a.enc, 'base64url'), Buffer.from(a.ct, 'base64url'))), a.tanda);
    } catch { /* amplop rusak bentuk: tanda tidak di-cache */ }
  }

  /* ---------- kunci uji ---------- */
  const kunciTanda = label => {
    const d = turunan('kunci|' + label);
    const privat = U.kunciTandaDariD(d);
    const spki = U.spkiTanda(privat);
    return { privat, d, spki, id: R.idKunci(spki) };
  };
  const kunciSandi = label => {
    const raw = turunan('kunci|' + label);
    const privat = U.x25519Privat(raw);
    const pub = U.rawSandiPublik(crypto.createPublicKey(privat));
    return { privat, raw, pub, id: R.idKunci(pub) };
  };
  const K = {
    k_rencana: kunciTanda('k_rencana'), k_kerjakan: kunciTanda('k_kerjakan'), s_mac: kunciTanda('s_mac'), k_asing: kunciTanda('k_asing'),
    e_hp: kunciSandi('e_hp'), e_mac: kunciSandi('e_mac'), e_asing: kunciSandi('e_asing'),
  };
  const PERAN = { k_rencana: 'HP — K_rencana (Keystore)', k_kerjakan: 'HP — K_kerjakan (Keystore, sidik jari)', s_mac: 'Mac — S_mac',
    k_asing: 'kunci tanda TIDAK terdaftar (uji dari_tidak_dikenal)', e_hp: 'HP — E_hp (keyset Tink)', e_mac: 'Mac — E_mac',
    e_asing: 'kunci sandi Mac LAIN (uji ke_salah)' };
  const kunciKeluar = {};
  for (const [n, k] of Object.entries(K)) {
    kunciKeluar[n] = k.spki
      ? { hanya_uji: true, peran: PERAN[n], jenis: 'ECDSA P-256', d: R.b64u(k.d),
        pkcs8: R.b64u(k.privat.export({ format: 'der', type: 'pkcs8' })), spki: R.b64u(k.spki), id: k.id }
      : { hanya_uji: true, peran: PERAN[n], jenis: 'X25519', privat_raw: R.b64u(k.raw),
        pkcs8: R.b64u(k.privat.export({ format: 'der', type: 'pkcs8' })), publik_raw: R.b64u(k.pub), id: k.id };
  }

  const mac_id = heksDari('mac_id', 16), perangkat_id = heksDari('perangkat_id', 16);
  const dikenalMac = {
    [K.k_rencana.id]: { publik: R.b64u(K.k_rencana.spki), peran: 'k_rencana', perangkat_id },
    [K.k_kerjakan.id]: { publik: R.b64u(K.k_kerjakan.spki), peran: 'k_kerjakan', perangkat_id },
  };
  const dikenalHp = { [K.s_mac.id]: { publik: R.b64u(K.s_mac.spki), peran: 's_mac' } };

  /* ---------- penyusun amplop ---------- */
  function amplop(label, { jenis_kotak, tanda, ke, isi, kedaluwarsa, id }) {
    const ikmE = turunan('ikm_e|' + label);
    const { amplop: a, antara } = U.susunAmplop({ jenis_kotak, kunciTanda: K[tanda].privat, ePenerima: K[ke].pub, isi, kedaluwarsa, id }, ikmE);
    const t = cacheTanda.get(antara.input_tanda);
    if (t && crypto.verify('sha256', Buffer.from(antara.input_tanda, 'base64url'), { key: crypto.createPublicKey(K[tanda].privat), dsaEncoding: 'der' },
      Buffer.from(t, 'base64url'))) a.tanda = t;
    const kp = U.hpkeKonteksPengirim(K[ke].pub, Buffer.from(antara.info, 'utf8'), ikmE);
    const ks = kp.konteks.rahasia;
    return {
      amplop: a,
      antara: { ...antara, hpke: { ikm_e: R.b64u(ikmE), sk_e: R.b64u(U.deriveKeyPair(ikmE)), enc: R.b64u(kp.enc),
        shared_secret: R.b64u(kp.sharedSecret), key: R.b64u(ks.key), base_nonce: R.b64u(ks.baseNonce) } },
    };
  }
  const dibuat = T0 - 5000;
  const isiPerintah = (label, o) => ({ mac_id, perangkat_id, id: heksDari('id|' + label, 32), urut: o.urut, dibuat: o.dibuat ?? dibuat,
    kedaluwarsa: (o.dibuat ?? dibuat) + o.masa, jenis: o.jenis, ...o.tambahan });
  function perintah(label, { tanda = 'k_rencana', ke = 'e_mac', ubahIsi, idHeader, ...o }) {
    const isi = isiPerintah(label, o);
    const id = idHeader ?? isi.id;
    if (ubahIsi) ubahIsi(isi);
    return { label, ...amplop(label, { jenis_kotak: 'perintah', tanda, ke, isi, kedaluwarsa: isi.kedaluwarsa, id }) };
  }
  function kabar(label, { tanda = 's_mac', ke = 'e_hp', urut_mac, jenis, tambahan, masa = 60 * MENIT }) {
    const isi = { mac_id, perangkat_id, urut_mac, dibuat, jenis, ...tambahan };
    return { label, ...amplop(label, { jenis_kotak: 'kabar', tanda, ke, isi, kedaluwarsa: dibuat + masa, id: heksDari('id|' + label, 32) }) };
  }
  const PERIKSA_MAC = { jenisKotak: 'perintah', penerima: 'mac', sekarang: T0 };
  const PERIKSA_HP = { jenisKotak: 'kabar', penerima: 'hp', sekarang: T0 };

  /* ---------- sah ---------- */
  const jalankan = (mode, pesan) => ({ tugas: 'tgs-' + mode, proyek: 'proyek-uji', akun: 'akun-uji', mode, pesan, baru: true, model: 'opus' });
  const pRencana = perintah('perintah_rencana', { urut: 1, masa: 10 * MENIT, jenis: 'jalankan',
    tambahan: jalankan('rencana', 'Rencanakan perbaikan form — "kutip", baris\nbaru, tab\t, é, 日本, emoji 🙂') });
  const pKerjakan = perintah('perintah_kerjakan', { tanda: 'k_kerjakan', urut: 2, masa: 3 * MENIT, jenis: 'jalankan',
    tambahan: jalankan('kerjakan', 'Kerjakan rencana tadi') });
  const pHentikan = perintah('perintah_hentikan', { urut: 3, masa: 30 * MENIT, jenis: 'hentikan', tambahan: { tugas: 'tgs-rencana' } });
  const sahPerintah = [
    { ...pRencana, periksa: PERIKSA_MAC, hasil: { ok: true, peran: 'k_rencana', jenis: 'jalankan', hash: R.hashAmplop(pRencana.amplop) } },
    { ...pKerjakan, periksa: PERIKSA_MAC, hasil: { ok: true, peran: 'k_kerjakan', jenis: 'jalankan', hash: R.hashAmplop(pKerjakan.amplop) } },
    { ...pHentikan, periksa: PERIKSA_MAC, hasil: { ok: true, peran: 'k_rencana', jenis: 'hentikan', hash: R.hashAmplop(pHentikan.amplop) } },
  ];
  const kTerima = kabar('kabar_tanda_terima', { urut_mac: 1, jenis: 'tanda_terima',
    tambahan: { tanda_terima: { perintah_id: pRencana.amplop.id, perintah_sha256: R.hashAmplop(pRencana.amplop), hasil: 'diterima' } } });
  const kNotif = kabar('kabar_notif', { urut_mac: 2, jenis: 'notif', tambahan: { notif: { j: 'selesai', proyek: 'SIMPEG', n: 3, durasiDtk: 95 } } });
  const kStatus = kabar('kabar_status', { urut_mac: 3, jenis: 'status', tambahan: { status: { proyek: [{ id: 'p1', nama: 'SIMPEG', akun: ['akun-uji'],
    hp: 'rencana', sibuk: false, batasMenit: 30 }], versi: '1.0.0' } } });
  const sahKabar = [kTerima, kNotif, kStatus].map(k => ({ ...k, periksa: PERIKSA_HP,
    hasil: { ok: true, peran: 's_mac', jenis: JSON.parse(k.antara.plaintext).jenis } }));

  /* ---------- rusak (berlabel alasan) ---------- */
  const salin = o => JSON.parse(JSON.stringify(o));
  const ubahByte = (s, i) => { const b = Buffer.from(s, 'base64url'); b[i] ^= 0x01; return R.b64u(b); };
  const rusak = [];
  const tambahRusak = (label, alasan, ket, a, periksa = PERIKSA_MAC, lain = {}) => rusak.push({ label, alasan, keterangan: ket, amplop: a, periksa, ...lain });
  const ar = pRencana.amplop;
  tambahRusak('tanpa_tanda', 'bentuk', 'tanda "" (Sekar §6 #1)', { ...salin(ar), tanda: '' });
  tambahRusak('tanda_salah', 'tanda_salah', 'tanda sah milik amplop lain (sama-sama K_rencana) (§6 #1)', { ...salin(ar), tanda: pHentikan.amplop.tanda });
  tambahRusak('header_diubah', 'tanda_salah', 'kedaluwarsa header +1 ms tanpa tanda ulang (§6 #2)', { ...salin(ar), kedaluwarsa: ar.kedaluwarsa + 1 });
  tambahRusak('ke_diubah', 'ke_salah', '`ke` header diganti ke ID kunci yang tidak dipegang penerima (§6 #2)', { ...salin(ar), ke: K.e_asing.id });
  tambahRusak('ke_diubah_saat_rotasi', 'tanda_salah', '`ke` diganti ke kunci sandi lain yang JUGA dipegang penerima (masa rotasi) → tanda gagal (§6 #2)',
    { ...salin(ar), ke: K.e_asing.id }, { ...PERIKSA_MAC, kunciSandiTambahan: ['e_asing'] });
  tambahRusak('ct_diubah', 'tanda_salah', '1 bit ct dibalik (§6 #2)', { ...salin(ar), ct: ubahByte(ar.ct, 5) });
  tambahRusak('enc_diubah', 'tanda_salah', '1 bit enc dibalik (§6 #2)', { ...salin(ar), enc: ubahByte(ar.enc, 0) });
  tambahRusak('field_tambahan', 'bentuk', 'header 10 field ("alg") (§6 #6)', { ...salin(ar), alg: 'ES256' });
  tambahRusak('field_kurang', 'bentuk', 'header 8 field (tanpa enc)', (() => { const x = salin(ar); delete x.enc; return x; })());
  tambahRusak('v2', 'versi', 'v = 2 (§6 #6)', { ...salin(ar), v: 2 });
  tambahRusak('v0', 'versi', 'v = 0 (§6 #6)', { ...salin(ar), v: 0 });
  tambahRusak('jenis_kotak_salah', 'jenis_kotak', 'amplop kabar sah diserahkan ke pemeriksa perintah Mac', salin(kTerima.amplop));
  const pAsing = perintah('rusak_dari_asing', { tanda: 'k_asing', urut: 4, masa: 10 * MENIT, jenis: 'minta_status' });
  tambahRusak('kid_dari_tidak_dikenal', 'dari_tidak_dikenal', 'ditandatangani kunci tidak terdaftar, `dari` = ID-nya (§6 #1)', pAsing.amplop, PERIKSA_MAC, { antara: pAsing.antara });
  const pKeAsing = perintah('rusak_ke_asing', { ke: 'e_asing', urut: 4, masa: 10 * MENIT, jenis: 'minta_status' });
  tambahRusak('kid_ke_salah', 'ke_salah', 'dienkripsi ke E Mac lain (`ke` bukan kunci saya)', pKeAsing.amplop, PERIKSA_MAC, { antara: pKeAsing.antara });
  const pKedaluwarsa = perintah('rusak_kedaluwarsa', { urut: 4, masa: 10 * MENIT, dibuat: T0 - 20 * MENIT, jenis: 'jalankan', tambahan: jalankan('rencana', 'x') });
  tambahRusak('kedaluwarsa', 'kedaluwarsa', 'sah tapi sekarang > kedaluwarsa (rencana ditahan 20 mnt; §6 #5)', pKedaluwarsa.amplop, PERIKSA_MAC, { antara: pKedaluwarsa.antara });
  const pMasa = perintah('rusak_masa_panjang', { tanda: 'k_kerjakan', urut: 4, masa: 4 * MENIT, jenis: 'jalankan', tambahan: jalankan('kerjakan', 'x') });
  tambahRusak('masa_terlalu_panjang', 'masa_terlalu_panjang', 'kerjakan dengan masa berlaku 4 mnt (> 3 mnt)', pMasa.amplop, PERIKSA_MAC, { antara: pMasa.antara });
  const pDepan = perintah('rusak_dibuat_depan', { urut: 4, masa: 10 * MENIT, dibuat: T0 + 5 * MENIT, jenis: 'minta_status' });
  tambahRusak('dibuat_masa_depan', 'dibuat_masa_depan', '`dibuat` 5 mnt di depan jam Mac (§6 #4)', pDepan.amplop, PERIKSA_MAC, { antara: pDepan.antara });
  const pKerjakanRencana = perintah('rusak_kerjakan_k_rencana', { tanda: 'k_rencana', urut: 4, masa: 3 * MENIT, jenis: 'jalankan', tambahan: jalankan('kerjakan', 'x') });
  tambahRusak('kerjakan_bertanda_k_rencana', 'kerjakan_tanpa_k_kerjakan', 'mode kerjakan ditandatangani K_rencana (§6 #7)', pKerjakanRencana.amplop, PERIKSA_MAC, { antara: pKerjakanRencana.antara });
  const pMacLain = perintah('rusak_mac_lain', { urut: 4, masa: 10 * MENIT, jenis: 'minta_status', ubahIsi: i => { i.mac_id = heksDari('mac_lain', 16); } });
  tambahRusak('mac_id_lain', 'isi_tidak_cocok', 'plaintext untuk Mac lain (mac_id beda) (§6 #2)', pMacLain.amplop, PERIKSA_MAC, { antara: pMacLain.antara });
  const pIdBeda = perintah('rusak_id_beda', { urut: 4, masa: 10 * MENIT, jenis: 'minta_status', idHeader: heksDari('id|lain', 32) });
  tambahRusak('id_isi_beda_header', 'isi_tidak_cocok', 'id di plaintext ≠ id header', pIdBeda.amplop, PERIKSA_MAC, { antara: pIdBeda.antara });
  const pAsingIsi = perintah('rusak_isi_asing', { urut: 4, masa: 10 * MENIT, jenis: 'minta_status', tambahan: { jalur: '/etc' } });
  tambahRusak('isi_field_asing', 'isi_bentuk', 'plaintext memuat field tak dikenal', pAsingIsi.amplop, PERIKSA_MAC, { antara: pAsingIsi.antara });
  tambahRusak('replay_id', 'replay_id', 'amplop perintah_hentikan sah, tetapi id-nya sudah pernah terlihat (§6 #3)', salin(pHentikan.amplop),
    { ...PERIKSA_MAC, penyimpan_awal: { urut_terakhir: 0, id_terlihat: [pHentikan.amplop.id] } });
  tambahRusak('urut_lama', 'urut_lama', 'amplop perintah_hentikan sah (urut 3), urut tersimpan = 3 (§6 #4)', salin(pHentikan.amplop),
    { ...PERIKSA_MAC, penyimpan_awal: { urut_terakhir: 3, id_terlihat: [] } });
  // sisi HP
  const akb = kNotif.amplop;
  tambahRusak('kabar_tanda_salah', 'tanda_salah', 'kabar dengan tanda kabar lain (§6 #13)', { ...salin(akb), tanda: kTerima.amplop.tanda }, PERIKSA_HP);
  const kPalsu = kabar('rusak_kabar_k_asing', { tanda: 'k_asing', urut_mac: 9, jenis: 'notif', tambahan: { notif: { j: 'selesai' } } });
  tambahRusak('kabar_dari_tidak_dikenal', 'dari_tidak_dikenal', 'kabar "selesai" bertanda kunci selain S_mac (§6 #13)', kPalsu.amplop, PERIKSA_HP, { antara: kPalsu.antara });
  tambahRusak('kabar_urut_mac_lama', 'urut_lama', 'kabar_notif sah (urut_mac 2), urut_mac tersimpan = 2 (§6 #13)', salin(akb),
    { ...PERIKSA_HP, penyimpan_awal: { urut_terakhir: 2, id_terlihat: [] } });
  tambahRusak('kabar_ke_perintah', 'jenis_kotak', 'amplop perintah sah diserahkan ke pemeriksa kabar HP', salin(ar), PERIKSA_HP);

  /* ---------- vektor-rusak.json (REV-21): nama warisan prototipe JS ---------- */
  const rusakTambahan = [];
  const tambahRusakB = (label, galat, ket, a, periksa = PERIKSA_MAC) => rusakTambahan.push({ label, galat, keterangan: ket, amplop: a, periksa });
  const milikSendiri = (o, k, v) => Object.defineProperty(o, k, { value: v, enumerable: true, writable: true, configurable: true });
  for (const k of ['constructor', 'toString', '__proto__', 'hasOwnProperty', 'valueOf']) {
    const p = perintah('rusak_isi_proto_' + k, { urut: 4, masa: 10 * MENIT, jenis: 'minta_status', ubahIsi: i => milikSendiri(i, k, 'x') });
    tambahRusakB('isi_field_' + k, R.ALASAN.ISI_BENTUK, `perintah sah bertanda K_rencana, plaintext memuat field "${k}" (nama warisan prototipe) — field asing`, p.amplop);
  }
  const pProtoJalankan = perintah('rusak_isi_proto_jalankan', { urut: 4, masa: 10 * MENIT, jenis: 'jalankan',
    tambahan: jalankan('rencana', 'x'), ubahIsi: i => { delete i.model; milikSendiri(i, 'constructor', 'opus'); } });
  tambahRusakB('isi_jalankan_constructor', R.ALASAN.ISI_BENTUK, 'jalankan: field opsional `model` diganti `constructor`', pProtoJalankan.amplop);
  const hdr = (k, ganti) => { const x = salin(ar); if (ganti) delete x[ganti]; return milikSendiri(x, k, 'x'); };
  tambahRusakB('header_tanda_diganti_constructor', 'bentuk', 'header tetap 9 field, `tanda` diganti `constructor`', hdr('constructor', 'tanda'));
  tambahRusakB('header_enc_diganti_toString', 'bentuk', 'header tetap 9 field, `enc` diganti `toString`', hdr('toString', 'enc'));
  tambahRusakB('header_tambah___proto__', 'bentuk', 'header 10 field: tambahan `__proto__` milik sendiri', hdr('__proto__'));
  keluar.rusak = rusakTambahan;

  /* ---------- vektor-cermin.json (APK v2 F1) ---------- */
  const SESI = 'a1b2c3d4-0000-4000-8000-000000000001', SESI2 = 'a1b2c3d4-0000-4000-8000-000000000002';
  const umumCermin = { urut: 10, masa: 10 * MENIT };
  const pc = (label, jenis, tambahan, o = {}) => perintah('cermin_' + label, { ...umumCermin, jenis, tambahan, ...o });
  const sahPC = [
    pc('daftar_48jam', 'cermin_daftar', { sejakJam: 48 }),
    pc('daftar_cari', 'cermin_daftar', { sejakHari: 30, cari: 'form login', proyek: 'proyek-uji' }),
    pc('buka_sesi', 'cermin_buka', { sesi: SESI, proyek: 'proyek-uji', akun: 'akun-uji' }),
    pc('buka_daftar', 'cermin_buka', { sesi: null }),
    pc('tutup', 'cermin_tutup', {}),
    pc('riwayat_awal', 'cermin_riwayat', { sesi: SESI, proyek: 'proyek-uji', akun: 'akun-uji', batas: 50 }),
    pc('riwayat_kursor', 'cermin_riwayat', { sesi: SESI, proyek: 'proyek-uji', akun: 'akun-uji', sebelum: '120.0', batas: 20 }),
  ].map(v => ({ ...v, periksa: PERIKSA_MAC, hasil: { ok: true, peran: 'k_rencana', jenis: JSON.parse(v.antara.plaintext).jenis } }));
  const butirSesi = {
    sesi: SESI, akun: 'akun-uji', proyek: 'proyek-uji', judul: 'Perbaiki validasi form login', asal: 'vscode', status: 'bekerja', terbuka: true,
    mulai: T0 - 3600e3, terakhir: T0 - 5000, divisi: [{ peran: 'divisi-programmer', status: 'bekerja' }], alat: { alat: 'Edit', ringkas: 'app/Controllers/Login.php (+4 −1 baris)' },
    bisaLanjut: 'tidak', keputusan_n: 0, tingkat: 'isi',
  };
  const butirSesi2 = { ...butirSesi, sesi: SESI2, judul: 'Sesi 3 Okt 14.20', asal: 'cli', status: 'selesai', terbuka: false, divisi: [], bisaLanjut: 'cabang', tingkat: 'ringkas' };
  delete butirSesi2.alat;
  const evCermin = [
    { sesi: SESI, ts: T0 - 4000, kind: 'prompt', text: 'Tolong cek [disamarkan] di form' },
    { sesi: SESI, ts: T0 - 3000, kind: 'tool', tool: 'Bash', detail: 'php spark test --filter Login' },
    { sesi: SESI, ts: T0 - 2500, kind: 'agent_start', who: 'divisi-qa', agentId: 'a1b2c3' },
    { sesi: SESI, ts: T0 - 2000, kind: 'notify', detail: 'permission_prompt' },
    { sesi: SESI, ts: T0 - 1000, kind: 'stop', text: 'Selesai — 3 tes lulus 🙂' },
  ];
  const entri = [
    { id: '12.0', waktu: T0 - 60000, peran: 'owner', teks: 'Perbaiki validasi form login' },
    { id: '13.0', waktu: T0 - 59000, peran: 'claude', teks: 'Saya periksa dulu controllernya.' },
    { id: '13.1', waktu: T0 - 59000, peran: 'alat', alat: 'Read', ringkas: 'app/Controllers/Login.php' },
    { id: '14.1', waktu: T0 - 58000, peran: 'divisi', alat: 'Agent', divisi: 'divisi-qa' },
    { id: '15.0', waktu: T0 - 57000, peran: 'sistem', teks: 'Percakapan dipadatkan' },
  ];
  const kc = (label, jenis, muatan, o = {}) => kabar('cermin_' + label, { urut_mac: o.urut_mac ?? 20, jenis, tambahan: { [jenis]: muatan, ...(o.tambahan || {}) }, masa: o.masa ?? 10 * MENIT });
  const sahKC = [
    kc('sesi', 'cermin_sesi', { sesi: [butirSesi, butirSesi2], lagi: false }),
    kc('sesi_kosong', 'cermin_sesi', { sesi: [], lagi: false }, { urut_mac: 21 }),
    kc('ev', 'cermin', { urut_cermin: T0 + 1, ev: evCermin }, { urut_mac: 22 }),
    kc('riwayat_isi', 'cermin_riwayat', { sesi: SESI, entri, sebelum: '12.0', lagi: true, versiParser: 'cermin-1' }, { urut_mac: 23, masa: 30 * MENIT }),
    kc('riwayat_ringkas', 'cermin_riwayat', { sesi: SESI, entri: entri.map(e => (e.peran === 'owner' || e.peran === 'claude' ? { id: e.id, waktu: e.waktu, peran: e.peran } : e)),
      lagi: false, versiParser: 'cermin-1' }, { urut_mac: 24, masa: 30 * MENIT }),
    kc('riwayat_galat', 'cermin_riwayat', { sesi: SESI, entri: [], lagi: false, versiParser: 'cermin-1', galat: 'format_tidak_dikenal' }, { urut_mac: 25, masa: 30 * MENIT }),
    kc('masa_6jam', 'cermin', { urut_cermin: T0 + 2, ev: [] }, { urut_mac: 26, masa: 6 * 60 * MENIT }),
  ].map(v => ({ ...v, periksa: PERIKSA_HP, hasil: { ok: true, peran: 's_mac', jenis: JSON.parse(v.antara.plaintext).jenis } }));
  const rusakC = [];
  const rp = (label, alasan, ket, jenis, tambahan, o) => rusakC.push({ ...pc(label, jenis, tambahan, o), alasan, keterangan: ket, periksa: PERIKSA_MAC });
  const rk = (label, alasan, ket, jenis, muatan, o) => rusakC.push({ ...kc(label, jenis, muatan, o), alasan, keterangan: ket, periksa: PERIKSA_HP });
  const IB = R.ALASAN.ISI_BENTUK;
  rp('r_daftar_dua_sejak', IB, 'cermin_daftar: sejakJam DAN sejakHari (wajib tepat satu)', 'cermin_daftar', { sejakJam: 1, sejakHari: 1 });
  rp('r_daftar_tanpa_sejak', IB, 'cermin_daftar: tanpa sejakJam/sejakHari', 'cermin_daftar', {});
  rp('r_daftar_jam_49', IB, 'cermin_daftar: sejakJam 49 (> 48)', 'cermin_daftar', { sejakJam: 49 });
  rp('r_daftar_hari_31', IB, 'cermin_daftar: sejakHari 31 (> 30)', 'cermin_daftar', { sejakHari: 31 });
  rp('r_daftar_cari_41', IB, 'cermin_daftar: cari 41 karakter', 'cermin_daftar', { sejakJam: 1, cari: 'x'.repeat(41) });
  rp('r_daftar_proyek_path', IB, 'cermin_daftar: proyek bukan POLA_ID ("../x")', 'cermin_daftar', { sejakJam: 1, proyek: '../x' });
  rp('r_buka_sesi_path', IB, 'cermin_buka: sesi berisi "/" (K-08: UUID saja)', 'cermin_buka', { sesi: '../a1b2c3d4-0000-4000-8000-000000000001' });
  rp('r_buka_sesi_jsonl', IB, 'cermin_buka: sesi berakhiran .jsonl', 'cermin_buka', { sesi: SESI + '.jsonl' });
  rp('r_buka_tanpa_sesi', IB, 'cermin_buka: field sesi tidak ada (null wajib eksplisit)', 'cermin_buka', { proyek: 'proyek-uji' });
  rp('r_buka_akun_besar', IB, 'cermin_buka: akun huruf besar (bukan POLA_ID)', 'cermin_buka', { sesi: SESI, proyek: 'proyek-uji', akun: 'Akun' });
  rp('r_tutup_field_asing', IB, 'cermin_tutup: field asing `sesi`', 'cermin_tutup', { sesi: SESI });
  rp('r_riwayat_batas_0', IB, 'cermin_riwayat: batas 0', 'cermin_riwayat', { sesi: SESI, proyek: 'proyek-uji', akun: 'akun-uji', batas: 0 });
  rp('r_riwayat_batas_51', IB, 'cermin_riwayat: batas 51', 'cermin_riwayat', { sesi: SESI, proyek: 'proyek-uji', akun: 'akun-uji', batas: 51 });
  rp('r_riwayat_sebelum_65', IB, 'cermin_riwayat: sebelum 65 karakter', 'cermin_riwayat', { sesi: SESI, proyek: 'proyek-uji', akun: 'akun-uji', sebelum: '1'.repeat(65), batas: 5 });
  rp('r_riwayat_tanpa_akun', IB, 'cermin_riwayat: akun wajib', 'cermin_riwayat', { sesi: SESI, proyek: 'proyek-uji', batas: 5 });
  rp('r_riwayat_path_transkrip', IB, 'cermin_riwayat: field asing `transkrip` (path dari HP tidak pernah diterima)', 'cermin_riwayat',
    { sesi: SESI, proyek: 'proyek-uji', akun: 'akun-uji', batas: 5, transkrip: '/Users/x/.claude/projects/p/a.jsonl' });
  rp('r_daftar_masa_11mnt', R.ALASAN.MASA_TERLALU_PANJANG, 'cermin_daftar hangus 10 mnt; kedaluwarsa − dibuat = 11 mnt', 'cermin_daftar', { sejakJam: 1 }, { masa: 11 * MENIT });
  rk('r_sesi_field_asing', IB, 'cermin_sesi: butir memuat field asing `cwd`', 'cermin_sesi', { sesi: [{ ...butirSesi, cwd: '/Users/x/proj' }], lagi: false });
  rk('r_sesi_judul_61', IB, 'cermin_sesi: judul 61 karakter', 'cermin_sesi', { sesi: [{ ...butirSesi, judul: 'j'.repeat(61) }], lagi: false });
  rk('r_sesi_status', IB, 'cermin_sesi: status tak dikenal', 'cermin_sesi', { sesi: [{ ...butirSesi, status: 'jalan' }], lagi: false });
  rk('r_sesi_tingkat', IB, 'cermin_sesi: tingkat "penuh" (hanya ringkas|isi)', 'cermin_sesi', { sesi: [{ ...butirSesi, tingkat: 'penuh' }], lagi: false });
  rk('r_sesi_51', IB, 'cermin_sesi: 51 butir (> 50)', 'cermin_sesi', { sesi: Array.from({ length: 51 }, () => butirSesi2), lagi: true });
  rk('r_sesi_tanpa_lagi', IB, 'cermin_sesi: lagi wajib', 'cermin_sesi', { sesi: [] });
  rk('r_ev_kind', IB, 'cermin: kind tak dikenal', 'cermin', { urut_cermin: 1, ev: [{ sesi: SESI, ts: T0, kind: 'tool_input' }] });
  rk('r_ev_text_4001', IB, 'cermin: text 4001 karakter', 'cermin', { urut_cermin: 1, ev: [{ sesi: SESI, ts: T0, kind: 'stop', text: 't'.repeat(4001) }] });
  rk('r_ev_tool_input', IB, 'cermin: field asing `tool_input` (isi alat mentah)', 'cermin', { urut_cermin: 1, ev: [{ sesi: SESI, ts: T0, kind: 'tool', tool: 'Write', tool_input: { content: 'x' } }] });
  rk('r_ev_61', IB, 'cermin: 61 kejadian (> 60)', 'cermin', { urut_cermin: 1, ev: Array.from({ length: 61 }, () => evCermin[1]) });
  rk('r_riwayat_galat_entri', IB, 'cermin_riwayat: galat disertai entri (galat → entri kosong)', 'cermin_riwayat',
    { sesi: SESI, entri: [entri[0]], lagi: false, versiParser: 'cermin-1', galat: 'format_tidak_dikenal' });
  rk('r_riwayat_peran', IB, 'cermin_riwayat: peran tak dikenal', 'cermin_riwayat', { sesi: SESI, entri: [{ ...entri[0], peran: 'hasil_alat' }], lagi: false, versiParser: 'cermin-1' });
  rk('r_riwayat_tooluseresult', IB, 'cermin_riwayat: entri memuat `toolUseResult`', 'cermin_riwayat',
    { sesi: SESI, entri: [{ ...entri[2], toolUseResult: 'isi berkas' }], lagi: false, versiParser: 'cermin-1' });
  rk('r_riwayat_galat_lain', IB, 'cermin_riwayat: galat tak dikenal', 'cermin_riwayat', { sesi: SESI, entri: [], lagi: false, versiParser: 'cermin-1', galat: 'rusak' });
  rk('r_riwayat_tanpa_versi', IB, 'cermin_riwayat: versiParser wajib', 'cermin_riwayat', { sesi: SESI, entri: [], lagi: false });
  rk('r_kabar_field_atas', IB, 'kabar cermin: field tingkat atas selain umum + `cermin`', 'cermin', { urut_cermin: 1, ev: [] }, { tambahan: { status: {} } });
  rk('r_kabar_masa_7jam', R.ALASAN.MASA_TERLALU_PANJANG, 'kabar cermin* maks 6 jam (K-05); 7 jam ditolak', 'cermin', { urut_cermin: 1, ev: [] }, { masa: 7 * 60 * MENIT });
  keluar.cermin = {
    catatan: [
      'Vektor APK v2 F1 (KONTRAK-apk-v2 §2.1–2.2). Kunci, konteks, urutan pemeriksaan & cara pakai = vektor-e2e.json (kunci UJI).',
      'Muatan kabar ada di bawah kunci bernama jenis (konvensi v1): isi.cermin_sesi = {sesi, lagi}, isi.cermin = {urut_cermin, ev}, isi.cermin_riwayat = {sesi, entri, …}.',
      'Pemeriksa ketat: field tak dikenal di tingkat atas/muatan/butir → isi_bentuk. Kabar cermin* masa maks 6 jam (masa_maks_kabar_cermin_ms).',
      'Perintah cermin_* hangus 10 mnt (masa_maks_ms.lainnya). cermin_daftar: tepat satu dari sejakJam/sejakHari. cermin_buka.sesi: UUID atau null (wajib ada).',
    ],
    hanya_uji: true,
    masa_maks_kabar_cermin_ms: R.MASA_MAKS_KABAR_CERMIN,
    sah: { perintah: sahPC, kabar: sahKC },
    rusak: rusakC,
  };

  /* ---------- pemasangan (kontrak §3) ---------- */
  const rahasia = turunan('rahasia_pasang');
  const qr = { v: 1, relay: 'https://padev-studio.pa-developer.pro/api/v1/', mac_id, nama_mac: 'Mac Uji', kode_daftar: heksDari('kode_daftar', 32),
    rahasia: R.b64u(rahasia), s_mac: R.b64u(K.s_mac.spki), e_mac: R.b64u(K.e_mac.pub), kedaluwarsa: T0 + 5 * MENIT };
  const isiPasangTanpaHmac = { mac_id, perangkat_id, dibuat, kedaluwarsa: dibuat + 5 * MENIT, nama: 'HP Uji', k_rencana: R.b64u(K.k_rencana.spki),
    k_kerjakan: R.b64u(K.k_kerjakan.spki), e_hp: R.b64u(K.e_hp.pub), atestasi: { k_rencana: [], k_kerjakan: [] }, fcm: 'token-fcm-uji' };
  const isiPasang = { ...isiPasangTanpaHmac, hmac: R.hmacPasang(rahasia, isiPasangTanpaHmac) };
  const amplopPasang = amplop('pasang', { jenis_kotak: 'pasang', tanda: 'k_rencana', ke: 'e_mac', isi: isiPasang, kedaluwarsa: isiPasang.kedaluwarsa,
    id: heksDari('id|pasang', 32) });
  const isiDitukar = { ...isiPasang, k_kerjakan: R.b64u(K.k_asing.spki) };   // relay/penyerang menukar kunci tapi tak bisa menghitung hmac
  const amplopDitukar = amplop('pasang_ditukar', { jenis_kotak: 'pasang', tanda: 'k_rencana', ke: 'e_mac', isi: isiDitukar,
    kedaluwarsa: isiPasang.kedaluwarsa, id: heksDari('id|pasang_ditukar', 32) });
  const pasang = {
    qr,
    hmac_input_jcs: R.jcs(isiPasangTanpaHmac),
    isi: isiPasang,
    tantangan_atestasi_heks: R.tantanganAtestasi(rahasia, mac_id).toString('hex'),
    sas: R.kodeSas({ s_mac: K.s_mac.spki, e_mac: K.e_mac.pub, k_rencana: K.k_rencana.spki, k_kerjakan: K.k_kerjakan.spki, e_hp: K.e_hp.pub,
      mac_id, perangkat_id }),
    sah: { label: 'pasang', ...amplopPasang, periksa: { jenisKotak: 'pasang', penerima: 'mac', sekarang: T0 },
      hasil: { ok: true, k_rencana_id: K.k_rencana.id, k_kerjakan_id: K.k_kerjakan.id, e_hp_id: K.e_hp.id } },
    rusak: [{ label: 'pasang_kunci_ditukar', alasan: 'hmac_salah', keterangan: 'k_kerjakan ditukar setelah HMAC dihitung (§6 #10)',
      ...amplopDitukar, periksa: { jenisKotak: 'pasang', penerima: 'mac', sekarang: T0 } }],
  };

  /* ---------- JCS ---------- */
  const jcsKasus = [
    '{"b":2,"a":1,"c":{"z":true,"y":null,"x":[3,2,1]}}',
    '{"\\u20ac":"Euro","\\r":"cr","1":"satu","\\u0080":"c1","\\ud83d\\ude00":"emoji","\\u00f6":"o"}',
    '{"s":"kutip \\" garis \\\\ tab \\t baris \\n kontrol \\u0001 \\u001f del \\u007f slash / unicode \\u2028"}',
    '{"angka":[0,-0,1,-1,1791000000000,9007199254740991,1e21,1.5,0.000001,1e-7]}',
    '{"kosong":{},"larik":[],"str":""}',
  ].map(masuk => ({ masuk, keluar: R.jcs(JSON.parse(masuk)) }));

  return {
    catatan: [
      'Vektor uji bersama PADEV-E2E-v1 (kontrak .ai/brief/KONTRAK-apk.md §2). SEMUA kunci di berkas ini KUNCI UJI (hanya_uji) — jangan dipakai di perangkat.',
      'Dibuat oleh: node apk/kontrak/buat-vektor.js · diperiksa oleh: node apk/kontrak/uji-kripto.js (Node 18+, tanpa npm).',
      'Cara pakai di Kotlin (Putri): impor kunci dari `kunci` (ECDSA: pkcs8/spki b64u; X25519: privat_raw/publik_raw b64u, cocok untuk Tink HPKE keyset).',
      '1) Untuk setiap `sah.perintah` (penerima Mac: kunci sandi e_mac, kunci_tanda_dikenal.mac) dan `sah.kabar` (penerima HP: e_hp, kunci_tanda_dikenal.hp):',
      '   hitung ulang H = JCS(6 field header) dan info, bandingkan dengan `antara`; verifikasi tanda ECDSA (DER) atas b64u-dekode(antara.input_tanda)',
      '   = "PADEV-STUDIO-AMPLOP-v1\\n" ‖ H ‖ enc ‖ ct; buka HPKE (info, aad = H) → harus sama persis dengan `antara.plaintext`.',
      '2) Setiap `rusak[]` harus DITOLAK dengan `alasan` yang sama, memakai urutan pemeriksaan di `urutan_pemeriksaan` (alasan pertama yang gagal menang).',
      '   `periksa.sekarang` = jam yang dipakai (ms). `periksa.penyimpan_awal` = isi penyimpan anti-replay sebelum amplop diperiksa',
      '   (`urut_terakhir` untuk perangkat/pengirim itu, `id_terlihat` = id amplop yang sudah pernah diterima). `kunciSandiTambahan` = kunci sandi lain yang juga dipegang penerima.',
      '3) `enc`/`ct` deterministik dari `antara.hpke.ikm_e` (DeriveKeyPair RFC 9180) — Tink tidak menerima ikm efemeral, jadi cukup uji buka+verifikasi;',
      '   tanda ECDSA acak (k acak) — bandingkan dengan VERIFIKASI, bukan kesamaan byte.',
      '4) Arah sebaliknya: amplop buatan Kotlin (kunci uji ini, jam nyata) diperiksa Node dengan: node apk/kontrak/uji-kripto.js --periksa <berkas.json>',
      '   (berkas = satu amplop atau larik amplop; jenis_kotak perintah → sisi Mac, pasang → sisi Mac dengan rahasia di `pasang.qr`).',
      '5) Pemasangan: `pasang.isi.hmac` = b64u(HMAC-SHA256(rahasia, UTF-8 `hmac_input_jcs`)); `pasang.sas` wajib sama dengan kode 6 digit di HP;',
      '   `tantangan_atestasi_heks` = SHA-256(rahasia ‖ UTF-8 mac_id) untuk setAttestationChallenge.',
      '6) `jcs[]`: masuk (teks JSON) → keluar (JCS RFC 8785) wajib sama byte-per-byte. Amplop hanya memakai bilangan bulat aman (≤ 2^53−1).',
    ],
    suite: R.SUITE,
    versi_vektor: 1,
    hanya_uji: true,
    urutan_pemeriksaan: ['bentuk (9 field, tipe, b64u kanonik, ukuran ≤96 KB; v bukan angka → bentuk)', 'versi (v ≠ 1)',
      'jenis_kotak (bukan yang diharapkan penerima)', 'ke_salah', 'dari_tidak_dikenal', 'peran_salah', 'tanda_salah (SEBELUM dekripsi)',
      'dekripsi_gagal', 'isi_bentuk (JSON objek, field wajib/tipe, field asing ditolak untuk perintah)',
      'isi_tidak_cocok (mac_id; perintah: id & kedaluwarsa = header, perangkat_id = pemilik kunci; kabar: perangkat_id = HP ini)',
      'kerjakan_tanpa_k_kerjakan', 'kedaluwarsa (sekarang > kedaluwarsa)', 'dibuat_masa_depan (dibuat > sekarang + 120 dtk)',
      'masa_terlalu_panjang (kedaluwarsa − dibuat > masa_maks_ms per jenis, atau ≤ 0)', 'replay_id', 'urut_lama (urut ≤ tersimpan)'],
    alasan: Object.values(R.ALASAN),
    masa_maks_ms: R.MASA_MAKS,
    konteks: { sekarang: T0, mac_id, perangkat_id, relay: qr.relay },
    kunci: kunciKeluar,
    kunci_tanda_dikenal: { mac: dikenalMac, hp: dikenalHp },
    jcs: jcsKasus,
    sah: { perintah: sahPerintah, kabar: sahKabar },
    rusak,
    pasang,
  };
}

if (require.main === module) {
  const bacaJson = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
  const lama = bacaJson(BERKAS), lamaRusak = bacaJson(BERKAS_RUSAK), lamaCermin = bacaJson(BERKAS_CERMIN);
  const keluar = {};
  const berkas = [[BERKAS, JSON.stringify(susun(lama, lamaRusak, keluar, lamaCermin), null, 2) + '\n']];
  berkas.push([BERKAS_RUSAK, JSON.stringify(keluar.rusak, null, 2) + '\n']);
  berkas.push([BERKAS_CERMIN, JSON.stringify(keluar.cermin, null, 2) + '\n']);
  if (process.argv.includes('--cek')) {
    let usang = 0;
    for (const [f, teks] of berkas) {
      const sama = fs.existsSync(f) && fs.readFileSync(f, 'utf8') === teks;
      if (!sama) usang++;
      console.log(path.basename(f) + (sama ? ' mutakhir' : ' USANG — jalankan node apk/kontrak/buat-vektor.js'));
    }
    process.exit(usang ? 1 : 0);
  }
  for (const [f, teks] of berkas) {
    fs.writeFileSync(f, teks);
    console.log('ditulis ' + path.relative(process.cwd(), f));
  }
}
module.exports = { susun, BERKAS, BERKAS_RUSAK, BERKAS_CERMIN, T0 };
