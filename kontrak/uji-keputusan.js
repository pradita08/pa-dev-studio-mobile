#!/usr/bin/env node
// Uji APK v2 F1b — keputusan dari HP lewat jembatan relay SUNGGUHAN (pelaksana-relay.js buatJembatan + pelaksana-keputusan.js +
// pelaksana-cermin.js) ↔ relay tiruan (127.0.0.1, port acak) ↔ HP tiruan (hp-tiruan.js: verifikasi & dekripsi seperti Kotlin).
// Transkrip & profil SINTETIS di folder sementara. Pakai: node apk/kontrak/uji-keputusan.js
'use strict';
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const R = require('../../_app_padev_studio_3d/pelaksana-relay.js');
const C = require('../../_app_padev_studio_3d/pelaksana-cermin.js');
const K = require('../../_app_padev_studio_3d/pelaksana-keputusan.js');
const H = require('./hp-tiruan.js');

let lulus = 0, gagal = 0;
const cek = (nama, ok, info = '') => { if (ok) lulus++; else { gagal++; console.log(`GAGAL ${nama} ${String(typeof info === 'string' ? info : JSON.stringify(info)).slice(0, 400)}`); } };
const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'uji-kp-')));
const tunggu = async (f, ms = 15000) => { const t0 = Date.now(); while (!f()) { if (Date.now() - t0 > ms) return false; await new Promise(ok => setTimeout(ok, 50)); } return true; };

