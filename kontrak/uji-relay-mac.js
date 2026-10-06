#!/usr/bin/env node
// Uji unit P2 pelaksana-relay.js: atestasi (rantai uji), QR Terminal (dekode CoreImage), klien HTTP relay, URL relay, kode darurat.
// Pakai: node apk/kontrak/uji-relay-mac.js   (tanpa jaringan luar; server HTTP tiruan di 127.0.0.1 port acak)
'use strict';
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const R = require('../../_app_padev_studio_3d/pelaksana-relay.js');
const H = require('./hp-tiruan.js');

let lulus = 0, gagal = 0;
const cek = (nama, ok, info = '') => { if (ok) lulus++; else { gagal++; console.log(`GAGAL ${nama} ${info}`); } };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'uji-relay-mac-'));

// ---------- atestasi ----------
const akar = H.buatAkarUji(), akarLain = H.buatAkarUji();
const kr = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const spki = R.b64u(kr.publicKey.export({ type: 'spki', format: 'der' }));
const tantangan = crypto.randomBytes(32), digest = H.SERTIFIKAT_APK_UJI;
const dasar = { digest, tantangan, jenisAuth: 3, batas: 300 };
const opsi = { spki, tantangan, kerjakan: false, sertifikatApk: [digest], akar: [akar.spkiB64] };
const at = (o = {}, p = {}) => R.periksaAtestasi(H.rantaiAtestasi(akar, kr.publicKey, { ...dasar, ...o }), { ...opsi, ...p });
cek('atestasi sah (TEE)', at().ok && at().tingkat === 'TEE');
cek('atestasi StrongBox', at({ tingkat: 2 }).tingkat === 'StrongBox');
cek('kerjakan sah (biometrik, tanpa batas)', at({ jenisAuth: 2, batas: 0 }, { kerjakan: true }).ok);
const tolak = (nama, h, alasan) => cek(nama, !h.ok && h.alasan === alasan, JSON.stringify(h));
tolak('akar tidak dipin', at({}, { akar: [] }), 'atestasi_akar');
tolak('akar lain', R.periksaAtestasi(H.rantaiAtestasi(akarLain, kr.publicKey, dasar), opsi), 'atestasi_akar');
tolak('tanda daun dari kunci lain', at({ kunciPenerbit: akarLain.privat }), 'atestasi_rantai');
tolak('rantai 1 sertifikat', R.periksaAtestasi(H.rantaiAtestasi(akar, kr.publicKey, dasar).slice(0, 1), opsi), 'atestasi_rantai');
tolak('rantai bukan larik', R.periksaAtestasi('x', opsi), 'atestasi_rantai');
tolak('b64u rusak', R.periksaAtestasi(['@@', '@@'], opsi), 'atestasi_rantai');
tolak('kunci daun ≠ k_rencana', at({}, { spki: R.b64u(crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).publicKey.export({ type: 'spki', format: 'der' })) }), 'atestasi_kunci');
tolak('tingkat software (emulator)', at({ tingkat: 0 }), 'atestasi_tingkat');
tolak('tantangan lain', at({ tantangan: crypto.randomBytes(32) }), 'atestasi_tantangan');
tolak('paket lain', at({ paket: 'com.lain.app' }), 'atestasi_paket');
tolak('sertifikat APK lain', at({ digest: crypto.randomBytes(32).toString('hex') }), 'atestasi_sertifikat_apk');
tolak('sertifikat APK kosong di konfigurasi', at({}, { sertifikatApk: [] }), 'atestasi_sertifikat_apk');
tolak('kurva lain', at({ kurva: 2 }), 'atestasi_otorisasi');
tolak('tanpa auth (noAuthRequired)', at({ tanpaAuth: true }), 'atestasi_otorisasi');
tolak('rencana batas > 300', at({ batas: 600 }), 'atestasi_otorisasi');
tolak('kerjakan boleh PIN (jenis 3)', at({ jenisAuth: 3, batas: 0 }, { kerjakan: true }), 'atestasi_otorisasi');
tolak('kerjakan dengan batas waktu', at({ jenisAuth: 2, batas: 30 }, { kerjakan: true }), 'atestasi_otorisasi');
tolak('rencana hanya PIN (jenis 1)', at({ jenisAuth: 1 }), 'atestasi_otorisasi');
const akarGoogle = crypto.createPublicKey({ key: Buffer.from(R.AKAR_GOOGLE_SPKI[0], 'base64'), format: 'der', type: 'spki' });
cek('akar Google terurai RSA-4096', akarGoogle.asymmetricKeyDetails.modulusLength === 4096);

// ---------- P4: atestasi SEC-82 / SEC-83 / SEC-84 / REV-30 ----------
const shaSpki = b64 => crypto.createHash('sha256').update(Buffer.from(b64, 'base64')).digest('hex');
cek('SEC-83 akar RSA dipin = SPKI sha256 resmi feb2ea75…', shaSpki(R.AKAR_GOOGLE_SPKI[0]) === 'feb2ea7551ee316ed4bb443c8293b884dbfdea40b603ee3e4f4a897e4580fbae');
cek('SEC-83 akar ECDSA "Key Attestation CA1" dipin = 3ee44512…', R.AKAR_GOOGLE_SPKI.length === 2 && shaSpki(R.AKAR_GOOGLE_SPKI[1]) === '3ee44512a1af2beb39c889490c60ea3f82e43f5d5a5532f5ab9419f676cd07ec'
  && crypto.createPublicKey({ key: Buffer.from(R.AKAR_GOOGLE_SPKI[1], 'base64'), format: 'der', type: 'spki' }).asymmetricKeyDetails.namedCurve === 'secp384r1');
