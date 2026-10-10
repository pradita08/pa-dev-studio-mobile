#!/usr/bin/env node
// Uji roadmap 2 — review hasil Kerjakan lewat jembatan relay SUNGGUHAN (pelaksana-relay.js buatJembatan + pelaksana-review.js,
// repo git sementara sungguhan) ↔ relay tiruan (127.0.0.1, port acak) ↔ HP tiruan (hp-tiruan.js: verifikasi & dekripsi seperti Kotlin).
// Pakai: node apk/kontrak/uji-review.js
'use strict';
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { execFileSync } = require('child_process');
const R = require('../../_app_padev_studio_3d/pelaksana-relay.js');
const V = require('../../_app_padev_studio_3d/pelaksana-review.js');
const H = require('./hp-tiruan.js');

let lulus = 0, gagal = 0;
const cek = (nama, ok, info = '') => { if (ok) lulus++; else { gagal++; console.log(`GAGAL ${nama} ${String(typeof info === 'string' ? info : JSON.stringify(info)).slice(0, 500)}`); } };
const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'uji-rv-')));
const tunggu = async (f, ms = 15000) => { const t0 = Date.now(); while (!f()) { if (Date.now() - t0 > ms) return false; await new Promise(ok => setTimeout(ok, 50)); } return true; };
const g = (cwd, ...a) => execFileSync('git', ['-c', 'core.hooksPath=/dev/null', ...a], { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });

(async () => {
  const proj = path.join(tmp, 'Documents', 'proj'); fs.mkdirSync(proj, { recursive: true });
  g(proj, 'init', '-q', '-b', 'main'); g(proj, 'config', 'user.name', 'Uji'); g(proj, 'config', 'user.email', 'uji@contoh.invalid');
  fs.writeFileSync(path.join(proj, 'a.php'), '<?php\necho "lama";\n'); g(proj, 'add', '-A'); g(proj, 'commit', '-q', '-m', 'awal');
  const cfg = {
    akun: new Map([['a1', { id: 'a1', label: 'A1', folder: path.join(tmp, '.claude'), bawaan: true }]]),
    proyek: new Map([['proj', { id: 'proj', nama: 'Proj', path: proj, real: proj, akun: ['a1'], hp: 'kerjakan', kerjakan: true, cermin: 'isi', dataPribadi: false }]]),
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
  const rv = V.buatReview({ folder: folderJ, cfg, log: () => {}, sibuk: id => [...tugas.values()].some(t => t.proyek === id), tingkatProyek: () => 'isi' });
  const logJ = [];
  const jb = R.buatJembatan({ folder: folderJ, uji: true, cfg, log: t => logJ.push(t), tugas, hentikan: () => {}, hapusSesi: () => {}, versi: 'uji',
    polaTugas: /^t-[a-z0-9]{1,12}-[0-9a-f]{16}$/, jalankan: () => {}, review: rv });
  cek('jembatan mulai dengan review', jb.mulai() === true && logJ.some(t => /review siap/.test(t)), logJ.join('|'));

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
  const kirim = (hp, jenis, isi, kunci = 'rencana') => {
    const a = H.amplopPerintah(hp, qr, jenis, isi, { kunci });
    sk.kotak.push({ kode: crypto.randomBytes(16).toString('hex'), jenis_kotak: 'perintah', amplop: a });
    return a.id;
  };

  // 1. tugas Kerjakan dari HP K → review dibuat; belum ada HP berlangganan → tidak ada kabar review sama sekali
  const t = { tugas: 't-uji-0000000000000001', proyek: 'proj', mode: 'kerjakan', asal: { perangkat_id: hpK.perangkat_id } };
  rv.mulaiTugas(t, cfg.proyek.get('proj'));
  fs.writeFileSync(path.join(proj, 'a.php'), '<?php\necho "baru";\n$token = "ghp_abcdefghijklmnopqrstuvwxyz0123456789";\n');
  fs.writeFileSync(path.join(proj, 'b.php'), '<?php\n');
  const idRv = rv.akhirTugas(t);
  await new Promise(ok => setTimeout(ok, 800));
  cek('review dibuat', !!idRv);
  cek('tanpa review_daftar: tidak ada kabar review ke HP mana pun (APK lama aman)', [hpK, hpR, hpL].every(h => kabarJ(h, 'review').length === 0));

  // 2. berlangganan → snapshot sah di HP; boleh sesuai mode HP
  let idP = kirim(hpK, 'review_daftar', {});
  await tunggu(() => kabarJ(hpK, 'review').length && tt(hpK, idP));
  const sK = kabarJ(hpK, 'review').pop();
  const bK = sK && sK.review.daftar[0];
  cek('kabar review sah di HP Kerjakan (tanda, dekripsi, skema ketat)', bK && bK.id === idRv && bK.berkas.length === 2 && bK.status === 'terbuka', sK);
  cek('HP Kerjakan: boleh commit+buang; isi diff tersedia; kedaluwarsa 24 jam', bK && bK.boleh.join() === 'commit,buang' && bK.isi === true && sK._kd - sK.dibuat === 24 * 3600e3, bK);
  cek('tanda terima review_daftar selesai', tt(hpK, idP).tanda_terima.hasil === 'selesai');
  idP = kirim(hpR, 'review_daftar', {});
  await tunggu(() => kabarJ(hpR, 'review').length);
  const bR = kabarJ(hpR, 'review').pop().review.daftar[0];
  cek('HP Rencana: review tampil tanpa aksi', bR && bR.id === idRv && bR.boleh.length === 0, bR);
  cek('kabar review tidak memuat path absolut', !JSON.stringify(sK).includes(tmp));

  // 3. isi diff (K_rencana cukup), token disamarkan
  idP = kirim(hpR, 'review_berkas', { review: idRv, jalur: 'a.php' });
  await tunggu(() => kabarJ(hpR, 'review_berkas').length);
  const dR = kabarJ(hpR, 'review_berkas').pop();
  cek('review_berkas: diff sampai, token disamarkan', dR && dR.review_berkas.teks.includes('+echo "baru";') && !dR.review_berkas.teks.includes('ghp_abc')
    && dR.review_berkas.disamarkan === true, dR);
  idP = kirim(hpR, 'review_berkas', { review: idRv, jalur: '../luar.txt' });
  await tunggu(() => tt(hpR, idP));
  cek('review_berkas berkas di luar review → ditolak', tt(hpR, idP).tanda_terima.hasil === 'ditolak' && tt(hpR, idP).tanda_terima.alasan === 'berkas_tidak_ada', tt(hpR, idP));

  // 4. aksi: K_rencana ditolak di amplop; HP Rencana ditolak; HP Kerjakan + K_kerjakan → commit
  idP = kirim(hpK, 'review_aksi', { review: idRv, aksi: 'commit', pesan: 'Dari HP' }, 'rencana');
  await tunggu(() => tt(hpK, idP));
  cek('commit bertanda K_rencana → ditolak kerjakan_tanpa_k_kerjakan', tt(hpK, idP) && tt(hpK, idP).tanda_terima.alasan === 'kerjakan_tanpa_k_kerjakan', tt(hpK, idP));
  idP = kirim(hpR, 'review_aksi', { review: idRv, aksi: 'commit', pesan: 'Dari HP' }, 'kerjakan');
  await tunggu(() => tt(hpR, idP));
  cek('HP mode Rencana: commit → ditolak', tt(hpR, idP) && tt(hpR, idP).tanda_terima.alasan === 'aksi_tidak_diizinkan', tt(hpR, idP));
  tugas.set('x', { proyek: 'proj' });
  idP = kirim(hpK, 'review_aksi', { review: idRv, aksi: 'commit', pesan: 'Dari HP' }, 'kerjakan');
  await tunggu(() => tt(hpK, idP));
  cek('proyek sedang bekerja → commit ditolak', tt(hpK, idP) && tt(hpK, idP).tanda_terima.alasan === 'proyek_sedang_bekerja', tt(hpK, idP));
  tugas.clear();
  const nSebelum = kabarJ(hpR, 'review').length;
  idP = kirim(hpK, 'review_aksi', { review: idRv, aksi: 'commit', pesan: 'Dari HP' }, 'kerjakan');
  await tunggu(() => tt(hpK, idP));
  cek('commit K_kerjakan → selesai; repo punya commit "Dari HP"', tt(hpK, idP) && tt(hpK, idP).tanda_terima.hasil === 'selesai' && g(proj, 'log', '-1', '--format=%s').trim() === 'Dari HP', tt(hpK, idP));
  await tunggu(() => kabarJ(hpR, 'review').length > nSebelum);
  const bR2 = kabarJ(hpR, 'review').pop().review.daftar[0];
  cek('snapshot baru ke HP berlangganan: status dikomit + sha', bR2 && bR2.status === 'dikomit' && /^[0-9a-f]{7,12}$/.test(bR2.commit), bR2);
  idP = kirim(hpK, 'review_aksi', { review: idRv, aksi: 'buang' }, 'kerjakan');
  await tunggu(() => tt(hpK, idP));
  cek('buang setelah commit → ditolak', tt(hpK, idP) && tt(hpK, idP).tanda_terima.alasan === 'aksi_tidak_diizinkan', tt(hpK, idP));
  cek('HP lama (tak berlangganan) tetap tanpa kabar review', kabarJ(hpL, 'review').length === 0 && kabarJ(hpL, 'review_berkas').length === 0);
  cek('tidak ada kabar yang ditolak HP', Object.values(terbuka).flat().every(x => !x.galat), Object.values(terbuka).flat().filter(x => x.galat));
  cek('langganan disimpan (review-hp.json 0600)', (fs.statSync(path.join(folderJ, 'review-hp.json')).mode & 0o777) === 0o600
    && JSON.parse(fs.readFileSync(path.join(folderJ, 'review-hp.json'), 'utf8')).hp.length === 2);

  jb.akhiri(); srv.close();
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`HASIL: ${gagal ? 'GAGAL' : 'LULUS'} ${lulus}/${lulus + gagal}`);
  process.exit(gagal ? 1 : 0);
})().catch(e => { console.log('GAGAL pengecualian', e && e.stack); process.exit(1); });
