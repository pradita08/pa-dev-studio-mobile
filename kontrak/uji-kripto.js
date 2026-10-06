#!/usr/bin/env node
// Uji inti kripto PADEV-E2E-v1 (pelaksana-relay.js) — Node 18+, tanpa npm, tanpa jaringan, tanpa server.
//   node apk/kontrak/uji-kripto.js                      → semua uji (keluar 1 bila ada yang gagal)
//   node apk/kontrak/uji-kripto.js --periksa <berkas>    → periksa amplop buatan Kotlin (kunci uji vektor-e2e.json, jam nyata;
//                                                          --sekarang <ms> untuk jam lain). Hanya mencetak ok/alasan, tidak mencetak isi.
// Sumber vektor resmi (disimpan di folder ini, tidak diunduh saat uji):
//   hpke-rfc9180-base-0020-0001-0002.json  ← github.com/cfrg/draft-irtf-cfrg-hpke test-vectors.json (potongan suite kontrak, mode base)
//   ecdsa-p256-sha256-wycheproof.json      ← github.com/C2SP/wycheproof testvectors_v1/ecdsa_secp256r1_sha256_test.json (utuh)
//   RFC 6979 Lampiran A.2.5 (P-256, SHA-256, pesan "sample" & "test") — konstanta di bawah.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const R = require('../../_app_padev_studio_3d/pelaksana-relay.js');
const U = R._uji;
const { susun, BERKAS_RUSAK, BERKAS_CERMIN } = require('./buat-vektor.js');

const DIR = __dirname;
const baca = n => JSON.parse(fs.readFileSync(path.join(DIR, n), 'utf8'));
const V = baca('vektor-e2e.json');
const hex = h => Buffer.from(h, 'hex');
const dariB = s => Buffer.from(s, 'base64url');

/* ---------- penyusun opsi periksa dari vektor ---------- */
const kunciSandiDariNama = n => U.x25519Privat(dariB(V.kunci[n].privat_raw));
function opsiDariVektor(p, amplop) {
  const mac = p.penerima === 'mac';
  const o = {
    jenisKotak: p.jenisKotak, sekarang: p.sekarang, macId: V.konteks.mac_id,
    kunciTandaDikenal: mac ? V.kunci_tanda_dikenal.mac : V.kunci_tanda_dikenal.hp,
    kunciSandiSaya: [kunciSandiDariNama(mac ? 'e_mac' : 'e_hp'), ...(p.kunciSandiTambahan || []).map(kunciSandiDariNama)],
  };
  if (!mac) o.perangkatId = V.konteks.perangkat_id;
  if (p.penyimpan_awal) {
    const kunciUrut = p.jenisKotak === 'perintah' ? V.konteks.perangkat_id : 'mac:' + amplop.dari;
    o.penyimpan = R.buatPenyimpanReplayMemori({ urut: { [kunciUrut]: p.penyimpan_awal.urut_terakhir } });
    for (const id of p.penyimpan_awal.id_terlihat) o.penyimpan.data.id[id] = p.sekarang + 3600e3;
  } else o.penyimpan = R.buatPenyimpanReplayMemori();
  return o;
}

/* ---------- mode --periksa ---------- */
if (process.argv.includes('--periksa')) {
  const f = process.argv[process.argv.indexOf('--periksa') + 1];
  const iS = process.argv.indexOf('--sekarang');
  const sekarang = iS > 0 ? Number(process.argv[iS + 1]) : Date.now();
  let isi;
  try { isi = JSON.parse(fs.readFileSync(f, 'utf8')); } catch { console.error('berkas tidak terbaca / bukan JSON'); process.exit(2); }
  let gagal = 0;
  for (const [i, a] of (Array.isArray(isi) ? isi : [isi]).entries()) {
    let h;
    if (a?.jenis_kotak === 'pasang') {
      h = R.periksaAmplopPasang(a, { kunciSandiSaya: kunciSandiDariNama('e_mac'), rahasia: V.pasang.qr.rahasia, macId: V.konteks.mac_id, sekarang });
    } else {
      h = R.periksaAmplop(a, opsiDariVektor({ jenisKotak: 'perintah', penerima: 'mac', sekarang }, a));
    }
    if (!h.ok) gagal++;
    console.log(`#${i} ${a?.jenis_kotak ?? '?'}: ${h.ok ? 'OK' + (h.peran ? ' (' + h.peran + ', ' + h.isi.jenis + ')' : '') : 'DITOLAK ' + h.alasan}`);
  }
  process.exit(gagal ? 1 : 0);
}

/* ---------- harness ---------- */
const hasil = {};
let bagian = '';
function uji(nama, fn) {
  const h = (hasil[bagian] ??= { lulus: 0, gagal: [] });
  try { fn(); h.lulus++; } catch (e) { h.gagal.push(nama + ': ' + e.message); }
}
const sama = (a, b, m = '') => {
  const x = Buffer.isBuffer(a) ? a.toString('hex') : typeof a === 'object' ? JSON.stringify(a) : a;
  const y = Buffer.isBuffer(b) ? b.toString('hex') : typeof b === 'object' ? JSON.stringify(b) : b;
  if (x !== y) throw new Error(`${m} beda: ${String(x).slice(0, 80)} ≠ ${String(y).slice(0, 80)}`);
};
const benar = (c, m) => { if (!c) throw new Error(m); };
const ditolak = (h, alasan, m = '') => { if (h.ok || h.alasan !== alasan) throw new Error(`${m} harap ${alasan}, dapat ${h.ok ? 'ok' : h.alasan}`); };
const melempar = (fn, m) => { try { fn(); } catch { return; } throw new Error(m + ': tidak melempar'); };

