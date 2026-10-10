#!/usr/bin/env node
// Uji APK v2 F1 — cermin sesi (pelaksana-cermin.js + jenis cermin_* di pelaksana-relay.js). KONTRAK-apk-v2 §2.1–2.5, K-01/02/04/05/08.
// Semua transkrip di sini SINTETIS (dibuat uji di folder sementara, profil tiruan ~/.claude & ~/.claude-akun2) — tidak pernah membaca
// transkrip nyata owner. Pakai: node apk/kontrak/uji-cermin.js   (tanpa jaringan luar; relay tiruan di 127.0.0.1 port acak)
'use strict';
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const R = require('../../_app_padev_studio_3d/pelaksana-relay.js');
const C = require('../../_app_padev_studio_3d/pelaksana-cermin.js');
const H = require('./hp-tiruan.js');

let lulus = 0, gagal = 0;
const cek = (nama, ok, info = '') => { if (ok) lulus++; else { gagal++; console.log(`GAGAL ${nama} ${String(info).slice(0, 400)}`); } };
const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'uji-cermin-')));
const S = C.SAMAR, BUANG = C.TEKS_DIBUANG;
const tidakMuat = (teks, ...kata) => kata.every(k => !teks.includes(k));

// ---------- 1. penyamaran (§2.5 "Penyamaran") ----------
const samar = [
  ['awalan sk-ant', 'kunci sk-ant-api03-AbCdEfGhIjKlMnOpQrStUv', 'sk-ant-api03'],
  ['awalan ghp_', 'token ghp_abcdefghijklmnopqrstuvwxyz0123', 'ghp_abc'],
  ['awalan github_pat_', 'github_pat_11ABCDEFG0123456789_abcdefghij', 'github_pat_11'],
  ['AWS AKIA', 'AKIAABCDEFGHIJKLMNOP dipakai', 'AKIAABCD'],
  ['Google AIza', 'AIzaSyA-abcdefghijklmnopqrstuvwxyz12345', 'AIzaSy'],
  ['Slack xoxb', 'xoxb-1234567890-abcdefghij', 'xoxb-1234'],
  ['Stripe sk_live', 'sk_live_abcdefghijklmnop', 'sk_live_'],
  ['PEM', 'isi -----BEGIN RSA PRIVATE KEY-----\nMIIEow\n-----END RSA PRIVATE KEY----- selesai', 'MIIEow'],
  ['PEM tanpa END', '-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXk', 'b3BlbnNz'],
  ['JWT', 'Bearer-less eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.c2lnbmF0dXJl', 'eyJhbGci'],
  ['password=', 'password=Rahasia#123 lalu', 'Rahasia#123'],
  ['DB_*=', 'DB_PASSWORD=sandiDB DB_USERNAME=root', 'sandiDB'],
  ['*_SECRET=', 'JWT_SECRET=abc123def', 'abc123def'],
  ['*_TOKEN=', 'GITHUB_TOKEN=ghx123', 'ghx123'],
  ['database.default.password', 'database.default.password = rahasiaku', 'rahasiaku'],
  ['JSON "api_key": ', '{"api_key": "kunci-rahasia-9"}', 'kunci-rahasia-9'],
  ['Authorization Bearer', 'curl -H "Authorization: Bearer abcd1234efgh5678"', 'abcd1234efgh5678'],
  ['URL user:sandi@', 'git clone https://bima:sandi99@github.com/x/y', 'sandi99'],
  ['--password flag', 'tool --password hunter22 --token=tt99', 'hunter22'],
  ['mysql -p', 'mysql -u root -pSandiMysql db', 'SandiMysql'],
  ['entropi tinggi base64 ≥32', 'kunci Zm9vYmFyYmF6cXV4MTIzNDU2Nzg5MGFiY2RlZmdoaQ== ok', 'Zm9vYmFy'],
  ['heksa 64', 'sha 9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08', '9f86d081'],
  ['NIK 16 digit', 'NIK 3201234567890123', '3201234567890123'],
  ['NIK berkelompok', 'NIK 320123 456789 0123', '320123 456789'],
  ['NIP 18 digit', 'NIP 198001012005011001', '198001012005011001'],
  ['NIP berkelompok', 'NIP 19800101 200501 1 001', '19800101 200501'],
  ['email', 'kirim ke budi.santoso@kemenkeu.go.id', 'budi.santoso'],
  ['HP 08…', 'telp 0812-3456-7890', '0812-3456'],
  ['HP +62…', 'wa +62 812 3456 7890', '812 3456'],
];
for (const [nama, masuk, bocor] of samar) {
  const r = C.samarkanRinci(masuk);
  cek(`samarkan ${nama}`, !r.teks.includes(bocor) && r.teks.includes(S) && r.disamarkan, r.teks);
}
for (const [nama, masuk] of [['.env', 'buka .env lalu ubah'], ['.env.production', 'cat .env.production'], ['*.pem', 'pakai server.pem'], ['*.key', 'baca privkey.key'],
  ['id_rsa', 'salin ~/.ssh/id_rsa'], ['.netrc', 'lihat .netrc'], ['.git-credentials', 'cat .git-credentials'], ['*.p12', 'sertifikat cert.p12']]) {
  const r = C.samarkanRinci('Baris satu aman.\n' + masuk + '\nbaris tiga sk-xxxx');
  cek(`berkas rahasia ${nama} → blok dibuang utuh`, r.teks === BUANG && r.dibuang, r.teks);
}
for (const [nama, masuk] of [['teks biasa', 'Perbaiki validasi form login di halaman pegawai'], ['versi', 'Claude Code 2.1.286 dan PHP 8.2'],
  ['waktu ms 13 digit', 'dibuat 1791000000000'], ['kebab panjang', 'pelaksana-relay-dan-cermin-untuk-hp-v2'], ['process.env.X', 'baca process.env.DB_HOST di kode']]) {
  cek(`samarkan tidak mengubah ${nama}`, C.samarkan(masuk) === masuk, C.samarkan(masuk));
}
cek('samarkan membuang bidi/lebar-nol/kendali', C.samarkan('a‮b​c\u0007d⁦e') === 'abcde');
cek('samarkan: surrogate tunggal → U+FFFD (JCS amplop tetap bisa)', C.samarkan('x\ud800y') === 'x�y');
cek('samarkan dataPribadi: angka ≥8 digit', C.samarkan('rekening 12345678', { dataPribadi: true }) === 'rekening ' + S && C.samarkan('rekening 12345678') === 'rekening 12345678');

// ---------- 2. ringkasAlat (§2.5 baris ringkasAlat, K-24) ----------
const proj = path.join(tmp, 'Documents', 'proj'), projB = path.join(tmp, 'Documents', 'projB'), projDp = path.join(tmp, 'Documents', 'projdp'),
  projMati = path.join(tmp, 'Documents', 'projmati'), luar = path.join(tmp, 'luar');
