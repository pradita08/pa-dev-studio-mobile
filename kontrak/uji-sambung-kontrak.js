#!/usr/bin/env node
// Uji kontrak G5 (KONTRAK-apk-v2 §10.8): kelompok K & C dari vektor-sambung.json (Mac), R (perilaku Mac, jam tiruan) dan C06–C09 lewat
// jembatan relay SUNGGUHAN (pelaksana-relay.js + pelaksana-sambung.js + pelaksana-keputusan.js + pelaksana-cermin.js) ↔ relay tiruan ↔ HP tiruan.
// Transkrip & profil SINTETIS di folder sementara. Pakai: node kontrak/uji-sambung-kontrak.js
'use strict';
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const MAC = path.join(__dirname, '..', '..', '_app_padev_studio_3d');
const folderPel = fs.mkdtempSync(path.join(os.tmpdir(), 'uji-skk-pel-'));
process.argv.push('--folder', folderPel);   // pelaksana.js dimuat hanya untuk DAFTAR_PENJAGA_HP (satu sumber)
const { DAFTAR_PENJAGA_HP } = require(path.join(MAC, 'pelaksana.js'));
const R = require(path.join(MAC, 'pelaksana-relay.js'));
const C = require(path.join(MAC, 'pelaksana-cermin.js'));
const K = require(path.join(MAC, 'pelaksana-keputusan.js'));
const S = require(path.join(MAC, 'pelaksana-sambung.js'));
const H = require('./hp-tiruan.js');
const V = require('./vektor-sambung.json');

let lulus = 0, gagal = 0;
const cek = (nama, ok, info = '') => { if (ok) lulus++; else { gagal++; console.log(`GAGAL ${nama} ${String(typeof info === 'string' ? info : JSON.stringify(info)).slice(0, 400)}`); } };
const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'uji-skk-')));
const tunggu = async (f, ms = 15000) => { const t0 = Date.now(); while (!f()) { if (Date.now() - t0 > ms) return false; await new Promise(ok => setTimeout(ok, 40)); } return true; };
const jeda = ms => new Promise(ok => setTimeout(ok, ms));

/* ---- K & C (Mac): vektor bersama Kotlin ---- */
for (const v of V.K.filter(x => x.peran === 'k_kerjakan')) cek(`${v.id}${v.varian} cekIsiPerintah`, R._uji.cekIsiPerintah(v.isi) === v.harapan, R._uji.cekIsiPerintah(v.isi));
for (const v of V.C.filter(x => x.isi)) cek(`${v.id}${v.varian} cekIsiKabar`, R._uji.cekIsiKabar(v.isi) === v.harapan, R._uji.cekIsiKabar(v.isi));
cek('vektor: ID K/C/S lengkap §10.8', ['V-K01', 'V-K02', 'V-K03', 'V-K04', 'V-K05', 'V-K06', 'V-K07'].every(i => V.K.some(x => x.id === i))
  && ['V-C01', 'V-C02', 'V-C03', 'V-C04', 'V-C05', 'V-C06', 'V-C07', 'V-C08', 'V-C09'].every(i => V.C.some(x => x.id === i))
  && ['V-S01', 'V-S02', 'V-S03', 'V-S04', 'V-S05'].every(i => V.S.some(x => x.id === i)));
