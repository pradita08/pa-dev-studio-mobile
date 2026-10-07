#!/usr/bin/env node
// Uji integrasi "Pasangkan HP" dari kantor laptop (seperti WhatsApp Web), relay LOKAL:
//   browser (HTTP: /chat/pasang/*) → server.js → perintah bertanda tangan → pelaksana.js (utama) → anak `--pasang-hp --mesin`
//   → relay ↔ HP tiruan memindai QR dari modul JSON → kode 6 digit → "Kode sama" → terpasang (Rencana + Kerjakan).
// Juga: APK belum dikenal → "Percayai APK ini" → ulangi; tanpa kunci perintah 401; Origin lain 403; pintu HP 403;
// jawaban sebelum kode 409; SHA yang tidak ditawarkan 409.
// Pakai (seperti uji-e2e-relay.js; QR dibaca jsQR — set JSQR=/path/node_modules/jsqr):
//   RELAY_UJI=http://127.0.0.1:4640/ MAC_ID=<16 heksa> MAC_TOKEN=<64 heksa> JSQR=... node apk/kontrak/uji-pasang-kantor.js
// DILARANG diarahkan ke relay produksi.
'use strict';
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn, spawnSync } = require('child_process');
const R = require('../../_app_padev_studio_3d/pelaksana-relay.js');
const H = require('./hp-tiruan.js');
const VERSI_APK = (/^version:\s*(\d+\.\d+\.\d+)/m.exec(fs.readFileSync(path.join(__dirname, '../pubspec.yaml'), 'utf8')) || [])[1];
const KLIEN_APK = 'apk/' + VERSI_APK;
const URL_UJI = process.env.RELAY_UJI || '', MAC_ID = process.env.MAC_ID || '', TOKEN = process.env.MAC_TOKEN || '';
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+\/$/.test(URL_UJI) || !/^[0-9a-f]{16}$/.test(MAC_ID) || !/^[0-9a-f]{64}$/.test(TOKEN) || !process.env.JSQR) {
  console.error('Butuh RELAY_UJI=http://127.0.0.1:<port>/, MAC_ID, MAC_TOKEN (relay lokal saja), JSQR=<path jsqr>.'); process.exit(2);
}
const jsQR = require(process.env.JSQR);
const KANTOR = path.join(__dirname, '../../_app_padev_studio_3d');
const SKRIP = path.join(KANTOR, 'pelaksana.js'), SERVER = path.join(KANTOR, 'server.js');
const dasar = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'uji-pasang-kantor-')));
const F = path.join(dasar, 'folder'), DOK = path.join(dasar, 'dok');
const STATUS_ATESTASI = path.join(dasar, 'status-atestasi.json');
fs.writeFileSync(STATUS_ATESTASI, JSON.stringify({ entries: {} }));
const ENV = { ...process.env, KANTOR_PELAKSANA_UJI_AKAR: DOK, KANTOR_PELAKSANA_UJI_STATUS_ATESTASI: STATUS_ATESTASI };
const PORT = 4700 + Math.floor(Math.random() * 200), PORT_JAUH = PORT + 1000;
const K_PERINTAH = crypto.randomBytes(32).toString('hex'), K_PELAKSANA = crypto.randomBytes(32).toString('hex'), K_JAUH = crypto.randomBytes(32).toString('hex');
let lulus = 0, gagal = 0;
const cek = (nama, ok, info = '') => { if (ok) { lulus++; console.log('ok   ' + nama); } else { gagal++; console.log(`GAGAL ${nama} ${info}`); } };
const tidur = ms => new Promise(ok => setTimeout(ok, ms));
async function tunggu(fn, ms = 30000, jeda = 500) { const b = Date.now() + ms; for (;;) { const v = await fn(); if (v) return v; if (Date.now() > b) return null; await tidur(jeda); } }