cek('SHA_AKAR_GOOGLE sama dengan daftar akar', R.AKAR_GOOGLE_SPKI.every((s, i) => shaSpki(s) === R.SHA_AKAR_GOOGLE[i]));
// SEC-82: PoC Sekar — daun palsu ditandatangani kunci atestasi asli penyerang
const kPalsu = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const spkiPalsu = R.b64u(kPalsu.publicKey.export({ type: 'spki', format: 'der' }));
const poc = R.periksaAtestasi(H.rantaiPocSec82(akar, kPalsu.publicKey, dasar), { ...opsi, spki: spkiPalsu });
tolak('SEC-82 PoC Sekar [daun palsu, daun asli, akar] → atestasi_rantai', poc, 'atestasi_rantai');
cek('SEC-82 PoC: pesan menyebut ekstensi ganda', /tepat satu/.test(poc.pesan), poc.pesan);
tolak('SEC-82 PoC dengan perantara', R.periksaAtestasi(H.rantaiPocSec82(akar, kPalsu.publicKey, { ...dasar, perantara: true }), { ...opsi, spki: spkiPalsu }), 'atestasi_rantai');
cek('SEC-82 rantai sah dengan perantara CA', at({ perantara: true }).ok);
tolak('SEC-82 ekstensi atestasi juga di perantara', at({ perantara: true, kdDiPerantara: true }), 'atestasi_rantai');
tolak('SEC-82 perantara bukan CA', at({ perantara: true, perantaraBukanCa: true }), 'atestasi_rantai');
tolak('SEC-82 daun bertanda CA', at({ daunCa: true }), 'atestasi_rantai');
const akarBukanCa = H.buatAkarUji({ ca: false });
tolak('SEC-82 akar tanpa tanda CA', R.periksaAtestasi(H.rantaiAtestasi(akarBukanCa, kr.publicKey, dasar), { ...opsi, akar: [akarBukanCa.spkiB64] }), 'atestasi_rantai');
// SEC-84: tag di daftar yang benar + rootOfTrust
const pesanCocok = (nama, h, alasan, pola) => cek(nama, !h.ok && h.alasan === alasan && pola.test(h.pesan), JSON.stringify(h));
pesanCocok('SEC-84 userAuthType (504) di softwareEnforced', at({ keLunak: [504] }), 'atestasi_otorisasi', /userAuthType tidak dijaga hardware/);
pesanCocok('SEC-84 authTimeout (505) di softwareEnforced', at({ keLunak: [505] }), 'atestasi_otorisasi', /authTimeout tidak dijaga hardware/);
pesanCocok('SEC-84 noAuthRequired (503) di softwareEnforced', at({ tanpaAuth: true, keLunak: [503] }), 'atestasi_otorisasi', /noAuthRequired/);
const di509Keras = at({ udrKeras: true });
cek('SEC-84 unlockedDeviceRequired (509) di hardwareEnforced boleh', di509Keras.ok, JSON.stringify(di509Keras));
cek('SEC-84 509 di softwareEnforced boleh (bawaan rantai uji)', at().ok);
cek('SEC-84 kerjakan sah dengan 509 di keras', at({ jenisAuth: 2, batas: 0, udrKeras: true }, { kerjakan: true }).ok);
pesanCocok('SEC-84 origin (702) tidak ada', at({ tanpaOrigin: true }), 'atestasi_otorisasi', /origin/);
pesanCocok('SEC-84 origin = IMPORTED', at({ origin: 2 }), 'atestasi_otorisasi', /origin/);
pesanCocok('SEC-84 origin hanya di softwareEnforced', at({ keLunak: [702] }), 'atestasi_otorisasi', /origin/);
pesanCocok('SEC-84 attestationApplicationId (709) di hardwareEnforced', at({ appKeras: true }), 'atestasi_paket', /attestationApplicationId tidak ada/);
pesanCocok('SEC-84 bootloader tidak terkunci', at({ terkunci: false }), 'atestasi_bootloader', /bootloader tidak terkunci/);
pesanCocok('SEC-84 verifiedBootState Unverified', at({ statusBoot: 2 }), 'atestasi_boot', /verifiedBootState bukan Verified/);
pesanCocok('SEC-84 verifiedBootState SelfSigned', at({ statusBoot: 1 }), 'atestasi_boot', /Verified/);
pesanCocok('SEC-84 rootOfTrust tidak ada', at({ tanpaRot: true }), 'atestasi_bootloader', /rootOfTrust/);
pesanCocok('SEC-84 rootOfTrust hanya di softwareEnforced', at({ keLunak: [704] }), 'atestasi_bootloader', /rootOfTrust/);
// SEC-83: masa berlaku + daftar cabut
pesanCocok('SEC-83 daun kedaluwarsa', at({ berlakuDaun: ['200101000000Z', '210101000000Z'] }), 'atestasi_kedaluwarsa', /masa berlaku/);
tolak('SEC-83 perantara belum berlaku', at({ perantara: true, berlakuPerantara: ['400101000000Z', '450101000000Z'] }), 'atestasi_kedaluwarsa');
cek('SEC-83 notBefore 3 mnt di depan jam Mac masih diterima (toleransi 5 mnt)', at({}, { sekarang: Date.parse('2024-12-31T23:57:00Z') }).ok);
tolak('SEC-83 sekarang di luar masa berlaku (opsi sekarang)', at({}, { sekarang: Date.parse('2050-01-01T00:00:00Z') }), 'atestasi_kedaluwarsa');
const statusUji = R.uraiStatusAtestasi({ entries: { '0a0b0c0d0e': { status: 'REVOKED', reason: 'KEY_COMPROMISE' }, 'ABCDEF1234': { status: 'SUSPENDED' }, '77': { status: 'LAIN' }, 'zz': { status: 'REVOKED' } } });
cek('SEC-83 uraiStatusAtestasi: nol depan dibuang, huruf kecil, kunci rusak dilewati', statusUji.get('a0b0c0d0e') === 'REVOKED' && statusUji.get('abcdef1234') === 'SUSPENDED' && !statusUji.has('zz') && statusUji.size === 3);
let lemparStatus = false; try { R.uraiStatusAtestasi({ entri: {} }); } catch { lemparStatus = true; }
cek('SEC-83 daftar status berbentuk salah → throw', lemparStatus);
const cabutDaun = at({ serialDaun: 0x0a0b0c0d0e }, { statusCabut: statusUji });
pesanCocok('SEC-83 serial daun REVOKED → atestasi_dicabut', cabutDaun, 'atestasi_dicabut', /dicabut Google \(serial a0b0c0d0e\)/);
tolak('SEC-83 serial perantara SUSPENDED → atestasi_dicabut', at({ perantara: true, serialPerantara: 0xabcdef1234 }, { statusCabut: statusUji }), 'atestasi_dicabut');
cek('SEC-83 status lain (bukan REVOKED/SUSPENDED) tidak menolak', at({ serialDaun: 0x77 }, { statusCabut: statusUji }).ok);
cek('SEC-83 statusCabut null = tidak dicek (owner "lanjut tanpa cek cabut")', at({ serialDaun: 0x0a0b0c0d0e }, { statusCabut: null }).ok);
const tanpaAkar = at({}, { akar: [] });
cek('REV-30 atestasi_akar mencetak SHA-256 SPKI akar', tanpaAkar.alasan === 'atestasi_akar' && tanpaAkar.pesan === 'akar tak dikenal: SPKI sha256=' + shaSpki(akar.spkiB64), tanpaAkar.pesan);
// REV-30: rantai atestasi NYATA (android/keyattestation testdata) — urai & pemeriksaan rantai terhadap data sungguhan
const NYATA = JSON.parse(fs.readFileSync(path.join(__dirname, 'atestasi-nyata.json'), 'utf8'));
const nyata = n => NYATA.rantai.find(r => r.nama === n);
const spkiDaun = r => R.b64u(new crypto.X509Certificate(R.dariB64u(r.rantai[0])).publicKey.export({ type: 'spki', format: 'der' }));
const opsiNyata = (r, p = {}) => ({ spki: spkiDaun(r), tantangan: Buffer.from(r.diharapkan.tantangan_b64, 'base64'), kerjakan: false, sertifikatApk: r.diharapkan.digest,
  akar: [], statusCabut: new Map(), ...(r.sekarang ? { sekarang: r.sekarang } : {}), ...p });