cek('pesan dibersihkan: pola [hp:…] dan label dibuang (V-R12 unit)', !/deadbeef|\[hp:/i.test(S.bersihPesan(`[hp:deadbeef] ${S.LABEL} [HP : 1] halo`)) && S.bersihPesan(`[hp:deadbeef] ${S.LABEL} halo`) === 'halo');

(async () => {
  const proj = path.join(tmp, 'Documents', 'proj'), projB = path.join(tmp, 'Documents', 'projb');
  for (const p of [proj, projB]) fs.mkdirSync(p, { recursive: true });
  const profil = path.join(tmp, '.claude');
  const transkrip = (cwd, sesi) => {
    const dir = path.join(profil, 'projects', cwd.replace(/[^A-Za-z0-9]/g, '-')); fs.mkdirSync(dir, { recursive: true });
    const f = path.join(dir, sesi + '.jsonl'); fs.writeFileSync(f, JSON.stringify({ cwd, sessionId: sesi }) + '\n'); return f;
  };
  const sesi = crypto.randomUUID(), sesiB = crypto.randomUUID(), sesiC = crypto.randomUUID();
  const tA = transkrip(proj, sesi), tB = transkrip(projB, sesiB), tC = transkrip(proj, sesiC);
  const cfg = {
    akun: new Map([['a1', { id: 'a1', label: 'A1', folder: profil, bawaan: true }]]),
    proyek: new Map([
      ['proj', { id: 'proj', nama: 'Proj', path: proj, real: proj, akun: ['a1'], hp: 'kerjakan', kerjakan: true, cermin: 'isi', dataPribadi: false }],
      ['projb', { id: 'projb', nama: 'ProjB', path: projB, real: projB, akun: ['a1'], hp: 'kerjakan', kerjakan: true, cermin: 'ringkas', dataPribadi: false }],
    ]),
    cermin: { retensiJamRelay: 6 }, jarakJauh: true, batasMenit: { rencana: 30, kerjakan: 60 },
    keputusan: { nyala: true, tingkatMaks: 'izinkan_selalu', batasDtk: 300, tundaNotifDtk: 8, maksPerJam: 20, izinSelaluHari: 30, maksAturanProyek: 50, sinyalSesiPid: false, diamDtk: 60 },
    sambung: { ...S.BAWAAN, entrypoint: ['claude-vscode'] },
  };
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
      if (/^\/mac\/perangkat\/[0-9a-f]+\/cabut$/.test(u)) return jawab(204);
      return jawab(404, { ok: false });
    });
  });
  await new Promise(ok => srv.listen(0, '127.0.0.1', ok));
  const folderJ = path.join(tmp, 'pel'); fs.mkdirSync(folderJ, { mode: 0o700 });
  const km = R.buatKunciMac(); R.simpanKunciMac(folderJ, km);
  const macId = crypto.randomBytes(8).toString('hex');
  const hpX = H.buatHp('HP X'); hpX.perangkat_id = crypto.randomBytes(8).toString('hex');
  const hpY = H.buatHp('HP Y'); hpY.perangkat_id = crypto.randomBytes(8).toString('hex');
  const entri = hp => ({ perangkat_id: hp.perangkat_id, nama: hp.nama, k_rencana_id: R.idKunci(hp.k_rencana), k_kerjakan_id: R.idKunci(hp.k_kerjakan),
    k_rencana: hp.k_rencana, k_kerjakan: hp.k_kerjakan, e_hp: hp.e_hp, fcm: '', mode: 'rencana+kerjakan', urut: Date.now(), dipasang: Date.now() });
  R.tulisAman(path.join(folderJ, R.BERKAS.relay), JSON.stringify({ url: `http://127.0.0.1:${srv.address().port}/`, mac_id: macId }));
  R.tulisAman(path.join(folderJ, R.BERKAS.token), crypto.randomBytes(32).toString('hex'));
  R.tulisAman(path.join(folderJ, R.BERKAS.perangkat), JSON.stringify({ v: 1, perangkat: [entri(hpX), entri(hpY)] }));
  R.tulisAman(path.join(folderJ, S.BERKAS.daftar), JSON.stringify({ v: 1, proyek: ['proj', 'projb'], sejak: { proj: Date.now() - 8 * 86400000 } }));
  const qr = { s_mac: km.publik.s_mac, e_mac: km.publik.e_mac, mac_id: macId };

  let jam = Date.now();
  const cm = C.buatCermin({ cfg, folder: folderJ, rumah: tmp });
  const kp = K.buatKeputusan({ folder: folderJ, cfg, cermin: cm, log: () => {}, diamMac: async () => 1, jedaPantau: 50 });   // V-C09: Mac dipakai (diam 1 dtk)
  const sb = S.buatSambung({ folder: folderJ, cfg, log: () => {}, cermin: cm, keputusan: kp, daftar: DAFTAR_PENJAGA_HP, rumah: tmp, sekarang: () => jam, jedaPantau: 100000 });
  kp.aturSambung(sb);
  const jb = R.buatJembatan({ folder: folderJ, uji: true, cfg, log: () => {}, tugas: new Map(), hentikan: () => {}, hapusSesi: () => {}, versi: 'uji',
    polaTugas: /^t-[a-z0-9]{1,12}-[0-9a-f]{16}$/, jalankan: () => { throw new Error('jalur pelaksana biasa tidak boleh dipakai pesan sambung'); }, cermin: cm, keputusan: kp, sambung: sb });
  cek('jembatan mulai dengan sambung', jb.mulai() === true);
  sb.mulai(); kp.mulai();

  const pen = { [hpX.perangkat_id]: R.buatPenyimpanReplayMemori(), [hpY.perangkat_id]: R.buatPenyimpanReplayMemori() };
  const terbuka = { [hpX.perangkat_id]: [], [hpY.perangkat_id]: [] };
  const buka = () => {
    for (const k of sk.kabar.splice(0)) {
      const hp = k.perangkat_id === hpX.perangkat_id ? hpX : hpY;
      const x = H.bukaKabar(hp, qr, k.amplop, pen[hp.perangkat_id]);
      terbuka[hp.perangkat_id].push(x.ok ? x.isi : { galat: x.alasan });
    }
  };
  const tt = (hp, id) => { buka(); return terbuka[hp.perangkat_id].find(x => x.jenis === 'tanda_terima' && x.tanda_terima.perintah_id === id); };
  const kabarTugas = (hp, tugas) => { buka(); return terbuka[hp.perangkat_id].filter(x => x.jenis === 'kabar' && x.kabar.tugas === tugas).map(x => x.kabar); };
  const kabarKp = hp => { buka(); return terbuka[hp.perangkat_id].filter(x => x.jenis === 'keputusan').map(x => x.keputusan); };
  let n = 0;
  const tugasBaru = () => `t-skk${n++}-${crypto.randomBytes(8).toString('hex')}`;
  const kirim = (hp, tambah, kunci = 'kerjakan') => {
    const isi = { tugas: tugasBaru(), proyek: 'proj', akun: 'a1', mode: 'kerjakan', baru: false, sambung: true, sesi, pesan: 'halo dari HP', ...tambah };
    const a = H.amplopPerintah(hp, qr, 'jalankan', isi, { kunci });
    sk.kotak.push({ kode: crypto.randomBytes(16).toString('hex'), jenis_kotak: 'perintah', amplop: a });
    return { id: a.id, tugas: isi.tugas };
  };
  const hasilTT = async (hp, id) => { await tunggu(() => tt(hp, id)); const x = tt(hp, id); return x && x.tanda_terima; };
  const stop = (id, t, tambah = {}) => ({ hook_event_name: 'Stop', session_id: id, cwd: id === sesiB ? projB : proj, transcript_path: t,
    permission_mode: 'auto', stop_hook_active: false, last_assistant_message: '', background_tasks: [], session_crons: [], ...tambah });
  let blok = 0;
  const olahStop = (id, t, tambah, meta = { entrypoint: 'claude-vscode' }) => {
    let hasil = null; const p = sb.olahStop(stop(id, t, tambah), meta).then(r => { hasil = r; if (r.aksi === 'block') blok++; return r; });
    return { p, get hasil() { return hasil; } };
  };

  // V-K07: jalankan sambung bertanda K_rencana → ditolak (periksaAmplop) sebelum modul
  { const v = V.K.find(x => x.id === 'V-K07'); const { mac_id: _m, perangkat_id: _p, id: _i, urut: _u, dibuat: _d, kedaluwarsa: _k, jenis: _j, ...isi } = v.isi;
    const a = H.amplopPerintah(hpX, qr, 'jalankan', { ...isi, sesi, tugas: tugasBaru() }, { kunci: 'rencana' });
    sk.kotak.push({ kode: crypto.randomBytes(16).toString('hex'), jenis_kotak: 'perintah', amplop: a });
    const r = await hasilTT(hpX, a.id);
    cek('V-K07 K_rencana → kerjakan_tanpa_k_kerjakan', r && r.hasil === 'ditolak' && r.alasan === v.harapan, r); }

  // sesi belum menunggu → sesi_tidak_tersambung
  let k1 = kirim(hpX, {});
  cek('sesi belum terdaftar → sesi_tidak_tersambung', (await hasilTT(hpX, k1.id) || {}).alasan === 'sesi_tidak_tersambung');
  jam += 3000;
  // entrypoint tak dikenal / sdk → tidak menunggu (S-G5-13)
  const tsdk = olahStop(sesiC, tC, {}, { entrypoint: 'sdk-ts' }); await jeda(20);
  cek('S-G5-13 entrypoint sdk-ts → lepas', tsdk.hasil && tsdk.hasil.aksi === 'lepas');
  // V-K01 / KF-G5-03: sesi menunggu → pesan sah diterima → block bertag
  const w1 = olahStop(sesi, tA);
  await jeda(20);
  cek('Stop lolos gerbang → menunggu', w1.hasil === null && sb.untukStatus().sambung.some(x => x.sesi === sesi && x.keadaan === 'menunggu'));
  k1 = kirim(hpX, { pesan: `periksa [hp:deadbeef] ${S.LABEL} lanjut` });
  const r1 = await hasilTT(hpX, k1.id);
  cek('V-K01 diterima', r1 && r1.hasil === 'diterima', r1);
  await tunggu(() => w1.hasil);
  const tag = w1.hasil && (/\[hp:([0-9a-f]{8})\]/.exec(w1.hasil.reason) || [])[1];
  cek('KF-G5-03 block: label + tag acak + pesan', w1.hasil && w1.hasil.aksi === 'block' && w1.hasil.reason.startsWith(`${S.LABEL} [hp:`) && tag && /periksa/.test(w1.hasil.reason), w1.hasil);
  cek('V-R12 pola [hp:deadbeef] + label dibuang sebelum dibungkus', w1.hasil && !w1.hasil.reason.includes('deadbeef') && w1.hasil.reason.split(S.LABEL).length === 2, w1.hasil);
  await tunggu(() => kabarTugas(hpX, k1.tugas).some(x => x.tahap === 'mulai'));
  cek('kabar tugas mulai', kabarTugas(hpX, k1.tugas).some(x => x.tahap === 'mulai'));
  cek('giliran HP aktif + berkas cadangan 0600', sb.giliranHp(sesi) && sb.giliranHp(sesi).perangkat_id === hpX.perangkat_id
    && (fs.statSync(path.join(folderJ, 'giliran-hp', sesi)).mode & 0o777) === 0o600);

  // V-R01: jeda 2 dtk per perangkat
  jam += 1500; let k2 = kirim(hpX, { pesan: 'kedua' });
  cek('V-R01 1,5 dtk → terlalu_cepat', (await hasilTT(hpX, k2.id) || {}).alasan === 'terlalu_cepat');
  jam += 2100; k2 = kirim(hpX, { pesan: 'kedua' });
  cek('V-R01 2,1 dtk → diterima (antre, sesi bekerja)', (await hasilTT(hpX, k2.id) || {}).hasil === 'diterima');
  await tunggu(() => kabarTugas(hpX, k2.tugas).some(x => x.tahap === 'antre'));
  cek('kabar tugas antre', kabarTugas(hpX, k2.tugas).some(x => x.tahap === 'antre'));
  // V-R02 / V-R03 pengikatan
  jam += 2100; let k3 = kirim(hpX, { proyek: 'projb' });
  cek('V-R02 proyek beda → sesi_tidak_tersambung', (await hasilTT(hpX, k3.id) || {}).alasan === 'sesi_tidak_tersambung');
  jam += 2100; k3 = kirim(hpX, { akun: 'a2' });
  cek('V-R03 akun beda → sesi_tidak_tersambung', (await hasilTT(hpX, k3.id) || {}).alasan === 'sesi_tidak_tersambung');
  // §10.3 pesan_kosong: hanya tag/label → kosong setelah dibersihkan → ditolak (tidak antre)
  jam += 2100; k3 = kirim(hpX, { pesan: `[hp:deadbeef] ${S.LABEL}` });
  cek('§10.3 pesan hanya tag/label → pesan_kosong', (await hasilTT(hpX, k3.id) || {}).alasan === 'pesan_kosong');

  // K-G5-1 + C06/C07/C09: kartu giliran HP
  const alatCurl = { command: 'curl -I https://contoh.id' };
  const pa = await sb.olahAlat({ hook_event_name: 'PreToolUse', session_id: sesi, cwd: proj, tool_name: 'Bash', tool_input: alatCurl });
  cek('penjaga: Bash curl → ask internet', pa.putusan === 'ask' && /internet/.test(pa.alasan), pa);
  const pd = await sb.olahAlat({ hook_event_name: 'PreToolUse', session_id: sesi, cwd: proj, tool_name: 'Read', tool_input: { file_path: path.join(projB, 'x') } });
  cek('penjaga: Read proyek lain → deny proyek_lain', pd.putusan === 'deny' && /proyek_lain/.test(pd.alasan), pd);
  const pl = await sb.olahAlat({ hook_event_name: 'PreToolUse', session_id: sesiC, cwd: proj, tool_name: 'Bash', tool_input: alatCurl });
  cek('V-P18 sesi bukan giliran HP → tanpa putusan', pl.putusan === null, pl);
  let janji = kp.olahMinta({ hook_event_name: 'PermissionRequest', session_id: sesi, cwd: proj, transcript_path: tA, permission_mode: 'auto', tool_name: 'Bash', tool_input: alatCurl });
  await tunggu(() => kabarKp(hpX).some(x => x.daftar.some(b => b.giliran_hp)));
  const bX = kabarKp(hpX).flatMap(x => x.daftar).find(b => b.giliran_hp);
  cek('V-C09 kartu terbit walau Mac dipakai + V-C01 bentuk', bX && bX.sebab === 'internet' && JSON.stringify(bX.boleh) === '["tolak","izinkan"]', bX);
  cek('V-C06 HP bukan asal tidak menerima butir', !kabarKp(hpY).some(x => x.daftar.some(b => b.giliran_hp)));
  let j1 = kirim(hpX, {}); void j1;
  const jw = (hp, isi, kunci = 'kerjakan') => { const a = H.amplopPerintah(hp, qr, 'keputusan_jawab', isi, { kunci }); sk.kotak.push({ kode: crypto.randomBytes(16).toString('hex'), jenis_kotak: 'perintah', amplop: a }); return a.id; };
  let idj = jw(hpX, { keputusan: bX.id, pilih: 'izinkan_selalu' });
  cek('V-C07 izinkan_selalu → pilihan_tidak_diizinkan', (await hasilTT(hpX, idj) || {}).alasan === 'pilihan_tidak_diizinkan');
  idj = jw(hpY, { keputusan: bX.id, pilih: 'izinkan' });
  cek('HP bukan asal menjawab → keputusan_tidak_ada', (await hasilTT(hpY, idj) || {}).alasan === 'keputusan_tidak_ada');
  idj = jw(hpX, { keputusan: bX.id, pilih: 'izinkan' });
  cek('izinkan (K_kerjakan) dari HP asal → allow', ((await janji) || {}).behavior === 'allow');
  // V-C08: kedaluwarsa → deny (batas dipersingkat)
  cfg.keputusan.batasDtk = 1;
  janji = kp.olahMinta({ hook_event_name: 'PermissionRequest', session_id: sesi, cwd: proj, transcript_path: tA, permission_mode: 'auto', tool_name: 'Bash', tool_input: { command: 'printenv' } });
  const h8 = await janji;
  cek('V-C08 tak dijawab → deny "5 menit"', h8 && h8.behavior === 'deny' && /5 menit/.test(h8.message), h8);
  await tunggu(() => kabarKp(hpX).some(x => x.selesai.some(s => s.alasan === 'kedaluwarsa')));
  cek('V-C08 selesai: kedaluwarsa', kabarKp(hpX).some(x => x.selesai.some(s => s.alasan === 'kedaluwarsa')));
  cfg.keputusan.batasDtk = 300;

  // KF-G5-04: Stop sesudah giliran HP → teks (disamarkan) + selesai; antrean berikutnya langsung diserahkan
  const w2 = olahStop(sesi, tA, { stop_hook_active: true, last_assistant_message: 'Beres. Kunci: sk-ant-api03-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' });
  await tunggu(() => kabarTugas(hpX, k1.tugas).some(x => x.tahap === 'selesai'));
  const sel = kabarTugas(hpX, k1.tugas).find(x => x.tahap === 'selesai');
  cek('KF-G5-04 selesai + teks disamarkan', sel && /Beres/.test(sel.teks) && !/AAAAAAAAAAAAAAAA/.test(sel.teks), sel);
  await tunggu(() => w2.hasil);
  cek('antrean (k2) diserahkan di Stop berikutnya', w2.hasil && w2.hasil.aksi === 'block' && /kedua/.test(w2.hasil.reason), w2.hasil);

  // V-R08: tag tidak terlihat di 2 Stop berturut → kirim ulang 1× lalu gagal tidak_terkirim
  const blokSebelum = blok;
  const w3 = olahStop(sesi, tA); await tunggu(() => w3.hasil);
  cek('V-R08 tag hilang → kirim ulang 1×', w3.hasil && w3.hasil.aksi === 'block' && /kedua/.test(w3.hasil.reason));
  const w4 = olahStop(sesi, tA); await jeda(30);
  await tunggu(() => kabarTugas(hpX, k2.tugas).some(x => x.tahap === 'gagal'));
  cek('V-R08 gagal tidak_terkirim, jumlah block = 2', kabarTugas(hpX, k2.tugas).some(x => x.tahap === 'gagal' && x.alasan === 'tidak_terkirim') && blok - blokSebelum === 1 && w4.hasil === null,
    { blok: blok - blokSebelum, k: kabarTugas(hpX, k2.tugas) });

  // V-R06: umur antrean 30 mnt (jam tiruan); sesi sedang menunggu → buat sesi bekerja dulu dengan satu pesan
  jam += 2100; const k6a = kirim(hpX, { pesan: 'enam-a' });
  await tunggu(() => w4.hasil);
  jam += 2100; const k6 = kirim(hpX, { pesan: 'enam' }); await hasilTT(hpX, k6.id);
  jam += 31 * 60000; sb.periksaUmur();
  await tunggu(() => kabarTugas(hpX, k6.tugas).some(x => x.tahap === 'gagal'));
  cek('V-R06 antre 31 mnt → gagal kedaluwarsa', kabarTugas(hpX, k6.tugas).some(x => x.tahap === 'gagal' && x.alasan === 'kedaluwarsa'), kabarTugas(hpX, k6.tugas));
  const w6 = olahStop(sesi, tA, { stop_hook_active: true, last_assistant_message: 'ok' }); await jeda(50);
  cek('V-R06 tidak ada block untuk pesan kedaluwarsa', w6.hasil === null);
  void k6a;

  // V-R07: 21 pesan antre → ke-21 antrean_penuh (sesi bekerja: buat giliran dulu)
  jam += 2100; kirim(hpX, { pesan: 'pemicu' }); await tunggu(() => w6.hasil);
  let ke21 = null;
  for (let i = 0; i < 21; i++) { jam += 2100; const k = kirim(hpX, { pesan: 'antre ' + i }); const r = await hasilTT(hpX, k.id); if (i === 20) ke21 = r; else if (!r || r.hasil !== 'diterima') { ke21 = { salah: i, r }; break; } }
  cek('V-R07 ke-21 antrean_penuh', ke21 && ke21.alasan === 'antrean_penuh', ke21);

  // V-R10: perangkat X dicabut → hanya antrean X dibuang (perangkat_dicabut); Y tetap
  const wB = olahStop(sesiB, tB); await jeda(20);
  jam += 2100; const ky = kirim(hpY, { pesan: 'dari Y', proyek: 'projb', sesi: sesiB });
  await hasilTT(hpY, ky.id); await tunggu(() => wB.hasil);
  jam += 2100; const ky2 = kirim(hpY, { pesan: 'dari Y 2', proyek: 'projb', sesi: sesiB }); await hasilTT(hpY, ky2.id);
  sb.cabut(hpX.perangkat_id, 'perangkat_dicabut');
  const st10 = sb.untukStatus().sambung;
  cek('V-R10 antrean X dibuang, Y tetap', st10.find(x => x.sesi === sesi).antre === 0 && st10.find(x => x.sesi === sesiB).antre === 1, st10);
  const pr10 = await sb.olahAlat({ session_id: sesi, cwd: proj, tool_name: 'Bash', tool_input: { command: 'ls' } });
  cek('V-R10 giliran asal X: semua alat deny perangkat_dicabut', pr10.putusan === 'deny' && /perangkat_dicabut/.test(pr10.alasan), pr10);
  const prY = await sb.olahAlat({ session_id: sesiB, cwd: projB, tool_name: 'Bash', tool_input: { command: 'ls' } });
  cek('V-R10 giliran Y tidak terpengaruh', prY.putusan === null, prY);

  // V-R04: sesi bypass
  const wBy = olahStop(sesiC, tC, { permission_mode: 'bypassPermissions' }); await jeda(20);
  cek('P2 bypass → lepas + keadaan bypass', wBy.hasil && wBy.hasil.aksi === 'lepas' && sb.untukStatus().sambung.some(x => x.sesi === sesiC && x.keadaan === 'bypass'));
  jam += 2100; const k4 = kirim(hpY, { sesi: sesiC });
  cek('V-R04 → mode_bypass', (await hasilTT(hpY, k4.id) || {}).alasan === 'mode_bypass');
  // KF-G5-10 kerja latar
  const wL = olahStop(sesiC, tC, { background_tasks: [{ id: 'x' }] }); await jeda(20);
  cek('KF-G5-10 latar → lepas + keadaan latar', wL.hasil && wL.hasil.aksi === 'lepas' && sb.untukStatus().sambung.some(x => x.sesi === sesiC && x.keadaan === 'latar'));

  // status ke HP: fitur, sambung, proyek[].sambung/sambungSejak
  sk.halo.length = 0; jb.statusSegera();
  await tunggu(() => sk.halo.some(x => x.perangkat_id === hpY.perangkat_id));
  const st = sk.halo.filter(x => x.perangkat_id === hpY.perangkat_id).map(x => H.bukaKabar(hpY, qr, x.amplop, R.buatPenyimpanReplayMemori())).filter(x => x.ok).pop();
  const s0 = st && st.isi.status;
  cek('status: fitur sambung_sesi + status.sambung ≤50 tanpa cwd', s0 && s0.fitur.includes('sambung_sesi') && Array.isArray(s0.sambung) && s0.sambung.every(x => !('cwd' in x) && ['menunggu', 'bekerja', 'mac', 'latar', 'bypass'].includes(x.keadaan)), s0 && s0.sambung);
  cek('status: proyek[].sambung + sambungSejak', s0 && s0.proyek.find(p => p.id === 'proj').sambung === true && s0.proyek.find(p => p.id === 'proj').sambungSejak > 0 && s0.proyek.find(p => p.id === 'projb').sambungSejak === undefined);

  // V-R05: proyek dimatikan saat pesan antre → gagal sambung_berakhir
  R.tulisAman(path.join(folderJ, S.BERKAS.daftar), JSON.stringify({ v: 1, proyek: ['proj'], sejak: {} }));
  sb.muatUlangDaftar();
  await tunggu(() => kabarTugas(hpY, ky2.tugas).some(x => x.tahap === 'gagal'));
  cek('V-R05 proyek dimatikan → gagal sambung_berakhir', kabarTugas(hpY, ky2.tugas).some(x => x.tahap === 'gagal' && x.alasan === 'sambung_berakhir'), kabarTugas(hpY, ky2.tugas));
  // S-G5-7 diubah dari luar → irisan (projb tidak kembali)
  fs.writeFileSync(path.join(folderJ, S.BERKAS.daftar), JSON.stringify({ v: 1, proyek: ['proj', 'projb'], sejak: {} }), { mode: 0o600 });
  const wX = olahStop(sesiB, tB); await jeda(20);
  cek('KF-G5-29 daftar diubah luar → projb tidak dipakai', wX.hasil && wX.hasil.aksi === 'lepas');
  cek('audit daftar_diubah_luar', fs.readFileSync(path.join(folderJ, S.BERKAS.audit), 'utf8').includes('daftar_diubah_luar'));

  // V-R09: darurat — antre + menunggu + giliran
  const wG = olahStop(sesi, tA); await jeda(20);   // giliran X (dicabut) berakhir → menunggu; giliran baru dari HP Y
  jam += 2100; const kg = kirim(hpY, { pesan: 'giliran Y' }); await hasilTT(hpY, kg.id); await tunggu(() => wG.hasil);
  const antreD = [];
  for (let i = 0; i < 2; i++) { jam += 2100; const k = kirim(hpY, { pesan: 'antre darurat ' + i }); await hasilTT(hpY, k.id); antreD.push(k); }
  const wD = olahStop(sesiC, tC); await jeda(20);   // sesiC kembali menunggu (bukan bypass)
  cek('V-R09 keadaan awal: 2 antre + 1 menunggu + 1 giliran', sb.untukStatus().sambung.find(x => x.sesi === sesi).antre === 2 && wD.hasil === null && sb.giliranHp(sesi));
  sb.cabut('semua', 'darurat');
  await jeda(20);
  cek('V-R09 penantian {lepas}', wD.hasil && wD.hasil.aksi === 'lepas');
  await tunggu(() => antreD.every(k => kabarTugas(hpY, k.tugas).some(x => x.tahap === 'gagal' && x.alasan === 'darurat')));
  cek('V-R09 antrean dibuang (gagal darurat)', antreD.every(k => kabarTugas(hpY, k.tugas).some(x => x.tahap === 'gagal' && x.alasan === 'darurat')));
  const pD = await sb.olahAlat({ session_id: sesi, cwd: proj, tool_name: 'Bash', tool_input: { command: 'ls' } });
  cek('V-R09 giliran berjalan → deny darurat sampai Stop', pD.putusan === 'deny' && /darurat/.test(pD.alasan), pD);
  cek('V-R09 audit darurat', fs.readFileSync(path.join(folderJ, S.BERKAS.audit), 'utf8').includes('"jenis":"darurat"'));
  const auditIsi = fs.readFileSync(path.join(folderJ, S.BERKAS.audit), 'utf8');
  cek('S-G5-15 audit tanpa isi pesan / path', !/halo dari HP|kedua|enam|Documents/.test(auditIsi));

  // V-R11: 50 Stop tanpa pesan HP → 0 block
  const b0 = blok;
  const w50 = [];
  for (let i = 0; i < 50; i++) w50.push(olahStop(sesiC, tC));
  await jeda(50);
  cek('V-R11 50 Stop tanpa pesan → 0 block', blok === b0 && w50.slice(0, 49).every(w => w.hasil && w.hasil.aksi === 'lepas'));

  sb.akhiri(); jb.akhiri(); kp.akhiri(); srv.close();
  fs.rmSync(tmp, { recursive: true, force: true }); fs.rmSync(folderPel, { recursive: true, force: true });
  console.log(`uji-sambung-kontrak: ${gagal ? 'GAGAL' : 'LULUS'} ${lulus}/${lulus + gagal}`);
  process.exit(gagal ? 1 : 0);
})().catch(e => { console.log('GAGAL pengecualian', e && e.stack); process.exit(1); });
