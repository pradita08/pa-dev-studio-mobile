// HP tiruan untuk uji pelaksana ↔ relay (P2). Meniru alur Kotlin (apk/android/.../kunci/Inti.kt): kunci K_rencana/K_kerjakan/E_hp,
// rantai atestasi UJI (akar uji buatan sendiri — didaftarkan lewat konfigurasi `atestasiAkar` HANYA di folder uji), amplop pasang,
// perintah, pembacaan kabar. Juga: QR Terminal → PNG → dekode CoreImage (osascript JXA) untuk membuktikan QR terbaca.
// HANYA UNTUK UJI. Tanpa dependensi npm.
'use strict';
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { execFileSync } = require('child_process');
const R = require('../../_app_padev_studio_3d/pelaksana-relay.js');

/* ---------- DER mini (pembuat) ---------- */
const panjang = n => { if (n < 128) return Buffer.from([n]); const h = []; for (; n; n = Math.floor(n / 256)) h.unshift(n & 255); return Buffer.from([0x80 | h.length, ...h]); };
const tlv = (tag, ...isi) => { const b = Buffer.concat(isi); return Buffer.concat([Buffer.from(Array.isArray(tag) ? tag : [tag]), panjang(b.length), b]); };
const seq = (...x) => tlv(0x30, ...x), set = (...x) => tlv(0x31, ...x);
const intB = n => { const h = []; do { h.unshift(n & 255); n = Math.floor(n / 256); } while (n); if (h[0] & 0x80) h.unshift(0); return Buffer.from(h); };
const int = n => tlv(0x02, intB(n)), en = n => tlv(0x0a, intB(n)), oct = b => tlv(0x04, Buffer.from(b)), oid = hex => tlv(0x06, Buffer.from(hex, 'hex'));
const nul = () => Buffer.from([0x05, 0x00]);
const bool = v => tlv(0x01, Buffer.from([v ? 0xff : 0x00]));
// ekstensi basicConstraints (kritis) + keyUsage (kritis): CA → keyCertSign|cRLSign; bukan CA → digitalSignature
const eksCa = ca => [seq(oid('551d13'), bool(true), oct(ca ? seq(bool(true)) : seq())),
  seq(oid('551d0f'), bool(true), oct(ca ? tlv(0x03, Buffer.from([0x01, 0x06])) : tlv(0x03, Buffer.from([0x07, 0x80]))))];