// ---------- folder pelaksana uji ----------
fs.mkdirSync(F, { mode: 0o700 }); fs.mkdirSync(DOK, { mode: 0o700 }); fs.mkdirSync(path.join(DOK, 'uji'));
const STUB = path.join(dasar, 'claude-tiruan.js');
fs.writeFileSync(STUB, '#!/usr/bin/env node\nif (process.argv.includes(\'--version\')) console.log(\'tiruan 1.0\');\n', { mode: 0o700 });
fs.writeFileSync(path.join(F, 'kunci'), K_PELAKSANA + '\n', { mode: 0o600 });
const akar = H.buatAkarUji();
fs.writeFileSync(path.join(F, 'konfigurasi.json'), JSON.stringify({ server: `http://127.0.0.1:${PORT}`, claude: STUB,
  akun: { akun1: { label: 'Akun 1', folder: '~/.claude' } },
  proyek: [{ id: 'uji', nama: 'Uji', path: path.join(DOK, 'uji'), akun: ['akun1'], kerjakan: true, hp: 'kerjakan' }],
  jarakJauh: true, apkSertifikatSha256: [], apkSertifikatDebugSha256: [], atestasiAkar: [akar.spkiB64] }, null, 1), { mode: 0o600 });
const jalan = (args, input) => spawnSync(process.execPath, [SKRIP, '--folder', F, ...args], { env: ENV, input, encoding: 'utf8', timeout: 60000 });

// ---------- "browser" kantor laptop ----------
function minta(jalur, { metode = 'GET', isi, kunci = K_PERINTAH, origin = `http://localhost:${PORT}`, port = PORT, tambahan = {} } = {}) {
  return new Promise(ok => {
    const body = isi === undefined ? null : JSON.stringify(isi);
    const headers = { Host: `localhost:${port}`, 'Sec-Fetch-Site': 'same-origin', ...tambahan };
    if (origin) headers.Origin = origin;
    if (kunci) headers['X-Kantor-Perintah'] = kunci;
    if (body !== null) { headers['Content-Type'] = 'application/json'; headers['Content-Length'] = Buffer.byteLength(body); }
    const q = http.request({ host: '127.0.0.1', port, path: jalur, method: metode, headers }, res => {
      let t = ''; res.on('data', c => { t += c; }); res.on('end', () => { let j = null; try { j = JSON.parse(t); } catch { /* teks */ } ok({ status: res.statusCode, teks: t, json: j }); });
    });
    q.on('error', () => ok({ status: 0, teks: '', json: null }));
    q.end(body);
  });
}
const status = async () => (await minta('/chat/pasang')).json || {};
const tungguTahap = (t, ms = 40000) => tunggu(async () => { const s = await status(); return t.includes(s.tahap) ? s : null; }, ms, 400);
function bacaQr(modul) {   // modul JSON → piksel → jsQR (pembaca QR independen, seperti kamera HP)
  const n = modul.length, tepi = 4, s = 4, w = (n + tepi * 2) * s, px = new Uint8ClampedArray(w * w * 4).fill(255);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (modul[y][x] === '1') {
    for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) { const i = (((y + tepi) * s + dy) * w + (x + tepi) * s + dx) * 4; px[i] = px[i + 1] = px[i + 2] = 0; }
  }
  const q = jsQR(px, w, w);
  return q ? JSON.parse(q.data) : null;
}
const klienHp = hp => R.buatKlienRelay({ url: URL_UJI, token: hp.token, uji: true });
async function hpPindai(hp, qr) {   // HP: daftar dengan kode dari QR lalu kirim amplop pasang
  const d = await R.buatKlienRelay({ url: qr.relay, token: null, uji: true }).panggil('POST', 'hp/daftar', { body: { kode_daftar: qr.kode_daftar, mac_id: qr.mac_id }, tanpaToken: true, klien: KLIEN_APK });
  hp.perangkat_id = d.data && d.data.perangkat_id; hp.token = d.data && d.data.token;
  const r = await klienHp(hp).panggil('POST', 'hp/kirim', { body: { amplop: H.amplopPasang(hp, qr, akar) }, klien: KLIEN_APK });
  return r.status;
}