/* ---------- 1. HPKE RFC 9180 resmi ---------- */
bagian = 'HPKE RFC 9180 (0x0020/0x0001/0x0002, base)';
const HV = baca('hpke-rfc9180-base-0020-0001-0002.json').vektor;
benar(HV.length > 0, 'tidak ada vektor HPKE');
for (const [n, t] of HV.entries()) {
  uji(`v${n} kunci`, () => {
    sama(U.deriveKeyPair(hex(t.ikmE)), hex(t.skEm), 'skEm');
    sama(U.deriveKeyPair(hex(t.ikmR)), hex(t.skRm), 'skRm');
    sama(U.rawSandiPublik(crypto.createPublicKey(U.x25519Privat(hex(t.skEm)))), hex(t.pkEm), 'pkEm');
    sama(U.rawSandiPublik(crypto.createPublicKey(U.x25519Privat(hex(t.skRm)))), hex(t.pkRm), 'pkRm');
  });
  const kp = U.hpkeKonteksPengirim(hex(t.pkRm), hex(t.info), hex(t.ikmE));
  uji(`v${n} encap & jadwal kunci`, () => {
    sama(kp.enc, hex(t.enc), 'enc'); sama(kp.sharedSecret, hex(t.shared_secret), 'shared_secret');
    const ks = kp.konteks.rahasia;
    sama(ks.key, hex(t.key), 'key'); sama(ks.baseNonce, hex(t.base_nonce), 'base_nonce'); sama(ks.exporterSecret, hex(t.exporter_secret), 'exporter');
  });
  const kr = U.hpkeKonteksPenerima(hex(t.enc), hex(t.skRm), hex(t.info));
  uji(`v${n} decap`, () => sama(kr.sharedSecret, hex(t.shared_secret), 'shared_secret penerima'));
  for (const [i, e] of t.encryptions.entries()) {
    uji(`v${n} seal/open seq ${i}`, () => {
      sama(kp.konteks.segel(hex(e.aad), hex(e.pt)), hex(e.ct), 'ct');
      sama(kr.konteks.buka(hex(e.aad), hex(e.ct)), hex(e.pt), 'pt');
    });
  }
  for (const [i, e] of t.exports.entries()) {
    uji(`v${n} export ${i}`, () => sama(kp.konteks.ekspor(hex(e.exporter_context), e.L), hex(e.exported_value), 'export'));
  }
  uji(`v${n} single-shot hpkeSegel/hpkeBuka`, () => {
    const e0 = t.encryptions[0];
    const s = R.hpkeSegel(hex(t.pkRm), hex(t.info), hex(e0.aad), hex(e0.pt), hex(t.ikmE));
    sama(s.enc, hex(t.enc), 'enc'); sama(s.ct, hex(e0.ct), 'ct');
    sama(R.hpkeBuka(hex(t.skRm), hex(t.enc), hex(t.info), hex(e0.aad), hex(e0.ct)), hex(e0.pt), 'pt');
    const rusak = hex(e0.ct); rusak[0] ^= 1;
    melempar(() => R.hpkeBuka(hex(t.skRm), hex(t.enc), hex(t.info), hex(e0.aad), rusak), 'ct rusak');
    melempar(() => R.hpkeBuka(hex(t.skRm), hex(t.enc), Buffer.from('info lain'), hex(e0.aad), hex(e0.ct)), 'info lain');
    melempar(() => R.hpkeBuka(hex(t.skRm), Buffer.alloc(32), hex(t.info), hex(e0.aad), hex(e0.ct)), 'enc nol (DH nol)');
  });
}
uji('segel/buka acak pulang-pergi', () => {
  const k = crypto.generateKeyPairSync('x25519');
  const s = R.hpkeSegel(U.rawSandiPublik(k.publicKey), Buffer.from('i'), Buffer.from('a'), Buffer.from('halo'));
  sama(R.hpkeBuka(k.privateKey, s.enc, Buffer.from('i'), Buffer.from('a'), s.ct).toString(), 'halo', 'pt');
  const s2 = R.hpkeSegel(U.rawSandiPublik(k.publicKey), Buffer.from('i'), Buffer.from('a'), Buffer.from('halo'));
  benar(!s2.enc.equals(s.enc), 'enc efemeral harus berbeda tiap pesan');
});

/* ---------- 2. ECDSA P-256 ---------- */
bagian = 'ECDSA P-256/SHA-256';
const RFC6979 = { d: 'c9afa9d845ba75166b5c215767b1d6934e50c3db36e89b127b8a622b120f6721',
  ux: '60fed4ba255a9d31c961eb74c6356d68c049b8923b61fa6ce669622e60f29fb6', uy: '7903fe1008b8bc99a41ae9e95628bc64f2f1b20c2d7e9f5177a3c294d4462299',
  tanda: [['sample', 'efd48b2aacb6a8fd1140dd9cd45e81d69d2c877b56aaf991c34d0ea84eaf3716', 'f7cb1c942d657c41d436c7a1b6e29f65f3e900dbb9aff4064dc4ab2f843acda8'],
    ['test', 'f1abb023518351cd71d881567b1ea663ed3efcf6c5132b354f28d3b0b7d38367', '019f4113742a2b14bd25926b49c649155f267e60d3814b4c0cc84250e46f0083']] };