function ctx(nomor, isi) {   // [nomor] EXPLICIT (konteks, tersusun), bentuk tinggi untuk ≥ 31
  if (nomor < 31) return tlv(0xa0 | nomor, isi);
  const b = []; for (let n = nomor; n; n = Math.floor(n / 128)) b.unshift(n & 127);
  for (let i = 0; i < b.length - 1; i++) b[i] |= 0x80;
  return tlv([0xbf, ...b], isi);
}
const ALG = seq(oid('2a8648ce3d040302'));   // ecdsa-with-SHA256
const nama = cn => seq(set(seq(oid('550403'), tlv(0x0c, Buffer.from(cn)))));
function sertifikat({ subjek, penerbit, spki, kunciPenerbit, ekstensi = [], serial = crypto.randomInt(1, 2 ** 40), berlaku = ['250101000000Z', '491231235959Z'] }) {
  const tbs = seq(tlv(0xa0, int(2)), int(serial), ALG, nama(penerbit), seq(tlv(0x17, Buffer.from(berlaku[0])), tlv(0x17, Buffer.from(berlaku[1]))),
    nama(subjek), spki, ...(ekstensi.length ? [tlv(0xa3, seq(...ekstensi))] : []));
  const tanda = crypto.sign('sha256', tbs, { key: kunciPenerbit, dsaEncoding: 'der' });
  return seq(tbs, ALG, tlv(0x03, Buffer.from([0]), tanda));
}
// akar uji (P-256, swa-tanda, CA + keyCertSign) → {privat, spkiB64, der}; o.ca=false → akar tanpa tanda CA (uji negatif)
function buatAkarUji(o = {}) {
  const k = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const spki = k.publicKey.export({ type: 'spki', format: 'der' });
  return { privat: k.privateKey, spkiB64: spki.toString('base64'),
    der: sertifikat({ subjek: 'Akar Uji', penerbit: 'Akar Uji', spki, kunciPenerbit: k.privateKey, ekstensi: eksCa(o.ca !== false), berlaku: o.berlaku }) };
}
// KeyDescription uji. o: digest, tantangan, paket, tingkat, kurva, jenisAuth, batas, tanpaAuth, keLunak:[tag…] (pindahkan tag keamanan
// ke softwareEnforced), tanpaOrigin, origin, tanpaRot, terkunci (bawaan true), statusBoot (bawaan 0 = Verified), appKeras (709 di keras), udrKeras (509 di keras)
function keyDescription(o) {
  const app = seq(set(seq(oct(o.paket ?? 'pro.padeveloper.studio'), int(1))), set(oct(Buffer.from(o.digest, 'hex'))));
  const tag = [[1, ctx(1, set(int(2)))], [2, ctx(2, int(3))], [3, ctx(3, int(256))], [5, ctx(5, set(int(4)))], [10, ctx(10, int(o.kurva ?? 1))]];
  if (o.tanpaAuth) tag.push([503, ctx(503, nul())]); else tag.push([504, ctx(504, int(o.jenisAuth))]);
  if (o.batas) tag.push([505, ctx(505, int(o.batas))]);
  tag.push([509, ctx(509, nul())]);
  if (!o.tanpaOrigin) tag.push([702, ctx(702, int(o.origin ?? 0))]);
  if (!o.tanpaRot) tag.push([704, ctx(704, seq(oct(Buffer.alloc(32, 7)), bool(o.terkunci !== false), en(o.statusBoot ?? 0), oct(Buffer.alloc(32, 9))))]);
  tag.push([709, ctx(709, oct(app))]);
  const keLunak = new Set([509, 709, ...(o.keLunak || [])]);
  if (o.appKeras) keLunak.delete(709);
  if (o.udrKeras) keLunak.delete(509);
  const urut = l => l.sort((x, y) => x[0] - y[0]).map(x => x[1]);
  const lunak = seq(...urut(tag.filter(([n]) => keLunak.has(n)))), keras = seq(...urut(tag.filter(([n]) => !keLunak.has(n))));
  return seq(int(300), en(o.tingkat ?? 1), int(300), en(o.tingkat ?? 1), oct(o.tantangan), oct(Buffer.alloc(0)), lunak, keras);
}
const eksKd = o => seq(oid('2b06010401d679020111'), oct(keyDescription(o)));
// rantai atestasi b64u untuk kunci publik `publik` (KeyObject): [daun, akar] atau, dengan o.perantara, [daun, perantara, akar].
// Opsi perusak (uji negatif): kunciPenerbit, daunCa (daun bertanda CA), perantaraBukanCa, kdDiPerantara (ekstensi juga di perantara),
// serialDaun/serialPerantara, berlakuDaun/berlakuPerantara, ditambah opsi keyDescription di atas.
function rantaiAtestasi(akar, publik, o) {
  let penerbit = akar.privat, nPenerbit = 'Akar Uji';
  const hasil = [];
  if (o.perantara) {
    const kp = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    const per = sertifikat({ subjek: 'Perantara Uji', penerbit: 'Akar Uji', spki: kp.publicKey.export({ type: 'spki', format: 'der' }), kunciPenerbit: akar.privat,
      ekstensi: [...eksCa(!o.perantaraBukanCa), ...(o.kdDiPerantara ? [eksKd(o)] : [])], serial: o.serialPerantara, berlaku: o.berlakuPerantara });
    hasil.push(R.b64u(per)); penerbit = kp.privateKey; nPenerbit = 'Perantara Uji';
  }
  const daun = sertifikat({ subjek: 'Android Keystore Key', penerbit: nPenerbit, spki: publik.export({ type: 'spki', format: 'der' }),
    kunciPenerbit: o.kunciPenerbit || penerbit, ekstensi: [...eksCa(!!o.daunCa), eksKd(o)], serial: o.serialDaun, berlaku: o.berlakuDaun });
  return [R.b64u(daun), ...hasil, R.b64u(akar.der)];
}
// PoC SEC-82 (Sekar): penyerang punya kunci atestasi ASLI (daun sah, paket penyerang, tanpa auth) lalu memakai kunci privat daun itu untuk
// menandatangani daun PALSU berisi KeyDescription karangan (paket & sertifikat APK owner, sidik jari, tantangan benar) untuk kunci software
// `publikPalsu`. Rantai: [daun palsu, daun asli, (perantara,) akar].
function rantaiPocSec82(akar, publikPalsu, o) {
  const asli = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const rAsli = rantaiAtestasi(akar, asli.publicKey, { ...o, paket: 'com.penyerang.app', tanpaAuth: true, batas: 0 });
  const palsu = sertifikat({ subjek: 'Android Keystore Key', penerbit: 'Android Keystore Key', spki: publikPalsu.export({ type: 'spki', format: 'der' }),
    kunciPenerbit: asli.privateKey, ekstensi: [...eksCa(false), eksKd(o)] });
  return [R.b64u(palsu), ...rAsli];
}