(async () => {
  let srv, pl;
  const berhenti = () => { for (const p of [pl, srv]) if (p) try { p.kill('SIGTERM'); } catch { /* sudah */ } };
  try {
    const s1 = jalan(['--relay-siapkan', '--relay-url', URL_UJI], `${MAC_ID}\n${TOKEN}\n`);
    cek('--relay-siapkan', s1.status === 0, s1.stdout + s1.stderr);
    srv = spawn(process.execPath, [SERVER, '--port', String(PORT), '--port-jauh', String(PORT_JAUH)], { cwd: KANTOR, stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, KANTOR_CHAT: '1', KANTOR_KUNCI_PERINTAH: K_PERINTAH, KANTOR_KUNCI_PELAKSANA: K_PELAKSANA, KANTOR_KUNCI_JAUH: K_JAUH,
        KANTOR_TS_LOGIN: 'owner@contoh.id', KANTOR_DATA: path.join(dasar, 'data'), HOME: dasar } });
    let logSrv = ''; srv.stdout.on('data', c => { logSrv += c; }); srv.stderr.on('data', c => { logSrv += c; });
    cek('server kantor jalan', !!await tunggu(async () => (await minta('/state', { kunci: '' })).status === 200, 15000), logSrv.slice(-400));
    pl = spawn(process.execPath, [SKRIP, '--folder', F], { env: ENV, stdio: ['ignore', 'pipe', 'pipe'] });
    let logPl = ''; pl.stdout.on('data', c => { logPl += c; }); pl.stderr.on('data', c => { logPl += c; });
    cek('pelaksana tersambung ke server', !!await tunggu(async () => (await status()).pelaksana === true, 20000), logPl.slice(-400));

    // ---------- pagar ----------
    cek('tanpa kunci perintah → 401', (await minta('/chat/pasang', { kunci: '' })).status === 401);
    cek('Origin situs lain → 403', (await minta('/chat/pasang/mulai', { metode: 'POST', isi: {}, origin: 'https://jahat.contoh' })).status === 403);
    const jauh = await minta('/chat/pasang', { port: PORT_JAUH, origin: `https://localhost`, tambahan: { 'X-Kantor-Kunci': K_JAUH, 'Tailscale-User-Login': 'owner@contoh.id' } });
    cek('pintu HP (Tailscale) → 403', jauh.status === 403, `${jauh.status} ${jauh.teks}`);
    cek('jawab sebelum ada kode → 409', (await minta('/chat/pasang/jawab', { metode: 'POST', isi: { setuju: true, kerjakan: true } })).status === 409);
    cek('sertifikat yang tidak ditawarkan → 409', (await minta('/chat/pasang/sertifikat', { metode: 'POST', isi: { sha: 'ab'.repeat(32) } })).status === 409);

    // ---------- 1. APK belum dikenal → ditolak, SHA ditawarkan → "Percayai APK ini" ----------
    cek('mulai → 202', (await minta('/chat/pasang/mulai', { metode: 'POST', isi: {} })).status === 202);
    cek('mulai lagi saat berjalan → 409', (await minta('/chat/pasang/mulai', { metode: 'POST', isi: {} })).status === 409);
    let st = await tungguTahap(['qr']);
    cek('QR tampil (modul JSON)', !!st && Array.isArray(st.modul) && st.modul.length >= 21, JSON.stringify(st).slice(0, 200));
    let qr = st && bacaQr(st.modul);
    cek('QR terbaca kamera (jsQR) & milik Mac ini', !!qr && qr.mac_id === MAC_ID && qr.relay === URL_UJI);
    cek('HP tiruan memindai & kirim amplop pasang', [200, 201, 202].includes(await hpPindai(H.buatHp('HP Uji'), qr)));
    st = await tungguTahap(['gagal']);
    cek('APK belum dikenal → gagal + SHA ditawarkan', !!st && st.sertifikat === H.SERTIFIKAT_APK_UJI, JSON.stringify(st));
    cek('Percayai APK ini → 202', (await minta('/chat/pasang/sertifikat', { metode: 'POST', isi: { sha: H.SERTIFIKAT_APK_UJI } })).status === 202);
    const kf = await tunggu(() => { const c = JSON.parse(fs.readFileSync(path.join(F, 'konfigurasi.json'), 'utf8')); return c.apkSertifikatDebugSha256.includes(H.SERTIFIKAT_APK_UJI) ? c : null; }, 10000);
    cek('sertifikat tercatat di konfigurasi (0600)', !!kf && (fs.statSync(path.join(F, 'konfigurasi.json')).mode & 0o777) === 0o600);
    await tidur(3000);   // proses anak pertama selesai

    // ---------- 2. pasang sungguhan: QR → kode sama → Rencana + Kerjakan ----------
    cek('mulai ulang → 202', (await minta('/chat/pasang/mulai', { metode: 'POST', isi: {} })).status === 202);
    st = await tungguTahap(['qr']);
    qr = st && bacaQr(st.modul);
    const hp = H.buatHp('POCO Uji');
    cek('HP memindai QR kedua', !!qr && [200, 201, 202].includes(await hpPindai(hp, qr)));
    st = await tungguTahap(['sas']);
    const sasHp = qr && R.kodeSas({ s_mac: qr.s_mac, e_mac: qr.e_mac, k_rencana: hp.k_rencana, k_kerjakan: hp.k_kerjakan, e_hp: hp.e_hp, mac_id: qr.mac_id, perangkat_id: hp.perangkat_id });
    cek('kode 6 digit di browser = kode di HP', !!st && st.kode === sasHp && st.nama === 'POCO Uji', JSON.stringify(st));
    cek('QR tidak lagi dikirim setelah tahap kode', !!st && st.modul === undefined);
    cek('"Kode sama" + Kerjakan → 202', (await minta('/chat/pasang/jawab', { metode: 'POST', isi: { setuju: true, kerjakan: true } })).status === 202);
    st = await tungguTahap(['selesai']);
    cek('terpasang: Rencana + Kerjakan', !!st && st.mode === 'rencana+kerjakan', JSON.stringify(st));
    cek('kode darurat tampil sekali (pemasangan pertama)', !!st && /^[A-Z2-7]{5}(-[A-Z2-7]{5}){4}$/.test(st.darurat || ''), st && st.darurat);
    const pj = R.bacaPerangkat(F);
    cek('perangkat.json: 1 HP rencana+kerjakan', pj.length === 1 && pj[0].perangkat_id === hp.perangkat_id && pj[0].mode === 'rencana+kerjakan', JSON.stringify(pj.map(e => [e.perangkat_id, e.mode])));
    const audit = fs.readFileSync(path.join(F, R.BERKAS.audit), 'utf8');
    cek('audit: dipasang tercatat', /"keputusan":"dipasang"/.test(audit));
    const logPelaksana = (() => { try { return fs.readFileSync(path.join(F, 'pelaksana.log'), 'utf8'); } catch { return logPl; } })();
    cek('kode darurat & QR tidak masuk log pelaksana/server', !logPelaksana.includes(st.darurat) && !logSrv.includes(st.darurat) && !logPelaksana.includes(qr.kode_daftar));
    cek('batal → diam', (await minta('/chat/pasang/batal', { metode: 'POST', isi: {} })).json.tahap === 'diam');
  } catch (e) { gagal++; console.log('GAGAL (pengecualian)', e && e.stack); }
  finally {
    berhenti();
    fs.rmSync(dasar, { recursive: true, force: true });
    console.log(`HASIL: ${gagal ? 'GAGAL' : 'LULUS'} ${lulus}/${lulus + gagal}`);
    process.exit(gagal ? 1 : 0);
  }
})();
