#!/usr/bin/env node
// Uji roadmap 2b/2c — pratinjau langsung & screenshot lewat jembatan relay SUNGGUHAN (pelaksana-relay.js buatJembatan +
// pelaksana-pratinjau.js; server dev sungguhan node di port acak; tailscale/Chrome/sips tiruan) ↔ relay tiruan ↔ HP tiruan.
// Pakai: node apk/kontrak/uji-pratinjau.js
'use strict';
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { execFileSync } = require('child_process');
const R = require('../../_app_padev_studio_3d/pelaksana-relay.js');
const PR = require('../../_app_padev_studio_3d/pelaksana-pratinjau.js');
const net = require('net');
const H = require('./hp-tiruan.js');

let lulus = 0, gagal = 0;
const cek = (nama, ok, info = '') => { if (ok) lulus++; else { gagal++; console.log(`GAGAL ${nama} ${String(typeof info === 'string' ? info : JSON.stringify(info)).slice(0, 500)}`); } };
const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'uji-pv-')));
const tunggu = async (f, ms = 15000) => { const t0 = Date.now(); while (!f()) { if (Date.now() - t0 > ms) return false; await new Promise(ok => setTimeout(ok, 50)); } return true; };
const g = (cwd, ...a) => execFileSync('git', ['-c', 'core.hooksPath=/dev/null', ...a], { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });

(async () => {
  const proj = path.join(tmp, 'Documents', 'proj'); fs.mkdirSync(proj, { recursive: true });
  const port = await new Promise(ok => { const s = net.createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => ok(p)); }); });
  const SERVER = "require('http').createServer((q,s)=>s.end('ok')).listen(Number(process.argv[1]),'127.0.0.1')";
  const cfg = {
    akun: new Map([['a1', { id: 'a1', label: 'A1', folder: path.join(tmp, '.claude'), bawaan: true }]]),
    proyek: new Map([['proj', { id: 'proj', nama: 'Proj', path: proj, real: proj, akun: ['a1'], hp: 'kerjakan', kerjakan: true, cermin: 'ringkas', dataPribadi: false,
      pratinjau: { perintah: [process.execPath, '-e', SERVER, '{port}'], port, jalur: '/', env: {}, jaringan: false } }]]),
    jarakJauh: true, batasMenit: { rencana: 30, kerjakan: 60 },
  };

  // relay tiruan
  const sk = { kotak: [], kabar: [], halo: [] };
  const srv = http.createServer((req, res) => {
    let b = ''; req.on('data', c => { b += c; }); req.on('end', () => {
      const jawab = (st, o) => { res.writeHead(st, { 'Content-Type': 'application/json' }); res.end(o === undefined ? '' : JSON.stringify(o)); };
      let body = null; try { body = b ? JSON.parse(b) : null; } catch { body = null; }
      const u = req.url.split('?')[0];
      if (u === '/mac/halo') { if (body && Array.isArray(body.status)) sk.halo.push(...body.status); return jawab(200, { ok: true, data: { waktu: Date.now(), perangkat: [] } }); }
      if (u === '/mac/kotak') return jawab(200, { ok: true, data: { amplop: sk.kotak.splice(0, 20), jedaMs: 300 } });
      if (u === '/mac/kotak/akui') return jawab(204);
      if (u === '/mac/kabar' && body && Array.isArray(body.kabar)) { sk.kabar.push(...body.kabar); return jawab(201, { ok: true, data: {} }); }
      return jawab(404, { ok: false });
    });
  });
  await new Promise(ok => srv.listen(0, '127.0.0.1', ok));
  const folderJ = path.join(tmp, 'pel'); fs.mkdirSync(folderJ, { mode: 0o700 });
  const km = R.buatKunciMac(); R.simpanKunciMac(folderJ, km);
  const macId = crypto.randomBytes(8).toString('hex');
  const hpK = H.buatHp('HP Kerjakan'); hpK.perangkat_id = crypto.randomBytes(8).toString('hex');
  const hpR = H.buatHp('HP Rencana'); hpR.perangkat_id = crypto.randomBytes(8).toString('hex');
  const hpL = H.buatHp('HP APK lama'); hpL.perangkat_id = crypto.randomBytes(8).toString('hex');
  const entri = (hp, mode) => ({ perangkat_id: hp.perangkat_id, nama: hp.nama, k_rencana_id: R.idKunci(hp.k_rencana), k_kerjakan_id: R.idKunci(hp.k_kerjakan),
    k_rencana: hp.k_rencana, k_kerjakan: hp.k_kerjakan, e_hp: hp.e_hp, fcm: '', mode, urut: Date.now(), dipasang: Date.now() });
  R.tulisAman(path.join(folderJ, R.BERKAS.relay), JSON.stringify({ url: `http://127.0.0.1:${srv.address().port}/`, mac_id: macId }));
  R.tulisAman(path.join(folderJ, R.BERKAS.token), crypto.randomBytes(32).toString('hex'));
  R.tulisAman(path.join(folderJ, R.BERKAS.perangkat), JSON.stringify({ v: 1, perangkat: [entri(hpK, 'rencana+kerjakan'), entri(hpR, 'rencana'), entri(hpL, 'rencana+kerjakan')] }));
  const qr = { s_mac: km.publik.s_mac, e_mac: km.publik.e_mac, mac_id: macId };

  const tugas = new Map();
  const alat = {
    tailscale: () => '/tiruan/tailscale', dnsTailscale: async () => 'macbook.tail1234.ts.net',
    serve: async () => ({ ok: true, out: '', err: '' }), serveMati: async () => ({ ok: true }), serveMatiSinkron: () => {},
    chrome: () => '/tiruan/chrome', potret: async (c, u, wh, keluar) => { fs.writeFileSync(keluar, 'png'); return true; },
    kecilkan: async () => Buffer.from('jpeg-tiruan-' + 'x'.repeat(300)),
  };
  const pv = PR.buatPratinjau({ folder: path.join(tmp, 'pel'), cfg, log: () => {}, alat, sandbox: null, rumah: tmp });
  const logJ = [];
  const jb = R.buatJembatan({ folder: folderJ, uji: true, cfg, log: t => logJ.push(t), tugas, hentikan: () => {}, hapusSesi: () => {}, versi: 'uji',
    polaTugas: /^t-[a-z0-9]{1,12}-[0-9a-f]{16}$/, jalankan: () => {}, pratinjau: pv });
  cek('jembatan mulai dengan pratinjau', jb.mulai() === true && logJ.some(t => /pratinjau siap/.test(t)), logJ.join('|'));

  const pen = Object.fromEntries([hpK, hpR, hpL].map(h => [h.perangkat_id, R.buatPenyimpanReplayMemori()]));
  const terbuka = Object.fromEntries([hpK, hpR, hpL].map(h => [h.perangkat_id, []]));
  const buka = () => {
    for (const k of sk.kabar.splice(0)) {
      const hp = [hpK, hpR, hpL].find(h => h.perangkat_id === k.perangkat_id);
      const x = H.bukaKabar(hp, qr, k.amplop, pen[hp.perangkat_id]);
      terbuka[hp.perangkat_id].push(x.ok ? { ...x.isi, _kd: k.amplop.kedaluwarsa } : { galat: x.alasan });
    }
  };
  const kabarJ = (hp, jenis) => { buka(); return terbuka[hp.perangkat_id].filter(x => x.jenis === jenis); };
  const tt = (hp, idP) => { buka(); return terbuka[hp.perangkat_id].find(x => x.jenis === 'tanda_terima' && x.tanda_terima.perintah_id === idP); };
  const kirim = (hp, isi, kunci = 'rencana') => {
    const a = H.amplopPerintah(hp, qr, 'pratinjau', isi, { kunci });
    sk.kotak.push({ kode: crypto.randomBytes(16).toString('hex'), jenis_kotak: 'perintah', amplop: a });
    return a.id;
  };

  // 1. langganan: HP K & R; HP lama tidak
  let idP = kirim(hpK, { proyek: 'proj', aksi: 'daftar' });
  await tunggu(() => kabarJ(hpK, 'pratinjau').length && tt(hpK, idP));
  const s0 = kabarJ(hpK, 'pratinjau').pop();
  cek('kabar pratinjau sah di HP: proyek mati, bisaMulai (HP Kerjakan)', s0 && s0.pratinjau.daftar[0].status === 'mati' && s0.pratinjau.daftar[0].bisaMulai === true, s0);
  idP = kirim(hpR, { proyek: 'proj', aksi: 'daftar' });
  await tunggu(() => kabarJ(hpR, 'pratinjau').length);
  cek('HP Rencana: bisaMulai false', kabarJ(hpR, 'pratinjau').pop().pratinjau.daftar[0].bisaMulai === false);

  // 2. mulai: K_rencana ditolak amplop; HP Rencana (K_kerjakan) ditolak; HP Kerjakan + K_kerjakan → menyala
  idP = kirim(hpK, { proyek: 'proj', aksi: 'mulai' }, 'rencana');
  await tunggu(() => tt(hpK, idP));
  cek('mulai bertanda K_rencana → kerjakan_tanpa_k_kerjakan', tt(hpK, idP).tanda_terima.alasan === 'kerjakan_tanpa_k_kerjakan', tt(hpK, idP));
  idP = kirim(hpR, { proyek: 'proj', aksi: 'mulai' }, 'kerjakan');
  await tunggu(() => tt(hpR, idP));
  cek('HP mode Rencana: mulai → aksi_tidak_diizinkan', tt(hpR, idP).tanda_terima.alasan === 'aksi_tidak_diizinkan', tt(hpR, idP));
  idP = kirim(hpK, { proyek: 'proj', aksi: 'mulai' }, 'kerjakan');
  await tunggu(() => tt(hpK, idP));
  cek('mulai K_kerjakan → selesai', tt(hpK, idP).tanda_terima.hasil === 'selesai', tt(hpK, idP));
  await tunggu(() => kabarJ(hpR, 'pratinjau').some(x => x.pratinjau.daftar[0].status === 'menyala'));
  const sR = kabarJ(hpR, 'pratinjau').filter(x => x.pratinjau.daftar[0].status === 'menyala').pop();
  cek('semua HP berlangganan menerima keadaan menyala + alamat tailnet', sR && sR.pratinjau.daftar[0].alamat === 'https://macbook.tail1234.ts.net:8443/', sR);

  // 3. potret → gambar hanya ke HP peminta
  idP = kirim(hpR, { proyek: 'proj', aksi: 'potret' });
  await tunggu(() => kabarJ(hpR, 'pratinjau_gambar').length >= 2 && tt(hpR, idP));
  const gb = kabarJ(hpR, 'pratinjau_gambar');
  cek('potret: 2 gambar (hp, desktop) sah di HP peminta', gb.map(x => x.pratinjau_gambar.ukuran).sort().join() === 'desktop,hp', gb.map(x => x.pratinjau_gambar && x.pratinjau_gambar.ukuran));
  cek('HP lain tidak menerima gambar permintaan HP Rencana', kabarJ(hpK, 'pratinjau_gambar').length === 0);

  // 4. henti (K_rencana cukup) → mati
  idP = kirim(hpR, { proyek: 'proj', aksi: 'henti' });
  await tunggu(() => tt(hpR, idP) && kabarJ(hpK, 'pratinjau').some(x => x.pratinjau.daftar[0].status === 'mati' && x.urut_mac > s0.urut_mac));
  cek('henti → selesai & keadaan mati ke semua HP', tt(hpR, idP).tanda_terima.hasil === 'selesai', tt(hpR, idP));
  cek('HP lama (tak berlangganan) tanpa kabar pratinjau', kabarJ(hpL, 'pratinjau').length === 0 && kabarJ(hpL, 'pratinjau_gambar').length === 0);
  cek('tidak ada kabar yang ditolak HP', Object.values(terbuka).flat().every(x => !x.galat), Object.values(terbuka).flat().filter(x => x.galat));

  jb.akhiri(); pv.akhiri(); srv.close();
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`HASIL: ${gagal ? 'GAGAL' : 'LULUS'} ${lulus}/${lulus + gagal}`);
  process.exit(gagal ? 1 : 0);
})().catch(e => { console.log('GAGAL pengecualian', e && e.stack); process.exit(1); });