/* ---------- HP tiruan ---------- */
const SERTIFIKAT_APK_UJI = crypto.createHash('sha256').update('sertifikat-apk-uji').digest('hex');
function buatHp(nama = 'HP Uji') {
  const g = () => crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const kr = g(), kk = g(), eh = crypto.generateKeyPairSync('x25519');
  const spki = k => R.b64u(k.publicKey.export({ type: 'spki', format: 'der' }));
  const raw = Buffer.from(eh.publicKey.export({ format: 'jwk' }).x, 'base64url');
  return { nama, kr, kk, eh, k_rencana: spki(kr), k_kerjakan: spki(kk), e_hp: R.b64u(raw), urut: 0, token: null, perangkat_id: null, urutMac: 0 };
}
// amplop pasang (kontrak §3.3) dari QR; opsi.ubah(isi) untuk uji negatif
function amplopPasang(hp, qr, akar, opsi = {}) {
  const rahasia = R.dariB64u(qr.rahasia), tantangan = R.tantanganAtestasi(rahasia, qr.mac_id), dibuat = Date.now();
  const at = (k, kerjakan) => rantaiAtestasi(akar, k.publicKey, { digest: opsi.digest || SERTIFIKAT_APK_UJI, tantangan, jenisAuth: kerjakan ? 2 : 3,
    batas: kerjakan ? 0 : 300, ...(opsi.atestasi || {}) });
  const isi = { mac_id: qr.mac_id, perangkat_id: hp.perangkat_id, dibuat, kedaluwarsa: dibuat + 5 * 60000, nama: hp.nama, k_rencana: hp.k_rencana,
    k_kerjakan: hp.k_kerjakan, e_hp: hp.e_hp, atestasi: { k_rencana: at(hp.kr, false), k_kerjakan: at(hp.kk, true) }, fcm: '' };
  isi.hmac = R.hmacPasang(rahasia, isi);
  if (opsi.ubah) opsi.ubah(isi);
  return R._uji.susunAmplop({ jenis_kotak: 'pasang', kunciTanda: hp.kr.privateKey, ePenerima: qr.e_mac, isi, kedaluwarsa: isi.kedaluwarsa }).amplop;
}
// amplop perintah (kontrak §2); kunci 'rencana'|'kerjakan'; opsi.masa (ms), opsi.dibuat, opsi.ubah(isi)
function amplopPerintah(hp, qr, jenis, tambahan, { kunci = 'rencana', masa = 60000, dibuat = Date.now(), ubah } = {}) {
  const id = crypto.randomBytes(16).toString('hex');
  const isi = { mac_id: qr.mac_id, perangkat_id: hp.perangkat_id, id, urut: ++hp.urut, dibuat, kedaluwarsa: dibuat + masa, jenis, ...tambahan };
  if (ubah) ubah(isi);
  return R._uji.susunAmplop({ jenis_kotak: 'perintah', kunciTanda: (kunci === 'kerjakan' ? hp.kk : hp.kr).privateKey, ePenerima: qr.e_mac, isi, kedaluwarsa: isi.kedaluwarsa, id }).amplop;
}
// buka & verifikasi kabar Mac→HP (sama dengan Kotlin opsiKabar); penyimpan = anti-replay urut_mac
function bukaKabar(hp, qr, amplop, penyimpan) {
  const sMacId = R.idKunci(qr.s_mac);
  return R.periksaAmplop(amplop, { jenisKotak: 'kabar', kunciTandaDikenal: { [sMacId]: { publik: qr.s_mac, peran: 's_mac' } },
    kunciSandiSaya: hp.eh.privateKey, macId: qr.mac_id, perangkatId: hp.perangkat_id, penyimpan });
}

