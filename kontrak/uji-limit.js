#!/usr/bin/env node
// Uji roadmap 3 — limit token lewat jembatan relay SUNGGUHAN (pelaksana-relay.js buatJembatan + pelaksana-limit.js, limit.json
// tiruan) ↔ relay tiruan ↔ HP tiruan: pilih akun otomatis, antrean saat limit habis (kabar tahap "antre", batal lewat hentikan,
// jalan sendiri saat akun pulih + notif), status (limit 5j/7h, antre, fitur), notifikasi ambang, HP lama tanpa `otomatis`.
// Pakai: node apk/kontrak/uji-limit.js
'use strict';
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const R = require('../../_app_padev_studio_3d/pelaksana-relay.js');
const L = require('../../_app_padev_studio_3d/pelaksana-limit.js');
const H = require('./hp-tiruan.js');

let lulus = 0, gagal = 0;
const cek = (nama, ok, info = '') => { if (ok) lulus++; else { gagal++; console.log(`GAGAL ${nama} ${String(typeof info === 'string' ? info : JSON.stringify(info)).slice(0, 500)}`); } };
const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'uji-lim-')));
const tunggu = async (f, ms = 15000) => { const t0 = Date.now(); while (!f()) { if (Date.now() - t0 > ms) return false; await new Promise(ok => setTimeout(ok, 50)); } return true; };
const JAM = 3600 * 1000;

