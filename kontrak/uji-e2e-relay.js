#!/usr/bin/env node
// Uji end-to-end P2 dengan relay LOKAL: pelaksana.js (folder uji sementara, claude tiruan) ↔ relay (php spark serve) ↔ HP tiruan.
// Pakai (relay lokal + DB uji sudah jalan, Mac dibuat dengan `php spark relay:mac-baru`):
//   RELAY_UJI=http://127.0.0.1:4640/ MAC_ID=<16 heksa> MAC_TOKEN=<64 heksa> node apk/kontrak/uji-e2e-relay.js
// DILARANG diarahkan ke relay produksi (URL selain 127.0.0.1/localhost ditolak). Folder owner tidak disentuh.
'use strict';
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const R = require('../../_app_padev_studio_3d/pelaksana-relay.js');
const H = require('./hp-tiruan.js');
// REV-29: versi APK diambil dari apk/pubspec.yaml (bukan ditulis tetap) agar ketidakcocokan dengan minApk relay tertangkap
const VERSI_APK = (/^version:\s*(\d+\.\d+\.\d+)/m.exec(fs.readFileSync(path.join(__dirname, '../pubspec.yaml'), 'utf8')) || [])[1];
if (!VERSI_APK) { console.error('versi tidak terbaca dari apk/pubspec.yaml'); process.exit(2); }
const KLIEN_APK = 'apk/' + VERSI_APK;

const URL_UJI = process.env.RELAY_UJI || '', MAC_ID = process.env.MAC_ID || '', TOKEN = process.env.MAC_TOKEN || '';
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+\/$/.test(URL_UJI) || !/^[0-9a-f]{16}$/.test(MAC_ID) || !/^[0-9a-f]{64}$/.test(TOKEN)) {
  console.error('Butuh RELAY_UJI=http://127.0.0.1:<port>/, MAC_ID, MAC_TOKEN (relay lokal saja).'); process.exit(2);
}
const SKRIP = path.join(__dirname, '../../_app_padev_studio_3d/pelaksana.js');
const dasar = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-relay-')));
const F = path.join(dasar, 'folder'), DOK = path.join(dasar, 'dok');
// SEC-83: daftar cabut atestasi dari berkas lokal (mode uji), bukan android.googleapis.com; SERIAL_CABUT = serial daun yang "dicabut Google"
const STATUS_ATESTASI = path.join(dasar, 'status-atestasi.json'), SERIAL_CABUT = 0x5ec8a3;
fs.writeFileSync(STATUS_ATESTASI, JSON.stringify({ entries: { [SERIAL_CABUT.toString(16)]: { status: 'REVOKED', reason: 'KEY_COMPROMISE' } } }));
const ENV = { ...process.env, KANTOR_PELAKSANA_UJI_AKAR: DOK, KANTOR_PELAKSANA_UJI_STATUS_ATESTASI: STATUS_ATESTASI };
let lulus = 0, gagal = 0;
const cek = (nama, ok, info = '') => { if (ok) { lulus++; console.log('ok   ' + nama); } else { gagal++; console.log(`GAGAL ${nama} ${info}`); } };
const tidur = ms => new Promise(ok => setTimeout(ok, ms));
async function tunggu(fn, ms = 30000, jeda = 500) { const b = Date.now() + ms; for (;;) { const v = await fn(); if (v) return v; if (Date.now() > b) return null; await tidur(jeda); } }

