#!/usr/bin/env node
// Uji integrasi "Pasangkan HP" dari kantor laptop (seperti WhatsApp Web), relay LOKAL:
//   browser (HTTP: /chat/pasang/*) → server.js → perintah bertanda tangan → pelaksana.js (utama) → anak `--pasang-hp --mesin`
//   → relay ↔ HP tiruan memindai QR dari modul JSON → kode 6 digit → "Kode sama" → terpasang (Rencana + Kerjakan).
// Juga (alur sederhana seperti WhatsApp Web): di laptop tanpa kunci perintah (chat tetap wajib), APK baru disetujui lewat "Kode sama",
// HP ketiga menggantikan yang paling lama, dialog dibuka ulang → QR yang sama, sesi Terminal menggantung diambil alih;
// Origin lain 403; pintu HP 403/401; jawaban sebelum kode 409.
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
  if (!hp.perangkat_id) throw new Error(`hp/daftar gagal (${d.status} ${JSON.stringify(d.data || d.galat)}) — relay uji: batas 3 daftar/15 mnt (kosongkan batas_laju)`);
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
    cek('laptop: Hubungkan HP tanpa kunci perintah → 200 (seperti WhatsApp Web)', (await minta('/chat/pasang', { kunci: '' })).status === 200);
    cek('chat/perintah tetap wajib kunci perintah → 401', (await minta('/chat/status', { kunci: '' })).status === 401);
    cek('Origin situs lain → 403', (await minta('/chat/pasang/mulai', { metode: 'POST', isi: {}, origin: 'https://jahat.contoh', kunci: '' })).status === 403);
    const jauh = await minta('/chat/pasang', { port: PORT_JAUH, origin: `https://localhost`, tambahan: { 'X-Kantor-Kunci': K_JAUH, 'Tailscale-User-Login': 'owner@contoh.id' } });
    cek('pintu HP (Tailscale) → 403', jauh.status === 403, `${jauh.status} ${jauh.teks}`);
    const jauhTanpa = await minta('/chat/pasang', { port: PORT_JAUH, origin: `https://localhost`, kunci: '', tambahan: { 'X-Kantor-Kunci': K_JAUH, 'Tailscale-User-Login': 'owner@contoh.id' } });
    cek('pintu HP tanpa kunci perintah → 401 (pengecualian hanya di laptop)', jauhTanpa.status === 401, `${jauhTanpa.status}`);
    cek('jawab sebelum ada kode → 409', (await minta('/chat/pasang/jawab', { metode: 'POST', isi: { setuju: true, kerjakan: true } })).status === 409);

    // ---------- 1. HP pertama, APK BARU: QR → kode (dengan peringatan APK baru) → "Kode sama" = percayai + pasang ----------
    const pasangHp = async (nama, kunci = '') => {
      cek(`[${nama}] mulai → 202`, (await minta('/chat/pasang/mulai', { metode: 'POST', isi: {}, kunci })).status === 202);
      let st = await tungguTahap(['qr']);
      cek(`[${nama}] QR tampil (modul JSON)`, !!st && Array.isArray(st.modul) && st.modul.length >= 21, JSON.stringify(st).slice(0, 200));
      const qr = st && bacaQr(st.modul);
      cek(`[${nama}] QR terbaca kamera (jsQR) & milik Mac ini`, !!qr && qr.mac_id === MAC_ID && qr.relay === URL_UJI);
      const mulaiLagi = await minta('/chat/pasang/mulai', { metode: 'POST', isi: {}, kunci });
      cek(`[${nama}] dialog dibuka ulang → QR yang sama (bukan 409)`, mulaiLagi.status === 202 && mulaiLagi.json && mulaiLagi.json.tahap === 'qr'
        && JSON.stringify(mulaiLagi.json.modul) === JSON.stringify(st.modul));
      const hp = H.buatHp(nama);
      cek(`[${nama}] HP memindai & kirim amplop pasang`, !!qr && [200, 201, 202].includes(await hpPindai(hp, qr)));
      st = await tungguTahap(['sas']);
      const sasHp = qr && R.kodeSas({ s_mac: qr.s_mac, e_mac: qr.e_mac, k_rencana: hp.k_rencana, k_kerjakan: hp.k_kerjakan, e_hp: hp.e_hp, mac_id: qr.mac_id, perangkat_id: hp.perangkat_id });
      cek(`[${nama}] kode 6 digit di browser = kode di HP`, !!st && st.kode === sasHp && st.nama === nama, JSON.stringify(st));
      cek(`[${nama}] QR tidak lagi dikirim setelah tahap kode`, !!st && st.modul === undefined);
      const stSas = st;
      cek(`[${nama}] "Kode sama" + Kerjakan → 202`, (await minta('/chat/pasang/jawab', { metode: 'POST', isi: { setuju: true, kerjakan: true }, kunci })).status === 202);
      st = await tungguTahap(['selesai']);
      cek(`[${nama}] terpasang: Rencana + Kerjakan`, !!st && st.mode === 'rencana+kerjakan', JSON.stringify(st));
      await tidur(3000);   // proses anak selesai (kode darurat) & kunci sesi pasang dilepas
      return { hp, stSas, st, qr };
    };
    const a = await pasangHp('POCO Uji');
    cek('APK baru: kode tampil dengan SHA sertifikat (bukan ditolak)', a.stSas && a.stSas.sertifikat === H.SERTIFIKAT_APK_UJI, JSON.stringify(a.stSas));
    const kf = JSON.parse(fs.readFileSync(path.join(F, 'konfigurasi.json'), 'utf8'));
    cek('"Kode sama" mempercayai APK: sertifikat tercatat (0600)', kf.apkSertifikatDebugSha256.includes(H.SERTIFIKAT_APK_UJI)
      && (fs.statSync(path.join(F, 'konfigurasi.json')).mode & 0o777) === 0o600);
    cek('kode darurat tampil sekali (pemasangan pertama)', /^[A-Z2-7]{5}(-[A-Z2-7]{5}){4}$/.test(a.st.darurat || ''), a.st.darurat);
    let pj = R.bacaPerangkat(F);
    cek('perangkat.json: 1 HP rencana+kerjakan', pj.length === 1 && pj[0].perangkat_id === a.hp.perangkat_id && pj[0].mode === 'rencana+kerjakan');
    let audit = fs.readFileSync(path.join(F, R.BERKAS.audit), 'utf8');
    cek('audit: sertifikat dipercaya & dipasang', /"jenis":"sertifikat","keputusan":"dipercaya"/.test(audit) && /"keputusan":"dipasang"/.test(audit));
    const logPelaksana = (() => { try { return fs.readFileSync(path.join(F, 'pelaksana.log'), 'utf8'); } catch { return logPl; } })();
    cek('kode darurat & QR tidak masuk log pelaksana/server', !logPelaksana.includes(a.st.darurat) && !logSrv.includes(a.st.darurat) && !logPelaksana.includes(a.qr.kode_daftar));

    // ---------- 2. HP kedua (APK sudah dikenal) lalu HP ketiga → slot penuh → HP paling lama dilepas OTOMATIS ----------
    const b = await pasangHp('Tab Uji');
    cek('APK yang sudah dipercaya: tanpa peringatan APK baru', b.stSas && b.stSas.sertifikat === undefined, JSON.stringify(b.stSas));
    cek('2 HP aktif, tidak ada yang dilepas', b.st.dilepas === 0 && R.bacaPerangkat(F).filter(e => e.dicabut === undefined).length === 2);
    const c = await pasangHp('HP Baru Uji', K_PERINTAH);
    pj = R.bacaPerangkat(F);
    const aktif = pj.filter(e => e.dicabut === undefined).map(e => e.perangkat_id);
    cek('HP ketiga: yang paling lama dilepas otomatis (maks 2)', c.st.dilepas === 1 && aktif.length === 2 && !aktif.includes(a.hp.perangkat_id)
      && aktif.includes(b.hp.perangkat_id) && aktif.includes(c.hp.perangkat_id), JSON.stringify(pj.map(e => [e.nama, e.dicabut !== undefined])));
    audit = fs.readFileSync(path.join(F, R.BERKAS.audit), 'utf8');
    cek('audit: HP lama dicabut untuk memberi tempat HP baru', new RegExp(`"perangkat_id":"${a.hp.perangkat_id}","jenis":"cabut".*memberi tempat HP baru`).test(audit));
    const hl = await klienHp(a.hp).panggil('POST', 'hp/halo', { body: { aktif: true, versiApk: VERSI_APK }, klien: KLIEN_APK });
    cek('relay: token HP lama ditolak/dicabut', hl.status === 401 || hl.status === 403 || (hl.data && hl.data.perangkat && hl.data.perangkat.status === 'dicabut'), `${hl.status} ${JSON.stringify(hl.data)}`);

    // ---------- 3. sesi pasang Terminal yang menggantung diambil alih dari browser ----------
    const t2 = jalan(['--pasang-hp']);
    cek('Terminal saat slot penuh → berhenti dengan petunjuk "Hubungkan HP" (tidak melepas HP diam-diam)', t2.status === 1 && /maks 2/.test(t2.stderr)
      && /Hubungkan HP/.test(t2.stderr) && R.bacaPerangkat(F).filter(e => e.dicabut === undefined).length === 2, t2.stderr);
    // daftar HP terhubung di dialog (laporan pelaksana) + Putuskan dari web
    const stD = await tunggu(async () => { const x = await status(); return Array.isArray(x.perangkat) && x.perangkat.length === 2 ? x : null; }, 15000);
    cek('dialog: daftar HP terhubung 2/2 (nama, mode, tanpa kunci/token)', !!stD && stD.maksPerangkat === 2
      && stD.perangkat.map(e => e.id).sort().join() === [b.hp.perangkat_id, c.hp.perangkat_id].sort().join()
      && stD.perangkat.every(e => Object.keys(e).sort().join() === 'dipasang,id,mode,nama'), JSON.stringify(stD && stD.perangkat));
    cek('Putuskan id yang tidak ada di daftar → 409', (await minta('/chat/pasang/cabut', { metode: 'POST', isi: { id: a.hp.perangkat_id }, kunci: '' })).status === 409);
    cek('Putuskan dari web → 202', (await minta('/chat/pasang/cabut', { metode: 'POST', isi: { id: b.hp.perangkat_id }, kunci: '' })).status === 202);
    cek('HP diputuskan: dicabut di Mac & hilang dari daftar dialog', !!await tunggu(async () => {
      const e = R.bacaPerangkat(F).find(x => x.perangkat_id === b.hp.perangkat_id), x = await status();
      return e && e.dicabut !== undefined && Array.isArray(x.perangkat) && x.perangkat.length === 1;
    }, 15000));
    const terminal = spawn(process.execPath, [SKRIP, '--folder', F, '--pasang-hp'], { env: ENV, stdio: ['pipe', 'pipe', 'pipe'] });
    let logT = ''; terminal.stdout.on('data', c2 => { logT += c2; }); terminal.stderr.on('data', c2 => { logT += c2; });
    cek('Terminal --pasang-hp menampilkan QR (memegang sesi)', !!await tunggu(() => /Berlaku sampai/.test(logT), 30000), logT.slice(-300));
    cek('mulai dari browser saat Terminal memegang sesi → 202', (await minta('/chat/pasang/mulai', { metode: 'POST', isi: {} })).status === 202);
    cek('proses Terminal dihentikan (diambil alih)', !!await tunggu(() => terminal.exitCode !== null || terminal.signalCode !== null, 20000));
    const stT = await tungguTahap(['menunggu', 'qr'], 30000);
    cek('relay masih memegang QR lama → dialog menunggu dengan pesan jelas (bukan gagal)', !!stT && (stT.tahap === 'qr' || /kedaluwarsa/.test(stT.pesan || '')), JSON.stringify(stT));
    cek('batal → diam', (await minta('/chat/pasang/batal', { metode: 'POST', isi: {} })).json.tahap === 'diam');
  } catch (e) { gagal++; console.log('GAGAL (pengecualian)', e && e.stack); }
  finally {
    berhenti();
    fs.rmSync(dasar, { recursive: true, force: true });
    console.log(`HASIL: ${gagal ? 'GAGAL' : 'LULUS'} ${lulus}/${lulus + gagal}`);
    process.exit(gagal ? 1 : 0);
  }
})();