(async () => {
  // profil & proyek sintetis (aturan pemetaan sama dengan pelaksana-cermin.js: <profil>/projects/<folder>/<sesi>.jsonl)
  const proj = path.join(tmp, 'Documents', 'proj'), projR = path.join(tmp, 'Documents', 'projr');
  for (const p of [proj, projR]) fs.mkdirSync(p, { recursive: true });
  const profil = path.join(tmp, '.claude');
  const sesi = crypto.randomUUID();
  const dirT = path.join(profil, 'projects', proj.replace(/[^A-Za-z0-9]/g, '-'));
  fs.mkdirSync(dirT, { recursive: true });
  const transkrip = path.join(dirT, sesi + '.jsonl');
  fs.writeFileSync(transkrip, JSON.stringify({ cwd: proj, sessionId: sesi }) + '\n');
  const cfg = {
    akun: new Map([['a1', { id: 'a1', label: 'A1', folder: profil, bawaan: true }]]),
    proyek: new Map([
      ['proj', { id: 'proj', nama: 'Proj', path: proj, real: proj, akun: ['a1'], hp: 'kerjakan', kerjakan: true, cermin: 'isi', dataPribadi: false }],
      ['projr', { id: 'projr', nama: 'ProjR', path: projR, real: projR, akun: ['a1'], hp: 'rencana', kerjakan: false, cermin: 'ringkas', dataPribadi: false }],
    ]),
    cermin: { retensiJamRelay: 6 }, jarakJauh: true, batasMenit: { rencana: 30, kerjakan: 60 },
    keputusan: { nyala: true, tingkatMaks: 'izinkan', batasDtk: 20, tundaNotifDtk: 0, maksPerJam: 20, izinSelaluHari: 30, maksAturanProyek: 50, sinyalSesiPid: false, diamDtk: 60 },
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
  const entri = (hp, mode) => ({ perangkat_id: hp.perangkat_id, nama: hp.nama, k_rencana_id: R.idKunci(hp.k_rencana), k_kerjakan_id: R.idKunci(hp.k_kerjakan),
    k_rencana: hp.k_rencana, k_kerjakan: hp.k_kerjakan, e_hp: hp.e_hp, fcm: '', mode, urut: Date.now(), dipasang: Date.now() });
  R.tulisAman(path.join(folderJ, R.BERKAS.relay), JSON.stringify({ url: `http://127.0.0.1:${srv.address().port}/`, mac_id: macId }));
  R.tulisAman(path.join(folderJ, R.BERKAS.token), crypto.randomBytes(32).toString('hex'));
  R.tulisAman(path.join(folderJ, R.BERKAS.perangkat), JSON.stringify({ v: 1, perangkat: [entri(hpK, 'rencana+kerjakan'), entri(hpR, 'rencana')] }));
  const qr = { s_mac: km.publik.s_mac, e_mac: km.publik.e_mac, mac_id: macId };

  const cm = C.buatCermin({ cfg, folder: folderJ, rumah: tmp });
  const kp = K.buatKeputusan({ folder: folderJ, cfg, cermin: cm, log: () => {}, diamMac: async () => 9999, jedaPantau: 50 });
  const logJ = [];
  const jb = R.buatJembatan({ folder: folderJ, uji: true, cfg, log: t => logJ.push(t), tugas: new Map(), hentikan: () => {}, hapusSesi: () => {}, versi: 'uji',
    polaTugas: /^t-[a-z0-9]{1,12}-[0-9a-f]{16}$/, jalankan: () => {}, cermin: cm, keputusan: kp });
  cek('jembatan mulai dengan keputusan', jb.mulai() === true && logJ.some(t => /keputusan HP siap/.test(t)), logJ.join('|'));

  const pen = { [hpK.perangkat_id]: R.buatPenyimpanReplayMemori(), [hpR.perangkat_id]: R.buatPenyimpanReplayMemori() };
  const terbuka = { [hpK.perangkat_id]: [], [hpR.perangkat_id]: [] };
  const buka = () => {
    for (const k of sk.kabar.splice(0)) {
      const hp = k.perangkat_id === hpK.perangkat_id ? hpK : hpR;
      const x = H.bukaKabar(hp, qr, k.amplop, pen[hp.perangkat_id]);
      terbuka[hp.perangkat_id].push(x.ok ? { ...x.isi, _kd: k.amplop.kedaluwarsa } : { galat: x.alasan });
    }
  };
  const kabarKp = hp => { buka(); return terbuka[hp.perangkat_id].filter(x => x.jenis === 'keputusan'); };
  const tt = (hp, idP) => { buka(); return terbuka[hp.perangkat_id].find(x => x.jenis === 'tanda_terima' && x.tanda_terima.perintah_id === idP); };
  const kirim = (hp, isi, kunci = 'rencana') => {
    const a = H.amplopPerintah(hp, qr, 'keputusan_jawab', isi, { kunci });
    sk.kotak.push({ kode: crypto.randomBytes(16).toString('hex'), jenis_kotak: 'perintah', amplop: a });
    return a.id;
  };
  const minta = (cwd, tool_name, tool_input) => kp.olahMinta({ hook_event_name: 'PermissionRequest', session_id: sesi, cwd, transcript_path: transkrip,
    permission_mode: 'default', tool_name, tool_input });

  // 1. izin Bash → kabar keputusan ke kedua HP (boleh beda per mode HP), sah di HP
  let janji = minta(proj, 'Bash', { command: 'git push origin main', description: 'Push' });
  await tunggu(() => kabarKp(hpK).length && kabarKp(hpR).length);
  const kK = kabarKp(hpK).pop(), kR = kabarKp(hpR).pop();
  const bK = kK && kK.keputusan.daftar[0], bR = kR && kR.keputusan.daftar[0];
  cek('kabar keputusan sah di HP Kerjakan (tanda, dekripsi, skema)', bK && bK.alat === 'Bash' && /git push origin main/.test(bK.ringkas) && bK.sesi === sesi, kK);
  cek('HP Kerjakan: tolak+izinkan; HP Rencana: tolak', bK && JSON.stringify(bK.boleh) === '["tolak","izinkan"]' && bR && JSON.stringify(bR.boleh) === '["tolak"]', [bK && bK.boleh, bR && bR.boleh]);
  cek('kabar keputusan kedaluwarsa 20 mnt, tidak ada kabar ditolak HP', kK._kd - kK.dibuat === 20 * 60e3 && Object.values(terbuka).flat().every(x => !x.galat), kK._kd - kK.dibuat);
  await tunggu(() => sk.halo.length > 0);
  const st = sk.halo.map(x => H.bukaKabar(hpK, qr, x.amplop, R.buatPenyimpanReplayMemori())).filter(x => x.ok).pop();
  cek('status: keputusan_menunggu = 1', st && st.isi.status.keputusan_menunggu === 1, st && st.isi.status.keputusan_menunggu);
  // izinkan bertanda K_rencana → ditolak di periksaAmplop; HP Rencana → pilihan tidak diizinkan; HP Kerjakan + K_kerjakan → allow
  let idP = kirim(hpK, { keputusan: bK.id, pilih: 'izinkan' }, 'rencana');
  await new Promise(ok => setTimeout(ok, 1500));
  cek('izinkan bertanda K_rencana tidak menjawab permintaan', kp.jumlah() === 1);
  idP = kirim(hpR, { keputusan: bR.id, pilih: 'izinkan' }, 'kerjakan');
  await tunggu(() => tt(hpR, idP));
  cek('HP mode Rencana: izinkan → tanda terima ditolak pilihan_tidak_diizinkan', tt(hpR, idP) && tt(hpR, idP).tanda_terima.hasil === 'ditolak' && tt(hpR, idP).tanda_terima.alasan === 'pilihan_tidak_diizinkan', tt(hpR, idP));
  idP = kirim(hpK, { keputusan: bK.id, pilih: 'izinkan' }, 'kerjakan');
  const hasil = await janji;
  cek('HP Kerjakan + K_kerjakan: hook mendapat allow', hasil && hasil.behavior === 'allow', hasil);
  await tunggu(() => tt(hpK, idP));
  cek('tanda terima selesai', tt(hpK, idP) && tt(hpK, idP).tanda_terima.hasil === 'selesai', tt(hpK, idP));
  await tunggu(() => kabarKp(hpR).some(x => x.keputusan.selesai.some(s => s.id === bR.id)));
  const akhirR = kabarKp(hpR).pop();
  cek('snapshot sesudahnya: daftar kosong + selesai dijawab_hp (juga ke HP lain)', akhirR && akhirR.keputusan.daftar.length === 0
    && akhirR.keputusan.selesai.some(s => s.id === bR.id && s.alasan === 'dijawab_hp'), akhirR);

  // 2. pertanyaan → jawab dari HP Rencana (K_rencana cukup)
  janji = minta(proj, 'AskUserQuestion', { questions: [{ question: 'Lanjut deploy?', header: 'Deploy', multiSelect: false,
    options: [{ label: 'Ya', description: 'deploy sekarang' }, { label: 'Nanti', description: '' }] }] });
  await tunggu(() => kabarKp(hpR).some(x => x.keputusan.daftar.some(b => b.jenis === 'tanya')));
  const bT = kabarKp(hpR).pop().keputusan.daftar.find(b => b.jenis === 'tanya');
  cek('tanya: pertanyaan & pilihan sampai di HP', bT && bT.pertanyaan[0].teks === 'Lanjut deploy?' && bT.pertanyaan[0].pilihan.length === 2 && bT.boleh.includes('jawab'), bT);
  idP = kirim(hpR, { keputusan: bT.id, pilih: 'jawab', jawaban: [['Nanti']] });
  const hT = await janji;
  cek('hook: answers dari HP', hT && hT.behavior === 'allow' && hT.updatedInput.answers['Lanjut deploy?'] === 'Nanti', hT);

  // 3. tolak dengan pesan
  janji = minta(proj, 'Bash', { command: 'rm -rf storage' });
  await tunggu(() => kabarKp(hpK).some(x => x.keputusan.daftar.some(b => /rm -rf storage/.test(b.ringkas))));
  const bX = kabarKp(hpK).pop().keputusan.daftar.find(b => /rm -rf storage/.test(b.ringkas));
  idP = kirim(hpK, { keputusan: bX.id, pilih: 'tolak', pesan: 'jangan hapus storage' });
  const hX = await janji;
  cek('tolak: hook deny + pesan owner', hX && hX.behavior === 'deny' && /jangan hapus storage/.test(hX.message), hX);
  // perintah rusak (jawaban pada tolak) → ditolak relay, tidak ada efek
  const idRusak = kirim(hpK, { keputusan: bX.id, pilih: 'tolak', jawaban: [['x']] });
  await tunggu(() => tt(hpK, idRusak), 5000);
  cek('perintah keputusan_jawab rusak → ditolak isi_bentuk', tt(hpK, idRusak) && tt(hpK, idRusak).tanda_terima.hasil === 'ditolak', tt(hpK, idRusak));

  // 4. proyek hp:rencana → izin alat hanya tolak di HP Kerjakan pun
  janji = minta(projR, 'Bash', { command: 'npm run build' });
  await tunggu(() => kabarKp(hpK).some(x => x.keputusan.daftar.some(b => b.proyek === 'projr')));
  const bP = kabarKp(hpK).pop().keputusan.daftar.find(b => b.proyek === 'projr');
  cek('proyek hp:rencana: HP Kerjakan pun hanya tolak', bP && JSON.stringify(bP.boleh) === '["tolak"]', bP);
  idP = kirim(hpK, { keputusan: bP.id, pilih: 'izinkan' }, 'kerjakan');
  await tunggu(() => tt(hpK, idP));
  cek('proyek hp:rencana: izinkan → ditolak', tt(hpK, idP) && tt(hpK, idP).tanda_terima.alasan === 'pilihan_tidak_diizinkan', tt(hpK, idP));
  kirim(hpK, { keputusan: bP.id, pilih: 'tolak' });
  cek('proyek hp:rencana: tolak → deny', (await janji || {}).behavior === 'deny');
  // cwd di luar proyek terdaftar → tidak diteruskan
  cek('cwd di luar proyek → tanpa keputusan', await minta(path.join(tmp, 'lain'), 'Bash', { command: 'ls' }) === null);

  jb.akhiri(); kp.akhiri(); srv.close();
  console.log(`HASIL: ${gagal ? 'GAGAL' : 'LULUS'} ${lulus}/${lulus + gagal}`);
  process.exit(gagal ? 1 : 0);
})().catch(e => { console.log('GAGAL pengecualian', e && e.stack); process.exit(1); });