// ---------- persiapan folder uji ----------
fs.mkdirSync(F, { mode: 0o700 }); fs.mkdirSync(DOK, { mode: 0o700 });
for (const p of ['uji', 'dua', 'tutup']) fs.mkdirSync(path.join(DOK, p));
const STUB = path.join(dasar, 'claude-tiruan.js');
fs.writeFileSync(STUB, `#!/usr/bin/env node
const a = process.argv.slice(2);
if (a.includes('--version')) { console.log('tiruan 1.0'); process.exit(0); }
let s = ''; process.stdin.on('data', c => { s += c; }); process.stdin.on('end', () => {
  const mode = a[a.indexOf('--permission-mode') + 1], i = a.indexOf('--session-id') >= 0 ? a.indexOf('--session-id') : a.indexOf('--resume'), sid = a[i + 1];
  const out = o => process.stdout.write(JSON.stringify(o) + '\\n');
  out({ type: 'system', subtype: 'init', permissionMode: mode, tools: mode === 'plan' ? ['Read', 'Grep', 'Glob'] : ['Read', 'Edit', 'Write', 'Bash'], session_id: sid, model: 'tiruan' });
  out({ type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Halo dari tiruan. ' } } });
  out({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Read', input: { file_path: '/x/a.txt' } }] } });
  setTimeout(() => out({ type: 'result', subtype: 'success', is_error: false, result: 'PENANDA-UJI-' + mode + ' panjang=' + s.length, session_id: sid, permission_denials: [] }), 300);
});
`, { mode: 0o700 });
fs.writeFileSync(path.join(F, 'kunci'), crypto.randomBytes(32).toString('hex') + '\n', { mode: 0o600 });
const akar = H.buatAkarUji();
const konfig = jarakJauh => ({ server: 'http://127.0.0.1:4699', claude: STUB, akun: { akun1: { label: 'Akun 1', folder: '~/.claude' } },
  proyek: [{ id: 'uji', nama: 'Uji', path: path.join(DOK, 'uji'), akun: ['akun1'], kerjakan: true, hp: 'rencana' },
    { id: 'dua', nama: 'Dua', path: path.join(DOK, 'dua'), akun: ['akun1'], kerjakan: true, hp: 'kerjakan' },
    { id: 'tutup', nama: 'Tutup', path: path.join(DOK, 'tutup'), akun: ['akun1'], kerjakan: true }],
  jarakJauh, apkSertifikatSha256: [H.SERTIFIKAT_APK_UJI], atestasiAkar: [akar.spkiB64] });
const tulisKonfig = j => fs.writeFileSync(path.join(F, 'konfigurasi.json'), JSON.stringify(konfig(j), null, 1), { mode: 0o600 });
tulisKonfig(true);
const jalan = (args, input) => spawnSync(process.execPath, [SKRIP, '--folder', F, ...args], { env: ENV, input, encoding: 'utf8', timeout: 60000 });

// ---------- HP: klien relay ----------
const klienHp = hp => R.buatKlienRelay({ url: URL_UJI, token: hp.token, uji: true });
async function kirim(hp, amplop) {   // hp/kirim dengan menghormati batas laju relay (6/mnt)
  for (let i = 0; i < 8; i++) {
    const r = await klienHp(hp).panggil('POST', 'hp/kirim', { body: { amplop }, klien: KLIEN_APK });
    if (r.status !== 429) return r;
    await tidur(Math.min((r.retryAfter || 10) * 1000, 61000));
  }
  return { status: 429 };
}
const kabarHp = new Map();   // perangkat_id → {setelah, isi:[], penyimpan}
async function tarikKabar(hp, qr) {
  const s = kabarHp.get(hp.perangkat_id) || { setelah: '', isi: [], penyimpan: R.buatPenyimpanReplayMemori() };
  kabarHp.set(hp.perangkat_id, s);
  const r = await klienHp(hp).panggil('GET', 'hp/kabar', { query: { setelah: s.setelah, batas: 50 }, klien: KLIEN_APK });
  if (r.status !== 200) return s.isi;
  for (const k of r.data.kabar) {
    const h = H.bukaKabar(hp, qr, k.amplop, s.penyimpan);
    if (h.ok) s.isi.push(h.isi); else s.isi.push({ tidakSah: h.alasan });
    s.setelah = k.id;
  }
  if (r.data.kabar.length) await klienHp(hp).panggil('POST', 'hp/kabar/akui', { body: { sampai: s.setelah }, klien: KLIEN_APK });
  return s.isi;
}
const tandaUntuk = (hp, id) => (kabarHp.get(hp.perangkat_id)?.isi || []).filter(x => x.jenis === 'tanda_terima' && x.tanda_terima.perintah_id === id).map(x => x.tanda_terima);
async function tungguHasil(hp, qr, id, hasil, ms = 40000) {
  return tunggu(async () => { await tarikKabar(hp, qr); return tandaUntuk(hp, id).find(t => hasil.includes(t.hasil)); }, ms, 700);
}
const bacaAudit = () => { try { return fs.readFileSync(path.join(F, 'audit-relay.jsonl'), 'utf8').trim().split('\n').map(l => JSON.parse(l)); } catch { return []; } };