for (const n of ['caiman_sdk36_TEE_EC_RKP', 'caiman_sdk36_SB_EC_RKP', 'akita_sdk34_TEE_EC_NONE', 'tegu_sdk36_TEE_EC_2026_ROOT', 'tegu_sdk36_SB_EC_2026_ROOT', 'frankel_sdk37_TEE_EC_2026']) {
  const r = nyata(n), e = r.diharapkan;
  const kd = R.uraiKeyDescription(R.dariB64u(r.rantai[0]));
  const rot = R._uji.uraiRootOfTrust(kd.keras.get(704)), app = R._uji.uraiAppId(kd.lunak.get(709));
  cek(`REV-30 nyata ${n}: tingkat/tantangan/rootOfTrust/paket/digest sama dengan .json resmi`, kd.tingkat === e.tingkat && kd.tantangan.equals(Buffer.from(e.tantangan_b64, 'base64'))
    && rot.terkunci === e.terkunci && rot.status === e.statusBoot && kd.keras.has(503) === e.noAuthRequired && !kd.keras.has(709)
    && JSON.stringify(app.paket) === JSON.stringify(e.paket) && JSON.stringify(app.digest) === JSON.stringify(e.digest), JSON.stringify({ kd: kd.tingkat, rot, app }));
  const h = R.periksaAtestasi(r.rantai, opsiNyata(r));
  // rantai, akar, CA, ekstensi tunggal, masa berlaku, daftar cabut, kunci, bentuk, tingkat, tantangan LOLOS; ditolak di kebijakan otorisasi
  // (kunci uji Google memakai noAuthRequired + paket lain) — membuktikan pengurai membaca struktur nyata sampai tahap kebijakan
  cek(`REV-30 nyata ${n}: lolos sampai kebijakan otorisasi (noAuthRequired)`, !h.ok && h.alasan === 'atestasi_otorisasi' && /noAuthRequired/.test(h.pesan), JSON.stringify(h));
}
const tegu = nyata('tegu_sdk36_TEE_EC_2026_ROOT');
pesanCocok('REV-30 nyata akar ECDSA: di luar masa berlaku RKP (sekarang) → kedaluwarsa', R.periksaAtestasi(tegu.rantai, opsiNyata(tegu, { sekarang: Date.parse('2026-10-06T00:00:00Z') })), 'atestasi_kedaluwarsa', /sertifikat ke-1/);
const serialPerantaraTegu = new crypto.X509Certificate(R.dariB64u(tegu.rantai[1])).serialNumber.toLowerCase();
tolak('REV-30 nyata akar ECDSA: serial perantara di daftar cabut → dicabut', R.periksaAtestasi(tegu.rantai, opsiNyata(tegu, { statusCabut: R.uraiStatusAtestasi({ entries: { [serialPerantaraTegu]: { status: 'REVOKED' } } }) })), 'atestasi_dicabut');
const caiman = nyata('caiman_sdk36_TEE_EC_RKP');
cek('REV-30 nyata akar RSA f92009e853b6b045: masa berlaku tidak dicek (pengecualian Google)', R.periksaAtestasi(caiman.rantai, opsiNyata(caiman, { sekarang: Date.parse('2030-01-01T00:00:00Z') })).alasan === 'atestasi_otorisasi');
const caimanRusak = caiman.rantai.slice(); { const b = R.dariB64u(caimanRusak[2]); b[b.length - 5] ^= 1; caimanRusak[2] = R.b64u(b); }
tolak('REV-30 nyata: tanda tangan perantara diubah 1 bit → rantai', R.periksaAtestasi(caimanRusak, opsiNyata(caiman)), 'atestasi_rantai');
tolak('REV-30 nyata: tanpa akar (rantai dipotong) → akar', R.periksaAtestasi(caiman.rantai.slice(0, 3), opsiNyata(caiman)), 'atestasi_akar');
tolak('REV-30 nyata: kunci dipasang ≠ daun → kunci', R.periksaAtestasi(caiman.rantai, opsiNyata(caiman, { spki })), 'atestasi_kunci');
const sony = nyata('sony-xperia10-iii_sdk33_TEE_EC');
pesanCocok('REV-30 nyata Sony (perantara pabrik tanpa tanda CA) → ditolak aturan SEC-82', R.periksaAtestasi(sony.rantai, opsiNyata(sony)), 'atestasi_rantai', /penerbit ke-1 bukan CA/);
// REV-48 / KONTRAK §9.1 K6: batasan diterima — pesan memberi petunjuk ke owner, dan TIDAK ada jalan pintas lewat konfigurasi
pesanCocok('REV-48 Sony: pesan menyebut "sertifikat pabrik lama belum didukung (SEC-82)"', R.periksaAtestasi(sony.rantai, opsiNyata(sony)), 'atestasi_rantai',
  /penerbit ke-1 bukan CA .* HP dengan sertifikat pabrik lama belum didukung \(SEC-82\)/);