/* ---------- QR Terminal → matriks → PNG → CoreImage ---------- */
function matriksDariTerminal(baris) {   // baris berwarna (\x1b[30;107m…\x1b[0m) → modul gelap
  const polos = baris.map(b => b.replace(/\x1b\[[0-9;]*m/g, ''));
  const m = [];
  for (const b of polos) { const atas = [], bawah = []; for (const ch of b) { atas.push(ch === '█' || ch === '▀'); bawah.push(ch === '█' || ch === '▄'); } m.push(atas, bawah); }
  return m;
}
const T = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc = b => { let c = -1; for (const x of b) c = T[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0; };
const potongPng = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
function tulisPng(file, m, s = 6) {   // m = [[bool]] (sudah termasuk tepi)
  const h = m.length, w = m[0].length, rows = [];
  for (let y = 0; y < h * s; y++) { const r = Buffer.alloc(w * s + 1); for (let x = 0; x < w * s; x++) r[x + 1] = m[Math.floor(y / s)][Math.floor(x / s)] ? 0 : 255; rows.push(r); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w * s, 0); ihdr.writeUInt32BE(h * s, 4); ihdr[8] = 8; ihdr[9] = 0;
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), potongPng('IHDR', ihdr), potongPng('IDAT', zlib.deflateSync(Buffer.concat(rows))), potongPng('IEND', Buffer.alloc(0))]));
}
const JXA = `ObjC.import('CoreImage');ObjC.import('Foundation');function run(a){const o=[];for(const p of a){const i=$.CIImage.imageWithContentsOfURL($.NSURL.fileURLWithPath(p));
const d=$.CIDetector.detectorOfTypeContextOptions($.CIDetectorTypeQRCode,$(),$({CIDetectorAccuracy:'CIDetectorAccuracyHigh'}));const f=d.featuresInImage(i);
o.push(f.count>0?ObjC.unwrap(f.objectAtIndex(0).messageString):null);}return JSON.stringify(o);}`;
// dekode PNG lewat CoreImage macOS (tanpa Xcode); null bila osascript tidak tersedia
function dekodeQr(folder, files) {
  const js = path.join(folder, 'dekode-qr.js');
  fs.writeFileSync(js, JXA);
  try { return JSON.parse(execFileSync('/usr/bin/osascript', ['-l', 'JavaScript', js, ...files], { encoding: 'utf8', timeout: 60000 })); } catch { return null; }
}

module.exports = { buatAkarUji, rantaiAtestasi, rantaiPocSec82, buatHp, amplopPasang, amplopPerintah, bukaKabar, matriksDariTerminal, tulisPng, dekodeQr, SERTIFIKAT_APK_UJI };