for (const d of [proj, projB, projDp, projMati, luar, path.join(proj, 'sub')]) fs.mkdirSync(d, { recursive: true });
const RA = (n, i, o = {}) => C.ringkasAlat(n, i, { cwd: proj, rumah: tmp, ...o });
let r = RA('Bash', { command: `cd ${proj}/sub && DB_PASSWORD=xx php spark test`, description: 'RAHASIA_DESKRIPSI', timeout: 5 });
cek('Bash: perintah disamarkan, path cwd jadi relatif, field lain dibuang', r.alat === 'Bash' && r.ringkas === `cd sub && DB_PASSWORD=${S} php spark test` && r.disamarkan && !JSON.stringify(r).includes('RAHASIA'), JSON.stringify(r));
r = RA('Bash', { command: 'echo ' + 'kata '.repeat(80) });
cek('Bash: ≤300 + terpotong', r.ringkas.length === 300 && r.terpotong && r.ringkas.endsWith('…'), r.ringkas.length);
r = RA('Bash', { command: `cat ${tmp}/catatan.txt` });
cek('Bash: home → ~ (nama pengguna tidak keluar)', r.ringkas === 'cat ~/catatan.txt' && !r.ringkas.includes(tmp), r.ringkas);
r = RA('Bash', { command: 'psql -U admin -c "select * from pegawai"' }, { dataPribadi: true });
cek('Bash dataPribadi: nama program saja', r.ringkas === 'psql', r.ringkas);
r = RA('Edit', { file_path: path.join(proj, 'app/Login.php'), old_string: 'RAHASIA_LAMA\nx', new_string: 'RAHASIA_BARU', replace_all: true });
cek('Edit: path relatif + jumlah baris, TANPA isi', r.ringkas === 'app/Login.php (+1 −2 baris)' && !JSON.stringify(r).includes('RAHASIA'), r.ringkas);
r = RA('Write', { file_path: path.join(proj, 'a.txt'), content: 'RAHASIA_ISI\n2\n3' });
cek('Write: path + baris, tanpa isi', r.ringkas === 'a.txt (3 baris)' && !JSON.stringify(r).includes('RAHASIA'), r.ringkas);
r = RA('MultiEdit', { file_path: path.join(proj, 'b.js'), edits: [{ old_string: 'RAHASIA', new_string: 'x\ny' }, { old_string: 'a', new_string: 'b' }] });
cek('MultiEdit: jumlah ubahan + baris, tanpa isi', r.ringkas === 'b.js (2 ubahan, +3 baris)' && !JSON.stringify(r).includes('RAHASIA'), r.ringkas);
r = RA('NotebookEdit', { notebook_path: path.join(proj, 'n.ipynb'), new_source: 'RAHASIA\nb', cell_id: 'c1' });
cek('NotebookEdit: path + baris, tanpa isi', r.ringkas === 'n.ipynb (sel, +2 baris)' && !JSON.stringify(r).includes('RAHASIA'), r.ringkas);
r = RA('Write', { file_path: path.join(proj, '.env'), content: 'A=1' });
cek('Write .env: dibuang utuh', r.ringkas === BUANG && r.disamarkan, r.ringkas);
r = RA('Read', { file_path: path.join(luar, 'rahasia.txt'), offset: 1 });
cek('Read di luar proyek: "…/nama" (path & cwd tidak keluar)', r.ringkas === '…/rahasia.txt', r.ringkas);
r = RA('Read', { file_path: path.join(proj, 'sub', 'x.md') });
cek('Read: path relatif', r.ringkas === 'sub/x.md', r.ringkas);
r = RA('Grep', { pattern: 'password=abc', path: path.join(proj, 'app'), glob: '*.php', output_mode: 'content' });
cek('Grep: pola disamarkan + path relatif', r.ringkas === `password=${S} (*.php) di app`, r.ringkas);
r = RA('Glob', { pattern: '**/*.js', path: proj });
cek('Glob: pola + path relatif', r.ringkas === '**/*.js di .', r.ringkas);
r = RA('WebFetch', { url: 'https://api.contoh.id/v1/data?token=RAHASIA_TOKEN', prompt: 'RAHASIA_PROMPT' });
cek('WebFetch: host saja', r.ringkas === 'api.contoh.id', r.ringkas);
r = RA('mcp__github__create_issue', { title: 'RAHASIA_JUDUL', body: 'x' });
cek('MCP: server + alat saja', r.ringkas === 'github · create_issue' && !JSON.stringify(r).includes('RAHASIA'), r.ringkas);
r = RA('AskUserQuestion', { questions: [{ question: 'Kirim ke budi@contoh.id?', header: 'Kirim', multiSelect: false,
  options: [{ label: 'Ya', description: 'pakai token=abc' }, { label: 'Tidak', description: 'batal' }] }] });
cek('AskUserQuestion: pertanyaan/header/label/deskripsi disamarkan', r.ringkas === `Kirim: Kirim ke ${S}? [Ya (pakai token=${S}) / Tidak (batal)]`, r.ringkas);
r = RA('ExitPlanMode', { plan: 'Langkah 1 NIK 3201234567890123\n' + 'p'.repeat(2000) });
cek('ExitPlanMode: rencana disamarkan ≤1500', r.ringkas.length === 1500 && r.terpotong && !r.ringkas.includes('3201234567890123'), r.ringkas.length);
r = RA('Agent', { subagent_type: 'divisi-qa', description: 'RAHASIA_TUGAS', prompt: 'RAHASIA_PROMPT' });
cek('Agent: jenis subagen saja', r.ringkas === 'divisi-qa', r.ringkas);
for (const n of ['WebSearch', 'Skill', 'TodoWrite', 'AlatBaruVersiDepan']) {
  r = RA(n, { query: 'RAHASIA_Q', skill: 'RAHASIA_S', todos: [{ content: 'RAHASIA_T' }], apa: 'RAHASIA_X' });
  cek(`alat ${n}: nama saja (field lain dibuang)`, r.alat === n && r.ringkas === '', JSON.stringify(r));
}
cek('nama alat tak sah → "alat"', RA('../x y', {}).alat === 'alat');

// ---------- 3. profil tiruan + transkrip sintetis ----------
const profil1 = path.join(tmp, '.claude'), profil2 = path.join(tmp, '.claude-akun2');
const folderP = (prof, cwd) => path.join(prof, 'projects', cwd.replace(/[^A-Za-z0-9]/g, '-'));
const cfg = {
  akun: new Map([['a1', { id: 'a1', label: 'A1', folder: profil1, bawaan: true }], ['a2', { id: 'a2', label: 'A2', folder: profil2, bawaan: false }]]),
  proyek: new Map([
    ['proj', { id: 'proj', nama: 'Proj', path: proj, real: proj, akun: ['a1', 'a2'], hp: 'rencana', kerjakan: false, cermin: 'isi', dataPribadi: false, grup: 'KOMINFO' }],
    ['projb', { id: 'projb', nama: 'ProjB', path: projB, real: projB, akun: ['a1'], hp: false, kerjakan: false, cermin: 'ringkas', dataPribadi: false }],
    ['projdp', { id: 'projdp', nama: 'DP', path: projDp, real: projDp, akun: ['a1'], hp: 'rencana', kerjakan: false, cermin: 'ringkas', dataPribadi: true }],
    ['projmati', { id: 'projmati', nama: 'Mati', path: projMati, real: projMati, akun: ['a1'], hp: 'rencana', kerjakan: false, cermin: false, dataPribadi: false }],
  ]),
  cermin: { retensiJamRelay: 6 },
};
const uuid = () => crypto.randomUUID();
const T = Date.now() - 3600e3;
let nBaris = 0;
const umum = (sesi, cwd, o = {}) => ({ parentUuid: null, isSidechain: false, userType: 'external', cwd, sessionId: sesi, version: '2.1.286',
  gitBranch: 'master', entrypoint: o.entrypoint || 'claude-vscode', uuid: uuid(), timestamp: new Date(T + (nBaris++) * 1000).toISOString() });
const owner = (sesi, cwd, teks, o) => ({ ...umum(sesi, cwd, o), type: 'user', message: { role: 'user', content: teks } });
const claude = (sesi, cwd, blok, o) => ({ ...umum(sesi, cwd, o), type: 'assistant', requestId: 'req_1',
  message: { id: 'msg_' + nBaris, model: 'claude-opus', role: 'assistant', content: blok, usage: { input_tokens: 1, output_tokens: 1 } } });
function tulisTranskrip(prof, cwd, sesi, baris, { mtime } = {}) {
  const d = folderP(prof, cwd); fs.mkdirSync(d, { recursive: true });
  const f = path.join(d, sesi + '.jsonl');
  fs.writeFileSync(f, baris.map(b => (typeof b === 'string' ? b : JSON.stringify(b))).join('\n') + '\n');
  if (mtime) fs.utimesSync(f, mtime / 1000, mtime / 1000);
  return f;
}
// transkrip "kaya": setiap kolom terlarang §2.5 membawa penanda RAHASIA_<kolom> yang tidak boleh keluar
const s1 = uuid();
const KOLOM = ['TOOLUSERESULT', 'TOOL_RESULT', 'ATTACHMENT', 'FILEHISTORY', 'BACKUP', 'SERVERCLASSIFIER', 'THINKING', 'WIREINGEST', 'TYPEBARU',
  'FIELDBARU', 'TULIS_ISI', 'EDIT_ISI', 'TAG_SISTEM', 'META', 'SIDECHAIN', 'REDACTED', 'GAMBAR', 'SYNTHETIC', 'SUMMARY', 'BASHINPUT'];