uji('RFC 6979 A.2.5 kunci & tanda', () => {
  const priv = U.kunciTandaDariD(hex(RFC6979.d));
  const jwk = crypto.createPublicKey(priv).export({ format: 'jwk' });
  sama(dariB(jwk.x), hex(RFC6979.ux), 'Ux'); sama(dariB(jwk.y), hex(RFC6979.uy), 'Uy');
  const pub = U.kunciPublikTanda(U.spkiTanda(priv));
  for (const [m, r, s] of RFC6979.tanda) {
    benar(crypto.verify('sha256', Buffer.from(m), { key: pub, dsaEncoding: 'ieee-p1363' }, hex(r + s)), 'tanda RFC 6979 "' + m + '"');
    const salah = hex(r + s); salah[63] ^= 1;
    benar(!crypto.verify('sha256', Buffer.from(m), { key: pub, dsaEncoding: 'ieee-p1363' }, salah), 'tanda rusak lolos');
  }
});
const WP = baca('ecdsa-p256-sha256-wycheproof.json');
const wp = { valid: 0, invalid: 0, acceptable: 0 };
for (const g of WP.testGroups) {
  let pub = null;
  try { pub = U.kunciPublikTanda(hex(g.publicKeyDer)); } catch { /* kunci publik tidak sah → semua tes grup harus gagal */ }
  for (const t of g.tests) {
    uji(`wycheproof #${t.tcId} (${t.result})`, () => {
      let ok = false;
      try { ok = !!pub && crypto.verify('sha256', hex(t.msg), { key: pub, dsaEncoding: 'der' }, hex(t.sig)); } catch { ok = false; }
      wp[t.result]++;
      if (t.result === 'valid') benar(ok, 'tanda valid ditolak');
      if (t.result === 'invalid') benar(!ok, 'tanda invalid diterima');
    });
  }
}
uji('tanda/verifikasi pulang-pergi + rusak', () => {
  const k = R.buatKunciMac();
  const t = crypto.sign('sha256', Buffer.from('pesan'), { key: k.tanda.privat, dsaEncoding: 'der' });
  const pub = U.kunciPublikTanda(k.publik.s_mac);
  benar(crypto.verify('sha256', Buffer.from('pesan'), { key: pub, dsaEncoding: 'der' }, t), 'tanda sah ditolak');
  benar(!crypto.verify('sha256', Buffer.from('pesaN'), { key: pub, dsaEncoding: 'der' }, t), 'pesan lain lolos');
  const t2 = Buffer.from(t); t2[t2.length - 1] ^= 1;
  benar(!crypto.verify('sha256', Buffer.from('pesan'), { key: pub, dsaEncoding: 'der' }, t2), 'tanda rusak lolos');
});
uji('kunci publik bukan P-256 ditolak', () => {
  melempar(() => U.kunciPublikTanda(crypto.generateKeyPairSync('ec', { namedCurve: 'secp384r1' }).publicKey), 'P-384');
  melempar(() => U.kunciPublikTanda(crypto.generateKeyPairSync('ed25519').publicKey.export({ format: 'der', type: 'spki' })), 'Ed25519');
  const spki = Buffer.from(dariB(V.kunci.k_rencana.spki)); spki[40] ^= 1;   // titik di luar kurva
  melempar(() => U.kunciPublikTanda(spki), 'titik di luar kurva');
});

/* ---------- 3. JCS, b64u, ID kunci ---------- */
bagian = 'JCS RFC 8785 / b64u / ID kunci';
for (const [i, c] of V.jcs.entries()) uji(`jcs vektor ${i}`, () => sama(R.jcs(JSON.parse(c.masuk)), c.keluar, 'jcs'));
uji('jcs RFC 8785 §3.2.3 contoh urutan', () =>
  sama(R.jcs({ '€': 'Euro Sign', '\r': 'Carriage Return', 'דּ': 'Hebrew Letter Dalet With Dagesh', '1': 'One',
    '😀': 'Emoji: Grinning Face', '\u0080': 'Control', 'ö': 'Latin Small Letter O With Diaeresis' }),
  '{"\\r":"Carriage Return","1":"One","\u0080":"Control","ö":"Latin Small Letter O With Diaeresis","€":"Euro Sign","😀":"Emoji: Grinning Face","\ufb33":"Hebrew Letter Dalet With Dagesh"}'));
uji('jcs menolak nilai tak sah', () => {
  melempar(() => R.jcs({ a: '\ud800' }), 'surrogate tunggal');
  melempar(() => R.jcs({ a: NaN }), 'NaN'); melempar(() => R.jcs({ a: undefined }), 'undefined');
  melempar(() => R.jcs(new Date()), 'Date'); melempar(() => R.jcs({ a: 1n }), 'BigInt');
});
uji('b64u ketat', () => {
  sama(R.dariB64u('AQID'), Buffer.from([1, 2, 3])); benar(R.dariB64u('AQI=') === null, 'padding diterima');
  benar(R.dariB64u('AQI+') === null, 'alfabet base64 biasa diterima'); benar(R.dariB64u('AQJ') === null, 'non-kanonik diterima');
});
uji('ID kunci = 16 heksa SHA-256', () => {
  for (const n of ['k_rencana', 'k_kerjakan', 's_mac']) {
    sama(R.idKunci(V.kunci[n].spki), crypto.createHash('sha256').update(dariB(V.kunci[n].spki)).digest('hex').slice(0, 16), n);
    sama(R.idKunci(V.kunci[n].spki), V.kunci[n].id, n + ' vektor');
  }
  for (const n of ['e_hp', 'e_mac']) sama(R.idKunci(V.kunci[n].publik_raw), crypto.createHash('sha256').update(dariB(V.kunci[n].publik_raw)).digest('hex').slice(0, 16), n);
});

/* ---------- 4. vektor-e2e.json ---------- */
bagian = 'vektor-e2e.json (kontrak §2)';
uji('berkas mutakhir (= buat-vektor.js)', () => benar(JSON.stringify(susun(V), null, 2) + '\n' === fs.readFileSync(path.join(DIR, 'vektor-e2e.json'), 'utf8'),
  'vektor usang — jalankan node apk/kontrak/buat-vektor.js'));