// ---------- pasang lewat CLI (QR Terminal dibaca CoreImage) ----------
async function pasang(hp, { jawab = 'ya', rusakAtestasi = false, atestasi } = {}) {   // atestasi = opsi rantai (uji tolak)
  const p = spawn(process.execPath, [SKRIP, '--folder', F, '--pasang-hp'], { env: ENV, stdio: ['pipe', 'pipe', 'pipe'] });
  let keluar = '', galat = '';
  p.stdout.on('data', c => { keluar += c; }); p.stderr.on('data', c => { galat += c; });
  const selesai = new Promise(ok => p.on('close', kode => ok(kode)));
  await tunggu(() => keluar.includes('Pindai dengan APK'), 20000, 200);
  const baris = keluar.split('\n').filter(b => b.includes('\x1b[30;107m'));
  const png = path.join(dasar, 'qr.png');
  H.tulisPng(png, H.matriksDariTerminal(baris));
  // macOS: CoreImage (seperti kamera); Linux/CI: JSQR=<path jsqr> sebagai pembaca QR independen
  let teks = process.env.JSQR ? null : (H.dekodeQr(dasar, [png]) || [])[0];
  if (process.env.JSQR) {
    const m = H.matriksDariTerminal(baris), s = 6, w = m[0].length * s, h = m.length * s, px = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = m[Math.floor(y / s)][Math.floor(x / s)] ? 0 : 255, i = (y * w + x) * 4; px[i] = px[i + 1] = px[i + 2] = v; px[i + 3] = 255; }
    const q = require(process.env.JSQR)(px, w, h);
    teks = q ? q.data : null;
  }
  const qr = teks ? JSON.parse(teks) : null;
  if (!qr) { p.kill(); return { kode: await selesai, keluar, galat, qr: null }; }
  hp.token = null;
  const d = await R.buatKlienRelay({ url: qr.relay, token: null, uji: true }).panggil('POST', 'hp/daftar', { body: { kode_daftar: qr.kode_daftar, mac_id: qr.mac_id }, tanpaToken: true, klien: KLIEN_APK });
  hp.perangkat_id = d.data && d.data.perangkat_id; hp.token = d.data && d.data.token;
  const am = H.amplopPasang(hp, qr, akar, rusakAtestasi ? { digest: crypto.randomBytes(32).toString('hex') } : atestasi ? { atestasi } : {});
  await kirim(hp, am);
  if (!atestasi) {   // sertifikat APK belum dikenal (rusakAtestasi) TIDAK ditolak: owner memutuskan saat kode pasang
    const m = await tunggu(() => /KODE PASANG: (\d{3}) (\d{3})/.exec(keluar), 30000, 200);
    const sasHp = R.kodeSas({ s_mac: qr.s_mac, e_mac: qr.e_mac, k_rencana: hp.k_rencana, k_kerjakan: hp.k_kerjakan, e_hp: hp.e_hp, mac_id: qr.mac_id, perangkat_id: hp.perangkat_id });
    hp.sasCocok = !!m && m[1] + m[2] === sasHp;
    p.stdin.write(jawab + '\n');
  }
  const kode = await selesai;
  return { kode, keluar, galat, qr };
}