const barisKaya = [
  owner(s1, proj, 'Perbaiki form login, kunci sk-ant-api03-AbCdEfGhIjKlMnOpQrStUv ya'),
  { type: 'ai-title', sessionId: s1, aiTitle: `Login ${proj}/app/Login.php kirim ke budi@contoh.id` },
  claude(s1, proj, [{ type: 'thinking', thinking: 'RAHASIA_THINKING', signature: 'x' }, { type: 'redacted_thinking', data: 'RAHASIA_REDACTED' },
    { type: 'text', text: 'Saya cek dulu. NIK pegawai 3201234567890123.' },
    { type: 'tool_use', id: 'tu1', name: 'Write', input: { file_path: path.join(proj, 'app/Login.php'), content: 'RAHASIA_TULIS_ISI\nb' } },
    { type: 'tool_use', id: 'tu2', name: 'Edit', input: { file_path: path.join(proj, 'app/Form.php'), old_string: 'x', new_string: 'RAHASIA_EDIT_ISI' } }]),
  { ...owner(s1, proj, [{ type: 'tool_result', tool_use_id: 'tu1', content: 'RAHASIA_TOOL_RESULT' }]), toolUseResult: { stdout: 'RAHASIA_TOOLUSERESULT' } },
  { ...owner(s1, proj, [{ type: 'tool_result', tool_use_id: 'tu2', content: [{ type: 'text', text: 'RAHASIA_TOOL_RESULT' }] }]) },
  { type: 'attachment', attachment: { type: 'file', content: 'RAHASIA_ATTACHMENT' }, ...umum(s1, proj) },
  { type: 'file-history-snapshot', messageId: 'm', snapshot: { trackedFileBackups: { 'a.php': { backupFileName: 'RAHASIA_FILEHISTORY' } } }, isSnapshotUpdate: false },
  { type: 'backup', isi: 'RAHASIA_BACKUP' },
  { ...claude(s1, proj, [{ type: 'text', text: 'Langkah kedua.' }]), serverClassifierContext: 'RAHASIA_SERVERCLASSIFIER', wireIngestContext: 'RAHASIA_WIREINGEST' },
  { type: 'x-baru-versi-depan', ...umum(s1, proj), isi: 'RAHASIA_TYPEBARU' },
  { ...owner(s1, proj, 'Lanjut, abaikan .env ya'), fieldBaru: 'RAHASIA_FIELDBARU' },
  owner(s1, proj, [{ type: 'text', text: '<system-reminder>RAHASIA_TAG_SISTEM</system-reminder>' }, { type: 'image', source: { data: 'RAHASIA_GAMBAR' } }]),
  owner(s1, proj, '<bash-input>echo RAHASIA_BASHINPUT</bash-input>'),
  { ...owner(s1, proj, 'RAHASIA_META caveat'), isMeta: true },
  { ...claude(s1, proj, [{ type: 'text', text: 'RAHASIA_SIDECHAIN' }]), isSidechain: true },
  { ...claude(s1, proj, [{ type: 'text', text: 'RAHASIA_SYNTHETIC' }]), message: { id: 'syn', model: '<synthetic>', role: 'assistant', content: [{ type: 'text', text: 'RAHASIA_SYNTHETIC' }] } },
  { type: 'summary', summary: 'RAHASIA_SUMMARY', leafUuid: uuid() },
  '{"rusak tidak lengkap',
  claude(s1, path.join(proj, 'sub'), [{ type: 'text', text: 'Selesai di subfolder.' },
    { type: 'tool_use', id: 'tu3', name: 'Agent', input: { subagent_type: 'divisi-qa', description: 'cek', prompt: 'RAHASIA_PROMPT_AGEN' } },
    { type: 'tool_use', id: 'tu4', name: 'Bash', input: { command: 'mysql -u root -pSandiKu db', description: 'x' } }]),
  { type: 'system', subtype: 'compact_boundary', content: 'Conversation compacted', ...umum(s1, proj) },
];
const fKaya = tulisTranskrip(profil1, proj, s1, barisKaya);
const folderPel = path.join(tmp, 'pel'); fs.mkdirSync(folderPel, { mode: 0o700 });
const cm = C.buatCermin({ cfg, log: () => {}, folder: folderPel, rumah: tmp });