uji('isi minimum kontrak', () => {
  benar(V.hanya_uji === true && Object.values(V.kunci).every(k => k.hanya_uji === true), 'hanya_uji');
  const jenis = V.sah.perintah.map(p => JSON.parse(p.antara.plaintext)).map(i => i.jenis === 'jalankan' ? i.mode : i.jenis);
  for (const j of ['rencana', 'kerjakan', 'hentikan']) benar(jenis.includes(j), 'perintah sah ' + j);
  benar(V.sah.kabar.length >= 2, '≥2 kabar'); benar(V.rusak.length >= 6, '≥6 rusak');
  const alasan = new Set(V.rusak.map(r => r.label));
  for (const l of ['tanda_salah', 'header_diubah', 'field_tambahan', 'v2', 'kid_dari_tidak_dikenal', 'kid_ke_salah', 'kedaluwarsa']) benar(alasan.has(l), 'rusak ' + l);
  for (const p of [...V.sah.perintah, ...V.sah.kabar]) for (const f of ['H', 'info', 'input_tanda', 'plaintext']) benar(typeof p.antara[f] === 'string', 'antara.' + f);
  for (const r of V.rusak) benar(V.alasan.includes(r.alasan), 'alasan dikenal ' + r.alasan);
});
for (const p of [...V.sah.perintah, ...V.sah.kabar]) {
  uji(`sah ${p.label}`, () => {
    const a = p.amplop;
    sama(R.jcs(U.headerDari(a)), p.antara.H, 'H');
    sama(U.infoHpke(a.dari, a.ke).toString(), p.antara.info, 'info');
    sama(U.inputTanda(Buffer.from(p.antara.H), dariB(a.enc), dariB(a.ct)), dariB(p.antara.input_tanda), 'input_tanda');
    sama(U.deriveKeyPair(dariB(p.antara.hpke.ikm_e)), dariB(p.antara.hpke.sk_e), 'sk_e'); sama(a.enc, p.antara.hpke.enc, 'enc');
    const h = R.periksaAmplop(a, opsiDariVektor(p.periksa, a));
    benar(h.ok, 'ditolak: ' + h.alasan);
    sama(R.jcs(h.isi), p.antara.plaintext, 'plaintext'); sama(h.peran, p.hasil.peran, 'peran'); sama(h.isi.jenis, p.hasil.jenis, 'jenis');
    if (p.hasil.hash) sama(h.hash, p.hasil.hash, 'hash');
  });
}
for (const r of V.rusak) uji(`rusak ${r.label} → ${r.alasan}`, () => ditolak(R.periksaAmplop(r.amplop, opsiDariVektor(r.periksa, r.amplop)), r.alasan));
uji('tanda_terima merujuk hash amplop perintah', () => {
  const t = JSON.parse(V.sah.kabar.find(k => k.label === 'kabar_tanda_terima').antara.plaintext).tanda_terima;
  sama(t.perintah_sha256, R.hashAmplop(V.sah.perintah[0].amplop), 'perintah_sha256');
});
uji('pasang sah + SAS + HMAC + tantangan', () => {
  const P = V.pasang;
  const opsi = { kunciSandiSaya: kunciSandiDariNama('e_mac'), rahasia: P.qr.rahasia, macId: V.konteks.mac_id, sekarang: P.sah.periksa.sekarang };
  const h = R.periksaAmplopPasang(P.sah.amplop, opsi);
  benar(h.ok, 'ditolak: ' + h.alasan); sama(h.kunci, { k_rencana_id: P.sah.hasil.k_rencana_id, k_kerjakan_id: P.sah.hasil.k_kerjakan_id, e_hp_id: P.sah.hasil.e_hp_id });
  const tanpa = { ...P.isi }; delete tanpa.hmac; sama(R.jcs(tanpa), P.hmac_input_jcs, 'hmac_input_jcs');
  sama(crypto.createHmac('sha256', dariB(P.qr.rahasia)).update(P.hmac_input_jcs).digest('base64url'), P.isi.hmac, 'hmac');
  sama(R.kodeSas({ s_mac: P.qr.s_mac, e_mac: P.qr.e_mac, k_rencana: P.isi.k_rencana, k_kerjakan: P.isi.k_kerjakan, e_hp: P.isi.e_hp,
    mac_id: P.isi.mac_id, perangkat_id: P.isi.perangkat_id }), P.sas, 'sas');
  benar(/^\d{6}$/.test(P.sas), 'sas 6 digit');
  sama(crypto.createHash('sha256').update(dariB(P.qr.rahasia)).update(P.qr.mac_id).digest('hex'), P.tantangan_atestasi_heks, 'tantangan');
  ditolak(R.periksaAmplopPasang(P.sah.amplop, { ...opsi, rahasia: R.b64u(crypto.randomBytes(32)) }), 'hmac_salah', 'rahasia lain');
  ditolak(R.periksaAmplopPasang(P.sah.amplop, { ...opsi, sekarang: P.isi.kedaluwarsa + 1 }), 'kedaluwarsa', 'QR lewat');
  ditolak(R.periksaAmplopPasang(P.sah.amplop, { ...opsi, macId: '0000000000000000' }), 'isi_tidak_cocok', 'mac lain');
  for (const r of P.rusak) ditolak(R.periksaAmplopPasang(r.amplop, opsi), r.alasan, r.label);
});

/* ---------- 4b. vektor-rusak.json (REV-21) ---------- */
bagian = 'vektor-rusak.json (REV-21, nama warisan prototipe)';
const VR = JSON.parse(fs.readFileSync(BERKAS_RUSAK, 'utf8'));
uji('berkas mutakhir (= buat-vektor.js)', () => {
  const keluar = {};
  susun(V, VR, keluar);
  benar(JSON.stringify(keluar.rusak, null, 2) + '\n' === fs.readFileSync(BERKAS_RUSAK, 'utf8'), 'vektor-rusak usang — jalankan node apk/kontrak/buat-vektor.js');
});
uji('isi minimum', () => {
  benar(Array.isArray(VR) && VR.length >= 6, '≥6 butir');
  for (const r of VR) {
    benar(typeof r.label === 'string' && r.amplop && typeof r.amplop === 'object' && V.alasan.includes(r.galat), 'bentuk butir ' + r.label);
  }
  for (const k of ['constructor', 'toString', '__proto__']) benar(VR.some(r => r.label === 'isi_field_' + k), 'isi_field_' + k);
});
for (const r of VR) uji(`rusak ${r.label} → ${r.galat}`, () => ditolak(R.periksaAmplop(r.amplop, opsiDariVektor(r.periksa, r.amplop)), r.galat));