const spkiAkarSony = new crypto.X509Certificate(R.dariB64u(sony.rantai[sony.rantai.length - 1])).publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
const sonyLonggar = R.periksaAtestasi(sony.rantai, opsiNyata(sony, { akar: [spkiAkarSony], statusCabut: null, sekarang: sony.sekarang || Date.now() }));
tolak('REV-48 Sony tetap ditolak walau akar ditambah di atestasiAkar + tanpa cek cabut (tanpa bypass)', sonyLonggar, 'atestasi_rantai');
const invalidRot = nyata('invalid_rot');
let rotLempar = false; try { R._uji.uraiRootOfTrust(R.uraiKeyDescription(R.dariB64u(invalidRot.rantai[0])).keras.get(704)); } catch { rotLempar = true; }
cek('REV-30 nyata malformed_rot_device_locked (BOOLEAN 0x01) → rootOfTrust ditolak', rotLempar);
cek('REV-30 berkas nyata bersumber + sha256', NYATA.rantai.every(r => /^https:\/\/github\.com\/android\/keyattestation\/blob\/[0-9a-f]{40}\//.test(r.sumber) && /^[0-9a-f]{64}$/.test(r.sha256_sumber)));

// ---------- QR Terminal → PNG → CoreImage ----------
const qrUji = JSON.stringify({ v: 1, relay: R.URL_RELAY, mac_id: 'dac41f4ed3e1ec5d', nama_mac: 'MacBook-Pro-Uji', kode_daftar: crypto.randomBytes(16).toString('hex'),
  rahasia: R.b64u(crypto.randomBytes(32)), s_mac: R.b64u(kr.publicKey.export({ type: 'spki', format: 'der' })), e_mac: R.b64u(crypto.randomBytes(32)), kedaluwarsa: Date.now() });
const q = R.qrMatriks(qrUji);
const files = [];
for (const tepi of [4, 2]) {
  const t = R.qrTerminal(q, { tepi });
  const f = path.join(tmp, `qr-${tepi}.png`); H.tulisPng(f, H.matriksDariTerminal(t.baris)); files.push(f);
}
console.log(`QR kontrak: ${Buffer.byteLength(qrUji)} byte → versi ${q.versi}-${q.ecc}, ${q.ukuran} modul, lebar Terminal ${q.ukuran + 8} kolom (tepi 4)`);
const dek = H.dekodeQr(tmp, files);
if (dek === null) console.log('LEWATI dekode QR: osascript/CoreImage tidak tersedia');
else { cek('QR terminal (tepi 4) terbaca CoreImage', dek[0] === qrUji); cek('QR terminal (tepi 2) terbaca CoreImage', dek[1] === qrUji); }

// ---------- URL relay ----------
const salahUrl = (u, uji) => { try { R.urlRelay(u, { uji }); return false; } catch { return true; } };
cek('url produksi tepat', R.urlRelay(R.URL_RELAY) === R.URL_RELAY);
cek('http ditolak produksi', salahUrl('http://padev-studio.pa-developer.pro/api/v1/'));
cek('host lain ditolak', salahUrl('https://evil.example/api/v1/'));
cek('path lain ditolak', salahUrl('https://padev-studio.pa-developer.pro/api/v2/'));
cek('kredensial ditolak', salahUrl('https://a:b@padev-studio.pa-developer.pro/api/v1/'));
cek('lokal ditolak tanpa uji', salahUrl('http://127.0.0.1:4640/'));
cek('lokal boleh saat uji', !salahUrl('http://127.0.0.1:4640/', true));
cek('lokal non-loopback ditolak saat uji', salahUrl('http://10.0.0.2:4640/', true));

// ---------- kode darurat ----------
const kd = R.buatKodeDarurat();
cek('kode darurat 25 base32 bergrup', /^([A-Z2-7]{5}-){4}[A-Z2-7]{5}$/.test(kd));
fs.mkdirSync(path.join(tmp, 'f'), { mode: 0o700 });
fs.writeFileSync(path.join(tmp, 'f', 'kode-darurat.hash'), R.hashKodeDarurat(kd) + '\n', { mode: 0o600 });
cek('kode darurat cocok (huruf kecil/spasi)', R.cocokKodeDarurat(path.join(tmp, 'f'), kd.toLowerCase().replace(/-/g, ' ')));
cek('kode darurat salah ditolak', !R.cocokKodeDarurat(path.join(tmp, 'f'), R.buatKodeDarurat()));
cek('kode darurat bentuk aneh ditolak', !R.cocokKodeDarurat(path.join(tmp, 'f'), { kode: kd }));

// ---------- P4: K1 tugas ulang (SEC-87) · K2 berkas aman · SEC-88 kunci perangkat · K5 URL darurat ----------
const PID1 = 'a'.repeat(16), PID2 = 'b'.repeat(16);
const pm = R.buatPenyimpanReplayMemori();
cek('K1 tugas baru → hasilTugas null', pm.hasilTugas(PID1, 't-1') === null);
pm.catatTugas(PID1, 't-1', 'diterima'); pm.catatTugas(PID1, 't-1', 'selesai');
cek('K1 hasil terakhir diperbarui (diterima → selesai)', pm.hasilTugas(PID1, 't-1') === 'selesai');
cek('K1 catatan tugas per perangkat', pm.hasilTugas(PID2, 't-1') === null);
pm.catatTugas(PID1, 't-2', 'diterima'); pm.catatTugas(PID1, 't-2', null);
cek('K1 catatTugas null (pagar laptop menolak) → boleh dicoba lagi', pm.hasilTugas(PID1, 't-2') === null);
Object.values(pm.data.tugas)[0].waktu = Date.now() - 24 * 3600e3 - 1000;
cek('K1 catatan > 24 jam tidak berlaku', pm.hasilTugas(PID1, 't-1') === null);
// REV-47: catatan diterima|mulai milik proses lama → gagal; tahap akhir tidak disentuh; waktu > batas tidak disentuh
const pt = R.buatPenyimpanReplayMemori();
pt.catatTugas(PID1, 't-a', 'diterima'); pt.catatTugas(PID1, 't-b', 'mulai'); pt.catatTugas(PID2, 't-c', 'mulai'); pt.catatTugas(PID1, 't-d', 'selesai');
pt.catatTugas(PID1, 't-e', 'dihentikan');
const batasT = Date.now() + 1;
cek('REV-47 tandaiTerputus: 3 catatan terbuka → gagal', pt.tandaiTerputus(batasT) === 3 && ['t-a', 't-b'].every(t => pt.hasilTugas(PID1, t) === 'gagal') && pt.hasilTugas(PID2, 't-c') === 'gagal');
cek('REV-47 tandaiTerputus: tahap akhir tetap', pt.hasilTugas(PID1, 't-d') === 'selesai' && pt.hasilTugas(PID1, 't-e') === 'dihentikan');
pt.data.tugas[PID1 + '|t-f'] = { hasil: 'mulai', waktu: batasT + 60000 };
cek('REV-47 tandaiTerputus: catatan sesudah batas waktu tidak disentuh', pt.tandaiTerputus(batasT) === 0 && pt.hasilTugas(PID1, 't-f') === 'mulai');
const dRep = path.join(tmp, 'rep'); fs.mkdirSync(dRep, { mode: 0o700 });
const fRep = path.join(dRep, 'id-amplop.json');
const pd = R.buatPenyimpanReplayDisk(fRep);
cek('K1 disk: catatTugas tertulis', pd.catatTugas(PID1, 't-3', 'mulai') === true && (fs.statSync(fRep).mode & 0o777) === 0o600);
cek('K1 disk: bertahan setelah muat ulang (restart pelaksana)', R.buatPenyimpanReplayDisk(fRep).hasilTugas(PID1, 't-3') === 'mulai');
const pdT = R.buatPenyimpanReplayDisk(fRep);
cek('REV-47 disk: tandaiTerputus menulis gagal & bertahan setelah muat ulang', pdT.tandaiTerputus(Date.now()) === 1 && R.buatPenyimpanReplayDisk(fRep).hasilTugas(PID1, 't-3') === 'gagal');
cek('REV-47 disk: tidak ada yang terbuka → 0 (tanpa tulis)', pdT.tandaiTerputus(Date.now()) === 0);
pdT.catatTugas(PID1, 't-5', 'mulai');
fs.chmodSync(dRep, 0o500);
const gagalTulis = pdT.tandaiTerputus(Date.now());
fs.chmodSync(dRep, 0o700);
cek('REV-47 disk: gagal tulis → -1 dan data di memori tidak berubah', gagalTulis === -1 && pdT.hasilTugas(PID1, 't-5') === 'mulai', String(gagalTulis));
fs.writeFileSync(fRep, JSON.stringify({ v: 1, urut: {}, id: {} }), { mode: 0o600 });
cek('K1 disk: berkas lama tanpa `tugas` tetap terbaca', R.buatPenyimpanReplayDisk(fRep).hasilTugas(PID1, 't-3') === null);
fs.writeFileSync(fRep, JSON.stringify({ v: 1, urut: {}, id: {}, tugas: { [PID1 + '|t-4']: { hasil: 'aneh', waktu: Date.now() } } }), { mode: 0o600 });
cek('K1 disk: entri tugas tidak sah dilewati', R.buatPenyimpanReplayDisk(fRep).hasilTugas(PID1, 't-4') === null);
fs.writeFileSync(fRep, JSON.stringify({ v: 1, urut: {}, id: {}, tugas: [] }), { mode: 0o600 });
let rusakTugas = false; try { R.buatPenyimpanReplayDisk(fRep); } catch { rusakTugas = true; }
cek('K1 disk: `tugas` berbentuk salah → throw (gagal tertutup)', rusakTugas);
// tanda_terima `hasil_terakhir` (kontrak §9 K1): hanya bersama alasan tugas_ulang, nilai dari daftar hasil
const km = R.buatKunciMac(), hpK = H.buatHp('HP K1'); hpK.perangkat_id = PID1;
const qrK = { s_mac: km.publik.s_mac, mac_id: 'c'.repeat(16) };
let urutK = 1;
const ttK = tt => { const kini = Date.now(); return H.bukaKabar(hpK, qrK, R.buatAmplop({ jenis_kotak: 'kabar', kunciTanda: km.tanda.privat, ePenerima: hpK.e_hp,
  isi: { mac_id: qrK.mac_id, perangkat_id: PID1, urut_mac: urutK++, dibuat: kini, jenis: 'tanda_terima',
    tanda_terima: { perintah_id: 'd'.repeat(32), perintah_sha256: 'e'.repeat(64), ...tt } }, kedaluwarsa: kini + 60000 }), R.buatPenyimpanReplayMemori()); };
cek('K1 tanda_terima tugas_ulang + hasil_terakhir sah', ttK({ hasil: 'ditolak', alasan: 'tugas_ulang', hasil_terakhir: 'selesai' }).ok);
tolak('K1 hasil_terakhir tanpa alasan tugas_ulang', ttK({ hasil: 'ditolak', alasan: 'lain', hasil_terakhir: 'selesai' }), 'isi_bentuk');
tolak('K1 hasil_terakhir di luar daftar', ttK({ hasil: 'ditolak', alasan: 'tugas_ulang', hasil_terakhir: 'aneh' }), 'isi_bentuk');
cek('K1 tugas_ulang tanpa hasil_terakhir tetap sah (opsional)', ttK({ hasil: 'ditolak', alasan: 'tugas_ulang' }).ok);
// K2: satu sumber berkas aman
cek('K2 ekspor cekAman/tulisAman', typeof R.cekAman === 'function' && typeof R.tulisAman === 'function');
const fAman = path.join(dRep, 'aman.txt');
R.tulisAman(fAman, 'isi');
cek('K2 tulisAman 0600 + tanpa sisa .tmp', fs.readFileSync(fAman, 'utf8') === 'isi' && (fs.statSync(fAman).mode & 0o777) === 0o600 && !fs.readdirSync(dRep).some(n => n.includes('.tmp')));
fs.symlinkSync(fAman, path.join(dRep, 'tautan'));
let tolakSym = false; try { R.cekAman(path.join(dRep, 'tautan')); } catch { tolakSym = true; }
cek('K2 cekAman menolak symlink', tolakSym);
fs.chmodSync(fAman, 0o644);
let tolakLonggar = false; try { R.cekAman(fAman, { rahasia: true }); } catch { tolakLonggar = true; }
cek('K2 cekAman rahasia menolak 0644', tolakLonggar);
const dLonggar = path.join(tmp, 'longgar'); fs.mkdirSync(dLonggar); fs.chmodSync(dLonggar, 0o777);
let tolakFolder = false; try { R.tulisAman(path.join(dLonggar, 'x'), 'y'); } catch { tolakFolder = true; }
cek('K2 tulisAman menolak folder bisa ditulis lainnya', tolakFolder && !fs.existsSync(path.join(dLonggar, 'x')));
cek('K3 ekspor cliRelayRotasi', typeof R.cliRelayRotasi === 'function');
// SEC-88: kunci O_EXCL di sekitar ubahPerangkat
const dPer = path.join(tmp, 'per'); fs.mkdirSync(dPer, { mode: 0o700 });
cek('SEC-88 ubahPerangkat jalan & kunci dilepas', R._uji.ubahPerangkat(dPer, l => l.length) === 0 && !fs.existsSync(path.join(dPer, R.BERKAS.kunciPerangkat)));
const anak = require('child_process').spawn(process.execPath, ['-e', 'setTimeout(() => {}, 20000)'], { stdio: 'ignore' });
fs.writeFileSync(path.join(dPer, R.BERKAS.kunciPerangkat), String(anak.pid), { mode: 0o600 });
const t0 = Date.now(); let tolakKunci = '';
try { R._uji.ubahPerangkat(dPer, () => true); } catch (e) { tolakKunci = e.message; }
cek('SEC-88 kunci dipegang proses hidup → menunggu ≤5 dtk lalu throw', /sedang dipakai/.test(tolakKunci) && Date.now() - t0 >= 4500, tolakKunci);
anak.kill();
fs.writeFileSync(path.join(dPer, R.BERKAS.kunciPerangkat), '999999', { mode: 0o600 });
cek('SEC-88 kunci basi (pemilik mati) dibuang', R._uji.ubahPerangkat(dPer, () => 'ok') === 'ok' && !fs.existsSync(path.join(dPer, R.BERKAS.kunciPerangkat)));
// K5: pesan CLI darurat menunjuk halaman darurat statis
cek('K5 URL_DARURAT = https://padev-studio.pa-developer.pro/', R.URL_DARURAT === 'https://padev-studio.pa-developer.pro/');
const keluarDarurat = [];
R.cliDaruratBaru({ folder: dRep, tulis: t => keluarDarurat.push(t) });
cek('K5 --darurat-baru menunjuk URL halaman darurat', keluarDarurat.some(t => t.includes('halaman darurat https://padev-studio.pa-developer.pro/ ')), keluarDarurat.join('|'));

// ---------- klien HTTP relay (server tiruan) ----------
(async () => {
  let terakhir = null;
  const srv = http.createServer((req, res) => {
    let b = ''; req.on('data', c => { b += c; }); req.on('end', () => {
      terakhir = { url: req.url, h: req.headers, b };
      if (req.url.startsWith('/alih')) { res.writeHead(302, { Location: 'http://127.0.0.1:1/' }); return res.end(); }
      if (req.url.startsWith('/besar')) { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end('{"ok":true,"data":{"x":"' + 'a'.repeat(2 * 1024 * 1024) + '"}}'); }
      if (req.url.startsWith('/lambat')) return setTimeout(() => res.end('{}'), 3000);
      if (req.url.startsWith('/galat')) { res.writeHead(429, { 'Retry-After': '900' }); return res.end('{"ok":false,"galat":{"kode":"terlalu_sering","pesan":"x"}}'); }
      res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"ok":true,"data":{"gema":1}}');
    });
  });
  await new Promise(ok => srv.listen(0, '127.0.0.1', ok));
  const url = `http://127.0.0.1:${srv.address().port}/api/v1/`, token = crypto.randomBytes(32).toString('hex');
  const k = R.buatKlienRelay({ url, token, uji: true, waktuMs: 1500 });
  const a = await k.panggil('POST', 'mac/halo', { body: { versi: '1.0.0', status: [] } });
  cek('klien: data', a.status === 200 && a.data && a.data.gema === 1);
  cek('klien: header klien & token di header', terakhir.h['x-padev-klien'] === 'pelaksana/' + R.VERSI_KLIEN && terakhir.h.authorization === 'Bearer ' + token);
  cek('klien: token tidak di URL', !terakhir.url.includes(token));
  const s = await k.panggil('GET', 'sehat', { tanpaToken: true });
  cek('klien: tanpaToken', s.status === 200 && !terakhir.h.authorization);
  const q2 = await k.panggil('GET', 'mac/kotak', { query: { batas: 20 } });
  cek('klien: query', q2.status === 200 && terakhir.url === '/api/v1/mac/kotak?batas=20');
  const al = await k.panggil('GET', '/alih');
  cek('klien: jalur di luar dasar ditolak', al.status === 0 && al.galat === 'jalur');
  const al2 = await R.buatKlienRelay({ url: `http://127.0.0.1:${srv.address().port}/alih/`, token, uji: true }).panggil('GET', 'x');
  cek('klien: redirect tidak diikuti', al2.status === 302 && !al2.data);
  const be = await R.buatKlienRelay({ url: `http://127.0.0.1:${srv.address().port}/besar/`, token, uji: true }).panggil('GET', 'x');
  cek('klien: respons > 1 MB diputus', be.status === 0 && be.galat === 'respons_terlalu_besar');
  const la = await R.buatKlienRelay({ url: `http://127.0.0.1:${srv.address().port}/lambat/`, token, uji: true, waktuMs: 500 }).panggil('GET', 'x');
  cek('klien: batas waktu', la.status === 0 && la.galat === 'waktu_habis');
  const ga = await R.buatKlienRelay({ url: `http://127.0.0.1:${srv.address().port}/galat/`, token, uji: true }).panggil('GET', 'x');
  cek('klien: galat + Retry-After', ga.status === 429 && ga.galat === 'terlalu_sering' && ga.retryAfter === 900);
  const mati = await R.buatKlienRelay({ url: 'http://127.0.0.1:1/', token, uji: true }).panggil('GET', 'x');
  cek('klien: relay mati → status 0', mati.status === 0);
  let lempar = false; try { R.buatKlienRelay({ url, token: 'pendek', uji: true }); } catch { lempar = true; }
  cek('klien: token bukan 64 heksa ditolak', lempar);
  // SEC-86 (K7): --cek memberi PERINGATAN bila apkSertifikatDebugSha256 terisi saat jarakJauh:true
  const dCek = path.join(tmp, 'cek'); fs.mkdirSync(dCek, { mode: 0o700 });
  const jalanCek = async cfg => { const o = []; await R.cekRelay({ folder: dCek, uji: true, tulis: t => o.push(t), galat: t => o.push(t),
    cfg: { apkSertifikatSha256: [digest], apkSertifikatDebugSha256: [], atestasiAkar: [], ...cfg } }); return o.join('\n'); };
  const debugSha = crypto.randomBytes(32).toString('hex');
  const keluarCek = await jalanCek({ jarakJauh: true, apkSertifikatDebugSha256: [debugSha] });
  cek('SEC-86 --cek: debug terisi + jarakJauh:true → PERINGATAN', /PERINGATAN {6}: apkSertifikatDebugSha256 terisi saat jarakJauh:true/.test(keluarCek));
  cek('REV-45 --cek: teks "APK bertanda kunci debug (debug/profile)", tanpa kata "debuggable" (K7 §9.1)', /APK bertanda kunci debug \(debug\/profile\)/.test(keluarCek) && !/debuggable/i.test(keluarCek), keluarCek);
  cek('SEC-86 --cek: debug terisi + jarakJauh:false → tanpa peringatan', !/PERINGATAN/.test(await jalanCek({ jarakJauh: false, apkSertifikatDebugSha256: [debugSha] })));
  cek('SEC-86 --cek: debug kosong + jarakJauh:true → tanpa peringatan', !/PERINGATAN/.test(await jalanCek({ jarakJauh: true })));

  // ---------- P4b REV-49 (REV-34/35/41) + REV-47: jembatan nyata dengan relay tiruan ----------
  const skenario = new Map();   // nama → {kotak:[item], kabar:[butir diterima], panggilKabar:[ukuran batch], tolakKabar: perangkat_id|null}
  const srvR = http.createServer((req, res) => {
    let b = ''; req.on('data', c => { b += c; }); req.on('end', () => {
      const jawab = (st, o) => { res.writeHead(st, { 'Content-Type': 'application/json' }); res.end(o === undefined ? '' : JSON.stringify(o)); };
      const m = /^\/([a-z0-9]+)\/(.*)$/.exec(req.url.split('?')[0]), s = m && skenario.get(m[1]);
      if (!s) return jawab(404, { ok: false, galat: { kode: 'tidak_ada', pesan: 'x' } });
      let body = null; try { body = b ? JSON.parse(b) : null; } catch { body = null; }
      if (m[2] === 'mac/halo') { if (body && Array.isArray(body.status)) s.halo.push(...body.status); return jawab(200, { ok: true, data: { waktu: Date.now(), perangkat: [] } }); }
      if (m[2] === 'mac/kotak') return jawab(200, { ok: true, data: { amplop: s.kotak.splice(0, 20), jedaMs: 1000 } });
      if (m[2] === 'mac/kotak/akui') return jawab(204);
      if (m[2] === 'mac/kabar' && body && Array.isArray(body.kabar)) {
        s.panggilKabar.push(body.kabar.length);
        // relay asli menolak SELURUH batch bila satu amplop rusak (Mac.php) — ditiru per perangkat_id
        if (s.tolakKabar && body.kabar.some(x => x.perangkat_id === s.tolakKabar)) return jawab(422, { ok: false, galat: { kode: 'amplop_rusak', pesan: 'x' } });
        s.kabar.push(...body.kabar);
        return jawab(201, { ok: true, data: {} });
      }
      return jawab(404, { ok: false, galat: { kode: 'tidak_ada', pesan: 'x' } });
    });
  });
  await new Promise(ok => srvR.listen(0, '127.0.0.1', ok));
  const portR = srvR.address().port;
  const tunggu = async (f, ms = 20000) => { const t0 = Date.now(); while (!f()) { if (Date.now() - t0 > ms) return false; await new Promise(ok => setTimeout(ok, 50)); } return true; };
  const pidAcak = () => crypto.randomBytes(8).toString('hex'), idTugas = () => 't-uji-' + crypto.randomBytes(8).toString('hex');
  const siapkan = (nama, hps) => {
    const folder = path.join(tmp, 'j-' + nama); fs.mkdirSync(folder, { mode: 0o700 });
    const km = R.buatKunciMac(); R.simpanKunciMac(folder, km);
    const macId = pidAcak(), kini = Date.now();
    R.tulisAman(path.join(folder, R.BERKAS.relay), JSON.stringify({ url: `http://127.0.0.1:${portR}/${nama}/`, mac_id: macId }));
    R.tulisAman(path.join(folder, R.BERKAS.token), crypto.randomBytes(32).toString('hex'));
    R.tulisAman(path.join(folder, R.BERKAS.perangkat), JSON.stringify({ v: 1, perangkat: hps.map(h => ({ perangkat_id: h.perangkat_id, nama: h.nama,
      k_rencana_id: R.idKunci(h.k_rencana), k_kerjakan_id: R.idKunci(h.k_kerjakan), k_rencana: h.k_rencana, k_kerjakan: h.k_kerjakan, e_hp: h.e_hp, fcm: '',
      mode: 'rencana', urut: kini, dipasang: kini })) }));
    const s = { kotak: [], kabar: [], halo: [], panggilKabar: [], tolakKabar: null }; skenario.set(nama, s);
    return { folder, s, qr: { s_mac: km.publik.s_mac, e_mac: km.publik.e_mac, mac_id: macId } };
  };
  const hpBaru = n => { const h = H.buatHp(n); h.perangkat_id = pidAcak(); return h; };
  const perintah = (sk, hp, tugasId, pesan = 'halo') => ({ kode: crypto.randomBytes(16).toString('hex'), jenis_kotak: 'perintah',
    amplop: H.amplopPerintah(hp, sk.qr, 'jalankan', { tugas: tugasId, proyek: 'uji', akun: 'a1', mode: 'rencana', pesan, baru: true }) });
  const CFG_J = () => ({ jarakJauh: true, batasMenit: { rencana: 30, kerjakan: 60 },
    proyek: new Map([['uji', { id: 'uji', nama: 'Uji', akun: ['a1'], hp: 'rencana', kerjakan: false }]]) });
  // jembatan dengan pelaksana tiruan: jalankan() menerima tugas (masuk peta tugas) kecuali `tolakJika(o)` → pagar laptop menolak
  const buatJ = (sk, tolakJika = () => false) => {
    const x = { tugas: new Map(), log: [], dipanggil: 0 };
    x.j = R.buatJembatan({ folder: sk.folder, uji: true, cfg: CFG_J(), log: t => x.log.push(t), tugas: x.tugas, hentikan: () => {}, hapusSesi: () => {},
      versi: 'uji', polaTugas: /^t-[a-z0-9]{1,12}-[0-9a-f]{16}$/,
      jalankan: (o, asal) => {
        x.dipanggil++;
        if (tolakJika(o)) return x.j.tolakPerintah(asal, 'proyek sedang bekerja');
        x.tugas.set(o.tugas, { tugas: o.tugas, asal, proyek: o.proyek, mode: o.mode, mulai: Date.now(), urut: 0 });
        return undefined;
      } });
    return x;
  };
  const bukaSemua = (sk, hp, pen) => sk.s.kabar.filter(k => k.perangkat_id === hp.perangkat_id).map(k => H.bukaKabar(hp, sk.qr, k.amplop, pen || R.buatPenyimpanReplayMemori()));
  const ttDari = (sk, hp) => bukaSemua(sk, hp).filter(h => h.ok && h.isi.jenis === 'tanda_terima').map(h => h.isi.tanda_terima);

  // REV-34: perintah yang ditolak pagar laptop ("proyek sedang bekerja") tidak memotong kuota 10 jalankan/jam
  const hpQ = hpBaru('HP Kuota'), skQ = siapkan('kuota', [hpQ]);
  const jQ = buatJ(skQ, o => o.pesan === 'sibuk');
  const idSibuk = [], idTerima = [];
  for (let i = 0; i < 12; i++) { const p = perintah(skQ, hpQ, idTugas(), 'sibuk'); idSibuk.push(p.amplop.id); skQ.s.kotak.push(p); }
  const tugasTerima = [];
  for (let i = 0; i < 10; i++) { const t = idTugas(); tugasTerima.push(t); const p = perintah(skQ, hpQ, t); idTerima.push(p.amplop.id); skQ.s.kotak.push(p); }
  const pLebih = perintah(skQ, hpQ, idTugas()); skQ.s.kotak.push(pLebih);
  cek('REV-49 jembatan mulai (relay tiruan)', jQ.j.mulai() === true, jQ.log.join('|'));
  await tunggu(() => skQ.s.kabar.length >= 23);
  const ttQ = ttDari(skQ, hpQ), perId = new Map(ttQ.map(t => [t.perintah_id, t]));
  cek('REV-34 12 perintah ditolak pagar laptop → ditolak "proyek sedang bekerja"', idSibuk.every(id => perId.get(id)?.hasil === 'ditolak' && perId.get(id).alasan === 'proyek sedang bekerja'), JSON.stringify(ttQ.slice(0, 3)));
  cek('REV-34 sesudahnya 10 perintah tetap diterima (kuota tidak terpotong penolakan)', idTerima.every(id => perId.get(id)?.hasil === 'diterima') && jQ.tugas.size === 10, JSON.stringify(ttQ.slice(12, 14)));
  cek('REV-34 perintah ke-11 yang dijalankan → "batas 10 perintah/jam tercapai" (kuota tetap berlaku)', perId.get(pLebih.amplop.id)?.hasil === 'ditolak'
    && perId.get(pLebih.amplop.id).alasan === 'batas 10 perintah/jam tercapai' && jQ.dipanggil === 22, JSON.stringify(perId.get(pLebih.amplop.id)) + ' dipanggil ' + jQ.dipanggil);
  // REV-41: urut_mac terakhir tersimpan di perangkat.json saat akhiri → jam Mac mundur setelah restart tidak membuat kabar "urut lama"
  await new Promise(ok => setTimeout(ok, 2000));   // halo susulan (haloSegera 1,5 dtk) + antrean kabar selesai
  // kabar terakhir dibuat TEPAT sebelum akhiri (tanpa halo sesudahnya) → hanya akhiri yang bisa menyimpan urut_mac-nya
  jQ.j.kabarTugas(jQ.tugas.get(tugasTerima[0]), 'mulai', { mode: 'rencana' });
  jQ.j.akhiri();
  await new Promise(ok => setTimeout(ok, 300));
  const antreQ = JSON.parse(fs.readFileSync(path.join(skQ.folder, R.BERKAS.antre), 'utf8')).antre;
  const semuaQ = [...skQ.s.kabar, ...skQ.s.halo, ...antreQ].filter(k => k.perangkat_id === hpQ.perangkat_id)
    .map(k => H.bukaKabar(hpQ, skQ.qr, k.amplop, R.buatPenyimpanReplayMemori())).filter(h => h.ok);
  const maksUrut = Math.max(...semuaQ.map(h => h.isi.urut_mac));
  const urutFile = R.bacaPerangkat(skQ.folder)[0].urut;
  cek('REV-41 akhiri menyimpan urut_mac terakhir ke perangkat.json', urutFile >= maksUrut, `${urutFile} < ${maksUrut}`);
  // REV-47 (jalur akhiri): tugas HP yang masih berjalan saat pelaksana keluar → gagal
  const pQ = R.buatPenyimpanReplayDisk(path.join(skQ.folder, R.BERKAS.replay));
  cek('REV-47 akhiri: 10 tugas HP yang masih "diterima"/"mulai" dicatat gagal', tugasTerima.every(t => pQ.hasilTugas(hpQ.perangkat_id, t) === 'gagal'));
  const hpPen = R.buatPenyimpanReplayMemori();   // HP: urut_mac yang sudah dilihat dari jalan pertama
  for (const k of semuaQ.sort((a, b) => a.isi.urut_mac - b.isi.urut_mac)) {
    hpPen.periksaDanCatat({ perangkat: skQ.qr.mac_id, id: crypto.randomBytes(16).toString('hex'), urut: k.isi.urut_mac, kedaluwarsa: Date.now() + 3600e3, sekarang: Date.now() });
  }
  const nKabarLama = skQ.s.kabar.length, jamAsli = Date.now;
  Date.now = () => jamAsli() - 2 * 3600e3;   // jam Mac mundur 2 jam setelah restart
  const idLama = new Set([...skQ.s.kabar, ...antreQ].map(k => k.amplop.id));   // sisa antrean jalan pertama ikut dikirim ulang oleh jQ2
  let jQ2, baruQ = [];
  try {
    jQ2 = buatJ(skQ);
    skQ.s.kotak.push({ kode: crypto.randomBytes(16).toString('hex'), jenis_kotak: 'perintah', amplop: H.amplopPerintah(hpQ, skQ.qr, 'minta_status', {}) });
    jQ2.j.mulai();
    await tunggu(() => skQ.s.kabar.length >= nKabarLama + 2);
    await tunggu(() => skQ.s.kabar.slice(nKabarLama).filter(k => !idLama.has(k.amplop.id)).length >= 2);
    baruQ = skQ.s.kabar.slice(nKabarLama).filter(k => !idLama.has(k.amplop.id));
  } finally { if (jQ2) jQ2.j.akhiri(); Date.now = jamAsli; }
  const baru = baruQ.map(k => H.bukaKabar(hpQ, skQ.qr, k.amplop, hpPen));   // jam HP tidak ikut mundur
  cek('REV-41 jam Mac mundur 2 jam: kabar baru tetap sah di HP (urut_mac > urut terakhir)', baru.length >= 2 && baru.every(h => h.ok && h.isi.urut_mac > maksUrut), JSON.stringify(baru.map(h => h.ok ? h.isi.urut_mac : h.alasan)));

  // REV-35: relay menolak batch karena 1 amplop rusak → dikirim ulang per butir, hanya yang rusak dibuang
  const hpA = hpBaru('HP A'), hpB = hpBaru('HP B'), skB = siapkan('batch', [hpA, hpB]);
  skB.s.tolakKabar = hpB.perangkat_id;
  const kd2 = Date.now() + 3600e3, butir = (h, id) => ({ perangkat_id: h.perangkat_id, amplop: { id, kedaluwarsa: kd2 }, penting: true });
  R.tulisAman(path.join(skB.folder, R.BERKAS.antre), JSON.stringify({ v: 1, antre: [butir(hpA, 'a1'), butir(hpB, 'b1'), butir(hpA, 'a2')] }));
  const jB = buatJ(skB);
  jB.j.mulai();
  await tunggu(() => skB.s.panggilKabar.length >= 4);
  await new Promise(ok => setTimeout(ok, 200));
  const sisaB = JSON.parse(fs.readFileSync(path.join(skB.folder, R.BERKAS.antre), 'utf8')).antre;
  cek('REV-35 batch 3 ditolak 422 → ulang per butir (3, 1, 1, 1)', JSON.stringify(skB.s.panggilKabar) === '[3,1,1,1]', JSON.stringify(skB.s.panggilKabar));
  cek('REV-35 butir sah terkirim (a1, a2), butir rusak dibuang, antrean kosong', JSON.stringify(skB.s.kabar.map(k => k.amplop.id)) === '["a1","a2"]' && sisaB.length === 0, JSON.stringify(sisaB));
  cek('REV-35 log menyebut 1 butir rusak dibuang', jB.log.some(t => /dikirim ulang per butir, 1 butir rusak dibuang/.test(t)), jB.log.join('|'));
  jB.j.akhiri();

  // REV-47: pelaksana mati paksa (kill -9) saat tugas HP "mulai" → restart menandai gagal → "Coba lagi" mendapat hasil_terakhir "gagal"
  const hpK2 = hpBaru('HP Crash'), skK = siapkan('crash', [hpK2]);
  const tK = idTugas(), tSelesai = idTugas();
  skK.s.kotak.push(perintah(skK, hpK2, tK));
  const ANAK = `const R = require(process.argv[1]); const tugas = new Map(); let j;
j = R.buatJembatan({ folder: process.argv[2], uji: true, log: () => {}, tugas, hentikan: () => {}, hapusSesi: () => {}, versi: 'uji', polaTugas: /^t-[a-z0-9]{1,12}-[0-9a-f]{16}$/,
  cfg: { jarakJauh: true, batasMenit: { rencana: 30, kerjakan: 60 }, proyek: new Map([['uji', { id: 'uji', nama: 'Uji', akun: ['a1'], hp: 'rencana', kerjakan: false }]]) },
  jalankan: (o, asal) => { const t = { tugas: o.tugas, asal, proyek: o.proyek, mode: o.mode, mulai: Date.now(), urut: 0 }; tugas.set(o.tugas, t);
    setImmediate(() => { j.kabarTugas(t, 'mulai', { mode: o.mode }); process.stdout.write('MULAI\\n'); }); } });
j.mulai(); setInterval(() => {}, 1000);`;
  const anakP = require('child_process').spawn(process.execPath, ['-e', ANAK, path.join(__dirname, '../../_app_padev_studio_3d/pelaksana-relay.js'), skK.folder], { stdio: ['ignore', 'pipe', 'pipe'] });
  let keluarAnak = ''; anakP.stdout.on('data', c => { keluarAnak += c; }); anakP.stderr.on('data', c => { keluarAnak += c; });
  const tutupAnak = new Promise(ok => anakP.on('close', ok));
  const sudahMulai = await tunggu(() => keluarAnak.includes('MULAI'));
  anakP.kill('SIGKILL'); await tutupAnak;
  const fK = path.join(skK.folder, R.BERKAS.replay);
  cek('REV-47 prasyarat: tugas HP "mulai" tercatat lalu proses dibunuh SIGKILL', sudahMulai && R.buatPenyimpanReplayDisk(fK).hasilTugas(hpK2.perangkat_id, tK) === 'mulai', keluarAnak);
  R.buatPenyimpanReplayDisk(fK).catatTugas(hpK2.perangkat_id, tSelesai, 'selesai');
  const jK = buatJ(skK);
  jK.j.mulai();
  const pK = R.buatPenyimpanReplayDisk(fK);
  cek('REV-47 restart: catatan "mulai" milik proses lama → gagal; tahap akhir tetap', pK.hasilTugas(hpK2.perangkat_id, tK) === 'gagal' && pK.hasilTugas(hpK2.perangkat_id, tSelesai) === 'selesai');
  cek('REV-47 restart: log menyebut tugas terputus', jK.log.some(t => /1 tugas HP terputus dari jalan sebelumnya → dicatat gagal/.test(t)), jK.log.join('|'));
  const ulangK = perintah(skK, hpK2, tK);
  skK.s.kotak.push(ulangK);
  await tunggu(() => ttDari(skK, hpK2).some(t => t.perintah_id === ulangK.amplop.id));
  const ttUlang = ttDari(skK, hpK2).find(t => t.perintah_id === ulangK.amplop.id);
  cek('REV-47 "Coba lagi" setelah crash → tugas_ulang + hasil_terakhir "gagal", tidak dijalankan lagi', ttUlang && ttUlang.hasil === 'ditolak' && ttUlang.alasan === 'tugas_ulang'
    && ttUlang.hasil_terakhir === 'gagal' && jK.dipanggil === 0, JSON.stringify(ttUlang));
  jK.j.akhiri();
  srvR.close();
  srv.close();
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`HASIL: ${gagal ? 'GAGAL' : 'LULUS'} ${lulus}/${lulus + gagal}`);
  process.exit(gagal ? 1 : 0);
})();