(async () => {
  const proj = path.join(tmp, 'Documents', 'proj'); fs.mkdirSync(proj, { recursive: true });
  const { limit, hemat } = L.cekKonfig(undefined, undefined);
  const cfg = {
    akun: new Map([['a1', { id: 'a1', label: 'A1', folder: path.join(tmp, '.claude'), bawaan: true }],
      ['a2', { id: 'a2', label: 'A2', folder: path.join(tmp, '.claude-kerja') }]]),
    proyek: new Map([['proj', { id: 'proj', nama: 'Proj', path: proj, real: proj, akun: ['a1', 'a2'], hp: 'rencana', kerjakan: false, cermin: 'ringkas', dataPribadi: false }]]),
    jarakJauh: true, batasMenit: { rencana: 30, kerjakan: 60 }, maksSerentak: 2, limit, hemat,
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
  const hpA = H.buatHp('HP A'); hpA.perangkat_id = crypto.randomBytes(8).toString('hex');
  const hpB = H.buatHp('HP B'); hpB.perangkat_id = crypto.randomBytes(8).toString('hex');
  const entri = (hp, mode) => ({ perangkat_id: hp.perangkat_id, nama: hp.nama, k_rencana_id: R.idKunci(hp.k_rencana), k_kerjakan_id: R.idKunci(hp.k_kerjakan),
    k_rencana: hp.k_rencana, k_kerjakan: hp.k_kerjakan, e_hp: hp.e_hp, fcm: '', mode, urut: Date.now(), dipasang: Date.now() });
  R.tulisAman(path.join(folderJ, R.BERKAS.relay), JSON.stringify({ url: `http://127.0.0.1:${srv.address().port}/`, mac_id: macId }));
  R.tulisAman(path.join(folderJ, R.BERKAS.token), crypto.randomBytes(32).toString('hex'));
  R.tulisAman(path.join(folderJ, R.BERKAS.perangkat), JSON.stringify({ v: 1, perangkat: [entri(hpA, 'rencana'), entri(hpB, 'rencana')] }));
  const qr = { s_mac: km.publik.s_mac, e_mac: km.publik.e_mac, mac_id: macId };

  const tulisLimit = profil => fs.writeFileSync(path.join(folderJ, 'limit.json'), JSON.stringify({ v: 1, profil }), { mode: 0o600 });
  const kini = Date.now();
  tulisLimit({ '.claude': { limaJam: { persen: 97, reset: kini + JAM }, tujuhHari: { persen: 40, reset: kini + 50 * JAM }, waktu: kini },
    '.claude-kerja': { limaJam: { persen: 30, reset: kini + 3 * JAM }, tujuhHari: { persen: 20, reset: kini + 80 * JAM }, waktu: kini } });
  const lm = L.buatLimit({ folder: folderJ, cfg, log: () => {} });

  // pelaksana tiruan: jalankan → tugas berjalan (pagar laptop dianggap lolos)
  const tugas = new Map(), dijalankan = [];
  const jalankan = (o, asal) => { dijalankan.push({ ...o }); tugas.set(o.tugas, { tugas: o.tugas, proyek: o.proyek, akun: o.akun, mode: o.mode, asal, mulai: Date.now(), urut: 0 }); };
  const logJ = [];
  const jb = R.buatJembatan({ folder: folderJ, uji: true, cfg, log: t => logJ.push(t), tugas, hentikan: () => {}, hapusSesi: () => {}, versi: 'uji',
    polaTugas: /^t-[a-z0-9]{1,12}-[0-9a-f]{16}$/, jalankan, limit: lm });
  cek('jembatan mulai dengan limit', jb.mulai() === true && logJ.some(t => /limit siap/.test(t)), logJ.join('|'));

  const pen = Object.fromEntries([hpA, hpB].map(h => [h.perangkat_id, R.buatPenyimpanReplayMemori()]));
  const terbuka = Object.fromEntries([hpA, hpB].map(h => [h.perangkat_id, []]));
  const buka = () => {
    for (const k of sk.kabar.splice(0)) {
      const hp = [hpA, hpB].find(h => h.perangkat_id === k.perangkat_id);
      const x = H.bukaKabar(hp, qr, k.amplop, pen[hp.perangkat_id]);
      terbuka[hp.perangkat_id].push(x.ok ? x.isi : { galat: x.alasan });
    }
  };
  const kabarJ = (hp, jenis) => { buka(); return terbuka[hp.perangkat_id].filter(x => x.jenis === jenis); };
  const tt = (hp, idP) => { buka(); return terbuka[hp.perangkat_id].find(x => x.jenis === 'tanda_terima' && x.tanda_terima.perintah_id === idP); };
  const kabarTugas = (hp, idT) => kabarJ(hp, 'kabar').filter(x => x.kabar.tugas === idT).map(x => x.kabar);
  const penStatus = Object.fromEntries([hpA, hpB].map(h => [h.perangkat_id, R.buatPenyimpanReplayMemori()])), sudahBuka = new Map();
  const statusTerakhir = hp => {   // status lewat halo (tiap HP satu amplop per halo) — dibuka sekali, penyimpan replay terpisah
    const s = sk.halo.filter(x => x.perangkat_id === hp.perangkat_id).pop();
    if (!s) return null;
    if (!sudahBuka.has(s.amplop.id)) {
      const x = H.bukaKabar(hp, qr, s.amplop, penStatus[hp.perangkat_id]);
      sudahBuka.set(s.amplop.id, x.ok ? x.isi.status : { galat: x.alasan });
    }
    return sudahBuka.get(s.amplop.id);
  };
  const idTugas = () => 't-uji-' + crypto.randomBytes(8).toString('hex');
  const kirim = (hp, jenis, isi, kunci = 'rencana') => {
    const a = H.amplopPerintah(hp, qr, jenis, isi, { kunci });
    sk.kotak.push({ kode: crypto.randomBytes(16).toString('hex'), jenis_kotak: 'perintah', amplop: a });
    return a.id;
  };
  const jalan = (hp, t, tambahan) => kirim(hp, 'jalankan', { tugas: t, proyek: 'proj', akun: 'a1', mode: 'rencana', pesan: 'cek limit', baru: false, ...tambahan });

  // 1. otomatis: a1 97% (≥ 95) → a2, percakapan baru
  const t1 = idTugas();
  let idP = jalan(hpA, t1, { otomatis: true });
  await tunggu(() => tt(hpA, idP));
  cek('otomatis: diterima & dijalankan dengan akun a2 (sisa terbanyak), baru=true', tt(hpA, idP).tanda_terima.hasil === 'diterima'
    && dijalankan.length === 1 && dijalankan[0].akun === 'a2' && dijalankan[0].baru === true, { tt: tt(hpA, idP), dijalankan });
  cek('log: pergantian akun tercatat', logJ.some(t => /akun otomatis a1 → a2/.test(t)));
  tugas.clear();

  // 2. HP lama (tanpa `otomatis`) + akun di atas ambang → antrean sampai reset a1; tanda terima diterima + kabar tahap antre
  const t2 = idTugas();
  idP = jalan(hpA, t2);
  await tunggu(() => tt(hpA, idP) && kabarTugas(hpA, t2).length);
  const k2 = kabarTugas(hpA, t2)[0];
  cek('manual a1 97%: tidak dijalankan, tanda terima diterima', tt(hpA, idP).tanda_terima.hasil === 'diterima' && dijalankan.length === 1, tt(hpA, idP));
  cek('kabar tahap antre: urut 0, sampai = reset a1, alasan menyebut 5 jam', k2.tahap === 'antre' && k2.urut === 0 && k2.sampai === kini + JAM
    && /a1: 5 jam 97%/.test(k2.alasan), k2);
  cek('antreLimit jembatan berisi tugas', jb.antreLimit().length === 1 && jb.antreLimit()[0].tugas === t2);
  await tunggu(() => { const s = statusTerakhir(hpA); return s && Array.isArray(s.antre) && s.antre.length === 1; }, 8000);
  const st = statusTerakhir(hpA);
  cek('status: limit 5j/7h per akun, antre HP ini, fitur', st && st.limit && st.limit.length === 2 && st.limit.find(x => x.akun === 'a1').persen5j === 97
    && st.limit.find(x => x.akun === 'a2').persen7h === 20 && st.antre[0].tugas === t2 && st.antre[0].proyek === 'proj'
    && st.fitur.includes('akun_otomatis') && st.fitur.includes('antre_limit'), st);
  await tunggu(() => statusTerakhir(hpB) !== null, 8000);
  cek('status HP lain tanpa antrean HP A', (() => { const s = statusTerakhir(hpB); return !s || (Array.isArray(s.antre) && s.antre.length === 0); })());

  // 3. jalankan lagi dengan id yang sama → bukan tugas ganda
  idP = jalan(hpA, t2);
  await tunggu(() => tt(hpA, idP));
  cek('tugas yang sama dikirim ulang → tidak masuk antrean dua kali', jb.antreLimit().length === 1, jb.antreLimit());

  // 4. hentikan dari HP lain (bukan pemilik) → tidak membatalkan; dari HP A → dihentikan
  kirim(hpB, 'hentikan', { tugas: t2 });
  await new Promise(ok => setTimeout(ok, 800));
  cek('HP lain tidak bisa membatalkan antrean HP A', jb.antreLimit().length === 1);
  idP = kirim(hpA, 'hentikan', { tugas: t2 });
  await tunggu(() => kabarTugas(hpA, t2).some(k => k.tahap === 'dihentikan'));
  cek('hentikan → antrean kosong, kabar dihentikan oleh owner', jb.antreLimit().length === 0
    && kabarTugas(hpA, t2).find(k => k.tahap === 'dihentikan').oleh === 'owner', kabarTugas(hpA, t2));

  // 5. antre lagi → akun pulih → periksaLimit menjalankan + notif antre
  const t3 = idTugas();
  idP = jalan(hpA, t3);
  await tunggu(() => kabarTugas(hpA, t3).some(k => k.tahap === 'antre'));
  jb.periksaLimit();
  cek('belum pulih → tetap antre', jb.antreLimit().length === 1 && dijalankan.length === 1);
  tugas.set('t-lain-0000000000000000', { tugas: 't-lain-0000000000000000', proyek: 'proj', akun: 'a2', mode: 'rencana', asal: null, mulai: Date.now(), urut: 0 });
  tulisLimit({ '.claude': { limaJam: { persen: 10, reset: kini + 5 * JAM }, waktu: Date.now() }, '.claude-kerja': { limaJam: { persen: 30, reset: kini + 3 * JAM }, waktu: Date.now() } });
  jb.periksaLimit();
  cek('akun pulih tapi proyek sibuk → menunggu', jb.antreLimit().length === 1 && dijalankan.length === 1);
  tugas.clear();
  jb.periksaLimit();
  cek('akun pulih & proyek bebas → dijalankan dengan akun diminta', jb.antreLimit().length === 0 && dijalankan.length === 2 && dijalankan[1].tugas === t3
    && dijalankan[1].akun === 'a1' && dijalankan[1].baru === false, dijalankan);
  await tunggu(() => kabarJ(hpA, 'notif').some(x => x.notif.j === 'antre'));
  const nA = kabarJ(hpA, 'notif').find(x => x.notif.j === 'antre');
  cek('notif antre: proyek & akun', nA && nA.notif.proyekId === 'proj' && nA.notif.proyek === 'Proj' && nA.notif.akun === 'a1', nA);
  tugas.clear();

  // 6. notifikasi ambang limit (80/95%) → semua HP aktif, sekali per ambang per blok reset
  const nAwal = kabarJ(hpB, 'notif').filter(x => x.notif.j === 'limit');
  cek('notif limit sebelumnya: a1 97% (blok lama) melewati 95%', nAwal.length === 1 && nAwal[0].notif.ambang === 95 && nAwal[0].notif.persen === 97, nAwal);
  tulisLimit({ '.claude': { limaJam: { persen: 83, reset: kini + 5 * JAM }, waktu: Date.now() }, '.claude-kerja': { limaJam: { persen: 30, reset: kini + 3 * JAM }, waktu: Date.now() } });
  jb.periksaLimit();
  await tunggu(() => kabarJ(hpB, 'notif').filter(x => x.notif.j === 'limit').length > 1);
  const nL = kabarJ(hpB, 'notif').filter(x => x.notif.j === 'limit').slice(1);
  cek('notif limit: a1 5j melewati 80%', nL.length === 1 && nL[0].notif.akun === 'a1' && nL[0].notif.batas === '5j' && nL[0].notif.ambang === 80
    && nL[0].notif.persen === 83 && nL[0].notif.reset === kini + 5 * JAM, nL);
  jb.periksaLimit();
  await new Promise(ok => setTimeout(ok, 600));
  cek('notif ambang yang sama tidak diulang', kabarJ(hpB, 'notif').filter(x => x.notif.j === 'limit').length === 2);

  // 7. bentuk `otomatis` salah → ditolak; pelaksana berhenti → antrean gagal
  idP = jalan(hpA, idTugas(), { otomatis: 'ya' });
  await tunggu(() => tt(hpA, idP));
  cek('otomatis bukan boolean → ditolak', tt(hpA, idP).tanda_terima.hasil === 'ditolak', tt(hpA, idP));
  tulisLimit({ '.claude': { limaJam: { persen: 99, reset: kini + 2 * JAM }, waktu: Date.now() }, '.claude-kerja': { limaJam: { persen: 99, reset: kini + 4 * JAM }, waktu: Date.now() } });
  const t4 = idTugas();
  jalan(hpA, t4, { otomatis: true });
  await tunggu(() => kabarTugas(hpA, t4).some(k => k.tahap === 'antre'));
  const k4 = kabarTugas(hpA, t4).find(k => k.tahap === 'antre');
  cek('otomatis & semua akun habis → antre sampai reset terdekat, sebab kedua akun', k4 && k4.sampai === kini + 2 * JAM && /a1: 5 jam 99%/.test(k4.alasan)
    && /a2: 5 jam 99%/.test(k4.alasan), k4);
  jb.akhiri();
  await tunggu(() => kabarTugas(hpA, t4).some(k => k.tahap === 'gagal'), 3000);
  const kAntre = JSON.parse(fs.readFileSync(path.join(folderJ, R.BERKAS.antre), 'utf8')).antre;
  cek('pelaksana berhenti → kabar gagal tersimpan di antrean kirim', kabarTugas(hpA, t4).some(k => k.tahap === 'gagal' && /pelaksana berhenti/.test(k.alasan))
    || kAntre.some(x => x.perangkat_id === hpA.perangkat_id), kAntre.length);
  cek('tidak ada kabar yang ditolak HP', Object.values(terbuka).flat().every(x => !x.galat), Object.values(terbuka).flat().filter(x => x.galat));

  srv.close();
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`HASIL: ${gagal ? 'GAGAL' : 'LULUS'} ${lulus}/${lulus + gagal}`);
  process.exit(gagal ? 1 : 0);
})().catch(e => { console.log('GAGAL pengecualian', e && e.stack); process.exit(1); });