/* ---------- 4c. vektor-cermin.json (APK v2 F1, KONTRAK-apk-v2 §2.1–2.2) ---------- */
bagian = 'vektor-cermin.json (APK v2 F1 cermin)';
const VC = JSON.parse(fs.readFileSync(BERKAS_CERMIN, 'utf8'));
uji('berkas mutakhir (= buat-vektor.js)', () => {
  const keluar = {};
  susun(V, VR, keluar, VC);
  benar(JSON.stringify(keluar.cermin, null, 2) + '\n' === fs.readFileSync(BERKAS_CERMIN, 'utf8'), 'vektor-cermin usang — jalankan node apk/kontrak/buat-vektor.js');
});
uji('isi minimum (tiap jenis baru + negatif)', () => {
  benar(VC.hanya_uji === true && VC.masa_maks_kabar_cermin_ms === 6 * 3600e3, 'hanya_uji / masa 6 jam');
  const jp = new Set(VC.sah.perintah.map(p => p.hasil.jenis)), jk = new Set(VC.sah.kabar.map(k => k.hasil.jenis));
  for (const j of ['cermin_daftar', 'cermin_buka', 'cermin_tutup', 'cermin_riwayat']) benar(jp.has(j) && R.JENIS_PERINTAH.includes(j), 'perintah ' + j);
  for (const j of ['cermin_sesi', 'cermin', 'cermin_riwayat']) benar(jk.has(j) && R.JENIS_KABAR.includes(j), 'kabar ' + j);
  benar(VC.rusak.length >= 30, '≥30 rusak');
  for (const r of VC.rusak) benar(V.alasan.includes(r.alasan), 'alasan dikenal ' + r.alasan);
});
for (const p of [...VC.sah.perintah, ...VC.sah.kabar]) {
  uji(`sah ${p.label}`, () => {
    const h = R.periksaAmplop(p.amplop, opsiDariVektor(p.periksa, p.amplop));
    benar(h.ok, 'ditolak: ' + h.alasan);
    sama(R.jcs(h.isi), p.antara.plaintext, 'plaintext'); sama(h.peran, p.hasil.peran, 'peran'); sama(h.isi.jenis, p.hasil.jenis, 'jenis');
  });
}
for (const r of VC.rusak) uji(`rusak ${r.label} → ${r.alasan}`, () => ditolak(R.periksaAmplop(r.amplop, opsiDariVektor(r.periksa, r.amplop)), r.alasan));

/* ---------- 5. kasus uji Sekar §6 (tingkat fungsi, kunci & jam nyata) ---------- */
bagian = 'Kasus Sekar §6 #1–4, #5, #6, #7';
const mac = R.buatKunciMac();
const hpR = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).privateKey;
const hpK = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).privateKey;
const asing = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).privateKey;
const ehp = crypto.generateKeyPairSync('x25519');
const MAC_ID = crypto.randomBytes(8).toString('hex'), PID = crypto.randomBytes(8).toString('hex');
const idR = R.idKunci(crypto.createPublicKey(hpR)), idK = R.idKunci(crypto.createPublicKey(hpK));
const dikenal = new Map([[idR, { publik: crypto.createPublicKey(hpR), peran: 'k_rencana', perangkat_id: PID }],
  [idK, { publik: crypto.createPublicKey(hpK), peran: 'k_kerjakan', perangkat_id: PID }]]);
let urut = 0;
function cmd({ kunci = hpR, jenis = 'minta_status', tambahan = {}, masa = 5 * 60e3, dibuat = Date.now(), ubah, ePenerima = mac.publik.e_mac } = {}) {
  const id = crypto.randomBytes(16).toString('hex');
  const isi = { mac_id: MAC_ID, perangkat_id: PID, id, urut: ++urut, dibuat, kedaluwarsa: dibuat + masa, jenis, ...tambahan };
  if (ubah) ubah(isi);
  return R._uji.susunAmplop({ jenis_kotak: 'perintah', kunciTanda: kunci, ePenerima, isi, kedaluwarsa: dibuat + masa, id }).amplop;
}
const opsiMac = (extra = {}) => ({ jenisKotak: 'perintah', kunciTandaDikenal: dikenal, kunciSandiSaya: mac.sandi.privat, macId: MAC_ID, ...extra });
const kerjakan = { tugas: 't', proyek: 'p', akun: 'a', mode: 'kerjakan', pesan: 'x', baru: false };
const flip = (s, i = 3) => { const b = dariB(s); b[i] ^= 1; return R.b64u(b); };