(async () => {
  try {
    // 1. --relay-siapkan (token lewat stdin, bukan argv)
    const s1 = jalan(['--relay-siapkan', '--relay-url', URL_UJI], `${MAC_ID}\n${TOKEN}\n`);
    cek('--relay-siapkan', s1.status === 0 && /halo 200/.test(s1.stdout), s1.stdout + s1.stderr);
    cek('token tidak tercetak', !s1.stdout.includes(TOKEN) && !s1.stderr.includes(TOKEN));
    for (const n of ['relay.json', 'relay-token', 'kunci-mac-tanda.pem', 'kunci-mac-sandi.pem']) cek(`${n} 0600`, (fs.statSync(path.join(F, n)).mode & 0o777) === 0o600);
    // K3 SEC-91: --relay-rotasi → token baru 0600, token lama mati
    const ro = jalan(['--relay-rotasi']);
    const tokenBaru = fs.readFileSync(path.join(F, 'relay-token'), 'utf8').trim();
    cek('--relay-rotasi (K3)', ro.status === 0 && /DIGANTI/.test(ro.stdout) && /halo: 200/.test(ro.stdout) && /^[0-9a-f]{64}$/.test(tokenBaru) && tokenBaru !== TOKEN, ro.stdout + ro.stderr);
    cek('--relay-rotasi: token tidak tercetak, relay-token 0600', !ro.stdout.includes(tokenBaru) && (fs.statSync(path.join(F, 'relay-token')).mode & 0o777) === 0o600);
    const lama = await R.buatKlienRelay({ url: URL_UJI, token: TOKEN, uji: true }).panggil('POST', 'mac/halo', { body: { versi: R.VERSI_KLIEN, status: [] } });
    cek('--relay-rotasi: token lama ditolak relay (401)', lama.status === 401, String(lama.status));
    const c1 = jalan(['--cek']);
    cek('--cek dengan relay', c1.status === 0 && /Uji relay {7}: sehat 204 · halo 200/.test(c1.stdout), c1.stdout + c1.stderr);

    // 2. APK dengan sertifikat belum dikenal (atestasi lain sah) → TIDAK langsung ditolak: kode pasang + peringatan APK BARU + SHA;
    //    owner menolak ("batal") → tidak dipasang & sertifikat tidak dicatat
    const hpBuruk = H.buatHp('HP Buruk');
    const pb = await pasang(hpBuruk, { rusakAtestasi: true, jawab: 'batal' });
    cek('QR Terminal terbaca', !!pb.qr && pb.qr.mac_id === MAC_ID && pb.qr.relay === URL_UJI);
    cek('sertifikat tak dikenal → kode pasang dengan peringatan APK BARU + SHA-256', /APK BARU \(sertifikat [0-9a-f]{64}\)/.test(pb.keluar) && hpBuruk.sasCocok, pb.keluar.slice(-400));
    const kfB = JSON.parse(fs.readFileSync(path.join(F, 'konfigurasi.json'), 'utf8'));
    cek('owner batal → sertifikat APK baru tidak dicatat', !(kfB.apkSertifikatDebugSha256 || []).some(x => !(kfB.apkSertifikatSha256 || []).includes(x)) && /Dibatalkan/.test(pb.keluar), JSON.stringify(kfB.apkSertifikatDebugSha256));
    // SEC-83: serial daun ada di daftar cabut (berkas uji) → ditolak dengan pesan jelas
    const pc = await pasang(H.buatHp('HP Dicabut'), { atestasi: { serialDaun: SERIAL_CABUT } });
    cek('serial dicabut Google → pasang ditolak (SEC-83)', pc.kode === 1 && /atestasi_dicabut/.test(pc.galat) && /sertifikat dicabut Google/.test(pc.galat), pc.galat);
    cek('daftar cabut dibaca sebelum QR', /Daftar cabut atestasi Google: 1 serial dicabut/.test(pc.keluar), pc.keluar.slice(0, 300));
    cek('perangkat.json tetap kosong', !fs.existsSync(path.join(F, 'perangkat.json')) || R.bacaPerangkat(F).length === 0);

    // 3. pasang sah → kode 6 digit sama → "ya kerjakan"
    const hp = H.buatHp('HP Owner');
    const ps = await pasang(hp, { jawab: 'ya kerjakan' });
    const qr = ps.qr;
    cek('pasang sah selesai', ps.kode === 0 && /TERPASANG/.test(ps.keluar), ps.keluar.slice(-400) + ps.galat);
    cek('kode 6 digit HP = Terminal', hp.sasCocok === true);
    const kd = /\n {2}([A-Z2-7]{5}(?:-[A-Z2-7]{5}){4})/.exec(ps.keluar);
    cek('kode darurat tampil sekali', !!kd && fs.existsSync(path.join(F, 'kode-darurat.hash')));
    cek('rahasia QR tidak tercetak sebagai teks', !ps.keluar.includes(qr.rahasia));
    const ph = await tunggu(async () => (await tarikKabar(hp, qr)).find(x => x.jenis === 'pasang_hasil'), 15000);
    cek('kabar pasang_hasil disetujui (tanda S_mac sah)', !!ph && ph.pasang_hasil.disetujui === true);
    const pj = R.bacaPerangkat(F);
    cek('perangkat.json: 1 perangkat rencana+kerjakan', pj.length === 1 && pj[0].perangkat_id === hp.perangkat_id && pj[0].mode === 'rencana+kerjakan');
    const dh = jalan(['--daftar-hp']);
    cek('--daftar-hp', dh.status === 0 && dh.stdout.includes(hp.perangkat_id) && /relay: aktif/.test(dh.stdout), dh.stdout);

    // 4. pelaksana utama (jarakJauh:true)
    let log = '';
    const mulaiPelaksana = () => { const x = spawn(process.execPath, [SKRIP, '--folder', F], { env: ENV, stdio: ['ignore', 'pipe', 'pipe'] }); x.stdout.on('data', c => { log += c; }); x.stderr.on('data', c => { log += c; }); return x; };
    let pl = mulaiPelaksana();
    cek('pelaksana: relay aktif', !!await tunggu(() => /relay: aktif/.test(log), 15000), log.slice(-500));
    const halo = await tunggu(async () => { const r = await klienHp(hp).panggil('POST', 'hp/halo', { body: { aktif: true, versiApk: VERSI_APK }, klien: KLIEN_APK }); return r.status === 200 && r.data.mac.tersambung && r.data.status ? r.data : null; }, 20000, 1000);
    const st = halo && H.bukaKabar(hp, qr, halo.status.amplop);
    const ids = st && st.ok ? st.isi.status.proyek.map(p => `${p.id}:${p.hp}`).join(',') : '';
    // v2 §9.2: proyek hp:false ikut sebagai penanda nama untuk tab Sesi (cermin ringkas), tanpa akun/batas → tidak bisa diperintah
    const penanda = st && st.ok ? st.isi.status.proyek.find(p => p.id === 'tutup') : null;
    cek('status lewat halo (bertanda, proyek HP + penanda v2)', ids === 'uji:rencana,dua:kerjakan,tutup:false' &&
      !!penanda && penanda.akun === undefined && penanda.batasMenit === undefined, JSON.stringify(st && st.isi));

    // 5. Rencana sah → diterima, mulai, kabar teks/alat, selesai
    const tugas = () => 't-hp-' + crypto.randomBytes(8).toString('hex');
    const tugasRencana = tugas();
    const pRencana = H.amplopPerintah(hp, qr, 'jalankan', { tugas: tugasRencana, proyek: 'uji', akun: 'akun1', mode: 'rencana', pesan: 'Tolong cek PENANDA-UJI', baru: true });
    cek('hp/kirim rencana 202', (await kirim(hp, pRencana)).status === 202);
    const sl = await tungguHasil(hp, qr, pRencana.id, ['selesai', 'gagal', 'ditolak']);
    cek('rencana selesai', sl && sl.hasil === 'selesai', JSON.stringify(sl));
    const tt = tandaUntuk(hp, pRencana.id).map(t => t.hasil).join(',');
    cek('urutan tanda terima diterima,mulai,selesai', tt === 'diterima,mulai,selesai', tt);
    cek('perintah_sha256 = hash amplop', tandaUntuk(hp, pRencana.id).every(t => t.perintah_sha256 === R.hashAmplop(pRencana)));
    const kb = kabarHp.get(hp.perangkat_id).isi.filter(x => x.jenis === 'kabar' && x.kabar.perintah_id === pRencana.id).map(x => x.kabar);
    cek('kabar teks/alat/selesai', kb.some(k => k.tahap === 'teks') && kb.some(k => k.tahap === 'alat') && kb.some(k => k.tahap === 'selesai' && /PENANDA-UJI-plan/.test(k.teks)), JSON.stringify(kb));
    cek('tidak ada kabar tidak sah', !kabarHp.get(hp.perangkat_id).isi.some(x => x.tidakSah));
    // K1 SEC-87: "Coba lagi" = amplop BARU dengan `tugas` sama → tugas_ulang + hasil_terakhir, tidak dijalankan lagi
    const tugasUlang = async (nama, hasilLalu) => {
      const am = H.amplopPerintah(hp, qr, 'jalankan', { tugas: tugasRencana, proyek: 'uji', akun: 'akun1', mode: 'rencana', pesan: 'Tolong cek PENANDA-UJI', baru: true });
      await kirim(hp, am);
      const t = await tungguHasil(hp, qr, am.id, ['ditolak', 'diterima', 'mulai', 'selesai', 'gagal'], 30000);
      await tidur(2000); await tarikKabar(hp, qr);
      const semuaT = tandaUntuk(hp, am.id), kbU = kabarHp.get(hp.perangkat_id).isi.filter(x => x.jenis === 'kabar' && x.kabar.perintah_id === am.id);
      cek(nama, t && t.hasil === 'ditolak' && t.alasan === 'tugas_ulang' && t.hasil_terakhir === hasilLalu && semuaT.length === 1 && !kbU.length, JSON.stringify(semuaT));
    };
    await tugasUlang('tugas sama dikirim ulang → tugas_ulang, hasil_terakhir selesai (K1)', 'selesai');

    // 6. Kerjakan sah (K_kerjakan, proyek hp:"kerjakan")
    const pKerja = H.amplopPerintah(hp, qr, 'jalankan', { tugas: tugas(), proyek: 'dua', akun: 'akun1', mode: 'kerjakan', pesan: 'ubah', baru: true }, { kunci: 'kerjakan' });
    await kirim(hp, pKerja);
    const sk = await tungguHasil(hp, qr, pKerja.id, ['selesai', 'gagal', 'ditolak']);
    cek('kerjakan (K_kerjakan) selesai', sk && sk.hasil === 'selesai', JSON.stringify(sk));

    // 7. penolakan bertanda terima
    const tolakDgn = async (nama, amplop, pola) => {
      await kirim(hp, amplop);
      const t = await tungguHasil(hp, qr, amplop.id, ['ditolak', 'selesai', 'gagal'], 30000);
      cek(nama, t && t.hasil === 'ditolak' && pola.test(t.alasan || ''), JSON.stringify(t));
    };
    await tolakDgn('kerjakan bertanda K_rencana → ditolak', H.amplopPerintah(hp, qr, 'jalankan', { tugas: tugas(), proyek: 'dua', akun: 'akun1', mode: 'kerjakan', pesan: 'x', baru: true }, { kunci: 'rencana' }), /kerjakan_tanpa_k_kerjakan/);
    await tolakDgn('kerjakan ke proyek hp:"rencana" → ditolak', H.amplopPerintah(hp, qr, 'jalankan', { tugas: tugas(), proyek: 'uji', akun: 'akun1', mode: 'kerjakan', pesan: 'x', baru: true }, { kunci: 'kerjakan' }), /kerjakan tidak diizinkan/);
    await tolakDgn('proyek hp:false → ditolak', H.amplopPerintah(hp, qr, 'jalankan', { tugas: tugas(), proyek: 'tutup', akun: 'akun1', mode: 'rencana', pesan: 'x', baru: true }), /tidak diizinkan untuk HP/);
    await tolakDgn('amplop basi → ditolak', H.amplopPerintah(hp, qr, 'jalankan', { tugas: tugas(), proyek: 'uji', akun: 'akun1', mode: 'rencana', pesan: 'x', baru: true }, { dibuat: Date.now() - 300000, masa: 60000 }), /^kedaluwarsa$/);
    await tolakDgn('rencana 11 mnt → ditolak', H.amplopPerintah(hp, qr, 'jalankan', { tugas: tugas(), proyek: 'uji', akun: 'akun1', mode: 'rencana', pesan: 'x', baru: true }, { masa: 11 * 60000 }), /masa_terlalu_panjang/);
    await tolakDgn('mac_id lain → ditolak', H.amplopPerintah(hp, qr, 'minta_status', {}, { ubah: i => { i.mac_id = 'eeeeeeeeeeeeeeee'; } }), /isi_tidak_cocok/);
    await tolakDgn('urut lama → ditolak', H.amplopPerintah(hp, qr, 'minta_status', {}, { ubah: i => { i.urut = 1; } }), /urut_lama/);
    await tolakDgn('hentikan tugas yang tidak jalan → ditolak', H.amplopPerintah(hp, qr, 'hentikan', { tugas: tugas() }), /tidak berjalan/);
    await tolakDgn('akun tidak terdaftar (pagar laptop) → ditolak', H.amplopPerintah(hp, qr, 'jalankan', { tugas: tugas(), proyek: 'uji', akun: 'akunX', mode: 'rencana', pesan: 'x', baru: true }), /akun tidak terdaftar/);

    // 8. tanpa tanda terima: tanda salah, replay (sebelum & sesudah restart)
    const diam = async (nama, amplop, keputusan) => {
      const r = await kirim(hp, amplop);
      const a = await tunggu(() => bacaAudit().find(x => x.id === amplop.id && x.keputusan === keputusan), 30000);
      await tidur(3000); await tarikKabar(hp, qr);
      const sebelum = nama.includes('replay') ? 3 : 0;   // replay: tanda terima lama (diterima,mulai,selesai) saja
      cek(nama, r.status === 202 && !!a && tandaUntuk(hp, amplop.id).length === sebelum, `kirim ${r.status} audit ${!!a} tt ${tandaUntuk(hp, amplop.id).length}`);
    };
    const rusak = { ...H.amplopPerintah(hp, qr, 'minta_status', {}) };
    const ct = R.dariB64u(rusak.ct); ct[0] ^= 1; rusak.ct = R.b64u(ct);
    await diam('tanda salah → tanpa tanda terima, tercatat audit', rusak, 'ditolak');
    await diam('replay amplop yang sudah jalan → diam (REV-27)', pRencana, 'diabaikan');
    pl.kill('SIGTERM'); await new Promise(ok => pl.on('close', ok));
    log = ''; pl = mulaiPelaksana();
    await tunggu(() => /relay: aktif/.test(log), 15000);
    await diam('replay setelah restart pelaksana → diam', pKerja, 'diabaikan');
    await tugasUlang('tugas ulang setelah restart pelaksana → tetap tugas_ulang (persist K1)', 'selesai');

    // 9. perangkat kedua, lalu --cabut-hp → amplopnya ditolak walau relay menerima
    const hp2 = H.buatHp('HP Cadangan');
    const ps2 = await pasang(hp2, { jawab: 'ya' });
    cek('pasang perangkat kedua (rencana)', ps2.kode === 0 && R.bacaPerangkat(F).length === 2 && !/KODE DARURAT/.test(ps2.keluar));
    const hp3 = H.buatHp('HP Ketiga');
    const p3 = jalan(['--pasang-hp']);
    cek('perangkat ketiga ditolak (maks 2)', p3.status === 1 && /maks 2/.test(p3.stderr), p3.stderr);
    void hp3;
    await tunggu(async () => (await klienHp(hp2).panggil('POST', 'hp/halo', { body: { aktif: true, versiApk: VERSI_APK }, klien: KLIEN_APK })).data?.mac?.tersambung, 20000, 1000);
    const pKedua = H.amplopPerintah(hp2, ps2.qr, 'jalankan', { tugas: tugas(), proyek: 'dua', akun: 'akun1', mode: 'kerjakan', pesan: 'x', baru: true }, { kunci: 'kerjakan' });
    await kirim(hp2, pKedua);
    const t2 = await tungguHasil(hp2, ps2.qr, pKedua.id, ['ditolak', 'selesai'], 30000);
    cek('perangkat mode rencana: Kerjakan ditolak', t2 && t2.hasil === 'ditolak' && /kerjakan tidak diizinkan/.test(t2.alasan), JSON.stringify(t2));
    const cb = jalan(['--cabut-hp', hp2.perangkat_id]);
    cek('--cabut-hp', cb.status === 0 && /DICABUT/.test(cb.stdout), cb.stdout + cb.stderr);
    const h2 = await klienHp(hp2).panggil('POST', 'hp/halo', { body: { aktif: true, versiApk: VERSI_APK }, klien: KLIEN_APK });
    cek('token HP yang dicabut ditolak relay (401)', h2.status === 401);

    // 10. kode darurat → semua dicabut, jarak jauh mati
    const dr = await R.buatKlienRelay({ url: URL_UJI, token: null, uji: true }).panggil('POST', 'darurat', { body: { mac_id: MAC_ID, kode: kd[1] }, tanpaToken: true, klien: 'web/1.0.0' });
    cek('POST darurat 202', dr.status === 202, JSON.stringify(dr));
    const ad = await tunggu(() => bacaAudit().find(x => x.jenis === 'darurat' && x.keputusan === 'diterima'), 30000);
    cek('darurat: semua perangkat dicabut, penanda darurat ada', !!ad && R.bacaPerangkat(F).every(e => e.dicabut !== undefined) && fs.existsSync(path.join(F, 'darurat.json')) && !fs.existsSync(path.join(F, 'kode-darurat.hash')));
    const h1 = await tunggu(async () => (await klienHp(hp).panggil('POST', 'hp/halo', { body: { aktif: true, versiApk: VERSI_APK }, klien: KLIEN_APK })).status === 401, 10000);
    cek('darurat: token HP ditolak relay', !!h1);
    pl.kill('SIGTERM'); await new Promise(ok => pl.on('close', ok));

    // 11. jarakJauh:false → relay tidak ditarik sama sekali
    tulisKonfig(false); log = ''; pl = mulaiPelaksana();
    await tunggu(() => /jarak jauh mati/.test(log), 10000); await tidur(3000);
    cek('jarakJauh:false → tidak menarik', /jarak jauh mati/.test(log) && !/relay: aktif/.test(log) && !/tarik kotak/.test(log), log.slice(-300));
    pl.kill('SIGTERM'); await new Promise(ok => pl.on('close', ok));

    // 12. kebersihan: tanpa token/isi pesan di log & audit; berkas rahasia 0600
    const semua = fs.readFileSync(path.join(F, 'pelaksana.log'), 'utf8') + fs.readFileSync(path.join(F, 'audit-relay.jsonl'), 'utf8');
    cek('log/audit tanpa token & isi pesan', !semua.includes(TOKEN) && !semua.includes('Tolong cek PENANDA-UJI'));
    for (const n of ['perangkat.json', 'id-amplop.json', 'kabar-relay.json', 'audit-relay.jsonl']) cek(`${n} 0600`, (fs.statSync(path.join(F, n)).mode & 0o777) === 0o600);
  } catch (e) { gagal++; console.log('GAGAL (pengecualian) ' + (e && e.stack)); }
  fs.rmSync(dasar, { recursive: true, force: true });
  console.log(`HASIL: ${gagal ? 'GAGAL' : 'LULUS'} ${lulus}/${lulus + gagal}`);
  process.exit(gagal ? 1 : 0);
})();