(async () => {
  // ---------- 4. riwayat: allow-list per kolom §2.5 "Transkrip" ----------
  let h = await cm.riwayat({ sesi: s1, proyek: 'proj', akun: 'a1', batas: 50 });
  const j = JSON.stringify(h);
  cek('riwayat isi: tanpa galat, versiParser', !h.galat && h.versiParser === C.VERSI_PARSER && h.entri.length > 0, j.slice(0, 300));
  for (const k of KOLOM) cek(`riwayat: kolom ${k} terbukti dibuang`, !j.includes('RAHASIA_' + k), k);
  cek('riwayat: prompt agen (Agent.input.prompt) dibuang', !j.includes('RAHASIA_PROMPT_AGEN'));
  const peran = h.entri.map(e => e.peran).join(',');
  cek('riwayat: urutan peran owner/claude/alat/divisi/sistem', peran === 'owner,claude,alat,alat,claude,owner,claude,divisi,alat,sistem', peran);
  cek('riwayat: kunci API di prompt owner disamarkan', h.entri[0].teks === `Perbaiki form login, kunci ${S} ya`, h.entri[0].teks);
  cek('riwayat: NIK di jawaban Claude disamarkan', h.entri[1].teks === `Saya cek dulu. NIK pegawai ${S}.`, h.entri[1].teks);
  cek('riwayat: prompt menyebut .env dibuang utuh', h.entri[5].teks === BUANG, h.entri[5].teks);
  cek('riwayat: Write/Edit hanya path+baris', h.entri[2].ringkas === 'app/Login.php (2 baris)' && h.entri[3].ringkas === 'app/Form.php (+1 −1 baris)', JSON.stringify(h.entri.slice(2, 4)));
  cek('riwayat: Agent → peran divisi', h.entri[7].divisi === 'divisi-qa' && h.entri[7].alat === 'Agent');
  cek('riwayat: Bash mysql -p disamarkan', h.entri[8].ringkas === `mysql -u root -p${S} db`, h.entri[8].ringkas);
  cek('riwayat: id = baris.blok, waktu ms', h.entri.every(e => /^\d+\.\d+$/.test(e.id) && Number.isSafeInteger(e.waktu) && e.waktu > 0));
  cek('riwayat: path/cwd/home tidak keluar', !j.includes(tmp) && !j.includes('/Documents/'), j.match(/\/[^"]*Documents[^"]*/));
  const kabarSah = (jenis, muatan) => R._uji.cekIsiKabar({ mac_id: 'a'.repeat(16), perangkat_id: 'b'.repeat(16), urut_mac: 1, dibuat: 1, jenis, [jenis]: muatan });
  cek('riwayat isi lolos pemeriksa kabar cermin_riwayat', kabarSah('cermin_riwayat', h) === null, kabarSah('cermin_riwayat', h));
  // tingkat ringkas: owner/claude tanpa teks (proyek tingkat ringkas lewat akun a2 = profil lain)
  cfg.proyek.get('proj').cermin = 'ringkas';
  h = await cm.riwayat({ sesi: s1, proyek: 'proj', akun: 'a1', batas: 50 });
  cek('tingkat ringkas: entri owner/claude tanpa teks, ringkasAlat tetap', h.entri.filter(e => e.peran === 'owner' || e.peran === 'claude').every(e => e.teks === undefined)
    && h.entri.some(e => e.ringkas === 'app/Login.php (2 baris)'), JSON.stringify(h.entri.slice(0, 2)));
  cfg.proyek.get('proj').cermin = 'isi';
  // HP tidak bisa menaikkan tingkat: field `tingkat` di q diabaikan
  cfg.proyek.get('proj').cermin = 'ringkas';
  h = await cm.riwayat({ sesi: s1, proyek: 'proj', akun: 'a1', batas: 50, tingkat: 'isi' });
  cek('HP tidak bisa menaikkan tingkat', h.entri.every(e => e.teks === undefined || e.peran === 'sistem'));
  cfg.proyek.get('proj').cermin = 'isi';
  // dataPribadi: isi diabaikan + Bash program saja
  const sDp = uuid();
  tulisTranskrip(profil1, projDp, sDp, [owner(sDp, projDp, 'Data NIK 3201234567890123'), claude(sDp, projDp, [{ type: 'text', text: 'ok' },
    { type: 'tool_use', id: 't', name: 'Bash', input: { command: 'mysql -e "select nama from pegawai where nik=320123"' } }])]);
  cfg.proyek.get('projdp').cermin = 'isi';   // walau dicentang isi
  h = await cm.riwayat({ sesi: sDp, proyek: 'projdp', akun: 'a1', batas: 10 });
  cek('dataPribadi: tetap ringkas (tanpa teks) + Bash nama program', h.entri[0].teks === undefined && h.entri[1].teks === undefined && h.entri[2].ringkas === 'mysql', JSON.stringify(h.entri));
  cfg.proyek.get('projdp').cermin = 'ringkas';
  // versi/format tak dikenal → galat, entri kosong (gagal-tertutup)
  const sV = uuid();
  tulisTranskrip(profil1, proj, sV, [owner(sV, proj, 'halo'), { ...claude(sV, proj, [{ type: 'text', text: 'RAHASIA_V3' }]), version: '3.0.0' }]);
  h = await cm.riwayat({ sesi: sV, proyek: 'proj', akun: 'a1', batas: 10 });
  cek('versi transkrip tak dikenal → format_tidak_dikenal, entri []', h.galat === 'format_tidak_dikenal' && h.entri.length === 0 && !JSON.stringify(h).includes('RAHASIA'), JSON.stringify(h));
  cek('galat riwayat lolos pemeriksa kabar', kabarSah('cermin_riwayat', h) === null);
  const sF = uuid();
  tulisTranskrip(profil1, proj, sF, [owner(sF, proj, 'halo'), { ...umum(sF, proj), type: 'assistant', message: { role: 'assistant', content: 42 } }]);
  h = await cm.riwayat({ sesi: sF, proyek: 'proj', akun: 'a1', batas: 10 });
  cek('message.content bentuk tak dikenal → format_tidak_dikenal', h.galat === 'format_tidak_dikenal' && h.entri.length === 0, JSON.stringify(h));
  const sM = uuid();
  tulisTranskrip(profil1, proj, sM, [{ ...umum(sM, proj), type: 'user', message: 'bukan objek' }]);
  h = await cm.riwayat({ sesi: sM, proyek: 'proj', akun: 'a1', batas: 10 });
  cek('message bukan objek → format_tidak_dikenal', h.galat === 'format_tidak_dikenal', JSON.stringify(h));
  // K-08 pemetaan
  const sLuar = uuid();
  tulisTranskrip(profil1, proj, sLuar, [owner(sLuar, proj, 'awal'), owner(sLuar, luar, 'RAHASIA_LUAR')]);
  h = await cm.riwayat({ sesi: sLuar, proyek: 'proj', akun: 'a1', batas: 10 });
  cek('K-08: cwd pindah ke luar proyek → sesi_bukan_milik_proyek', h.galat === 'sesi_bukan_milik_proyek' && h.entri.length === 0, JSON.stringify(h));
  cek('K-08: sesi proyek A diminta sebagai proyek B → ditolak', (await cm.petakanSesi({ sesi: s1, proyek: 'projb', akun: 'a1' })).galat === 'sesi_bukan_milik_proyek');
  cek('K-08: akun yang tidak terdaftar di proyek → ditolak', (await cm.petakanSesi({ sesi: s1, proyek: 'projb', akun: 'a2' })).galat === 'sesi_bukan_milik_proyek');
  cek('K-08: sesi dari profil lain (a2) tidak ditemukan di a1', (await cm.petakanSesi({ sesi: s1, proyek: 'proj', akun: 'a2' })).galat === 'sesi_tidak_ada');
  cek('K-08: id bukan UUID ("../x", ".jsonl") → ditolak', (await cm.petakanSesi({ sesi: '../' + s1, proyek: 'proj', akun: 'a1' })).galat === 'sesi_tidak_ada'
    && (await cm.petakanSesi({ sesi: s1 + '.jsonl', proyek: 'proj', akun: 'a1' })).galat === 'sesi_tidak_ada');
  cek('K-08: proyek cermin:false → cermin_mati', (await cm.petakanSesi({ sesi: s1, proyek: 'projmati', akun: 'a1' })).galat === 'cermin_mati');
  const pt = await cm.petakanSesi({ sesi: s1.toUpperCase(), proyek: 'proj', akun: 'a1' });
  cek('petakanSesi sah: akun/profil/proyek/cwd asli/transkrip diturunkan Mac', pt.akun === 'a1' && pt.profilDir === profil1 && pt.proyek === 'proj' && pt.cwd === proj
    && pt.transkrip === fKaya && pt.memuatClaudeMd === true, JSON.stringify({ ...pt, info: undefined }));
  const sRumah = uuid();
  tulisTranskrip(profil1, tmp, sRumah, [owner(sRumah, tmp, 'cwd rumah')]);
  cek('K-08: sesi ber-cwd rumah (di luar proyek) → ditolak', (await cm.petakanSesi({ sesi: sRumah, proyek: 'proj', akun: 'a1' })).galat === 'sesi_bukan_milik_proyek');
  // symlink transkrip keluar profil → tidak dibaca
  const sSym = uuid(), fLuar = path.join(luar, 'curian.jsonl');
  fs.writeFileSync(fLuar, JSON.stringify(owner(sSym, proj, 'RAHASIA_SYMLINK')) + '\n');
  fs.symlinkSync(fLuar, path.join(folderP(profil1, proj), sSym + '.jsonl'));
  h = await cm.riwayat({ sesi: sSym, proyek: 'proj', akun: 'a1', batas: 10 });
  cek('symlink transkrip ke luar profil → tidak dibaca', !!h.galat && !JSON.stringify(h).includes('RAHASIA'), JSON.stringify(h));
  // halaman (kursor) + anggaran ukuran
  const sP = uuid(), banyak = [];
  for (let i = 0; i < 120; i++) banyak.push(owner(sP, proj, 'pesan ke-' + i));
  tulisTranskrip(profil1, proj, sP, banyak);
  const hal1 = await cm.riwayat({ sesi: sP, proyek: 'proj', akun: 'a1', batas: 50 });
  const hal2 = await cm.riwayat({ sesi: sP, proyek: 'proj', akun: 'a1', batas: 50, sebelum: hal1.sebelum });
  const hal3 = await cm.riwayat({ sesi: sP, proyek: 'proj', akun: 'a1', batas: 50, sebelum: hal2.sebelum });
  cek('halaman 1: 50 terbaru, lagi, sebelum = id terlama', hal1.entri.length === 50 && hal1.lagi && hal1.entri[49].teks === 'pesan ke-119' && hal1.sebelum === hal1.entri[0].id, JSON.stringify([hal1.entri.length, hal1.sebelum]));
  cek('halaman 2: 50 berikutnya tanpa tumpang tindih', hal2.entri.length === 50 && hal2.entri[49].teks === 'pesan ke-69' && hal2.lagi);
  cek('halaman 3: sisa 20, lagi=false, tanpa sebelum', hal3.entri.length === 20 && hal3.entri[0].teks === 'pesan ke-0' && !hal3.lagi && hal3.sebelum === undefined);
  cek('kursor rusak → tidak_tersedia', (await cm.riwayat({ sesi: sP, proyek: 'proj', akun: 'a1', batas: 5, sebelum: '../1' })).galat === 'tidak_tersedia');
  const sB = uuid(), besar = [];
  for (let i = 0; i < 60; i++) besar.push(owner(sB, proj, `p${i} ` + 'é'.repeat(3990)));
  tulisTranskrip(profil1, proj, sB, besar);
  h = await cm.riwayat({ sesi: sB, proyek: 'proj', akun: 'a1', batas: 50 });
  const ukH = Buffer.byteLength(JSON.stringify(h));
  cek('anggaran ≤60 KB: entri besar dipangkas, lagi + sebelum', ukH <= 60 * 1024 - 1024 && h.lagi && h.entri.length < 50 && h.entri.every(e => e.teks.length <= 4000), ukH + ' ' + h.entri.length);

  // ---------- 5. daftarSesi (cermin_sesi) ----------
  const sCli = uuid(), sA2 = uuid(), sMati = uuid(), sB2 = uuid(), sLama = uuid(), sPel = uuid();
  tulisTranskrip(profil1, proj, sCli, [owner(sCli, proj, 'halo', { entrypoint: 'cli' })]);
  tulisTranskrip(profil2, path.join(proj, 'sub'), sA2, [owner(sA2, path.join(proj, 'sub'), 'dari akun 2', { entrypoint: 'sdk-ts' }),
    { type: 'ai-title', sessionId: sA2, aiTitle: 'Judul‮ aman' }]);
  tulisTranskrip(profil1, projMati, sMati, [owner(sMati, projMati, 'mati')]);
  tulisTranskrip(profil2, projB, sB2, [owner(sB2, projB, 'akun2 tidak terdaftar di projb')]);
  tulisTranskrip(profil1, proj, sLama, [owner(sLama, proj, 'lama')], { mtime: Date.now() - 5 * 24 * 3600e3 });
  tulisTranskrip(profil1, proj, sPel, [owner(sPel, proj, 'tugas pelaksana', { entrypoint: 'sdk-cli' })]);
  fs.writeFileSync(path.join(folderPel, 'sesi.json'), JSON.stringify({ 'proj|a1': { sessionId: sPel, diperbarui: Date.now() } }));
  let dft = await cm.daftarSesi({ sejakJam: 48 });
  const id = new Map(dft.sesi.map(b => [b.sesi, b]));
  cek('daftar: sesi proyek terdaftar (kedua profil) masuk', id.has(s1) && id.has(sCli) && id.has(sA2) && id.has(sDp) && id.get(sA2).akun === 'a2', [...id.keys()].length);
  cek('daftar: cermin:false, akun tak terdaftar, cwd luar/rumah → tidak masuk', !id.has(sMati) && !id.has(sB2) && !id.has(sLuar) && !id.has(sRumah));
  cek('daftar: di luar rentang 48 jam tidak masuk; sejakHari 30 masuk', !id.has(sLama) && (await cm.daftarSesi({ sejakHari: 30 })).sesi.some(b => b.sesi === sLama));
  cek('daftar: judul ai-title disamarkan, path → nama berkas, email hilang', id.get(s1).judul === `Login Login.php kirim ke ${S}`, id.get(s1).judul);
  cek('daftar: judul tanpa bidi', id.get(sA2).judul === 'Judul aman', id.get(sA2).judul);
  cek('daftar: dataPribadi → judul netral "Sesi D Bln HH.MM"', /^Sesi \d{1,2} (Jan|Feb|Mar|Apr|Mei|Jun|Jul|Agu|Sep|Okt|Nov|Des) \d\d\.\d\d$/.test(id.get(sDp).judul) && id.get(sDp).tingkat === 'ringkas', id.get(sDp).judul);
  cek('daftar: asal vscode/cli/lain/pelaksana', id.get(s1).asal === 'vscode' && id.get(sCli).asal === 'cli' && id.get(sA2).asal === 'lain' && id.get(sPel).asal === 'pelaksana',
    [s1, sCli, sA2, sPel].map(x => id.get(x).asal).join());
  cek('daftar: tingkat per proyek, bisaLanjut tidak untuk hp:false', id.get(s1).tingkat === 'isi' && id.get(sDp).tingkat === 'ringkas');
  cek('daftar: tanpa path/cwd/email', !JSON.stringify(dft).includes(tmp) && !JSON.stringify(dft).includes('@'));
  cek('daftar lolos pemeriksa kabar cermin_sesi', kabarSah('cermin_sesi', dft) === null, kabarSah('cermin_sesi', dft));
  cek('daftar: filter proyek', (await cm.daftarSesi({ sejakJam: 48, proyek: 'projdp' })).sesi.every(b => b.proyek === 'projdp'));
  cek('daftar: cari pada judul tampil', (await cm.daftarSesi({ sejakJam: 48, cari: 'judul AMAN' })).sesi.map(b => b.sesi).join() === sA2);
  cek('daftar: cari tidak mencocokkan judul asli proyek dataPribadi', (await cm.daftarSesi({ sejakJam: 48, cari: 'Data NIK' })).sesi.length === 0);

  // ---------- 6. status sesi: sessions/<pid>.json [internal] + hook ----------
  const dirS = path.join(profil1, 'sessions'); fs.mkdirSync(dirS, { recursive: true });
  const tulisPid = (pid, o) => fs.writeFileSync(path.join(dirS, pid + '.json'), JSON.stringify({ pid, cwd: proj, version: '2.1.286', entrypoint: 'claude-vscode', ...o }));
  const pidHidup = new Set([process.pid]);
  const cm2 = C.buatCermin({ cfg, folder: folderPel, rumah: tmp, pidHidup: p => pidHidup.has(p) });
  tulisPid(process.pid, { sessionId: s1, status: 'busy' });
  cek('statusProses: pid hidup + sessionId sama', JSON.stringify(cm2.statusProses(s1)) === JSON.stringify({ pid: process.pid, status: 'busy', waitingFor: null }));
  cek('status busy → bekerja; putuskanCara → tolak', cm2.statusSesi(s1) === 'bekerja' && cm2.putuskanCara(s1) === 'tolak');
  tulisPid(process.pid, { sessionId: s1, status: 'waiting', waitingFor: 'permission prompt' });
  cek('status waiting permission → menunggu_izin', cm2.statusSesi(s1) === 'menunggu_izin');
  tulisPid(process.pid, { sessionId: s1, status: 'idle' });
  cek('status idle (tab terbuka) → terbuka; cabang', cm2.statusSesi(s1) === 'terbuka' && cm2.putuskanCara(s1) === 'cabang');
  pidHidup.clear();
  cek('pid mati + transkrip baru berubah (<10 mnt) → tidak_pasti', cm2.statusSesi(s1) === 'tidak_pasti' && cm2.putuskanCara(s1) === 'cabang');
  fs.utimesSync(fKaya, (Date.now() - 20 * 60e3) / 1000, (Date.now() - 20 * 60e3) / 1000);
  cek('pid mati + transkrip diam ≥10 mnt → tertutup; sama hanya bila tanpa CLAUDE.md', cm2.statusSesi(s1) === 'tertutup' && cm2.putuskanCara(s1) === 'cabang'
    && cm2.putuskanCara(s1, { memuatClaudeMd: false }) === 'sama');
  fs.writeFileSync(path.join(dirS, '999.json'), '{"format":"baru"}');
  cek('berkas sessions format tak dikenal → tidak_pasti (bukan tertutup)', cm2.statusSesi(s1) === 'tidak_pasti' && cm2.statusProses(s1) === null);
  fs.unlinkSync(path.join(dirS, '999.json'));
  cek('statusProses id bukan UUID → null', cm2.statusProses('../x') === null);

  // ---------- 7. kejadian hook → ev cermin (K-01/K-08) ----------
  const tp = (prof, cwd, sesi) => path.join(folderP(prof, cwd), sesi + '.jsonl');
  const evB = (o = {}) => ({ ts: Date.now(), who: null, agentId: null, session: s1, kind: 'prompt', text: 'kunci sk-ant-api03-AbCdEfGhIjKlMnOpQrStUv',
    cwd: proj, transcript_path: tp(profil1, proj, s1), ...o });
  const cm3 = C.buatCermin({ cfg, folder: folderPel, rumah: tmp });
  cek('hook: transcript_path di luar profil → tidak dipetakan', cm3.terimaHook(evB({ transcript_path: path.join(luar, s1 + '.jsonl') })) === null);
  cek('hook: transcript_path nama berkas bukan <sesi>.jsonl → tidak dipetakan', cm3.terimaHook(evB({ transcript_path: tp(profil1, proj, uuid()) })) === null);
  const dirSym = path.join(profil1, 'projects', 'symkeluar'); fs.symlinkSync(luar, dirSym);
  cek('hook: transcript_path lewat symlink keluar profil → tidak dipetakan', cm3.terimaHook(evB({ transcript_path: path.join(dirSym, s1 + '.jsonl') })) === null);
  cek('hook: cwd di luar proyek terdaftar → tidak dipetakan', cm3.terimaHook(evB({ cwd: luar })) === null);
  cek('hook: proyek cermin:false → tidak dipetakan', cm3.terimaHook(evB({ cwd: projMati, transcript_path: tp(profil1, projMati, s1) })) === null);
  const m = cm3.terimaHook(evB());
  cek('hook sah: dipetakan ke proyek+akun', m && m.proyek === 'proj' && m.akun === 'a1', JSON.stringify(m));
  let e = cm3.kejadianUntukHp(evB());
  cek('ev isi: prompt disamarkan', e.text === `kunci ${S}` && e.kind === 'prompt' && e.sesi === s1, JSON.stringify(e));
  cfg.proyek.get('proj').cermin = 'ringkas';
  e = cm3.kejadianUntukHp(evB());
  cek('ev ringkas: prompt tanpa teks', e.text === undefined, JSON.stringify(e));
  e = cm3.kejadianUntukHp(evB({ kind: 'stop', teksAkhir: 'jawaban rahasia' }));
  cek('ev ringkas: stop tanpa teks', e.text === undefined);
  cfg.proyek.get('proj').cermin = 'isi';
  e = cm3.kejadianUntukHp(evB({ kind: 'stop', text: 'pendek', teksAkhir: 'Jawaban akhir NIP 198001012005011001' }));
  cek('ev isi: stop memakai teksAkhir disamarkan', e.text === `Jawaban akhir NIP ${S}`, e.text);
  e = cm3.kejadianUntukHp(evB({ kind: 'tool', tool: 'Bash', detail: `DB_PASSWORD=x ${tmp}/skrip.sh` }));
  cek('ev tool Bash: detail disamarkan + home → ~', e.detail === `DB_PASSWORD=${S} ~/skrip.sh`, e.detail);
  e = cm3.kejadianUntukHp(evB({ kind: 'tool', tool: 'WebFetch', detail: 'api.contoh.id/v1/rahasia' }));
  cek('ev tool WebFetch: host saja', e.detail === 'api.contoh.id', e.detail);
  e = cm3.kejadianUntukHp(evB({ kind: 'tool', tool: 'mcp__db__query', detail: 'select RAHASIA' }));
  cek('ev tool MCP: tanpa detail', e.detail === undefined && e.tool === 'mcp__db__query');
  e = cm3.kejadianUntukHp(evB({ kind: 'tool_fail', tool: 'Bash', text: 'error RAHASIA_ERR' }));
  cek('ev tool_fail: teks galat dibuang', !JSON.stringify(e).includes('RAHASIA'));
  e = cm3.kejadianUntukHp(evB({ kind: 'notify', type: 'permission_prompt', text: 'Claude butuh izin Bash RAHASIA' }));
  cek('ev notify: hanya jenis notifikasi', e.detail === 'permission_prompt' && e.text === undefined);
  e = cm3.kejadianUntukHp(evB({ kind: 'tool', tool: 'Agent', sub: 'divisi-qa', detail: 'tugas QA', agentId: 'abc123' }), { rinci: false });
  cek('ev daftar (rinci:false): tanpa detail/teks', e.detail === undefined && e.text === undefined && e.tool === 'Agent' && e.agentId === 'abc123', JSON.stringify(e));
  e = cm3.kejadianUntukHp(evB({ kind: 'apa_ini' }));
  cek('ev kind tak dikenal → null', e === null);
  cm3.terimaHook(evB({ kind: 'agent_start', who: 'divisi-qa', agentId: 'ag1' }));
  cm3.terimaHook(evB({ kind: 'notify', type: 'permission_prompt' }));
  cek('hook → status menunggu_izin + ringkasStatus', cm3.statusSesi(s1) === 'menunggu_izin' && cm3.ringkasStatus().sesiAktif === 1 && cm3.ringkasStatus().divisi.get('proj') === 1);
  // F2 tab Kantor: tim = daftar {peran, status, ke} saja (tanpa teks/alat/agentId), yang bekerja dapat slot dulu
  let tim = cm3.ringkasStatus().tim.get('proj');
  cek('ringkasStatus.tim: menunggu_izin + bentuk tetap', JSON.stringify(tim) === JSON.stringify([{ peran: 'divisi-qa', status: 'menunggu_izin', ke: 1 }]), JSON.stringify(tim));
  cek('ringkasStatus.utama: Kepala menunggu izin', cm3.ringkasStatus().utama.get('proj') === 'menunggu_izin');
  cm3.terimaHook(evB({ kind: 'tool_done', tool: 'Bash' }));
  cm3.terimaHook(evB({ kind: 'agent_stop', who: 'divisi-qa', agentId: 'ag1' }));
  cm3.terimaHook(evB({ kind: 'agent_start', who: 'divisi-qa', agentId: 'ag2' }));
  cm3.terimaHook(evB({ kind: 'agent_start', who: 'divisi-programmer', agentId: 'ag3', text: 'RAHASIA tugas' }));
  tim = cm3.ringkasStatus().tim.get('proj');
  cek('ringkasStatus.tim: QA baru di slot 1, QA selesai di slot 2 (diam), tanpa teks',
    JSON.stringify(tim) === JSON.stringify([{ peran: 'divisi-qa', status: 'bekerja', ke: 1 }, { peran: 'divisi-programmer', status: 'bekerja', ke: 1 },
      { peran: 'divisi-qa', status: 'diam', ke: 2 }]) && !JSON.stringify(tim).includes('RAHASIA'), JSON.stringify(tim));
  cm3.terimaHook(evB({ kind: 'agent_stop', who: 'divisi-qa', agentId: 'ag2' }));
  cm3.terimaHook(evB({ kind: 'agent_stop', who: 'divisi-programmer', agentId: 'ag3' }));
  cek('ringkasStatus.utama: Kepala bekerja setelah izin selesai', cm3.ringkasStatus().utama.get('proj') === 'bekerja');
  cm3.terimaHook(evB({ kind: 'stop' }));
  cek('hook stop → tidak bekerja', !['bekerja', 'menunggu_izin'].includes(cm3.statusSesi(s1)), cm3.statusSesi(s1));
  const evHp = cm3.kejadianUntukHp(evB({ kind: 'tool', tool: 'Bash', detail: 'ls' }));
  cek('ev lolos pemeriksa kabar cermin', kabarSah('cermin', { urut_cermin: 1, ev: [evHp] }) === null);

  // ---------- 8. modul (antarmuka pelaksana.js Bima): mulai/akhiri ----------
  cek('modul sebelum mulai: terimaHook diam', C.terimaHook(evB()) === null && C.statusProses(s1) === null);
  C.mulai({ folder: folderPel, uji: true, cfg, log: () => {} });
  let didengar = 0;
  C.dengar(() => { didengar++; });
  C.terimaHook(evB());
  cek('modul mulai: terimaHook memetakan + memanggil pendengar', didengar === 1);
  C.akhiri();
  cek('modul akhiri: diam lagi', C.terimaHook(evB()) === null && didengar === 1);

  // ---------- 9. jembatan relay: perintah cermin_* & kabar (relay tiruan) ----------
  const sk = { kotak: [], kabar: [], halo: [], kodeKabar: 201, aktif: null };
  const srv = http.createServer((req, res) => {
    let b = ''; req.on('data', c => { b += c; }); req.on('end', () => {
      const jawab = (st, o) => { res.writeHead(st, { 'Content-Type': 'application/json' }); res.end(o === undefined ? '' : JSON.stringify(o)); };
      let body = null; try { body = b ? JSON.parse(b) : null; } catch { body = null; }
      const u = req.url.split('?')[0];
      if (u === '/mac/halo') { if (body && Array.isArray(body.status)) sk.halo.push(...body.status); return jawab(200, { ok: true, data: { waktu: Date.now(), perangkat: [] } }); }
      if (u === '/mac/kotak') return jawab(200, { ok: true, data: { amplop: sk.kotak.splice(0, 20), jedaMs: 1000, ...(sk.aktif ? { perangkat_aktif: sk.aktif } : {}) } });
      if (u === '/mac/kotak/akui') return jawab(204);
      if (u === '/mac/kabar' && body && Array.isArray(body.kabar)) {
        if (sk.kodeKabar !== 201) return jawab(sk.kodeKabar, { ok: false, galat: { kode: 'batas', pesan: 'x' } });
        sk.kabar.push(...body.kabar); return jawab(201, { ok: true, data: {} });
      }
      return jawab(404, { ok: false });
    });
  });
  await new Promise(ok => srv.listen(0, '127.0.0.1', ok));
  const folderJ = path.join(tmp, 'j'); fs.mkdirSync(folderJ, { mode: 0o700 });
  const km = R.buatKunciMac(); R.simpanKunciMac(folderJ, km);
  const macId = crypto.randomBytes(8).toString('hex');
  const hp = H.buatHp('HP Cermin'); hp.perangkat_id = crypto.randomBytes(8).toString('hex');
  R.tulisAman(path.join(folderJ, R.BERKAS.relay), JSON.stringify({ url: `http://127.0.0.1:${srv.address().port}/`, mac_id: macId }));
  R.tulisAman(path.join(folderJ, R.BERKAS.token), crypto.randomBytes(32).toString('hex'));
  R.tulisAman(path.join(folderJ, R.BERKAS.perangkat), JSON.stringify({ v: 1, perangkat: [{ perangkat_id: hp.perangkat_id, nama: hp.nama,
    k_rencana_id: R.idKunci(hp.k_rencana), k_kerjakan_id: R.idKunci(hp.k_kerjakan), k_rencana: hp.k_rencana, k_kerjakan: hp.k_kerjakan, e_hp: hp.e_hp, fcm: '',
    mode: 'rencana', urut: Date.now(), dipasang: Date.now() }] }));
  const qr = { s_mac: km.publik.s_mac, e_mac: km.publik.e_mac, mac_id: macId };
  const cmJ = C.buatCermin({ cfg, folder: folderPel, rumah: tmp });
  const cfgJ = { ...cfg, jarakJauh: true, batasMenit: { rencana: 30, kerjakan: 60 },
    proyek: new Map([...cfg.proyek, ['projoff', { id: 'projoff', nama: 'Off', path: projMati, real: projMati, akun: ['a1'], hp: false, kerjakan: false, cermin: false, dataPribadi: false }]]) };
  const logJ = [];
  const jb = R.buatJembatan({ folder: folderJ, uji: true, cfg: cfgJ, log: t => logJ.push(t), tugas: new Map(), hentikan: () => {}, hapusSesi: () => {}, versi: 'uji',
    polaTugas: /^t-[a-z0-9]{1,12}-[0-9a-f]{16}$/, jalankan: () => {}, cermin: cmJ });
  const kirimP = (jenis, isi) => { const a = H.amplopPerintah(hp, qr, jenis, isi); sk.kotak.push({ kode: crypto.randomBytes(16).toString('hex'), jenis_kotak: 'perintah', amplop: a }); return a.id; };
  const tunggu = async (f, ms = 15000) => { const t0 = Date.now(); while (!f()) { if (Date.now() - t0 > ms) return false; await new Promise(ok => setTimeout(ok, 50)); } return true; };
  const pen = R.buatPenyimpanReplayMemori(), terbuka = [];
  const bukaBaru = () => { for (const k of sk.kabar.splice(0)) { const x = H.bukaKabar(hp, qr, k.amplop, pen); terbuka.push(x.ok ? { ...x.isi, _kd: k.amplop.kedaluwarsa } : { galat: x.alasan }); } return terbuka; };
  const tt = idP => bukaBaru().find(x => x.jenis === 'tanda_terima' && x.tanda_terima.perintah_id === idP);
  cek('jembatan mulai dengan cermin', jb.mulai() === true && logJ.some(t => /cermin sesi siap/.test(t)), logJ.join('|'));
  const idD = kirimP('cermin_daftar', { sejakJam: 48 });
  await tunggu(() => tt(idD));
  const kSesi = terbuka.find(x => x.jenis === 'cermin_sesi');
  cek('cermin_daftar → kabar cermin_sesi (sah di HP) + tanda_terima selesai', tt(idD).tanda_terima.hasil === 'selesai' && kSesi && kSesi.cermin_sesi.sesi.some(b => b.sesi === s1), JSON.stringify(tt(idD)));
  cek('kabar cermin_sesi kedaluwarsa 10 mnt (≤ 6 jam)', kSesi && kSesi._kd - kSesi.dibuat === 10 * 60e3, kSesi && kSesi._kd - kSesi.dibuat);
  cek('tidak ada kabar yang ditolak HP', terbuka.every(x => !x.galat), JSON.stringify(terbuka.filter(x => x.galat)));
  const idR = kirimP('cermin_riwayat', { sesi: s1, proyek: 'proj', akun: 'a1', batas: 20 });
  await tunggu(() => tt(idR));
  const kR = terbuka.find(x => x.jenis === 'cermin_riwayat');
  cek('cermin_riwayat → kabar riwayat (30 mnt) + selesai', tt(idR).tanda_terima.hasil === 'selesai' && kR && kR.cermin_riwayat.sesi === s1 && kR._kd - kR.dibuat === 30 * 60e3
    && !JSON.stringify(kR).includes('RAHASIA'), JSON.stringify(tt(idR)));
  const idRx = kirimP('cermin_riwayat', { sesi: s1, proyek: 'projb', akun: 'a1', batas: 5 });
  await tunggu(() => tt(idRx));
  cek('cermin_riwayat sesi proyek lain → kabar galat sesi_bukan_milik_proyek', terbuka.some(x => x.jenis === 'cermin_riwayat' && x.cermin_riwayat.galat === 'sesi_bukan_milik_proyek'));
  const idBx = kirimP('cermin_buka', { sesi: s1, proyek: 'projb', akun: 'a1' });
  await tunggu(() => tt(idBx));
  cek('cermin_buka sesi bukan milik proyek → ditolak', tt(idBx).tanda_terima.hasil === 'ditolak' && tt(idBx).tanda_terima.alasan === 'sesi_bukan_milik_proyek', JSON.stringify(tt(idBx)));
  const idBm = kirimP('cermin_buka', { sesi: s1, proyek: 'projmati', akun: 'a1' });
  await tunggu(() => tt(idBm));
  cek('cermin_buka proyek cermin:false → cermin_mati', tt(idBm).tanda_terima.alasan === 'cermin_mati', JSON.stringify(tt(idBm)));
  const idB = kirimP('cermin_buka', { sesi: s1, proyek: 'proj', akun: 'a1' });
  await tunggu(() => tt(idB));
  cek('cermin_buka sah → diterima', tt(idB).tanda_terima.hasil === 'diterima', JSON.stringify(tt(idB)));
  // kejadian hook langsung dialirkan (gabung ≥2 dtk, urut_cermin naik +1)
  const t0 = Date.now();
  for (const k of ['prompt', 'tool', 'tool_done']) cmJ.terimaHook(evB({ kind: k, tool: k === 'prompt' ? undefined : 'Bash', detail: 'ls -la' }));
  await tunggu(() => bukaBaru().some(x => x.jenis === 'cermin'));
  const kc1 = terbuka.filter(x => x.jenis === 'cermin');
  cek('cermin: 3 kejadian digabung dalam 1 kabar setelah ≥2 dtk', kc1.length === 1 && kc1[0].cermin.ev.length === 3 && Date.now() - t0 >= 1900, JSON.stringify(kc1.map(x => x.cermin.ev.length)));
  cek('cermin: teks prompt disamarkan (proyek isi)', kc1[0].cermin.ev[0].text === `kunci ${S}`, JSON.stringify(kc1[0].cermin.ev[0]));
  cmJ.terimaHook(evB({ kind: 'stop', teksAkhir: 'beres' }));
  await tunggu(() => bukaBaru().filter(x => x.jenis === 'cermin').length >= 2);
  const kc2 = terbuka.filter(x => x.jenis === 'cermin');
  cek('cermin: urut_cermin naik tepat +1', kc2.length === 2 && kc2[1].cermin.urut_cermin === kc2[0].cermin.urut_cermin + 1, JSON.stringify(kc2.map(x => x.cermin.urut_cermin)));
  cek('cermin: kedaluwarsa 10 mnt', kc2.every(x => x._kd - x.dibuat === 10 * 60e3));
  // sesi lain yang tidak dibuka (tanpa langganan daftar) → tidak dialirkan
  cmJ.terimaHook(evB({ session: sCli, transcript_path: tp(profil1, proj, sCli), kind: 'prompt' }));
  await new Promise(ok => setTimeout(ok, 2500));
  cek('sesi yang tidak dibuka → tidak dialirkan', !bukaBaru().filter(x => x.jenis === 'cermin').some(x => x.cermin.ev.some(v => v.sesi === sCli)));
  // langganan daftar (sesi:null) → semua sesi, tanpa detail/teks
  const idBd = kirimP('cermin_buka', { sesi: null });
  await tunggu(() => tt(idBd));
  cmJ.terimaHook(evB({ session: sCli, transcript_path: tp(profil1, proj, sCli), kind: 'prompt', text: 'teks rahasia daftar' }));
  await tunggu(() => bukaBaru().some(x => x.jenis === 'cermin' && x.cermin.ev.some(v => v.sesi === sCli)));
  const evD = terbuka.filter(x => x.jenis === 'cermin').flatMap(x => x.cermin.ev).find(v => v.sesi === sCli);
  cek('langganan daftar: sesi lain dialirkan tanpa teks', evD && evD.text === undefined && evD.kind === 'prompt', JSON.stringify(evD));
  // halo: status diperluas
  await tunggu(() => sk.halo.length > 0);
  const st = sk.halo.map(x => H.bukaKabar(hp, qr, x.amplop, R.buatPenyimpanReplayMemori())).find(x => x.ok);
  cek('status diperluas: sesiAktif, keputusan_menunggu, per proyek cermin/dataPribadi/divisi', st && Number.isSafeInteger(st.isi.status.sesiAktif) && st.isi.status.keputusan_menunggu === 0
    && st.isi.status.proyek.find(p => p.id === 'proj').cermin === 'isi' && st.isi.status.proyek.find(p => p.id === 'projdp').dataPribadi === true, JSON.stringify(st && st.isi.status));
  // §9.2: proyek hp:false ber-cermin ikut (id+nama+penanda, tanpa akun/batas); hp:false + cermin mati tidak dikirim
  const prB = st && st.isi.status.proyek.find(p => p.id === 'projb');
  cek('status: proyek hp:false ber-cermin dikirim hanya sebagai penanda', prB && prB.hp === false && prB.nama === 'ProjB' && prB.cermin === 'ringkas'
    && prB.akun === undefined && prB.batasMenit === undefined && prB.sibuk === undefined && Array.isArray(prB.divisi), JSON.stringify(prB));   // F2: divisi = daftar tim (DESAIN-apk §5)
  cek('status: hp:false + cermin mati tidak dikirim; hp rencana + cermin mati tetap (v1)', st && !st.isi.status.proyek.some(p => p.id === 'projoff')
    && st.isi.status.proyek.find(p => p.id === 'projmati').hp === 'rencana' && st.isi.status.proyek.find(p => p.id === 'projmati').cermin === false);
  cek('status: setiap entri lolos bentuk Kotlin (id+nama teks; hp ∈ {rencana,kerjakan,false}; yang bisa diperintah punya akun)', st && st.isi.status.proyek.every(p =>
    typeof p.id === 'string' && typeof p.nama === 'string' && ['rencana', 'kerjakan', false].includes(p.hp) && (p.hp === false || Array.isArray(p.akun))));
  cek('status: grup = label bagian tab Proyek (tanpa path); proyek tanpa grup → field tidak ada', st && st.isi.status.proyek.find(p => p.id === 'proj').grup === 'KOMINFO'
    && !('grup' in st.isi.status.proyek.find(p => p.id === 'projdp')) && !JSON.stringify(st.isi.status).includes(tmp));
  // F2b status.kantor: kejadian kantor 3D HP (office.html) — bentuk normalize() server.js TANPA isi, sesi di-hash, ≤40
  const nHalo = sk.halo.length;
  cmJ.terimaHook(evB({ kind: 'tool', tool: 'Edit', detail: '/Users/uji/rahasia-kantor.php', agentId: 'agK1', who: 'divisi-programmer' }));
  cmJ.terimaHook(evB({ kind: 'notify', type: 'permission_prompt', text: 'Claude perlu izin rahasia' }));
  await tunggu(() => sk.halo.length > nHalo, 15000);
  const stK = sk.halo.slice(nHalo).map(x => H.bukaKabar(hp, qr, x.amplop, R.buatPenyimpanReplayMemori())).filter(x => x.ok).pop();
  const kantor = stK && stK.isi.status.kantor;
  const tK = JSON.stringify(kantor || null);
  cek('status.kantor: halo segera setelah kejadian, daftar ≤40 berisi tool Edit divisi & notify permission_prompt', Array.isArray(kantor) && kantor.length <= 40
    && kantor.some(e => e.kind === 'tool' && e.tool === 'Edit' && e.who === 'divisi-programmer' && e.agentId === 'agK1')
    && kantor.some(e => e.kind === 'notify' && e.type === 'permission_prompt'), tK.slice(0, 400));
  cek('status.kantor: tanpa isi (detail/teks/path/cwd/transkrip) & sesi di-hash 16 heksa', Array.isArray(kantor) && !/rahasia|teks rahasia|\/Users\/|transcript|cwd/.test(tK)
    && kantor.every(e => /^[0-9a-f]{16}$/.test(e.session) && e.detail === undefined && e.text === undefined && !tK.includes(s1) && !tK.includes(sCli)
      && Object.keys(e).every(k => ['ts', 'session', 'kind', 'who', 'agentId', 'tool', 'sub', 'type', 'proyek'].includes(k))), tK.slice(0, 400));
  cek('status.kantor: tiap kejadian membawa id proyek (alur kerja per proyek di HP)', Array.isArray(kantor) && kantor.length > 0 && kantor.every(e => e.proyek === 'proj'), tK.slice(0, 300));
  const pr = stK && stK.isi.status.perangkat;
  cek('status.perangkat: HP terhubung (nama, mode, dipasang, ini) maks 2, tanpa id/kunci', Array.isArray(pr) && pr.length >= 1 && stK.isi.status.maksPerangkat === 2
    && pr.filter(e => e.ini === true).length === 1 && pr.every(e => typeof e.nama === 'string' && typeof e.dipasang === 'number' && e.perangkat_id === undefined
      && e.k_rencana === undefined && e.e_hp === undefined), JSON.stringify(pr));
  // cermin_tutup → berhenti
  const idT = kirimP('cermin_tutup', {});
  await tunggu(() => tt(idT));
  const nSebelum = terbuka.filter(x => x.jenis === 'cermin').length;
  cmJ.terimaHook(evB({ kind: 'prompt' }));
  await new Promise(ok => setTimeout(ok, 2500));
  cek('cermin_tutup → selesai, aliran berhenti', tt(idT).tanda_terima.hasil === 'selesai' && bukaBaru().filter(x => x.jenis === 'cermin').length === nSebelum);
  // K-04: perangkat tak di perangkat_aktif ≥ 2 mnt → langganan berhenti
  const idB2 = kirimP('cermin_buka', { sesi: s1, proyek: 'proj', akun: 'a1' });
  await tunggu(() => tt(idB2));
  sk.aktif = [];   // relay melaporkan: tidak ada perangkat aktif
  await new Promise(ok => setTimeout(ok, 1500));
  const jamAsli = Date.now;
  let nK04;
  try {
    Date.now = () => jamAsli() + 3 * 60e3;
    nK04 = terbuka.filter(x => x.jenis === 'cermin').length;
    cmJ.terimaHook(evB({ kind: 'prompt' }));
  } finally { Date.now = jamAsli; }
  await new Promise(ok => setTimeout(ok, 2500));
  cek('K-04: tidak di perangkat_aktif ≥2 mnt → tidak dialirkan', bukaBaru().filter(x => x.jenis === 'cermin').length === nK04);
  cek('perangkatAktif() mengikuti perangkat_aktif relay', jb.perangkatAktif().length === 0);
  sk.aktif = null;
  // laju 30/jam gabungan (sudah terpakai beberapa) → yang ke-31 batas_laju
  const ids = [];
  for (let i = 0; i < 30; i++) ids.push(kirimP('cermin_tutup', {}));
  await tunggu(() => ids.every(x => tt(x)), 30000);
  const tolakLaju = ids.map(tt).filter(x => x.tanda_terima.alasan === 'batas_laju').length;
  const dipakai = 9;   // perintah cermin_* sebelumnya di uji ini
  cek('laju: perintah cermin_* ke-31/jam → batas_laju', tolakLaju === dipakai, `${tolakLaju} ditolak`);
  // kirimKabar (§1) + prioritas: relay 429 → kabar cermin dibuang dulu, tanda terima tetap
  sk.aktif = [hp.perangkat_id];
  await tunggu(() => jb.perangkatAktif().length === 1);
  sk.kodeKabar = 429;
  cek('kirimKabar("aktif", cermin) mengantre', jb.kirimKabar('aktif', { jenis: 'cermin', cermin: { urut_cermin: 1, ev: [] } }, { prioritas: 'cermin' }) === 1);
  cek('kirimKabar menolak isi tak sah (field asing)', jb.kirimKabar(hp.perangkat_id, { jenis: 'cermin', cermin: { urut_cermin: 1, ev: [], x: 1 } }, { prioritas: 'cermin' }) === 0);
  await tunggu(() => logJ.some(t => /relay 429: \d+ kabar cermin dibuang/.test(t)));
  const antre = JSON.parse(fs.readFileSync(path.join(folderJ, R.BERKAS.antre), 'utf8')).antre;
  cek('relay 429: kabar cermin dibuang dari antrean', logJ.some(t => /relay 429: \d+ kabar cermin dibuang/.test(t)) && antre.every(x => x.prioritas !== 'cermin'), logJ.slice(-3).join('|'));
  sk.kodeKabar = 201;
  jb.akhiri();
  // tanpa modul cermin → cermin_mati
  const folderJ2 = path.join(tmp, 'j2'); fs.mkdirSync(folderJ2, { mode: 0o700 });
  for (const f of fs.readdirSync(folderJ)) if (/^(kunci-mac|relay|perangkat\.json$)/.test(f)) fs.copyFileSync(path.join(folderJ, f), path.join(folderJ2, f));
  fs.chmodSync(folderJ2, 0o700); for (const f of fs.readdirSync(folderJ2)) fs.chmodSync(path.join(folderJ2, f), 0o600);
  const jb2 = R.buatJembatan({ folder: folderJ2, uji: true, cfg: cfgJ, log: () => {}, tugas: new Map(), hentikan: () => {}, hapusSesi: () => {}, versi: 'uji',
    polaTugas: /^t-[a-z0-9]{1,12}-[0-9a-f]{16}$/, jalankan: () => {} });
  jb2.mulai();
  const idM = kirimP('cermin_daftar', { sejakJam: 1 });
  await tunggu(() => tt(idM));
  cek('tanpa modul cermin → cermin_mati', tt(idM) && tt(idM).tanda_terima.alasan === 'cermin_mati', JSON.stringify(tt(idM)));
  jb2.akhiri();
  // POLA_FILE_RAHASIA sama dengan pelaksana.js
  const srcPel = fs.readFileSync(path.join(__dirname, '../../_app_padev_studio_3d/pelaksana.js'), 'utf8');
  const mPel = /const POLA_FILE_RAHASIA = (\[[^\]]*\]);/.exec(srcPel);
  cek('POLA_FILE_RAHASIA = pelaksana.js', mPel && JSON.stringify(JSON.parse(mPel[1].replace(/'/g, '"'))) === JSON.stringify(C.POLA_FILE_RAHASIA));

  srv.close();
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`HASIL: ${gagal ? 'GAGAL' : 'LULUS'} ${lulus}/${lulus + gagal}`);
  process.exit(gagal ? 1 : 0);
})().catch(e => { console.log('GAGAL (galat uji): ' + (e && e.stack)); process.exit(1); });