uji('buatAmplop publik + periksaAmplop pulang-pergi', () => {
  const a = R.buatAmplop({ jenis_kotak: 'perintah', kunciTanda: hpR, ePenerima: mac.publik.e_mac,
    isi: { mac_id: MAC_ID, perangkat_id: PID, id: '0'.repeat(32), urut: 1, dibuat: Date.now(), kedaluwarsa: Date.now() + 6e4, jenis: 'minta_status' },
    kedaluwarsa: Date.now() + 6e4 });
  benar(Object.keys(a).length === 9, '9 field');
  ditolak(R.periksaAmplop(a, opsiMac()), 'isi_tidak_cocok', 'buatAmplop memakai id acak ≠ isi.id');
});
uji('#1 tanpa tanda / tanda salah / kunci tak terdaftar', () => {
  const a = cmd();
  ditolak(R.periksaAmplop({ ...a, tanda: '' }, opsiMac()), 'bentuk', 'tanpa tanda');
  ditolak(R.periksaAmplop({ ...a, tanda: cmd().tanda }, opsiMac()), 'tanda_salah', 'tanda amplop lain');
  ditolak(R.periksaAmplop({ ...a, tanda: flip(a.tanda, 10) }, opsiMac()), 'tanda_salah', 'tanda 1 bit');
  ditolak(R.periksaAmplop(cmd({ kunci: asing }), opsiMac()), 'dari_tidak_dikenal', 'kunci asing');
  ditolak(R.periksaAmplop({ ...a, dari: R.idKunci(crypto.createPublicKey(asing)) }, opsiMac()), 'dari_tidak_dikenal', 'dari ditukar');
  const dicabut = new Map(dikenal); dicabut.set(idR, { ...dikenal.get(idR), dicabut: true });
  ditolak(R.periksaAmplop(a, opsiMac({ kunciTandaDikenal: dicabut })), 'dari_tidak_dikenal', 'perangkat dicabut (#9)');
  benar(R.periksaAmplop(a, opsiMac()).ok, 'amplop asli harus tetap sah');
});
uji('#1 tanda diverifikasi SEBELUM dekripsi', () => {
  const a = cmd();
  // ct rusak → bila dekripsi lebih dulu, alasan = dekripsi_gagal; harus tanda_salah
  ditolak(R.periksaAmplop({ ...a, ct: flip(a.ct) }, opsiMac()), 'tanda_salah', 'ct rusak');
  // ct sampah yang DITANDATANGANI kunci sah → lolos tanda, lalu gagal di dekripsi
  const ct = crypto.randomBytes(40);
  const H = Buffer.from(R.jcs(U.headerDari(a)));
  const tanda = crypto.sign('sha256', U.inputTanda(H, dariB(a.enc), ct), { key: hpR, dsaEncoding: 'der' });
  ditolak(R.periksaAmplop({ ...a, ct: R.b64u(ct), tanda: R.b64u(tanda) }, opsiMac()), 'dekripsi_gagal', 'ct sampah bertanda sah');
});
uji('#2 ubah ct / enc / header / ke / mac_id', () => {
  const a = cmd();
  ditolak(R.periksaAmplop({ ...a, ct: flip(a.ct, 0) }, opsiMac()), 'tanda_salah', 'ct');
  ditolak(R.periksaAmplop({ ...a, enc: flip(a.enc, 31) }, opsiMac()), 'tanda_salah', 'enc');
  ditolak(R.periksaAmplop({ ...a, kedaluwarsa: a.kedaluwarsa + 1 }, opsiMac()), 'tanda_salah', 'header kedaluwarsa');
  ditolak(R.periksaAmplop({ ...a, id: crypto.randomBytes(16).toString('hex') }, opsiMac()), 'tanda_salah', 'header id');
  ditolak(R.periksaAmplop({ ...a, ke: '0123456789abcdef' }, opsiMac()), 'ke_salah', 'ke');
  const lain = R.buatKunciMac();
  ditolak(R.periksaAmplop({ ...a, ke: lain.sandi.id }, opsiMac({ kunciSandiSaya: [mac.sandi.privat, lain.sandi.privat] })), 'tanda_salah', 'ke saat rotasi');
  ditolak(R.periksaAmplop(cmd({ ubah: i => { i.mac_id = 'ffffffffffffffff'; } }), opsiMac()), 'isi_tidak_cocok', 'mac_id lain');
  ditolak(R.periksaAmplop(cmd({ ubah: i => { i.perangkat_id = 'eeeeeeeeeeeeeeee'; } }), opsiMac()), 'isi_tidak_cocok', 'perangkat_id lain');
  ditolak(R.periksaAmplop(cmd({ ePenerima: lain.publik.e_mac }), opsiMac()), 'ke_salah', 'untuk Mac lain');
});
let folderUji;
uji('#3 replay sebelum & sesudah restart (penyimpan disk)', () => {
  folderUji = fs.mkdtempSync(path.join(os.tmpdir(), 'uji-kripto-'));
  const f = path.join(folderUji, 'id-amplop.json');
  const a = cmd();
  const p1 = R.buatPenyimpanReplayDisk(f);
  benar(R.periksaAmplop(a, opsiMac({ penyimpan: p1 })).ok, 'pertama harus sah');
  ditolak(R.periksaAmplop(a, opsiMac({ penyimpan: p1 })), 'replay_id', 'sebelum restart');
  sama((fs.statSync(f).mode & 0o777).toString(8), '600', 'izin id-amplop.json');
  const p2 = R.buatPenyimpanReplayDisk(f);           // "restart": muat ulang dari disk
  ditolak(R.periksaAmplop(a, opsiMac({ penyimpan: p2 })), 'replay_id', 'sesudah restart');
  benar(R.periksaAmplop(cmd(), opsiMac({ penyimpan: p2 })).ok, 'amplop baru sesudah restart');
  benar(fs.readdirSync(folderUji).every(n => !n.includes('.tmp-')), 'berkas sementara tertinggal');
  // amplop ditolak tidak boleh memakan id/urut
  const b = cmd(); ditolak(R.periksaAmplop({ ...b, tanda: '' }, opsiMac({ penyimpan: p2 })), 'bentuk');
  benar(R.periksaAmplop(b, opsiMac({ penyimpan: p2 })).ok, 'amplop sah setelah versi rusaknya ditolak');
});
uji('REV-22 tulisAman gagal → tidak meninggalkan .tmp-*', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'uji-tulis-'));
  try {
    fs.mkdirSync(path.join(d, 'kunci-mac-tanda.pem', 'isi'), { recursive: true });   // rename ke folder berisi → gagal
    melempar(() => R.simpanKunciMac(d, R.buatKunciMac()), 'rename ke folder');
    benar(fs.readdirSync(d).every(n => !n.includes('.tmp-')), 'berkas sementara tertinggal');
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});
uji('#3 penyimpan disk gagal tertutup', () => {
  const f = path.join(folderUji, 'id-amplop.json');
  fs.chmodSync(f, 0o644); melempar(() => R.buatPenyimpanReplayDisk(f), 'izin 644'); fs.chmodSync(f, 0o600);
  const rusak = path.join(folderUji, 'rusak.json'); fs.writeFileSync(rusak, '{bukan json', { mode: 0o600 });
  melempar(() => R.buatPenyimpanReplayDisk(rusak), 'JSON rusak');
  const tautan = path.join(folderUji, 'tautan.json'); fs.symlinkSync(f, tautan); melempar(() => R.buatPenyimpanReplayDisk(tautan), 'symlink');
  const p = R.buatPenyimpanReplayDisk(f);
  fs.chmodSync(folderUji, 0o500);
  try { ditolak(R.periksaAmplop(cmd(), opsiMac({ penyimpan: p })), 'penyimpan_gagal', 'folder tak bisa ditulis'); }
  finally { fs.chmodSync(folderUji, 0o700); }
});
uji('#4 urut sama/lebih kecil, dibuat 5 mnt di depan', () => {
  const p = R.buatPenyimpanReplayMemori();
  const a = cmd(), b = cmd(), c = cmd();
  benar(R.periksaAmplop(b, opsiMac({ penyimpan: p })).ok, 'b');
  ditolak(R.periksaAmplop(a, opsiMac({ penyimpan: p })), 'urut_lama', 'urut lebih kecil');
  const sama_ = cmd({ ubah: i => { i.urut = urut - 2; } });   // = urut b
  ditolak(R.periksaAmplop(sama_, opsiMac({ penyimpan: p })), 'urut_lama', 'urut sama');
  benar(R.periksaAmplop(c, opsiMac({ penyimpan: p })).ok, 'c');
  ditolak(R.periksaAmplop(cmd({ dibuat: Date.now() + 5 * 60e3 }), opsiMac()), 'dibuat_masa_depan', 'dibuat +5 mnt');
  benar(R.periksaAmplop(cmd({ dibuat: Date.now() + 60e3 }), opsiMac()).ok, 'dibuat +60 dtk (dalam toleransi) harus sah');
});
uji('#5 penahanan: Kerjakan 4 mnt, Rencana 11 mnt ditolak; hentikan 20 mnt diterima', () => {
  const t = Date.now();
  const k = cmd({ kunci: hpK, jenis: 'jalankan', tambahan: kerjakan, masa: 3 * 60e3, dibuat: t });
  ditolak(R.periksaAmplop(k, opsiMac({ sekarang: t + 4 * 60e3 })), 'kedaluwarsa', 'kerjakan 4 mnt');
  benar(R.periksaAmplop(k, opsiMac({ sekarang: t + 2 * 60e3 })).ok, 'kerjakan 2 mnt');
  const r = cmd({ jenis: 'jalankan', tambahan: { ...kerjakan, mode: 'rencana' }, masa: 10 * 60e3, dibuat: t });
  ditolak(R.periksaAmplop(r, opsiMac({ sekarang: t + 11 * 60e3 })), 'kedaluwarsa', 'rencana 11 mnt');
  const h = cmd({ jenis: 'hentikan', tambahan: { tugas: 't' }, masa: 30 * 60e3, dibuat: t });
  benar(R.periksaAmplop(h, opsiMac({ sekarang: t + 20 * 60e3 })).ok, 'hentikan 20 mnt');
  ditolak(R.periksaAmplop(cmd({ kunci: hpK, jenis: 'jalankan', tambahan: kerjakan, masa: 3 * 60e3 + 1 }), opsiMac()), 'masa_terlalu_panjang', 'kerjakan > 3 mnt');
  ditolak(R.periksaAmplop(cmd({ jenis: 'hentikan', tambahan: { tugas: 't' }, masa: 31 * 60e3 }), opsiMac()), 'masa_terlalu_panjang', 'hentikan > 30 mnt');
  ditolak(R.periksaAmplop(cmd({ masa: 11 * 60e3 }), opsiMac()), 'masa_terlalu_panjang', 'lainnya > 10 mnt');
});
uji('#6 v=0/2, field tambahan, suite/algoritma lain', () => {
  const a = cmd();
  ditolak(R.periksaAmplop({ ...a, v: 0 }, opsiMac()), 'versi', 'v0');
  ditolak(R.periksaAmplop({ ...a, v: 2 }, opsiMac()), 'versi', 'v2');
  ditolak(R.periksaAmplop({ ...a, v: '1' }, opsiMac()), 'bentuk', 'v string');
  ditolak(R.periksaAmplop({ ...a, suite: 'lain' }, opsiMac()), 'bentuk', 'field tambahan');
  ditolak(R.periksaAmplop({ ...a, enc: R.b64u(crypto.randomBytes(65)) }, opsiMac()), 'bentuk', 'enc 65 B (KEM P-256)');
  const p1363 = crypto.sign('sha256', Buffer.from('x'), { key: hpR, dsaEncoding: 'ieee-p1363' });
  ditolak(R.periksaAmplop({ ...a, tanda: R.b64u(p1363) }, opsiMac()), 'tanda_salah', 'tanda format P1363');
  const p384 = crypto.generateKeyPairSync('ec', { namedCurve: 'secp384r1' }).publicKey;
  const id384 = crypto.createHash('sha256').update(p384.export({ format: 'der', type: 'spki' })).digest('hex').slice(0, 16);
  const m = new Map(dikenal); m.set(id384, { publik: p384, peran: 'k_rencana', perangkat_id: PID });
  ditolak(R.periksaAmplop({ ...a, dari: id384 }, opsiMac({ kunciTandaDikenal: m })), 'dari_tidak_dikenal', 'kunci P-384 terdaftar');
  ditolak(R.periksaAmplop({ ...a, jenis_kotak: 'lain' }, opsiMac()), 'bentuk', 'jenis_kotak tak dikenal');
  ditolak(R.periksaAmplop(JSON.stringify(a).replace('{', '{"__proto__":{},'), opsiMac()), 'bentuk', '__proto__');
  ditolak(R.periksaAmplop('x'.repeat(R.MAKS_AMPLOP + 1), opsiMac()), 'bentuk', '> 96 KB');
  ditolak(R.periksaAmplop('bukan json', opsiMac()), 'bentuk', 'bukan JSON');
  ditolak(R.periksaAmplop(null, opsiMac()), 'bentuk', 'null');
});
uji('#7 Kerjakan bertanda K_rencana ditolak; K_kerjakan sah', () => {
  ditolak(R.periksaAmplop(cmd({ kunci: hpR, jenis: 'jalankan', tambahan: kerjakan, masa: 60e3 }), opsiMac()), 'kerjakan_tanpa_k_kerjakan');
  const h = R.periksaAmplop(cmd({ kunci: hpK, jenis: 'jalankan', tambahan: kerjakan, masa: 60e3 }), opsiMac());
  benar(h.ok && h.peran === 'k_kerjakan', 'kerjakan K_kerjakan');
  benar(R.periksaAmplop(cmd({ kunci: hpK, jenis: 'jalankan', tambahan: { ...kerjakan, mode: 'rencana' }, masa: 60e3 }), opsiMac()).ok, 'rencana boleh K_kerjakan');
});
uji('isi perintah ketat (field wajib/asing/pesan > 8000)', () => {
  ditolak(R.periksaAmplop(cmd({ jenis: 'jalankan', tambahan: { ...kerjakan, mode: 'rencana', pesan: 'x'.repeat(8001) } }), opsiMac()), 'isi_bentuk', 'pesan panjang');
  ditolak(R.periksaAmplop(cmd({ jenis: 'jalankan', tambahan: { ...kerjakan, mode: 'semua' } }), opsiMac()), 'isi_bentuk', 'mode tak dikenal');
  ditolak(R.periksaAmplop(cmd({ jenis: 'hapus_semua' }), opsiMac()), 'isi_bentuk', 'jenis tak dikenal');
  ditolak(R.periksaAmplop(cmd({ jenis: 'cabut_perangkat', tambahan: { perangkat_id_sasaran: 'x' } }), opsiMac()), 'isi_bentuk', 'sasaran salah');
  ditolak(R.periksaAmplop(cmd({ ubah: i => { i.urut = 1.5; } }), opsiMac()), 'isi_bentuk', 'urut pecahan');
});
uji('kabar Mac→HP: sah, peran salah, perangkat lain', () => {
  const dikenalHp = { [mac.tanda.id]: { publik: mac.publik.s_mac, peran: 's_mac' } };
  const buat = (kunci, ubah) => {
    const isi = { mac_id: MAC_ID, perangkat_id: PID, urut_mac: 1, dibuat: Date.now(), jenis: 'notif', notif: { j: 'selesai' } };
    if (ubah) ubah(isi);
    return R.buatAmplop({ jenis_kotak: 'kabar', kunciTanda: kunci, ePenerima: U.rawSandiPublik(ehp.publicKey), isi, kedaluwarsa: Date.now() + 3600e3 });
  };
  const o = { jenisKotak: 'kabar', kunciTandaDikenal: dikenalHp, kunciSandiSaya: ehp.privateKey, macId: MAC_ID, perangkatId: PID };
  benar(R.periksaAmplop(buat(mac.tanda.privat), o).ok, 'kabar sah');
  benar(Buffer.byteLength(JSON.stringify(buat(mac.tanda.privat))) <= 3072, 'amplop notif ≤ 3 KB');
  const salahPeran = { ...dikenalHp, [idR]: { publik: crypto.createPublicKey(hpR), peran: 'k_rencana' } };
  ditolak(R.periksaAmplop(buat(hpR), { ...o, kunciTandaDikenal: salahPeran }), 'peran_salah', 'kabar bertanda K_rencana');
  ditolak(R.periksaAmplop(buat(mac.tanda.privat, i => { i.perangkat_id = 'aaaaaaaaaaaaaaaa'; }), o), 'isi_tidak_cocok', 'kabar untuk HP lain');
  ditolak(R.periksaAmplop(buat(mac.tanda.privat, i => { i.mac_id = 1234567890123456; }), o), 'isi_bentuk', 'mac_id angka');
});
uji('kunci Mac: simpan/muat 0600, tolak izin longgar', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'uji-kunci-'));
  try {
    R.simpanKunciMac(d, mac);
    for (const n of fs.readdirSync(d)) sama((fs.statSync(path.join(d, n)).mode & 0o777).toString(8), '600', n);
    const m = R.muatKunciMac(d);
    sama(m.publik, mac.publik, 'publik');
    fs.chmodSync(path.join(d, 'kunci-mac-tanda.pem'), 0o640);
    melempar(() => R.muatKunciMac(d), 'izin 640');
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});
uji('darurat: hanya bentuk', () => {
  const a = { v: 1, jenis_kotak: 'darurat', dari: '', ke: '', id: 'a'.repeat(32), kedaluwarsa: Date.now() + 6e4, enc: '', ct: R.b64u(Buffer.from('{"kode":"ABCD-EFGH"}')), tanda: '' };
  sama(R.bacaAmplopDarurat(a), { id: a.id, kode: 'ABCD-EFGH' });
  benar(R.bacaAmplopDarurat({ ...a, tanda: 'AAAA' }) === null, 'tanda tak kosong diterima');
  benar(R.bacaAmplopDarurat({ ...a, ct: R.b64u(Buffer.from('[1]')) }) === null, 'ct bukan {kode}');
  ditolak(R.periksaAmplop(a, opsiMac()), 'jenis_kotak', 'darurat ke pemeriksa perintah');
});
if (folderUji) fs.rmSync(folderUji, { recursive: true, force: true });

/* ---------- ringkasan ---------- */
let total = 0, gagal = 0;
for (const [b, h] of Object.entries(hasil)) {
  total += h.lulus + h.gagal.length; gagal += h.gagal.length;
  console.log(`${h.gagal.length ? 'GAGAL' : 'LULUS'}  ${b}: ${h.lulus}/${h.lulus + h.gagal.length}`);
  for (const g of h.gagal) console.log('   - ' + g);
}
console.log(`Wycheproof: valid ${wp.valid}, invalid ${wp.invalid}, acceptable ${wp.acceptable} (acceptable = bebas, tidak dinilai)`);
console.log(gagal ? `HASIL: GAGAL ${gagal} dari ${total}` : `HASIL: LULUS ${total}/${total}`);
process.exit(gagal ? 1 : 0);
