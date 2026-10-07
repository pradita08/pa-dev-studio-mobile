// Dibuat buat-kantor-apk.js dari office.html — jangan diedit.
/* =====================================================================
   KONFIGURASI  (satu-satunya tempat untuk mengubah pemetaan, warna, dan lingkungan)
   Seluruh adegan 3D (gedung 2 lantai + taman, perabot, 17 karakter, data kursi, jalur) berasal dari folder desain/
   lewat PadevKantor.build(THREE, PadevOrang(THREE)) dan TIDAK digambar ulang di sini. Koordinat di bawah = lokal
   grup lantai desain (meter; x barat→timur -15..15, z utara→selatan -10..10, taman di x > 15), sama dengan R.kursi.
   ===================================================================== */
const THREE = window.THREE;
const PI = Math.PI;
const ANGGOTA_PER_DIVISI = 3;         // anggota tetap per divisi
const LAJU = 1.6;                     // kecepatan jalan semua perjalanan (m/detik) untuk ORANG.jalanKe
const TEMA = {
  latar:'#e6ebf0',
  // warna identitas divisi di overlay/panel
  kepala:'#1d2433', pendukung:'#7a8699', cadangan:'#94a3b8',
  paletCadangan:['#e76f51','#2a9d8f','#e9b949','#8e7dbe','#f4a261','#4d96ff','#ef476f','#06b58f','#118ab2','#b86bff','#ff9f1c','#5c946e'],
  ikonCadangan:['🧩','📐','🧮','🛰️','📊','🧠','📦','🔧','🗂️','⚙️'],
};
// Divisi → ruang utamanya (kunci RUANG, untuk label & panel). Urutan = urutan di panel.
const DIVISI = {
  analis:      {nama:'Analis',      ikon:'🧭', warna:'#2a9d8f', ruang:'rapat2'},
  programmer:  {nama:'Programmer',  ikon:'💻', warna:'#e76f51', ruang:'programmer'},
  ui:          {nama:'UI',          ikon:'🎨', warna:'#b86bff', ruang:'studio'},
  reviewer:    {nama:'Reviewer',    ikon:'🔎', warna:'#06b58f', ruang:'workspace'},
  qa:          {nama:'QA',          ikon:'🧪', warna:'#4d96ff', ruang:'workspace'},
  security:    {nama:'Security',    ikon:'🛡️', warna:'#ea4335', ruang:'programmer'},
  dokumentasi: {nama:'Dokumentasi', ikon:'📚', warna:'#f4a261', ruang:'workspace'},
  devops:      {nama:'DevOps',      ikon:'🖥️', warna:'#118ab2', ruang:'noc'},
};
// Anggota tetap tiap divisi (urutan = anggota 1, 2, 3). orang = id karakter desain (dipakai apa adanya, kursinya dari desain);
// kursi = id kursi R.kursi (karakter baru dibuat di sana dengan ORANG.tampilanDari). Lihat tabel di BACA-SAYA.md.
const PETA_DIVISI = {
  analis:      [{orang:'rapat2_1'}, {orang:'rapat2_2'}, {orang:'rapat2_3', kursi:'kursi_rapat2_ujung'}],
  programmer:  [{orang:'staf_1'}, {orang:'staf_3'}, {kursi:'kursi_30'}],
  ui:          [{orang:'desainer'}, {kursi:'kursi_7'}, {kursi:'kursi_9'}],
  reviewer:    [{kursi:'kursi_14'}, {kursi:'kursi_16'}, {kursi:'kursi_15'}],
  qa:          [{kursi:'kursi_10'}, {kursi:'kursi_12'}, {kursi:'kursi_11'}],
  security:    [{kursi:'kursi_34'}, {kursi:'kursi_35'}, {kursi:'kursi_36'}],
  dokumentasi: [{kursi:'kursi_13'}, {kursi:'kursi_3'}, {kursi:'kursi_4'}],
  devops:      [{orang:'it_server'}, {kursi:'kursi_29'}, {kursi:'kursi_40'}],
};
// Titik tambahan untuk R.rute (bentuknya sama dengan kursi desain; akses = simpul jalur desain). Tidak ada jalur manual.
const KURSI_TAMBAHAN = [
  // kursi ujung meja Ruang Rapat 2: tempat duduk rapat2_3 di desain, tetapi tidak terdaftar di R.kursi
  {id:'kursi_rapat2_ujung', lantai:1, x:4.2, z:7.7, r:PI / 2, jenis:'rapat', duduk:true, dekat:[4.2, 6.1], akses:'r2D'},
];
// Pintu masuk lobi: anggota sementara datang & pulang lewat sini.
const PINTU = {id:'pintu_masuk', lantai:1, x:-11.5, z:11.3, r:PI, jenis:'pintu', duduk:false, dekat:[-11.5, 8.6], akses:'lobi', bersama:true};
// Sub agent non-divisi: cocokkan kata di namanya (tanpa huruf besar/kecil, tanpa awalan plugin:) dengan karakter desain yang masih
// menganggur. Yang tidak cocok / sudah terpakai → karakter baru (ORANG.tampilanDari) di kursi kosong.
const POLA_KARAKTER = [
  [['programmer', 'program', 'dev', 'developer', 'coder', 'code', 'frontend', 'backend', 'fullstack', 'web', 'api'], ['staf_1', 'staf_3']],
  [['devops', 'ops', 'infra', 'server', 'sre', 'deploy', 'security', 'database', 'db', 'it'], ['it_server']],
  [['desain', 'design', 'desainer', 'designer', 'ui', 'ux', 'grafis', 'visual'], ['desainer']],
  [['admin', 'data', 'laporan', 'report', 'keuangan', 'finance', 'customer', 'cs', 'support'], ['staf_2']],
  [['pm', 'project', 'manager', 'planner', 'koordinator'], ['rapat_1']],
  [['riset', 'research', 'analis', 'analyst'], ['rapat2_1']],
];
// Nama berpola IT → kursi lantai 2 dulu (meja_dev → meja_berdiri → noc), lalu lantai 1.
const IT_RE = /(^|[-_ :])(it|dev|devops|code|coder|coding|program|programmer|engineer|developer|backend|frontend|fullstack|debug|debugger|test|tester|qa|security|infra|server|database|db|web|api|reviewer|code-reviewer)([-_ ]|$)/i;
// Strip "Alur kerja" (ALUR_KERJA.md §3). Satu tahap boleh berisi beberapa divisi paralel.
const ALUR = [['analis'], ['programmer', 'ui'], ['reviewer'], ['qa', 'security'], ['dokumentasi'], ['devops']];
const PARALEL_TANPA_KODE = ['analis', 'reviewer', 'qa', 'security'];   // diberi sentuhan "🤝" bila bekerja bersamaan
// Ruang desain (untuk label mengambang, posisi orang, tur kamera, tab Keterangan). kotak = [[x1, z1, x2, z2], …] (lokal lantai,
// urutan penting: yang lebih khusus di atas). label = [x, z] posisi label (null = tanpa label).
const RUANG = [
  {id:'pimpinan',   lantai:2, nama:'Ruang Pimpinan',       ikon:'👑', kotak:[[-15, -10, -8, -3]], label:[-11.4, -5.6]},
  {id:'noc',        lantai:2, nama:'DevOps · NOC',         ikon:'🖥️', kotak:[[-8, -10, 0, -3]], label:[-4, -5.2]},
  {id:'server',     lantai:2, nama:'Ruang Server',         ikon:'🗄️', kotak:[[0, -10, 5, -3]], label:[2.2, -7.9]},
  {id:'hall2',      lantai:2, nama:'Hall Tangga Lt 2',     ikon:'🪜', kotak:[[5, -10, 9, -3]], label:null},
  {id:'koridor2',   lantai:2, nama:'Koridor Lt 2',         ikon:'🚶', kotak:[[-15, -3, 9, -1]], label:null},
  {id:'toilet2',    lantai:2, nama:'Toilet Lt 2',          ikon:'🚻', kotak:[[-15, -1, -12, 2.6]], label:null},
  {id:'lounge2',    lantai:2, nama:'Lounge & Pantry Lt 2', ikon:'🛋️', kotak:[[-15, -1, -4, 10]], label:[-8.2, 5.2]},
  {id:'programmer', lantai:2, nama:'Divisi Programmer',    ikon:'💻', kotak:[[-4, -1, 9, 10]], label:[2.1, 3.0]},
  {id:'teras',      lantai:2, nama:'Teras Lantai 2',       ikon:'🌿', kotak:[[9, -10, 15, 10]], label:[12.3, 2.6]},
  {id:'klien',      lantai:1, nama:'Diskusi Klien',        ikon:'🛋️', kotak:[[-15, -10, -9, -4]], label:[-12.2, -6.1]},
  {id:'rapat1',     lantai:1, nama:'Ruang Rapat 1',        ikon:'📋', kotak:[[-9, -10, -3, -4]], label:[-6, -7.2]},
  {id:'studio',     lantai:1, nama:'Studio Desain',        ikon:'🎨', kotak:[[-3, -10, 5, -4]], label:[1, -6.4]},
  {id:'tangga1',    lantai:1, nama:'Tangga',               ikon:'🪜', kotak:[[5, -10, 8.5, -4]], label:null},
  {id:'gudang',     lantai:1, nama:'Gudang',               ikon:'📦', kotak:[[8.5, -10, 11.5, -4]], label:null},
  {id:'toilet',     lantai:1, nama:'Toilet',               ikon:'🚻', kotak:[[11.5, -10, 15, -4]], label:null},
  {id:'lobi',       lantai:1, nama:'Lobby · Resepsionis',  ikon:'🏢', kotak:[[-15, -4, -8, 10]], label:[-11.5, 4.4]},
  {id:'musholla',   lantai:1, nama:'Musholla',             ikon:'🕌', kotak:[[-8, 5, -3, 10]], label:null},
  {id:'rapat2',     lantai:1, nama:'Ruang Rapat 2',        ikon:'📊', kotak:[[3.6, 5.4, 9, 10]], label:[6.1, 7.7]},
  {id:'gondola',    lantai:1, nama:'Gondola Meeting',      ikon:'🚡', kotak:[[-3, 6.4, 3.6, 10]], label:null},
  {id:'workspace',  lantai:1, nama:'Open Workspace',       ikon:'💼', kotak:[[-8, -4, 9, 5], [-3, 5, 3.6, 6.4], [3.6, 5, 9, 5.4]], label:[-2.75, -1.2]},
  {id:'pantry',     lantai:1, nama:'Pantry',               ikon:'☕', kotak:[[9, -4, 15, 3]], label:[12.2, -1.2]},
  {id:'lounge',     lantai:1, nama:'Lounge',               ikon:'🛋️', kotak:[[9, 3, 15, 10]], label:[12.4, 6.4]},
  {id:'taman',      lantai:1, nama:'Taman',                ikon:'🌳', kotak:[[15, -10.4, 22.4, 13.8], [-11.8, 10, 15, 13.8]], label:[19.2, 1.4]},
];
const RUANG_BY = Object.fromEntries(RUANG.map(r => [r.id, r]));
// Tur kamera "Sinematik" (kunci RUANG)
const TUR_SINEMATIK = ['pimpinan', 'noc', 'programmer', 'server', 'teras', 'lounge2', 'studio', 'rapat1', 'klien', 'lobi', 'workspace', 'rapat2', 'lounge', 'pantry', 'taman'];
// Warna cincin di kaki orang — dipakai karakter dan tab Keterangan.
const WARNA_CINCIN = {menunggu:'#f59e0b', kendala:'#ef4444', pilih:'#3b6cf6'};

// Penampilan pegawai (tab Pegawai) = spec karakter desain/orang3d.js. Daftar di bawah = semua pilihan yang dikenal orang3d.js.
const KULIT_HEX = ['#f6d3b0', '#eab98b', '#d29a6a', '#b77b4f', '#95603c', '#6f4630'];   // hanya untuk tampilan pilihan; spec memakai indeks 0–5
const GAYA = {
  rambut:{pendek:'Pendek', belah:'Belah samping', undercut:'Undercut', keriting:'Keriting', cepol:'Cepol', kuncir:'Kuncir kuda', bob:'Bob', panjang:'Panjang', botak:'Botak'},
  atasan:{kaos:'Kaos', kemeja:'Kemeja', polo:'Polo', hoodie:'Hoodie', blazer:'Blazer', kardigan:'Kardigan', tunik:'Tunik'},
  bawahan:{celana:'Celana', jeans:'Jeans', rok:'Rok'},
  sepatu:{sneaker:'Sneaker', formal:'Pantofel', flat:'Flat', boot:'Boot'},
  kacamata:{'':'Tanpa kacamata', kotak:'Kotak', bulat:'Bulat'},
  headphone:{'':'Tanpa headphone', kepala:'Di kepala', leher:'Di leher'},
  topi:{'':'Tanpa topi', cap:'Topi', capBalik:'Topi terbalik', beanie:'Kupluk'},
  pegang:{'':'Tidak memegang', kopi:'Gelas kopi', hp:'Ponsel'},
};
const LENGAN_PANJANG = ['kemeja', 'hoodie', 'blazer', 'kardigan', 'tunik'];
const PALET = {
  rambut:['#1d1916', '#2a2522', '#4a2f1f', '#7a4e2d', '#a0703f', '#c9a46a', '#7a7a7a', '#d9d4cc'],
  pakaian:['#ffffff', '#f4f1ea', '#1d2433', '#1f2a44', '#3d4652', '#e76f51', '#ea4335', '#ef476f', '#f4a261', '#fbbc05', '#e9b949', '#34a853',
    '#06b58f', '#2a9d8f', '#5c946e', '#4285f4', '#4d96ff', '#118ab2', '#8e7dbe', '#b86bff'],
  bawahan:['#2f3542', '#1d2433', '#2c3e50', '#34506e', '#3b5b8a', '#3d4a5c', '#4b4038', '#a08a6a', '#c2a878'],
  sepatu:['#f4f4f0', '#ffffff', '#1d2433', '#1a1614', '#6b4a33', '#5a3a22', '#fbbc05', '#ea4335', '#34a853', '#b86bff'],
  hijab:['#3b6cf6', '#e9b949', '#8e7dbe', '#34a853', '#e76f51', '#1d2433', '#f4f1ea', '#ef476f'],
  aksen:['#222222', '#c9a45a', '#d4b25a', '#c0c6cc', '#4285f4', '#ea4335', '#34a853', '#fbbc05', '#f4f4f0'],
};
const MAKS_NAMA = 24;                  // panjang nama pegawai (karakter)
// Deskripsi singkat tipe Tim Pendukung bawaan Claude Code (dipakai bila tidak ada file agent-nya)
const AGEN_BAWAAN = {
  'general-purpose':{description:'Agent serbaguna bawaan Claude Code: riset, mencari kode, dan mengerjakan tugas bertahap.', tools:['*']},
  'Explore':{description:'Agent bawaan untuk menjelajah codebase dengan cepat: mencari file, pola, dan menjawab pertanyaan tentang kode (hanya membaca).', tools:['Read', 'Grep', 'Glob', 'Bash', 'WebFetch', 'WebSearch']},
  'Plan':{description:'Agent bawaan untuk menyusun rencana implementasi langkah demi langkah (hanya membaca, tidak mengubah file).', tools:['Read', 'Grep', 'Glob', 'Bash', 'WebFetch', 'WebSearch']},
  'statusline-setup':{description:'Agent bawaan untuk mengatur status line Claude Code.', tools:['Read', 'Edit']},
  'output-style-setup':{description:'Agent bawaan untuk membuat gaya keluaran (output style) Claude Code.', tools:['Read', 'Write', 'Edit', 'Glob', 'Grep']},
  'claude-code-guide':{description:'Agent bawaan untuk menjawab pertanyaan tentang cara memakai Claude Code.', tools:['Read', 'Grep', 'Glob', 'WebFetch', 'WebSearch']},
};
// Lingkungan di luar gedung (koordinat lokal lantai 1, meter). Posisi dipaskan dengan gedung & taman desain v2:
// halaman depan (rumput z 10,2–13,7) punya pohon di x −4, 7, 16 dan jalan setapak lobi di x −13…−10.
const LUAR = {
  papan:{x:-7.2, z:12.9, ry:.3},                   // papan LED status live di halaman depan (di antara jalan setapak lobi & pohon x −4)
  bendera:{x0:8.4, dx:.95, z:13.05},                // 8 tiang bendera divisi (urutan = DIVISI), di antara pohon x 7 dan x 16
  bunga:[-2.4, 1.0, 4.4, 17.5, 20.3],               // petak bunga di tepi pagar depan
  // lampu taman (menyala malam): taman timur (di luar jalan batu, kolam, dek, bangku, payung, pohon) & halaman depan
  lampuTaman:[[18.6, -1.3], [18.6, -3.7], [21.5, -5.6], [21.7, 3.6], [19.8, 6.9], [-9.6, 11.4], [-13.4, 11.4], [2.6, 12.0], [12.2, 12.0]],
  jalan:{z0:16.45, z1:23.5},                        // jalan raya di selatan; trotoar z 13.7–16.2 dan 23.5–25.5
  parkir:{x0:-34, x1:-17.5, z0:-9, z1:13.7},        // lapangan parkir di barat
  lampuJalan:[-30, -18, -6, 6, 18],
  warnaMobil:['#e76f51', '#f5f5f5', '#3b6cf6', '#2f3542', '#e9b949', '#9aa5b1', '#2a9d8f', '#c0392b'],
};
// Suasana otomatis (jam komputer): jam mulai Siang / Sore / Malam, dan lama peralihan halus sebelum tiap batas (menit).
const JAM_SUASANA = {siang:6, sore:16, malam:18, transisi:30};
// Logo PADEV: salinan 256 px dari logo/logo-padev-icon-1024.png (data URI base64). Dipakai di header panel, papan LED, dan favicon.
const LOGO_DATA = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAYAAABccqhmAAAAAXNSR0IArs4c6QAAACBjSFJNAAB6JgAAgIQAAPoAAACA6AAAdTAAAOpgAAA6mAAAF3CculE8AAAARGVYSWZNTQAqAAAACAABh2kABAAAAAEAAAAaAAAAAAADoAEAAwAAAAEAAQAAoAIABAAAAAEAAAEAoAMABAAAAAEAAAEAAAAAAGfqGkkAAEAASURBVHgB7H0JgF1FlfZd3tpburOSQIhhx8iiAUF2ZlSUURj9h4yOioIOCCIIrqPitL/jgjqCOOOI4wwqLv8EB3cUURMWEYWRUQmLJBBIIEsnnU4vb73L/33nVL13u9Mdtib2677VXa/2U1Wnzjm113WcVKUYSDGQYiDFQIqBFAMpBlIMpBhIMZBiIMVAioEUAykGUgykGEgxkGIgxUCKgRQDKQZSDKQYSDGQYiDFQIqBFAMpBlIMpBhIMZBiIMVAioEUAykGUgykGEgxkGIgxUCKgRQDKQZSDKQYSDGQYiDFQIqBFAMpBlIMpBhIMZBiIMVAioEUAykGUgykGEgxkGIgxUCKgRQDKQZSDKQYSDGQYiDFQIqBFAMpBlIMpBhIMZBiIMVAioEUAykGUgykGEgxkGIgxUCKgRQDKQZSDKQYSDGQYiDFQIqBFAMpBlIMpBhIMZBiIMVAioEUAykGUgykGEgxkGIgxUCKgRQDKQZSDKQYSDGQYiDFQIqBFAMpBlIMpBhIMZBiIMVAioEUAykGUgykGEgxkGIgxUCKgRQDKQZSDKQYSDGQYiDFQIqBFAMpBlIMpBhIMZBiIMVAioEUAykGUgykGEgxkGIgxUCKgRQDKQZSDKQYSDGQYiDFQIqBFAMpBlIMpBhIMZBiIMVAioEUAykGUgykGEgxkGIgxUCKgRQDKQZSDKQYSDGQYiDFQIqBVsCA2wqF3F0Z49hxX/jltWcPZ9sPHcn4kV8vuA78HK/mZJwIf44TRa5biz03EJfXAOfGbox/xI+AB/gzpVUCwzhchLiuhsVO7Lpe7HqEDAUIEkanwHLcSLNwPYEZxwiStF4za/h48JMQtsHodnBdganpCJj5e4iDJCgwPbxI/B3HR0FoRQz5ZXlYH5SxUWYmoH9CRai61JlBPuICBiN4YeQWsk6QiZ2BjBduy7jVHfO92oBX2bn1gFmdfW/fu79/+VFHBVqYBMDU2pIYGEUUrViDV1z38MG/q3TfNtTeM68eh06u7jk18E8MZvNRIbIZK0muIQuQ1a1KWBOcr/FtnJCRoMVI2G24NYUrjUP40cS14Y308JC4+KFJf1ENi3EaN9nUKmtH9ZzIJDZioQFH/E0CxqMSEAk46qu/xA+YXfDCuhI/TOY5oeMDn5mgDqGAHyccynhun+94jxU8d20xLt8z3w1+e9w++YevOGHeCJMm4ab21sAA27plFejWXfKlLZdvy8/7KHp59IroyNDzh+h7XRf0KETPbh2iAH5ULvtjo9jRqkLE0R2kjQJ4zEXjNeNbAI1oJi8aiI+sGpA5REnmk0hircxaigoPm44WZXiBCCdDTCzAExt/4G3TWBhJj1iA2LSIkagLwySNBPMHuYgHf4hLGKwMtdghLOiCPeMETiaqDxTc+E8dcfXubFxavaDg3nnLlo9uds//MgRGqloBA5Z2WqGsu5TxlVff2XVH/vm37ix2HuGG6P1DGZ+jx0K1QMMYq2MkEOmomQKBtY04LmhWm/ygPKJpdsmEUaFpqCk2dHfMS7ilkcTGScJvBEp6TTvKzzh2kT/K/QKKVgqRhJcyp8ne8LQw8yg4zK5RRFoIyOYOCwBypiOKQSau5IUQqZ8FKAIgxoiK/kgKvDKe62UwUoBAqJecglN5tM0L7uvOF342r9L/vVWvX/oYojYlrs06NacMBkzrT5nyPK2CHPqVJ07aGPbcVPZyBdcN0Umh94/b0DsZIgU0YRrU0qMf/igbhOkRxl5V7IbwaeyCEOMhBtOaGGQO/u2qGMkkSsBjORLejWQWguUzG2BHDdqDW9+mKUwIZyMnsZiRQcNTWF7jiJ+tIUrO8iC95Mv5EtYUxM06UUbSxfmAJIFJAUAJwXiMz8iYJlDIsmLErydDA9jh1V4f3jgvHv7mkmjn1Te//pAnGDtVUw8D0oxTr1hPXqK4t9ebv/Bd1wxmZr0trodIQIpmv5wBPXLYTRjsNc0QXAiZBA8L/xlHqdhkxghWmciEAUA2hDBp9xQ4bGQkEwo/jYnfRrjGJ1SCsnDobiikF2Y2aaTYCBwtAJhSCgNztNiR3hp1EYaWxAqBKUTDSYakasZRt/UjbIEqdUFkEz8RS6xY/DT1BWRGs3CRWnCJjMQLcCIIg2wQOd3B9rWLirUvHRXvvPY/Vizrb8JMbVMBA7s09VQo1FMpw7H/vv7Q++uzV4/4HfPdOBACbBC41MpWzQgAAiXFCtUqw4zKh1OEMUqYu5GmGSgg5Ef9GkLGRqGQEWXLYAPGM5WhrdAgWFsPC8WmottCtGEiAOCvUBjOOmoKxkmOLLQ+DDOMyvBGZhYiw1VZIWTd1pQtAzjGhmtekexQRLpaIJsUHVHJaXOC3y7JBh//9Yp5P0LxdkW2BZ6aexQDlp72aKbPNrO41/H2ndv3ma25OZdFIWkpQbzgoGafrTklCTXJEKPKIb2o9mSEpvxNZmrCFmYjw1AlBIC64WVzTqSx0SXORD/IRvNsNocIAsRv5k4HXFI/WE2aUSCZXAAl0o0q5ziCj0ma2Y4Ct3sHEpl0TbywfJiKYZogAsDlXIICGN6+6xTrpZEut3bNkW21L/7kNQvW7R5+GronMPCMmn5PFGx3eSy/5pFD1tbmri5l2he4EeahiGyZnBVibyjb9pZZJFxIUcBKuKVe8WGYKk3foO3RzEFCRjQbl8JB8rUeDDThtjzqYftnce3yw+RkQpNc4CvfjhZl4ofIDWjCWQRnhvB0i5DQMtp+3jI44UteiKPw1d2slY1BmDZM7aPiGAEnjI/gZLkFJ1iQFT8IABVUyA8Zc6XAgSDoDMsPLvX7333P6/f5CeKlowGL4j+DyaWdllKko7569+urmY4FflgXQpNK8GAMNYmbTKCULkNc67aVTXTQzbpLGrBWwrR2hYWoCh7wQbaEz0UyWSij29hJzoTBDXlqUxbmyfytFoaAnzKGmjYfKR/hID3LbrWFJ+FIS9hqp8n84Ska+dgyIprCQ90EHssA0YDwpmYcugmzqemmP+NrudW08QiPZZAqNtKhHC7XYZAqCniGAJq7Bz7cEAz1qjPkFg9+tNLxjRdc9/C5wDESpOrPhQFu67aUOvM/Hli4c9B/nVKqFl0YlVbbrcFqz99JLwh/pTIwCsMYlVSbVBPQIWHHWB/wzDkCSYwfC0dBkBEMMATYfhsphXlsVtZMZtu0KwBbUgKkj+bUjEUbe17JX7K1GWt8K+QkBcvOOFImhdHAlTp3+SVcqyjbtC74BSA7qhlVD2ZvErkiIZlCjhFp3aUWKAOEs5QDowIfQqHkd3Q/Gvj/cvg3N5YA4tsAYStis0/NPYCBUfSyB/J71lncO9T2t/VM7iAHvX8s21egP1CWahCp7eUQ5kGTVRgmA81Gr4pigNy0h1Oz2TOT5ZTtSNfiz3xInmYEIKdt6RbugoV2qySe5sftMu3gCIl6AoU0tg7CJRKXJTflh83Ww8YTRmb+7IWNauQAf2E4mLaOdvTAMotQsyYKP5FQGN3TIxPmBU2cSBhN5g1YqmE3cTgas3iSYCIPJ4tinMMIgJcqUo5kOvIbg87PL/vG4+fEcS/BpmoPY6BBM3s432eU3fu+/0Dn1x6es2oo27M84twfw8oGJRqmFYokT5ia2V6LDCR797Lar4H0swpsIFaawmzoZZUxGAfauCUW7JqvprF5WFg0bREoe6wSwQL3LgyHSCJyTFybZjy4Cgt9LRbbxuYxNj7l3VglzJ8oUzJ8VHrG0eolozRGAfS05RS7iaWgjVCRAo7JjNJA8Kkm70t0RMP1uU75XevOWfAlxB6v2AZ6akw2BlpK6q7e1HVwyek6MA5APKY3bvY4IDpZByBhQdGA5jxVNI8AS+8E9oZVTviCGBvzaxNfRgu0kwyNn8ARwkU6ML/0gAhnLyhwAFdGHsYEhwtcQGjKCcQV5kvAbMBnvERckVFSVknEhEYjEqwUF5qvum1ZZU5uys0ktge3+eic3aRBuPWHTZRmQ+aFk3ocFQGPWg9khDKqHZEF9wijH8sgNYJhYElZpE7wM6biLHCGMp3ZrU73p478xpYzmTJVew4DLSUAHh/KnxE42a46KDTCRRVHtCJLGAhWEprM75WalbEYpUGIiMmua4y2Q2uZNiCMbrUrPBUYhKNET5AWhg51mzC1DM1y2PKIcBEGBQvDFEaRcihc4TzLfSivMBeZhWUXUzzVnZjeyIiFZaZoYhSTB8vHxcBG3RDOaYn6cXqhmjen6K/pCYPla5axWVbWCf5SJMW41Al+MlmiybJCS57EvvHTqZCITgTS5HTAhEdVp+LlOh+p56864YaHj0BgqvYQBtgSLaFOu3L9wmrsnuXgUq8cQUW3Z3tvYTj4kgVEGSJUYoTD9jzijx9SMJkkoaWHYpAdRQiV6yIeWYOQhZEFlsIwuTXDGIcFsIwAAndJ5MZkz2411sSF/Rp1MGk1HwPHML8tmy1vzLMPLKfUw4w+UKTm+ocZmSCcQkQ51pSZGTAu/Bm/IVik3PBLlgMu+6e4RCjqJszNeiVjA1TDzaykeIxDZU11yS/LBRVix4DrAnFUdqqZWfuu29n1vjheKYeRJUL685xioGV2AR6I8m8rZ9sPceKakwXxxU4OhGhWlknMQo9KVKMxZomPVIkQaJ3rjo4LSLrSz7l+AoAwEN3GU6b/dBKOELHCpz+Hv4nc0LHSbX2YpglZ0jeDFCDzSfrRjYg2lT2BRw/pecfGZfyG0rJIWsaDhZCE8VnHRgEUuhbNRGzAGG2RnRXWiJWFkinFhGUg3GYgBV+jJhQ8lGoUJhBkGHxAtmFxsOY4Q37b/zn6v465CYm/zjxS9dxioCVGAGf956Z5A/XMG/jEhw/iycgw1hSdlKvUSwpLaONv5qa2pyXhW51ELXt58ZdeEUTJeLRb2DYy3UYrHMalpjenJgqfHjKXh7/NWxmCTKHaTh10iG3yA6OwHjKqMSZ7aREupvdlemFvuAUGBaLtceFHxsIaqcyQ7AhERyUeQGlcGYJLXOCRHCh25s30SbeWR3HLMLqbdbRu+jU0oogyuJcdAXoIbK275IF6eFLQAEl9XC1ynJJXzOOMwIfOvKm0WGCkP88pBgwXPad5PGvg67b1/1U9bj/Qq/NQCYibQ0aHV861l5MMhP4MQ1hCM6bObRmmRVHGVSK2dhKyMB2jJOxM0owDl3hoHEa1iotjY5VlfMvMlkd2iYcelavh/JMRA8otEwSaCc0pABmafqPKhEKxWKxgwx9OkSXMFAKEgolK4ONXE4jXKGGjZeVIweTF/KCTayMCij8NDTgEn9QUnszHajqtMiMIOvHsCMqX07Sc3gWBs9OZfdCaJ0oXIklL0KetViuaUx7BK1euyW2Lel5fzRV5oMyp4yBJ6PG1GgzZyRAkLNhl7p4kSEt4MNXb9jwkbiVwMgYD6Y7QW0XsaRlZ0prmlCiWsRjdxjF+Jo0y1mgSINMRrk3DhURdvUeeSGc1y2HjsKe3dkKDS37FxrzxJzWBneVmXF0bUHsyLeNZt83XugW2wKOtqSScPTfVKP5lOVTJ9EMCzUiBdgglLaqxJxOL3aaGiToaSKb94DLVJM7qyL8/yr7ltO88cpCJmBrPEQamvAD4xKOdrxzyZp/Ms2UZaNImlwE59G3QJ4jHEjZNoSaaozQSkvDQm9khrqxCw02TcDW6Cgy6rZ/GN8Quw2PaoQUW4BEGx68Cq5k9bKpMkZAIbmqWPKGsN0zWSnp4CgJoYTY7CkCYlpFCoPlHoSBgUeZGFgLT+Ceykrk4vCnsBB+yoGjsxo+QZfpj40g5AMS6EV1HIjSNhp8VRBoPbkpsaInDNEazEqNGGo120jgxkDnod+51/0j3e1euTBcEE8036dYpLQB6r11V2FbOX1D38/liXIEA4FIRelQwWggG1K0l4AT8JOxAIqSimdCkL4nEiFBWWNiRKN3NlX4lwiaxmpQCzxKuABFYu/wgHmcDZFwPpaWW4byMZolulBs+WnZ1068ZRxlbpwPwN8wvo2HYG3N0A0+H5ham5m3n2sQT4VIwWYHGMNkGNOmldpbxLR5YV/hZPFmzUVfEIyZlJEVEU0BQM50oWqyGDfGTmlHobihYraCT051sW+BwZ1BccWX9xOWNeKll0jEwpQXADY/vc+RQ7J0chDg4SiJ2s5wxOlmeABQCw2k4IVQhY/EiEQrpgdBlgYzERXKlf5LoxqBSCdqAtQTOOCad9LLipG00QVu41jSlQX7NPCVruAlPhIuBLUwj8egBxThGsUwNmKbs9CNgqTfqDnHYYMZEUs0HEs4kEyaVdCYDMq9YYUrdBa6WnO4GYRgALIfVjCXJEzgmFBVqJjWFlUBpQGcOo5TAsxVGcVQIGBOLgxUv3/HYSO51vP49KmHqmDQMTOltwDDfc3KcmV2Io7pTx1NfIcggF+OmGc6UhyBu6d3Yy4LGOPqVOTFNe3FnDJrkJR+REMoq/BXyBAChVxPfbnNxhMBwjT0GGJ0MtCpph18jDWHsBkgjXiJNw8/CJAzmY0zDk5JHIorgwcZj9LGFZ1gSNt0y8iBzaw6IAEzKAStiFAphrhy51tTycAmASD78NYURQWadNhMx0U4S2Xo2wAoQ66sCCS6Jix8AxJ0hp1zz/vJV82+b5Tgn7tCU6e9kYmDKCoBrrrk7+/+q26JyEH0nCg2VgSZxzx8DRGxnYRJr6atJ1RY1SnIgTlAvl7+M0gTqZnfDp4Tl/XyE4566kHwztqx8s+/h9F7okgYYxEbhs5gcvEPBCxSLLhA5Wzlk8kEoBAxuE6LTluEK4uBDBS6f0lSFYioQeacMMHTsLlINHyAgdwoTEbSkwC9K0SiSZM8APusnqTExIAz5EAFMoAE5ctUCdkZUMKw9juH4wGZ+pO7Prrn5RbXQmR9lcsW6l8UiKy9cITqy5VVedsORlzM5E1ssQkN0GLAKGwESJlmKlykuva1EFH/AQSb2RSRbvghvCsQQ9rhAvN8TQc++SJUKAOJuklWiVSYZ8rMEp0zxUZBor+Pg/N8u4K43PmcZc6w7mYBhjGfjJMOS9ieLM1FeSbhPBiOZ3+7skwXnyfJYBtwuvMZ97/OOzd03PG/uQ5uCJYNx4Ygo9v5qJPJPrOS727h+wANYslJhHvmA8IAsZAD5udk8SfZXbw2z4koSJH9ktIFUjJyA42KpN3byTtGtO0sy28974K2L/j2ZLLVPDgaaLTc58FIo0wQDN954Y/4Dj+53/BPVnnMqTueZWIjt5P2LICNvLmNQwMVYVJZ8K3WmxbC/ZWQ6DYXJMGYUbiDbrZuWUZKD6XjOI4v3xn1nb2fgug039ZzjXi+DMZsqNScBA402mARYKYhpiAHwpX/0vz104vranI8NZrtPiAIMzcHougajHM4RAGdboizz0yFe+GG4TrA0jhUZibhJGDqi4GtPWOvJZp2eYGjNWXsPn/LlVy/aZgCkxiRhgNO6VKUYmBAD6CHCuy84cPXSzvLftVUHb/DxBrusgghzk3xkiQECADGpOSoQzSURROI/UtjtTDWRiullSUTj8cCUVUyHKQgSYrUHT4tXQ3/p7Y96+9vw1Jw8DKQCYPJwOa0h3XXu3huuaPuv1y32+y9vC6tYFyWDKoNLTw+7PsNGP/Unk3PdMzHYH4Mjk56+TA8hoEID/liepBDwgqoT+MU2rDkcPiZx6pwEDKQCYBKQOFNAnH/++fWHln3lM3tF2z6XlbPFYG4yO+5mcJAvC3ciCLRXJzPbBULarSa+1E4LNDv/xAhC1hYkPi8JYQiCqULdzx5EsYCYqZpEDKQCYBKRORNAuaf2Bsdmtv5TZzj4Mx+LdD63Cs3zZPpVptE8SkYfq0b77Rou8WXkAKGBjVaCKNfr+2AnJ6XXsch8lu4Uoc8SgTMx+TcvPnZwbt75WDaolfHFD3TLWLEnH+PAUONSVgIxwvBkaMSRuT9MOT8BP03HtNBJt8SnMMGuA8O87N7/8/kn8rClahIxkAqASUTmTAJ1WvXOu/KZyu1RNudkArCzMC+WBmyPTzOpOUkgI3MUb4Jol/UBG4/B1g4zYXUqkdf9b7fvKDBKqiYPA6kAmDxczihIX7j49OqcbPWbmbCGDp4HSsndeNKHynAu+2+rxV+CmusCdn3Aho015RVneHLUUIOk+UPfCB4OSNVkYiAVAJOJzRkGa1mm/+b2YPixIEMycrEeMDE5cc3QajsVoCnTg2RX38AhVgbpT4XdAdwDLeQ790kFgGJk0n4nbrFJyyIFNF0x8P23HrI5H1XuYBctFyD4STDO7rGir0N7DvdVJxf+aBfNvX/L5BZJRhhQONh3G3jZGecMslG5DUcDUzWZGEgFwGRic+bBijOe96sMXvPUG1AgJ+m0LeMDIcLIMMHR9k89wfycH1iGJ+7ETqHAg0N0c23BChBcZspWBTqjpmpyMJAKgMnB44yEQtbM+/FDuaiCc7t8xGNi/uTefqPnRzSeHEyOCohAygMZOYiNPozIf/i6cam8s1ymb6omDwOpAJg8XM5ISPOz3hNZJxzSyjcFAHt7q4TRORVgbw5tjwVbt5pgdITJTWj0/DIzEBCUAFhfCKu17uwWs8poIafms8VAKgCeLQZnePpyWBoCEVXkPAC5lvN67uHDIBdzKC89O07zcdXfrvzb3l/CyeiI37AjHUHxdCEDCKsT2w0rXnkgn4NM1SRiYMo+CDKJdXxWoIQOV2Jl675TSMe7qpN39XJugV/D/xTHuWW1RqIfw55/YeyuWMF3RlpeRX49CF0/0C8140AQmFw/IEIrWVgwCD+YVsFfOJzuUd4GxfDjAyFyjwCnDD0Pi4thsOW8/eaVzrcwUnNSMJAKgHHQCGL19vnAnw7LhuVjFwbxEfU7svPkUZ/GKz7s3nBRhRPZH9BKwrWUbIj4R9oZkpQd72/RFWKZ7Aexm8F7Zl2/3rYasa8mG4yTfUt5uZUoGwf1TJyxh4DQy1tsSO3wAxQYrEjdgAqtOMMTAaOERAMLeLAVCwgF130EOExHAA28TI4lFQAJPMa9jnfQjl8fPftdD15UdYuviv3u7joepODr1jJ0Ra9kOy/SLYes4yk8vwW6Rg+GsStJnVtjJHQXHzLIyfA4vhPOCVKPB3Hq+rW1t89zy/VOfazdMjprx+qx7sQUbVpdwSOs6jsaCRYhDJMHR3gMmPcM4sDBw5APE6oAS38mDQOpADCoPK73pvkLd+z1vh1Rx9vCTMcsfrMuwmfII3yEhD2TId8m5SKdJWIBYUnTUindjJBIixGDkw0qO7tmF37+hCRq/Z++bfXFlbCtXd5phJxLPvyhKDG/FAjU8k5hot4aLB6Cz8YPRAdxR3zyhWDXeTiRKrVOEgZSAQBEHnP5H5bfu63wr2W37Zi6U8BrVHiKEoQX+bh7IndTOfIkJSaoFT5NlwmT4QFbBiHJuIyI4YLrZzECqN77qgNHHniA0VpcoVrufnG8LPDaPQ/PhbnosbXewAcUR0hWdIqbOOTsCYbGEEwxCAoxBU8IkykCrwtFeJgUOwBOfUd7IX5I46W/k4mBGb8LcMi7fvOSdQNd149k5h8T4BFKN+ZCFvsxPj/OAy5wkzCpyOBCumNNeI/q2UjhRK3RHr5jAHcG3tl89iefOfuIEgJbXq3u7fVHwuiEGILN5Rt+FAKUCuBkagpPayfGVHFaACXhjGO1+jG9CAn6Q/k4XdiVCe+96CXROvFIfyYVAzNaAJzyD3ccst1Z9NUdublLI15kIRFjzulizuk5VUF0jOuuyvhj8E76TGghXOseE1WcEABuOFRuDzffDgZQ6h4vXgv5vaft3CVVd9aRurVHtmb3Pr5KiEMjHIACMDlTqbBoCgb1AywI3AzwNtuP7z7vqEWV8SGnvs8GAzNWALzh6ju7Hhiee9Wg23NQ6AzJgh0oEadPMfD08fa9h9EA+NRFrybTADnKRgJvag5RrZbez7i1V0NU9mIyLSBJ+47vh+uOPiRa82wabCql7Q/dU8uZ7vlECR8DEbHG04BGUyhyIC/CcUzBiRFRpqcXpqcH3SIYdP6fBfCMn+OiKRGfqknGwIwUAHGv4/38oY6LB+Ku0+rxCDt9aLA7HrRw+RS10CAJUMmSK9mNP25p8Yy6DO8t2VqT11ag4MyAXPlElnIFvhCIrYQOp37Xtzb9qH+S2/DPAm5V76rMUC04I5QPqvAtvzo+3U5haapsTDkeTHtCMFi/sYJBtwHZDsA9MYz5vxeUS7Xqzgf/LJWcAZnOSAFwwNb/PbkcFN5b8wLQJYb8AXsvy8TaaQvvk5PH1ZYyNFw6LRC4EjBRio+X8mwABIon6whlJ4OPmxbj+l1ub++06MkuKS7cvxp3nuBVXadQw5QJzMrXe6T2YHgO62m3OikY9PEQBFIoGEFBkxAYn/7chcngQVAvKD12cPzQ4/QeT21dc2HH+l+/69DxwlK/J8eA4PvJo02fGOz9d2S631gpzOvi8VV+fEL3nEmJz16xVyPxxz6nB/i8FqUDhxhOPchHtWnRk6FG3kBQfH3F6+hxMbLJhLgLhFGRcLBIw11xSUyT2GRRkCYYXOxkdgoLApXRFcIofTEic/GceLtTufMH+35xws+CxZvvObyr/Ot3xXH6GXGg9WmrGScA3jj7xo4wkz2yjkM5fHASXRc7aiVeGDL8JAOTkBNqrDsRpFYdMoCwQcwRhv4YWbAPDOXrex2Ol3HXz24fmBYC4NRPrt1voN5+Lr4ThHs8I04lgw+FgPszqLfM+8nMZGwwMNALnChe2cPbXp5Mzo+1CuNLHBUEEoe4l7cFnGhBe/Bjd8X1lKDjqkx1+0sL1Yfe0P/LK48ZN0LquVsMzDgBcM9jex8aBu5BvLQSu7xcRiLmcQiS3sRKV7onDrchDbFBC+bFFDKeW3C6/Opv7sjetsnGa1UzPsvx15Vz76l7PYvxkRCIuMgJKPzAxB4/IErmR+V0lYTrJcAsGJpCgMKRJuNakwKCaSBxodXkeouPbdUOr7x2nj90C3zHVX23n9uZj7edUcyOtLv1bRfFK0WUjxs39RwfAzNOAAxU3FMrntchPXqEOWu9CMzo9t94KJqo56e/1cl0XDgMXSwk4q18Dx/UxAKDk4+qUU9QvrHV5//k5ecd8vAF27xZb3HDEhg7hzl60cnhUVCf639gZouTBt6EsXWIT6bXoX7TpNjlNImCgouD+oUgVz4KuqhQ/9qNF79ows+BtdfXnJbNVI+oBwGExRN/3T/vBa9JtkVqf3IMzCgB0LsyzlWc3MvY1fBz1zjnCxupFpQt/dbuEWaJ2prJ2BwhyCiBFM09f1B0BEHg4cHMbNy/ce6s2u3J+K1oP+rD95w56HR8MvByeTkrwekOkOfT5IhKXvDBZAC4Va3bpLzMw+1Uqzk9slrhML5uqHLr1cOIrBAMPnrALO/rQCfHBbuohx66Op+pbjo/lwszLuJnvWoxX+/7YLzm0tm7RE49JsTAjBIA373n98+rOf4yPkjBjonEFmMnAH2QuIkly8jJIX/jk1UGjckw4yU9H+06/AWBy8IfekaMSnFd7u7bTv5RSx//P+L9/7tsY23eVVWnqyNbw9SG+MOcP5bPeEOIGj7VIT/CyLYcEtjFPnHjR3p79viq6V3n7gGERi7EZwaQhgKjGIff+e+/32fC1f+567/1EicuneDg2LYc4ApcnOMsH7l9009fB5CpeooYmFECoH9nfXnoFeZjpgqiAdOjexFCTSBrvN49ESyMPlEc64+lPwgWEDhMX1ayvducU3tBqa2plvXeMfthd+4nhrILl7h4/8/BSUkOnITp0fvLIyDwoEAVyUDpIAyOKAwXp5oarknFnz0/V/+RPo+RgY9RRLY2vGNpV/0bE/X+Ti+Oa4WPvSnrjxQInmm5DJlxK257fcfbh2595zyWLlVPjoEZIwDi3l6v5Ha+tO4XMdpktTlWbxokRqvIyFaLnx3e2wi7MZES5Aj4GPrzVGEurA11Z0u3TkjMu4H15w4CSryD37fuqI2lrm9WM5kz6g7m/c4IemusmbBnB/exx2ZvLhIBfkkBIEKAlRBhoD2+4NkKDQMjG+HYNeBU3TYM/z2n3a99c9XOr/1hovpvOenEw3LR0BlOWEUxAJeilW0WBk7OHzrMrd/xZniYBp4ISupPDMwYAXBS7VULam7hlJB0QXpF1895ujhIwE9CLrZ3J9J2pwheP22NU4VZH8dYo9tf2/7de3eXZiqG/d0Xb+vZ/0OPfLwvnn1z5C16RaEOfIHxAyz8OVg8JQ7lQI8IAV0D0L19EBXCRMQybIzm9qBd9GNYhusFAMbdhNDHgqIXr33h7NIVEy+Yxm572PfGYj6cC5mhZQizYH5AoRtTOi964rzBu8+YMxXxOtXKNGMEwIYR9/Cql9lHH67g+BWaPZZQ8lNoFgoJaquSdusnJuewIGjugWNI21EMV/9jby+6zNZQvSvX5A54/72n/fKRxf/d5879QN3PdPPRzgB3GXIBhBoWTkOOccC8OrwHDsl5gp+mUEAkQa0IW6JNwhWHIkyBe3nyC3BCHJgK0PMXcQGrMx68+caLD5xw7r/xN2+e7QVDL+fcP4IAx3krZKH5cyQQ4lRiNh7aP7vj8Ve3Bsb/vKXkBviMUENu+4lxpi3ncA5ru3uuAzRqr8SJYYESa8N/jEUSmFQTjjLR82Eu64cj5fbC4JQf/qM23qs/dMfCjfW9X3rNnd7rhxz/1Dibz7k13loOhUE5S6fQ9Hg9WhiO9yagwNhEgy6MEofwo1vC+KNKMaa/hGWiYcsUOyYQILHX7uTqm/ufV+z7KtJqRJs4Yc4aWP13uXjgsCjAOgszEUAKDVhHcSBOoroXV3dcMnDbBd/rPvHfJjxFmAA7Y60zQgCc9bmVxZ89mvuLkMdVMdgU4hQibA6AhCQt1WoEIYqxQ3+RDxw5kHDHIxtQJdcBXBxkKTiVNQd2rV9z/3jx9qAf2KNR1NOvvjFXG57T4eTzc7ZuHdkr9LoP3buUOyaotJ1S9YtLwzyORcoZfByQYhlxXFq28bCeIeclyGvEo1k91dV8hNFN5ECpsBBr44fxmLShEJVnJqQX5/VrnCvoyQVfvDU4+m6F0ojZsOxY9YrnZUbuush3SzL74NFhfjSMh4mYK5XHrV2sBfjO9iOcod++Fbn8sxZOgtOfMRiYEQLgvscPWh4GmSMi+Yy1IUMOSQ3BjsEJepFRpDoqmGFkbkZJxrNbg0KG+MHjn84st/rD77//zOGJCHoU4N04WFIn7nWd69c0QZ21zBTyH92vrl6ffbSvlKnUO7JrNmX97QPbZ3W0F7v7dox0l6rR7COy2b13OP7eJSe/1F3v7otVszkYO3cGYUdX4LTl6wUehsrgwlLVydbLGJp7mOvjQ7zyyAcW+YgnYTIWBPXmXxJFYH5urapKBhgvpkkkEAHJaEhCueLhRmGPv+M7572k41PuaTanZlrakD4z+OPFHyt4lYPCupaCJZF/lE/GclxUlNUHzAUyQ06+uu4DO757/M97XuP872hoqctiYNoLAJCIu6jeeWLd72hzMcfkcpMq7acadGnp12Jmd2Yj0TiRQIyxj7v/UbXamXVuA9jxOWKcpNaLx21PXvrHgzZUnKPwJtGxi93ckugSPFLgoR+N6+BH9Jt35Fg1MM963mQounE+h72xPObS2XowqzMadtqxsVZAB57HW8ToaaF5UpbTHk6WufhGxgFj5+sjYDB+1w/B7FVxejF2MfyXERM8mVOyhx9bfwlHNPpTWDAJ7HA1lGCbQSatXLWG3fULTke4ff1+HTsuf+9p+480EoyxDPzoqFe1xf1nxRF2IuTmoeYj0ZARIAnzc+uVGYe4pFTwB+e48eMXoSznEWljQKZOYGDaC4CPntLrV4PoxDCHwyYYZrKP4GveQiVCNLvSgfR4xluIekyUBmGbYbAEA6TGBXwwm+/FfQvbsuuezusfZPzlC+942VJ37rmD5dzJNdefnwXf83kyfB1XmJdzcmpSsy2nLSNZwOcpO3C1fHqLZSJrcJEuxBEoc9oOKVFGmdHLhMiNs04ddeHZBR8Bfpjj0RzkAVhElSiymLUCA4bRrdeoMDI2Ahp+Eol4Rx5MamUwRlL5cLi6MF+/fNUHj3pwdHwL2XEGf/6OOdmhG/4hl6nlMfVHGZthtu7MLGT5Q+CJR7yxVhEAD168Y0X5R8f/B1L8upkqtVkMTHsB8OOjT59brzqHhej1eGSUvcOTqQZRPVnEccLJcJwz56Ly4yc839n883HijOf1ggu/t3ifaPGl1XjO+ZX8rLYQW24+dISrtjGnLobhLJMID6EuLCtv1VFRIGg3x4Gwaq7UUzBwrZ09v0bFAh5GAyIckIK7FhkKAAz9PfT6LuLJE2kUOhAIhCsL/RR4wsHMb1dESil29ZaycaXeCixNituD+OBHt9P31Q8c9odvI+1EKd16+cCLOrydL45riMKysAxjFbzwgLPUiXG4FVmHwMv5lc4g2HJJfPfdd7tHHdUyuzFjq/dcuae9AHjcK+5Xc7y5DpmJ3R4oWZmAKG0SkiUqEmmDUBljPGIbpzU0GtICfoa35KLqL3pXHMYth92qq69+KP/xPw6//bFq7gLsUhwcRe2OU8axWCyMkZ3lOjGZh+tuhEQOZz3MiJY8qecZNBtrJ8OR9eWXzA1mBqujfCoQKCAkFGG800e8+AijMGAauVfHuIAf84e40n+BIbk1EckUwpwsZRJnGgWhsFC4UFhxB9EF8+drO/5nycLcJ1fs5itJ/d8/9jCc8b8w9rE2gTpwytJcbxCMSN4sIoVamMH0xavijQKcKMTZBT4pno23nTnw+LtPQJlXKZbSX4sBOxiz7mlnxqF3WBi3FxysDOutP6EUUstoDWKfUI0bRgbiVpjVRCV7T27/lcr5TP1nE8IzAZdid+KqtdXPlfx5VwW57oN5RNnleXhovlRERuGlGTk4Q8KnZlp2xwykZtn4b+0IEgEBP4axJ+Scmfv2HDrbRzcEhg2TeIQM5hS8YJgtowH6UAioIGCQwlOTdqulDIjHk3nwFg1DikeHbPU5WMbgQh1GYrmg/7GD2wb+/pfv2e9RxhtPPXTjO/Ne/NhH29z6/Ag3DnnvgBe4mk2nZZMyMW8gSOpqRgLwwqllvik4UvCDR17HI8Tj5TOT/aY1Qnj8t1Z2ToqwEoZFMlAhTO00RvVSuyMAGRFgrqqMRooC0RkgltDVxC8IMPLw9r8fr102q/LH3cFFbO/HDx5wwUAw60KMhcH6oFqUTXpfMDh70UgoGAxFE4zDq7KiKQASSuLB3eh5WUYpFH4MDJqNU3kCj72jhivrG4DixcRQibSj7GBF5iWXpFAm2ikkKJDI6HIikLCNJlP6IRchOS/PQxAN9PcUN11468eOvEczGu83dntq33tb0ek/Q5i4hpuVuPDDG4VaLFMGloMejYZFbTBCMlUTu1PDiUx38Kydy488arycZrLftBYAB24/Yw6uhxzFQS34bbftzK09y9jjRiSBGd1gNOEcEJ+OSyXYx5aWFwd3/LT3uN0eQDn43NvO7Kt3fgSn4MHU/P4A3w02PSokAUtLLUyLMOlFhcE0ToOZ4cceUJnPmBJPhYDtLZneKsoPy7TkHaYVZsbpRakb/EQ4WEZnQvrJn9rVLd74YaBlSBuufpoULcBblz7256P+4YXZHZf86RPH38iwidSW/z7puGJ9uDdXr2E1kljS14Y4CmI5qKTsYjN2Uw4G6FSHMpV1wzaJP9KTq22/aGX6aIjBmBq754pRUVvPERTyy2uevx8oHJ0C361DL2vUbpndRjImyU1GAhAA1mxGYahqzk1zwVDQ4++8mf1QM85o2wvevuqUJ4LOq8tebhaPtHrc1wbz8SOETcZGGngJlYNBtUujH+z4t4wtJvxkGAxTemISPakevbNQP3tlMgWcKlCs0FC3MLvkZeCb/BhfhvgGLuWckXWav4FHoaECRculZW6WETYIgLzTFlZH9s5uvXTNFcu/tTv8bPrOqcs66w98oc2tzo3qeLMR+dchPFgs2cFBvqwe8UDT2i1OGFFkM6JoK2DUUAMOgsprX5FZ/kp6p0oxMG0FAHlkaCR6Zexm8WIdyAFLxOwNnpEyBJ5MSwJrgGNm4FYucOEl24cOnlu7NRk3aT/lojsO2VKZ85Ug37UPvzzk4Xw9Jq+NKJaZtCdWxiIzC0OjHMJcpjzJuE07iB0LX6Ip8CyHiGnSKycpLNiFyRFEYmjYWaeEFqaycRCPAoVrE8qE7GVRRmoKMgufJrSLqVcxGBxc4u28+N7PvOQ/UVuy77hq442v3acY3Xtd0dvxwrDORXvsguB1JcE1Fz9hoaCVp9m5Y4FSy4OkwCEXeSnzWJMYbtHw4w4IzwXk3VK7V93wkXU3v3QWY6VK23xa4uFln7q5qx7nj+d7/5wTglzFFEKapBoLAwgsQ5Qkx9j99Y21k7aPl8U7r74x/1C58I+V/IL9MyDQLHnFK2Oln9dhyUzjaUCCt2oTDmdziEvh09TJ+jWFAtMRBhkVFmFWEYvwpLcRNPQ3wma0wJFopnhcm0A8k444kNGHMCUZk2XT8rBgXO3PhcP983Pb337X5468Fl4TMj9K4nUNrrl4ljv8wghCjN9SYOwQw44MRkl6AQk3/9ieCBKNcGunhbgYqyj7eAbCCfA0uze0fK/BTWeNjTNT3dN2BPDA+u6DcZDmEN3bJkHygU70JJzHP01lh/3CKNrFgFTBBBgjU7QQpjz+GZXiLrd8s9s7PpH/8L55rynHxb/xeJoFAokf1dDtMZTJULGUDnb2pkLQJGqjLYHTLYrmWI1kXHST1XD2kLBz+y0pGCwOWB9Jz7wkP0AlaKN1kZBulgFwGR8ChMKBf4zH58AySMswnjTkE2gZxoOKsLjZGW9bt8jf8YZ7//no/8daSsC4P7G74/oj3tgWbrmQ+/0CQnZAkAenRvCQ/GVUg7KQ1QlNNO1aZxlNEb3QFg/cHnSxgBgRF27dy1S2v3PwhrPT68JA07QUAKAJ1/dzJ0d+sV23tcioINjJUEaA8EMYZHpurbkYorq4l4pH6h5b2FP5zXjZvPw9N7UPlZzzQqeIK/A8kszysPdkrzlOM1CoGEDCqAl7o8cGU4y1J/NWBkcu5CZqMCpzorYMJSYTGQZL+qv3rnlksCVHTdxWMDev4kVQniSMcIAoxGJfleetcBy6Oxz47b6d2876w9XLf/okzO9tXfn8FbnwsX/23eF2F/jxuIdv6kdmZvGlPMAbrdz5oKlxzMiF7oSWODKi4RYwBTa2Vuv8SGv18HJwz5sRG8Wa2Wocymt9hHz12lX5cuifFnr8xh8JBQIA+8cg+2dVOTsSIBBC4p4/2YlM7Pk42OLXb/lN5iePMnysun9L+3m1sO2UAOcRyCg8mKQLfyBDMKZqkC8pndr6Gcq3zNAwOZTnv5gmDZkioVkG1j3pZ7cSk360S1xjikM9tCz0txr+PG+PnQ70zOydsa0XFp1CHfXHnjvxjbu41c5g8+cP79r2ql9/6uTdbPVJJu62lYsv7AofubYtHJwbk/Hxp4d9BMtEtOQKlKAc7OnNiAAeOjJBFBQxKbysG9Un7wsehN+R1osGcf9h8xv7vv/WDpZgJqtpeRLwqj/07F9y244MhQo4WCQB8yAJCCfR2iR8MvUzUZyXghLR4/HiDwgRJ89w3eAX471ks/y8X+3/yM6OS4JsB3ID48tuhJaJRSN5smAsylgelAJLEZvlbNgMU45KMy4Q1hyqkdA6DD4MDqwgIE7G4qbhBgPxeKOHumdlLQBLbBCEEUYCeATNKVTr6zoyIx9a27/8O+6X2HfvTsXu8Lf2f0s26vt0LoyKPOcTYsnW4V0Evjsg5WXJmwVnk4oQgJdtTRtKWWiV+rHlNRa/+yivFstwAl8cciuHl4L/+WvEv86mmYnmtBwB9NWyx9QyHXP4YQ7lKFSTw2zua4Egkkrm2kmPMfaxAqI5CiDqsNrOtQBYc0GlL1se/O2Y5MzNe2zYubjqdS9h3sKK5Fh5VotECR/OqWHa3pmm+qsfe3m7JsD62LBxTaRNpm/EgT/n70zf6B0Ji7DNyr0wV8I9XnkQGx0q7xFgDQNcVsdQP8gU4MYIIBr57qFd/a9Yd83y/3KvfzLmxyWf65adUKhu/WQuCIsxvs/ITzRK+ZADL/ZIedlkRsuoAN6qRAJIc6IaUJxKYSQGkxoFEt0QGDgIxsPQdMe4MIRpAJ4V2HzxupvPm9E7AqTiaaXiXm5VeycFfhbzc2z9cZoH6S+9iFDDmOqa3m+M74ROy1Ay7xfYPHvu4sMUO9e8Ze6D68cmfNH5vzqm4rSdXc9AWNjeHxLDxWIZhQAZin8sGkqq2hAvvPkvDE+4Nm8xRSgglEyd0DaOrNQnhQVzsQxv/QnD2mHaPOQ4b8J/bJyMLM5xDaAT5c45nWH/hsX+1g8eWdz4ltVXHrdWAO32J/a2f+vwV2Sjzd/0s5UFUZ2MiXMaEEQ+1ha42k9Zrav9xAqVwY7gHGGsM8ssWt26g6F10jTmV6qGcQvKzUXhCDsTPJXY7ows79l22xtHxZ1hDovdaVPt5Zfcvu+fagtWDeW69/OwmISXOSH3dRioI4BnV2UyA5VMLDAJzmHoH2Hsv1em7/Mbrlh2GaCzvxL1Vxf8qOdX2+f/sJzrPt7FHXsKIubOl2/ZgwooXvqRImm59BeRrGCCR9MP/pq9wLc/tkzW3UhrPMwkSJLyspCCJqMAMuAJfPE35RKMYfSOAD7TzT5VHjpFr8xHNx0c6slhEbQtKt3d1R7/+5zuwZtv+adj1iu0RinGtWy+6T3t7X3f/YdC0PeOjFvuDvgaEJiZ6ygsDBdW2VrIEXYpmcJhveEUGW5x0AhWD+utNWq61E2JwiwoAFAnrMPwAyRlp+vxnW0HvHzhit/cpxnNrN9ptwawrZY9rOoWljj4aIU+/80rsJZSrPnMG7kBiwt5orIYTqJniYv/A+gN5getuc/r7zin6vUcD4oD7ZHoGIwhNIb8Nqr2rmBRoWx427IaQSNSouGH8HHUaAHAoTAiJaoKthK4NgsG2whkMtaEC2g+yoU3R1AJzJ2xZcpZA7NmOuFPDKL52GkxKj3WlR2+7tjFtauv6z1+axMabROrzV9/U3vHpv/+Yns8dLbjVuSqsxAggeNfBSJzJ5YotsYoFpxlkfhiMREo1AjAxm9YGuHMQPGEOiIjqRPMYnZo73p52wW4KHSJ0ysNZIHMCHPaCYBynD0kzBYwScX8n8oyj7om8RcEiu2/WsbnEddtc7PV3ySfsj30NV+b3Re1vy3A0+B8U5eLUCQ8/mmRkuQNX0OzJFIrZJRgm24pvKnPqNSj6B0OBo7yg5fxJgzmpcFkMmyLsVRkfJ64w0uGtPuYrmTAaPzwZx11zDgVpz0u/bHLdf7rgCWZ//pp79HrkixHuLtTa2940/yOwZuuaA/B/Mhc3mew5RBuRGotVAPMKMHGzEy4iAbK0AQSJMhGEAiJQIJmGL0MDBpy2CkMnUK84/VbDz75P+c7zpPsWAjgafUzrQQAm3h+ru2QGCvzDr9Zb5jFEpJ1P5MWtDCYlnD0KCqy4RHjavWek4KbH/19AnClfdmJ9aBwcBTjei/6WL604+DlHRqkRMJQmEqVLCrdTX9EMzSLAGYq0MkrVApH7fbXRrNlHV1fJGRaGqYMFEaYeAvDs0yUEiHW+Dkq4OjJxwC5ENWGCkHlvs5C+O3Dlwbfuv6DJ/WtAxgtjc15d2bsPfH1E17UtfO2z7a7pZNDTIXwPWEny1N+LAgPQ3E+v4sak8OoKBSYwJWUwgSw8kaptekW1NFpvAiZdeeoJ8JR7FyhNKej/vBb4IsmnFmjgDFYNhhsUeO8a+6edcO9s3653el+ERfcksykjY7mNYz0VKuYhGEZlGn5DgAHy1m/6sxxyu964spDrkYeQmIvfN3PFj1Sn/PDsj/7RUGEhyww18xiRMLFQjuvHV2OBHUStmV22DkDH6UMEcsWZyJAk4yJi3ALS4QC0ko8/NAfPA7mg3bzuKYrLIEjt9UoHw8/kc2M3D6rPb5pn7y/5phF2x749PvPHEpk95SsG/GUV+ejP/lgMdr6hqxfWcBruWGmBqxhQsTpBdcXWCAIHikf7YaRxR92VtfWgZlKsHhqXbRN6K+eCRBjysg8RsNCKgg6TOF8z6nHHRt29hz60nmvvf1PYxJOa+e0GgH86v7SC2q12QfHWbQ0mY0trq1uqeUZNaYlQJpKaJjBg2g9zJNzYX1gfnHw5yRdAucbBPve13ZRGUIoCvDWDgIi9PxY3AYrcyFQoo0pB/2a/krUSAjF7UGbP902f/Z/4ykyAJXES3ADO1vtMzHoR7kZxJV3bL5hcbzWnwnj+323fueCzvDO/Ttqd/2488QNPNLM3v4Wgfh0fmK37+snLG975Pp/avMGTnMwqpD3WDBa4hoi6xNCU4SyVDKnJ3iMBOjDKqiNnsq4tKliKISXoIvzACgBQ3+1Ko6tu5lefPhj2wB2+aoxXw/KlRfndqw7H4HvIWYE2Az4mVYCYHvQfnwtW8SbWsoe0oqkdKgkUz2ddmU6wlEmhA3glAkxrEfPibd0/3jS3tvW2uH/izYtP6y/Fr2thheIXY8CgDutddkz59Y2iU8Fie5N0K7kpuUUzpQCGjfSCL3CiZhkB3jwn8CoJABx2KMzL44Z6GdwwJuB0s2D2d2w7sfVIS+qbCzks2uyWf/BWZ0dazLRlvv/Yv9tD3/ushUVpIwfVKgE/rTVxq+dPactPOTtHbXNl2Td4XlhwJJC6KASIaUh7HIxB3Y5FIXdBPrSX/EqDsERhaxs48LkyIln+7mYKtt5bFeggDUmzhjCfzUIEWkMijRXRoONIx7jz8S63YizEwGnJcNv7L/2qK/OPsfZ7WMuzHK6qGkjAOKVZ/mzbskfj09Z4eIHiJ4tzQafbEVuFbAgTnxlKF8fvPXqi0+vfQH5xHhsYv9v/eydeNdvXiYeBvGip+W8H72shyEA1wJ0J8CWi5QIO8fDotTdLDbCklERx04JPM6hScq494uSlMFPnPOAgeMRrNn1593aTj+qDGW8aHM+l3+8Uose6+jMP56LRjZlhx7afPeZ5w87K8BXwhKOQwF2pZThmf5wrv8XL8tXbv3YLGfr0V6MF5j5ChMqwO8N0OSjnWRMaq2ysC89VSHIVlfFIwUA1nOYBAmIeooT4kCZ2OCH4fDjaIltThgNJmcIvSUG03HkpvnKboykxcEjHGMu+uH8arSDo4B3aiokmuZq2giAU++7dGnsZI8isQihWApoctOzakoSDkHpSAAkgnl9Jhgpd7pDjcc/vtCxNrNXV/zDbH3Har6r67NHxrPe+HGGhyu4oIQV50IOvQ7GAlynrNVdP4f5iktuFu4goZNWjTIMIt0bvBCT6/S4HBv6oVevh95IHFdHSuX6zkwc1DClrnpeqXT4i/Ij33/fGVVn9amRc+pqShedARioNHBSb1LUjTdenT9u8zXH5+p7nRkNVc5uz410OxVMKzjAJ++ii7VNwQpQWRzSnuz16baKOxEiMJBeRkmoRQC/jGyhAkUKqmkioQwwjL8RA4m8m3lpW/J6GGIBM3yOzWPiuIYdncG/67vu1O/Me5Oz2pZlOpsJYmvtai5+x13nbo3nfyXwcqgTOcb2qol6gYOlZ7FCASYRsAsRMrxJtU0AlCyEzvBszpkVDdzx0kVbXnr9ZceVm5Fmhq23N85csvDwVxWivrdnnOGTM15Q4HcXeazYxQlHPtAZ4sEDijCZ+gimFTeWd+ki/sdVaD4eL/ZwxwD3Le4OwsIinBpclKnzIBIPUXEsMCZ9ErABKm1r2nlUPvDjFiflLb6DxDxkOoCOrv0CAAA5fklEQVQBpDMc7rPqj3Mv+avjVlw27dt1WowAePx39tbCqTiTjotifF9vV7Ii05Jk5MaYJTsTT2MnqCeRnjf+rFNIDtEYMwuqzjmVVSsvO47z5hmj7lh5afHgoR+e6Dv7nlMI+1+bz5RyDp7tC3gxAHjl6z9yAxP4IeOTwXjsOdbxv+DpyfAlPTTTQnrUglnDg90LLsiXy3/RHu24AteHMAQyENgQaFe2COX1uHAZh5qhyQjwY6cv5w4lDidoOIbMaV287cTnl77NrwuvZMrprMwYs7WreLxz09x65B8jq8hk2FEtrXUTooKVz3aRDlQzptXWD6YsmrELolahIVAaxIRBfaVc74y9WwFHyEtzmd6/K1euzB04cOOVncG2H86K+16XiUvYBMHRWjCkjwM1PhccwUbU8lIQtz5wuIhDbTKo9NrsuZ+CJhSy54g377p5Zz/wu5HsMddW3O4/uFm0Ly9LmbsASTvbX2jAXnyCmwKfmcvfmHx5rVjvD6A9MXLhKUcehspmShmvsu2dG1au5EcTp7WaFgJg68iCI/EcxxI2KAlutKh/+u1H0rOKn5vGaFYFBoeMssCAbaOo9PCBPeUZc3IMTOuetuP9582qb/z7bG0oF5fwaAfHPsA5T/UBS4J7HyMB+f4Abty50PpICKYGwojAahK51kk/DLMkyMTDCoszHLTfGc7a62PAfrTw3Ov7wlzXv0RBDrIBMcnMIr4psNWtQp1uwiPz2wzoJLOrloxMHE2KTgHMn4EQ452ECHUohANHzx38zNGAMK1VywsAtKNbGfH/ys105AKcKpPHInAPgI2sBIFfQwhCAJT6Rlt/mrYn0Z4FbS5puJJAAQATgoB+Lva0/UzWafPcX934wRdtm9bUkajc9i+94NS2yrZPZKMyvnwGXMjgiAt1WO4Dw5CQyJJEmzIzcIZhP4WnhHMqYLTMu42dqfTGZhZWrhoiPm7rleLZ95VnveDseW+6bZMtxs72l3+jHPfc6OWxu8BLPbhjwWE771nxvgUfBdUzBSwN3ZRPFEzMG/FEWzdNtCc085RRCuYEXCXCggAEfCUfVB65jB8nsflPR7PlBcBbr7i9o+L4J+KruDLs1G02s1lGamRPAEM0G9za2Zoq/k0cNn4iHGnpI2sH0utTAICosfoPC4gv5Le6mcO0Vxsw7y/UnrgUW4qdfPePldbntogHuAyOBR0MFE1/IByGMhnd2hYaDn+4ZWmADMrFQ5wWcl2srMTzhuL2Je+ef86tDyWRu3jFleVSsfsz9bBjkF8VBovj5CKmA2gI+fIxLZI3szb5IQ/y9GjNkYAppw2jG2libqpyKoOj5NmgfPqcDXe8NFmG6WZveQHwu63dh4w4bQfyaX32B7xVJ3ts0sKkObasKtM/WeduzWZckhlXtkEpJBAsaGXDctCZrd+/WwDTKLBrxy/OL3i102O8qgs+laG1iEvDRDKiYgDcdtgtJhmbeIC/Dr+tSTxSMwxzek6zeC2Y8cJ8XHE6P9vxtt/eNB4K571lza9wbPfn3MqXW31odV4hlgmEMDOACPMTNiUDhQIBs3zcA6I9GcfUpxkFZUAUTAfybpDNV/ou2XDH56btWkBLCwC0mdtfC19S99o6OISXz0aBIHTFn+3NgV1TyfZd0wk6ADmQsceohtAQwiEE9lz4Q4Yk2GI4/MiLFlRmxPx/61eOPilf3fohfKnY41zf5/QKQ2nykeKEeCGOoCkggU4rBBiHPa/0xgwfR4P10Q48GkyArlMN3NuD9kNwJkmgIM1ohTaMam7xB0GVYw+8RoRz/HYvXxdvAYegqNm0MK1m2WQkYPwkDuwqG2hRzZEJTx7GqGve2Xlq+z3X4ekwqeTowkwDV0sLgOtXnuWV69lTXN7+g9iWXWe0k/QmoLcGw5uGbTQwGo7kyB0Bj3tNCLfkaePQZDIlGFqIKkwzQDXZqPbLle978RZ4TGu15UsvPqI48tC1+XhgrmOO9IooZA9rtcUt3UQT8Qa7HYIrEg1DMq5NZ0yexZdbSXjAtRp2ba0Wl3x43lt/sNuLR+XFB14/7Mz+kYs0yuhsK9W2vaQMtmzkXaPlBWYIcXVreaWMUnalC8LkR0WwdAmBN5zJVbddvvY/T9tnOjZ2SwuAK35+Vkctyh/AXgn3zEQAkBBkuG5aq9GbJ1rP+lnTBo11gwwwL4UmcaHXI/F7UTnCqbvG5R+bdrqZd37jnV358sZPdzg796tjbs6FP37FSOfaxIllajWF+cnLY/3hJ0N74hBIIo4beGZbwVPPC2B5Mb/oEz0X/eG2J8Plolf/sFTLzb+iFhcGM4CPf7Q+j12T0eGgB/TYssiUQfLctfw2rqblF55ZXlxcxhHh9qjv0AWlP74ZwNlPTCvV0gIgbp83D4/ILapzywlCQD/UoX012llUYxQwptksEY41Gc2mIQw5wILeCstN+IgvPi8VhBuX9Dh3jQE37ZwH7rzlrPZ4x8sjfKSDC3TEE3tr2esHXshsY7VyeAIV0gY6tiKDcagPKIZB4SHMCzhY+Ks6s1d273/Bl5RtEzAmsC7ou+fOmtvxbTQLFFoHjMo8WAbb9gyRNjQeDG4qFUgRRoGUF8hXtaRnwbjACMGC9QVuZeZKpbdu+eKrlkrUafTT0gKgGhePDCK3JwLzs5eWHgCNQ3a1jD22rcjc4+lkfGuXZ7o4kUQa9jExpgtFt3L3r7I/2DAW7nRyr7/mtQtzpS3vzOCrvMAq8GrwSRxzyG4YTZjNDvdhWgYUjiJXmR5ZvtHn4PPe8JMHPzEED3FcOAT3+th6q9ZzDw62H/hh9/SLeWvoqaleNxopLP5COSj0cSpHsS9zfJaNTUZhwzKw/MLcbEauN9BPFe0USrKEKHa6NSziliDC+OQ7FwUhop7nVR4+06adLmbLCgAe/91ZLbys5nWiDrgIx8bGSEBOdoEClBibrUq3+Jm5Z3IuahcCyfiW+bWBSQS08XALXrIJqnHWrfxkvLf/NX7r/z5y7Vu6u0u//3xHNHBExK05MIEIVuBX8COmMpIykGUa04Oyh29oZULZr8cBLQoPOVMBGBTY3FCs1ts3lHM9b19w/i/XPV3sLTzv9vtit+PzOAQW830BNpWeAzCMjrKLMIKpHwtlBPxjfk+t5wNMGsZtaAQxDXQGax8cATl4YLZY2/K393/tNXOebjmncvyWFQAnPbpyzlC9cGKIF12kd0Zj6SEg4ViR+ZbpxUQsS6LWRAuz9Q2Tj99Mco6dvRf2/3NRdWuXU751/Jit74sLPl73jts/PCvefFbMNxXJECIwiTtlEBEGijZFH/yTgkC+bwAP+00BFahYnuWXkMBHeCEBfIc5thwm8p2SP+sTPZeuX/3MsOfGte6D/7UcdNyD60coBwvGJsUPlG1/FVwIZ10YNLrApo4c3ZAWEAHllJeKYWKYgi8LY4UJAqzoDB0zv396rQW0rADoa1+6rObm9udWDdbm0U5ka9rZwLh8goa0hCBehihot2rUVADhlmBGmQIRRIFrYu1u7Xevm7dpvU0/3cx3th34f9rrW9/hBBj6c6NdekGtJXHCxToRnjQpcKHls2jAUdOt8TistlqmZzxcg3T8qAgZzcFpvwF33p2leUc9q4vJPeesHqi4+RsAEIWCMEIBpV0bZbWMzTKjLiLQWBBoQxPa3sbNONAqACgBpMagL1JZ4BQrW87fePWpeytWWv+3JQUA2scdidqPD/xczo/wwQdIZ3ltxtVehi/wWiWCAA62K3eOGz0UGt/2UjSTPYM2OZseC0RYAMKXKnUhyHdX9/au4Jexpp1a+6+nHIC3+z6RdcoFnoV3cRCGSGmMqgyzSMUNkyjOJJpBMALIgUbr/jqcRK9svQGVAMveuhJ39+3sPPTSfd783XE/pf50EFzP7/PdUljcwvcXKHaEaVkG8q/Z8tNHXLVsakdcMw3Q8lLgwY+aMJgO6blIqC8kYwqInaCCWzmoZ+ThtyICyaTlFbHVcuqr116br1TDk+Rz36AuyH2j2fSct4LKjIRn74PD66IljOENLaSCtgQKEro5coAniAr3w7AtNDzsZWurWw5ZT6HAqK83f/i+jxSd8gF8u487KvbcvAz9gTFiijJA5IAwOOzSmyKIDA67hhORUHBIzworP0/uhhyV4XlxDCNqTns5yM29fOmFN4/7JWVJ/zR+Fl585/2VfM+/yegCZZPdBhaGB5YoBAwtsI3tFEbaG3WSUYEpsuVorYetK+uh9COdCQJz4cjfb7/62EOfRhGnbNSWFAAfX7Xg0HLgvDjm/jRRi15aV5jR86OxeLRUvNHArKAMQUmQiM1GVHJGABODYKzbmozDUYE0OIjHx3mwYlz77QGz7vkD4U43tf7TR7ypEAz/bVzD1Sf2itwDF8ZBTcWEH5ne+gneKBLIbIZ7jF8DdxQIZDw5Ww9cyheFsK8OYTCcnX9F59D9/86WmRxcuvHw/MOuHgo6fysr/SwnyhUiL9aHdWExVSsNSL4sX0I3ym4qL4VjPUw0AMNHnbE96JX29mp9H1y1alXLv6fRkgJgJNNzTD3T3s35vzApWojMK/YkRcGfjUh/tqLtkdRt/FWEJFM1yFLi4VJIjEdG8LmMVat7z6mMijgNHOuvPOnQucGWj2Wjaq4ue94UAGR4HKyyQtBwkOCXOE1ookDv1BvGEoQnOl2iHn+8pMUTmyV39o3hklf882R/hWfJG368o5Lb+6p6jEuhXG8A4/MJMfkiMIUaaUAEGE1oCCYlDlZAtfQbSSHHylEZP3YyPgVCWMNawPbXHPa/7z5JI7Tub8sJgHjlSr/u5U8JcQxUGhW4J/PLQx+Yr+mf6fXZLmx408A0OaeVxSz4jxodwM2RAolbFpEIlfEZC6dhcv70O/zzyLXXFuYFGz7Z4fQvjuvEE3bm+UEV4EAXVYkDYhQ44AjAajLQKE08E+doBzCbaLqJf/ySCT1MAcJqfijILu6dv+KLeNZn8lV08Gu/PxR33CIjE5QZNwXkc2dgW5QXvo26SMtLmZs7AygP6t2gFSsIrMkgpJfPjEMw5p2htuzw4+efhYdgJ78mew4iMdFS6tV/OmgvfLpiOXt/NhiJlaYs5JEojZuVkh4cXkqI4vOkdWVcEQIwxQ7i8aPyQCHa/tiTJm6hCHjdx5+z+ZOXFuvbz2AHz2vOGeAvwz1vQ+jCNGQA9paYVdn7/DqPBnYoEBhOHIs2TEZG47wfmmFcdam7RXwXZM5X5+z73t89V2ha9OreUtXr+GwlbC9x3YELjkIfKATLJ7SBOoofy220LgYyrpaf/tauQoP+8MMf1xlIYsRJJqqdetUTJxzwXNVnT8BtOQHwuw07Tgic3H7SiNz2QWtYRm8iDP5wiD8aXEwGUkBANdKIa/QPmZ6wRaDA7iOPfBw9cGzbo9NIAMTuSQ9/+Nxi7YmPOkFZr07gVQ0yDIfOmLHDDlwRd2AG1XBb4QqrMjwQRJRyiC2a8aFNWoYxXgYLqUOZnpUjB5/7QXfFCl2gQbLnQn25uvZnpezcL3uYbnjonPltARRO6jJq1CJSj0ytQorlt3UVAWeEA5Oqvwo7eSuAdcRzZ8W4Mq9zaOO7QU8tx0cW9y1VcNJTOew8pe7neQlc6JE/wuBoJTsXJRPTn4zMP1ESDzZu+VEQwJ3U7AUYlzcKOTmQnQTE8TBf6M5Gq77+2bNLCqj1fzd8bvn+neUnevHBzyx3+zwspsqRV9Cxns/jUJ539IHJXTQZxjADGySh7ZYbvBCH6EUb4Lpu2e1+0J93xAfmr+h9Tob+yRbp7YU88wvfqMX5koNRDQ8d6aMltkwaW5hayq6Mz/KS2WU0MLbO1h+mh5GnTxLCq0F8BTlXH3z9Y1cce1yyDK1kbykBcNnn7igEQduR3N1BSwmDc1gm35YnQ6MV9TPbysbovOHW5mAoosoP5/jiAAyyvCoKAOn7hMA9nClgLC+sBV3FcPrc/uuNvcLgpgvanOqiMADu8BEVDu/leKwIRTC+CEPUXtzAXMMEQsROjFEAC4bELvgkY8AVcpEF/9xRL7tt5YHcog92//0PH2GqPaGG9zp2TTnbeSsvCvEYB3fyrTAjvchcHmZTkMEXdZbtStSJ9qRu+gMWwlg3ChZ2/Hl3uKNY7X/XGjyYuifqNtl5tJQA+J+N9bkYTS4EU6IlUHRoy8u0KGOPj6KxYSRd0rIq9P3cSsR5f3w6CwuKOPTBBsbpv1xQe7ha3TZttv82uwe+urM++PYAPZgnj2BS6FEJRmA3f0BOY6pk8QTT+o01dcpE9mcktA1HE3HBGYrmf/HL5f/9nmSxh36WnvPVSsnruCoIYjxYTobXcosFoz+ODO1CcKMett67MUW48dMsgMcr6JwOOPW601nrf9WcBz/78j1UvUnNpqUEwMaR4kGYXi7gMEyZF0zPP2H+8fFCsh7F/JawZRqghEGSl89KydAWjcoWxuEfCpeOTPVn98976Y7xobeW75ZPHPaSWcH2q/JOpc3Ft/C4ry1bX6wyqFsWvBK9n/jRzV6RuAFapGc0butve0sOq+WRUF6gwRy8GhfurHUd8AkOy/c0ph6s7PWLstP2dTK75k5SF2pAXTjFY32oUSnSwlPUfAJd8QLcAQ5nlHhBON82svFDm/7znHl7up7PNr+WEgCDJe+kwC0UuK3DpuTrPGRVleIJVLDRGWCYnCbd7A1EWDCMysQjDVDzNiEJI5IeLOfko1LQkeXtPxnZSpJW/Xnk06fsVSxtvRp98vN4ucUD53Otw2BFFu7kQUwyBdkV+LBML1tllkGIJ4ZDM74s+gkC4SZz4HFGvB3mVKPM8FC282OLL7upH7H3uDq1d3Uw2LXXZ0bC4maZkUgDo3yoHwWV1gHlt3VA/aQuY0wlMCRDetKQT7wZHPBocA045PuBeDvhWGfDXWdLBnu8ts88w5YRANdcc00WD3IezzvkeJ4BrIxW4BAsoexwjl60j6cgAkQISMXNtIHCxH60U9uWH6XC6n9Q3jC3GN49HpxW8otxYq1ncF1vZzhwFM40gZAxxREhZ3AEw/bmwuz0Fj/6q7bMIdRvwoU5DDNZvJLBalHR2el0/dv83vU/+XPiaZ93P/Cn4dzcawNcPGKRURPVoA1bTyk3/ZN1Yp3NX8Of9aQQQJfPMxJ6tkHfoaAg9TB1bC9tPnftZ17bUqOAlhEA//Hg/kux7LeMzRjy+/YQ4/IIJD1EaRPTSt63w34rCKxwoKmXghAHjSqELV2CDv15+YPUgHNk/Fz0XXd89vg+Ad/CP323XPLXxWDnuVy15rCf83P2inwiS573ll4PQ1q7QwK3DJuJUqsNo2uPCQfiiDZbfjp6QLpsBr1i/lf1jmVXAMNM/WdVwdznfbGcaVvr45PJUmSpq7Y7CUXoggH8F3qwZmJEQIIy4Rw5hNxeBIXwjklW4BF3Dq8LHzS79EBLfUykZQTA9m3tL6n42fnc6uPjHFTspxsEyqEYh3fQlvmtOZoCWWXTE8BEM4KQkRY3CjmC5dw/A3cUluNswfsZ2r2l1fqPn7YwX3r8vTmcwFfBR2JVYce6CYsCZ5wKJDVF4IQKxE5kcXVcGIOAiHcv75SczrXDXQsv3eeDv3jWt/wmzP9pBOxz8eqN1eKiK0KnDdKP9xBRTrQvW17rT7uuCcjVZtTDZ12SGnW1bibKQYj65Hh2FkAl0xFfGbeeyVS2X7TmX3s7nkYR/6xR2epTXgHn7nDNOz1wOyF0gWrMufRLPQgR6QyT/jDYnGwkEjuDyOw2irqb1bWjApK6EAR2AmJc/eUNwJxb3TS36P5CoTXTtJKNW1NtA/dd2RkPvzjkBzSID9ItLDqkVzcD2PurHyIwnvjBoBOafg27+BG/ilsOHIjDWtTWX87sff7Cj6yZUm8mDu911jdwm+Mufp49gzk8PwNaxyIl9nxIKKgXcSPEgkqaURHrP45mXfkFZL6WFHL0Y5Lx3EiEtZVcVDlt7+3ffiMCiJIpr1riNtNp7/n9vNJmbzlHr8C+EJuOUdFzT4Bi255jgzmCGFdBkkd8Yhbws+jJCrFz1z3dNz3WEq04boUcZ87vL79wljNwlluvinAkSUp9RqFAMaj1tHYl/uQIivhkHMEr4ZA52P1ByToBesnAy39ny+Ef/u2alfehB5znDG3u8xZ0DqCT6ZZ4/PFyeberVo0HYI/agWWHGyw90Gr2GKtuu9jNlx6nu6OCuLOdfvzNxp8Dc2AYpxg79sZHfMpxWMVHw4pOxOPACByllp7TW9n8kf1+XAh3HB/jAVIKeQ7feUZAUNGoGzoR1g2pKdysaggH65Ew+fVoEY6AgX/cESi58c5NF235+Eu/u+BDzpR/Or4lBMDjw5UXlN2OfSK8HSur1xyy89FGNJ+aptXQACLNEw001srGTBI2w4WoMQWQ++OgZjfCt2nyePq7t3cUq4yFNZXdW3qPPK57+JHLc27N4yKYfHbLSAAZ9o8pPGothC8/qLWQP4maVC1KGYK/FLv0pyYsH0wQVT2nNDj0ynk3XHhMmx+EtfwsZ1GMLjGuZzBTcLGggkeGcEHHx+Fq+M4VdgEIAQA4bE9829HORBaQMrHNI0syJlO2295YuEDnLQXMIlEV6TNOEOWyxdxQx9JvoFSf0lJJoRs/9YXP/3ppw/Y3tzuVgwMUwJdtUDQ5vyfZqCOim7prbZv1F+yM9US1Gl4oG09UhmEWS9TlZfmB+89B6imxDtJAwjiWKS8ASGN7l2oneV4hjxfggFOyPdufsxdIcTYYWsE2hQxT2SpCOawxh6lsYWX8sczPGGzFGOc7OTeMcXzUdwZ3dLeVbpOwFvxZ/7GXLy0M/v7KnDs8G4/wQUhmUS/cY1c0jFMjsj8DiQiaVo11Mwb9EI54bAHBJz4RXh8MnUKptDgXjyzOgarawxEEYljMM/l8C4CDBQgASAtlcnIdAZCZ2aDanBrOOGjIGCuVAp9houHPuFSIkwctdKKCEQTcSH3erdko+D4yTVZA4+J38QU/fKLvQ/telQtK/4I5viz4sPPgYigVxzNMiRwMCmhTZWmL9WZ5GNeqxoASicWXeEHSfHXnBX0fO/q78y53HrRxp6JJtE5pdcL7vt8xEsw63avzKzAgJvxx7Ymr9KQGIt3O1eQ0GpCvDUbGp9YGbdq5C8DvwOu8T9NSitTBIFwiwpaRFz14RNfaKd1wEzZab+z1DDzwka5w54sDzPvl1hrP+gNTdiFLTC5siUbVgSPVhgmwfsI1FSFuMpzRNr0KVOIWbYHjxLUhHMwq8YtJWAcAzvFYi1Ov1vGZL2QvvSImCzgbwLVHPqgR4Q3/kF8akj14tAPbQtoE8WCGMsdGOyFehKPKVod1vsyMXhY6qAMYYIaYXvTHi6/pazv+jDnn3nbfhHhBDR+ac+zXhr2Om3hdWSUPygAC4Z8lFNkVEaJBFHhbf4lnykk/XS/RdA076s87FLxfUXBq+3pD297fO8UfDZnyAmCg3HFoNXKWBebpb9Kmzj/RiBxbguDgI+1Ek9t49FLG1gZGBFFsV8axGu2pi4Uw+eUfbOrgnXqsMbjBumt7z3nqb9QL9Knx0z+0+DScTPs/fC3JJ6GSi7FrwkcuUcmGBnvJQqqGKyELEiUN6kI844eCQRkBeJPkhKl+Ho4T1/ERrzqu+MjoScb6DNPVAURXGDRlqAYfmPyjyVEJoCGUEWCyfNIofNADeYu4p8inxMdQASMI/ZAHVuphr7g9W3Zm9r9s+EWXv2v/86/fqYAm/j3usuvL5dxeV1XiTMWVBQDmgXyJGwoFLZbQlJwgZEVZDhiiEVtxATeLzKwQJghhWrMlKtNUpM3Vdv7NO355wRGMNlXVlBYAxPvQYHwsXqppw7ot8Ewsm0YTLtcGEbpmQ7A5YVJPpDRM42kcaUZpaDIFd7ExT/y9Qp4IytT0f+L9J+zrlkc+jdd9OiMSIwdJxAfQJqf0iBfjJrGLtm6DT42H2ks4ExCrqgW3IkjUN8Spv+owe2miD6wMhub6AIfJTCO75TZPMYlVhlhl3CyD8VdGk5Zka6owh8melecWvEwedSnEw2Hnj/ra93v1nHfdfeXSU5/6S02LXvbFVdVc5/ccH3A4lOTUxJTR5ko38UBZJOVC2RqjHykVS8Z6kI7Uri7Wm3UCJUF3ONXOQrn8CngweEqqKS0AnJUrvVKl8wTXL7JFgFf2PmwtJcgkRtWbhIJwS6TSsGxNxGQE+LNnodmQ6nBS2rO35OUOPywNLenJrU7CbgX7yt7eXPvg2v/b7ZZewKGyHPgRxkfp2buRBgUPcCuypFq0iiZuxK44lqhIZ/Gt+DdtQOGA3r/CoT+G4T7m+bKYB6nBpRdqmdszK6PFAjv5Q15vop3KNoSJwEV1ahImmYwLduRRZILbvVjmd7r66u37v39Lxxv/Zt933PG0txvdU08Nyh2Lr6wEuZ2+LPyCZVkfFpQGTE4E1UEP9bN4UsEIf8GtCbTpiWPSFyLLq8q8tBaMvGHDP/3lIgU49X6ntAA4+KdtS6pO4XgiXxaDiD/bEo2GIZmQjgwB027cOozTMKUzCAg2DtJKIxEuNf4oyXmBJZ8Jfvumvzy6pW7/rcSzVC/Z/q3/W/QH3+SA6CgEdTiKegqhoro0iTPjtoRsezYREAizbplaESciOIgw4gmK+ALjVIYip46dOV611V4Q+Cc1MRJMEQQw6ScgmJQFsEqAwSGNpfE1A/Xi4iG/zsNbdxmsqg1H7VsGsvt+dKD7wBM7LvvjZw+8+AvPeIq28B/vuisMMl8RhHDMQokDJZ0DiwidLCvtVtupgZ5ERVkRV1KjrIJfk15oDOsX7eHQoYXtD73bwdqMZDLFfqZkoSyOBke6D6653sLYnvwjhjkuwyIRF41IzaSfRmNJL9ZsLNtojUU/xhXNXwprzkHZq3FnAXNM5FOMy7+4+HT3GROXAN7DP6fe9oIVs+sDl2KXBO9WGhzBILOTgfmYpXyMg1MCdKfyVBd6d87bRUBgumBv9FlT42l66YIFBmfluItRxiMfg8A9en8VvNoOwtOgfP2mIvK3TD4GH4r9MZ5wSnSW2zATXxKKMPob9OasLHUueXnP++//6LwLf4XFWWGvXQE8VR8UcJvfc0MpLlYo9JVxmTEAoJ7cGRBBKHWGnSb9jMk4ds1A7SYcNaBAZD2kLoyPNxY7awNv2RQev/ypFm9PxpvSAiBbzCzF3jFwqUxN9OofUCSNRJOtRkNNaURYtVGNP4PELyEczFBNe0QQMIguG42U291yS23/PfHZV88t1Dd8pM0ZzPG7KMLQwJLBBlGjxJj0sMgRpDBch/pWYFpcKkOahORm7MKE2PIbwZYfTv0AMsIwbaL4JNNKTowGTR4ZT9n1ARnRMQnBSxYss8JgW/CjobjTv7E/t9/7Bl/+D29Z8N57MSp7loyfKNBNy953F74l8H0HAoC5WkWXCEHjYXGiZURRLTpg2rCmqeEUhyQvwQGmSnmn3JMZ3nTxKtxms/lMFXPKCoC41/Gqcf35vHih8yqijNhXQkk2GltF3DTZQhgdyIIR7CLNJZWSj5CQYX5pTY4ioLn7X8xED55+2Nx7mVNrKJxr2/DHt+X98iERDi95PCoJ5lE24ukb2IADORY9wehIUEpiZnhCK24oGBimGkclnfIQtrnwyXAhHIYlESVCAB6jPNXJMnHAIfN5pmE5wQ9cNgxw9oIQZXqWwbeJnM7SkDvnK4PdB5224PI/fnbxcZeVmWQy1fnnn1/PzJ3/Obz3PCi7DDIykmKhzioQbT0sben6EUoBfCgdqV04HX6ytYxEmt7gDqMkfAzBKQbbXnPoPx538mTWYTJgTVkBsGLnV7or1eg4nq9WhJO5WWWDWBK3rDbRp6lJsbbBlHpVKNi5mw1vpiF1Iw7mmgXf+8WVO184OBmI3RMwHr5o2d90DO14f7YaYsGf+IAwAxOLFq4lU6N6WkWLDngQX/pHB/HaxIfaGSfGPjz36i2zlrDoVx3R1Xj2+oJn/CAGFPKSRApJfiWCgQ1KU6GMwiBDPtbJclEqZCiwMU8JvXwN3w24oa+w35ldR25++8L3/Ab7+trqksUk/8z60F13lbzu/+D0z0dHA0wAR6wNCgY8EmEUo6wWNavTGOmIS2oJX6QTN6y0Ma4IOE3L9xdwMKq9sP3Rf1j3qfNmMdZUUVNWAPx2y15HVOvFZZS6MlcHkYgEJrOS8WHauX3StIi1wzJ7sMO6mc4ePGn0eJJomNT901Z5/OOxC488eq+hDV/IR8PdMYblXoBFM672k9lJjOyNqWGXPyHihL8ham53ASVC2NJz0S0aSYlrwPOw6FfHJ1FGdnLVn/4SJFjjjyz44Yd/4qYNbmbRHOrrqTsewgtjnExkIM7kZ+RrGzns6Xff2Z9f/Ib7z/rR65b80z0/d1Zwo/45VlgL2NJz0GdLYe4hFATlxQRA9vJ1SkM8Woa3vbpUHsVSQaEuVoUCQ0QVBUdCxxDNvLiGl8Oc9qD/L3se/8XrnuNaPS3wU1IAAIX4lNzsYwJ/du7/t3cmQHYU5x2fece+Y99eOleClWxQLFTYYCFZNrHlWCXsOKhKNgapXCVIUqkUlwk4rnAodlyLSRUuh3IRzGHJhR0cg4lESIzlMpbLDhQ2AWJBQJFkYYLuPbTS3m/fvnlvZvL/fz399rGIJCje3UH5Wpo3PX3MTv/66+6vj+khQEi2KfwES08cIl2Tz0y6kebIn5li4tTCvwEP/XgT1PNB6bU5yQPviNH/o5vXzm4tHf16zvHnY10cWlNu6Y1WFKvy+M8MYpET7XBhEmF4tl0i8pAWmH4o5DLAxTOu7SHMUBkE6O+Pod/Pwp9Ai82hwFMb3mzCSPWDnwCDeR6W67JCMt9pRB8f6n8Cy3lHU82HB/Lv/sLxJZ+9dN6drz22cuVKjmRMmzmv86ddXnb+Az5mAvhs1EjkdTPIBZlQPmzDY2SLbmTEyhR2hiE3/JNrutUdlL8Ux0mo6aBOS1ZLV8Tpk2JvlZNIxcyZ7du2pcfK4WpZO25Xs+BxqGLWWnI+Hgtv3SGCXoNPP5NRxr0+rBFyyShkHKaYnbas89zL4z+MxTvs/x35TqxeyfS9tLkpHPoI60Mp8iikrCSpVnPqTFotEVArlPRnRRBViFELJddSqTLcxCFIRfipDWCdPRb7lMao8lNcEM6Ak8eUFv6UD8xwxnCNZSpaycnwSawZrrqZYMiZ++RQy3vWz/7q3rsXX/+AffXPRpu289ji5Q+Vw8wuzl6QHSYejewgnYYRUs1CDt4cL7DqvVSwQoVsT31wjAN3kUoAWcRvCay6cOfmD05b4v6HPxTLCuCLP8yfO+6nVvAbbELdFnIkxlYAMuBC98hYd56tn7gBf33FUavNEY+Fh7/p0Avb8t6T7vbtU6922gc+zfN11yxd31T1rke7j0cvodXHCZ/dktUz5CGFG5zgbbo4+EPEJIepHIwf3BDGFHzrb+JYd26SMg7Vf4QLfjCNTUGWhbwR9zcXfhBlPRL9w10jw8IBUUs3OEOZwshguuXxoYaFm/Yu2fSZs+944WU8/ERG2ijTeO74wvb+kdTsLdUKCz5aaaaUS49ZeFGwDT6mbaK4MI00Vu5gidjjXGdnoZfRErjxjcy0P9TsnDh6W9eWzrzcYIZ/kOL4mbKX/ajvFLD7L1oKgmbrFAGnZJt3RPnczByTEbxiZojhOWqAjJMNY87cyUYyFuv++QW5RDj2eiE5+rSJHN/fg59fvSA7sPfLGcfLye4+Sa5g5Pp4blFNtRoFFDJqMVgGhgl+yQSHVHxAYdhZNjLcJZHpwtbe81xnaBBLsDGSLZOxZM8+BAyvJ4wp4HQzRRl3xkPYICnUCj5U/mG3bdd466Jb2u98/imUJhSNVyduMcO2wdySH2VHT+5vSVSWcnMPpl8qyhpMpknISdpqj2tgEaY5eJK0s7KF+g8gUimiG8T4eHPZKfgDl7p7tm9A0Idq95khy0SVNkMPMPnPhts2JCuV9EdDPwNY8GUGkCAPGkoYO6NspphDaPFE6GpneDGO5B7DIKy1M5fQD5OVclwGigGoFDKlyS39+IX71sV68wb2G/Mjh76Sd8aX8404qqZJ9PmROIgqkiUSKJdwYvpxiDZg+JhCj/DSXcCZwii1BZEijLib+/CuPvr9Q4OogKlhiBCjHWM4IkRc+zEWHw4+Sj6XAkPEOYwGrgzE9pPv/+ewRUZz12Bq/pdOLly1rv2rL/wcN0TGxMuc97Wd3SO5OQ9U8Lx4+hpCihk/mcaxSr59KKIXiR/nNGXNAKf6yI9McVDbocjZa2YFNxN1OU2LOOmwnEgP9ty0p3PDrJmmEDsNYM1TfzzX85yVQboC3qRYZ0jSGrEDeJ2paQD1zkKfDojLQo/pnir0ZjfEWBP8QuRu3m14GvVL3c3rbhoT6/seueHKgjf0R0HCiwohpSp6uOjJeTKIrId9+FMnTdDwNoKHg4n2Rkn0+UOnjOnFJDXhOsM4PjcWQK3DyhO7bMGKfEI4WRuEe1ETQPXtFN2sN5qe+1Al2fyNjq2vYH2F/QN1N4yN1Q1HWy77XvPx4pXNobeS05+cQZKEIj3s7lCV50ChbeHrH70me5EjtSujLyAyOIk/ki9tEX4akuPL5x5/5Sp43jOTXGKnARzsdt5fclPvCrD5h7QqKLTSoLCFh5yxFbKtvrRIAA7ElEfxs26SD5KBsEkc+nNIBpLKvhw0AYgvV2ntbhxznpHwMf3pu3n1RY2lvtszfjGdrJqKi31LCpNpeZhGc7CICSfhhVa5ds30R4fEw4VoCAYPPeECVFT9k04R8/3kWl8tsqIQdJRpeGHuAZY0WkjusAOa0Chy6Dsnwky55LQ8N5xo/5P2joPXdmzdvdv8Zd4wvmbZnf900svM+fq4m6+IHMmUINOKBUvgwnUMrOukXYrY8Zp7LhjZjPgiGCcxJRzORutiONpx4I5pH8udxk/c0NX58Q66zJSJVQUAvi6+Jbeukso0iHASpLTawAM7RVTKNOy8FgMHeS8gupRTJPwShnbeBx48QizzTwT47l/Aff8qY4uawlv/44kPxVb9773uknNS3fv/LpsYXET9k+l/QyXHwgihsocVsHochCUt0Bu4GR4Mx3tSnvnmDgfCBvo9p4zVfnSiqQ324W+xEkhzTACF3cdFBeuPq9CiOA455marg+7cH400v+vTB5Zt+vjC773+sNMpxcDc6B3we+jCGx8byrT9g4PPwrFwmFeaOY2H0ouXe8w7KPAQXpHsESCvWbglLyJydCd7wLU9URPOhM8GI0uyvftu2xZyuevMmFhVAJs272gtV1OrAwwYcYMOSiXVMBnVp4TaA9Jey4iIW70KRrtcSzNp7Lxm+89VcomgDPW1itVZpb/fs+gDP5kZ9P+Lv4o3yFKj+/+qNeh/n4eXStjV5G42rNCMAOJEJpON9ENZM9Cfh7FLSbds6u5BVVWmD4O0M4x+f6kET0ShQfUp0cyV+eXQA9XhBty8EfdL499w2HKkPzf7z356xbWfmf3g/ifP77x/yr8EXP9Mvy37SiwRLufn3D3sNg256P8Ia8gRB11ZuHkt8oVrM6NkxJKkakdk5YkyywpbIEYVBMdQhCsGBHMjwxvWXP3+c39bz/927xOrCuBfXyu8d7ya+h1+e50tv3yLHfPHVGP5oBynltacAo5rKeRvlWKBzkASMMoAXGDTRu4Mmwz7di/Ml/86ziv/uo9dsDrnj17OmRB+kjoh01SmIpNkS9psGiedSUg4kVlUmiWSKdtsya2hcHPgahTr/IujaO1kbX4UgH8DJjoJd8DD2gl8nwkj28OJxoHezIJ7BueuuOTch498c+PGTszdvrPNd5p2vTTu5B7hzIWRH55QSRJJHTebSjpR3GxYuteu4Wnl1NYDzBc2YNy0JVt15uTKI3+AUKe4M+80tSZWFcDwcPjhIFnIc/UfP7wgH2qINAESJaHaQeCAyK2v+KELOdOOw+hbEHy0aOzno9mUmEnmIGt1v3yy0Rm66ZWH1xydWrynf/fXb1o7v3mg666cP9LE/qRZ5Yd2F3Ii/XoUWBZaOdgyRYctqRNCh5aKjvjP+8hINjhQGMlShBKjduOY8hsYxsZrqGE5GEhuRGwCUItiY8YFLY6Th2/g5oKTqbZtJ+e95xOLHzv0+WXf+ll85vT43P8Hw4+ZjjY2PTAWZIYcaqNIN/mSOzlIWQVD6dxwpgqqmWELO8PBTz4uAruobZQ7dpuQX/ZT46LJwS3Eq0+hP3jNwb+8qh2hp93EpgIAWMrcCr6YQSwUYBmFpaoFe/1hKcmgFC6kT4yMMdoByjgyJckXWbBQBttUYqTaFJoAo9fYJrs8P536i74nPvWUvU/czr+69ZKWpu499+TD8ZUBKjROH0lXSLo+kL9I/aydIaAimDYhvBBB5dkexkrhZX3Iw1QamKOvppyTg77jccoPwblfXkCIMKwz2IVIoyJO4XsJg8nWYn+y7fv9hY4rHu/47B+e9+2X8O1ExjqzzK7er+ytJnM7MFyPWQ2MB0AjZXmWBoiMYJfuFfGiJbeYyV1k1fozknWLMon+jMCvXAfYQTQbesvyx5+7cSY2DYnNNODG27c1homGJdwVFiIqlSywCj2eKWK8IjieOTDF/ry48ZpZwlwRg8JPHwgtR6Y5wuI1sANRrmbCgc6jF/zyu+7jtahRnJic0O8/Z+/Zt7YEJzaaSo/PZVJp02qe1CYWbCIr/aUoWocJIIYbCj8N5/VpjBwmnJFRtENFEBPVn5UD1xhAQFFDBBjVT8K9Au+ik9tRanv33Rdetutp87LOGdPoC4/6n43bN/pd1yy/e6xUXJcPS63UvDB0LNA4GyDsWIla9pGd7uImAYSy3FaCwY95Sn+RT2YDtIIUPtxSKHZffah/xWOLHWdX/XNMtT02GkDXsTmLq0Gqw6rvBhCJUe3lmcKNHxgDU0LAnZlBuznzOnDTcrBS8LHhQzXZgO+5lcp4JfNLf778l1+L8wc/unYvXV/wBm+U7aUl7Uw3Ei3pN3ZeS+sNoaRgynXkLzUnW51Jh6xCk7DkJFgRKOmMoMfejRchGY+tAef4PVgY3cVIeEMyjW5B429GCguud5deueHC77/482l5Uw9/f6bNwi0vvojPiz9sti/naks0IlTnI7ay8pH2KB8gdPCDNhYdkhfwY96Zg+DBXzQ4DrwyP3EDrLbKecVZ2eNdN3F7t+lMd2w0gMPdpVXlsG2W42KhC3ZRYY9ASjo0AlaZplaFyGLgSWDCQQo9aQlg5gSsDIsRfnmxA2HdZNZJVQd6F2RGbztwwdrvxnnQr++W9U2Z3/xiczrhNaLWwpw7EwZthiWWRiAYq7QkBgQTHXVQ6UcqkbEWeNPIKboX98GrYEB0eKjsJNH/R0OEwo+xF5xzCMn340t+4bDXlP9OsPCcb5+/9ZkjuIO9o7nhGf+LXSLaLr63v2f88qbUaHsKBZt9ePkuJdLOsiuFnyceEdvatCncjN1kgOQZ5RbhJCrkk3shcDqV3dRMMHbZxf+y6kFEexrHtJhYaADbsPzXqzZ+wnfx8R+s0OOySfmKBKjyAVnU+b8mwASN6tO2fBKG/nBnt4A9V5mcwnxVi9+zc26q+1MHHl/7UJwLP5f6uq/vvqUxHFvJLdB9jLLLwhOmSRjgh+muHaAiUmRadNsqGTeGRSweiC1agljJRtBhSXrC6cf7/eNl3AeVwTgqG44LZKr4yLUze19Pw/wv97actXbZjmO3n7/1F4dJVyL/P/tZeO+z+8daO+6qpnIgRgQRhshay5s6LswiE4yFvc6DzpEDZToRLTRCbwuVcdJpCcqFwuCxm1/+m6sa3xhr6q5iUQFs3XH1WdVK9iPyAQtqQKBKsDLazck/jp7yzOrACjbBQmBNJWAKCVVafKAe8TKY4x8+Oitx/JZLFvmXH/3Bp5/H/SZlxdRBPZ07n3//DVc2lQZuhUqId6C4TRYLNitCcmDKySEqzFHBhghRjHBQnWTLRD44ZPGU4UV2XP7s4rVeru2TOXxoWMcx399XxBd2AKYB03pZCGDRb/7PnvS8L544e8Xai3527I7ffWLPa4bw6aToTInjhtnlH9vipVqedVINIn/1A6gyE4A8MhUw8gdaAvNJ5DSST1s5m0FXE5bhRMFDWC6npryzRm+sjnyy5fArv8/L6TCx6AL0VioXjSX8BX6Ir9jiH18wIRLWkuAkaoBRmuqQoCaVddlQnwJ8+w5ijH/c17/UU0h7j3Rker/1q3+8Yj+zoi5WLK17r1353mz3gTsa3KE0NveRqTY+NR/cLoSUK7IQd1vsRWxqaeJVYGrNyC3yj+JRcMm1iFH/PnT+uTtPAz60UUqlT47nmr/pzlu25YOP7oSqfyiKrycSmPe5+0d7/nTZvZXS4IfweXF87BRAkQ/Sh5dcoqTSmO5XRD1yMYVb/BmtpgHILUS2keWIicoYwp72i8nCiRPrMSPwz9OxinLGKwCAcc867q4J3GxSvmALdVQGVyCo7PNKNSD06vq2ghY+VFvDEtTWoeGcm9vXnHJ2tjYPP/ri9kv3kXV9RkiUGP4c2XDxrMKRw/c0JcfOZgecVZmIBtcwYBcd9NSNpNjE8FyTJthr14wHHYiF3IalAxhKeDQ/MqaAee0h3LKYzHteIvOqV2h9wsu3P/p7P3g25i/rMDEzaJau21F86cHnW93Kh7kdOltr0yWg1snreuh8TmQS80mckSmSZ9G1tVM7kwAIxHDU+LzAyVRGLu8+uOq+BY7ztj98gru8LTPjFcDtWHXR/m/je7Juz99WMHInym4CyyjwaWiqs9g1SjR/TuzRoMyjqy/fjfUrftCfSWV+nS6P/HrNB149eF/n54rg+KaseFtEpjkw9iFflB2p/Hufk3k5TDdxxh9aO/bJDTIYzkgh8ZiAo8Ev0i4KPXoIolXKlQyGwJfbp4Map/AYLkqGsKOS5GPlSRhUk6Uw53Y3pA8Gc1pf6Gkp7Nv0yDODkD6EF0mNoulpMoH2m+8qvnrdijv9od5Pur5XqXKcSgwaLCtxlFUaqYRNU49MYSnnWIBIruSjuOCH/S/mKwe2aYNkI/+pJaS9cqmVjlNtYpHrYScq0z2nIYHbpYdghX2qWU3x/a0U1f8ZFsxTuTOM9JPqA8Nuw1o/ez0p2CnjTg6j128m8FY83xzy9Fxsftv8O727aCwloASUgBJQAkpACSgBJaAElIASUAJKQAkoASWgBJSAElACSkAJKAEloASUgBJQAkpACSgBJaAElIASUAJKQAkoASWgBJSAElACSkAJKAEloASUgBJQAkpACSgBJaAElIASUAJKQAkoASWgBJSAElACSkAJKAEloASUgBJQAkpACSgBJaAElIASUAJKQAkoASWgBJSAElACSkAJKAEloASUgBJQAkpACSgBJaAElIASUAJKQAkoASWgBJSAElACSkAJKAEloASUgBJQAkpACSgBJaAElIASUAJKQAkoASWgBJSAElACSkAJKAEloASUgBJQAkpACSgBJaAElIASUAJKQAkoASWgBJSAElACSkAJKAEloASUgBJQAkpACSgBJaAElIASUAJKQAkoASWgBJSAElACSkAJKAEloASUgBJQAkpACSgBJaAElIASUAJnAoH/AsMO3td8p9ZDAAAAAElFTkSuQmCC';
/* ======================= akhir konfigurasi ======================= */

/* ================= util ================= */
const $ = s => document.querySelector(s);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const rnd = a => a[Math.floor(Math.random() * a.length)];
const rand = (a, b) => a + Math.random() * (b - a);
function hash(s){ let h = 2166136261; for (const c of String(s)){ h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return Math.abs(h); }
function pretty(n){ if (!n) return 'Sub agent'; n = String(n); const i = n.indexOf('/'); if (i > 0) return pretty(n.slice(i + 1)); return n.replace(/^.*:/, '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/\b\w/g, c => c.toUpperCase()); }
function short(s, n){ s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; }
function esc(s){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c])); }
// lookup objek konfigurasi dengan nama dari luar (agent/event): hanya milik sendiri, bukan prototype (constructor, __proto__, …)
const milik = (o, k) => Object.hasOwn(o, k) ? o[k] : undefined;
function hhmmss(ts){ return new Date(ts).toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit', second:'2-digit'}); }
function shuffle(a){ for (let i = a.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function weighted(items, ws){ let s = 0; for (const w of ws) s += w; let r = Math.random() * s; for (let i = 0; i < items.length; i++){ r -= ws[i]; if (r <= 0) return items[i]; } return items[items.length - 1]; }
const freeOf = list => { const f = (list || []).filter(s => !s.occupant); return f.length ? rnd(f) : null; };
function divKey(name){ return String(name || '').replace(/^.*[:/]/, '').replace(/^divisi[-_ ]*/i, '').toLowerCase(); }
const isDivName = name => /^(.*[:/])?divisi[-_ ]/i.test(String(name || ''));

document.getElementById('favicon').href = LOGO_DATA;
for (const im of document.querySelectorAll('img[data-logo]')) im.src = LOGO_DATA;

/* ================= pengaturan (disimpan di localStorage) ================= */
// Semua baca/tulis dibungkus try/catch: bila penyimpanan diblokir, halaman tetap jalan dengan nilai bawaan.
// Kunci baru (v2): pengaturan lama dibaca sekali, kecuali Suasana (bawaan baru = Otomatis ikut jam).
const KUNCI_SET = 'padev-kantor3d:pengaturan:v2', KUNCI_SET_LAMA = 'padev-kantor3d:pengaturan';
// HP / tablet kecil (layar sentuh, sisi pendek ≤ 820px CSS): bawaan ringan (Hemat, tanpa bayangan, luar Sederhana).
// Hanya bawaan: setelan yang pernah disimpan pengguna selalu menang; laptop Standar (HD membuat laptop panas).
// fps = batas gambar per detik; diam = turun ke FPS_DIAM bila tidak ada yang bekerja & kamera tidak disentuh (hemat suhu/baterai).
const HP_KECIL = (() => {
  try { return matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) <= 820; }
  catch (e){ return false; }
})();
const BAWAAN = {kualitas:HP_KECIL ? 'hemat' : 'standar', bayangan:!HP_KECIL, label:'semua', bubble:true, labelRuang:true, putar:false, kecepatan:1, fov:45, gerak:'sistem', pad:null,
  lingkungan:HP_KECIL ? 'sederhana' : 'lengkap', suasana:'otomatis', fps:'30', diam:true};
const PILIHAN = {kualitas:['desain', 'hemat', 'standar', 'hd', 'ultra'], label:['semua', 'aktif', 'sembunyi'], gerak:['sistem', 'nyala', 'mati'],
  lingkungan:['lengkap', 'sederhana', 'mati'], suasana:['otomatis', 'siang', 'sore', 'malam'], fps:['30', '60', 'maks']};
let SET_GAGAL = false;
function muatSet(){
  const s = {...BAWAAN};
  let d = null, lama = false;
  try {
    d = JSON.parse(localStorage.getItem(KUNCI_SET) || 'null');
    if (!d){ d = JSON.parse(localStorage.getItem(KUNCI_SET_LAMA) || 'null'); lama = true; }
  } catch (e){ SET_GAGAL = true; }
  if (!d || typeof d !== 'object') return s;
  if (lama) delete d.suasana;
  for (const k of Object.keys(PILIHAN)) if (PILIHAN[k].includes(d[k])) s[k] = d[k];
  for (const k of ['bayangan', 'bubble', 'labelRuang', 'putar', 'diam']) if (typeof d[k] === 'boolean') s[k] = d[k];
  if (typeof d.pad === 'boolean') s.pad = d.pad;
  if (Number.isFinite(d.kecepatan)) s.kecepatan = Math.min(2, Math.max(.5, d.kecepatan));
  if (Number.isFinite(d.fov)) s.fov = Math.min(75, Math.max(30, Math.round(d.fov)));
  return s;
}
function simpanSet(){
  try { localStorage.setItem(KUNCI_SET, JSON.stringify(SET)); SET_GAGAL = false; }
  catch (e){ SET_GAGAL = true; }
  const el = document.getElementById('setInfo');
  if (el) el.textContent = SET_GAGAL ? 'Pengaturan tidak bisa disimpan di browser ini; berlaku sampai halaman ditutup.' : '';
}
const SET = muatSet();

/* ================= data pegawai: nama & penampilan per anggota (localStorage + ekspor/impor JSON) =================
   Kunci slot = kunci tim + '#' + nomor anggota (mis. 'div:qa#1' = "QA 1", 'Explore#2' = "Explore 2"), plus 'kepala' dan 'resepsionis'.
   Nomor anggota = nomor pada nama bawaan, jadi pemetaan event → anggota tidak berubah; nama hanya label tampilan.
   Penampilan = spec karakter desain v2 (orang3d.js). Data versi 1 (format figur lama): nama tetap dipakai, penampilannya diabaikan
   dengan aman (bawaan = tampilan desain), karena bentuknya tidak cocok dengan karakter v2. */
const KUNCI_PEG = 'padev-kantor3d:pegawai';
const VERSI_PEG = 2;
const RE_SLOT = /^(kepala|resepsionis|[A-Za-z0-9][A-Za-z0-9:_.\/-]{0,59}#[1-9][0-9]?)$/;
const RE_HEX = /^#[0-9a-f]{6}$/;
const MAKS_SLOT = 300;
let PEG_GAGAL = false;
// nama: buang karakter kontrol & pengarah teks (bidi), rapikan spasi, batasi MAKS_NAMA karakter. Selalu ditampilkan lewat textContent.
function bersihNama(v){
  if (typeof v !== 'string') return '';
  const s = v.replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff]/g, '').replace(/\s+/g, ' ').trim();
  return Array.from(s).slice(0, MAKS_NAMA).join('').trim();
}
// validasi ketat penampilan v2: hanya kunci & pilihan yang dikenal orang3d.js; nilai lain dibuang / diganti nilai dasar
function bersihLook(x){
  if (!x || typeof x !== 'object' || Array.isArray(x)) return null;
  const hx = v => typeof v === 'string' && RE_HEX.test(v.toLowerCase()) ? v.toLowerCase() : null;
  const en = (v, d) => typeof v === 'string' && v !== '' && Object.hasOwn(d, v) ? v : null;
  const ob = v => v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  const o = {fem:x.fem === true, kulit:Number.isInteger(x.kulit) && x.kulit >= 0 && x.kulit < KULIT_HEX.length ? x.kulit : 0};
  if (hx(x.hijab)) o.hijab = hx(x.hijab);
  else { const r = ob(x.rambut); o.rambut = {gaya:en(r.gaya, GAYA.rambut) || 'pendek', warna:hx(r.warna) || '#1d1916'}; }
  const a = ob(x.atasan); o.atasan = {jenis:en(a.jenis, GAYA.atasan) || 'kaos', warna:hx(a.warna) || '#4285f4'};
  for (const k of ['dalam', 'dasi', 'print']) if (hx(a[k])) o.atasan[k] = hx(a[k]);
  if (a.gulung === true) o.atasan.gulung = true;
  const b = ob(x.bawahan); o.bawahan = {jenis:en(b.jenis, GAYA.bawahan) || 'celana', warna:hx(b.warna) || '#2f3542'};
  const s = ob(x.sepatu); o.sepatu = {jenis:en(s.jenis, GAYA.sepatu) || 'sneaker', warna:hx(s.warna) || '#f4f4f0'};
  for (const k of ['aksen', 'sol', 'tali']) if (hx(s[k])) o.sepatu[k] = hx(s[k]);
  const k = ob(x.aks), A = {};
  if (en(k.kacamata, GAYA.kacamata)){ A.kacamata = k.kacamata; if (hx(k.warnaKacamata)) A.warnaKacamata = hx(k.warnaKacamata); }
  if (hx(k.jam)) A.jam = hx(k.jam);
  if (k.headphone === 'kepala' || k.headphone === 'leher'){ A.headphone = k.headphone; if (hx(k.warnaHeadphone)) A.warnaHeadphone = hx(k.warnaHeadphone); }
  if (hx(k.lanyard)) A.lanyard = hx(k.lanyard);
  const t = ob(k.topi);
  if (t.jenis === 'cap' || t.jenis === 'beanie'){ A.topi = {jenis:t.jenis, warna:hx(t.warna) || '#1d2433'}; if (t.jenis === 'cap' && t.balik === true) A.topi.balik = true; }
  for (const f of ['anting', 'kumis', 'jenggot']) if (k[f] === true) A[f] = true;
  if (hx(k.ransel)) A.ransel = hx(k.ransel);
  if (en(k.pegang, GAYA.pegang)) A.pegang = k.pegang;
  o.aks = A;
  return o;
}
const salinLook = lk => JSON.parse(JSON.stringify(lk));
// penampilan acak dari daftar pilihan v2 (warna divisi sering dipakai supaya identitas tetap terbaca)
function lookAcak(warnaTim){
  const r = Math.random, p = a => a[Math.floor(r() * a.length)];
  const fem = r() < .45, hij = fem && r() < .45;
  const jenis = hij ? p(['tunik', 'kardigan', 'blazer', 'kemeja']) : p(['kaos', 'kaos', 'kemeja', 'polo', 'hoodie', 'blazer', 'kardigan']);
  const o = {fem, kulit:Math.floor(r() * KULIT_HEX.length), atasan:{jenis, warna:warnaTim && r() < .35 ? warnaTim.toLowerCase() : p(PALET.pakaian)},
    bawahan:{jenis:hij ? 'rok' : fem ? p(['celana', 'jeans', 'rok']) : p(['celana', 'jeans', 'jeans']), warna:p(PALET.bawahan)},
    sepatu:{jenis:hij || fem ? p(['flat', 'sneaker', 'formal']) : p(['sneaker', 'sneaker', 'formal', 'boot']), warna:p(PALET.sepatu)}, aks:{}};
  if (jenis === 'blazer' || jenis === 'kardigan') o.atasan.dalam = p(['#ffffff', '#f4f1ea', '#1d2433', '#4285f4']);
  if (jenis === 'blazer' && !fem && r() < .4) o.atasan.dasi = p(['#c0392b', '#1d2433', '#3b6cf6', '#2a9d8f']);
  if (jenis === 'kaos' && r() < .6) o.atasan.print = p(PALET.pakaian);
  if (LENGAN_PANJANG.includes(jenis) && r() < .25) o.atasan.gulung = true;
  if (o.sepatu.jenis === 'sneaker' && r() < .6) o.sepatu.aksen = p(PALET.aksen);
  if (hij) o.hijab = p(PALET.hijab);
  else o.rambut = {gaya:fem ? p(['cepol', 'kuncir', 'bob', 'panjang']) : p(['pendek', 'pendek', 'belah', 'undercut', 'keriting']), warna:p(PALET.rambut.slice(0, 6))};
  if (r() < .28) o.aks.kacamata = p(['kotak', 'bulat']);
  if (r() < .3) o.aks.jam = p(PALET.aksen);
  if (r() < .15){ o.aks.headphone = p(['kepala', 'leher']); o.aks.warnaHeadphone = p(PALET.aksen); }
  if (r() < .3) o.aks.lanyard = warnaTim ? warnaTim.toLowerCase() : p(PALET.aksen);
  if (!hij && r() < .1) o.aks.topi = r() < .6 ? Object.assign({jenis:'cap', warna:warnaTim ? warnaTim.toLowerCase() : p(PALET.pakaian)}, r() < .5 ? {balik:true} : {}) : {jenis:'beanie', warna:p(PALET.pakaian)};
  if (fem && !hij && r() < .4) o.aks.anting = true;
  if (!fem && r() < .15) o.aks.kumis = true;
  if (!fem && r() < .15) o.aks.jenggot = true;
  if (r() < .08) o.aks.ransel = p(PALET.bawahan);
  return bersihLook(o);
}
function bersihPeg(d){
  const out = {acakBaru:false, orang:{}, lookLama:0};
  if (!d || typeof d !== 'object' || Array.isArray(d)) return null;
  if (typeof d.acakBaru === 'boolean') out.acakBaru = d.acakBaru;
  const v2 = d.versi === VERSI_PEG;
  const src = d.orang && typeof d.orang === 'object' && !Array.isArray(d.orang) ? d.orang : {};
  let n = 0;
  for (const [k, v] of Object.entries(src)){
    if (n >= MAKS_SLOT) break;
    if (typeof k !== 'string' || !RE_SLOT.test(k) || !v || typeof v !== 'object') continue;
    const e = {};
    const nm = bersihNama(v.nama); if (nm) e.nama = nm;
    if (v.look){ if (v2){ const lk = bersihLook(v.look); if (lk) e.look = lk; } else out.lookLama++; }
    if (e.nama || e.look){ out.orang[k] = e; n++; }
  }
  return out;
}
function muatPeg(){
  let d = null;
  try { d = JSON.parse(localStorage.getItem(KUNCI_PEG) || 'null'); } catch (e){ PEG_GAGAL = true; }
  return bersihPeg(d) || {acakBaru:false, orang:{}, lookLama:0};
}
const PEG = muatPeg();
function simpanPeg(){
  try { localStorage.setItem(KUNCI_PEG, JSON.stringify({versi:VERSI_PEG, acakBaru:PEG.acakBaru, orang:PEG.orang})); PEG_GAGAL = false; }
  catch (e){ PEG_GAGAL = true; }
}
// Nama bawaan anggota (= isi pegawai-nama.json): dipakai di perangkat mana pun bila slot belum punya nama tersimpan
// (mis. HP yang belum pernah Impor JSON). Nama dari tab Pegawai selalu menang; menghapus nama → kembali ke nama bawaan ini.
const NAMA_BAWAAN = Object.freeze({
  'div:analis#1':'Fajar', 'div:analis#2':'Nadia', 'div:analis#3':'Sinta',
  'div:programmer#1':'Bima', 'div:programmer#2':'Rizky', 'div:programmer#3':'Putri',
  'div:ui#1':'Laras', 'div:ui#2':'Ayu', 'div:ui#3':'Citra',
  'div:reviewer#1':'Arya', 'div:reviewer#2':'Hendra', 'div:reviewer#3':'Yoga',
  'div:qa#1':'Dewi', 'div:qa#2':'Aisyah', 'div:qa#3':'Salma',
  'div:security#1':'Sekar', 'div:security#2':'Intan', 'div:security#3':'Wulan',
  'div:dokumentasi#1':'Rendra', 'div:dokumentasi#2':'Rudi', 'div:dokumentasi#3':'Galih',
  'div:devops#1':'Bayu', 'div:devops#2':'Teguh', 'div:devops#3':'Dimas',
  'fullstack-quickfix#1':'Raka'
});
const namaTersimpan = slot => (slot && PEG.orang[slot] && PEG.orang[slot].nama) || '';
const namaSlot = slot => namaTersimpan(slot) || (slot && milik(NAMA_BAWAAN, slot)) || '';

const RMQ = matchMedia('(prefers-reduced-motion: reduce)');
let RM = RMQ.matches;
// Kurangi gerakan: Ikuti sistem / Nyala / Mati
function hitungRM(){
  RM = SET.gerak === 'nyala' ? true : SET.gerak === 'mati' ? false : RMQ.matches;
  document.documentElement.classList.toggle('rm', RM);
  document.documentElement.classList.toggle('gerak-penuh', !RM);
}
hitungRM();
RMQ.addEventListener && RMQ.addEventListener('change', () => { hitungRM(); typeof isiInfoSet === 'function' && isiInfoSet(); });
let NOW = performance.now() / 1000;
const FPS_DIAM = 10;
let ramaiSampai = 0, fpsSasaran = 30;   // hemat suhu: lihat hitungSasaranFPS() di bagian loop

/* ================= info alat ================= */
function toolInfo(t){
  t = t || '';
  if (/^(Read|View)$/.test(t)) return {icon:'📖', label:'Membaca file', cat:'read'};
  if (/^Write$/.test(t)) return {icon:'📝', label:'Menulis file', cat:'write'};
  if (/Edit$/.test(t)) return {icon:'✏️', label:'Mengedit', cat:'write'};
  if (/^(Bash|PowerShell|BashOutput|KillShell)$/.test(t)) return {icon:'💻', label:'Menjalankan perintah', cat:'bash'};
  if (/^(Grep|Glob|LS)$/.test(t)) return {icon:'🔍', label:'Mencari file', cat:'search'};
  if (t === 'WebSearch') return {icon:'🌐', label:'Mencari di internet', cat:'web'};
  if (t === 'WebFetch') return {icon:'🌐', label:'Membuka halaman web', cat:'web'};
  if (t === 'Agent' || t === 'Task') return {icon:'📋', label:'Menugaskan divisi', cat:'agent'};
  if (/^(TodoWrite|TaskCreate|TaskUpdate|TaskList|TaskGet)$/.test(t)) return {icon:'🗂️', label:'Mengatur daftar tugas', cat:'plan'};
  if (/^Skill$/.test(t)) return {icon:'🧰', label:'Memakai skill', cat:'plan'};
  if (/^mcp__/.test(t)){ const p = t.split('__'); return {icon:'🔌', label:'Memakai ' + (p[1] || 'alat') + (p[2] ? ' · ' + p[2] : ''), cat:'mcp'}; }
  return {icon:'🛠️', label:t || 'Bekerja', cat:'other'};
}
const namaSkill = s => short(String(s || '').replace(/^anthropic-skills:/, '').trim(), 60);
const SCREEN = {read:'#4d96ff', write:'#27c07a', bash:'#19e68c', search:'#ffb84d', web:'#b084ff', agent:'#ff7ab6', plan:'#7fd3ff', mcp:'#ffd166', other:'#9ad0ff'};
const SCREEN_C = {}; for (const k in SCREEN) SCREEN_C[k] = new THREE.Color(SCREEN[k]);

/* ================= renderer, kamera, cahaya (disalin persis dari desain/preview.html) ================= */
const stage = $('#stage');
// GPU kencang hanya untuk HD/Ultra (berlaku saat halaman dimuat ulang); kualitas lain memakai pilihan hemat browser
const GPU_KENCANG = SET.kualitas === 'hd' || SET.kualitas === 'ultra';
const renderer = new THREE.WebGLRenderer({antialias:true, alpha:true, preserveDrawingBuffer:true, powerPreference:GPU_KENCANG ? 'high-performance' : 'default'});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));   // nilai preview; diganti terapkanPR() sesuai kualitas
renderer.shadowMap.enabled = true;
// preview.html meminta PCFSoftShadowMap; three r184 otomatis menggantinya dengan PCFShadowMap (plus peringatan di konsol).
// Di sini langsung PCFShadowMap: gambar sama persis, konsol bersih.
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.domElement.tabIndex = 0;
renderer.domElement.setAttribute('role', 'application');
renderer.domElement.setAttribute('aria-label', 'Kantor 3D. Fokus di sini lalu pakai W A S D untuk geser, Q E untuk putar, + dan − untuk zoom, angka 1 sampai 8 untuk sudut kamera, L untuk ganti lantai.');
stage.prepend(renderer.domElement);
stage.style.background = TEMA.latar;
const labelRenderer = new THREE.CSS2DRenderer();
labelRenderer.domElement.id = 'labels';
stage.insertBefore(labelRenderer.domElement, $('#hud-top'));

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, 1, .01, 500);
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.dampingFactor = .08;
let userMoved = false, camAnim = null;
controls.addEventListener('start', () => { userMoved = true; camAnim = null; });   // lihat juga bagian kamera (tur, orang ke-3)
const hemi = new THREE.HemisphereLight(0xffffff, 0xd8d2c4, 1.0);
scene.add(hemi);
const key = new THREE.DirectionalLight(0xffffff, 2.2);
key.position.set(24, 42, 30); key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
key.shadow.bias = -.0003; key.shadow.normalBias = .035; key.shadow.camera.far = 200; scene.add(key);
const fill = new THREE.DirectionalLight(0xfff4e6, .5); fill.position.set(-5, 3, -4); scene.add(fill);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.ShadowMaterial({opacity:.18}));
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

/* ================= kualitas grafis =================
   Hanya resolusi render & ukuran shadow map yang berubah; cahaya, bayangan (arah, bias, frustum), kamera, dan isi adegan tetap = desain.
   pr   = resolusi render per piksel CSS (HD/Ultra: supersampling >1 walau layar 1×)
   jauh = tambahan resolusi saat kamera jauh (detail kecil tetap tajam)
   mp   = batas megapiksel drawing buffer (memori GPU wajar; MSAA ikut dikali)
   bayang = ukuran shadow map */
const KUALITAS = {
  desain:  {nama:'Desain',   pr:d => Math.min(d, 1.75), jauh:0,  mp:Infinity, bayang:2048, ket:'persis desain acuan (preview.html): resolusi layar maks 1,75×, bayangan 2048'},
  hemat:   {nama:'Hemat',    pr:d => 1,                jauh:0,  mp:6,  bayang:1024, ket:'ringan untuk laptop lama atau saat memakai baterai'},
  standar: {nama:'Standar',  pr:d => Math.min(d, 1.5), jauh:0,  mp:9,  bayang:2048, ket:'seimbang antara tajam dan ringan'},
  hd:      {nama:'HD',       pr:d => Math.max(d, 2),   jauh:.5, mp:12, bayang:4096, ket:'tajam juga di layar biasa (supersampling 2×)'},
  ultra:   {nama:'Ultra HD', pr:d => Math.max(d, 3),   jauh:.5, mp:18, bayang:8192, ket:'paling tajam; butuh kartu grafis yang kuat'},
};
const GLX = renderer.getContext();
const GL_MAKS = Math.min(renderer.capabilities.maxTextureSize, GLX.getParameter(GLX.MAX_RENDERBUFFER_SIZE), ...GLX.getParameter(GLX.MAX_VIEWPORT_DIMS));
const ANISO = renderer.capabilities.getMaxAnisotropy();
let turunPR = 0, prAktif = 1, jauhPR = false, FPS = 0;
function hitungPR(){
  const q = KUALITAS[SET.kualitas] || KUALITAS.hd, dpr = window.devicePixelRatio || 1;
  if (SET.kualitas === 'desain') return q.pr(dpr);          // sama persis dengan preview.html
  const w = Math.max(1, stage.clientWidth), h = Math.max(1, stage.clientHeight);
  let pr = q.pr(dpr) + (jauhPR ? q.jauh : 0) - turunPR;
  pr = Math.min(pr, GL_MAKS / Math.max(w, h), Math.sqrt(q.mp * 1e6 / (w * h)));
  return Math.max(1, Math.round(pr * 100) / 100);
}
function terapkanPR(){
  const pr = hitungPR();
  if (Math.abs(pr - renderer.getPixelRatio()) > .001) renderer.setPixelRatio(pr);   // setPixelRatio ikut mengatur ulang ukuran buffer
  prAktif = pr; isiInfoKualitas();
}
function ukuranBayangan(){
  let n = (KUALITAS[SET.kualitas] || KUALITAS.hd).bayang;
  while (n > renderer.capabilities.maxTextureSize) n /= 2;
  return n;
}
function terapkanBayangan(){
  const n = ukuranBayangan();
  if (key.shadow.mapSize.x !== n){ key.shadow.mapSize.set(n, n); if (key.shadow.map){ key.shadow.map.dispose(); key.shadow.map = null; } }
  key.castShadow = !!SET.bayangan;             // ubah jumlah bayangan → shader otomatis dikompilasi ulang
  isiInfoKualitas();
}
function terapkanKualitas(){ turunPR = 0; terapkanBayangan(); terapkanPR(); }

const LOGO_IMG = new Image();
const LOGO_READY = new Promise(res => { LOGO_IMG.onload = res; LOGO_IMG.onerror = res; });
LOGO_IMG.src = LOGO_DATA;

/* ================= adegan desain: PadevKantor.build(THREE, PadevOrang(THREE)) ================= */
let ORANG = null, R = null, SPHERE = null, BOX = null, KOTAK1 = null, KOTAK2 = null, baseY = 0, LUARG = null;
let mode = 'terpisah', ikutLantai = true;   // mode lantai (persis preview) · ikutLantai = titik pandang ikut tinggi lantai (langkahLantai)
const KURSI = [], KURSI_BY = {};           // R.kursi + KURSI_TAMBAHAN
const PENGHALANG = [];                      // pelat lantai 2: klik tidak tembus ke orang di bawahnya
const LOOK_DESAIN = {};                     // penampilan asli karakter desain (bawaan untuk "↺ Referensi")
function targetY(m){ return m === 'l2' ? R.Y2 : m === 'l1' ? R.Y2 + 14 : R.Y2 + R.GAP; }
function bangunAdegan(){
  ORANG = window.PadevOrang(THREE);
  R = window.PadevKantor.build(THREE, ORANG);
  R.lantai2.position.y = targetY(mode);
  scene.add(R.model);
  /* kamera awal & bayangan: sama persis dengan preview.html */
  R.model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(R.model);
  SPHERE = box.getBoundingSphere(new THREE.Sphere());
  ground.position.y = box.min.y;
  baseY = R.model.position.y;
  const span = SPHERE.radius * 1.6; Object.assign(key.shadow.camera, {left:-span, right:span, top:span, bottom:-span}); key.shadow.camera.updateProjectionMatrix();
  KOTAK1 = new THREE.Box3().setFromObject(R.lantai1); KOTAK2 = new THREE.Box3().setFromObject(R.lantai2);   // KOTAK2 = posisi Terpisah
  BOX = KOTAK1.clone().union(KOTAK2);
  for (const d of ORANG.DAFTAR) LOOK_DESAIN[d.id] = bersihLook(d);
  // kursi: data desain + titik tambahan (bentuk sama, dipakai R.rute)
  for (const k of R.kursi) KURSI.push(k);
  for (const k of KURSI_TAMBAHAN){
    const kk = Object.assign({layar:null, pemilik:null}, k); KURSI.push(kk);
    for (const [id, P] of Object.entries(R.orang)) if (!P.kursi && (P.root.parent === R.lantai2 ? 2 : 1) === kk.lantai &&
      Math.abs(P.root.position.x - kk.x) < .05 && Math.abs(P.root.position.z - kk.z) < .05){ P.kursi = kk; kk.pemilik = id; }
  }
  for (const k of KURSI) KURSI_BY[k.id] = k;
  KURSI_BY[PINTU.id] = PINTU;
  // yang tidak digabung: layar meja (material diklon & diwarnai saat bekerja) dan pelat lantai 2 (penghalang klik)
  for (const k of R.kursi) if (k.layar) k.layar.userData.dyn = true;
  R.lantai2.traverse(o => { if (o.isMesh && /^pelat_lt2/.test(o.name)){ o.userData.dyn = true; PENGHALANG.push(o); } });
  gantiLogoPapan();
  gabungStatis(R.lantai1, R.lantai1); gabungStatis(R.lantai2, R.lantai2);
  // lingkungan luar menempel pada lantai 1 (koordinat sama dengan kursi)
  LUARG = new THREE.Group(); LUARG.name = 'lingkungan_luar'; LUARG.position.copy(R.lantai1.position); R.model.add(LUARG);
}
// Papan logo desain (dinding lobi & ruang pimpinan, material bersama 'logo_padev'): lingkaran "P" desain diganti logo asli PADEV.
// Kanvas, warna, dan posisi teks sama persis dengan logoSign() di desain/kantor3d.js; file desain tidak diubah.
function gantiLogoPapan(){
  if (!LOGO_IMG.naturalWidth) return;
  let m = null;
  R.model.traverse(o => { if (!m && o.isMesh && Array.isArray(o.material)) m = o.material.find(x => x && x.name === 'logo_padev') || null; });
  if (!m) return;
  const c = document.createElement('canvas'); c.width = 1600; c.height = 360; const x = c.getContext('2d');
  x.fillStyle = '#1d2433'; x.fillRect(0, 0, 1600, 360);
  x.drawImage(LOGO_IMG, 60, 65, 230, 230);   // menempati tempat lingkaran "P" (pusat 170,180)
  x.textBaseline = 'middle'; x.fillStyle = '#fff'; x.font = '800 118px "Plus Jakarta Sans", system-ui'; x.fillText('PADEV STUDIO', 310, 140);
  x.fillStyle = '#9fb6ff'; x.font = '700 78px "Plus Jakarta Sans", system-ui'; x.fillText('CLAUDE', 314, 262);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  if (m.map) m.map.dispose();
  m.map = t; m.needsUpdate = true;
}
// Gabungkan mesh statis per material supaya ringan (±2500 mesh gedung → ±300 draw call). Bentuk, posisi, material, dan bayangan
// tetap persis; tidak digabung: karakter, benda hidup/tersembunyi, material transparan (urutan gambar kaca tetap), layar meja, pelat lantai 2.
function gabungStatis(root, target, opt = {}){
  root.updateMatrixWorld(true); target.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(target.matrixWorld).invert(), ember = new Map();
  (function jelajah(o){
    for (const c of o.children.slice()){
      if (c.userData.anim || c.userData.hidup || !c.visible || c.isCSS2DObject || c.isLight) continue;
      if (c.isMesh && !c.children.length && !c.userData.dyn && !Array.isArray(c.material) && !c.material.transparent &&
          c.geometry.attributes.normal && c.geometry.attributes.uv){
        const mx = new THREE.Matrix4().multiplyMatrices(inv, c.matrixWorld);
        if (mx.determinant() > 0){
          const k = c.material.uuid + '|' + (+c.castShadow) + (+c.receiveShadow) + '|' + c.renderOrder;
          let e = ember.get(k); if (!e){ e = {m:c.material, cs:c.castShadow, rs:c.receiveShadow, ro:c.renderOrder, isi:[]}; ember.set(k, e); }
          e.isi.push({g:c.geometry, o:c, mx}); continue;
        }
      }
      jelajah(c);
    }
  })(root);
  for (const e of ember.values()){
    if (e.isi.length < 2 && !opt.semua) continue;
    const g = gabungGeo(e.isi);
    for (const {o} of e.isi) o.parent.remove(o);
    const m = new THREE.Mesh(g, e.m); m.name = 'gabungan_' + e.m.name;
    m.castShadow = opt.bayang === false ? false : e.cs; m.receiveShadow = opt.terima ?? e.rs; m.renderOrder = e.ro;
    m.matrixAutoUpdate = false; m.updateMatrix(); target.add(m);
  }
}
const _gv = new THREE.Vector3(), _gn = new THREE.Matrix3(), _gi = new THREE.Matrix4();
function gabungGeo(isi){
  let nv = 0, ni = 0;
  for (const {g} of isi){ nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), idx = new (nv > 65535 ? Uint32Array : Uint16Array)(ni);
  let v0 = 0, i0 = 0;
  for (const {g, mx} of isi){
    const P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv, I = g.index, M = mx || _gi;
    _gn.getNormalMatrix(M);
    for (let i = 0; i < P.count; i++){
      const a = (v0 + i) * 3;
      _gv.fromBufferAttribute(P, i).applyMatrix4(M); pos[a] = _gv.x; pos[a + 1] = _gv.y; pos[a + 2] = _gv.z;
      _gv.fromBufferAttribute(N, i).applyMatrix3(_gn).normalize(); nor[a] = _gv.x; nor[a + 1] = _gv.y; nor[a + 2] = _gv.z;
      uv[(v0 + i) * 2] = U ? U.getX(i) : 0; uv[(v0 + i) * 2 + 1] = U ? U.getY(i) : 0;
    }
    if (I) for (let j = 0; j < I.count; j++) idx[i0 + j] = I.getX(j) + v0;
    else for (let j = 0; j < P.count; j++) idx[i0 + j] = v0 + j;
    v0 += P.count; i0 += I ? I.count : P.count;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(new THREE.BufferAttribute(idx, 1)); g.computeBoundingBox(); g.computeBoundingSphere();
  return g;
}
const gabungDaftar = geos => gabungGeo(geos.map(g => ({g})));
/* ---- lantai & ruang ---- */
const grupLantai = n => n === 2 ? R.lantai2 : R.lantai1;
const lantaiDari = P => P.root.parent === R.lantai2 ? 2 : 1;
function terlihat(o){ for (; o; o = o.parent) if (!o.visible) return false; return true; }
// lantai 1 tertutup lantai 2 (mode Lantai 2, pelat sudah turun): label & klik orang di lantai 1 diabaikan
const lt1Tertutup = () => mode === 'l2' && Math.abs(R.lantai2.position.y - R.Y2) < 1;
function lantaiTampak(n){ return n === 2 ? terlihat(R.lantai2) : !lt1Tertutup(); }
function ruangDi(lantai, x, z){
  for (const r of RUANG) if (r.lantai === lantai && r.kotak.some(([x1, z1, x2, z2]) => x >= x1 && x <= x2 && z >= z1 && z <= z2)) return r;
  return null;
}
const ruangKursi = k => k ? ruangDi(k.lantai, k.x, k.z) : null;
// posisi dunia dari koordinat lantai (tinggi lantai 2 = tujuan animasi mode sekarang)
function keDunia(lantai, x, y, z, out = new THREE.Vector3()){
  return out.set(x + R.lantai1.position.x, y + baseY + (lantai === 2 ? targetY(mode) : 0), z + R.lantai1.position.z);
}
// kotak pembingkai per mode lantai (untuk tampak atas & sudut sisi)
function kotakMode(m = mode){
  const b = KOTAK1.clone();
  if (m !== 'l1'){ const b2 = KOTAK2.clone(); b2.translate(new THREE.Vector3(0, targetY(m) - (R.Y2 + R.GAP), 0)); b.union(b2); }
  return b;
}

/* ---- layar meja: material diklon sekali per kursi, diwarnai sesuai jenis kerja ---- */
const PUTIH = new THREE.Color('#ffffff'), _cl = new THREE.Color();
function infoLayar(k){
  if (!k || !k.layar) return null;
  if (!k.layarInfo){
    const m = k.layar.material.clone(); k.layar.material = m;
    k.layarInfo = {m, emisif:!!m.emissive && !m.map, em:m.emissive ? m.emissive.clone() : null, ei:m.emissiveIntensity, col:m.color.clone(), st:'normal'};
  }
  return k.layarInfo;
}
function aturLayar(L, st, cat, t, ph){
  if (!L) return;
  if (st === 'kerja'){
    const c = SCREEN_C[cat] || SCREEN_C.other, a = RM ? 0 : 1;
    if (L.emisif){ L.m.emissive.copy(c); L.m.emissiveIntensity = .85 + Math.sin(t * 13 + ph) * .12 * a; }
    else L.m.color.copy(c).lerp(PUTIH, .35).multiplyScalar(1.15 + Math.sin(t * 13 + ph) * .1 * a);
    L.st = 'kerja'; return;
  }
  if (L.st === st) return;
  L.st = st;
  if (L.emisif){ L.m.emissive.copy(L.em); L.m.emissiveIntensity = st === 'redup' ? L.ei * .22 : L.ei; }
  else if (st === 'redup') L.m.color.copy(L.col).multiplyScalar(.32);
  else L.m.color.copy(L.col);
}

/* ---- karakter: buat & buang (geometri milik sendiri dilepas; material & geometri bersama tetap) ---- */
function buangKarakter(P){
  const i = ORANG.list.indexOf(P); if (i >= 0) ORANG.list.splice(i, 1);
  if (P.root.parent) P.root.parent.remove(P.root);
  const dipakai = new Set();
  for (const Q of ORANG.list) Q.root.traverse(o => { if (o.geometry) dipakai.add(o.geometry); });
  P.root.traverse(o => { if (o.geometry && !dipakai.has(o.geometry)) o.geometry.dispose(); });
}
// orang3d.js hanya mengisi fase langkah P.wph untuk karakter ber-"path" (figuran taman). Karakter lain yang dijalankan
// dengan jalanKe mendapat NaN (kaki, lengan, dan kain hilang saat berjalan). Diisi 0 di sini; file desain tidak diubah.
function siapJalan(P){ if (!Number.isFinite(P.wph)) P.wph = 0; }
const idAgen = slot => 'agen_' + String(slot).replace(/[^a-z0-9]+/gi, '_');
function lookBaru(slot){ return bersihLook(ORANG.tampilanDari(slot)); }
function jumlahOrang(){ return ORANG ? ORANG.list.length - (PRATINJAU.P ? 1 : 0) : 0; }
function titikLaporKosong(){ return R.titikLapor.find(k => !k.occupant) || null; }
// titik lapor untuk aktor: yang sedang ditempati/dituju, titik lapor asal bila ia baru berangkat dari sana (berbalik), atau yang kosong
function titikLaporIni(a){
  if (!a.walking && a.at && a.at.jenis === 'lapor') return a.at;
  if (a.walking && a.target && a.target.jenis === 'lapor') return a.target;
  if (a.walking && a.dari && a.dari.jenis === 'lapor' && !a.dari.occupant && !a.sudahBalik) return a.dari;
  return titikLaporKosong();
}
function tokenNama(nama){ return String(nama || '').toLowerCase().replace(/^.*:/, '').split(/[^a-z0-9]+/).filter(Boolean); }
// karakter desain yang cocok dengan nama sub agent non-divisi dan masih menganggur (bukan avatar agen lain)
function desainCocok(nama){
  const tk = tokenNama(nama);
  for (const [kata, ids] of POLA_KARAKTER) if (kata.some(w => tk.includes(w))) for (const id of ids) if (R.orang[id] && !DESAIN_DIPAKAI.has(id) && R.orang[id].kursi) return id;
  return null;
}
const DESAIN_DIPAKAI = new Set();
// kursi kosong untuk anggota baru: ruang divisinya dulu, lalu aturan umum (nama IT → lantai 2 dulu), terakhir kursi rapat bersama
function allocKursi(team){
  const bebas = k => !k.pemilik && !k.occupant && k.jenis !== 'pimpinan' && k.jenis !== 'lapor';
  const base = team.members.map(m => m.desk).find(Boolean);
  if (base){
    const rb = ruangKursi(base);
    const sama = KURSI.filter(k => bebas(k) && k.lantai === base.lantai && ruangKursi(k) === rb).sort((a, b) => Math.hypot(a.x - base.x, a.z - base.z) - Math.hypot(b.x - base.x, b.z - base.z));
    if (sama.length) return sama[0];
  }
  const it = IT_RE.test(team.who || '') || (team.div && IT_RE.test(team.div));
  const lt1 = [k => k.lantai === 1 && k.jenis === 'meja' && ruangKursi(k) && ruangKursi(k).id === 'workspace',
    k => k.lantai === 1 && ruangKursi(k) && ruangKursi(k).id === 'studio', k => k.lantai === 1 && k.jenis === 'rapat'];
  const lt2 = [k => k.lantai === 2 && k.jenis === 'meja_dev', k => k.lantai === 2 && k.jenis === 'meja_berdiri', k => k.lantai === 2 && k.jenis === 'noc',
    k => k.lantai === 2 && k.jenis === 'teras'];   // meja kerja rooftop (Teras Lt 2) bila kursi dalam ruangan penuh
  for (const f of it ? [...lt2, ...lt1] : [...lt1, ...lt2]){ const k = KURSI.find(x => bebas(x) && f(x)); if (k) return k; }
  // semua penuh: kursi rapat yang paling sedikit dipakai bersama
  const rp = KURSI.filter(k => k.jenis === 'rapat');
  rp.sort((a, b) => (a.dipakai || 0) - (b.dipakai || 0));
  return rp[0];
}

/* ================= figur di atas karakter desain ================= */
const RING_GEO = new THREE.RingGeometry(.4, .5, 40);
let ACT_SEQ = 0;
const ACTORS = new Map();
const AKAR = new Set();          // P.root semua aktor (klik = raycast ke seluruh mesh di bawahnya)
const ACT_TXT = {dengar:'Santai di meja', hp:'Main HP di meja', minum:'Minum di meja', santai:'Bersandar santai di meja', telepon:'Menelepon di meja',
  pinggang:'Santai di meja berdiri', ketik:'Santai di meja', bicara:'Mengobrol', berdiri:'Santai', rokok:'Merokok'};
// kalimat obrolan lepas (dipakai bila dialog habis): santai, sopan, tanpa nama orang/merek
const CHAT = ['💬 Eh, sudah lihat rilis terbaru?', '😂 Haha, iya betul!', '💬 Nanti makan siang di mana?', '🤔 Hmm, masuk akal juga', '👍 Setuju!',
  '💬 Tadi tesnya lulus semua lho', '☕ Kopi pantry enak hari ini', '💬 Weekend ke mana?', '😄 Mantap!', '💬 Bug kemarin sudah beres?', '💬 Ada ide buat fitur baru?', '😆 Wkwk',
  '💬 Pagi-pagi sudah hujan aja ya', '😅 Aduh, lupa bawa charger', '💬 Nanti sore ada rapat nggak sih?', '🤔 Kayaknya perlu dites ulang deh', '💬 Itu tiketnya sudah aku assign',
  '😄 Akhirnya jalan juga di server', '💬 Macet banget tadi pagi', '🍜 Laper, jam segini enaknya bakso', '💬 Deploy-nya habis makan siang aja', '😂 Pantes error, typo satu huruf',
  '💬 Dokumentasinya sudah diperbarui kok', '🙏 Makasih sudah bantu review', '💬 Minggu ini sprint-nya padat ya', '😌 Alhamdulillah, beres juga', '💬 Nanti kabari ya kalau ada kendala',
  '☕ Ngopi dulu biar melek', '💬 Libur panjang nanti mau pulang kampung', '😆 Kodenya jalan, tapi nggak tahu kenapa', '💬 Coba cek log-nya dulu', '👌 Oke, aku catat'];
// dialog tanya-jawab dua orang (baris genap = yang mengajak, ganjil = lawan bicara); dipakai berurutan oleh Obrolan
const DIALOG = [
  ['💬 Makan siang nanti ke mana?', '🍛 Warung padang depan aja, yuk', '💬 Boleh, tapi jangan kesiangan ya', '👍 Jam dua belas pas kita turun'],
  ['💬 Deploy tadi aman?', '😅 Aman sih, cuma sempat ada warning', '🤔 Warning apa tuh?', '💬 Versi paket lama. Sudah aku catat', '👌 Sip, nanti kita beresin bareng'],
  ['💬 Weekend kemarin ke mana?', '🏞️ Ke pantai sama keluarga', '😄 Wah, pantes kelihatan segar', '😂 Segar, tapi kulit gosong semua'],
  ['💬 Bug yang di halaman login sudah beres?', '💬 Sudah, tinggal tunggu QA', '🙏 Mantap, makasih ya', '👍 Sama-sama, kabari kalau muncul lagi'],
  ['☕ Tadi sudah ngopi belum?', '😴 Belum, pantes ngantuk banget', '😆 Sana ke pantry dulu', '💬 Iya, habis ini deh'],
  ['🌧️ Kayaknya mau hujan deres nih', '💬 Waduh, aku nggak bawa payung', '😅 Pulangnya agak sore aja', '👍 Iya, sekalian lembur dikit'],
  ['💬 Rapat sore ini jadi?', '💬 Jadi, dimajukan jam tiga', '🤔 Bahannya sudah siap?', '📑 Tinggal rapikan slide sedikit', '👌 Oke, aku bantu cek angkanya'],
  ['💬 Fitur baru kemarin gimana tanggapannya?', '😄 Katanya lebih gampang dipakai', '👏 Wah, kerja tim nih', '💬 Tinggal perbaiki tampilan di HP'],
  ['😩 Tesnya gagal terus dari tadi', '🤔 Sudah coba hapus cache?', '💬 Belum, bentar aku coba', '😂 Eh, beneran lulus sekarang', '👍 Klasik'],
  ['💬 Libur panjang nanti ada rencana?', '🚗 Mudik, sudah beli tiket dari bulan lalu', '😄 Asyik, jangan lupa oleh-oleh', '😆 Siap, nanti aku bawain kerupuk'],
  ['💬 Laporan mingguan sudah dikirim?', '😬 Belum, masih nunggu data dari tim', '💬 Deadline-nya besok pagi lho', '👍 Aman, malam ini aku selesaikan'],
  ['💬 Kursi di teras atas enak buat kerja', '😄 Iya, anginnya sepoi-sepoi', '💬 Asal nggak panas aja', '😂 Siang bolong mah mending di dalam'],
];
const AJAK = ['💬 Ngobrol bentar yuk!', '💬 Eh, ada waktu sebentar?', '💬 Sini, duduk dulu', '☕ Istirahat sebentar yuk'];
const TERIMA_AJAK = ['👍 Ayo!', '😄 Boleh, boleh', '💬 Bentar, aku ke sana', '👌 Oke'];
const PAMIT = ['👋 Lanjut kerja dulu ya!', '👋 Oke, nanti sambung lagi', '💪 Yuk, semangat lagi', '👋 Balik ke meja dulu ya'];
const KAL_KOPI = ['☕ Ahh, segar', '☕ Kopi dulu biar fokus', '😌 Nikmatnya', '☕ Pas banget buat siang begini'];
const KAL_ROKOK = ['😮‍💨 Istirahat sebentar', '🌤️ Udaranya enak di luar', '💭 Mikir dulu sambil santai'];

class Actor {
  // o: {team, boss, npc, temp, name, nomor, slot, color, P (karakter desain dipakai apa adanya), look, bawaan, kursi, di (tempat muncul)}
  constructor(o){
    this.id = ++ACT_SEQ; this.team = o.team || null; this.boss = !!o.boss; this.npc = !!o.npc; this.temp = !!o.temp;
    this.kode = o.name; this.nomor = o.nomor || 1; this.slot = o.slot || null; this.namaDiri = namaSlot(this.slot);   // kode = nama bawaan/peran (mis. "QA 1")
    this.color = o.color || '#1d2433'; this.desc = '';
    this.desk = o.kursi || null;
    this.bawaan = o.bawaan || null;
    if (o.P){ this.P = o.P; this.desain = o.P.o.id; DESAIN_DIPAKAI.add(this.desain); this.look = bersihLook(o.P.o); }
    else {
      const k = o.di || this.desk;
      this.look = o.look;
      this.P = ORANG.buat(grupLantai(k.lantai), Object.assign(salinLook(o.look), {id:o.idKarakter || idAgen(this.slot || this.id), peran:this.kode,
        x:k.x, z:k.z, r:k.r, pose:k.duduk ? 'duduk' : 'berdiri', aksi:k.duduk ? 'dengar' : 'berdiri'}));
      this.P.kursi = this.desk;
    }
    this.P.root.userData.aktor = this; AKAR.add(this.P.root);
    if (this.desk && !this.npc){ this.desk.pemilik = this.P.o.id; this.desk.dipakai = (this.desk.dipakai || 0) + 1; }
    this.at = o.di || this.desk || null; if (this.at && !this.at.bersama) this.at.occupant = this;
    this.aksiSantai = this.P.o.aksi || 'dengar';     // karakter desain: aksi bawaannya (adegan awal = preview)
    this.aksiDesain = this.desain ? this.aksiSantai : null;
    // cincin status (kuning = butuh izin, merah = kendala, biru = dipilih)
    this.ringMat = new THREE.MeshBasicMaterial({color:WARNA_CINCIN.menunggu, transparent:true, opacity:.85, depthWrite:false, side:THREE.DoubleSide});
    this.ring = new THREE.Mesh(RING_GEO, this.ringMat); this.ring.name = 'cincin_status'; this.ring.rotation.x = -Math.PI / 2; this.ring.position.y = .03;
    this.ring.visible = false; this.ring.renderOrder = 3; this.P.root.add(this.ring);
    // label
    this.wrap = document.createElement('div'); this.wrap.className = 'tagwrap';
    this.bubEl = document.createElement('div'); this.bubEl.className = 'bubble';
    const tag = document.createElement('div'); tag.className = 'tag' + (this.boss ? ' boss' : this.npc ? ' npc' : '');
    this.tagTxt = document.createTextNode('');
    if (!this.boss){ const i = document.createElement('i'); i.style.background = this.npc ? '#94a3b8' : this.color; tag.append(i); }
    tag.append(this.tagTxt); this.tagTxt.textContent = this.tagTeks();
    this.wrap.append(this.bubEl, tag);
    this.label = new THREE.CSS2DObject(this.wrap); this.label.position.y = this.P.sit ? 1.65 : 2.1; this.P.root.add(this.label);
    // keadaan
    this.walking = false; this.target = null; this.antre = null; this.cb = null; this.lookTunda = null; this.arrivedAt = 0;
    this.mode = this.boss ? 'boss' : this.npc ? 'npc' : 'idle'; this.job = null; this.nextAt = Infinity; this.obrol = null;
    this.lastWork = -1e9; this.workCat = 'other'; this.errorAt = -1e9; this.waiting = false; this.reporting = false; this.bicaraSampai = 0;
    this.activity = this.boss ? 'Menunggu perintah' : this.npc ? 'Menjaga meja resepsionis' : (ACT_TXT[this.aksiSantai] || 'Santai di meja');
    this.phase = Math.random() * 10; this.bubT = null; this._st = '';
    // kegiatan santai di luar meja (ngopi / merokok) & tempat kerja alternatif (kursi teras lt 2)
    this.keg = null; this.kegTerakhir = -1e9; this.kopiSampai = 0; this.kerjaDi = null;
    this.perokok = [...String(this.P.o.id)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % 3 === 0;   // ±1/3 orang merokok, tetap per orang
    ACTORS.set(this.id, this);
  }
  // nama tampilan: nama dari owner (tab Pegawai) bila ada, selain itu nama bawaan (kode peran)
  get name(){ return this.namaDiri || this.kode; }
  // peran tanpa nomor anggota ("Programmer 1" → "Programmer"), dipakai di samping nama dari owner
  get peran(){ return this.kode.replace(/ \d+$/, ''); }
  tagTeks(){
    if (this.boss) return '👑 ' + (this.namaDiri || 'Claude') + ' · Kepala';
    if (this.npc) return this.namaDiri ? this.namaDiri + ' · Resepsionis' : 'Resepsionis';
    return this.namaDiri ? this.namaDiri + ' · ' + this.peran : this.kode;
  }
  terapkanNama(){
    this.namaDiri = namaSlot(this.slot);
    this.tagTxt.textContent = this.tagTeks();
    if (this.rowNm) isiNamaBaris(this.rowNm, this);
  }
  warnaAksen(){ return this.boss ? '#c9a227' : this.npc ? '#3b6cf6' : this.color; }
  get lantai(){ return lantaiDari(this.P); }
  // Ganti penampilan = buat ulang karakter dengan ORANG.buat di posisi, pose, dan lantai yang sama, lalu buang yang lama.
  // Saat berjalan ditunda sampai tiba (keadaan jalan tidak dipindah di tengah rute).
  dandani(lk){
    this.look = salinLook(lk);
    if (this.walking){ this.lookTunda = this.look; return; }
    this.lookTunda = null;
    const lama = this.P, o = lama.o, par = lama.root.parent;
    const P = ORANG.buat(par, Object.assign(salinLook(lk), {id:o.id, peran:o.peran, x:lama.root.position.x, y:lama.root.position.y, z:lama.root.position.z,
      r:lama.r0, pose:o.pose, aksi:o.aksi, hy:lama.hy, lihat:o.lihat, lirik:o.lirik, bawa:o.bawa || null, asap:!!lama.asap}));
    P.root.rotation.y = lama.root.rotation.y; P.kursi = lama.kursi;
    P.root.add(this.ring); P.root.add(this.label);            // pindah anak: cincin & label ikut karakter baru
    P.root.userData.aktor = this; AKAR.delete(lama.root); AKAR.add(P.root);
    this.P = P;
    if (this.desain){ R.orang[this.desain] = P; }             // karakter desain: tetap satu per id
    buangKarakter(lama);
  }
  bubble(text, cls = 'info', ms = 5500){
    this.bubEl.textContent = text; this.bubEl.className = 'bubble show ' + cls;
    clearTimeout(this.bubT); this.bubT = setTimeout(() => this.bubEl.classList.remove('show'), ms);
  }
  /* ---- berjalan: semua perjalanan = ORANG.jalanKe(P, R.rute(dari, ke), selesai, LAJU); perintah baru saat berjalan masuk antrean ---- */
  walkTo(k, o = {}){
    if (!k || this.boss || this.npc) return;
    const cb = o.cb || null;
    if (this.walking){
      if (k === this.target){ this.cb = cb; this.lepasAntre(); return; }           // tujuan sama: cukup ganti apa yang dilakukan saat tiba
      if (k === this.dari && !k.occupant && !this.sudahBalik){ this.balik(cb); return; }   // kembali ke titik asal: berbalik di rute yang sama
      this.lepasAntre(); this.antre = {k, cb}; if (!k.bersama) k.occupant = this;  // simpan & pesan tempatnya; dijalankan setelah sampai
      return;
    }
    this.antre = null;
    if (this.at === k){ cb && cb(); return; }
    const dari = this.at || this.desk;
    if (this.at && this.at.occupant === this) this.at.occupant = null;
    if (!k.bersama) k.occupant = this;
    this.at = null; this.target = k; this.cb = cb; this.walking = true; this.dari = dari; this.sudahBalik = false;
    siapJalan(this.P);
    this.ruteAsli = R.rute(dari, k);
    ORANG.jalanKe(this.P, this.ruteAsli, () => this.arrive(), LAJU);
  }
  // berbalik: titik R.rute yang sudah dilewati, dibalik, lalu ke titik asal (tetap lewat pintu & tangga yang sama)
  balik(cb){
    const k = this.dari, asli = this.ruteAsli || [], i = asli.length - (this.P.route ? this.P.route.length : 0);
    const pts = asli.slice(0, Math.max(0, i)).reverse();
    pts.push({x:k.x, z:k.z, y:0, lantai:k.lantai, induk:grupLantai(k.lantai)});
    this.lepasAntre();
    if (this.target && this.target.occupant === this) this.target.occupant = null;
    this.dari = this.target; this.target = k; this.cb = cb; if (!k.bersama) k.occupant = this;
    this.ruteAsli = pts; this.sudahBalik = true;
    ORANG.jalanKe(this.P, pts, () => this.arrive(), LAJU);
  }
  lepasAntre(){ if (this.antre){ const q = this.antre.k; if (q.occupant === this && q !== this.target && q !== this.at) q.occupant = null; this.antre = null; } }
  arrive(){
    const k = this.target; this.walking = false; this.at = k; this.target = null; this.arrivedAt = NOW;
    if (!k.bersama) k.occupant = this;
    let cb = this.cb; this.cb = null;
    if (this.antre){
      const q = this.antre; this.antre = null;
      if (q.k !== k){ if (this.lookTunda) this.dandani(this.lookTunda); this.walkTo(q.k, {cb:q.cb}); return; }
      cb = q.cb;
    }
    ORANG.atur(this.P, {pose:k.duduk ? 'duduk' : 'berdiri', aksi:this.aksiInginan(k) || (k.duduk ? 'dengar' : 'berdiri'), r:k.r});
    if (this.lookTunda) this.dandani(this.lookTunda);
    cb && cb();
  }
  /* ---- kerja ---- */
  isResting(){ return this.mode === 'idle' && !this.obrol && !this.walking && this.at === this.desk; }
  leaveActivity(){
    if (this.obrol) this.obrol.keluar(this);
    this.obrol = null; this.nextAt = Infinity;
    this.akhiriKeg();
  }
  // ngopi/merokok dihentikan (dipanggil Kepala, mulai kerja, melapor): gelas/rokok dilepas, jalan seperti biasa
  akhiriKeg(){
    this.keg = null;
    if (this.P.o.bawa) ORANG.atur(this.P, {bawa:null});
  }
  // tempat kerja: kursinya sendiri, atau sesekali (±15%) kursi kerja kosong di Teras Lt 2 (rooftop)
  tempatKerja(){
    const t = this.kerjaDi;
    if (t && (!t.occupant || t.occupant === this) && !t.pemilik) return t;
    this.lepasKerjaDi();
    if (this.desk && this.desk.jenis !== 'teras' && !this.temp && Math.random() < .15){
      const bebas = KURSI.filter(k => k.jenis === 'teras' && !k.pemilik && !k.occupant);
      if (bebas.length) this.kerjaDi = rnd(bebas);
    }
    return this.kerjaDi || this.desk;
  }
  lepasKerjaDi(){
    if (!this.kerjaDi) return;
    if (this.kerjaDi.layarInfo) aturLayar(this.kerjaDi.layarInfo, 'normal');
    this.kerjaDi = null;
  }
  // mulai ngopi (pantry lt 1) atau merokok (HANYA titik luar gedung: taman/halaman lt 1, tepi teras lt 2); maks 2 orang per kegiatan
  mulaiKeg(jenis){
    if (this.temp || !this.desk || this.obrol || this.keg || this.walking || NOW - this.kegTerakhir < 90) return false;
    if (jenis === 'rokok' && !this.perokok) return false;
    if (state.list.filter(m => m.keg && m.keg.jenis === jenis).length >= 2) return false;
    const spot = (R.titikSantai || []).filter(t => t.jenis === jenis && !t.occupant);
    if (!spot.length) return false;
    const sama = spot.filter(t => t.lantai === this.desk.lantai), k = rnd(sama.length ? sama : spot);
    const g = this.keg = {jenis, k, fase:'jalan', t:NOW, aksi:'berdiri'};
    this.kegTerakhir = NOW; this.nextAt = Infinity;
    this.activity = jenis === 'kopi' ? 'Ke pantry, mau ngopi' : 'Keluar gedung sebentar, mau merokok';
    this.walkTo(k, {cb:() => { if (this.keg === g && this.mode === 'idle'){ g.fase = 'tiba'; g.t = NOW; } }});
    return true;
  }
  kegTick(){
    const g = this.keg;
    if (g.fase === 'jalan' || this.at !== g.k) return;
    if (g.jenis === 'kopi'){
      if (g.fase === 'tiba'){ g.aksi = 'berdiri'; this.activity = 'Membuat kopi di pantry'; if (NOW - g.t > 3){ g.fase = 'minum'; g.t = NOW; g.aksi = 'minum'; g.sampai = NOW + rand(9, 15);
        ORANG.atur(this.P, {aksi:'minum', bawa:'kopi'}); this.activity = 'Ngopi di pantry'; if (Math.random() < .6) this.bubble(rnd(KAL_KOPI), 'idle', 2600); } }
      else if (NOW > g.sampai){ this.kopiSampai = NOW + rand(25, 45); this.keg = null; this.rest(); }
      return;
    }
    if (g.fase === 'tiba'){
      g.fase = 'rokok'; g.aksi = 'rokok'; g.sampai = NOW + rand(16, 26);
      ORANG.atur(this.P, {pose:'berdiri', aksi:'rokok', r:g.k.r, bawa:'rokok', asap:!RM && SET.kualitas !== 'hemat'});
      this.activity = 'Merokok di ' + (g.k.nama || 'luar gedung'); if (Math.random() < .5) this.bubble(rnd(KAL_ROKOK), 'idle', 2600);
    } else if (NOW > g.sampai){ ORANG.atur(this.P, {bawa:null}); this.keg = null; this.rest(); }
  }
  // dipanggil Kepala: ke Ruang Pimpinan (titik lapor kosong) menerima brief, lalu ke kursinya
  summon(desc){
    this.job = {agentId:null, reserved:true, since:NOW, last:NOW, desc:desc || ''};
    if (this.team) this.team.reserveQ.push(this);
    this.desc = desc || '';
    this.leaveActivity(); this.reporting = false; this.segeraKerja = false;
    const sp = titikLaporIni(this);
    if (!sp){ this.bubble('📥 Siap, Bos!', 'ok', 2600); this.startWork(); return; }
    this.mode = 'brief'; this.activity = 'Dipanggil Kepala: ' + short(desc || 'tugas baru', 36);
    this.walkTo(sp, {cb:() => {
      if (this.mode !== 'brief') return;
      ORANG.atur(this.P, {pose:'berdiri', aksi:'dengar', r:sp.r});
      this.bubble('📥 Siap, Bos!', 'ok', 2600);
      boss.bubble('📋 ' + this.name + ', tolong kerjakan:\n' + short(desc || 'tugas baru', 40), 'info', 4000); boss.bicaraSampai = NOW + 3.2;
      this.activity = 'Menerima brief dari Kepala';
      setTimeout(() => { if (this.mode === 'brief') this.startWork(true); }, this.segeraKerja ? 1400 : 2400);
    }});
  }
  reserve(desc){
    this.job = {agentId:null, reserved:true, since:NOW, last:NOW, desc:desc || ''};
    if (this.team) this.team.reserveQ.push(this);
    this.desc = desc || ''; this.activity = 'Menuju meja: ' + short(desc || 'tugas baru', 40);
    this.startWork();
  }
  bind(agentId){
    if (!this.job) this.job = {agentId:null, reserved:false, since:NOW, last:NOW, desc:state.pendingDesc.get(this.team && this.team.key) || ''};
    if (agentId){ this.job.agentId = agentId; state.byAgent.set(agentId, this); }
    this.job.reserved = false;
    if (this.team){ const i = this.team.reserveQ.indexOf(this); if (i >= 0) this.team.reserveQ.splice(i, 1); }
    if (this.mode !== 'work') this.startWork();
  }
  // selesaiBrief = dipanggil dari brief. Selama masih menuju brief, kerja menunggu brief selesai (tidak memutar balik di tengah jalan).
  startWork(selesaiBrief){
    if (this.mode === 'brief' && !selesaiBrief){ this.segeraKerja = true; return; }
    this.leaveActivity(); this.reporting = false; this.mode = 'work';
    const tk = this.tempatKerja();
    if (this.walking || this.at !== tk) this.walkTo(tk, {cb:() => { if (this.mode === 'work') this.activity = this.activity.startsWith('Menuju') || this.activity.startsWith('Menerima') ? (tk === this.desk ? 'Bekerja di mejanya' : 'Bekerja di Teras Lt 2 (rooftop)') : this.activity; }});
  }
  work(cat){
    this.lastWork = NOW; if (cat) this.workCat = cat; this.waiting = false;
    if (this.job) this.job.last = NOW;
    if (!this.boss && !this.npc && this.mode !== 'work') this.startWork();
  }
  release(){
    if (this.job && this.job.agentId && state.byAgent.get(this.job.agentId) === this) state.byAgent.delete(this.job.agentId);
    if (this.team){ const i = this.team.reserveQ.indexOf(this); if (i >= 0) this.team.reserveQ.splice(i, 1); }
    this.job = null; this.waiting = false;
  }
  finish(){
    this.release(); this.lastWork = -1e9;
    this.activity = 'Selesai, lapor ke Kepala'; this.bubble('✅ Selesai! Lapor ke Kepala…', 'ok', 3500);
    this.report();
  }
  // melapor: jalan ke titik lapor kosong → berdiri bicara → Kepala berterima kasih → ±3,8 dtk kemudian kembali ke kursinya
  report(){
    this.leaveActivity(); this.mode = 'report'; this.reporting = false;
    const sp = titikLaporIni(this);
    if (!sp){ boss.bubble('👍 Terima kasih, ' + this.name + '!', 'ok', 3000); this.afterReport(); return; }
    this.walkTo(sp, {cb:() => {
      if (this.mode !== 'report') return;
      ORANG.atur(this.P, {pose:'berdiri', aksi:'bicara', r:sp.r});
      this.reporting = true; this.activity = 'Melapor ke Kepala';
      this.bubble('📄 Lapor, Bos: tugas selesai!', 'ok', 2600);
      setTimeout(() => { if (this.mode === 'report'){ boss.bubble(rnd(['👍 Mantap, terima kasih ', '👌 Bagus, ', '🙏 Terima kasih, ']) + this.name + '!', 'ok', 3000); boss.bicaraSampai = NOW + 2.4; } }, 1300);
      setTimeout(() => { if (this.mode === 'report' && this.at === sp && !this.walking) this.afterReport(); }, 3800);
    }});
  }
  afterReport(){
    this.reporting = false;
    if (this.temp){ this.mode = 'leave'; this.activity = 'Pamit pulang'; this.walkTo(PINTU, {cb:() => this.dispose()}); return; }
    this.rest();
  }
  /* ---- santai ---- */
  rest(delay = 0){
    this.obrol = null; this.mode = 'idle'; this.lepasKerjaDi();
    const settle = () => { if (this.mode !== 'idle' || this.obrol) return; this.pilihSantai(); this.nextAt = NOW + rand(10, 24) * (RM ? 2 : 1) + delay; };
    if (this.at === this.desk && !this.walking) settle();
    else { this.nextAt = Infinity; this.activity = 'Kembali ke meja'; this.walkTo(this.desk, {cb:settle}); }
  }
  // variasi ringan di kursi sendiri (aksi desain orang3d.js); karakter desain sering kembali ke aksi bawaannya
  pilihSantai(){
    if (this.P.o.bawa === 'kopi'){      // pulang dari pantry: kopi dihabiskan dulu di meja
      if (NOW < this.kopiSampai){ this.aksiSantai = 'minum'; this.activity = 'Menikmati kopi di meja'; return; }
      ORANG.atur(this.P, {bawa:null});
    }
    const duduk = !this.desk || this.desk.duduk;
    const opsi = duduk ? ['dengar', 'dengar', 'hp', 'minum', 'santai', 'telepon'] : ['dengar', 'hp', 'minum', 'pinggang', 'telepon'];
    if (this.aksiDesain) opsi.push(this.aksiDesain, this.aksiDesain, this.aksiDesain);
    this.aksiSantai = rnd(opsi); this.activity = ACT_TXT[this.aksiSantai] || 'Santai di meja';
  }
  idleTick(){
    this.nextAt = NOW + rand(10, 24) * (RM ? 2 : 1);
    const u = Math.random();
    if (!RM && u < .35 && mulaiObrol(this)) return;
    if (u >= .35 && u < .45 && this.mulaiKeg('kopi')) return;     // ±10% ngopi ke pantry
    if (u >= .45 && u < .51 && this.mulaiKeg('rokok')) return;    // ±6% merokok di luar (hanya perokok)
    this.pilihSantai();
  }
  // aksi yang diinginkan saat tidak berjalan (null = biarkan)
  aksiInginan(k = this.at){
    if (this.npc) return null;
    if (this.waiting) return 'lambai';
    if (this.boss) return NOW < this.bicaraSampai ? 'bicara' : this.isWorking ? 'ketik' : this.aksiSantai;
    if (this.obrol) return this.obrol.aksi(this);
    switch (this.mode){
      case 'work': return k === this.desk || (k && k === this.kerjaDi) ? 'ketik' : (k && k.duduk ? 'dengar' : 'berdiri');
      case 'brief': return k && k.jenis === 'lapor' ? 'dengar' : 'berdiri';
      case 'report': return this.reporting ? 'bicara' : 'berdiri';
      case 'leave': return 'berdiri';
    }
    if (this.keg) return this.keg.aksi || 'berdiri';
    if (k === this.desk) return this.aksiSantai;
    return k && k.duduk ? 'dengar' : 'berdiri';
  }
  get isWorking(){ return this.boss ? NOW - this.lastWork < 14 : this.mode === 'work'; }
  get status(){
    if (this.npc) return 'npc';
    if (this.waiting) return 'menunggu';
    if (NOW - this.errorAt < 7) return 'kendala';
    if (this.mode === 'report') return 'melapor';
    if (this.mode === 'brief') return 'dipanggil';
    if (this.boss) return this.isWorking ? 'bekerja' : 'santai';
    if (this.mode === 'work') return this.walking ? 'jalan' : 'bekerja';
    if (this.walking) return 'jalan';
    return 'santai';
  }
  update(dt, t){
    const P = this.P;
    // label: ±2,1 m berdiri / ±1,65 m duduk; disembunyikan bila lantainya tidak terlihat (CSS2D tidak mengecek induk)
    const ly = P.sit ? 1.65 : 2.1; if (this.label.position.y !== ly) this.label.position.y = ly;
    const tampak = terlihat(P.root.parent) && lantaiTampak(lantaiDari(P)) && !this.tertutup;
    if (this.label.visible !== tampak) this.label.visible = tampak;
    // aksi sesuai keadaan (pose & arah hadap diatur saat tiba)
    if (!this.walking){ const a = this.aksiInginan(); if (a && a !== P.o.aksi) ORANG.atur(P, {aksi:a, r:P.r0}); }
    // cincin & kelas label
    const st = this.status, sel = state.selected === this;
    const wc = 'tagwrap st-' + st + (sel ? ' sel' : '');
    if (wc !== this._st){ this._st = wc; this.wrap.className = wc; }
    this.ring.visible = sel || st === 'menunggu' || st === 'kendala';
    if (this.ring.visible){
      this.ringMat.color.set(st === 'menunggu' ? WARNA_CINCIN.menunggu : st === 'kendala' ? WARNA_CINCIN.kendala : WARNA_CINCIN.pilih);
      this.ring.scale.setScalar(sel && st !== 'menunggu' ? 1 : 1 + Math.sin(t * 5) * .08 * (RM ? 0 : 1));
    }
    // layar monitor meja: warna = jenis kerja saat bekerja di kursinya; semula saat santai; redup saat pemilik meninggalkan kursi
    const L = this.desk && this.desk.layarInfo;
    if (L){
      const diKursi = !this.walking && this.at === this.desk;
      aturLayar(L, diKursi && this.isWorking ? 'kerja' : diKursi ? 'normal' : 'redup', this.workCat, t, this.phase);
    }
    // laptop kursi teras menyala sesuai jenis kerja saat dipakai bekerja
    if (this.kerjaDi){
      const Lt = infoLayar(this.kerjaDi);
      if (Lt) aturLayar(Lt, !this.walking && this.at === this.kerjaDi && this.isWorking ? 'kerja' : 'normal', this.workCat, t, this.phase);
    }
    if (this.keg && !this.walking && this.mode === 'idle') this.kegTick();
    if (this.mode === 'idle' && !this.walking && NOW >= this.nextAt) this.idleTick();
  }
  dispose(){
    if (this.at && this.at.occupant === this) this.at.occupant = null;
    if (this.target && this.target.occupant === this) this.target.occupant = null;
    this.lepasAntre();
    if (this.desk){
      if (this.desk.pemilik === this.P.o.id) this.desk.pemilik = null;
      this.desk.dipakai = Math.max(0, (this.desk.dipakai || 1) - 1);
      if (this.desk.occupant === this) this.desk.occupant = null;
      if (this.desk.layarInfo) aturLayar(this.desk.layarInfo, 'normal');
    }
    this.release(); this.leaveActivity(); this.lepasKerjaDi();
    this.P.root.remove(this.label); this.P.root.remove(this.ring); this.ringMat.dispose(); clearTimeout(this.bubT);
    AKAR.delete(this.P.root); delete this.P.root.userData.aktor;
    if (this.desain){ DESAIN_DIPAKAI.delete(this.desain); ORANG.atur(this.P, {aksi:this.aksiDesain || 'dengar'}); }
    else buangKarakter(this.P);
    if (this.team){ const i = this.team.members.indexOf(this); if (i >= 0) this.team.members.splice(i, 1); }
    const j = state.list.indexOf(this); if (j >= 0) state.list.splice(j, 1);
    ACTORS.delete(this.id);
    if (this.rowEl) this.rowEl.remove();
    if (state.selected === this){ state.selected = null; follow = null; }
  }
}

/* ================= kegiatan santai =================
   Semua perjalanan lewat R.rute (tanpa jalur manual):
   (1) variasi di kursi sendiri (dengar, main HP, minum, bersandar, menelepon; meja berdiri: bertolak pinggang),
   (2) ngobrol berdua di kursi kosong ruang rapat lantai 1, dialog tanya-jawab bergantian, lalu kembali ke kursinya,
   (3) ngopi: ke titik R.titikSantai jenis 'kopi' (pantry lt 1), membuat kopi, minum (gelas di tangan), kopi dibawa & dihabiskan di meja,
   (4) merokok (hanya ±1/3 orang): ke titik jenis 'rokok' yang semuanya di LUAR gedung (taman, halaman depan, tepi teras), lalu kembali.
   Maks 2 orang per kegiatan (3)/(4) sekaligus, jeda ≥ 90 dtk per orang; dipanggil Kepala/mulai kerja = kegiatan langsung dihentikan. */
const IDLE_ACTS = [['meja', 3, false], ['ngobrol', 1.3, true], ['ngopi', 1, false], ['rokok', .5, false]];
const OBROL = new Set();
class Obrolan {
  constructor(pasang){
    this.m = pasang.map(p => p.a); this.k = pasang.map(p => p.k); this.fase = 'kumpul'; this.t0 = NOW; this.tiba = new Set(); this.bicara = null; this.nextSpeak = 0; this.selesai = false;
    const ruang = ruangKursi(this.k[0]);
    OBROL.add(this);
    this.m.forEach((m, i) => {
      const kk = this.k[i], lain = this.m[1 - i];
      m.obrol = this; m.nextAt = Infinity; m.activity = 'Ngobrol dengan ' + lain.name + ' di ' + (ruang ? ruang.nama : 'ruang rapat');
      m.walkTo(kk, {cb:() => { if (m.obrol === this){ this.tiba.add(m); ORANG.atur(m.P, {pose:'duduk', aksi:'dengar', r:kk.r}); } }});
    });
    this.dialog = rnd(DIALOG); this.di = 0;      // dialog tanya-jawab berurutan, lalu kalimat lepas bila waktu masih ada
    this.m[0].bubble(rnd(AJAK), 'idle', 2400);
    setTimeout(() => { if (!this.selesai) this.m[1].bubble(rnd(TERIMA_AJAK), 'idle', 2000); }, 900);
  }
  aksi(m){ return this.fase === 'main' && this.bicara === m ? 'bicara' : 'dengar'; }
  keluar(m){ if (m.obrol === this) m.obrol = null; this.akhiri(); }
  akhiri(){
    if (this.selesai) return; this.selesai = true; OBROL.delete(this);
    for (const m of this.m) if (m.obrol === this){ m.obrol = null; m.rest(); }
  }
  tick(){
    if (this.fase === 'kumpul'){
      if (this.tiba.size === this.m.length){ this.fase = 'main'; this.endAt = NOW + Math.max(rand(12, 22) * (RM ? 1.5 : 1), this.dialog.length * 3.7 + 1.5); this.nextSpeak = NOW + .6; }
      else if (NOW - this.t0 > 120) this.akhiri();
      return;
    }
    if (NOW > this.endAt){ const m = rnd(this.m); m.bubble(rnd(PAMIT), 'idle', 2000); this.akhiri(); return; }
    if (NOW >= this.nextSpeak){
      let teks;
      if (this.di < this.dialog.length){ this.bicara = this.m[this.di % 2]; teks = this.dialog[this.di++]; }
      else { this.bicara = this.bicara === this.m[0] ? this.m[1] : this.m[0]; teks = rnd(CHAT); }
      this.bicara.bubble(teks, 'idle', 2900); this.nextSpeak = NOW + rand(3.1, 4.0);
    }
  }
}
// dua anggota santai di lantai 1 + dua kursi kosong di ruang rapat yang sama (utamakan yang berhadapan)
function mulaiObrol(a){
  if (OBROL.size >= 2 || !a.desk || a.desk.lantai !== 1) return false;
  const pool = state.list.filter(m => m !== a && m.isResting() && !m.temp && m.desk && m.desk.lantai === 1);
  if (!pool.length) return false;
  const bebas = KURSI.filter(k => k.jenis === 'rapat' && k.lantai === 1 && !k.pemilik && !k.occupant);
  const perRuang = new Map();
  for (const k of bebas){ const r = ruangKursi(k); if (!r) continue; (perRuang.get(r) || perRuang.set(r, []).get(r)).push(k); }
  const pilihan = [];
  for (const ks of perRuang.values()) for (let i = 0; i < ks.length; i++) for (let j = i + 1; j < ks.length; j++){
    const hadap = Math.abs(ks[i].x - ks[j].x) < .05 ? 0 : 1;
    pilihan.push({a:ks[i], b:ks[j], skor:hadap + Math.random() * .5});
  }
  if (!pilihan.length) return false;
  pilihan.sort((x, y) => x.skor - y.skor);
  const p = pilihan[0], b = rnd(pool);
  new Obrolan([{a, k:p.a}, {a:b, k:p.b}]);
  return true;
}

const GCACHE = new Map();
const gkey = (...a) => a.join('|');
function geoBox(w, h, d){ const k = gkey('b', w, h, d); let g = GCACHE.get(k); if (!g){ g = new THREE.BoxGeometry(w, h, d); GCACHE.set(k, g); } return g; }
function geoCyl(rt, rb, h, s){ const k = gkey('c', rt, rb, h, s); let g = GCACHE.get(k); if (!g){ g = new THREE.CylinderGeometry(rt, rb, h, s); GCACHE.set(k, g); } return g; }
function geoSph(r, w, h){ const k = gkey('s', r, w, h); let g = GCACHE.get(k); if (!g){ g = new THREE.SphereGeometry(r, w, h); GCACHE.set(k, g); } return g; }
const MATS = {};
function mat(name, color, o = {}){
  if (MATS[name]) return MATS[name];
  const m = new THREE.MeshStandardMaterial({color, roughness:o.r ?? .82, metalness:o.m ?? 0});
  if (o.e){ m.emissive = new THREE.Color(o.e); m.emissiveIntensity = o.ei ?? .6; }
  if (o.t){ m.transparent = true; m.opacity = o.t; m.depthWrite = false; }
  if (o.ds) m.side = THREE.DoubleSide;
  m.name = name; return (MATS[name] = m);
}
// material desain yang dipakai ulang lingkungan luar (dicari dari model; cadangan bila tidak ada)
let K = null;
function materialDesain(){
  const cari = (nama, warna, o) => { let f = null; R.model.traverse(x => { if (!f && x.isMesh && !Array.isArray(x.material) && x.material.name === nama) f = x.material; }); return f || mat(nama, warna, o); };
  K = {trunk:cari('batang', '#7a5a40'), leaf:cari('daun', '#4f9a5b'), leaf2:cari('daun_muda', '#6cb572'), window:cari('jendela', '#a9d6f0', {e:'#6fb7e6', ei:.35, r:.1}),
    warm:cari('lampu_hangat', '#fff1c9', {e:'#ffd27a', ei:1.2})};
}

/* ================= LINGKUNGAN LUAR =================
   Langit bergradasi + kabut, tanah, trotoar, jalan, pagar, pohon, parkir & mobil, lampu jalan, bukit & siluet kota, awan, burung,
   kupu-kupu, papan LED status live, dan bendera divisi yang menyala saat divisinya bekerja.
   Semua di luar gedung desain (menempel pada lantai 1, bawaan Mati). Mesh statis digabung per material dan tidak melempar bayangan. */
const ENV = {ok:false, level:null, sederhana:null, lengkap:null, hidupS:null, hidupL:null, langit:null, tanah:null, awan:[], burung:null, kupu:[],
  bendera:[], papan:null, kolam:null, lampuDalam:[], lampuMat:null, kotaMat:null, jendela:null, kabutDekat:70, burungAt:0, papanSig:''};
const SUASANA = {
  siang:{nama:'Siang', zenit:'#5f9fe6', cakrawala:'#dcebf6', hemi:[0xffffff, 0xd8d2c4, 1.0], key:[0xffffff, 2.2], fill:.5, latar:TEMA.latar, lampu:0, kota:0, jendela:0},
  sore: {nama:'Sore', zenit:'#4f5f9c', cakrawala:'#f3c7a0', hemi:[0xffe9d2, 0xc9b39c, .85], key:[0xffbf80, 1.75], fill:.3, latar:'#eadfd6', lampu:.5, kota:.08, jendela:.45},
  malam:{nama:'Malam', zenit:'#070d1f', cakrawala:'#243353', hemi:[0x9aaee0, 0x2a2f3a, .38], key:[0xa9bcff, .32], fill:.1, latar:'#1c2230', lampu:2.2, kota:.55, jendela:1.1},
};
const R_LANGIT = 900, KABUT_JAUH = 330;
function levelLingkungan(){ return SET.lingkungan === 'lengkap' && SET.kualitas === 'hemat' ? 'sederhana' : SET.lingkungan; }
function bangunLingkungan(){
  let seed = 11; const acak = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const M = {
    trotoar:mat('trotoar', '#d9d3c8'), kerb:mat('kerb', '#bdb6aa'), aspal:mat('aspal', '#5d626b', {r:.95}), aspal2:mat('aspal_parkir', '#686e77', {r:.95}),
    marka:mat('marka_jalan', '#f4f1e8', {r:.7}), markaK:mat('marka_kuning', '#e9b949', {r:.7}), pagar:mat('pagar_besi', '#3a3f48', {r:.5, m:.3}),
    pagarHidup:mat('pagar_tanaman', '#4c8a4f'), tiang:mat('tiang_lampu', '#4a505a', {r:.5, m:.3}), tiang2:mat('tiang_bendera', '#e9ecef', {r:.4, m:.4}),
    kacaMobil:mat('kaca_mobil', '#2c3e50', {r:.15, m:.2}), ban:mat('ban', '#1b1d22', {r:.8}), lampuDepan:mat('lampu_mobil', '#fff8e6', {e:'#fff1c9', ei:.5}),
    lampuBelakang:mat('lampu_belakang', '#c0392b', {e:'#ff3b3b', ei:.4}), bukit:mat('bukit', '#86ab8c', {r:1}), bukit2:mat('bukit_2', '#9dbca2', {r:1}),
    kota1:mat('gedung_kota', '#aab7c8', {r:.9, e:'#ffd48a', ei:0}), kota2:mat('gedung_kota_2', '#9aaabf', {r:.9, e:'#ffd48a', ei:0}),
    rangka:mat('rangka_papan', '#1d2433', {r:.5}), planter:mat('planter_papan', '#8a7d6b'), bunga:[mat('bunga_merah', '#ef476f'), mat('bunga_kuning', '#f6c945'),
      mat('bunga_ungu', '#b086e8'), mat('bunga_putih', '#fbfaf6')],
  };
  ENV.lampuMat = mat('lampu_jalan', '#fff4dc', {e:'#ffd9a0', ei:0});
  ENV.kotaMat = [M.kota1, M.kota2];
  ENV.jendela = {mat:K.window, em:K.window.emissive.clone(), ei:K.window.emissiveIntensity};
  const bx = (p, w, h, d, m, x, y, z, ry = 0) => { const me = new THREE.Mesh(geoBox(w, h, d), m); me.position.set(x, y + h / 2, z); me.rotation.y = ry; p.add(me); return me; };
  const cy = (p, rt, rb, h, m, x, y, z, s = 12) => { const me = new THREE.Mesh(geoCyl(rt, rb, h, s), m); me.position.set(x, y + h / 2, z); p.add(me); return me; };
  const sp = (p, r, m, x, y, z, s = 12) => { const me = new THREE.Mesh(geoSph(r, s, Math.round(s * .7)), m); me.position.set(x, y, z); p.add(me); return me; };
  const pohon = (p, x, z, s = 1, cemara = false) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(s); p.add(g);
    cy(g, .13, .18, cemara ? 1.2 : 1.7, K.trunk, 0, 0, 0, 8);
    if (cemara){ for (const [r, h, y] of [[1.1, 1.9, 1.0], [.8, 1.5, 2.1], [.5, 1.1, 3.0]]){ const c = new THREE.Mesh(new THREE.ConeGeometry(r, h, 9), K.leaf); c.position.y = y + h / 2; g.add(c); } }
    else { sp(g, .9, K.leaf, 0, 2.1, 0, 10); sp(g, .62, K.leaf2, .45, 2.4, .2, 10); sp(g, .58, K.leaf, -.42, 2.45, -.25, 10); }
    return g;
  };
  const semak = (p, x, z, s = 1) => { sp(p, .42 * s, K.leaf, x, .25 * s, z, 10); sp(p, .32 * s, K.leaf2, x + .35 * s, .22 * s, z + .1, 10); sp(p, .3 * s, K.leaf, x - .32 * s, .2 * s, z - .08, 10); };
  const bunga = (p, x, z) => { for (let i = 0; i < 7; i++) sp(p, .07, M.bunga[i % 4], x + (acak() - .5) * .9, .16 + acak() * .08, z + (acak() - .5) * .35, 8); sp(p, .28, K.leaf2, x, .1, z, 10); };

  // --- bahan sementara (koordinat kantor) → digabung per material ke grup level ---
  const tmpS = new THREE.Group(), tmpL = new THREE.Group(); LUARG.add(tmpS, tmpL);
  const J = LUAR.jalan;
  // trotoar, kerb, jalan & marka
  bx(tmpS, 85, .03, 2.5, M.trotoar, 2.5, -.01, 14.95);
  bx(tmpS, 85, .08, .25, M.kerb, 2.5, -.01, 16.32);
  bx(tmpS, 85, .015, J.z1 - J.z0, M.aspal, 2.5, -.012, (J.z0 + J.z1) / 2);
  for (let x = -38; x <= 42; x += 4) bx(tmpS, 2, .006, .14, M.marka, x, .004, (J.z0 + J.z1) / 2);
  for (const z of [J.z0 + .3, J.z1 - .3]) bx(tmpS, 85, .006, .1, M.marka, 2.5, .004, z);
  bx(tmpS, 85, .08, .25, M.kerb, 2.5, -.01, J.z1 + .12);
  bx(tmpS, 85, .03, 2, M.trotoar, 2.5, -.01, J.z1 + 1.25);
  // zebra cross di depan pintu masuk
  for (let i = 0; i < 7; i++) bx(tmpS, .45, .006, J.z1 - J.z0 - 1, M.marka, -13.4 + i * .9, .004, (J.z0 + J.z1) / 2);
  // pagar besi depan (celah = jalan masuk lobi)
  const pagarZ = 13.62, celah = [-13, -10];
  for (let x = -15.1; x <= 22.2; x += 1.1){ if (x > celah[0] - .05 && x < celah[1] + .05) continue; bx(tmpS, .05, .78, .05, M.pagar, x, 0, pagarZ); }
  for (const [a, b] of [[-15.1, celah[0]], [celah[1], 22.2]]) for (const y of [.3, .66]) bx(tmpS, b - a, .035, .035, M.pagar, (a + b) / 2, y, pagarZ);
  // pagar tanaman keliling (utara, timur, barat antara parkir dan lobi)
  bx(tmpS, 58, .9, .8, M.pagarHidup, -5, 0, -12.2);
  bx(tmpS, .8, .9, 25.6, M.pagarHidup, 23.4, 0, .6);
  bx(tmpS, .7, .7, 22.2, M.pagarHidup, -16.45, 0, 2.3);
  // pohon di luar pagar
  for (const x of [-30, -20, -8, 4, 16]) pohon(tmpS, x, -14.2, .95 + acak() * .25, acak() < .35);
  for (const z of [-8, 1, 10]) pohon(tmpS, 25.6, z, .9 + acak() * .3, acak() < .4);
  semak(tmpS, -13.6, 13.1); semak(tmpS, -9.4, 13.1);
  // lampu taman (menyala malam): tiang pendek di taman & halaman depan, di luar pohon, kolam, dek, bangku, dan jalan setapak desain
  ENV.tamanMat = mat('lampu_taman', '#fff4dc', {e:'#ffd9a0', ei:0});
  for (const [x, z] of LUAR.lampuTaman){ cy(tmpS, .05, .07, .72, M.tiang, x, 0, z, 10); sp(tmpS, .1, ENV.tamanMat, x, .8, z, 12); }
  // --- lengkap: parkir, mobil, lampu jalan, pohon seberang jalan, bunga, bukit, kota ---
  const P = LUAR.parkir, pw = P.x1 - P.x0, pd = P.z1 - P.z0;
  bx(tmpL, pw, .015, pd, M.aspal2, (P.x0 + P.x1) / 2, -.012, (P.z0 + P.z1) / 2);
  const baris = [[P.x0, P.x0 + 4.5, 1], [P.x1 - 4.5, P.x1, -1]];
  for (const [a, b] of baris) for (let i = 0; i <= 8; i++) bx(tmpL, b - a, .006, .1, M.marka, (a + b) / 2, .004, P.z0 + .6 + i * 2.6);
  for (let z = P.z0 + 1; z < P.z1 - 1; z += 3) bx(tmpL, .12, .006, 1.4, M.markaK, (P.x0 + P.x1) / 2, .004, z);
  const mobil = (x, z, arah, warna) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = arah > 0 ? 0 : PI; tmpL.add(g);
    const cat = mat('cat_mobil_' + warna.slice(1), warna, {r:.35, m:.25});
    bx(g, 4.1, .55, 1.8, cat, 0, .27, 0); bx(g, 2.2, .5, 1.62, cat, -.25, .8, 0); bx(g, 2.26, .32, 1.66, M.kacaMobil, -.25, .87, 0);
    for (const [sx, sz] of [[1.3, .82], [1.3, -.82], [-1.3, .82], [-1.3, -.82]]){ const w = new THREE.Mesh(geoCyl(.33, .33, .26, 14), M.ban); w.rotation.x = PI / 2; w.position.set(sx, .33, sz); g.add(w); }
    for (const sz of [-.6, .6]){ bx(g, .05, .12, .34, M.lampuDepan, 2.05, .52, sz); bx(g, .05, .12, .3, M.lampuBelakang, -2.05, .55, sz); }
  };
  const isi = [0, 2, 3, 5, 7, 9, 10, 12, 15];
  isi.forEach((k, i) => {
    const kanan = k >= 8, j = k % 8, z = P.z0 + .6 + j * 2.6 + 1.3;
    mobil(kanan ? P.x1 - 2.35 : P.x0 + 2.35, z, kanan ? -1 : 1, LUAR.warnaMobil[i % LUAR.warnaMobil.length]);
  });
  const lampuJalan = (p, x, z, arah = 1) => {
    cy(p, .06, .08, 4.4, M.tiang, x, 0, z, 10);
    bx(p, .07, .07, 1.1, M.tiang, x, 4.28, z + arah * .5);
    bx(p, .36, .12, .5, ENV.lampuMat, x, 4.16, z + arah * 1.0);
    return [x, z + arah * 1.0];
  };
  const titikCahaya = LUAR.lampuJalan.map(x => lampuJalan(tmpL, x, 15.95, 1));
  titikCahaya.push(lampuJalan(tmpL, (P.x0 + P.x1) / 2 - .4, -2, 1), lampuJalan(tmpL, (P.x0 + P.x1) / 2 - .4, 8, 1));
  for (let x = -38, i = 0; x <= 2; x += 6.5, i++) pohon(tmpL, x + acak() * 1.5, J.z1 + 3.6 + acak(), .9 + acak() * .35, i % 3 === 1);
  for (const [x, z] of [[-35.5, -5], [-35.5, 4], [-35.5, 12], [-16.9, -10.8], [24.8, -11.5], [24.8, 13]]) pohon(tmpL, x, z, .85 + acak() * .3, acak() < .5);
  for (const x of LUAR.bunga) bunga(tmpL, x, 13.25);
  // bukit & siluet kota jauh (dibaurkan kabut)
  const bukit = [[-250, -250, 120, 40, 0], [-60, -330, 150, 46, 1], [170, -300, 125, 34, 0], [320, -120, 110, 30, 1], [-330, 40, 115, 34, 1], [330, 140, 100, 26, 0], [-230, -340, 100, 28, 1], [70, 340, 140, 30, 0]];
  for (const [x, z, r, h, v] of bukit){ const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), v ? M.bukit2 : M.bukit); m.scale.set(r, h, r * .8); m.position.set(x, -h * .15, z); tmpL.add(m); }
  for (let i = 0; i < 38; i++){
    const x = -90 + i * 7.5 + (acak() - .5) * 5, z = -255 - acak() * 40, w = 7 + acak() * 10, d = 7 + acak() * 10, h = 14 + Math.pow(acak(), 1.6) * 60;
    bx(tmpL, w, h, d, acak() < .5 ? M.kota1 : M.kota2, x, 0, z);
  }
  LUARG.updateMatrixWorld(true);
  ENV.sederhana = new THREE.Group(); ENV.lengkap = new THREE.Group(); LUARG.add(ENV.sederhana, ENV.lengkap);
  gabungStatis(tmpS, ENV.sederhana, {bayang:false, terima:true, semua:true}); gabungStatis(tmpL, ENV.lengkap, {bayang:false, terima:true, semua:true});
  while (tmpS.children.length) ENV.sederhana.attach(tmpS.children[0]);
  while (tmpL.children.length) ENV.lengkap.attach(tmpL.children[0]);
  LUARG.remove(tmpS, tmpL);

  // --- tanah & langit ---
  const tanah = new THREE.Mesh(new THREE.CircleGeometry(620, 48), mat('tanah_luar', '#a3c888', {r:.97}));
  tanah.rotation.x = -PI / 2; tanah.position.set(3, -.012, 0); tanah.receiveShadow = true; LUARG.add(tanah); ENV.tanah = tanah;
  const lg = new THREE.SphereGeometry(R_LANGIT, 32, 16);
  lg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(lg.attributes.position.count * 3), 3));
  ENV.langit = new THREE.Mesh(lg, new THREE.MeshBasicMaterial({vertexColors:true, side:THREE.BackSide, fog:false, depthWrite:false, depthTest:false}));
  ENV.langit.renderOrder = -10; ENV.langit.frustumCulled = false; scene.add(ENV.langit);

  // --- benda hidup (koordinat kantor) ---
  ENV.hidupS = new THREE.Group(); ENV.hidupL = new THREE.Group(); LUARG.add(ENV.hidupS, ENV.hidupL);
  bangunPapan(ENV.hidupS, bx, M);
  bangunBendera(ENV.hidupS, bx, cy, M);
  // genangan cahaya lampu jalan (malam)
  const kg = [];
  for (const [x, z, r] of [...titikCahaya, ...LUAR.lampuTaman.map(([x, z]) => [x, z, 1.3])]){ const g = new THREE.CircleGeometry(r || 3.4, 24); g.rotateX(-PI / 2); g.translate(x, .012, z); kg.push(g); }
  ENV.kolam = new THREE.Mesh(gabungDaftar(kg), new THREE.MeshBasicMaterial({color:'#ffcf8a', transparent:true, opacity:.22, depthWrite:false, blending:THREE.AdditiveBlending}));
  ENV.kolam.visible = false; ENV.hidupL.add(ENV.kolam);
  // awan
  const awanMat = mat('awan', '#ffffff', {r:1, e:'#ffffff', ei:.45});
  for (let i = 0; i < 11; i++){
    const gs = [];
    for (let k = 0; k < 5; k++){ const r = 5 + acak() * 5; const g = new THREE.SphereGeometry(r, 10, 7); g.scale(1, .62, 1); g.translate((k - 2) * 5.5 + (acak() - .5) * 3, (acak() - .3) * 2.5, (acak() - .5) * 5); gs.push(g); }
    const m = new THREE.Mesh(gabungDaftar(gs), awanMat); for (const g of gs) g.dispose();
    m.position.set(-280 + acak() * 560, 42 + acak() * 26, -260 + acak() * 330); m.userData.v = .5 + acak() * .6; ENV.hidupL.add(m); ENV.awan.push(m);
  }
  // burung (kawanan kecil, sesekali melintas)
  const bMat = mat('burung', '#2f3542', {r:.8}), sayap = geoBox(.55, .02, .2), badan = geoBox(.12, .08, .32);
  ENV.burung = new THREE.Group(); ENV.burung.visible = false; ENV.hidupL.add(ENV.burung);
  for (let i = 0; i < 5; i++){
    const b = new THREE.Group(); b.position.set((i % 2 ? -1 : 1) * Math.ceil(i / 2) * 1.6, (acak() - .5) * 1.2, -Math.ceil(i / 2) * 1.8); ENV.burung.add(b);
    b.add(new THREE.Mesh(badan, bMat));
    for (const s of [-1, 1]){ const piv = new THREE.Group(); piv.position.x = s * .06; b.add(piv); const w = new THREE.Mesh(sayap, bMat); w.position.x = s * .28; piv.add(w); b.userData['s' + (s > 0 ? 'k' : 'i')] = piv; }
  }
  ENV.burungAt = NOW + 12;
  // kupu-kupu di dekat bunga depan
  const kgeo = new THREE.PlaneGeometry(.13, .1); kgeo.translate(.065, 0, 0);
  [['#f6c945', LUAR.bunga[0], 13.25], ['#ef476f', LUAR.bunga[3], 13.25], ['#b086e8', LUAR.bunga[2], 13.25]].forEach(([c, x, z], i) => {
    const km = mat('kupu_' + c.slice(1), c, {ds:true, r:.6});
    const g = new THREE.Group(); g.userData = {x, z, f:i * 2.1}; ENV.hidupL.add(g);
    for (const s of [-1, 1]){ const w = new THREE.Mesh(kgeo, km); w.scale.x = s; g.add(w); g.userData['w' + (s > 0 ? 'k' : 'i')] = w; }
    ENV.kupu.push(g);
  });
  // lampu dalam kantor (hanya malam; tanpa bayangan)
  for (const [x, z] of [[-11.5, 2], [-12, -7], [-1, -6.8], [-1, .6], [11.8, 1.5], [3, 7.2]]){
    const l = new THREE.PointLight(0xffd9a8, 7, 12, 1.2); l.position.set(x, 2.55, z); l.visible = false; LUARG.add(l); ENV.lampuDalam.push(l);
  }
  ENV.ok = true;
}
// papan LED status live (CanvasTexture diperbarui hanya saat isinya berubah)
function bangunPapan(p, bx, M){
  const L = LUAR.papan, g = new THREE.Group(); g.position.set(L.x, 0, L.z); g.rotation.y = L.ry; p.add(g);
  for (const sx of [-1.75, 1.75]) bx(g, .12, 2.1, .12, M.tiang, sx, 0, -.05);
  bx(g, 4.3, .32, .62, M.planter, 0, 0, -.05);
  bx(g, 3.9, 1.55, .16, M.rangka, 0, .62, 0);
  const strip = new THREE.MeshStandardMaterial({color:'#1d2433', emissive:new THREE.Color('#3b6cf6'), emissiveIntensity:.8, roughness:.4});
  bx(g, 3.9, .06, .18, strip, 0, 2.17, 0);
  const c = document.createElement('canvas'); c.width = 1024; c.height = 374;
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = ANISO;
  const layar = new THREE.Mesh(new THREE.PlaneGeometry(3.7, 1.35), new THREE.MeshBasicMaterial({map:tex, toneMapped:false}));
  layar.position.set(0, 1.395, .082); g.add(layar);
  ENV.papan = {c, ctx:c.getContext('2d'), tex, strip, izin:false};
  gambarPapan(null);
}
function kotakBulat(x, X, Y, w, h, r){ x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r); x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath(); }
// teks dibatasi 200 karakter dulu, lalu pencarian biner (bukan measureText per karakter) supaya teks panjang tidak membekukan tab
function potongTeks(x, s, maks){
  const a = Array.from(String(s || '').slice(0, 402)).slice(0, 201); s = a.join('');
  if (a.length <= 200 && x.measureText(s).width <= maks) return s;
  let lo = 1, hi = Math.min(a.length, 200);
  while (lo < hi){ const m = (lo + hi + 1) >> 1; if (x.measureText(a.slice(0, m).join('') + '…').width <= maks) lo = m; else hi = m - 1; }
  return a.slice(0, lo).join('') + '…';
}
function gambarPapan(d){
  const P = ENV.papan; if (!P) return;
  const x = P.ctx, W = P.c.width, H = P.c.height, F = '"Plus Jakarta Sans", system-ui, sans-serif';
  const gr = x.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#0e1422'); gr.addColorStop(1, '#1a2336'); x.fillStyle = gr; x.fillRect(0, 0, W, H);
  x.textBaseline = 'middle';
  if (LOGO_IMG.naturalWidth) x.drawImage(LOGO_IMG, 30, 20, 58, 58);
  x.fillStyle = '#ffffff'; x.font = '800 36px ' + F; x.fillText('PADEV STUDIO CLAUDE', 102, 50);
  const mode = d ? d.mode : 'connecting';
  const [mt, mc] = {live:['● LIVE', '#3ccf8e'], demo:['● DEMO', '#f0b43c'], off:['● TERPUTUS', '#ff7b7b']}[mode] || ['● MEMUAT', '#9fb6ff'];
  x.font = '800 26px ' + F; const mw = x.measureText(mt).width + 30;
  kotakBulat(x, W - 30 - mw, 30, mw, 40, 20); x.fillStyle = 'rgba(255,255,255,.08)'; x.fill(); x.fillStyle = mc; x.fillText(mt, W - 15 - mw, 51);
  if (!d){ x.fillStyle = '#9fb6ff'; x.font = '700 30px ' + F; x.fillText('Menyiapkan kantor…', 34, 160); P.tex.needsUpdate = true; return; }
  if (d.izin){
    kotakBulat(x, 24, 100, W - 48, 118, 18); x.fillStyle = '#f0b43c'; x.fill();
    x.fillStyle = '#1d2433'; x.font = '800 50px ' + F; x.fillText(potongTeks(x, '✋ BUTUH IZIN ANDA', W - 100), 50, 140);
    x.font = '700 28px ' + F; x.fillText(potongTeks(x, d.izinSiapa + ' menunggu di Claude Code', W - 100), 52, 190);
  } else {
    x.fillStyle = d.nDiv ? '#3ccf8e' : '#c9d3e6'; x.font = '800 54px ' + F;
    const t1 = d.nDiv ? `⚡ ${d.nDiv} divisi bekerja` : '☕ Semua santai'; x.fillText(t1, 34, 142);
    const w1 = x.measureText(t1).width;
    x.fillStyle = '#9fb6ff'; x.font = '700 30px ' + F; x.fillText(potongTeks(x, d.nDiv ? `· ${d.nOrang} anggota aktif` : '· menunggu tugas', W - 80 - w1), 52 + w1, 146);
    x.fillStyle = '#e8ecf3'; x.font = '600 28px ' + F; x.fillText(potongTeks(x, '👑 Kepala: ' + (d.tugas || 'menunggu perintah Anda'), W - 70), 34, 204);
  }
  // chip divisi yang sedang aktif
  let cx = 30; const cyy = 262;
  x.font = '800 26px ' + F;
  if (!d.aktif.length){ x.fillStyle = '#7f8aa3'; x.font = '600 26px ' + F; x.fillText('Tidak ada divisi yang sedang bertugas', 34, cyy + 26); }
  for (const a of d.aktif){
    const t = a.ikon + ' ' + a.nama, w = x.measureText(t).width + 34;
    if (cx + w > W - 24){ x.fillStyle = '#9fb6ff'; x.fillText('…', cx, cyy + 26); break; }
    kotakBulat(x, cx, cyy, w, 52, 26); x.fillStyle = a.warna; x.fill();
    x.fillStyle = kontrasTeks(a.warna); x.fillText(t, cx + 17, cyy + 27); cx += w + 12;
  }
  x.fillStyle = '#5b6680'; x.font = '600 20px ' + F; x.fillText(potongTeks(x, d.catatan || '', W - 60), 34, 350);
  P.tex.needsUpdate = true;
}
function kontrasTeks(hex){ const c = new THREE.Color(hex); const l = .2126 * c.r + .7152 * c.g + .0722 * c.b; return l > .35 ? '#10141c' : '#ffffff'; }
// dipanggil dari renderList (sudah dibatasi); gambar ulang hanya bila isi berubah
function perbaruiPapan(){
  if (!ENV.papan || !BUILT) return;
  const aktif = [], seen = new Set(); let nOrang = 0, izinSiapa = '';
  for (const t of state.teamList){
    const w = t.members.filter(m => m.job || m.mode === 'work');
    nOrang += w.length;
    if (w.length && !seen.has(t.key)){ seen.add(t.key); aktif.push({ikon:t.icon, nama:t.support ? t.short : t.short, warna:t.color}); }
    const tunggu = t.members.find(m => m.waiting); if (tunggu && !izinSiapa) izinSiapa = tunggu.name + ' (' + (t.support ? 'Tim Pendukung' : t.who) + ')';
  }
  if (!izinSiapa && boss && boss.waiting) izinSiapa = boss.namaDiri ? boss.namaDiri + ' (Kepala)' : 'Kepala (Claude)';
  const nDiv = state.teamList.filter(t => t.members.some(m => m.job || m.mode === 'work')).length;
  const d = {mode:state.mode, nDiv, nOrang, tugas:boss && boss.tugasTeks ? short(boss.tugasTeks, 60) : '', aktif, izin:!!izinSiapa, izinSiapa,
    catatan:`${jumlahOrang()} orang di kantor · papan ini ikut kejadian Claude Code yang sama dengan panel`};
  const sig = JSON.stringify(d);
  ENV.papan.izin = d.izin;
  if (sig === ENV.papanSig) return; ENV.papanSig = sig; gambarPapan(d);
}
// bendera divisi: berkibar & lampu di puncak tiang menyala saat divisinya bekerja
function bangunBendera(p, bx, cy, M){
  const B = LUAR.bendera, n = Object.keys(DIVISI).length;
  bx(p, n * B.dx + .6, .02, .8, M.trotoar, B.x0 + (n - 1) * B.dx / 2, -.005, B.z);
  Object.entries(DIVISI).forEach(([k, dv], i) => {
    const x = B.x0 + i * B.dx, z = B.z;
    bx(p, .26, .12, .26, M.kerb, x, 0, z);
    cy(p, .03, .04, 3.1, M.tiang2, x, 0, z, 10);
    const lm = new THREE.MeshStandardMaterial({color:dv.warna, emissive:new THREE.Color(dv.warna), emissiveIntensity:0, roughness:.35});
    const lampu = new THREE.Mesh(geoSph(.07, 14, 10), lm); lampu.position.set(x, 3.16, z); p.add(lampu);
    const c = document.createElement('canvas'); c.width = 256; c.height = 168; const g = c.getContext('2d');
    g.fillStyle = dv.warna; g.fillRect(0, 0, 256, 168);
    g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(0, 0, 18, 168);
    g.textBaseline = 'middle'; g.textAlign = 'center'; g.font = '64px system-ui'; g.fillText(dv.ikon, 128, 64);
    g.fillStyle = kontrasTeks(dv.warna); g.font = '800 30px "Plus Jakarta Sans", system-ui'; g.fillText(dv.nama.toUpperCase(), 132, 132);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = ANISO;
    const geo = new THREE.PlaneGeometry(.7, .46, 10, 1); geo.translate(.35, 0, 0);
    const fm = new THREE.MeshStandardMaterial({map:tex, side:THREE.DoubleSide, roughness:.85});
    const f = new THREE.Mesh(geo, fm); f.position.set(x + .03, 2.8, z); f.castShadow = false; p.add(f);
    ENV.bendera.push({div:k, f, geo, lm, x0:geo.attributes.position.array.slice(), kibar:false, nyala:0});
  });
}
function terapkanLingkungan(){
  if (!ENV.ok) return;
  const lv = levelLingkungan(), on = lv !== 'mati';
  ENV.level = lv;
  ENV.sederhana.visible = ENV.hidupS.visible = ENV.tanah.visible = ENV.langit.visible = on;
  ENV.lengkap.visible = ENV.hidupL.visible = lv === 'lengkap';
  ground.visible = !on;
  scene.fog = on ? new THREE.Fog(TEMA.latar, ENV.kabutDekat, ENV.kabutDekat + KABUT_JAUH) : null;
  hitungSuasana(); S_KOTOR = true;
  isiInfoLingkungan();
}
/* ---- suasana: Otomatis (ikut jam komputer; ?jam=HH:MM untuk uji) atau Siang/Sore/Malam manual ----
   Siang 06:00–15:59, Sore 16:00–17:59, Malam 18:00–05:59, dengan peralihan halus 30 menit sebelum tiap batas.
   Parameter cahaya siang = persis preview.html. Perubahan dijalankan halus (Kurangi gerakan: langsung). */
function menitJam(){
  const q = /^(\d{1,2})[:.](\d{2})$/.exec(params.get('jam') || '');
  if (q && +q[1] < 24 && +q[2] < 60) return +q[1] * 60 + +q[2];
  const d = new Date(); return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
}
const jamUji = () => /^(\d{1,2})[:.](\d{2})$/.test(params.get('jam') || '');
function campuranJam(m){
  const B = JAM_SUASANA, siang = B.siang * 60, sore = B.sore * 60, malam = B.malam * 60, tr = B.transisi;
  if (m >= siang && m < sore - tr) return ['siang', 'siang', 0];
  if (m >= sore - tr && m < sore) return ['siang', 'sore', (m - sore + tr) / tr];
  if (m >= sore && m < malam - tr) return ['sore', 'sore', 0];
  if (m >= malam - tr && m < malam) return ['sore', 'malam', (m - malam + tr) / tr];
  if (m >= siang - tr && m < siang) return ['malam', 'siang', (m - siang + tr) / tr];
  return ['malam', 'malam', 0];
}
function paramS(s){ return {zenit:new THREE.Color(s.zenit), cakrawala:new THREE.Color(s.cakrawala), hemiA:new THREE.Color(s.hemi[0]), hemiB:new THREE.Color(s.hemi[1]), hemiI:s.hemi[2],
  keyC:new THREE.Color(s.key[0]), keyI:s.key[1], fill:s.fill, latar:new THREE.Color(s.latar), lampu:s.lampu, kota:s.kota, jendela:s.jendela}; }
function campurP(a, b, f, out = {}){ for (const k in a) if (a[k].isColor) out[k] = (out[k] || new THREE.Color()).copy(a[k]).lerp(b[k], f); else out[k] = a[k] + (b[k] - a[k]) * f; return out; }
let S_TARGET = null, S_NOW = null, S_NAMA = 'siang', S_KOTOR = true;
function hitungSuasana(){
  let a, b, f;
  if (SET.suasana === 'otomatis') [a, b, f] = campuranJam(menitJam());
  else { a = b = SUASANA[SET.suasana] ? SET.suasana : 'siang'; f = 0; }
  S_NAMA = f < .5 ? a : b;
  S_TARGET = f > 0 ? campurP(paramS(SUASANA[a]), paramS(SUASANA[b]), f) : paramS(SUASANA[a]);
  if (!S_NOW || RM) S_NOW = campurP(S_TARGET, S_TARGET, 0);
  S_KOTOR = true;
}
setInterval(() => { if (ENV.ok && SET.suasana === 'otomatis'){ const n = S_NAMA; hitungSuasana(); if (n !== S_NAMA || !$('#pSet').hidden) isiInfoLingkungan(); } }, 30000);
function langkahSuasana(dt){
  if (!S_TARGET || !S_KOTOR) return;
  const k = RM ? 1 : 1 - Math.exp(-dt * 1.4); let beda = 0;
  for (const key in S_TARGET){
    const a = S_NOW[key], b = S_TARGET[key];
    if (b.isColor){ beda = Math.max(beda, Math.abs(a.r - b.r), Math.abs(a.g - b.g), Math.abs(a.b - b.b)); a.lerp(b, k); }
    else { beda = Math.max(beda, Math.abs(a - b)); S_NOW[key] = a + (b - a) * k; }
  }
  if (beda < 2e-4){ campurP(S_TARGET, S_TARGET, 0, S_NOW); S_KOTOR = false; }
  terapkanSuasana(S_NOW);
}
const _sc = new THREE.Color(), WARNA_JENDELA = new THREE.Color('#ffcf7a');
function terapkanSuasana(p){
  hemi.color.copy(p.hemiA); hemi.groundColor.copy(p.hemiB); hemi.intensity = p.hemiI;
  key.color.copy(p.keyC); key.intensity = p.keyI; fill.intensity = p.fill;
  if (ENV.level !== 'mati'){
    const pos = ENV.langit.geometry.attributes.position, col = ENV.langit.geometry.attributes.color;
    for (let i = 0; i < pos.count; i++){ const y = pos.getY(i) / R_LANGIT; _sc.copy(p.cakrawala); if (y > 0) _sc.lerp(p.zenit, Math.pow(y, .5)); col.setXYZ(i, _sc.r, _sc.g, _sc.b); }
    col.needsUpdate = true;
    if (scene.fog) scene.fog.color.copy(p.cakrawala);
  }
  const nyala = Math.min(1, Math.max(0, (p.lampu - .3) / 1.9));      // 0 siang … 1 malam
  ENV.lampuMat.emissiveIntensity = p.lampu; ENV.tamanMat.emissiveIntensity = p.lampu * 1.1;
  ENV.kolam.visible = nyala > .02; ENV.kolam.material.opacity = .22 * nyala;
  for (const m of ENV.kotaMat) m.emissiveIntensity = p.kota;
  const J = ENV.jendela;
  if (p.jendela < 1e-3){ J.mat.emissive.copy(J.em); J.mat.emissiveIntensity = J.ei; }
  else { const f = Math.min(1, p.jendela / .45); J.mat.emissive.copy(J.em).lerp(WARNA_JENDELA, f); J.mat.emissiveIntensity = J.ei + (p.jendela - J.ei) * f; }
  if (K.warm){ if (K.warmEi == null) K.warmEi = K.warm.emissiveIntensity; K.warm.emissiveIntensity = K.warmEi + p.lampu * .6; }   // lampu gantung pergola & lampu lantai desain
  const lv = p.lampu > .8;
  for (const l of ENV.lampuDalam){ if (l.visible !== lv) l.visible = lv; l.intensity = 7 * nyala; }
  stage.style.background = '#' + p.latar.getHexString();
}
function infoSuasana(){
  const m = menitJam(), hh = String(Math.floor(m / 60)).padStart(2, '0'), mm = String(Math.floor(m % 60)).padStart(2, '0');
  const nama = {siang:'Siang', sore:'Sore', malam:'Malam'}[S_NAMA] || S_NAMA;
  return SET.suasana === 'otomatis' ? `Suasana aktif: ${nama} (otomatis, jam ${hh}.${mm}${jamUji() ? ', jam uji dari parameter ?jam' : ''}). Siang 06.00–15.59 · Sore 16.00–17.59 · Malam 18.00–05.59, beralih halus.`
    : `Suasana aktif: ${nama} (manual).`;
}
const _ev = new THREE.Vector3();
function updateLingkungan(dt, t){
  if (!ENV.ok) return;
  langkahSuasana(dt);
  if (ENV.level === 'mati') return;
  ENV.langit.position.copy(camera.position);
  // bendera & lampu tiang
  for (const b of ENV.bendera){
    const tm = state.teams.get('div:' + b.div), kerja = !!(tm && tm.members.some(m => m.mode === 'work'));
    const tgt = kerja ? 2.4 : 0; b.nyala += (tgt - b.nyala) * Math.min(1, dt * 4); b.lm.emissiveIntensity = b.nyala;
    const kibar = kerja && !RM;
    if (kibar){
      const a = b.geo.attributes.position, src = b.x0;
      for (let i = 0; i < a.count; i++){ const x = src[i * 3]; a.array[i * 3 + 2] = Math.sin(x * 9 - t * 6.5 + b.lm.id) * .075 * (x / .7); }
      a.needsUpdate = true; b.kibar = true;
    } else if (b.kibar){ b.geo.attributes.position.array.set(b.x0); b.geo.attributes.position.needsUpdate = true; b.kibar = false; }
  }
  // papan: garis LED atas berdenyut kuning saat butuh izin
  const P = ENV.papan;
  if (P){ if (P.izin){ P.strip.emissive.set('#f0b43c'); P.strip.emissiveIntensity = RM ? 1.2 : .9 + Math.sin(t * 5) * .6; } else { P.strip.emissive.set('#3b6cf6'); P.strip.emissiveIntensity = .8; } }
  if (ENV.level !== 'lengkap') return;
  if (!RM){
    for (const a of ENV.awan){ a.position.x += a.userData.v * dt; if (a.position.x > 300) a.position.x = -300; }
    // burung: kawanan melintas sesekali
    const B = ENV.burung;
    if (!B.visible && NOW > ENV.burungAt){ B.visible = true; B.userData = {t0:NOW, z:-30 + Math.random() * 40, y:18 + Math.random() * 8, arah:Math.random() < .5 ? 1 : -1}; B.rotation.y = B.userData.arah > 0 ? PI / 2 : -PI / 2; }
    if (B.visible){
      const u = B.userData, s = NOW - u.t0; B.position.set(u.arah * (-110 + s * 8.5), u.y + Math.sin(s * .7) * 1.5, u.z + Math.sin(s * .3) * 6);
      for (const b of B.children){ const f = Math.sin(t * 11 + b.position.x) * .7; b.userData.sk.rotation.z = f; b.userData.si.rotation.z = -f; }
      if (s > 28){ B.visible = false; ENV.burungAt = NOW + 35 + Math.random() * 40; }
    }
    for (const k of ENV.kupu){
      const u = k.userData, s = t * .6 + u.f; k.visible = true;
      k.position.set(u.x + Math.sin(s) * 1.3, .55 + Math.sin(s * 2.3) * .25 + .2, u.z + Math.sin(s * 1.7) * .5 - .2);
      k.rotation.y = Math.atan2(Math.cos(s) * 1.3, Math.cos(s * 1.7) * .85) - PI / 2;
      const f = Math.sin(t * 22 + u.f) * .9; u.wk.rotation.y = f; u.wi.rotation.y = -f;
    }
  } else { ENV.burung.visible = false; for (const k of ENV.kupu) k.visible = false; }
}

/* ================= tim (divisi & tipe pendukung) ================= */
const state = {teams:new Map(), teamList:[], list:[], byAgent:new Map(), selected:null, mode:'connecting', pendingDesc:new Map(), demo:false, esOpen:false, flowDone:new Set(), agentDesc:new Map(), agentInfo:new Map()};
let boss = null, reception = null, BUILT = false, follow = null;
const canon = who => isDivName(who) ? 'div:' + divKey(who) : String(who || 'general-purpose');
let ARRIVE_SEQ = 0;
class Team {
  constructor(key, who, o){
    this.key = key; this.who = who; this.members = []; this.reserveQ = [];
    this.support = !!o.support; this.div = o.div || null;
    this.ruang = RUANG_BY[o.ruang] || null;
    this.label = o.label; this.short = o.short; this.icon = o.icon; this.color = o.color; this.desc = o.desc || '';
    state.teams.set(key, this); state.teamList.push(this);
    panelTeam(this);
  }
  kodeNomor(n){ return this.support && n === 1 ? this.short : this.short + ' ' + n; }
  // nomor anggota terkecil yang kosong → nama bawaan (kode) & kunci slot data pegawai
  nextSlot(){
    const used = new Set(this.members.map(m => m.nomor));
    for (let n = 1; ; n++) if (!used.has(n)) return {n, kode:this.kodeNomor(n), slot:this.key + '#' + n};
  }
  // o: {P (karakter desain dipakai apa adanya), kursi, temp, di (muncul di pintu lalu jalan ke kursinya)}.
  // Penampilan: data pegawai owner didahulukan; bawaan = tampilan desain (karakter desain) atau ORANG.tampilanDari(slot).
  addMember(o = {}){
    const {n, kode, slot} = this.nextSlot();
    let P = o.P || null;
    if (!P && !o.temp && this.support && !this.members.length){ const id = desainCocok(this.who); if (id) P = R.orang[id]; }   // tabel pola nama
    const desk = (P && P.kursi) || o.kursi || allocKursi(this);
    const cfg = PEG.orang[slot];
    const bawaan = P ? (LOOK_DESAIN[P.o.id] || bersihLook(P.o)) : lookBaru(slot);
    const acak = !(cfg && cfg.look) && !P && PEG.acakBaru;      // penampilan acak otomatis (tidak disimpan)
    const look = (cfg && cfg.look) || (acak ? lookAcak(this.color) : bawaan);
    const a = new Actor({team:this, name:kode, nomor:n, slot, color:this.color, P, kursi:desk, temp:o.temp, look, bawaan, di:P ? null : o.di || null});
    a.acak = acak;
    if (P && cfg && cfg.look) a.dandani(cfg.look);
    infoLayar(desk);
    this.members.push(a); state.list.push(a); panelMember(a, this);
    if (!P && o.di){ a.activity = 'Datang ke kantor'; a.rest(0); }
    else { a.mode = 'idle'; a.nextAt = NOW + rand(15, 40) * (RM ? 1.5 : 1); }
    return a;
  }
  pickFree(){
    const free = this.members.filter(m => !m.job && m.mode !== 'leave' && m.mode !== 'work' && m.mode !== 'brief');
    const idle = free.filter(m => m.mode === 'idle');
    const pick = idle.find(m => m.isResting()) || (idle.length ? idle[0] : null) || free.find(m => m.mode === 'report');
    if (pick) return pick;
    return this.addMember({temp:this.support ? this.members.length > 0 : true, di:PINTU});
  }
  takeReserved(){ while (this.reserveQ.length){ const m = this.reserveQ.shift(); if (m.job && !m.job.agentId && this.members.includes(m)) return m; } return null; }
}
// data tim dari kunci (tim yang belum pernah muncul: dihitung dengan aturan yang sama dengan teamFor)
function infoTimKunci(tk){
  const t = state.teams.get(tk); if (t) return t;
  if (tk.startsWith('div:')){ const k = tk.slice(4), dv = milik(DIVISI, k); return {key:tk, div:dv ? k : null, short:dv ? dv.nama : pretty(k), color:dv ? dv.warna : TEMA.cadangan, support:false, who:'divisi-' + k}; }
  const h = hash(tk);
  return {key:tk, div:null, short:pretty(tk), color:TEMA.paletCadangan[h % TEMA.paletCadangan.length], support:true, who:tk};
}
const pecahSlot = s => { const m = /^(.+)#(\d+)$/.exec(s); return m ? {tk:m[1], n:+m[2]} : null; };
// bawaan (tombol ↺ Referensi) per slot: tampilan desain bila slot itu memakai karakter desain, selain itu ORANG.tampilanDari(slot)
function slotDesain(slot){
  if (slot === 'kepala') return 'pimpinan'; if (slot === 'resepsionis') return 'resepsionis';
  const a = aktorSlot(slot); if (a) return a.desain || null;
  const p = pecahSlot(slot); if (!p || !p.tk.startsWith('div:')) return null;
  const e = (milik(PETA_DIVISI, p.tk.slice(4)) || [])[p.n - 1]; return (e && e.orang) || null;
}
function lookBawaan(slot){
  const a = aktorSlot(slot); if (a && a.bawaan) return a.bawaan;
  const d = slotDesain(slot); if (d && LOOK_DESAIN[d]) return LOOK_DESAIN[d];
  return ORANG ? lookBaru(slot) : null;
}
function kodeSlot(slot){
  if (slot === 'kepala') return 'Kepala'; if (slot === 'resepsionis') return 'Resepsionis';
  const p = pecahSlot(slot); if (!p) return slot; const t = infoTimKunci(p.tk);
  return t.support && p.n === 1 ? t.short : t.short + ' ' + p.n;
}
function teamFor(who){
  const k = canon(who); let t = state.teams.get(k); if (t) return t;
  if (isDivName(who)){
    const nm = pretty(divKey(who)), h = hash(who);
    return new Team(k, who, {ruang:null, label:'Divisi ' + nm, short:nm, icon:TEMA.ikonCadangan[h % TEMA.ikonCadangan.length], color:TEMA.paletCadangan[h % TEMA.paletCadangan.length], desc:state.agentDesc.get(who)});
  }
  const h = hash(who);
  return new Team(k, who, {support:true, ruang:null, label:pretty(who), short:pretty(who), icon:TEMA.ikonCadangan[h % TEMA.ikonCadangan.length], color:TEMA.paletCadangan[h % TEMA.paletCadangan.length], desc:state.agentDesc.get(who)});
}
function labelFor(who){ if (!who) return 'Claude'; const t = state.teams.get(canon(who)); return t ? (t.support ? t.label + ' (Tim Pendukung)' : t.label) : pretty(who); }
function memberFor(t, ev){
  if (ev.agentId){
    const m = state.byAgent.get(ev.agentId);
    if (m && m.job && m.job.agentId === ev.agentId) return m;
    const r = t.takeReserved() || t.pickFree(); r.bind(ev.agentId); return r;
  }
  const b = t.members.find(x => x.job && x.job.agentId) || t.members.find(x => x.job);
  if (b){ b.bind(null); return b; }
  const r = t.takeReserved() || t.pickFree(); r.bind(null); return r;
}

/* ================= kejadian ================= */
// label orang di log: "Budi · QA (divisi-qa)" — nama dari owner + peran (tanpa nomor bila bernama) + nama agent Claude
const kodeNama = a => a.namaDiri ? a.namaDiri + ' · ' + a.peran : a.kode;
function siapaLog(a){
  if (!a) return 'Claude';
  if (a.boss) return a.namaDiri ? a.namaDiri + ' (Claude · Kepala)' : 'Claude';
  if (a.npc) return a.namaDiri ? a.namaDiri + ' (Resepsionis)' : 'Resepsionis';
  const t = a.team;
  return kodeNama(a) + ' (' + (t ? (t.support ? 'Tim Pendukung' : t.who) : 'agent') + ')';
}
function describe(ev){
  const who = ev._m ? siapaLog(ev._m) : !ev.who ? siapaLog(boss) : labelFor(ev.who);
  const T = toolInfo(ev.tool);
  switch (ev.kind){
    case 'session': return {icon:'🟢', who, text:'Sesi Claude Code dimulai' + (ev.text ? ` (${ev.text})` : '')};
    case 'session_end': return {icon:'⚪', who, text:'Sesi berakhir'};
    case 'prompt': return {icon:'📨', who, text:'Menerima tugas baru' + (ev.text ? ': “' + short(ev.text, 90) + '”' : '')};
    case 'tool':
      if (T.cat === 'agent') return {icon:'📋', who, text:`Menugaskan <b>${esc(ev._sub || labelFor(ev.sub))}</b>` + (ev._sub ? ` (${esc(ev._subM && ev._subM.team && ev._subM.team.support ? 'Tim Pendukung · ' + (ev.sub || 'general-purpose') : ev.sub || '')})` : '') + (ev.detail ? ': ' + esc(short(ev.detail, 80)) : ''), html:true};
      if (ev.tool === 'Skill') return {icon:T.icon, who, text:'Memakai skill' + (ev.detail ? ' · ' + namaSkill(ev.detail) : '')};
      return {icon:T.icon, who, text:T.label + (ev.detail ? ' · ' + short(ev.detail, 70) : '')};
    case 'tool_fail': return {icon:'⚠️', who, text:T.label + ' gagal' + (ev.text ? ': ' + short(ev.text, 70) : ''), cls:'err'};
    case 'agent_start': return {icon:'🚀', who, text:'Mulai mengerjakan tugas'};
    case 'agent_stop': return {icon:'✅', who, text:'Tugas selesai' + (ev.text ? ': ' + short(ev.text, 110) : '')};
    case 'stop': return {icon:'🏁', who, text:'Selesai menjawab' + (ev.text ? ': ' + short(ev.text, 90) : '')};
    case 'notify':
      if (ev.type === 'permission_prompt') return {icon:'✋', who, text:'Butuh izin Anda' + (ev.text ? ': ' + short(ev.text, 80) : '')};
      if (ev.type === 'idle_prompt') return {icon:'💤', who, text:'Menunggu perintah Anda'};
      return {icon:'🔔', who, text:short(ev.text || 'Notifikasi', 90)};
    default: return null;
  }
}
function assign(from, ev){
  const sub = ev.sub || 'general-purpose', t = teamFor(sub), m = t.pickFree();
  state.pendingDesc.set(t.key, ev.detail || '');
  if (from === boss){ m.summon(ev.detail || ''); from.bubble('📋 Memanggil ' + m.name + '…', 'info', 3000); from.bicaraSampai = NOW + 3; }
  else { m.reserve(ev.detail || ''); from.bubble('📋 ' + m.name + ', tolong bantu:\n' + short(ev.detail || 'tugas baru', 40), 'info', 5000); m.bubble('📥 Siap!', 'ok', 2600); }
  ev._sub = kodeNama(m); ev._subM = m;
  return m;
}
// resepsionis: di desain v2 ia figuran tanpa kursi/rute, jadi animasi "mengantar map" diganti balon di mejanya
function deliverPrompt(text){
  const r = reception; if (!r) return;
  r.bubble('📨 Ada tugas baru untuk Kepala!', 'ok', 3200); r.activity = 'Meneruskan tugas baru ke Kepala';
  clearTimeout(r.antarT); r.antarT = setTimeout(() => { r.activity = 'Menjaga meja resepsionis'; }, 4500);
}
// skill `resepsionis` dipakai Kepala → Winda merapikan permintaan jadi tiket
function rapikanTiket(){
  const r = reception; if (!r) return;
  r.bubble('🗂️ Merapikan permintaan\njadi tiket…', 'ok', 6000); r.activity = 'Merapikan permintaan jadi tiket';
  clearTimeout(r.antarT); r.antarT = setTimeout(() => { r.activity = 'Menjaga meja resepsionis'; }, 20000);
}
function bossAct(ev, T){
  const a = boss;
  if (ev.kind !== 'notify') a.waiting = false;
  switch (ev.kind){
    case 'session': a.bubble('☕ Kantor buka, siap bekerja!', 'ok'); a.activity = 'Siap menerima tugas'; state.flowDone.clear(); break;
    case 'prompt': a.work('plan'); a.activity = 'Membaca tugas dari Anda'; deliverPrompt(ev.text); setTimeout(() => a.bubble('📨 Tugas baru!\n' + short(ev.text, 40), 'info', 5000), RM ? 0 : 3500); break;
    case 'tool':
      if (T.cat === 'agent'){ const m = assign(a, ev); a.work('agent'); a.activity = 'Menugaskan ' + m.name; }
      else { a.work(T.cat); a.activity = T.label + (ev.detail ? ' · ' + short(ev.detail, 40) : ''); a.bubble(T.icon + ' ' + T.label + (ev.detail ? '\n' + short(ev.detail, 36) : ''), 'info', 4500); }
      break;
    case 'tool_done': a.work(); break;
    case 'tool_fail': a.work(); a.errorAt = NOW; a.activity = T.label + ' gagal'; a.bubble('⚠️ Ada kendala saat ' + T.label.toLowerCase(), 'err', 5000); break;
    case 'stop': a.lastWork = -1e9; a.activity = 'Menunggu tugas berikutnya'; a.bubble('🏁 Beres! Menunggu tugas berikutnya', 'ok', 5000); break;
    case 'session_end': a.lastWork = -1e9; a.activity = 'Sesi berakhir'; break;
    case 'notify':
      if (ev.type === 'permission_prompt'){ a.waiting = true; a.activity = 'Menunggu izin Anda'; a.bubble('✋ Butuh izin Anda\ndi Claude Code', 'warn', 20000); }
      else if (ev.type === 'idle_prompt'){ a.lastWork = -1e9; a.activity = 'Menunggu perintah'; a.bubble('💤 Menunggu perintah…', 'info', 5000); }
      break;
  }
}
function parallelTouch(t, m){
  if (!t.div || !PARALEL_TANPA_KODE.includes(t.div)) return;
  const other = state.teamList.find(o => o !== t && o.div && PARALEL_TANPA_KODE.includes(o.div) && o.members.some(x => x.mode === 'work'));
  if (other) setTimeout(() => m.bubble('🤝 Paralel dengan ' + other.label, 'idle', 3000), 1500);
}
function act(ev){
  if (!BUILT) return;
  const T = toolInfo(ev.tool);
  if (!ev.who){ bossAct(ev, T); return; }
  if (!['tool', 'tool_done', 'tool_fail', 'agent_start', 'agent_stop', 'notify'].includes(ev.kind)) return;
  if (ev.kind === 'notify' && ev.type !== 'permission_prompt') return;
  const t = teamFor(ev.who);
  const m = memberFor(t, ev); ev._name = m.name; ev._m = m;
  if (ev.kind !== 'notify') m.waiting = false;
  switch (ev.kind){
    case 'tool':
      if (T.cat === 'agent'){ const s = assign(m, ev); m.work('agent'); m.activity = 'Menugaskan ' + s.name; }
      else { m.work(T.cat); m.activity = T.label + (ev.detail ? ' · ' + short(ev.detail, 40) : ''); m.bubble(T.icon + ' ' + T.label + (ev.detail ? '\n' + short(ev.detail, 36) : ''), 'info', 4500); }
      break;
    case 'tool_done': m.work(); break;
    case 'tool_fail': m.work(); m.errorAt = NOW; m.activity = T.label + ' gagal'; m.bubble('⚠️ Ada kendala saat ' + T.label.toLowerCase(), 'err', 5000); break;
    case 'agent_start': {
      const d = (m.job && m.job.desc) || state.pendingDesc.get(t.key) || '';
      m.work(); m.desc = d; m.activity = 'Mulai: ' + short(d || 'tugas baru', 40); m.bubble('🚀 Mulai kerja' + (d ? '\n' + short(d, 36) : ''), 'ok', 4000);
      parallelTouch(t, m); break;
    }
    case 'agent_stop': ev._since = m.job ? m.job.since : null; m.finish(); if (t.div) state.flowDone.add(t.div); break;
    case 'notify': m.waiting = true; m.activity = 'Menunggu izin Anda'; m.bubble('✋ Butuh izin Anda\ndi Claude Code', 'warn', 20000); break;
  }
}
function handle(ev, live = true){
  if (live){ act(ev); ramaikan(15); }   // kabar baru → gambar penuh sebentar (lihat hitungSasaranFPS)
  const d = describe(ev); if (d) addLog(d, ev.ts || Date.now());
  catatOrang(ev, d, live);
  renderList();
  if (live && (ev.kind === 'stop' || ev.kind === 'agent_stop')) tokenPicu();
  if (live) alurLive(ev);   // sorotan live diagram alur kerja (tab Laporan)
}
// lepas tugas yang macet (tidak ada kabar lama)
setInterval(() => {
  for (const m of state.list){
    if (!m.job) continue;
    if ((m.job.reserved && NOW - m.job.since > 180) || NOW - m.job.last > 900){ m.release(); m.bubble('🤷 Tugas tidak ada kabar, kembali santai', 'idle', 3000); m.rest(); }
  }
}, 5000);

/* ================= panel ================= */
const logEl = $('#log'), divsEl = $('#divs'), flowEl = $('#flow');
/* keadaan buka/tutup "dropdown" panel & kartu Aktivitas (localStorage; bila diblokir, hanya berlaku sampai halaman ditutup) */
const KUNCI_UI = 'padev-kantor3d:tampilan:v1';
const UI = (() => { try { const d = JSON.parse(localStorage.getItem(KUNCI_UI) || 'null'); return d && typeof d === 'object' ? d : {}; } catch (e){ return {}; } })();
function simpanUI(){ try { localStorage.setItem(KUNCI_UI, JSON.stringify(UI)); } catch (e){} }
const uiBuka = (grup, k, bawaan) => { const g = UI[grup]; return g && typeof g[k] === 'boolean' ? g[k] : bawaan; };
function uiSetel(grup, k, v){ if (k === '__proto__' || k === 'constructor') return; const g = UI[grup] && typeof UI[grup] === 'object' ? UI[grup] : (UI[grup] = {}); if (g[k] === v) return; g[k] = v; simpanUI(); }
const SEMPIT = matchMedia('(max-width:760px)');
// <details data-k> di dalam root: buka/tutup diingat di UI[grup][k]; nilai bawaan (data-def) tidak perlu disimpan
function ingatDetails(root, grup){
  root.addEventListener('toggle', e => {
    const d = e.target; if (!(d instanceof HTMLDetailsElement) || !d.dataset.k) return;
    if (d.open === (d.dataset.def === '1') && uiBuka(grup, d.dataset.k, null) === null) return;
    uiSetel(grup, d.dataset.k, d.open);
  }, true);   // 'toggle' tidak menggelembung, jadi ditangkap di fase capture
}
function pasangDetails(d, grup, k, bawaan){ d.dataset.k = k; d.dataset.def = bawaan ? '1' : '0'; d.open = uiBuka(grup, k, bawaan); }
const flowRk = $('#flowRk');
pasangDetails($('#flowD'), 'panel', 'alur', !SEMPIT.matches); ingatDetails($('#pTim'), 'panel');
// kartu Aktivitas: layar sempit bawaan diciutkan (tidak menutupi 3D); disimpan terpisah untuk layar lebar/sempit
const akEl = $('#aktivitas'), akBtn = $('#bAk'), akN = $('#akN'), akLast = $('#akLast');
let akBaru = 0;
const AK_MULAI = Date.now() - 5000;     // kejadian lama (riwayat dari server saat halaman dibuka) tidak dihitung "baru"
const akKunci = () => SEMPIT.matches ? 'sempit' : 'lebar';
function akTerap(){
  const buka = uiBuka('ak', akKunci(), !SEMPIT.matches);
  akEl.classList.toggle('ciut', !buka); logEl.hidden = !buka; akBtn.setAttribute('aria-expanded', buka ? 'true' : 'false');
  if (buka) akBaru = 0;
  akN.textContent = akBaru ? (akBaru > 99 ? '99+' : String(akBaru)) : '';
  akBtn.setAttribute('aria-label', 'Aktivitas' + (akBaru ? `, ${akBaru} baru` : '') + (buka ? ', daftar terbuka' : ', daftar diciutkan'));
}
akBtn.onclick = () => { uiSetel('ak', akKunci(), logEl.hidden); akTerap(); };
SEMPIT.addEventListener && SEMPIT.addEventListener('change', akTerap);
akTerap();
const pisahWho = w => { const m = /^(.*?)\s*\(([^()]+)\)$/.exec(String(w || '')); return m && m[1] ? [m[1], m[2]] : [String(w || ''), '']; };
function addLog(d, ts){
  const el = document.createElement('div'); el.className = 'lg baru' + (d.cls ? ' ' + d.cls : '');
  const [nama, agen] = pisahWho(d.who), isi = d.html ? d.text : esc(d.text);
  el.innerHTML = `<div class="ic" aria-hidden="true">${d.icon}</div><div><div class="hd"><b>${esc(nama)}</b>${agen ? `<small>(${esc(agen)})</small>` : ''}<span class="tm">${hhmmss(ts)}</span></div><div class="tx">${isi}</div></div>`;
  const tx = el.querySelector('.tx'); tx.title = tx.textContent;
  logEl.prepend(el);
  setTimeout(() => el.classList.remove('baru'), 400);
  while (logEl.children.length > 120) logEl.lastChild.remove();
  akLast.innerHTML = `<span aria-hidden="true">${d.icon}</span> <b>${esc(nama)}</b> · ${esc(tx.textContent)}`;
  if (logEl.hidden && !(ts < AK_MULAI)){ akBaru++; akTerap(); }
}
const ST_TXT = {bekerja:'Bekerja', santai:'Santai', melapor:'Melapor', dipanggil:'Dipanggil', jalan:'Berjalan', menunggu:'Butuh izin', kendala:'Kendala', npc:'Resepsionis'};
let INFO_SEQ = 0;
function panelTeam(t){
  const g = document.createElement('div'); g.className = 'grp';
  const top = document.createElement('div'); top.className = 'grp-top';
  const h = document.createElement('button'); h.type = 'button'; h.className = 'grp-h'; h.dataset.ruang = t.ruang ? t.ruang.id : ''; h.dataset.timKey = t.key || ''; h.style.setProperty('--c', t.color);
  const where = t.support ? 'Tim Pendukung' : t.ruang ? t.ruang.nama : 'Divisi baru';
  // dua baris: nama divisi (tebal) · jumlah/aktif + ruangnya (kecil) supaya nama tidak terpotong
  h.innerHTML = `<span class="ic" aria-hidden="true">${t.icon}</span><span class="nm">${esc(t.label)}</span><span class="sub"><span class="cnt"></span>${where !== t.label ? `<small>${esc(where)}</small>` : ''}</span>`;
  h.setAttribute('aria-label', t.label + ' di ' + where + ': lihat ruangan');
  if (t.desc) h.title = t.desc;
  top.append(h); g.append(top);
  // tim agent: tombol 🧰 membuka deskripsi, model, skill wajib/opsional, dan alat
  if (t.key){
    const id = 'gi' + (++INFO_SEQ), x = document.createElement('button');
    x.type = 'button'; x.className = 'grp-x'; x.dataset.tim = t.key; x.setAttribute('aria-expanded', 'false'); x.setAttribute('aria-controls', id);
    x.innerHTML = '<span aria-hidden="true">🧰</span><span class="n"></span>';
    const info = document.createElement('div'); info.className = 'grp-info'; info.id = id; info.hidden = true;
    t.infoBtn = x; t.infoEl = info; t.infoSig = '';
    top.append(x); g.append(info); labelInfoTim(t);
  }
  // tombol ▸ menciutkan/melebarkan daftar anggota (bawaan: hanya Ruang Pimpinan terbuka)
  const gid = t.key || (t.ruang ? 'r:' + t.ruang.id : 'l:' + t.label), mid = 'gm' + (++INFO_SEQ);
  const c = document.createElement('button'); c.type = 'button'; c.className = 'grp-c'; c.dataset.grp = gid; c.setAttribute('aria-controls', mid);
  c.innerHTML = '<span class="car" aria-hidden="true"></span>'; c.title = 'Tampilkan/sembunyikan anggota';
  const mem = document.createElement('div'); mem.className = 'grp-mem'; mem.id = mid;
  top.append(c); g.append(mem);
  t.el = g; t.cntEl = h.querySelector('.cnt'); t.memEl = mem; t.grpBtn = c; t.gid = gid; GRUP.set(gid, t);
  bukaGrp(t, uiBuka('grp', gid, gid === 'r:pimpinan'), false);
  divsEl.append(g);
}
const GRUP = new Map();
function bukaGrp(t, buka, simpan = true){
  if (!t || !t.memEl) return;
  t.memEl.hidden = !buka; t.grpBtn.setAttribute('aria-expanded', buka ? 'true' : 'false');
  t.grpBtn.setAttribute('aria-label', (buka ? 'Sembunyikan' : 'Tampilkan') + ' anggota ' + t.label);
  if (simpan) uiSetel('grp', t.gid, buka);
  labelGrpAll();
}
function labelGrpAll(){
  const b = document.getElementById('bGrpAll'); if (!b) return;
  const semua = [...GRUP.values()].every(t => !t.memEl.hidden);
  b.textContent = semua ? 'Tutup semua' : 'Buka semua'; b.dataset.buka = semua ? '0' : '1';
}
$('#bGrpAll').onclick = e => { const buka = e.currentTarget.dataset.buka !== '0'; for (const t of GRUP.values()) bukaGrp(t, buka); };
function isiNamaBaris(el, a){
  el.textContent = '';
  if (a.boss){ el.textContent = '👑 ' + (a.namaDiri || 'Claude') + ' (Kepala)'; return; }
  if (!a.namaDiri){ el.textContent = a.kode; return; }
  const k = document.createElement('span'); k.className = 'kd'; k.textContent = a.npc ? 'Resepsionis' : a.peran;
  const sp = document.createElement('span'); sp.className = 'sr'; sp.textContent = ' · ';   // pemisah untuk pembaca layar
  el.append(document.createTextNode(a.namaDiri), sp, k);
}
function panelMember(a, t){
  const b = document.createElement('button'); b.type = 'button'; b.className = 'mem'; b.dataset.actor = a.id;
  b.innerHTML = '<span class="dot" aria-hidden="true"></span><span class="nm"></span><span class="st"></span><span class="act"></span>';
  b.querySelector('.dot').style.background = a.boss ? '#1d2433' : a.npc ? '#94a3b8' : a.color;
  a.rowNm = b.querySelector('.nm'); isiNamaBaris(a.rowNm, a);
  a.rowEl = b; a.rowSt = b.querySelector('.st'); a.rowAct = b.querySelector('.act'); a._rs = ''; a._ra = ''; a._rsel = null; a.rowGrp = t;
  (t.memEl || t.el).append(b);
}

/* ================= skill & alat per divisi (data dari file agent lewat server.js, atau DEMO) ================= */
function infoAgenTim(t){ return (t && (state.agentInfo.get(t.who) || milik(AGEN_BAWAAN, t.who))) || null; }
function bersihInfoAgen(a){
  const s = (v, n) => typeof v === 'string' ? v.slice(0, n) : '';
  const L = (v, n) => Array.isArray(v) ? v.filter(x => typeof x === 'string' && x.length > 0 && x.length <= 90).slice(0, n) : [];
  return {description:s(a.description, 400), model:s(a.model, 40), tools:L(a.tools, 80), skills:L(a.skills, 40), skillsOpsional:L(a.skillsOpsional, 60)};
}
// alat dikelompokkan: Browser (Playwright) ×N, Figma ×N, server MCP lain ×N, sisanya per nama dengan ikon toolInfo()
function kelompokAlat(tools){
  const g = new Map();
  for (const t of tools){
    let k, ikon, label, anggota;
    if (t === '*'){ k = '*'; ikon = '🧰'; label = 'Semua alat bawaan'; }
    else if (/^mcp__playwright__/i.test(t)){ k = 'pw'; ikon = '🎭'; label = 'Browser (Playwright)'; anggota = t.replace(/^mcp__playwright__(browser_)?/i, ''); }
    else if (/^mcp__.*figma/i.test(t)){ k = 'figma'; ikon = '🎨'; label = 'Figma'; anggota = t.split('__').pop(); }
    else if (/^mcp__/.test(t)){ const p = t.split('__'); k = 'mcp:' + p[1]; ikon = '🔌'; label = pretty(p[1]); anggota = p[2] || ''; }
    else { const T = toolInfo(t); k = t; ikon = T.icon; label = t; anggota = T.label; }
    let e = g.get(k); if (!e){ e = {ikon, label, n:0, isi:[]}; g.set(k, e); }
    e.n++; if (anggota) e.isi.push(anggota);
  }
  return [...g.values()];
}
const SKILL_AKTIF = 120;     // detik: skill dianggap "sedang dipakai"
function chipSkill(s, t, kelas){
  const sk = t && t.skill, on = sk && sk.nama === s && NOW - sk.ts < SKILL_AKTIF, last = sk && sk.nama === s && !on;
  return `<span class="chip ${kelas}${on ? ' on' : last ? ' last' : ''}"${on ? ' title="Sedang dipakai"' : last ? ' title="Terakhir dipakai"' : ''}>${esc(s)}</span>`;
}
function skillSekarangHtml(sk, sub){
  if (!sk) return `<div class="sk-now"><span class="ks">${esc(sub || 'Belum ada skill dipakai di sesi ini.')}</span></div>`;
  const on = NOW - sk.ts < SKILL_AKTIF;
  return `<div class="sk-now"><span>${on ? 'Sedang memakai' : 'Terakhir memakai'}</span><span class="chip${on ? ' on' : ' last'}">🧰 ${esc(sk.nama)}</span>` +
    (sk.oleh && sub !== false ? `<span>oleh ${esc(kodeNama(sk.oleh))}</span>` : '') + `<span class="tm">${lalu(sk.ts)}</span></div>`;
}
function labelInfoTim(t){
  if (!t.infoBtn) return;
  const I = infoAgenTim(t), n = I ? (I.skills || []).length + (I.skillsOpsional || []).length : 0;
  t.infoBtn.querySelector('.n').textContent = n ? String(n) : '';
  t.infoBtn.setAttribute('aria-label', `Skill & alat ${t.label}` + (n ? ` (${n} skill)` : ''));
  t.infoBtn.title = 'Deskripsi, model, skill, dan alat ' + t.label;
}
function isiInfoTim(t, paksa){
  if (!t.infoEl || t.infoEl.hidden) return;
  const I = infoAgenTim(t), sk = t.skill;
  const sig = [I ? I.model + I.skills.length + (I.skillsOpsional || []).length + I.tools.length : '-', sk ? sk.nama + (NOW - sk.ts < SKILL_AKTIF) + Math.floor((NOW - sk.ts) / 30) : '', t.opsLengkap].join('|');
  if (!paksa && (sig === t.infoSig || t.infoEl.contains(document.activeElement))) return;
  t.infoSig = sig;
  let h = '';
  if (!I){
    h = `<p class="sk-p">Belum ada file agent untuk <b>${esc(t.who)}</b>, jadi skill dan alatnya belum diketahui. Buka lewat <code>node server.js</code> supaya daftar skill dibaca dari folder agents.</p>`;
  } else {
    const wajib = I.skills || [], ops = I.skillsOpsional || [], batas = 10;
    h += I.description ? `<p class="sk-p">${esc(I.description)}${state.agentInfo.has(t.who) ? '' : ' <i>(bawaan Claude Code)</i>'}</p>` : '';
    h += `<div class="chips">${I.model ? `<span class="chip model" title="Model">${esc(I.model)}</span>` : ''}<span class="chip ops" title="Nama agent di Claude Code">${esc(t.who)}</span></div>`;
    h += skillSekarangHtml(sk);
    h += `<div class="sk-t">Skill wajib (${wajib.length})</div>` + (wajib.length ? `<div class="chips" style="--c:${t.color}">${wajib.map(s => chipSkill(s, t, 'wajib')).join('')}</div>` : '<p class="sk-p">Tidak ada skill yang dimuat otomatis.</p>');
    h += `<div class="sk-t">Skill opsional (${ops.length})</div>`;
    if (ops.length){
      const tampil = t.opsLengkap ? ops : ops.slice(0, batas);
      h += `<div class="chips">${tampil.map(s => chipSkill(s, t, 'ops')).join('')}` +
        (ops.length > batas ? `<button type="button" class="chip" data-ops="${esc(t.key)}" aria-expanded="${t.opsLengkap ? 'true' : 'false'}">${t.opsLengkap ? 'Lipat' : '+' + (ops.length - batas) + ' lagi'}</button>` : '') + '</div>';
    } else h += '<p class="sk-p">Tidak ada.</p>';
    const al = kelompokAlat(I.tools || []);
    h += `<div class="sk-t">Alat (${(I.tools || []).length})</div><div class="chips">` +
      al.map(e => `<span class="chip ops" title="${esc(e.isi.slice(0, 30).join(', '))}"><span aria-hidden="true">${e.ikon}</span>${esc(e.label)}${e.n > 1 ? ' ×' + e.n : ''}</span>`).join('') + '</div>';
  }
  t.infoEl.innerHTML = h;
}
function bukaInfoTim(t, buka = null, fokus = false){
  if (!t || !t.infoEl) return;
  const on = buka == null ? t.infoEl.hidden : buka;
  t.infoEl.hidden = !on; t.infoBtn.setAttribute('aria-expanded', on ? 'true' : 'false');
  if (on) isiInfoTim(t, true);
  if (fokus){ t.infoBtn.focus({preventScroll:true}); t.el.scrollIntoView({block:'nearest', behavior:RM ? 'auto' : 'smooth'}); }
}
// dari kartu detail / tab Keterangan: pindah ke tab Tim dan buka kartu divisinya
function bukaInfoDivisi(t){ if (!t) return; pilihTab($('#tabTim')); bukaInfoTim(t, true, true); }
function buildFlow(){
  flowEl.innerHTML = '';
  ALUR.forEach((stage, i) => {
    if (i) { const ar = document.createElement('span'); ar.className = 'ar'; ar.textContent = '→'; ar.setAttribute('aria-hidden', 'true'); flowEl.append(ar); }
    stage.forEach((k, j) => {
      const dv = DIVISI[k]; if (!dv) return;
      if (j){ const pl = document.createElement('span'); pl.className = 'pl'; pl.textContent = i === 1 ? '/' : '+'; pl.setAttribute('aria-hidden', 'true'); flowEl.append(pl); }
      const bt = document.createElement('button'); bt.type = 'button'; bt.className = 'fl'; bt.dataset.div = k; bt.style.setProperty('--c', dv.warna);
      bt.innerHTML = `<i aria-hidden="true">${dv.ikon}</i>${esc(dv.nama)}`;
      bt.title = 'Divisi ' + dv.nama + ': lihat ruangan';
      bt.onclick = () => flyToRuang(RUANG_BY[dv.ruang]);
      flowEl.append(bt);
    });
  });
}
divsEl.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.grp){ const t = GRUP.get(b.dataset.grp); if (t) bukaGrp(t, t.memEl.hidden); }
  else if (b.dataset.tim) bukaInfoTim(state.teams.get(b.dataset.tim));
  else if (b.dataset.ops){ const t = state.teams.get(b.dataset.ops); if (t){ t.opsLengkap = !t.opsLengkap; isiInfoTim(t, true); const nb = t.infoEl.querySelector('[data-ops]'); if (nb) nb.focus(); } }
  else if (b.classList.contains('grp-h')){ const t = state.teams.get(b.dataset.timKey), m = t && t.members[0]; flyToRuang(RUANG_BY[b.dataset.ruang] || (m && ruangKursi(m.desk))); }
  else if (b.dataset.actor) select(ACTORS.get(+b.dataset.actor), e.detail === 0 ? b : null);   // dari keyboard: fokus pindah ke kartu detail
});
let lastList = 0;
function renderList(force){
  if (!BUILT) return;
  const now = performance.now(); if (!force && now - lastList < 400) return; lastList = now;
  const all = [boss, reception, ...state.list];
  let aktif = 0;
  for (const a of all){
    const st = a.status; if (st !== 'santai' && st !== 'jalan' && st !== 'npc') aktif++;
    if (!a.rowEl) continue;
    if (a._rs !== st){ a._rs = st; a.rowSt.className = 'st ' + st; a.rowSt.textContent = ST_TXT[st]; }
    const act = a.activity;
    if (a._ra !== act){ a._ra = act; a.rowAct.textContent = act; }
    const sel = state.selected === a; if (a._rsel !== sel){ a._rsel = sel; a.rowEl.classList.toggle('sel', sel); a.rowEl.setAttribute('aria-pressed', sel ? 'true' : 'false');
      if (sel && a.rowGrp && a.rowGrp.memEl && a.rowGrp.memEl.hidden) bukaGrp(a.rowGrp, true, false); }   // orang dipilih di 3D: kartu divisinya dibuka (tidak disimpan)
  }
  const perRuang = new Map(), activeDiv = new Set();
  for (const t of state.teamList){
    if (!t.cntEl) continue;
    const n = t.members.filter(m => m.job || m.mode === 'report' || m.mode === 'brief').length;
    const txt = n ? `${n}/${t.members.length} aktif` : `${t.members.length} anggota`;
    if (t.cntEl.textContent !== txt){ t.cntEl.textContent = txt; t.cntEl.classList.toggle('on', n > 0); }
    const w = t.members.filter(m => m.job);
    for (const m of w){ const r = ruangKursi(m.desk); if (r) perRuang.set(r, (perRuang.get(r) || 0) + 1); }
    if (t.div && w.length) activeDiv.add(t.div);
  }
  for (const r of RUANG){ if (!r.countEl) continue; const n = perRuang.get(r) || 0; const s = n ? '⚡' + n : ''; if (r.countEl.textContent !== s){ r.countEl.textContent = s; r.countEl.classList.toggle('on', n > 0); } }
  isiDivisiRuang();
  for (const bt of flowEl.children){ if (!bt.dataset || !bt.dataset.div) continue; const k = bt.dataset.div; bt.classList.toggle('on', activeDiv.has(k)); bt.classList.toggle('done', !activeDiv.has(k) && state.flowDone.has(k)); }
  const rk = [...activeDiv].map(k => DIVISI[k] ? DIVISI[k].nama : k).join(', '), rkT = rk ? '● ' + rk : '';
  if (flowRk.textContent !== rkT){ flowRk.textContent = rkT; flowRk.title = rk ? 'Sedang bekerja: ' + rk : ''; }
  const nDiv = state.teamList.filter(t => !t.support).length;
  $('#divTitle').textContent = `Kantor · ${nDiv} divisi · ${state.list.length} anggota`;
  $('#divSub').textContent = aktif ? `${aktif} sedang aktif · klik nama divisi untuk melihat ruangannya` : 'Semua sedang santai · klik nama divisi untuk melihat ruangannya';
  $('#summary').textContent = `Kantor 2 lantai · 20 ruang · ${jumlahOrang()} orang`;
  for (const t of state.teamList) if (t.infoEl && !t.infoEl.hidden) isiInfoTim(t);
  perbaruiPapan();
  if (!$('#pPeg').hidden) cekDaftarPegawai();
  renderDetail();
}
setInterval(() => renderList(true), 1000);
$('#bClear').onclick = () => { logEl.innerHTML = ''; akLast.textContent = ''; akBaru = 0; akTerap(); };

/* ================= riwayat pribadi & statistik per orang =================
   Dicatat dari jalur handle() setelah act(); tidak mengubah perilaku karakter. */
function catat(a, ikon, teks, html, cls){
  if (!a) return;
  const r = a.riwayat || (a.riwayat = []);
  r.unshift({ts:Date.now(), ikon, teks, html:!!html, cls:cls || ''});
  if (r.length > 10) r.length = 10;
}
function catatOrang(ev, d, live = true){
  if (!BUILT) return;
  const a = ev.who ? ev._m : boss;
  if (a && d) catat(a, d.icon, d.text, d.html, d.cls);
  // kejadian lama (dari server saat halaman dibuka): skill tetap dicatat di divisinya
  if (!a && ev.kind === 'tool' && ev.tool === 'Skill' && ev.detail && ev.who){
    const t = state.teams.get(canon(ev.who)); if (t) t.skill = {nama:namaSkill(ev.detail), ts:NOW - Math.max(0, Date.now() - (ev.ts || Date.now())) / 1000, oleh:null};
  }
  if (a){
    if (ev.kind === 'tool' && ev.tool){
      const T = toolInfo(ev.tool); a.alat = {icon:T.icon, label:T.label, cat:T.cat, detail:ev.detail || '', ts:NOW};
      if (T.cat === 'agent') a.tugaskan = (a.tugaskan || 0) + 1;
      // skill yang sedang/terakhir dipakai (orang & divisinya) → chip menyala di kartu divisi & kartu detail
      if (ev.tool === 'Skill' && ev.detail){
        const s = {nama:namaSkill(ev.detail), ts:NOW, oleh:a};
        a.skill = s; if (a.team) a.team.skill = s;
        const n = a.skillN || (a.skillN = new Map()); n.set(s.nama, (n.get(s.nama) || 0) + 1);
      }
    }
    if (ev.kind === 'agent_stop'){ a.selesai = (a.selesai || 0) + 1; if (ev._since != null) a.kerjaTotal = (a.kerjaTotal || 0) + Math.max(0, NOW - ev._since); }
    if (!ev.who && ev.kind === 'stop') a.selesai = (a.selesai || 0) + 1;
    if (!ev.who && ev.kind === 'prompt') a.tugasTeks = ev.text || '';
  }
  if (ev._subM) catat(ev._subM, '📥', 'Menerima tugas dari ' + (ev.who ? (ev._m ? kodeNama(ev._m) : labelFor(ev.who)) : boss && boss.namaDiri ? boss.namaDiri + ' (Kepala)' : 'Kepala') + (ev.detail ? ': ' + short(ev.detail, 80) : ''));
  if (live && !ev.who && ev.kind === 'prompt' && reception){
    catat(reception, '📨', 'Meneruskan tugas baru ke Kepala' + (ev.text ? ': “' + short(ev.text, 60) + '”' : ''));
    reception.antar = (reception.antar || 0) + 1;
  }
  if (live && !ev.who && ev.kind === 'tool' && ev.tool === 'Skill' && namaSkill(ev.detail) === 'resepsionis' && reception){
    catat(reception, '🗂️', 'Merapikan permintaan jadi tiket untuk Kepala');
    rapikanTiket();
  }
}

/* ================= tab panel: Tim | Keterangan | Pengaturan ================= */
const TABS = [...document.querySelectorAll('#panel .tabs [role=tab]')];   // hanya tab panel (sub-tab dialog Laporan punya logika sendiri)
function pilihTab(tb, fokus){
  for (const x of TABS){ const on = x === tb; x.setAttribute('aria-selected', on ? 'true' : 'false'); x.tabIndex = on ? 0 : -1; $('#' + x.getAttribute('aria-controls')).hidden = !on; }
  if (fokus) tb.focus();
  if (tb.id === 'tabSet') isiInfoKualitas();
  if (tb.id === 'tabTok') tokenMuat();
  if (tb.id === 'tabLap') lapPanelBuka();
  if (tb.id === 'tabCht') chBuka();
  if (tb.id === 'tabPeg' && BUILT && (!pegEl.dataset.siap || sigPegawai() !== pegSig)) bangunPegawai();
}
TABS.forEach((tb, i) => {
  tb.addEventListener('click', () => pilihTab(tb));
  tb.addEventListener('keydown', e => {
    const j = {ArrowRight:(i + 1) % TABS.length, ArrowLeft:(i - 1 + TABS.length) % TABS.length, Home:0, End:TABS.length - 1}[e.key];
    if (j != null){ e.preventDefault(); pilihTab(TABS[j], true); }
  });
});

/* ================= tab Token (GET /token; format: .ai/brief/KONTRAK-token.md) =================
   Semua teks dari server (nama, path, judul, nama divisi) masuk lewat textContent, tidak pernah innerHTML. */
const TK = {seq:0, data:null, waktu:0, tunda:0, sibuk:false, bukaPr:new Set(), bukaSs:new Set(), bukaBl:new Set()};
const tkList = $('#tkList'), tkSt = $('#tkSt'), bTok = $('#bTok'), tkWaktu = $('#tkWaktu'), tk5N = $('#tk5N'), tk5R = $('#tk5R');
const tkBkJ = $('#tkBkJ'), tkBkS = $('#tkBkS'), tkBkSb = $('#tkBkSb'), tkKt = $('#tkKt'), tkKtI = $('#tkKtI'), tkKtT = $('#tkKtT'), tk5L = $('#tk5L'),
  tkBt = $('#tkBt'), tkBlS = $('#tkBlS'), tkBlK = $('#tkBlK'), tkBlok = $('#tkBlok'), tkPrT = $('#tkPrT');
const tkAkunF = $('#tkAkunF'), tkAkun = $('#tkAkun'), tk5U = $('#tk5U'), tkSbr = $('#tkSbr'), tkBtSb = $('#tkBtSb');
// gelombang 4 (KONTRAK-limit-resmi.md §4): limit resmi 5 jam/7 hari + catat manual
const tkRsm = $('#tkRsm'), tk7N = $('#tk7N'), tk7U = $('#tk7U'), tk7K = $('#tk7K'), tk7I = $('#tk7I'), tk7S = $('#tk7S');
const tkCatF = $('#tkCatF'), tkC5 = $('#tkC5'), tkC7 = $('#tkC7'), tkCatS = $('#tkCatS'), tkCatA = $('#tkCatA'), bTkCat = $('#bTkCat');
const TK_7H_KOSONG = 'Belum ada data resmi — jalankan Claude lewat terminal / catat manual';
const tk7Kal = $('#tk7Kal'), tkLama = $('#tkLama');   // gelombang 5 (KONTRAK-laporan.md §2d)
// akun (profil Claude Code) yang dipilih; diingat di UI.tokenAkun (localStorage tampilan). Pola id sama dengan server.
const TK_AKUN_RE = /^\.claude(-[A-Za-z0-9._-]{1,40})?$/;
TK.akun = typeof UI.tokenAkun === 'string' && TK_AKUN_RE.test(UI.tokenAkun) ? UI.tokenAkun : '';
TK.akunSig = ''; TK.batas = 0;
const tkAngka = (v, d) => v.toLocaleString('id-ID', {maximumFractionDigits:d});
// format ringkas Indonesia: 980 · 1,5 rb · 355 rb · 12,3 jt · 1,2 M
function fmtTok(n){
  n = Number(n) || 0; const a = Math.abs(n);
  if (a < 1e3) return tkAngka(Math.round(n), 0);
  if (a < 1e4) return tkAngka(n / 1e3, 1) + ' rb';
  if (a < 999500) return tkAngka(Math.round(n / 1e3), 0) + ' rb';
  if (a < 999950000) return tkAngka(n / 1e6, 1) + ' jt';
  return tkAngka(n / 1e9, 1) + ' M';
}
const tkJam = t => { const d = new Date(t); return String(d.getHours()).padStart(2, '0') + '.' + String(d.getMinutes()).padStart(2, '0'); };
const tkTgl = t => new Date(t).toLocaleDateString('id-ID', {day:'numeric', month:'short'}) + ' ' + tkJam(t);
const tkHariSama = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();
function tkDurasi(ms){
  const m = Math.round(Math.max(0, ms) / 60000);
  if (m < 1) return '<1 mnt';
  if (m < 60) return m + ' mnt';
  const j = Math.floor(m / 60);
  return j < 24 ? j + ' j ' + (m % 60) + ' mnt' : Math.floor(j / 24) + ' hr ' + (j % 24) + ' j';
}
const tkR = x => (x && typeof x === 'object') ? x : {};
function tkEl(tag, cls, teks){ const e = document.createElement(tag); if (cls) e.className = cls; if (teks != null) e.textContent = teks; return e; }
// warna & ikon bar mengikuti divisi yang dikenal (DIVISI); lainnya abu-abu
function tkDivisi(nama){ const d = DIVISI[String(nama || '').toLowerCase().replace(/^divisi-/, '')]; return d ? {warna:d.warna, ikon:d.ikon} : {warna:'var(--muted)', ikon:'🤖'}; }
const tkHari = () => (tkHariEl().find(x => x.checked) || {value:'30'}).value;
function tkHariEl(){ return [...document.querySelectorAll('#tkHari input')]; }

function tokenPesan(teks, galat = false, kosongkan = false){
  tkSt.textContent = teks || ''; tkSt.classList.toggle('err', !!galat);
  if (kosongkan){
    TK.data = null; tkList.replaceChildren(); tk5N.textContent = '–'; tk5N.removeAttribute('title'); tk5R.replaceChildren(); tkWaktu.textContent = '';
    tkBkJ.textContent = '–'; tkBkS.textContent = ''; tkBkSb.textContent = ''; tkKt.hidden = true; tk5L.textContent = ''; tkBt.textContent = '–';
    tkBlS.hidden = true; tkBlok.replaceChildren(); tkPrT.hidden = true;
    tk5U.textContent = 'token setara'; tkKtT.hidden = true; tkSbr.textContent = ''; tkBtSb.textContent = ''; TK.batas = 0;
    tkResmiKosong(); tkCatA.textContent = '';
  }
}
// persen terhadap perkiraan limit 5 jam (TK.batas = perkiraanBatas.setara akun terpilih); null = belum bisa dihitung
const tkPct = setara => TK.batas > 0 ? Math.max(0, tkNum(setara)) / TK.batas * 100 : null;
const tkPctTeks = p => p === null ? '' : p <= 0 ? '0%' : p < 1 ? '<1%' : '≈' + tkAngka(Math.round(p), 0) + '%';
// "1,2 jt" + kecil "≈10% limit" (dipakai di daftar proyek/sesi/divisi); ≥100% ditulis sebagai jumlah blok ("≈2,3 blok limit")
const tkLimitTeks = setara => { const p = tkPct(setara); return p === null ? '' : p >= 100 ? '≈' + tkAngka(p / 100, 1) + ' blok limit' : tkPctTeks(p) + ' limit'; };
// label pemilih akun: email dipotong ("nama@…") atau id profil bila email belum diketahui
function tkAkunLabel(a){
  const em = typeof a.email === 'string' ? a.email : '';
  if (!em) return String(a.id);
  const lok = em.split('@')[0];
  return (lok.length > 22 ? lok.slice(0, 21) + '…' : lok) + '@…';
}
function tkAkunRender(d){
  const daftar = (Array.isArray(d.akunDaftar) ? d.akunDaftar : []).filter(a => a && typeof a === 'object' && typeof a.id === 'string' && a.id);
  const aktif = typeof d.akun === 'string' ? d.akun : '';
  if (daftar.length < 2){ tkAkunF.hidden = true; tkAkun.replaceChildren(); TK.akunSig = ''; return; }
  tkAkunF.hidden = false;
  const sig = JSON.stringify(daftar.map(a => [a.id, a.email || '', tkNum(a.terakhir)]));
  if (sig !== TK.akunSig){
    // bangun ulang hanya bila daftar berubah (fokus keyboard tidak hilang saat muat ulang otomatis)
    TK.akunSig = sig;
    tkAkun.replaceChildren(...daftar.map(a => {
      const lb = tkEl('label'), inp = tkEl('input');
      inp.type = 'radio'; inp.name = 'tkAkun'; inp.value = a.id;
      const ter = tkNum(a.terakhir);
      lb.title = (a.email ? String(a.email) : 'email belum diketahui') + ' · profil ' + a.id + (ter ? ' · terakhir dipakai ' + tkTgl(ter) : ' · belum ada pemakaian');
      lb.append(inp, tkEl('span', null, tkAkunLabel(a)));
      return lb;
    }));
  }
  for (const inp of tkAkun.querySelectorAll('input')) inp.checked = inp.value === aktif;
}
tkAkun.addEventListener('change', e => {
  const v = e.target && e.target.value;
  if (!TK_AKUN_RE.test(String(v || ''))) return;
  TK.akun = v; UI.tokenAkun = v; simpanUI();
  // data akun sebelumnya tidak boleh tampil seolah milik akun baru
  tokenPesan('', false, true); tkCatS.textContent = '';
  tokenMuat();
});
function tokenSibuk(on){
  TK.sibuk = on; bTok.setAttribute('aria-disabled', on ? 'true' : 'false'); bTok.textContent = on ? 'Memuat…' : '↻ Muat ulang';
  tkList.setAttribute('aria-busy', on ? 'true' : 'false');
  if (!on) lapPanelRender();   // ringkasan di tab Laporan ikut data tab Token
}
async function tokenMuat(){
  clearTimeout(TK.tunda); TK.tunda = 0;
  const base = serverBase();
  if (base === null || params.has('demo')){ TK.seq++; tokenSibuk(false); tokenPesan('Butuh server: jalankan node server.js', false, true); tkAkunF.hidden = true; return; }
  const q = new URLSearchParams();
  if (KUNCI) q.set('kunci', KUNCI);
  q.set('hari', tkHari());
  if (TK.akun) q.set('akun', TK.akun);
  const n = ++TK.seq; tokenSibuk(true);
  if (!TK.data) tokenPesan('Memuat pemakaian token…');
  try {
    const r = await fetch(base + '/token?' + q.toString(), {cache:'no-store'});
    if (n !== TK.seq) return;
    if (r.status === 401){ kunciDitolak(); throw new Error(PESAN_KUNCI); }
    if (r.status === 404) throw new Error('Server belum mendukung data token. Jalankan ulang node server.js versi terbaru.');
    if (!r.ok) throw new Error('Gagal memuat data token (HTTP ' + r.status + ').');
    const d = await r.json();
    if (n !== TK.seq) return;
    if (!d || !Array.isArray(d.proyek)) throw new Error('Format data token dari server tidak dikenal.');
    TK.waktu = Date.now(); tokenRender(d);
  } catch (e){
    if (n !== TK.seq) return;
    const teks = e instanceof TypeError ? 'Butuh server: jalankan node server.js' : e instanceof SyntaxError ? 'Respons server tidak valid.' : e.message;
    tokenPesan(teks + (TK.data ? (/[.!?]$/.test(teks) ? ' ' : '. ') + 'Data di bawah dari pemuatan sebelumnya.' : ''), !(e instanceof TypeError), !TK.data);
  } finally { if (n === TK.seq) tokenSibuk(false); }
}
// kejadian SSE (Kepala / sub agent selesai) → muat ulang bila tab Token terlihat; paling cepat tiap 4 detik
function tokenPicu(){
  if (state.demo || $('#pTok').hidden || TK.tunda) return;
  TK.tunda = setTimeout(tokenMuat, 4000);
}
function tkBaris(nama, jumlah, r, totalSesi, warna, ikon){
  r = tkR(r);
  const w = tkEl('div', 'tk-rw'); w.style.setProperty('--c', warna);
  const h = tkEl('div', 'tk-rh'), nm = tkEl('span');
  nm.append(tkEl('span', 'tk-ik', ikon), nama);
  nm.firstChild.setAttribute('aria-hidden', 'true');
  if (jumlah) nm.append(' ', tkEl('small', null, '×' + jumlah));
  const nb = tkEl('b', null, fmtTok(r.setara)), lt = tkLimitTeks(r.setara);
  if (lt) nb.append(tkEl('small', null, ' · ' + lt));
  h.append(nm, nb);
  const pct = totalSesi > 0 ? Math.min(100, (Number(r.setara) || 0) / totalSesi * 100) : 0;
  const bar = tkEl('div', 'tk-bar'), isi = tkEl('i'); bar.setAttribute('aria-hidden', 'true'); isi.style.width = pct.toFixed(1) + '%'; bar.append(isi);
  const rm = tkEl('div', 'tk-rm', tkAngka(pct, 1) + '% dari sesi · mentah ' + fmtTok(r.total) + ' · ' + tkAngka(Number(r.panggilan) || 0, 0) + ' panggilan');
  w.append(h, bar, rm); return w;
}
function tkSesi(p, s){
  const k = p.id + '|' + s.id, t = tkR(s.total);
  const d = tkEl('details', 'tk-ss'); d.dataset.tk = 's'; d.dataset.key = k; d.open = TK.bukaSs.has(k);
  const sm = tkEl('summary'), sj = tkEl('span', 'tk-sj');
  const mulai = Number(s.mulai) || 0, selesai = Number(s.selesai) || mulai;
  sj.append(tkEl('b', null, s.judul ? String(s.judul) : String(s.id || '').slice(0, 8)),
    tkEl('small', null, tkTgl(mulai) + ' → ' + (tkHariSama(mulai, selesai) ? tkJam(selesai) : tkTgl(selesai)) + ' · ' + tkDurasi(selesai - mulai)));
  const sv = tkEl('span', 'tk-sv', fmtTok(t.setara)), lt = tkLimitTeks(t.setara);
  if (lt) sv.append(tkEl('small', null, lt));
  sm.append(sj, sv);
  const rws = tkEl('div', 'tk-rws'), tot = Number(t.setara) || 0;
  rws.append(tkBaris('Kepala (sesi utama)', 0, s.utama, tot, 'var(--on-bg)', '🧑‍💼'));
  for (const dv of Array.isArray(s.divisi) ? s.divisi : []){ const g = tkDivisi(dv.nama); rws.append(tkBaris(String(dv.nama || 'sub agent'), Number(dv.jumlah) || 0, dv.total, tot, g.warna, g.ikon)); }
  d.append(sm, rws); return d;
}
// rincian token mentah (input, cache, output, panggilan) sebagai <dl>
function tkRinci(r){
  r = tkR(r);
  return [['Input', r.input], ['Cache tulis', r.cacheTulis], ['Cache baca', r.cacheBaca], ['Output', r.output], ['Panggilan', r.panggilan]]
    .map(([t, v]) => { const x = tkEl('div'); x.append(tkEl('dt', null, t), tkEl('dd', null, t === 'Panggilan' ? tkAngka(Number(v) || 0, 0) : fmtTok(v))); return x; });
}
const tkNum = v => Number.isFinite(Number(v)) ? Number(v) : 0;
// persen terhadap perkiraan batas → kelas warna bar (≥70% kuning, ≥90% merah)
const tkLevel = pct => pct >= 90 ? 'tk-lv2' : pct >= 70 ? 'tk-lv1' : '';
// "sekarang" menurut jam server + waktu yang berlalu sejak data dimuat (diperbarui tiap menit tanpa fetch)
const tkSekarang = () => { const b = TK.data && tkR(TK.data.blok5jam); return (b && Number(b.sekarang) ? Number(b.sekarang) : TK.waktu || Date.now()) + (Date.now() - (TK.waktu || Date.now())); };
function tkSisa(){
  const b = TK.data && TK.data.blok5jam, a = b && b.aktif;
  if (!a || typeof a !== 'object'){ tkBkS.textContent = ''; return; }
  const sisa = tkNum(a.selesai) - tkSekarang();
  tkBkS.textContent = sisa > 0 ? ' sisa ' + tkDurasi(sisa) : ' blok selesai, muat ulang';
}
setInterval(() => { if (TK.data && !$('#pTok').hidden) tkSisa(); }, 60000);
/* ---- limit resmi (gelombang 4; KONTRAK-limit-resmi.md §3–4) ---- */
const tkResmiSah = x => x && typeof x === 'object' && x.persen !== null && x.persen !== '' && Number.isFinite(Number(x.persen)) ? x : null;
// "diukur 08.37 (statusline)"; hari lain → "diukur 30 Sep 08.37 (manual)"
function tkDiukur(w, sumber){
  const s = sumber === 'manual' ? 'manual' : sumber === 'statusline' ? 'statusline' : '';
  return (w ? 'diukur ' + (tkHariSama(w, tkSekarang()) ? tkJam(w) : tkTgl(w)) : 'waktu ukur tidak diketahui') + (s ? ' (' + s + ')' : '');
}
// setara blok aktif sesudah waktu sampel: dari server (limitResmi.limaJam.setaraSesudah). Server lama tanpa field itu:
// dibagi menurut waktu (pemakaian dianggap merata dari mulai blok sampai "sekarang") — perkiraan kasar.
function tkSetaraSesudah(a, waktu, sekarang, dariServer){
  if (Number.isFinite(dariServer)) return Math.max(0, dariServer);
  if (!a || !waktu) return 0;
  const st = Math.max(0, tkNum(tkR(a.total).setara)), mulai = tkNum(a.mulai), akhir = Math.min(sekarang, tkNum(a.selesai) || sekarang);
  if (waktu <= mulai) return st;
  if (akhir <= waktu || akhir <= mulai) return 0;
  return st * (akhir - waktu) / (akhir - mulai);
}
// "Jum 3 Okt 02.00"
const tkHariJam = t => new Date(t).toLocaleDateString('id-ID', {weekday:'short', day:'numeric', month:'short'}).replace(',', '') + ' ' + tkJam(t);
// limit 7 hari "perkiraan sekarang" (KONTRAK-laporan.md §2d): persen resmi + setaraSesudah ÷ kalibrasi7.setaraPerPersen, maks 100.
// Tanpa kalibrasi7 atau setaraSesudah → persen resmi apa adanya. lr = blok5jam.limitResmi; null bila belum ada sampel resmi.
function tkPerkiraan7(lr){
  lr = tkR(lr); const r7 = tkResmiSah(lr.tujuhHari); if (!r7) return null;
  const k7 = lr.kalibrasi7 && typeof lr.kalibrasi7 === 'object' && tkNum(lr.kalibrasi7.setaraPerPersen) > 0 ? lr.kalibrasi7 : null;
  const rp = Math.min(100, Math.max(0, tkNum(r7.persen))), ss = Number(r7.setaraSesudah);
  const sesudah = k7 && Number.isFinite(ss) && ss > 0 ? ss : 0, tambah = sesudah ? sesudah / tkNum(k7.setaraPerPersen) : 0;
  return {r7, k7, rp, sesudah, tambah, pct:Math.min(100, rp + tambah), kira:tambah >= 0.05, reset:tkNum(r7.reset), waktu:tkNum(r7.waktu)};
}
function tk7Render(lr){
  const q = tkPerkiraan7(lr);
  tk7K.hidden = !q;
  if (!q){ tk7N.textContent = '–'; tk7U.textContent = ''; tk7N.removeAttribute('title'); tk7S.textContent = TK_7H_KOSONG; tk7Kal.textContent = ''; return; }
  tk7N.textContent = (q.kira ? '≈' : '') + tkAngka(Math.round(q.pct), 0) + '%';
  tk7U.textContent = q.kira ? 'perkiraan sekarang · limit 7 hari' : 'dari limit 7 hari (resmi)';
  tk7N.title = q.kira ? 'Resmi ' + tkAngka(q.rp, 1) + '% saat diukur + ≈' + tkAngka(q.tambah, 1) + '% dari ' + fmtTok(q.sesudah) + ' token setara sesudahnya (1% ≈ ' + fmtTok(q.k7.setaraPerPersen) + ' setara, dikalibrasi)'
    : tkAngka(q.rp, 1) + '% dari limit 7 hari (resmi)';
  tk7I.className = tkLevel(q.pct); tk7I.style.width = q.pct.toFixed(1) + '%';
  tk7S.textContent = 'resmi ' + tkAngka(q.rp, 1) + '% · ' + tkDiukur(q.waktu, q.r7.sumber) + ' · ' + (q.reset ? 'reset ' + tkHariJam(q.reset) : 'jam reset belum diketahui');
  tk7Kal.textContent = q.k7 ? 'Dikalibrasi dari ' + tkAngka(tkNum(q.k7.dasar), 0) + ' pengukuran (1% ≈ ' + fmtTok(q.k7.setaraPerPersen) + ' setara).' : '';
}
function tkResmiKosong(){ tkRsm.hidden = true; tkRsm.textContent = ''; tk7Render(null); tkLama.hidden = true; }
function tkBlokRender(d){
  const b = d.blok5jam && typeof d.blok5jam === 'object' ? d.blok5jam : null;
  const l5 = tkR(tkR(d.limaJam).total);
  if (!b){
    // server versi lama (tanpa blok5jam)
    TK.batas = 0;
    tk5L.textContent = d.limaJam ? '5 jam bergulir: ' + fmtTok(l5.setara) + ' setara' : '';
    tkBkJ.textContent = '–'; tkBkS.textContent = ''; tkBkSb.textContent = 'Server belum mengirim data blok 5 jam. Jalankan ulang node server.js versi terbaru.';
    tk5N.textContent = '–'; tk5N.removeAttribute('title'); tk5U.textContent = 'token setara'; tk5R.replaceChildren(); tkKt.hidden = true; tkKtT.hidden = true;
    tkSbr.textContent = ''; tkBt.textContent = '–'; tkBtSb.textContent = '';
    tkResmiKosong();
    tkBlS.hidden = true; tkBlok.replaceChildren(); return;
  }
  const pb = b.perkiraanBatas && typeof b.perkiraanBatas === 'object' && tkNum(b.perkiraanBatas.setara) > 0 ? b.perkiraanBatas : null;
  const batas = pb ? tkNum(pb.setara) : 0;
  TK.batas = batas;
  // limit resmi (statusline / catat manual); server lama tanpa limitResmi → semua null
  const lr = tkR(b.limitResmi), r5 = tkResmiSah(lr.limaJam), r7 = tkResmiSah(lr.tujuhHari);
  const kal = lr.kalibrasi && typeof lr.kalibrasi === 'object' && tkNum(lr.kalibrasi.setaraPerPersen) > 0 ? lr.kalibrasi : null;
  // label sumber batas (KONTRAK-akun §2: "akun" | "gabungan"; KONTRAK-limit-resmi §3: "kalibrasi")
  const sbr = !pb ? '' : pb.sumber === 'kalibrasi' ? 'Dikalibrasi dari ' + tkAngka(kal ? tkNum(kal.dasar) : tkNum(pb.dasar), 0) + ' pengukuran resmi.'
    : pb.sumber === 'gabungan' ? 'Perkiraan dari riwayat limit akun lain (akun ini belum pernah kena limit).'
    : pb.sumber === 'akun' ? 'Perkiraan dari riwayat limit akun ini.' : '';
  const l5p = tkPct(l5.setara);
  tk5L.textContent = d.limaJam ? '5 jam bergulir: ' + (l5p === null ? '' : tkPctTeks(l5p) + ' · ') + fmtTok(l5.setara) + ' setara' : '';
  // kartu blok aktif: satuan utama = % limit 5 jam; token setara jadi keterangan kecil
  const a = b.aktif && typeof b.aktif === 'object' ? b.aktif : null;
  const t = a ? tkR(a.total) : {}, st = tkNum(t.setara);
  if (a){
    tkBkJ.textContent = tkJam(tkNum(a.mulai)) + ' → reset ' + tkJam(tkNum(a.selesai));
    tkBkSb.textContent = a.sumber === 'resmi' ? 'jam reset resmi' : a.sumber === 'reset' ? 'jam reset dari pesan limit' : 'jam blok perkiraan';
    tk5R.replaceChildren(...tkRinci(t));
  } else {
    tkBkJ.textContent = r5 && tkNum(r5.reset) ? 'Belum ada pemakaian di blok ini · reset ' + tkJam(tkNum(r5.reset)) : 'Belum ada pemakaian di blok ini';
    tkBkS.textContent = ''; tkBkSb.textContent = r5 && tkNum(r5.reset) ? 'jam reset resmi' : '';
    tk5R.replaceChildren();
  }
  // 1% limit 5 jam dalam token setara: kalibrasi resmi bila ada, selain itu perkiraan batas ÷ 100
  const perPersen = kal ? tkNum(kal.setaraPerPersen) : batas / 100;
  tkRsm.hidden = !r5; TK.akt = null;
  if (r5){
    // perkiraan sekarang = persen resmi + setara blok sesudah waktu sampel ÷ setara per 1%
    const rp = Math.min(100, Math.max(0, tkNum(r5.persen))), rw = tkNum(r5.waktu);
    const sesudah = tkSetaraSesudah(a, rw, tkNum(b.sekarang) || TK.waktu || Date.now(), r5.setaraSesudah);
    const tambah = perPersen > 0 ? sesudah / perPersen : 0, pct = Math.min(100, rp + tambah), kira = tambah >= 0.05;
    tk5N.textContent = (kira ? '≈' : '') + (pct > 0 && pct < 1 ? '<1' : tkAngka(Math.round(pct), 0)) + '%';
    tk5U.textContent = kira ? 'perkiraan sekarang · limit 5 jam' : 'dari limit 5 jam (resmi)';
    tk5N.title = kira ? 'Resmi ' + tkAngka(rp, 1) + '% saat diukur + ≈' + tkAngka(tambah, 1) + '% dari ' + fmtTok(sesudah) + ' token setara sesudahnya (1% ≈ ' + fmtTok(perPersen) + ' setara' + (kal ? ', dikalibrasi)' : ', perkiraan)')
      : tkAngka(rp, 1) + '% resmi' + (perPersen > 0 ? '' : ' (perkiraan sesudah pengukuran belum bisa dihitung)');
    tkRsm.textContent = 'resmi ' + tkAngka(rp, 1) + '% · ' + tkDiukur(rw, r5.sumber);
    // baris blok aktif di rekap memakai angka yang sama dengan kartu (perkiraan sekarang)
    TK.akt = {pct, teks:tk5N.textContent, title:tk5N.title};
    tkKt.hidden = false; tkKtI.className = tkLevel(pct); tkKtI.style.width = Math.min(100, pct).toFixed(1) + '%';
    if (a){ tkKtT.hidden = false; tkKtT.replaceChildren(tkEl('b', null, fmtTok(st)), ' token setara di blok ini' + (perPersen > 0 ? ' · 1% ≈ ' + fmtTok(perPersen) + ' setara' : '')); }
    else tkKtT.hidden = true;
    tkSbr.textContent = perPersen > 0 ? sbr : 'Kenaikan sesudah pengukuran belum bisa diperkirakan (belum ada kalibrasi/riwayat limit).';
    tkSbr.classList.toggle('gab', !!pb && pb.sumber === 'gabungan');
  } else if (batas){
    const pct = st / batas * 100;
    tk5N.textContent = tkPctTeks(pct); tk5U.textContent = 'dari limit 5 jam';
    tk5N.title = tkAngka(pct, 1) + '% dari perkiraan limit 5 jam (' + tkAngka(st, 0) + ' token setara)';
    tkKt.hidden = false; tkKtI.className = tkLevel(pct); tkKtI.style.width = Math.min(100, pct).toFixed(1) + '%';
    tkKtT.hidden = false;
    tkKtT.replaceChildren(tkEl('b', null, fmtTok(st)), ' token setara dari perkiraan batas ±' + fmtTok(batas));
    tkSbr.textContent = sbr; tkSbr.classList.toggle('gab', pb.sumber === 'gabungan');
  } else {
    // perkiraanBatas null → token saja + catatan
    tk5N.textContent = a ? fmtTok(st) : '–'; tk5U.textContent = 'token setara';
    if (a) tk5N.title = tkAngka(st, 0) + ' token setara'; else tk5N.removeAttribute('title');
    tkKt.hidden = true; tkKtT.hidden = true;
    tkSbr.textContent = 'Persen belum bisa dihitung: belum ada riwayat limit 5 jam di akun mana pun.'; tkSbr.classList.remove('gab');
  }
  tkSisa();
  // perkiraan batas
  if (pb && pb.sumber === 'kalibrasi'){
    tkBt.replaceChildren(tkEl('b', null, '±' + fmtTok(batas)), ' setara ',
      tkEl('small', null, '(1% resmi ≈ ' + fmtTok(kal ? kal.setaraPerPersen : batas / 100) + ' setara, median 30 hari)'));
  } else if (pb){
    tkBt.replaceChildren(tkEl('b', null, '±' + fmtTok(batas)), ' setara ',
      tkEl('small', null, '(median ' + tkAngka(tkNum(pb.dasar), 0) + ' blok yang kena limit, 30 hari; rentang ' + fmtTok(pb.min) + '–' + fmtTok(pb.max) + ')'));
  } else tkBt.textContent = 'Belum ada riwayat limit';
  tkBtSb.textContent = sbr; tkBtSb.classList.toggle('gab', !!pb && pb.sumber === 'gabungan');
  tk7Render(lr);
  // sampel resmi terakhir akun ini > 3 jam → petunjuk untuk mencatat % terbaru (membuka "Catat % dari VS Code")
  const ukurAkhir = Math.max(r5 ? tkNum(r5.waktu) : 0, r7 ? tkNum(r7.waktu) : 0);
  tkLama.hidden = !(ukurAkhir && tkSekarang() - ukurAkhir > 3 * 3600e3);
  // rekap blok (ikut pemilih rentang)
  const daftar = (Array.isArray(b.daftar) ? b.daftar : []).filter(x => x && typeof x === 'object');
  const skala = batas || Math.max(0, ...daftar.map(x => tkNum(tkR(x.total).setara)));
  const hari = Number(d.hari) || Number(tkHari());
  tkBlS.hidden = false;
  tkBlK.textContent = daftar.length ? `${daftar.length} blok dalam ${hari} hari terakhir · ` + (batas ? 'angka = ≈% limit 5 jam, bar terhadap perkiraan batas' : 'bar terhadap blok terbesar (persen belum bisa dihitung)')
    : `Belum ada blok 5 jam dalam ${hari} hari terakhir.`;
  const frag = document.createDocumentFragment();
  for (const x of daftar) frag.append(tkBlokBaris(x, skala, !!batas, !!a && tkNum(a.mulai) === tkNum(x.mulai)));
  tkBlok.replaceChildren(frag);
}
// satu baris rekap blok; bar relatif terhadap skala (perkiraan batas → berwarna menurut level; blok terbesar → warna biasa)
function tkBlokBaris(x, skala, keBatas, aktif){
  const t = tkR(x.total), st = tkNum(t.setara), mulai = tkNum(x.mulai), selesai = tkNum(x.selesai) || mulai;
  const k = 'b' + mulai;
  const d = tkEl('details', 'tk-ss tk-bl'); d.dataset.tk = 'b'; d.dataset.key = k; d.open = TK.bukaBl.has(k);
  const sm = tkEl('summary'), sj = tkEl('span', 'tk-sj');
  sj.append(tkEl('b', null, tkTgl(mulai) + ' → ' + (tkHariSama(mulai, selesai) ? tkJam(selesai) : tkTgl(selesai))));
  const ak = aktif && TK.akt, pct = ak ? TK.akt.pct : skala > 0 ? st / skala * 100 : 0;
  const bar = tkEl('span', 'tk-bar'), isi = tkEl('i', keBatas || ak ? tkLevel(pct) : '');
  bar.setAttribute('aria-hidden', 'true'); isi.style.width = Math.min(100, pct).toFixed(1) + '%'; bar.append(isi);
  const bdg = tkEl('span', 'tk-bdgs');
  if (aktif) bdg.append(tkEl('span', 'tk-bdg akt', 'aktif'));
  const lim = x.limit && typeof x.limit === 'object' ? x.limit : null;
  if (lim) bdg.append(tkEl('span', 'tk-bdg lim', '⛔ limit ' + tkJam(tkNum(lim.waktu)) + ' · ' + fmtTok(lim.setaraSaatLimit) + ' setara'));
  const rs = tkResmiSah(x.resmi);
  if (rs){ const e = tkEl('span', 'tk-bdg rsm', 'resmi ' + tkAngka(Math.min(100, Math.max(0, tkNum(rs.persen))), 1) + '%'); e.title = 'Persen resmi terakhir di blok ini · ' + tkDiukur(tkNum(rs.waktu), rs.sumber); bdg.append(e); }
  sj.append(bar, bdg);
  // angka kanan: "≈7%" (limit 5 jam) + kecil token setara; tanpa perkiraan batas → token saja
  const bp = tkPct(st), sv = tkEl('span', 'tk-sv', ak ? TK.akt.teks : bp === null ? fmtTok(st) : tkPctTeks(bp));
  if (ak){ sv.append(tkEl('small', null, fmtTok(st) + ' setara')); sv.title = TK.akt.title; }
  else if (bp !== null){ sv.append(tkEl('small', null, fmtTok(st) + ' setara')); sv.title = tkAngka(bp, 1) + '% dari perkiraan limit 5 jam'; }
  sm.append(sj, sv);
  const rws = tkEl('div', 'tk-rws');
  const pr = (Array.isArray(x.proyek) ? x.proyek : []).filter(p => p && typeof p === 'object');
  for (const p of pr){
    const ps = tkNum(p.setara), pp = st > 0 ? Math.min(100, ps / st * 100) : 0;
    const w = tkEl('div', 'tk-rw'), h = tkEl('div', 'tk-rh'), nm = tkEl('span');
    nm.append(tkEl('span', 'tk-ik', '📁'), String(p.nama || 'proyek')); nm.firstChild.setAttribute('aria-hidden', 'true');
    const pq = tkPct(ps), nb = tkEl('b', null, pq === null ? fmtTok(ps) : tkPctTeks(pq));
    if (pq !== null) nb.append(tkEl('small', null, ' · ' + fmtTok(ps)));
    h.append(nm, nb);
    const b2 = tkEl('div', 'tk-bar'), i2 = tkEl('i'); b2.setAttribute('aria-hidden', 'true'); i2.style.width = pp.toFixed(1) + '%'; b2.append(i2);
    w.append(h, b2, tkEl('div', 'tk-rm', tkAngka(pp, 1) + '% dari blok'));
    rws.append(w);
  }
  if (!pr.length) rws.append(tkEl('p', 'tk-rm', 'Tidak ada rincian proyek.'));
  const dl = tkEl('dl', 'tk-rinci'); dl.append(...tkRinci(t));
  const ket = [(x.sumber === 'resmi' ? 'Jam reset resmi' : x.sumber === 'reset' ? 'Jam dari pesan limit' : 'Jam perkiraan'), 'mentah ' + fmtTok(t.total)];
  if (rs) ket.push('resmi ' + tkAngka(Math.min(100, Math.max(0, tkNum(rs.persen))), 1) + '% · ' + tkDiukur(tkNum(rs.waktu), rs.sumber));
  if (lim) ket.push('limit setelah ' + fmtTok(lim.setaraSaatLimit) + ' setara (mentah ' + fmtTok(lim.totalSaatLimit) + ')');
  rws.append(dl, tkEl('div', 'tk-rm', ket.join(' · ')));
  d.append(sm, rws); return d;
}
function tokenRender(d){
  TK.data = d;
  tkAkunRender(d);
  tkBlokRender(d);
  const ak = tkCatAkun(), ai = ak && Array.isArray(d.akunDaftar) ? d.akunDaftar.find(x => x && x.id === ak) : null;
  tkCatA.textContent = ak ? 'Akun: ' + (ai ? tkAkunLabel(ai) : ak) : '';
  if (ai && ai.email) tkCatA.title = String(ai.email) + ' · profil ' + ak; else tkCatA.removeAttribute('title');
  tkWaktu.textContent = 'diperbarui otomatis tiap 1 menit · terakhir ' + tkJam(TK.waktu || Date.now());
  const hari = Number(d.hari) || Number(tkHari());
  tkPrT.hidden = !d.proyek.length;
  tokenPesan(d.proyek.length ? '' : `Belum ada pemakaian token dalam ${hari} hari terakhir.`);
  const frag = document.createDocumentFragment();
  for (const p of d.proyek){
    if (!p || typeof p !== 'object') continue;
    const t = tkR(p.total), sesi = Array.isArray(p.sesi) ? p.sesi : [];
    const det = tkEl('details', 'ket tk-pr'); det.dataset.tk = 'p'; det.dataset.key = String(p.id); det.open = TK.bukaPr.has(String(p.id));
    const sm = tkEl('summary'), nm = tkEl('span', 'tk-nm'), rk = tkEl('span', 'rk tk-rk');
    sm.append(tkEl('span', 'ic', '📁')); sm.firstChild.setAttribute('aria-hidden', 'true');
    nm.append(tkEl('b', null, String(p.nama || p.id || 'Proyek')), tkEl('small', null, String(p.path || '')));
    const js = Number(p.jumlahSesi) || sesi.length;
    const lt = tkLimitTeks(t.setara);
    rk.append(tkEl('b', null, fmtTok(t.setara)), tkEl('small', null, (lt ? lt + ' · ' : '') + js + ' sesi'));
    sm.append(nm, rk); det.append(sm);
    if (sesi.length < js) det.append(tkEl('p', 'tk-lb', `Menampilkan ${sesi.length} dari ${js} sesi terbaru.`));
    for (const s of sesi) if (s && typeof s === 'object') det.append(tkSesi(p, s));
    frag.append(det);
  }
  tkList.replaceChildren(frag);
}
// buka/tutup proyek & sesi diingat selama halaman terbuka (supaya muat ulang tidak menutup yang sedang dilihat)
function tkIngatBuka(e){
  const d = e.target; if (!(d instanceof HTMLDetailsElement) || !d.dataset.tk) return;
  const set = d.dataset.tk === 'p' ? TK.bukaPr : d.dataset.tk === 'b' ? TK.bukaBl : TK.bukaSs;
  d.open ? set.add(d.dataset.key) : set.delete(d.dataset.key);
}
tkList.addEventListener('toggle', tkIngatBuka, true);
tkBlok.addEventListener('toggle', tkIngatBuka, true);
bTok.addEventListener('click', () => { if (!TK.sibuk) tokenMuat(); });
$('#tkHari').addEventListener('change', () => tokenMuat());
// catat % dari VS Code → POST /limit/manual {akun, limaJam, tujuhHari|null}; kunci lewat ?kunci= seperti fetch lain
const tkCatAkun = () => { const a = TK.data && typeof TK.data.akun === 'string' ? TK.data.akun : TK.akun; return TK_AKUN_RE.test(String(a || '')) ? a : ''; };
// angka 0–100, koma/titik desimal (maks 2 angka di belakang koma); kosong → null; tidak sah → NaN
function tkCatAngka(inp){
  const s = inp.value.trim().replace(/\s*%$/, '').replace(',', '.');
  if (!s) return null;
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(s)) return NaN;
  const n = Number(s); return n >= 0 && n <= 100 ? n : NaN;
}
function tkCatPesan(teks, galat){ tkCatS.textContent = teks || ''; tkCatS.classList.toggle('err', !!galat); tkCatS.classList.toggle('ok', !galat && !!teks); }
tkCatF.addEventListener('submit', async e => {
  e.preventDefault();
  if (TK.catSibuk) return;
  const l5 = tkCatAngka(tkC5), l7 = tkCatAngka(tkC7);
  const s5 = l5 !== null && !Number.isNaN(l5), s7 = !Number.isNaN(l7);
  tkC5.setAttribute('aria-invalid', s5 ? 'false' : 'true'); tkC7.setAttribute('aria-invalid', s7 ? 'false' : 'true');
  if (!s5){ tkCatPesan(l5 === null ? 'Isi persen limit 5 jam (0–100).' : 'Limit 5 jam harus angka 0–100.', true); tkC5.focus(); return; }
  if (!s7){ tkCatPesan('Limit 7 hari harus angka 0–100 atau dikosongkan.', true); tkC7.focus(); return; }
  const base = serverBase();
  if (base === null || params.has('demo')){ tkCatPesan('Butuh server: jalankan node server.js', true); return; }
  const akun = tkCatAkun();
  if (!akun){ tkCatPesan('Akun belum diketahui. Tekan Muat ulang dulu.', true); return; }
  const q = KUNCI ? '?kunci=' + encodeURIComponent(KUNCI) : '';
  TK.catSibuk = true; bTkCat.setAttribute('aria-disabled', 'true'); bTkCat.textContent = 'Menyimpan…'; tkCatPesan('');
  try {
    const r = await fetch(base + '/limit/manual' + q, {method:'POST', cache:'no-store', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({akun, limaJam:l5, tujuhHari:l7})});
    if (r.status === 401){ kunciDitolak(); throw new Error(PESAN_KUNCI); }
    if (r.status === 404) throw new Error('Server belum mendukung catat limit. Jalankan ulang node server.js versi terbaru.');
    if (r.status === 400) throw new Error('Server menolak angka (harus 0–100).');
    if (r.status === 403) throw new Error('Ditolak server. Buka halaman ini lewat alamat server kantor.');
    if (!r.ok) throw new Error('Gagal menyimpan (HTTP ' + r.status + ').');
    const j = await r.json();
    if (!j || j.ok !== true) throw new Error('Respons server tidak dikenal.');
    tkC5.value = ''; tkC7.value = '';
    tkCatPesan('Tersimpan ' + tkJam(Date.now()) + ': 5 jam ' + tkAngka(l5, 2) + '%' + (l7 === null ? '' : ' · 7 hari ' + tkAngka(l7, 2) + '%') + '.');
    tokenMuat();
  } catch (err){
    tkCatPesan(err instanceof TypeError ? 'Butuh server: jalankan node server.js' : err instanceof SyntaxError ? 'Respons server tidak valid.' : err.message, true);
  } finally { TK.catSibuk = false; bTkCat.setAttribute('aria-disabled', 'false'); bTkCat.textContent = 'Simpan'; }
});

/* ================= tab Laporan + dialog laporan (gelombang 5; KONTRAK-laporan.md §2) =================
   (a) diagram alur kerja agen (data tetap ALUR_KERJA, dari CLAUDE.md global owner) + sorotan live dari kejadian SSE;
   (b) laporan token per akun/proyek/model/agen dari GET /token (per akun, berurutan). Semua teks server lewat textContent.
   Catatan: nama `ALUR` sudah dipakai strip "Alur kerja" kecil di tab Tim, jadi data diagram memakai `ALUR_KERJA`. */
const NAMA_KETUA = {analis:'Fajar', programmer:'Bima', ui:'Laras', reviewer:'Arya', qa:'Dewi', security:'Sekar', dokumentasi:'Rendra', devops:'Bayu'};
const namaKetua = k => namaSlot('div:' + k + '#1') || NAMA_KETUA[k] || pretty(k);
// nama orang dari tab Pegawai bila ada, selain itu nama bawaan
const ALUR_NAMA = {
  kepala:() => namaSlot('kepala') || 'Kepala', resepsionis:() => namaSlot('resepsionis') || 'Winda', fullstack:() => namaSlot('fullstack-quickfix#1') || 'Fullstack',
  analis:() => namaKetua('analis'), programmer:() => namaKetua('programmer'), ui:() => namaKetua('ui'), reviewer:() => namaKetua('reviewer'),
  security:() => namaKetua('security'), qa:() => namaKetua('qa'), dokumentasi:() => namaKetua('dokumentasi'), devops:() => namaKetua('devops'),
};
// {x} = nama orang (bawaan bila kosong); {@x} = " (nama)" hanya bila ada (Kepala & Resepsionis tetap disebut perannya)
const alurNama = s => String(s).replace(/\{(@?)(\w+)\}/g, (m, opt, k) => {
  if (!opt) return ALUR_NAMA[k] ? ALUR_NAMA[k]() : m;
  const n = k === 'kepala' ? namaSlot('kepala') : ALUR_NAMA[k] ? ALUR_NAMA[k]() : '';
  return n ? ' (' + n + ')' : '';
});
// tahap divisi disebut umum ("Divisi Analis"); panel penjelasan menampilkan semua anggota tim dari nama slot tab Pegawai (div:<k>#1..3)
const ALUR_TIM_LABEL = {analis:'Analis', programmer:'Programmer', ui:'UI/UX', reviewer:'Reviewer', qa:'QA', security:'Security', dokumentasi:'Dokumentasi', devops:'DevOps', fullstack:'Fullstack (bila diminta)'};
function alurTim(k){
  const tk = k === 'fullstack' ? 'fullstack-quickfix' : 'div:' + k, n = k === 'fullstack' ? 1 : ANGGOTA_PER_DIVISI, out = [];
  for (let i = 1; i <= n; i++){ const nm = namaSlot(tk + '#' + i); if (nm) out.push(nm); }
  return out;
}
// 16 tahap (KONTRAK-laporan.md §2b). warna: garis kiri simpul; div = kunci DIVISI (warna & ikon).
const ALUR_KERJA = [
  {id:'prompt', no:1, ikon:'📨', warna:'var(--accent)', judul:'Owner menulis permintaan', pelaku:'Owner (Anda) · lewat hook',
    siapa:'Anda (owner) di Claude Code. Hook UserPromptSubmit mengirim kejadian “prompt” ke kantor.',
    kapan:'Setiap kali Anda mengirim perintah atau pertanyaan.',
    masukan:'Teks permintaan, termasuk perintah khusus seperti /quickfix, “lewat analis”, “langsung ke <divisi>”, “tanpa QA”.',
    hasil:'Kepala menerima tugas; alur kerja dimulai.',
    aturan:'Perintah owner saat itu selalu menang atas aturan jalur dan kebiasaan umum.',
    kantor:'Resepsionis di Lobby meneruskan tugas; Kepala di Ruang Pimpinan (lantai 2) menampilkan balon “📨 Tugas baru!”.'},
  {id:'resepsionis', no:2, ikon:'🗂️', warna:'#3b6cf6', judul:'Resepsionis merapikan tiket', pelaku:'skill resepsionis · bila perlu',
    siapa:'Resepsionis{@resepsionis} lewat skill resepsionis — bukan divisi.',
    kapan:'Hanya bila permintaan perubahan kode masih mentah atau ambigu. Pertanyaan dan permintaan yang sudah jelas langsung ke Kepala.',
    masukan:'Permintaan owner apa adanya.',
    hasil:'Tiket di .ai/masuk/ dengan status menunggu → dikerjakan → selesai; dipakai Kepala sebagai brief.',
    aturan:'Tiket sensitif (login, hak akses, data pribadi, server) selalu menunggu persetujuan owner.',
    kantor:'Resepsionis di Lobby menampilkan balon “🗂️ Merapikan permintaan jadi tiket…”.'},
  {id:'kepala', no:3, ikon:'🧑‍💼', warna:'var(--on-bg)', judul:'Kepala membaca konteks', pelaku:'Kepala (sesi utama)',
    siapa:'Kepala{@kepala} — sesi utama Claude Code yang bertindak sebagai dispatcher.',
    kapan:'Setiap tugas, sebelum memilih jalur.',
    masukan:'CLAUDE.md global & proyek, memory, .ai/PETA.md, .ai/PROGRES.md, dan tiket (bila ada).',
    hasil:'Konteks proyek: aturan yang berlaku, status terakhir, dan file kunci.',
    aturan:'Jangan membaca ulang file besar yang sudah dirangkum divisi; lanjutan dibaca dari .ai/PROGRES.md, bukan dari riwayat percakapan.',
    kantor:'Kepala bekerja di mejanya di Ruang Pimpinan; balonnya menampilkan alat yang dipakai (Read, Grep, …).'},
  {id:'graphify', no:4, ikon:'🕸️', warna:'var(--on-bg)', judul:'Memetakan dengan Graphify', pelaku:'Kepala · graphify query',
    siapa:'Kepala.',
    kapan:'Sebelum membaca file mentah, bila proyek punya folder graphify-out/.',
    masukan:'graphify query "<inti tugas>" (juga graphify path / explain).',
    hasil:'File, fungsi, layer, dan ketergantungan yang relevan. Tanpa graph: Grep/Glob singkat + saran menjalankan /graphify . sekali.',
    aturan:'CodeIgniter: view/route berbasis string bisa tidak terbaca graph — pastikan dengan Grep singkat.',
    kantor:'Balon Kepala “Menjalankan perintah · graphify query …”.'},
  {id:'triase', no:5, ikon:'🔀', warna:'var(--on-bg)', judul:'Triase memilih jalur', pelaku:'Kepala · cabang ke 6 jalur',
    siapa:'Kepala.',
    kapan:'Setiap tugas; disebut dalam satu kalimat di awal jawaban, mis. “Jalur divisi → programmer + ui paralel, lalu QA.”',
    masukan:'Hasil pemetaan dan aturan jalur kerja.',
    hasil:'Satu dari 6 jalur: Pertanyaan · Cepat · Divisi langsung · Lewat analis · Sebelum rilis · Aplikasi baru (pilih di atas diagram untuk melihat rutenya).',
    aturan:'Eskalasi: bila ternyata lebih besar dari jalurnya, berhenti, laporkan temuan, lalu pindah ke jalur yang sesuai.',
    kantor:'Belum ada gerakan khusus; anggota divisi baru bergerak saat dipanggil.'},
  {id:'sasaran', no:6, ikon:'🎯', warna:'var(--on-bg)', judul:'“Yang akan Anda lihat”', pelaku:'Kepala · 2–4 baris',
    siapa:'Kepala.',
    kapan:'Fitur baru atau permintaan yang bisa ditafsirkan lebih dari satu cara, sebelum memanggil divisi.',
    masukan:'Permintaan owner dan sumber data yang tersedia.',
    hasil:'2–4 baris “Yang akan Anda lihat” dengan contoh angka/tampilan; bila masih ragu: SATU pertanyaan ke owner.',
    aturan:'Cek dulu bahwa sumber datanya memang ada — bertanya lebih murah daripada merevisi satu gelombang divisi.',
    kantor:'Bila Kepala bertanya, balonnya menunggu jawaban Anda.'},
  {id:'kontrak', no:7, ikon:'📜', warna:'var(--on-bg)', judul:'KONTRAK + RENCANA PARALEL', pelaku:'Kepala · skill padev-paralel',
    siapa:'Kepala dengan skill padev-paralel.',
    kapan:'Bila lebih dari satu divisi pengubah kode bekerja, atau backend dan tampilan berubah sekaligus.',
    masukan:'Pembagian file, URL endpoint, parameter, format JSON, nama tabel/kolom.',
    hasil:'Blok KONTRAK + RENCANA PARALEL dan brief lengkap per divisi (tujuan, file milik, file baca saja, kontrak, dampak, kriteria selesai).',
    aturan:'Satu file satu pemilik; file bersama (Routes, config, layout utama, JS/CSS global, .env) dipegang Kepala; maks 4 divisi per gelombang; semua divisi satu gelombang dipanggil dalam SATU pesan. Tanpa worktree/branch.',
    kantor:'Anggota yang dipanggil berjalan ke Ruang Pimpinan (lantai 2) untuk menerima brief.'},
  {id:'analis', no:8, ikon:'🧭', div:'analis', tim:['analis'], judul:'Divisi Analis', pelaku:'SRS · desain data · rencana',
    siapa:'Divisi Analis (divisi-analis).',
    kapan:'Kebutuhan belum jelas / ada beberapa cara, modul baru tanpa pola di proyek, atau perubahan besar struktur DB.',
    masukan:'Brief Kepala dan kode yang ditunjuk graph.',
    hasil:'SRS, desain data/ERD, dan rencana kerja di docs/sdlc/.',
    aturan:'Tidak mengubah kode; hanya menulis dokumen analisis.',
    kantor:'Anggota Analis bekerja di Ruang Rapat 2 (lantai 1).'},
  {id:'pelaksana', no:9, ikon:'💻', div:'programmer', tim:['programmer', 'ui', 'fullstack'], judul:'Programmer + UI/UX (paralel)', pelaku:'divisi pelaksana kode',
    siapa:'Divisi Programmer (backend & logika) dan Divisi UI/UX (tampilan), berjalan paralel. Fullstack-quickfix hanya bila owner bilang “pakai divisi fullstack”.',
    kapan:'Jalur divisi langsung, lewat analis, dan aplikasi baru — setelah kontrak.',
    masukan:'Brief + KONTRAK + daftar file milik divisi itu.',
    hasil:'Kode berubah hanya di file miliknya; laporan ke Kepala maks 12 baris.',
    aturan:'Hanya mengedit file milik; butuh file lain → berhenti dan lapor. Login/akses/upload → wajib padev-secure-baseline. Tanpa commit/branch.',
    kantor:'Programmer di Divisi Programmer (lantai 2), UI di Studio Desain (lantai 1); monitor menyala saat mengetik.'},
  {id:'reviewer', no:10, ikon:'🔎', div:'reviewer', tim:['reviewer'], judul:'Reviewer', pelaku:'menilai patch · hanya melapor',
    siapa:'Divisi Reviewer (divisi-reviewer).',
    kapan:'Bila menambah modul/controller/tabel baru, dan sebelum rilis.',
    masukan:'Patch (git diff) dan kontrak.',
    hasil:'Temuan kualitas: kebenaran, regresi, arsitektur, cakupan tes.',
    aturan:'Hanya melapor; tidak mengubah kode.',
    kantor:'Open Workspace (lantai 1); bisa bekerja paralel dengan QA/Security (balon 🤝).'},
  {id:'security', no:11, ikon:'🛡️', div:'security', tim:['security'], judul:'Security', pelaku:'audit keamanan · hanya melapor',
    siapa:'Divisi Security (divisi-security).',
    kapan:'Bila menyentuh auth, hak akses, upload, query, atau data pribadi; dan sebelum rilis.',
    masukan:'Patch dan area sensitif (checklist padev-security-*).',
    hasil:'Temuan keamanan beserta tingkat risikonya.',
    aturan:'Hanya melapor; temuan menunggu persetujuan owner sebelum diperbaiki programmer.',
    kantor:'Meja Security di Divisi Programmer (lantai 2).'},
  {id:'progres', no:12, ikon:'🗒️', warna:'var(--on-bg)', judul:'Progres & rangkuman', pelaku:'tiap divisi + Kepala',
    siapa:'Tiap divisi menulis progresnya; Kepala menutup gelombang.',
    kapan:'Sebelum tiap divisi selesai, dan saat Kepala menutup gelombang.',
    masukan:'.ai/progres/<divisi>.md (status, yang dikerjakan, lanjutan, keputusan, kendala).',
    hasil:'Cek bentrok, rangkuman .ai/PROGRES.md, dan .ai/PETA.md diperbarui bila struktur berubah.',
    aturan:'Analis ikut menutup hanya bila gelombang ≥3 divisi, ada bentrok, atau kontrak/struktur berubah besar.',
    kantor:'Anggota kembali ke Ruang Pimpinan untuk melapor, lalu pulang ke mejanya.'},
  {id:'qa', no:13, ikon:'🧪', div:'qa', tim:['qa'], judul:'QA (wajib)', pelaku:'setiap perubahan kode', tag:'↩ bila GAGAL → ke pelaksana',
    siapa:'Divisi QA (divisi-qa, model sonnet).',
    kapan:'WAJIB untuk setiap perubahan kode, termasuk jalur cepat; SEKALI untuk gabungan semua divisi.',
    masukan:'git diff + file baru, kontrak, kriteria selesai. Cakupan proporsional: cepat → terarah; divisi → modul; fitur baru/rilis → penuh.',
    hasil:'Baris QA: LULUS / GAGAL beserta temuannya.',
    aturan:'GAGAL → kembali ke divisi pemilik file (maks 2 putaran, lalu lapor owner). Perbaikan kecil ≤20 baris (tanpa login/DB) boleh dikerjakan Kepala + cek singkat. “tanpa QA” dari owner melewati langkah ini untuk tugas itu.',
    kantor:'Open Workspace (lantai 1).'},
  {id:'dokumentasi', no:14, ikon:'📚', div:'dokumentasi', tim:['dokumentasi'], judul:'Dokumentasi', pelaku:'manual & serah terima',
    siapa:'Divisi Dokumentasi (divisi-dokumentasi, model sonnet).',
    kapan:'Hanya bila rilis/serah terima, atau owner minta manual.',
    masukan:'Fitur yang sudah selesai dan lulus QA.',
    hasil:'Manual pengguna/admin dan dokumen serah terima.',
    aturan:'Tidak mengubah kode aplikasi.',
    kantor:'Open Workspace (lantai 1).'},
  {id:'devops', no:15, ikon:'🖥️', div:'devops', tim:['devops'], judul:'DevOps', pelaku:'deploy & server',
    siapa:'Divisi DevOps (divisi-devops).',
    kapan:'Deploy ke server, cek server, log, insiden.',
    masukan:'Rilis yang lulus QA & security; aturan STANDAR_DEVOPS.md.',
    hasil:'Hasil cek, runbook, deploy.',
    aturan:'Dari laptop hanya membaca (srv-baca); perubahan server hanya dari repo di server dengan persetujuan owner per langkah; root & rollback mode pemandu. Tidak ikut gelombang paralel kode.',
    kantor:'DevOps · NOC (lantai 2).'},
  {id:'laporan', no:16, ikon:'🏁', warna:'var(--on-bg)', judul:'Laporan akhir', pelaku:'Kepala → owner',
    siapa:'Kepala, kepada owner.',
    kapan:'Akhir setiap tugas (kejadian “stop”: Kepala selesai menjawab).',
    masukan:'Laporan divisi dan hasil QA.',
    hasil:'Ringkasan, file yang diubah, baris QA: LULUS/GAGAL; graphify update (proyek ber-graph); saran memulai percakapan baru.',
    aturan:'Sesi utama dibuat pendek: lanjutan dibaca dari .ai/PROGRES.md, bukan dari riwayat.',
    kantor:'Kepala menampilkan balon “🏁 Beres! Menunggu tugas berikutnya”.'},
];
const ALUR_BY = Object.fromEntries(ALUR_KERJA.map(s => [s.id, s]));
// kolom fase (kiri → kanan; layar sempit: atas → bawah)
const ALUR_FASE = [['Masuk', ['prompt', 'resepsionis']], ['Kepala memetakan', ['kepala', 'graphify', 'triase', 'sasaran']], ['Rencana', ['analis', 'kontrak']],
  ['Kerja', ['pelaksana', 'reviewer', 'security']], ['Periksa', ['progres', 'qa']], ['Selesai', ['dokumentasi', 'devops', 'laporan']]];
const ALUR_JALUR = [
  {id:'semua', nama:'Semua', teks:'Alur utama antar tahap yang berdekatan. Pilih satu jalur untuk melihat rute lengkapnya (termasuk lompatan, mis. Pertanyaan → Laporan akhir); tahap di luar jalur diredupkan.'},
  {id:'tanya', nama:'Pertanyaan', teks:'Pertanyaan / tanpa ubah kode → langsung laporan (tanpa divisi, tanpa QA).'},
  {id:'cepat', nama:'Cepat', teks:'Cepat (±3 file, tanpa DB/login/akses/upload) → Kepala + skill quickfix → QA → laporan.'},
  {id:'divisi', nama:'Divisi', teks:'Divisi langsung → kontrak → pelaksana → QA (+ reviewer bila modul/controller/tabel baru; + security bila auth/akses/upload/query/data pribadi).'},
  {id:'analis', nama:'Analis', teks:'Lewat analis (kebutuhan belum jelas / modul baru / DB besar) → analis → kontrak → pelaksana → QA.'},
  {id:'rilis', nama:'Rilis', teks:'Sebelum rilis → reviewer → QA + security paralel → dokumentasi (bila serah terima) → DevOps (deploy).'},
  {id:'baru', nama:'Aplikasi baru', teks:'Aplikasi baru → fase F1–F9 dengan gerbang persetujuan owner: F1 Fondasi & UM · F2 Kebutuhan · F3 Desain data · F4 Desain UI · F5 Konstruksi per modul · F6 QA · F7 Keamanan · F8 Rilis · F9 Deploy.'},
];
// panah: [dari, ke, jalur, jenis] — jenis 'opt' = bila perlu (putus-putus), 'balik' = QA GAGAL kembali ke pemilik file
const J_SEMUA = ['tanya', 'cepat', 'divisi', 'analis', 'rilis', 'baru'], J_KODE = ['divisi', 'analis', 'baru'];
const ALUR_PANAH = [
  ['prompt', 'kepala', J_SEMUA], ['prompt', 'resepsionis', J_KODE, 'opt'], ['resepsionis', 'kepala', J_KODE, 'opt'],
  ['kepala', 'graphify', J_SEMUA], ['graphify', 'triase', J_SEMUA],
  ['triase', 'laporan', ['tanya']], ['triase', 'qa', ['cepat']], ['triase', 'reviewer', ['rilis']], ['triase', 'sasaran', J_KODE],
  ['sasaran', 'kontrak', ['divisi']], ['sasaran', 'analis', ['analis', 'baru']], ['analis', 'kontrak', ['analis', 'baru']],
  ['kontrak', 'pelaksana', J_KODE], ['pelaksana', 'progres', J_KODE], ['progres', 'qa', J_KODE],
  ['pelaksana', 'reviewer', J_KODE, 'opt'], ['reviewer', 'security', ['divisi', 'analis', 'baru', 'rilis'], 'opt'],
  ['reviewer', 'qa', ['divisi', 'analis', 'baru', 'rilis']], ['security', 'dokumentasi', ['rilis']],
  ['qa', 'laporan', ['cepat', 'divisi', 'analis']], ['qa', 'dokumentasi', ['rilis', 'baru']],
  ['dokumentasi', 'devops', ['rilis', 'baru']], ['devops', 'laporan', ['rilis', 'baru']],
  ['qa', 'pelaksana', J_KODE, 'balik'],
];
// simpul yang dilewati tiap jalur (dihitung dari panahnya)
const ALUR_SIMPUL_JALUR = Object.fromEntries(J_SEMUA.map(j => [j, new Set(ALUR_PANAH.filter(p => p[2].includes(j)).flatMap(p => [p[0], p[1]]))]));
const ALUR_KOL = new Map(ALUR_FASE.flatMap(([, ids], i) => ids.map(id => [id, i])));
const ALUR_EL = new Map();
// sorotan live: tahap Kepala yang sedang berjalan + tahap yang sudah dilewati di sesi ini (pola state.flowDone: dikosongkan saat sesi baru)
const ALUR_LIVE = {kepala:null, lewat:new Set()};
const lapDlg = $('#lapDlg'), lpDg = $('#lpDg'), lpGr = $('#lpGr'), lpGrE = $('#lpGrE'), lpFase = $('#lpFase'), lpInf = $('#lpInf'), lpSisi = $('#lpSisi');
const lpTabAlur = $('#lpTabAlur'), lpTabTok = $('#lpTabTok'), lpAlur = $('#lpAlur'), lpTok = $('#lpTok'), lpLap = $('#lpLap'), lpSt = $('#lpSt');
const lpAkunF = $('#lpAkunF'), lpAkun = $('#lpAkun'), bLpMuat = $('#bLpMuat');
const LAP = {seq:0, sibuk:false, hasil:null, waktu:0, kunci:'', buka:new Set(), asal:null, jalur:'semua', pilih:'prompt', akun:'semua', akunDaftar:[], akunSig:'', olah:null, dibangun:false};
const lapSimpulDivisi = who => {
  const w = String(who || '');
  if (isDivName(w)) return {analis:'analis', programmer:'pelaksana', ui:'pelaksana', reviewer:'reviewer', security:'security', qa:'qa', dokumentasi:'dokumentasi', devops:'devops'}[divKey(w)] || null;
  return /(^|[:/])fullstack-quickfix$/.test(w) ? 'pelaksana' : null;
};
// anggota tim per divisi (chip nama); anggota tanpa nama tidak ditampilkan
function alurTimEl(s){
  const box = tkEl('div', 'lp-tim'), banyak = s.tim.length > 1;
  for (const k of s.tim){
    const nama = alurTim(k), dv = DIVISI[k], row = tkEl('div');
    row.append(tkEl('span', null, (banyak ? ALUR_TIM_LABEL[k] : 'Tim') + ':'));
    if (nama.length){
      const ul = tkEl('ul'); ul.setAttribute('aria-label', 'Tim ' + ALUR_TIM_LABEL[k]);
      for (const nm of nama){ const li = tkEl('li'), av = tkEl('i', null, nm.trim().charAt(0).toUpperCase()); av.setAttribute('aria-hidden', 'true'); if (dv) av.style.setProperty('--c', dv.warna); li.append(av, nm); ul.append(li); }
      row.append(ul);
    } else row.append(tkEl('span', 'ksg', (k === 'fullstack' ? '1' : ANGGOTA_PER_DIVISI) + ' anggota · nama belum diatur di tab Pegawai'));
    box.append(row);
  }
  return box;
}
const alurTimTeks = s => !s.tim ? '' : ' ' + s.tim.map(k => { const n = alurTim(k); return (s.tim.length > 1 ? ALUR_TIM_LABEL[k] : 'Tim') + ': ' + (n.length ? n.join(' · ') : 'nama belum diatur'); }).join('; ') + '.';
function alurBangun(){
  // dibangun ulang tiap dialog dibuka supaya nama pegawai terbaru ikut tampil
  // kotak penjelasan bisa sedang menumpang di dalam kolom (diagram sempit): kembalikan dulu ke sisi kanan,
  // kalau tidak ikut terhapus oleh replaceChildren di bawah dan dialog gagal dibuka lagi tanpa refresh
  if (lpInf.parentElement !== lpSisi) lpSisi.prepend(lpInf);
  ALUR_EL.clear();
  const frag = document.createDocumentFragment();
  ALUR_FASE.forEach(([judul, ids], i) => {
    // kelompok kolom: warna aksen g1..g6, judul + rentang nomor tahap
    const f = tkEl('div', 'lp-fase g' + (i + 1)), nos = ids.map(id => ALUR_BY[id].no);
    const rg = Math.min(...nos) + (nos.length > 1 ? '–' + Math.max(...nos) : ''), h = tkEl('h4'), sm = tkEl('small', null, rg);
    sm.setAttribute('aria-hidden', 'true'); h.append(tkEl('span', null, judul), tkEl('span', 'sr', ' (tahap ' + rg + ')'), sm); h.title = judul + ' · tahap ' + rg; f.append(h);
    for (const id of ids){
      const s = ALUR_BY[id];
      const b = tkEl('button', 'lp-n'); b.type = 'button'; b.dataset.id = id; b.setAttribute('aria-pressed', 'false');
      const hd = tkEl('span', 'hd'), no = tkEl('span', 'no', String(s.no)), ik = tkEl('span', 'ik', s.ikon);
      no.setAttribute('aria-hidden', 'true'); ik.setAttribute('aria-hidden', 'true'); hd.append(no, ik);
      b.append(hd, tkEl('span', 'sr', 'Tahap ' + s.no + ': '), tkEl('b', null, alurNama(s.judul)), tkEl('small', null, alurNama(s.pelaku)));
      if (s.tag) b.append(tkEl('span', 'lp-tg', s.tag));
      b.append(tkEl('span', 'sr lp-sts'));
      ALUR_EL.set(id, b); f.append(b);
    }
    frag.append(f);
  });
  lpFase.replaceChildren(frag);
  // daftar penjelasan lengkap untuk cetak/PDF
  const cd = $('#lpCetakD'); cd.replaceChildren(tkEl('h3', 'lp-h', 'Penjelasan tiap tahap'));
  for (const s of ALUR_KERJA){
    const a = tkEl('article'); a.append(tkEl('h4', null, s.no + '. ' + alurNama(s.judul) + ' — ' + alurNama(s.pelaku)));
    for (const [k, t] of [['siapa', 'Siapa'], ['kapan', 'Kapan dipakai'], ['masukan', 'Masukan'], ['hasil', 'Hasil'], ['aturan', 'Aturan penting'], ['kantor', 'Di kantor 3D']]){
      const p = tkEl('p'); p.append(tkEl('b', null, t + ': '), alurNama(s[k]) + (k === 'siapa' ? alurTimTeks(s) : '')); a.append(p);
    }
    cd.append(a);
  }
  alurJalurBangun();
  alurPilih(LAP.pilih);
  alurLiveRender();
}
function alurJalurBangun(){
  const seg = $('#lpJalur');
  if (!seg.childElementCount){
    seg.replaceChildren(...ALUR_JALUR.map(j => {
      const lb = tkEl('label'), inp = tkEl('input'); inp.type = 'radio'; inp.name = 'lpJalur'; inp.value = j.id;
      lb.append(inp, tkEl('span', null, j.nama)); return lb;
    }));
    seg.addEventListener('change', e => { if (e.target && e.target.name === 'lpJalur'){ LAP.jalur = e.target.value; alurJalurTerap(); } });
  }
  for (const inp of seg.querySelectorAll('input')) inp.checked = inp.value === LAP.jalur;
  alurJalurTerap();
}
function alurJalurTerap(){
  const j = ALUR_JALUR.find(x => x.id === LAP.jalur) || ALUR_JALUR[0], set = ALUR_SIMPUL_JALUR[j.id] || null;
  $('#lpJalurK').textContent = j.teks;
  for (const [id, b] of ALUR_EL){ const luar = !!set && !set.has(id); b.classList.toggle('redup', luar); b.dataset.luar = luar ? '1' : ''; }
  alurStatusSr();
  alurGambar();
}
// garis panah (SVG) dihitung dari posisi simpul; layar sempit (diagram vertikal) tanpa panah.
// Semua: hanya panah antar tahap berdekatan (kolom sama/sebelah) + panah balik QA; jalur terpilih: hanya rute jalur itu,
// lompatan jauh dibelokkan lewat lajur di bawah kolom (satu lajur per panah, sudut membulat) supaya tidak menumpuk;
// panah ke kolom sebelah yang beda tingginya jauh juga bersiku membulat (bukan kurva S curam) dengan titik keluar/masuk tersebar.
const alurSiku = (pts, r = 8) => {
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++){
    const [x0, y0] = pts[i - 1], [x, y] = pts[i], [x1, y1] = pts[i + 1];
    const q = Math.min(r, Math.hypot(x - x0, y - y0) / 2, Math.hypot(x1 - x, y1 - y) / 2);
    d += ` L${x - Math.sign(x - x0) * q} ${y - Math.sign(y - y0) * q} Q${x} ${y} ${x + Math.sign(x1 - x) * q} ${y + Math.sign(y1 - y) * q}`;
  }
  const z = pts[pts.length - 1]; return d + ` L${z[0]} ${z[1]}`;
};
function alurGambar(){
  if (!lapDlg.open || lpAlur.hidden || !ALUR_EL.size) return;
  if (getComputedStyle(lpGr).display === 'none'){ lpGrE.replaceChildren(); return; }
  const w = lpDg.getBoundingClientRect();
  const kotak = id => { const r = ALUR_EL.get(id).getBoundingClientRect(); const l = r.left - w.left, t = r.top - w.top; return {l, t, r:l + r.width, b:t + r.height, cx:l + r.width / 2, cy:t + r.height / 2}; };
  const K = new Map([...ALUR_EL.keys()].map(id => [id, kotak(id)]));
  const kol = [...lpFase.children].map(f => { const r = f.getBoundingClientRect(); return {l:r.left - w.left, r:r.right - w.left, b:r.bottom - w.top}; });
  const dasar = Math.max(...kol.map(k => k.b)) + 10;
  const set = LAP.jalur === 'semua' ? null : LAP.jalur;
  const daftar = [];
  for (const [dari, ke, jl, jenis] of ALUR_PANAH){
    if (set && !jl.includes(set)) continue;
    const ka = ALUR_KOL.get(dari), kb = ALUR_KOL.get(ke), jauh = jenis !== 'balik' && kb - ka > 1;
    if (jauh && !set) continue;
    daftar.push({jenis, A:K.get(dari), B:K.get(ke), dari, ke, ka, kb, jauh});
  }
  // sebar sekelompok panah di sekitar titik tengahnya (urut supaya tidak bersilang)
  const sebar = (gs, kunci, urut, jarak, setel) => {
    const grup = new Map();
    for (const g of gs){ const k = kunci(g); grup.has(k) ? grup.get(k).push(g) : grup.set(k, [g]); }
    for (const x of grup.values()){ x.sort(urut); const sp = jarak(x); x.forEach((g, i) => setel(g, (i - (x.length - 1) / 2) * sp)); }
  };
  // titik keluar/masuk di sisi kartu disebar per panah (yang menuju lebih atas keluar lebih atas)
  const antarKol = daftar.filter(g => g.jenis !== 'balik' && g.ka !== g.kb);
  sebar(antarKol, g => g.dari, (a, b) => (a.jauh ? 1e9 : a.B.cy) - (b.jauh ? 1e9 : b.B.cy), () => 12, (g, o) => { g.ya = g.A.cy + o; });
  sebar(antarKol, g => g.ke, (a, b) => (a.jauh ? 1e9 : a.A.cy) - (b.jauh ? 1e9 : b.A.cy), () => 12, (g, o) => { g.yb = g.B.cy + o; });
  // panah ke kolom sebelah yang naik/turun jauh: siku membulat, satu lajur per panah di celah kolom.
  // naik: tujuan paling atas di lajur paling kiri; turun: tujuan paling bawah paling kiri; panah balik QA paling kanan.
  const siku = daftar.filter(g => g.jenis === 'balik' || (!g.jauh && g.ka !== g.kb && Math.abs(g.yb - g.ya) >= 16));
  const nilaiLajur = g => g.jenis === 'balik' ? [2, 0] : g.yb < g.ya ? [0, g.yb] : [1, -g.yb];
  sebar(siku, g => Math.min(g.ka, g.kb),
    (a, b) => { const p = nilaiLajur(a), q = nilaiLajur(b); return p[0] - q[0] || p[1] - q[1]; },
    x => { const c = Math.min(x[0].ka, x[0].kb); return Math.min(10, (kol[c + 1].l - kol[c].r) / (x.length + 1)); },
    (g, o) => { const c = Math.min(g.ka, g.kb); g.gx = (kol[c].r + kol[c + 1].l) / 2 + o; });
  const biasa = [], sorot = []; let lajur = 0;
  for (const g of daftar){
    const {A, B, ka, kb, jenis} = g;
    let d;
    if (jenis === 'balik'){
      // QA (kolom Periksa) → pelaksana (kolom Kerja): masuk ke sisi kanan bawah pelaksana lewat celah antar kolom
      const y1 = A.b - 14, y2 = B.b - 14;
      d = alurSiku([[A.l, y1], [g.gx, y1], [g.gx, y2], [B.r + 1, y2]], 12);
    } else if (ka === kb) d = `M${A.cx} ${A.b} L${B.cx} ${B.t - 1}`;
    else if (!g.jauh){
      if (g.gx == null){ const dx = Math.max(12, (B.l - A.r) / 2); d = `M${A.r} ${g.ya} C${A.r + dx} ${g.ya} ${B.l - dx} ${g.yb} ${B.l - 1} ${g.yb}`; }
      else d = alurSiku([[A.r, g.ya], [g.gx, g.ya], [g.gx, g.yb], [B.l - 1, g.yb]], 12);
    } else {
      const y = dasar + lajur++ * 9, g1 = (kol[ka].r + kol[ka + 1].l) / 2 - 3, g2 = (kol[kb - 1].r + kol[kb].l) / 2 + 3;
      d = alurSiku([[A.r, g.ya], [g1, g.ya], [g1, y], [g2, y], [g2, g.yb], [B.l - 1, g.yb]], 12);
    }
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', d);
    const hi = !!set && jenis !== 'balik';
    p.setAttribute('class', 'e' + (jenis ? ' ' + jenis : '') + (hi ? ' hi' : ''));
    p.setAttribute('marker-end', jenis === 'balik' ? 'url(#lpMkE)' : hi ? 'url(#lpMkH)' : 'url(#lpMkN)');
    (hi ? sorot : biasa).push(p);
  }
  lpGrE.replaceChildren(...biasa, ...sorot);
}
// kotak penjelasan: di samping (lebar) atau tepat di bawah simpul terpilih (diagram vertikal)
function alurTempatInfo(){
  const vertikal = getComputedStyle(lpGr).display === 'none', b = ALUR_EL.get(LAP.pilih);
  if (vertikal && b){ if (b.nextElementSibling !== lpInf) b.after(lpInf); }
  else if (lpInf.parentElement !== lpSisi) lpSisi.prepend(lpInf);
}
function alurPilih(id, dariKlik){
  if (!ALUR_BY[id]) id = 'prompt';
  LAP.pilih = id;
  for (const [k, b] of ALUR_EL) b.setAttribute('aria-pressed', k === id ? 'true' : 'false');
  const s = ALUR_BY[id];
  lpInf.className = 'lp-inf g' + ((ALUR_KOL.get(id) || 0) + 1);
  const h = $('#lpInfT'), no = tkEl('span', 'no', String(s.no)); no.setAttribute('aria-hidden', 'true');
  const ik = tkEl('span', 'ik', s.ikon); ik.setAttribute('aria-hidden', 'true');
  h.replaceChildren(no, ik, tkEl('span', null, alurNama(s.judul)));
  const jl = ALUR_JALUR.filter(j => j.id !== 'semua' && ALUR_SIMPUL_JALUR[j.id].has(id)).map(j => j.nama);
  $('#lpInfP').textContent = alurNama(s.pelaku) + (jl.length ? ' · jalur: ' + jl.join(', ') : '');
  const dl = $('#lpInfD'), isi = [];
  for (const [k, t] of [['siapa', 'Siapa'], ['kapan', 'Kapan dipakai'], ['masukan', 'Masukan'], ['hasil', 'Hasil'], ['aturan', 'Aturan penting'], ['kantor', 'Yang terlihat di kantor 3D']]){
    const x = tkEl('div'), dd = tkEl('dd', null, alurNama(s[k]));
    if (k === 'siapa' && s.tim) dd.append(alurTimEl(s));
    x.append(tkEl('dt', null, t), dd); isi.push(x);
  }
  dl.replaceChildren(...isi);
  alurInfoStatus();
  alurTempatInfo();
  if (dariKlik && getComputedStyle(lpGr).display !== 'none' && matchMedia('(max-width:1280px)').matches) lpInf.scrollIntoView({block:'nearest', behavior:RM ? 'auto' : 'smooth'});
}
lpFase.addEventListener('click', e => { const b = e.target.closest('.lp-n'); if (b) alurPilih(b.dataset.id, true); });
/* ---- sorotan live (kejadian SSE yang sudah ada; mode demo/tanpa server: tanpa sorotan) ---- */
function alurKepala(id){
  const L = ALUR_LIVE;
  if (L.kepala && L.kepala !== id) L.lewat.add(L.kepala);
  L.kepala = id || null; if (id) L.lewat.delete(id);
}
function alurLive(ev){
  if (state.demo || !ev) return;
  try {
    if (ev.who){
      if (ev.kind === 'agent_stop'){ const n = lapSimpulDivisi(ev.who); if (n) ALUR_LIVE.lewat.add(n); }
    } else if (ev.kind === 'session'){ ALUR_LIVE.lewat.clear(); ALUR_LIVE.kepala = null; }
    else if (ev.kind === 'prompt') alurKepala('prompt');
    else if (ev.kind === 'stop') alurKepala('laporan');
    else if (ev.kind === 'tool'){
      const det = String(ev.detail || ''), T = toolInfo(ev.tool);
      if (ev.tool === 'Skill' && namaSkill(det) === 'resepsionis') alurKepala('resepsionis');
      else if ((ev.tool === 'Bash' || ev.tool === 'Skill') && /graphify/i.test(det)) alurKepala('graphify');
      else if (T.cat === 'agent') alurKepala(null);                       // Kepala menugaskan divisi: tahap Kepala sebelumnya selesai
      else if (ALUR_LIVE.kepala === 'prompt' || ALUR_LIVE.kepala === 'resepsionis') alurKepala('kepala');   // mulai membaca konteks
    }
  } catch (e){ console.warn(e); }
  alurLiveRender();
}
function alurAktif(){
  const s = new Set(); if (state.demo) return s;
  if (ALUR_LIVE.kepala) s.add(ALUR_LIVE.kepala);
  for (const t of state.teamList){ if (!t.members.some(m => m.job)) continue; const n = lapSimpulDivisi(t.who); if (n) s.add(n); }
  return s;
}
function alurStatusSr(){
  const akt = alurAktif();
  for (const [id, b] of ALUR_EL){
    const on = akt.has(id), lw = !on && ALUR_LIVE.lewat.has(id) && !state.demo;
    b.classList.toggle('on', on); b.classList.toggle('lewat', lw);
    const t = [on ? 'sedang berjalan' : lw ? 'sudah dilewati di sesi ini' : '', b.dataset.luar ? 'di luar jalur terpilih' : ''].filter(Boolean).join(', ');
    const sr = b.querySelector('.lp-sts'); if (sr && sr.textContent !== (t ? ' (' + t + ')' : '')) sr.textContent = t ? ' (' + t + ')' : '';
  }
  return akt;
}
function alurInfoStatus(){
  const p = $('#lpInfP'), lama = p.querySelector('.st'); if (lama) lama.remove();
  const id = LAP.pilih, on = alurAktif().has(id), lw = !on && ALUR_LIVE.lewat.has(id) && !state.demo;
  if (on || lw){ const st = tkEl('span', 'st ' + (on ? 'bekerja' : 'santai'), on ? '● sedang berjalan' : '✓ sudah dilewati'); p.append(st); }
}
function alurLiveRender(){
  const akt = ALUR_EL.size ? alurStatusSr() : alurAktif();
  if (ALUR_EL.size && lapDlg.open) alurInfoStatus();
  const now = $('#lpNow'), t = $('#lpNowT');
  const teks = state.demo ? 'Mode demo — sorotan live hanya saat tersambung ke server'
    : akt.size ? ALUR_KERJA.filter(s => akt.has(s.id)).map(s => s.no + '. ' + alurNama(s.judul)).join(' · ')
    : state.mode === 'live' ? (ALUR_LIVE.lewat.size ? 'Menunggu tugas berikutnya' : 'Belum ada kegiatan di sesi ini') : 'Belum tersambung ke server';
  now.classList.toggle('on', !!akt.size);
  if (t.textContent !== teks){ t.textContent = teks; t.title = teks; }
}
setInterval(() => { if (lapDlg.open || !$('#pLap').hidden) alurLiveRender(); }, 3000);   // anggota bisa dilepas tanpa kejadian (tugas macet)
if (window.ResizeObserver) new ResizeObserver(() => { if (lapDlg.open && !lpAlur.hidden){ alurTempatInfo(); alurGambar(); } }).observe(lpDg);
/* ---- laporan token ---- */
const LP_KEP = '\u0000kepala';
const lpNol = () => ({input:0, cacheTulis:0, cacheBaca:0, output:0, panggilan:0, total:0, setara:0});
function lpTambah(t, r){ r = tkR(r); for (const k of Object.keys(t)) t[k] += tkNum(r[k]); return t; }
const lpPersen = (a, b) => { if (!(b > 0)) return '–'; const p = a / b * 100; return p <= 0 ? '0%' : p < 1 ? '<1%' : tkAngka(Math.round(p), 0) + '%'; };
const lpPctTeks = q => !q || q.pct === null ? '–' : (q.kira ? '≈' : '') + (q.pct > 0 && q.pct < 1 ? '<1' : tkAngka(Math.round(q.pct), 0)) + '%';
// limit 5 jam "perkiraan sekarang" per akun — rumus sama dengan kartu Blok 5 jam aktif di tab Token
function tkPerkiraan5(b){
  b = tkR(b);
  const pb = b.perkiraanBatas && typeof b.perkiraanBatas === 'object' && tkNum(b.perkiraanBatas.setara) > 0 ? b.perkiraanBatas : null;
  const batas = pb ? tkNum(pb.setara) : 0, lr = tkR(b.limitResmi), r5 = tkResmiSah(lr.limaJam);
  const kal = lr.kalibrasi && typeof lr.kalibrasi === 'object' && tkNum(lr.kalibrasi.setaraPerPersen) > 0 ? lr.kalibrasi : null;
  const a = b.aktif && typeof b.aktif === 'object' ? b.aktif : null, st = a ? tkNum(tkR(a.total).setara) : 0;
  const perPersen = kal ? tkNum(kal.setaraPerPersen) : batas / 100;
  const dasar = {pb, kal, batas, a, st, r5, reset:a ? tkNum(a.selesai) : r5 ? tkNum(r5.reset) : 0};
  if (r5){
    const rp = Math.min(100, Math.max(0, tkNum(r5.persen)));
    const sesudah = tkSetaraSesudah(a, tkNum(r5.waktu), tkNum(b.sekarang) || Date.now(), r5.setaraSesudah);
    const tambah = perPersen > 0 ? sesudah / perPersen : 0;
    return {...dasar, pct:Math.min(100, rp + tambah), kira:tambah >= 0.05, rp};
  }
  if (batas) return {...dasar, pct:st / batas * 100, kira:true, rp:null};
  return {...dasar, pct:null, kira:false, rp:null};
}
function lapAgenInfo(nama){
  if (nama === LP_KEP){ const n = namaSlot('kepala'); return {label:n ? n + ' (Kepala)' : 'Kepala', sub:'sesi utama', ikon:'🧑‍💼', warna:'var(--on-bg)', pendek:'Kepala'}; }
  const s = String(nama || 'sub agent');
  if (isDivName(s)){ const k = divKey(s), dv = DIVISI[k]; if (dv) return {label:namaKetua(k) + ' · ' + dv.nama, sub:s, ikon:dv.ikon, warna:dv.warna, pendek:dv.nama}; }
  if (/(^|[:/])fullstack-quickfix$/.test(s)) return {label:ALUR_NAMA.fullstack() + ' · Fullstack', sub:s, ikon:'⚡', warna:'#ff9f1c', pendek:'Fullstack'};
  return {label:pretty(s), sub:s, ikon:'🤖', warna:'var(--muted)', pendek:pretty(s)};
}
const lapModelNama = m => m ? String(m) : 'tidak diketahui';
const lapHari = () => ([...document.querySelectorAll('#lpHari input')].find(x => x.checked) || {value:'30'}).value;
function lapPesan(teks, galat = false){ lpSt.textContent = teks || ''; lpSt.classList.toggle('err', !!galat); }
function lapSibuk(on){
  LAP.sibuk = on; bLpMuat.setAttribute('aria-disabled', on ? 'true' : 'false'); bLpMuat.textContent = on ? 'Memuat…' : '↻ Muat ulang';
  lpLap.setAttribute('aria-busy', on ? 'true' : 'false');
}
function lapAkunLabel(id){ const a = LAP.akunDaftar.find(x => x.id === id); return a ? tkAkunLabel(a) : String(id || ''); }
function lapAkunRender(){
  const daftar = LAP.akunDaftar;
  if (daftar.length < 2){ lpAkunF.hidden = true; lpAkun.replaceChildren(); LAP.akunSig = ''; return; }
  lpAkunF.hidden = false;
  const sig = JSON.stringify(daftar.map(a => [a.id, a.email || '']));
  if (sig !== LAP.akunSig){
    LAP.akunSig = sig;
    const opsi = [{id:'semua', label:'Semua akun', title:'Gabungan semua akun Claude Code'}].concat(daftar.map(a => ({id:a.id, label:tkAkunLabel(a), title:(a.email ? String(a.email) : 'email belum diketahui') + ' · profil ' + a.id})));
    lpAkun.replaceChildren(...opsi.map(o => { const lb = tkEl('label'), inp = tkEl('input'); inp.type = 'radio'; inp.name = 'lpAkun'; inp.value = o.id; lb.title = o.title; lb.append(inp, tkEl('span', null, o.label)); return lb; }));
  }
  if (LAP.akun !== 'semua' && !daftar.some(a => a.id === LAP.akun)) LAP.akun = 'semua';
  for (const inp of lpAkun.querySelectorAll('input')) inp.checked = inp.value === LAP.akun;
}
const lapSahDaftar = d => (Array.isArray(d && d.akunDaftar) ? d.akunDaftar : []).filter(a => a && typeof a === 'object' && typeof a.id === 'string' && TK_AKUN_RE.test(a.id));
async function lapMuat(){
  const base = serverBase();
  if (base === null || params.has('demo')){
    LAP.seq++; lapSibuk(false); LAP.hasil = null; LAP.olah = null; lpLap.replaceChildren(); lpAkunF.hidden = true;
    lapPesan('Butuh server: jalankan node server.js'); return;
  }
  const hari = lapHari(), pilih = LAP.akun, n = ++LAP.seq;
  lapSibuk(true);
  if (!LAP.hasil) lapPesan('Memuat laporan token…');
  const ambil = async akun => {
    const q = new URLSearchParams();
    if (KUNCI) q.set('kunci', KUNCI);
    q.set('hari', hari); if (akun) q.set('akun', akun);
    const r = await fetch(base + '/token?' + q.toString(), {cache:'no-store'});
    if (r.status === 401){ kunciDitolak(); throw new Error(PESAN_KUNCI); }
    if (r.status === 404) throw new Error('Server belum mendukung data token. Jalankan ulang node server.js versi terbaru.');
    if (!r.ok) throw new Error('Gagal memuat data token (HTTP ' + r.status + ').');
    const d = await r.json();
    if (!d || !Array.isArray(d.proyek)) throw new Error('Format data token dari server tidak dikenal.');
    return d;
  };
  try {
    if (!LAP.akunDaftar.length && TK.data) LAP.akunDaftar = lapSahDaftar(TK.data);
    const hasil = [];
    if (pilih !== 'semua') hasil.push(await ambil(pilih));
    else {
      const d0 = await ambil(LAP.akunDaftar.length ? LAP.akunDaftar[0].id : TK.akun);
      if (n !== LAP.seq) return;
      hasil.push(d0);
      const daftar = lapSahDaftar(d0);
      for (const a of daftar){
        if (hasil.some(h => h.akun === a.id)) continue;
        lapPesan('Memuat laporan token… (' + (hasil.length + 1) + '/' + daftar.length + ' akun)');
        const d = await ambil(a.id); if (n !== LAP.seq) return;
        if (!hasil.some(h => h.akun === d.akun)) hasil.push(d);
      }
    }
    if (n !== LAP.seq) return;
    const dd = lapSahDaftar(hasil[hasil.length - 1]);
    if (dd.length) LAP.akunDaftar = dd;
    const urut = LAP.akunDaftar.map(a => a.id);
    hasil.sort((a, b) => urut.indexOf(a.akun) - urut.indexOf(b.akun));
    LAP.hasil = hasil; LAP.waktu = Date.now(); LAP.kunci = hari + '|' + pilih;
    lapAkunRender(); lapRender(); lapPesan('');
    $('#lpWaktu').textContent = 'diperbarui otomatis tiap 1 menit · terakhir ' + tkJam(LAP.waktu);
  } catch (e){
    if (n !== LAP.seq) return;
    const teks = e instanceof TypeError ? 'Butuh server: jalankan node server.js' : e instanceof SyntaxError ? 'Respons server tidak valid.' : e.message;
    lapPesan(teks + (LAP.hasil ? (/[.!?]$/.test(teks) ? ' ' : '. ') + 'Data di bawah dari pemuatan sebelumnya.' : ''), !(e instanceof TypeError));
    if (!LAP.hasil) lpLap.replaceChildren();
  } finally { if (n === LAP.seq) lapSibuk(false); }
}
const lapMuatBila = () => { if (!LAP.sibuk && (!LAP.hasil || LAP.kunci !== lapHari() + '|' + LAP.akun || Date.now() - LAP.waktu > 60000)) lapMuat(); };
// gabungkan hasil per akun → total, proyek (dengan rincian agen), agen gabungan, model
function lapOlah(hasil){
  const R = {hari:Number(hasil[0] && hasil[0].hari) || Number(lapHari()), total:lpNol(), proyek:[], agen:new Map(), model:new Map(), adaModel:false, adaModelAgen:false,
    sesi:0, terpotong:false, subPanggil:0, kepala:0, divisi:0, akun:[], bobotCB:0.1};
  const bb = tkR(hasil[0] && hasil[0].bobot); if (tkNum(bb.cacheBaca) > 0) R.bobotCB = tkNum(bb.cacheBaca);
  const agen = (map, nama, r, jumlah, model) => {
    const e = map.get(nama) || {nama, jumlah:0, r:lpNol(), model:new Map()};
    e.jumlah += jumlah; lpTambah(e.r, r);
    if (typeof model === 'string'){ R.adaModelAgen = true; e.model.set(model, (e.model.get(model) || 0) + tkNum(tkR(r).setara)); }
    map.set(nama, e);
  };
  for (const d of hasil){
    const id = String(d.akun || ''), b = d.blok5jam && typeof d.blok5jam === 'object' ? d.blok5jam : null;
    const daftarBlok = b && Array.isArray(b.daftar) ? b.daftar.filter(x => x && typeof x === 'object') : [];
    R.akun.push({id, label:lapAkunLabel(id) || id, b, d, q5:b ? tkPerkiraan5(b) : null, q7:b ? tkPerkiraan7(b.limitResmi) : null, blok:daftarBlok, nLimit:daftarBlok.filter(x => x.limit && typeof x.limit === 'object').length});
    if (Array.isArray(d.perModel)){
      R.adaModel = true;
      for (const m of d.perModel){ if (!m || typeof m !== 'object') continue; const k = typeof m.model === 'string' ? m.model : ''; R.model.set(k, lpTambah(R.model.get(k) || lpNol(), m.total)); }
    }
    for (const p of d.proyek){
      if (!p || typeof p !== 'object') continue;
      const sesi = Array.isArray(p.sesi) ? p.sesi.filter(s => s && typeof s === 'object') : [], js = tkNum(p.jumlahSesi) || sesi.length;
      const pr = {kunci:id + '|' + String(p.id), akun:id, nama:String(p.nama || p.id || 'Proyek'), path:String(p.path || ''), total:lpTambah(lpNol(), p.total), sesi:js, agen:new Map(), kepala:0, divisi:0};
      lpTambah(R.total, p.total); R.sesi += js; if (sesi.length < js) R.terpotong = true;
      for (const s of sesi){
        agen(pr.agen, LP_KEP, s.utama, 1, s.utama && typeof s.utama === 'object' ? s.utama.model : undefined);
        for (const dv of Array.isArray(s.divisi) ? s.divisi : []){
          if (!dv || typeof dv !== 'object') continue;
          const j = Math.max(1, tkNum(dv.jumlah)); agen(pr.agen, String(dv.nama || 'sub agent'), dv.total, j, dv.model); R.subPanggil += j;
        }
      }
      for (const [k, e] of pr.agen){
        if (k === LP_KEP) pr.kepala += e.r.setara; else pr.divisi += e.r.setara;
        const g = R.agen.get(k) || {nama:k, jumlah:0, r:lpNol(), model:new Map(), proyek:new Map()};
        g.jumlah += e.jumlah; lpTambah(g.r, e.r);
        for (const [m, v] of e.model) g.model.set(m, (g.model.get(m) || 0) + v);
        g.proyek.set(pr.nama, (g.proyek.get(pr.nama) || 0) + e.r.setara);
        R.agen.set(k, g);
      }
      R.kepala += pr.kepala; R.divisi += pr.divisi;
      R.proyek.push(pr);
    }
  }
  R.proyek.sort((a, b) => b.total.setara - a.total.setara);
  const ag = [...R.agen.values()];
  R.agenUrut = ag.filter(g => g.nama === LP_KEP).concat(ag.filter(g => g.nama !== LP_KEP).sort((a, b) => b.r.setara - a.r.setara));
  R.modelUrut = [...R.model.entries()].sort((a, b) => b[1].setara - a[1].setara);
  return R;
}
const lapModelUtama = e => { let m = null, v = -1; for (const [k, x] of e.model) if (x > v){ v = x; m = k; } return m; };
// elemen bantu
function lapSeksi(judul, id){ const s = tkEl('section', 'lp-sk'); const h = tkEl('h3', 'lp-h', judul); h.id = id; s.setAttribute('aria-labelledby', id); s.append(h); return s; }
function lapTabel(judul, kolom, kiri = []){
  const w = tkEl('div', 'lp-tw'); w.tabIndex = 0; w.setAttribute('role', 'region'); w.setAttribute('aria-label', judul + ' (bisa digulir mendatar)');
  const t = tkEl('table', 'lp-t'), cap = tkEl('caption', 'sr', judul), th = tkEl('thead'), tr = tkEl('tr');
  kolom.forEach((k, i) => { const c = tkEl('th', null, k); c.scope = 'col'; if (kiri.includes(i)) c.className = 'kr2'; tr.append(c); });
  th.append(tr); const tb = tkEl('tbody'); t.append(cap, th, tb); w.append(t);
  return {w, t, tb};
}
function lapSel(tr, teks, kecil, tag = 'td'){ const c = tkEl(tag, null, teks); if (tag === 'th') c.scope = 'row'; if (kecil) c.append(tkEl('small', null, kecil)); tr.append(c); return c; }
function lapAgenSel(tr, nama, tag = 'th'){
  const g = lapAgenInfo(nama), c = tkEl(tag); if (tag === 'th') c.scope = 'row';
  const sp = tkEl('span', 'ag'), ik = tkEl('i', null, g.ikon); ik.setAttribute('aria-hidden', 'true'); ik.style.setProperty('--c', g.warna);
  const nm = tkEl('span'); nm.append(tkEl('b', null, g.label), tkEl('small', null, g.sub));
  sp.append(ik, nm); c.append(sp); tr.append(c); return c;
}
function lapBarSel(td, frac, warna){ const b = tkEl('span', 'bp'), i = tkEl('i'); b.setAttribute('aria-hidden', 'true'); if (warna) i.style.setProperty('--c', warna); i.style.width = Math.max(0, Math.min(100, frac * 100)).toFixed(1) + '%'; b.append(i); td.append(b); }
function lapMeter(judul, q, rinci){
  const m = tkEl('div', 'lp-mt'), h = tkEl('div', 'lp-mt-h');
  h.append(tkEl('span', null, judul), tkEl('b', null, lpPctTeks(q)));
  const bar = tkEl('div', 'tk-bar'), i = tkEl('i', q && q.pct !== null ? tkLevel(q.pct) : ''); bar.setAttribute('aria-hidden', 'true');
  i.style.width = (q && q.pct !== null ? Math.min(100, q.pct) : 0).toFixed(1) + '%'; bar.append(i);
  m.append(h, bar, tkEl('div', 'tk-rm', rinci)); return m;
}
function lapRender(){
  if (!LAP.hasil || !LAP.hasil.length){ lpLap.replaceChildren(); return; }
  const R = LAP.olah = lapOlah(LAP.hasil), multi = R.akun.length > 1, frag = document.createDocumentFragment();
  const sekarangGeser = Date.now() - (LAP.waktu || Date.now());
  // 1. rekap limit per akun
  const s1 = lapSeksi('Rekap limit Claude Code', 'lpS1'), kartu = tkEl('div', 'lp-akn');
  for (const a of R.akun){
    const k = tkEl('section', 'fs'), hd = tkEl('div', 'lp-ak-h'), ai = LAP.akunDaftar.find(x => x.id === a.id);
    const nm = tkEl('b', null, a.label); if (ai && ai.email) nm.title = String(ai.email);
    hd.append(nm, tkEl('small', null, 'profil ' + a.id)); k.append(hd);
    if (!a.b){ k.append(tkEl('p', 'tk-rm', 'Server belum mengirim data limit (blok5jam). Jalankan ulang node server.js versi terbaru.')); kartu.append(k); continue; }
    const now = (tkNum(a.b.sekarang) || LAP.waktu || Date.now()) + sekarangGeser, q5 = a.q5, q7 = a.q7;
    const r5 = [];
    if (q5.r5) r5.push((q5.kira ? 'perkiraan sekarang · ' : '') + 'resmi ' + tkAngka(q5.rp, 1) + '% · ' + tkDiukur(tkNum(q5.r5.waktu), q5.r5.sumber));
    else if (q5.pct !== null) r5.push('perkiraan dari riwayat token');
    else r5.push('persen belum bisa dihitung');
    if (q5.reset) r5.push('reset ' + tkJam(q5.reset) + (q5.reset > now ? ' · sisa ' + tkDurasi(q5.reset - now) : ''));
    k.append(lapMeter('Limit 5 jam', q5.pct === null ? null : q5, r5.join(' · ')));
    k.append(lapMeter('Limit 7 hari', q7, q7 ? (q7.kira ? 'perkiraan sekarang · ' : '') + 'resmi ' + tkAngka(q7.rp, 1) + '% · ' + tkDiukur(q7.waktu, q7.r7.sumber) + ' · ' + (q7.reset ? 'reset ' + tkHariJam(q7.reset) : 'jam reset belum diketahui') : TK_7H_KOSONG));
    const dl = tkEl('dl', 'lp-dl'), baris = (t, v) => { dl.append(tkEl('dt', null, t), tkEl('dd', null, v)); };
    baris('Kena limit ⛔', a.nLimit ? a.nLimit + ' blok 5 jam dalam ' + R.hari + ' hari' : 'tidak ada dalam ' + R.hari + ' hari');
    const pb = q5.pb, kal = q5.kal;
    baris('Perkiraan batas', pb ? '±' + fmtTok(pb.setara) + ' setara per 5 jam (' + (pb.sumber === 'kalibrasi' ? 'kalibrasi · ' + tkAngka(kal ? tkNum(kal.dasar) : tkNum(pb.dasar), 0) + ' pengukuran' : pb.sumber === 'gabungan' ? 'riwayat limit akun lain' : 'riwayat limit akun ini') + ')' : 'belum ada riwayat limit');
    if (q7 && q7.k7) baris('Kalibrasi 7 hari', '1% ≈ ' + fmtTok(q7.k7.setaraPerPersen) + ' setara · ' + tkAngka(tkNum(q7.k7.dasar), 0) + ' pengukuran');
    const lr = tkR(a.b.limitResmi), u5 = tkResmiSah(lr.limaJam), u7 = tkResmiSah(lr.tujuhHari);
    const uk = [u5, u7].filter(Boolean).sort((x, y) => tkNum(y.waktu) - tkNum(x.waktu))[0];
    baris('Ukur terakhir', uk ? tkDiukur(tkNum(uk.waktu), uk.sumber).replace(/^diukur /, '') : 'belum ada pengukuran resmi');
    k.append(dl); kartu.append(k);
  }
  s1.append(kartu); frag.append(s1);
  if (!R.proyek.length){
    const s = lapSeksi('Ringkasan', 'lpS2'); s.append(tkEl('p', 'lp-st', `Belum ada pemakaian token dalam ${R.hari} hari terakhir.`)); frag.append(s);
    lpLap.replaceChildren(frag); return;
  }
  const T = R.total;
  // 2. ringkasan
  const s2 = lapSeksi('Ringkasan · ' + R.hari + ' hari · ' + (multi ? 'semua akun (' + R.akun.length + ')' : 'akun ' + R.akun[0].label), 'lpS2');
  const tl = tkEl('dl', 'lp-tl');
  for (const [t, v, kc] of [['Total setara', fmtTok(T.setara), 'token setara'], ['Total mentah', fmtTok(T.total), 'token'], ['Panggilan', tkAngka(T.panggilan, 0), 'respons model'],
    ['Proyek', tkAngka(R.proyek.length, 0), multi ? 'dari ' + R.akun.length + ' akun' : ''], ['Sesi', tkAngka(R.sesi, 0), 'sesi Kepala'], ['Panggilan sub agent', tkAngka(R.subPanggil, 0), 'divisi & agen lain']]){
    const x = tkEl('div'), dd = tkEl('dd', null, v); if (kc) dd.append(tkEl('small', null, kc)); x.append(tkEl('dt', null, t), dd); tl.append(x);
  }
  s2.append(tl);
  const dua = tkEl('div', 'lp-2k'), seg = (judul, isi) => {
    const bx = tkEl('div', 'lp-bx'), sg = tkEl('div', 'lp-sg'), ul = tkEl('ul', 'lp-lgd'), tot = isi.reduce((s, x) => s + x[1], 0);
    sg.setAttribute('aria-hidden', 'true');
    for (const [nm, v, w, kc] of isi){
      const i = tkEl('i'); i.style.setProperty('--c', w); i.style.width = (tot > 0 ? v / tot * 100 : 0).toFixed(2) + '%'; sg.append(i);
      const li = tkEl('li'), dot = tkEl('i'); dot.style.setProperty('--c', w); dot.setAttribute('aria-hidden', 'true');
      li.append(dot, tkEl('span', null, nm + (kc ? ' · ' + kc : '')), tkEl('b', null, fmtTok(v)), tkEl('small', null, lpPersen(v, tot))); ul.append(li);
    }
    bx.append(tkEl('h4', 'lp-h', judul), sg, ul); return bx;
  };
  const kepNama = lapAgenInfo(LP_KEP).label;
  dua.append(seg('Kepala vs divisi (setara)', [[kepNama + ' (sesi utama)', R.kepala, 'var(--on-bg)'], ['Divisi & sub agent', R.divisi, 'var(--accent)']]),
    seg('Komposisi token (mentah)', [['Input', T.input, '#4d96ff', '×1'], ['Cache tulis', T.cacheTulis, '#e9b949', '×1,25–2'], ['Cache baca', T.cacheBaca, '#2a9d8f', '×' + tkAngka(R.bobotCB, 2)], ['Output', T.output, '#e76f51', '×5']]));
  s2.append(dua);
  if (R.terpotong) s2.append(tkEl('p', 'lp-cat', 'Pembagian per agen dihitung dari 30 sesi terbaru tiap proyek (server membatasi rincian sesi); total proyek tetap lengkap.'));
  frag.append(s2);
  // 3. per model (server lama tanpa perModel → disembunyikan)
  if (R.adaModel && R.modelUrut.length){
    const s3 = lapSeksi('Per model', 'lpS3'), tb = lapTabel('Pemakaian per model', ['Model', 'Setara', '% setara', 'Mentah', 'Panggilan']);
    const tot = R.modelUrut.reduce((s, [, r]) => s + r.setara, 0);
    for (const [m, r] of R.modelUrut){
      const tr = tkEl('tr'); lapSel(tr, lapModelNama(m), null, 'th'); lapSel(tr, fmtTok(r.setara));
      const c = lapSel(tr, lpPersen(r.setara, tot)); lapBarSel(c, tot > 0 ? r.setara / tot : 0);
      lapSel(tr, fmtTok(r.total)); lapSel(tr, tkAngka(r.panggilan, 0)); tb.tb.append(tr);
    }
    s3.append(tb.w); frag.append(s3);
  }
  // 4. per proyek (baris bisa dibuka → rincian per agen)
  const s4 = lapSeksi('Per proyek', 'lpS4'), kol4 = ['Proyek', 'Akun', 'Sesi', 'Setara', '% total', 'Kepala', 'Divisi'];
  const t4 = lapTabel('Pemakaian per proyek', kol4, [1]);
  let ni = 0;
  for (const p of R.proyek){
    const tr = tkEl('tr'), th = tkEl('th'); th.scope = 'row';
    const bt = tkEl('button', 'lp-xp'), car = tkEl('span', 'car'), sid = 'lpPr' + (ni++);
    bt.type = 'button'; car.setAttribute('aria-hidden', 'true'); bt.setAttribute('aria-controls', sid);
    const buka = LAP.buka.has(p.kunci); bt.setAttribute('aria-expanded', buka ? 'true' : 'false'); bt.dataset.k = p.kunci;
    bt.append(car, tkEl('span', null, p.nama)); if (p.path) bt.title = p.path;
    th.append(bt); tr.append(th);
    lapSel(tr, lapAkunLabel(p.akun)).classList.add('kr2'); lapSel(tr, tkAngka(p.sesi, 0)); lapSel(tr, fmtTok(p.total.setara));
    const c = lapSel(tr, lpPersen(p.total.setara, T.setara)); lapBarSel(c, T.setara > 0 ? p.total.setara / T.setara : 0);
    const kd = p.kepala + p.divisi;
    lapSel(tr, fmtTok(p.kepala), lpPersen(p.kepala, kd)); lapSel(tr, fmtTok(p.divisi), lpPersen(p.divisi, kd));
    const sub = tkEl('tr', 'lp-sub'); sub.id = sid; sub.hidden = !buka;
    const td = tkEl('td'); td.colSpan = kol4.length;
    const mk = ['Agen', 'Dipanggil', 'Setara', '% proyek'].concat(R.adaModelAgen ? ['Model'] : []);
    const mt = tkEl('table', 'lp-t'), mh = tkEl('thead'), mr = tkEl('tr'), mb = tkEl('tbody');
    mt.append(tkEl('caption', 'sr', 'Rincian agen proyek ' + p.nama));
    for (const k of mk){ const x = tkEl('th', null, k); x.scope = 'col'; mr.append(x); }
    mh.append(mr); mt.append(mh, mb);
    const agen = [...p.agen.values()].sort((a, b) => (a.nama === LP_KEP ? -1 : b.nama === LP_KEP ? 1 : b.r.setara - a.r.setara));
    for (const e of agen){
      const r2 = tkEl('tr'); lapAgenSel(r2, e.nama);
      lapSel(r2, tkAngka(e.jumlah, 0) + (e.nama === LP_KEP ? ' sesi' : '×')); lapSel(r2, fmtTok(e.r.setara));
      const c2 = lapSel(r2, lpPersen(e.r.setara, kd)); lapBarSel(c2, kd > 0 ? e.r.setara / kd : 0, lapAgenInfo(e.nama).warna);
      if (R.adaModelAgen) lapSel(r2, lapModelNama(lapModelUtama(e)));
      mb.append(r2);
    }
    td.append(mt); sub.append(td);
    t4.tb.append(tr, sub);
  }
  const tf = tkEl('tfoot'), ft = tkEl('tr'); lapSel(ft, 'Total', null, 'th'); lapSel(ft, multi ? R.akun.length + ' akun' : R.akun[0].label).classList.add('kr2');
  lapSel(ft, tkAngka(R.sesi, 0)); lapSel(ft, fmtTok(T.setara)); lapSel(ft, '100%'); lapSel(ft, fmtTok(R.kepala)); lapSel(ft, fmtTok(R.divisi));
  tf.append(ft); t4.t.append(tf);
  s4.append(t4.w, tkEl('p', 'lp-cat', 'Klik nama proyek untuk melihat rincian per agen. Kepala/Divisi dihitung dari rincian sesi.')); frag.append(s4);
  // 5. per agen (gabungan semua proyek)
  const s5 = lapSeksi('Per agen · gabungan semua proyek', 'lpS5');
  const t5 = lapTabel('Pemakaian per agen', ['Agen', 'Dipanggil', 'Setara', '% total', 'Rata-rata / panggilan', 'Proyek terbanyak'].concat(R.adaModelAgen ? ['Model'] : []), [5]);
  const totAg = R.kepala + R.divisi;
  for (const g of R.agenUrut){
    const tr = tkEl('tr'); lapAgenSel(tr, g.nama);
    const kep = g.nama === LP_KEP;
    lapSel(tr, tkAngka(g.jumlah, 0) + (kep ? ' sesi' : '×')); lapSel(tr, fmtTok(g.r.setara));
    const c = lapSel(tr, lpPersen(g.r.setara, totAg)); lapBarSel(c, totAg > 0 ? g.r.setara / totAg : 0, lapAgenInfo(g.nama).warna);
    lapSel(tr, g.jumlah ? fmtTok(g.r.setara / g.jumlah) : '–', kep ? 'per sesi' : 'per panggilan');
    let pt = '', pv = -1; for (const [nm, v] of g.proyek) if (v > pv){ pv = v; pt = nm; }
    lapSel(tr, pt || '–', pt ? fmtTok(pv) + ' setara' : null).classList.add('kr2');
    if (R.adaModelAgen) lapSel(tr, lapModelNama(lapModelUtama(g)));
    t5.tb.append(tr);
  }
  s5.append(t5.w); frag.append(s5);
  // 6. matriks proyek × agen (heatmap)
  const s6 = lapSeksi('Matriks proyek × agen (token setara)', 'lpS6'), kolAg = R.agenUrut.map(g => g.nama);
  const t6 = lapTabel('Matriks proyek kali agen', ['Proyek']); t6.t.classList.add('lp-hm');
  const hr = t6.t.tHead.rows[0];
  for (const nm of kolAg){ const g = lapAgenInfo(nm), th = tkEl('th', null, g.ikon + ' ' + g.pendek); th.scope = 'col'; th.title = g.label + ' (' + g.sub + ')'; hr.append(th); }
  let maks = 0; for (const p of R.proyek) for (const e of p.agen.values()) maks = Math.max(maks, e.r.setara);
  for (const p of R.proyek){
    const tr = tkEl('tr'); lapSel(tr, p.nama, multi ? lapAkunLabel(p.akun) : null, 'th');
    for (const nm of kolAg){
      const e = p.agen.get(nm), v = e ? e.r.setara : 0;
      if (!v){ const c = lapSel(tr, '–'); c.className = 'ksg'; continue; }
      const c = lapSel(tr, fmtTok(v)); c.dataset.v = '1'; c.style.setProperty('--h', (6 + 50 * Math.sqrt(v / (maks || 1))).toFixed(1) + '%');
      c.title = p.nama + ' · ' + lapAgenInfo(nm).label + ': ' + tkAngka(Math.round(v), 0) + ' setara';
    }
    t6.tb.append(tr);
  }
  s6.append(t6.w, tkEl('p', 'lp-cat', 'Warna makin pekat = setara makin besar; – = agen itu tidak dipakai di proyek tersebut.')); frag.append(s6);
  // 7. rekap blok 5 jam
  const blok = R.akun.flatMap(a => a.blok.map(x => ({a, x}))).sort((p, q) => tkNum(q.x.mulai) - tkNum(p.x.mulai));
  const s7 = lapSeksi('Rekap blok 5 jam', 'lpS7');
  if (!blok.length) s7.append(tkEl('p', 'lp-cat', R.akun.some(a => a.b) ? `Belum ada blok 5 jam dalam ${R.hari} hari terakhir.` : 'Server belum mengirim data blok 5 jam.'));
  else {
    const t7 = lapTabel('Rekap blok 5 jam', (multi ? ['Akun'] : []).concat(['Mulai – selesai', 'Setara', '% batas', 'Resmi', 'Limit']), multi ? [1] : []);
    for (const {a, x} of blok){
      const tr = tkEl('tr'), st = tkNum(tkR(x.total).setara), mulai = tkNum(x.mulai), selesai = tkNum(x.selesai) || mulai;
      if (multi) lapSel(tr, a.label, null, 'th');
      const akt = a.b && a.b.aktif && typeof a.b.aktif === 'object' && tkNum(a.b.aktif.mulai) === mulai;
      lapSel(tr, tkTgl(mulai) + ' → ' + (tkHariSama(mulai, selesai) ? tkJam(selesai) : tkTgl(selesai)), (akt ? 'aktif · ' : '') + (x.sumber === 'resmi' ? 'jam resmi' : x.sumber === 'reset' ? 'jam dari pesan limit' : 'jam perkiraan'), multi ? 'td' : 'th').classList.add('kr2');
      lapSel(tr, fmtTok(st));
      const bt = a.q5 && a.q5.batas ? a.q5.batas : 0;
      const c = lapSel(tr, akt && a.q5 && a.q5.pct !== null ? lpPctTeks(a.q5) : bt ? lpPersen(st, bt) : '–'); if (bt) lapBarSel(c, st / bt, 'var(--accent)');
      const rs = tkResmiSah(x.resmi); lapSel(tr, rs ? tkAngka(Math.min(100, Math.max(0, tkNum(rs.persen))), 1) + '%' : '–', rs ? tkDiukur(tkNum(rs.waktu), rs.sumber).replace(/^diukur /, '') : null);
      const lim = x.limit && typeof x.limit === 'object' ? x.limit : null;
      lapSel(tr, lim ? '⛔ ' + tkJam(tkNum(lim.waktu)) : '–', lim ? fmtTok(lim.setaraSaatLimit) + ' setara' : null);
      t7.tb.append(tr);
    }
    s7.append(t7.w);
  }
  frag.append(s7);
  // 8. catatan otomatis
  const s8 = lapSeksi('Catatan otomatis', 'lpS8'), ul = tkEl('ul', 'lp-nt'), nt = [];
  if (totAg > 0) nt.push(kepNama + ' memakai ' + lpPersen(R.kepala, totAg) + ' dari total setara; divisi & sub agent ' + lpPersen(R.divisi, totAg) + '.');
  for (const a of R.akun){
    const bg = [];
    if (a.nLimit) bg.push('kena limit 5 jam ' + a.nLimit + '× dalam ' + R.hari + ' hari terakhir');
    if (a.q7 && a.q7.pct >= 70) bg.push('limit 7 hari ' + lpPctTeks(a.q7) + (a.q7.pct >= 90 ? ' — hampir habis, hemat pemakaian sampai reset' : ' — mulai tinggi'));
    if (bg.length) nt.push('Akun ' + a.label + ': ' + bg.join('; ') + '.');
  }
  const ag = R.agenUrut.filter(g => g.nama !== LP_KEP && g.jumlah > 0);
  let ntBesar = '';
  if (ag.length){
    const mahal = ag.reduce((m, g) => g.r.setara / g.jumlah > m.r.setara / m.jumlah ? g : m);
    nt.push(lapAgenInfo(mahal.nama).label + ' (' + mahal.nama + ') paling mahal per panggilan: ≈' + fmtTok(mahal.r.setara / mahal.jumlah) + ' setara tiap dipanggil.');
    const besar = ag[0]; if (besar !== mahal) ntBesar = (lapAgenInfo(besar.nama).label + ' memakai paling banyak di antara divisi: ' + lpPersen(besar.r.setara, totAg) + ' dari total (' + besar.jumlah + '× dipanggil).');
  }
  const pb1 = R.proyek[0]; if (pb1) nt.push('Proyek terbesar: ' + pb1.nama + ' (' + lpPersen(pb1.total.setara, T.setara) + ' dari total' + (multi ? ', akun ' + lapAkunLabel(pb1.akun) : '') + ').');
  if (R.adaModel && R.modelUrut.length){ const [m, r] = R.modelUrut[0], tm = R.modelUrut.reduce((s, [, x]) => s + x.setara, 0); nt.push('Model ' + lapModelNama(m) + ' menyumbang ' + lpPersen(r.setara, tm) + ' token setara.'); }
  if (ntBesar) nt.push(ntBesar);
  if (T.total > 0) nt.push('Cache baca = ' + lpPersen(T.cacheBaca, T.total) + ' token mentah, tetapi hanya ≈' + lpPersen(T.cacheBaca * R.bobotCB, T.setara) + ' beban setara (bobot ×' + tkAngka(R.bobotCB, 2) + ').');
  for (const t of nt.slice(0, 6)) ul.append(tkEl('li', null, t));
  s8.append(ul, tkEl('p', 'lp-cat', 'Setara = perkiraan beban kuota (input ×1, cache tulis ×1,25–2, cache baca ×0,1, output ×5), bukan angka resmi. Pemakaian di Claude Desktop/claude.ai/perangkat lain tidak tercatat.'));
  frag.append(s8);
  lpLap.replaceChildren(frag);
}
lpLap.addEventListener('click', e => {
  const b = e.target.closest('.lp-xp'); if (!b) return;
  const buka = b.getAttribute('aria-expanded') !== 'true', sub = document.getElementById(b.getAttribute('aria-controls'));
  b.setAttribute('aria-expanded', buka ? 'true' : 'false'); if (sub) sub.hidden = !buka;
  buka ? LAP.buka.add(b.dataset.k) : LAP.buka.delete(b.dataset.k);
});
// CSV: baris per proyek × agen. Sel teks yang diawali = + - @ diberi ' supaya tidak dijalankan sebagai rumus oleh spreadsheet.
function lapCsvSel(v){
  if (typeof v === 'number') return String(Math.round(v));
  let s = String(v == null ? '' : v); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\r\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function lapCsv(){
  const R = LAP.olah;
  if (!R || !R.proyek.length){ lapPesan('Belum ada data untuk diunduh. Tekan Muat ulang dulu.', true); return; }
  const kol = ['akun', 'proyek', 'agen', 'jumlah', 'input', 'cacheTulis', 'cacheBaca', 'output', 'panggilan', 'total', 'setara', 'model'], baris = [kol.join(',')];
  for (const p of R.proyek) for (const e of p.agen.values()){
    const r = e.r;
    baris.push([p.akun, p.nama, e.nama === LP_KEP ? 'Kepala (sesi utama)' : e.nama, e.jumlah, r.input, r.cacheTulis, r.cacheBaca, r.output, r.panggilan, r.total, r.setara,
      R.adaModelAgen ? lapModelNama(lapModelUtama(e)) : ''].map(lapCsvSel).join(','));
  }
  const d = new Date(), dua = x => String(x).padStart(2, '0');
  const nama = 'laporan-token-' + R.hari + 'hari-' + (LAP.akun === 'semua' ? 'semua-akun' : LAP.akun.replace(/^\./, '')) + '-' + d.getFullYear() + dua(d.getMonth() + 1) + dua(d.getDate()) + '-' + dua(d.getHours()) + dua(d.getMinutes()) + '.csv';
  const url = URL.createObjectURL(new Blob(['﻿' + baris.join('\r\n') + '\r\n'], {type:'text/csv;charset=utf-8'}));
  const a = document.createElement('a'); a.href = url; a.download = nama; lapDlg.append(a); a.click(); a.remove();   // di dalam dialog: elemen di luar dialog modal tidak aktif
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  lapPesan('CSV diunduh: ' + nama + ' (' + (baris.length - 1) + ' baris).');
}
/* ---- panel tab Laporan (ringkas) ---- */
function lapPanelRender(){
  const d = TK.data, r1 = $('#lpR1'), r2 = $('#lpR2'), r3 = $('#lpR3'), k = $('#lpRingK');
  if (!d){ r1.textContent = r2.textContent = r3.textContent = '–'; $('#lpR1T').textContent = 'Total setara'; k.textContent = tkSt.textContent || (serverBase() === null || params.has('demo') ? 'Butuh server: jalankan node server.js' : 'Ringkasan muncul setelah data token dimuat dari server.'); return; }
  const hari = Number(d.hari) || Number(tkHari());
  let tot = 0, kep = 0, dv = 0;
  for (const p of d.proyek){ if (!p || typeof p !== 'object') continue; tot += tkNum(tkR(p.total).setara);
    for (const s of Array.isArray(p.sesi) ? p.sesi : []){ if (!s || typeof s !== 'object') continue; kep += tkNum(tkR(s.utama).setara); for (const x of Array.isArray(s.divisi) ? s.divisi : []) if (x && typeof x === 'object') dv += tkNum(tkR(x.total).setara); } }
  $('#lpR1T').textContent = 'Setara ' + hari + ' hari';
  r1.textContent = fmtTok(tot);
  r2.replaceChildren(lpPersen(kep, kep + dv) + ' · ' + lpPersen(dv, kep + dv), tkEl('small', null, 'Kepala · divisi'));
  const b = d.blok5jam && typeof d.blok5jam === 'object' ? d.blok5jam : null;
  const q5 = b ? tkPerkiraan5(b) : null, q7 = b ? tkPerkiraan7(b.limitResmi) : null;
  r3.replaceChildren((q5 && q5.pct !== null ? lpPctTeks(q5) : '–') + ' · ' + lpPctTeks(q7), tkEl('small', null, '5 jam · 7 hari'));
  const ak = typeof d.akun === 'string' ? d.akun : '', ai = Array.isArray(d.akunDaftar) ? d.akunDaftar.find(x => x && x.id === ak) : null;
  k.textContent = 'Akun ' + (ai ? tkAkunLabel(ai) : ak || '–') + ' · rentang tab Token · diperbarui ' + tkJam(TK.waktu || Date.now());
}
function lapPanelBuka(){
  alurLiveRender(); lapPanelRender();
  if ((!TK.data || Date.now() - TK.waktu > 60000) && !TK.sibuk) tokenMuat();
}
/* ---- dialog: buka/tutup, sub-tab, cetak ---- */
const LP_TABS = [lpTabAlur, lpTabTok];
function lapSub(tb, fokus){
  for (const x of LP_TABS){ const on = x === tb; x.setAttribute('aria-selected', on ? 'true' : 'false'); x.tabIndex = on ? 0 : -1; $('#' + x.getAttribute('aria-controls')).hidden = !on; }
  if (fokus) tb.focus();
  if (tb === lpTabAlur) requestAnimationFrame(() => { alurTempatInfo(); alurGambar(); });
  else { lapAkunRender(); lapMuatBila(); }
}
LP_TABS.forEach((tb, i) => {
  tb.addEventListener('click', () => lapSub(tb));
  tb.addEventListener('keydown', e => {
    const j = {ArrowRight:(i + 1) % LP_TABS.length, ArrowLeft:(i - 1 + LP_TABS.length) % LP_TABS.length, Home:0, End:LP_TABS.length - 1}[e.key];
    if (j != null){ e.preventDefault(); lapSub(LP_TABS[j], true); }
  });
});
function bukaLaporan(sub, asal){
  LAP.asal = asal || document.activeElement;
  // rentang bawaan = rentang tab Token; akun yang dikenal dari data tab Token
  const h = tkHari(); for (const inp of document.querySelectorAll('#lpHari input')) inp.checked = inp.value === h;
  if (TK.data){ const dd = lapSahDaftar(TK.data); if (dd.length) LAP.akunDaftar = dd; }
  alurBangun();
  if (!lapDlg.open) lapDlg.showModal();
  lapSub(sub === 'token' ? lpTabTok : lpTabAlur, true);
}
lapDlg.addEventListener('close', () => { if (lapDlg.open) return;   // dibuka lagi (mis. ganti modal ↔ non-modal saat cetak): fokus tetap di dialog
  LAP.cetak = false; LAP.fokusCetak = null;   // tutup sungguhan: status cetak dibuang supaya afterprint berikutnya tidak membuka dialog lagi
  const a = LAP.asal; LAP.asal = null; if (a && document.contains(a)) a.focus(); });
// ✕, "← Kembali ke kantor", dan Esc (juga saat dialog tertinggal non-modal karena afterprint tidak datang) menutup lewat satu pintu
function lapTutup(){ LAP.cetak = false; LAP.fokusCetak = null; if (lapDlg.open) lapDlg.close(); }
$('#bLpX').addEventListener('click', lapTutup);
$('#bLpKembali').addEventListener('click', lapTutup);
$('#bLapAlur').addEventListener('click', e => bukaLaporan('alur', e.currentTarget));
$('#bLapTok').addEventListener('click', e => bukaLaporan('token', e.currentTarget));
function lapIsiCetak(){
  const d = new Date(), tgl = d.toLocaleDateString('id-ID', {day:'numeric', month:'long', year:'numeric'}) + ' ' + tkJam(d);
  const isi = (el, judul, ket) => { el.replaceChildren(tkEl('b', null, 'PADEV STUDIO CLAUDE — ' + judul), ket + ' · dicetak ' + tgl); };
  const j = ALUR_JALUR.find(x => x.id === LAP.jalur) || ALUR_JALUR[0];
  isi($('#lpCetakA'), 'Alur kerja agen', 'Jalur: ' + j.nama + ' — ' + j.teks);
  const R = LAP.olah;
  isi($('#lpCetakT'), 'Laporan pemakaian token', R ? 'Rentang ' + R.hari + ' hari · ' + (R.akun.length > 1 ? 'semua akun (' + R.akun.map(a => a.label).join(', ') + ')' : 'akun ' + (R.akun[0] ? R.akun[0].label : '–')) + ' · data ' + tkJam(LAP.waktu || Date.now()) : 'Belum ada data');
}
const lapCetak = () => window.print();
// cetak (tombol atau Ctrl+P): dialog modal ada di "top layer" (posisi tetap, satu halaman) → sementara dibuka non-modal supaya isinya mengalir ke banyak halaman
window.addEventListener('beforeprint', () => {
  if (!lapDlg.open) return;
  lapIsiCetak();
  if (lapDlg.matches(':modal')){ LAP.cetak = true; LAP.fokusCetak = document.activeElement; lapDlg.close(); lapDlg.show(); }
});
window.addEventListener('afterprint', () => {
  if (!LAP.cetak) return;
  LAP.cetak = false; if (!lapDlg.open) return;   // ditutup selama cetak: jangan dibuka lagi
  lapDlg.close(); lapDlg.showModal();
  const f = LAP.fokusCetak; LAP.fokusCetak = null; if (f && lapDlg.contains(f)) f.focus();
});
$('#bLpCetak').addEventListener('click', lapCetak);
$('#bLpCetak2').addEventListener('click', lapCetak);
$('#bLpCsv').addEventListener('click', lapCsv);
bLpMuat.addEventListener('click', () => { if (!LAP.sibuk) lapMuat(); });
$('#lpHari').addEventListener('change', () => lapMuat());
lpAkun.addEventListener('change', e => { const v = e.target && e.target.value; if (v !== 'semua' && !TK_AKUN_RE.test(String(v || ''))) return; LAP.akun = v; LAP.hasil = null; LAP.olah = null; lpLap.replaceChildren(); lapMuat(); });
// jebak fokus di dialog (cadangan selain perilaku modal bawaan): hanya elemen yang bisa dicapai Tab
function lapJebak(e){
  const f = [...lapDlg.querySelectorAll('button, a[href], input, select, textarea, [tabindex]')].filter(x => x.tabIndex >= 0 && !x.disabled && x.getClientRects().length && !x.closest('[hidden]'));
  if (!f.length) return;
  const a = f[0], z = f[f.length - 1];
  if (e.shiftKey && document.activeElement === a){ e.preventDefault(); z.focus(); }
  else if (!e.shiftKey && document.activeElement === z){ e.preventDefault(); a.focus(); }
}
// "Perkiraan makin kasar — catat % terbaru" → buka kotak catat
$('#bTkLama').addEventListener('click', () => { const c = $('#tkCat'); c.open = true; tkC5.focus(); c.scrollIntoView({block:'nearest', behavior:RM ? 'auto' : 'smooth'}); });
/* ---- muat ulang otomatis tiap 60 detik selama tab Token / dialog laporan terbuka dan halaman terlihat (§2d) ---- */
function lapOtomatis(){
  if (document.visibilityState !== 'visible' || state.demo) return;
  if (!$('#pTok').hidden && !TK.sibuk && Date.now() - TK.waktu >= 55000) tokenMuat();
  if (lapDlg.open && !lpTok.hidden && !LAP.sibuk && Date.now() - LAP.waktu >= 55000) lapMuat();
}
setInterval(lapOtomatis, 60000);
document.addEventListener('visibilitychange', lapOtomatis);

/* ================= tab Keterangan (dibangun dari data konfigurasi) ================= */
const ST_ARTI = {
  bekerja:'Mengetik di mejanya; layar monitornya menyala sesuai jenis kerja.',
  dipanggil:'Dipanggil Kepala ke Ruang Pimpinan (lantai 2, lewat tangga) untuk menerima brief tugas baru.',
  jalan:'Sedang berjalan: ke meja, ke kursi rapat untuk ngobrol, atau datang/pulang lewat pintu lobi.',
  melapor:'Tugas selesai; berdiri di depan meja Kepala (lantai 2) dan melapor, lalu kembali ke kursinya.',
  menunggu:'Butuh izin Anda di Claude Code (lingkaran kuning berkedip di kakinya).',
  kendala:'Alat yang dipakai gagal (lingkaran merah di kakinya, ±7 detik).',
  santai:'Tidak bertugas: santai di kursinya atau ngobrol di ruang rapat.',
  npc:'Resepsionis kantor (skill resepsionis, dijalankan Kepala; bukan sub agent).',
};
// contoh nama alat Claude Code → dikelompokkan per warna layar lewat toolInfo()
const CONTOH_ALAT = ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob', 'WebSearch', 'WebFetch', 'Agent', 'TodoWrite', 'Skill', 'mcp__alat', ''];
const ARTI_GERAKAN = () => [
  {ikon:'💻', judul:'Mengetik, layar monitor menyala', arti:'Sedang bekerja. Warna layar = jenis kerja (lihat di atas). Di meja berdiri, mengetik sambil berdiri.'},
  {ikon:'📥', judul:'Naik tangga ke Ruang Pimpinan lalu “Siap, Bos!”', arti:'Dipanggil Kepala untuk menerima brief (bila ada tempat kosong di depan mejanya), lalu kembali ke mejanya.'},
  {ikon:'📄', judul:'Berdiri bicara di depan meja Kepala', arti:'Tugas selesai dan sedang melapor; Kepala berterima kasih, ±4 detik kemudian ia kembali ke kursinya.'},
  {ikon:'🗣️', judul:'Kepala menggerakkan tangan (bicara)', arti:'Kepala sedang menugaskan divisi atau menanggapi laporan.'},
  {ikon:'📨', judul:'Balon di Resepsionis', arti:'Anda baru mengirim tugas (prompt) di Claude Code.'},
  {ikon:'🤝', judul:'Bubble “Paralel dengan …”', arti:'Divisi yang tidak mengubah kode (' + PARALEL_TANPA_KODE.map(k => DIVISI[k] ? DIVISI[k].nama : k).join(', ') + ') bekerja bersamaan.'},
  {cincin:WARNA_CINCIN.menunggu, judul:'Tangan terangkat + lingkaran kuning berkedip', arti:'Butuh izin Anda di Claude Code.'},
  {cincin:WARNA_CINCIN.kendala, judul:'Lingkaran merah', arti:'Ada kendala: alat gagal dijalankan.'},
  {cincin:WARNA_CINCIN.pilih, judul:'Lingkaran biru', arti:'Orang yang sedang Anda pilih (kartu detail terbuka).'},
  {ikon:'🚬', judul:'Berdiri di luar gedung dengan asap tipis', arti:'Sedang merokok (hanya di taman, halaman depan, atau tepi Teras Lt 2). Asap tidak tampil pada kualitas Hemat atau saat Kurangi gerakan aktif.'},
  {ikon:'☕', judul:'Memegang gelas kopi', arti:'Baru ngopi dari pantry lantai 1; gelasnya dibawa kembali ke meja.'},
  {ikon:'🌤️', judul:'Bekerja di meja Teras Lt 2 (rooftop)', arti:'Sesekali anggota memilih bekerja di meja teras; laptopnya menyala seperti monitor di meja biasa.'},
  {ikon:'🚶', judul:'Masuk lewat pintu lobi', arti:'Anggota sementara (tugas lebih banyak dari 3 anggota tetap) datang lewat pintu lobi, lalu pulang lewat pintu yang sama setelah melapor.'},
  {ikon:'🏢', judul:'Tombol Lantai 1 / Lantai 2 / Terpisah', arti:'Memilih lantai yang dilihat. Label orang & ruang di lantai yang tersembunyi ikut disembunyikan.'},
  {ikon:'⚡', judul:'Angka ⚡ di label ruang', arti:'Jumlah anggota yang sedang bertugas di ruang itu; ikon kecil = divisi yang berkantor di ruang itu.'},
  {ikon:'✓', judul:'Tanda ✓ di strip Alur kerja', arti:'Tahap yang baru selesai (sampai sesi Claude Code berikutnya).'},
  {ikon:'🪧', judul:'Papan LED di halaman depan', arti:'Status live: jumlah divisi yang bekerja, tugas terakhir Kepala, dan divisi yang aktif. Berubah kuning “Butuh izin Anda” saat Claude Code menunggu izin.'},
  {ikon:'🚩', judul:'Bendera divisi berkibar, lampu tiang menyala', arti:'Divisi itu sedang bekerja (Lingkungan luar: Lengkap/Sederhana). Saat Kurangi gerakan aktif, bendera diam tetapi lampunya tetap menyala.'},
  {ikon:'🧰', judul:'Chip skill menyala hijau', arti:'Skill itu sedang dipakai divisinya (±2 menit terakhir); garis hijau = skill yang terakhir dipakai.'},
];
const KEG_SANTAI = {
  meja:['🪑', 'Santai di kursinya', 'mendengarkan, main HP, minum, bersandar, atau menelepon (meja berdiri: bertolak pinggang); karakter desain sering kembali ke gaya bawaannya'],
  ngobrol:['💬', 'Ngobrol berdua', 'di kursi kosong Ruang Rapat 1/2 (lantai 1), bergantian bicara, lalu kembali ke kursinya'],
  ngopi:['☕', 'Ngopi', 'ke pantry lantai 1, membuat dan minum kopi, lalu kembali ke meja membawa gelasnya (maks. 2 orang sekaligus)'],
  rokok:['🚬', 'Merokok', 'hanya di luar gedung: taman timur, halaman depan lobi, atau tepi Teras Lt 2 (rooftop); sekitar sepertiga anggota perokok, maks. 2 orang sekaligus'],
};
function pemakaiRuang(r){
  const div = new Set(), ang = [];
  for (const t of state.teamList) for (const m of t.members) if (ruangKursi(m.desk) === r){ div.add(t); ang.push(m); }
  const khusus = {pimpinan:'Claude utama (Kepala). Anggota menerima brief & melapor di depan mejanya', lobi:'Resepsionis (skill resepsionis) dan pintu masuk kantor'}[r.id];
  if (div.size) return {teks:[...div].map(t => (t.support ? t.label + ' (Tim Pendukung)' : t.label)).join(', ') + ' · ' + ang.length + ' meja' + (khusus ? ' · ' + khusus : ''), ikon:r.ikon};
  return {teks:khusus || 'Ruang umum desain (figuran & dekorasi)', ikon:r.ikon};
}
const kbdHtml = k => k === '–' ? '–' : `<kbd>${esc(k)}</kbd>`;
function caraGerakHtml(nama){
  const kb = nama === 'Keyboard';
  return `<div class="kgrp"><div class="flow-t">${esc(nama)}</div>` + CARA_GERAK[nama].map(([keys, txt]) =>
    `<div class="kr w"><span class="kv">${kb ? keys.map(kbdHtml).join('') : keys.map(k => `<b>${esc(k)}</b>`).join(' / ')}</span><span>${esc(txt)}</span></div>`).join('') + '</div>';
}
function bangunKeterangan(){
  const kel = {};
  for (const t of CONTOH_ALAT){ const T = toolInfo(t); (kel[T.cat] || (kel[T.cat] = new Set())).add(T.cat === 'mcp' ? 'Memakai alat MCP (mis. browser)' : T.label); }
  // tiap bagian = dropdown; bawaan hanya "Status orang" terbuka, pilihan pemakai diingat (UI.ket)
  const sec = (k, ikon, judul, isi, buka = false) => `<details class="ket" data-k="${k}" data-def="${buka ? 1 : 0}"${uiBuka('ket', k, buka) ? ' open' : ''}>` +
    `<summary><span class="ic" aria-hidden="true">${ikon}</span><span>${esc(judul)}</span></summary>${isi}</details>`;
  const status = Object.keys(ST_TXT).map(k => `<div class="kr w"><span><span class="st ${k}">${esc(ST_TXT[k])}</span></span><span>${esc(ST_ARTI[k] || '')}</span></div>`).join('');
  const layar = '<p class="kp">Layar monitor meja menyala dengan warna ini saat pemiliknya bekerja; saat santai kembali seperti desain, dan meredup saat pemiliknya meninggalkan meja.</p>' +
    Object.keys(SCREEN).map(c => `<div class="kr"><span class="swc" style="--c:${SCREEN[c]}"></span><span class="kt">${esc([...(kel[c] || [c])].join(' · '))}</span></div>`).join('');
  const gerak = ARTI_GERAKAN().map(g => `<div class="kr"><span class="ki" aria-hidden="true">${g.cincin ? `<span class="swc ring" style="--c:${g.cincin}"></span>` : g.warna ? `<span class="swc" style="--c:${g.warna}"></span>` : g.ikon}</span><span class="kt">${esc(g.judul)}</span><span class="ks">${esc(g.arti)}</span></div>`).join('');
  const ruang = '<p class="kp">Klik untuk terbang ke ruangnya (lantai ikut berganti bila perlu).</p>' + [1, 2].map(n => `<div class="kgrp"><div class="flow-t">Lantai ${n}</div>` +
    RUANG.filter(r => r.lantai === n && (r.label || pemakaiRuang(r).teks.includes('meja'))).map(r => {
      const p = pemakaiRuang(r);
      return `<button type="button" class="kr" data-ruang="${r.id}"><span class="ki" aria-hidden="true">${p.ikon}</span><span class="kt">${esc(r.nama)}</span><span class="ks">${esc(p.teks)}</span></button>`;
    }).join('') + '</div>').join('');
  const frek = w => w >= 2 ? 'sering' : w >= 1 ? 'kadang' : 'jarang';
  const santai = '<p class="kp">Anggota yang tidak bertugas berganti gaya santai tiap 10–25 detik. Ngopi dilakukan di pantry, merokok hanya di luar gedung. Dipanggil Kepala atau mulai kerja langsung menghentikan kegiatan santai. Anggota juga sesekali bekerja di meja Teras Lt 2 (rooftop). Saat Kurangi gerakan aktif, santai lebih jarang dan tidak ada ngobrol.</p>' +
    IDLE_ACTS.map(([n, w]) => { const k = KEG_SANTAI[n]; if (!k) return ''; return `<div class="kr"><span class="ki" aria-hidden="true">${k[0]}</span><span class="kt">${esc(k[1])} <span class="ks">· ${frek(w)}</span></span><span class="ks">${esc(k[2])}</span></div>`; }).join('');
  const sudut = '<p class="kp">Pilih lewat tombol 🎥 Sudut kamera di bawah layar, tombol angka, atau klik di sini.</p>' +
    [...SUDUT, ...SUDUT_ORANG].map(s => `<button type="button" class="kr w kk" data-sudut="${s.id}"><span class="kv">${s.tombol.map(kbdHtml).join('')}</span><span><span class="kt">${s.ikon} ${esc(s.nama)}</span><br><span class="ks">${esc(s.ket)}</span></span></button>`).join('');
  const cara = Object.keys(CARA_GERAK).map(caraGerakHtml).join('');
  const skill = '<p class="kp">Skill & alat tiap divisi dibaca dari file agent Claude Code Anda (folder agents). Klik untuk membuka kartu divisinya di tab Tim.</p><div id="ketSkill"></div>';
  $('#pKet').innerHTML = sec('status', '🟢', 'Status orang', status, true) + sec('layar', '🖥️', 'Warna layar monitor', layar) + sec('gerak', '🎬', 'Arti gerakan & ikon', gerak) +
    sec('ruang', '🏢', 'Ruang → divisi', ruang) + sec('skill', '🧰', 'Divisi & skill', skill) + sec('santai', '🛋️', 'Kegiatan santai', santai) +
    sec('sudut', '🎥', 'Sudut kamera', sudut) + sec('cara', '🖱️', 'Cara gerak', cara);
  $('#helpGerak').innerHTML = `<div>${caraGerakHtml('Mouse / trackpad')}${caraGerakHtml('Layar sentuh')}</div><div>${caraGerakHtml('Keyboard')}</div>`;
  isiKetSkill();
}
function isiKetSkill(){
  const el = document.getElementById('ketSkill'); if (!el) return;
  if (!BUILT){ el.innerHTML = '<p class="kp">Memuat data divisi…</p>'; return; }
  el.innerHTML = state.teamList.filter(t => !t.support).map(t => {
    const I = infoAgenTim(t), w = I ? I.skills : [], o = I ? (I.skillsOpsional || []).length : 0, al = I ? I.tools.length : 0;
    return `<button type="button" class="kr" data-tim="${esc(t.key)}"><span class="ki" aria-hidden="true">${t.icon}</span>` +
      `<span class="kt">${esc(t.label)}${I && I.model ? ` <span class="chip model">${esc(I.model)}</span>` : ''}</span>` +
      `<span class="ks">${I ? (w.length ? 'Wajib: ' + esc(w.join(', ')) : 'Tanpa skill wajib') + ` · ${o} opsional · ${al} alat` : 'Belum ada file agent'}</span></button>`;
  }).join('') +
  `<div class="kr"><span class="ki" aria-hidden="true">🤝</span><span class="kt">Tim Pendukung</span><span class="ks">Tipe non-divisi (${esc(Object.keys(AGEN_BAWAAN).slice(0, 3).join(', '))}, …) muncul di meja kosong saat dipakai (nama berpola IT di lantai 2 dulu); kartunya juga punya tombol 🧰.</span></div>`;
}
$('#pKet').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.tim) bukaInfoDivisi(state.teams.get(b.dataset.tim));
  else if (b.dataset.ruang) flyToRuang(RUANG_BY[b.dataset.ruang]);
  else if (b.dataset.sudut) pilihSudut(b.dataset.sudut);
});
ingatDetails($('#pKet'), 'ket');

/* ================= tab Pengaturan ================= */
const padNyala = () => SET.pad == null ? matchMedia('(pointer: coarse)').matches : SET.pad;
function bangunPengaturan(){
  const seg = (nm, lbl, opsi) => `<div class="seg" role="radiogroup" aria-label="${esc(lbl)}">` +
    opsi.map(([v, t]) => `<label><input type="radio" name="${nm}" value="${v}"><span>${esc(t)}</span></label>`).join('') + '</div>';
  const cek = (nm, t) => `<label class="row"><span>${esc(t)}</span><input type="checkbox" name="${nm}"></label>`;
  const rng = (nm, t, a, b, s) => `<div class="row"><label for="s_${nm}">${esc(t)}</label><input type="range" id="s_${nm}" name="${nm}" min="${a}" max="${b}" step="${s}"><output for="s_${nm}" id="o_${nm}"></output></div>`;
  // tiap kelompok = dropdown (details) berisi fieldset; ringkasan nilai sekarang tampil di judulnya (isiRingkasSet)
  const grp = (k, ikon, judul, isi, buka = false) => `<details class="ket" data-k="${k}" data-def="${buka ? 1 : 0}"${uiBuka('set', k, buka) ? ' open' : ''}>` +
    `<summary><span class="ic" aria-hidden="true">${ikon}</span><span>${esc(judul)}</span><span class="rk" id="rk_${k}"></span></summary>` +
    `<fieldset class="fs"><legend class="sr">${esc(judul)}</legend>${isi}</fieldset></details>`;
  $('#pSet').innerHTML =
    grp('kualitas', '✨', 'Kualitas grafis', `${seg('kualitas', 'Kualitas grafis', Object.entries(KUALITAS).map(([k, q]) => [k, q.nama]))}
      <p class="hintk" id="qInfo"></p>${cek('bayangan', 'Bayangan')}
      <div class="subl">Batas gambar per detik</div>
      ${seg('fps', 'Batas gambar per detik', [['30', '30 fps (hemat)'], ['60', '60 fps'], ['maks', 'Tanpa batas']])}
      ${cek('diam', 'Hemat saat diam (±10 fps)')}<p class="hintk" id="fpsInfo"></p>`, true) +
    grp('lingkungan', '🌳', 'Lingkungan luar', `${seg('lingkungan', 'Lingkungan luar', [['lengkap', 'Lengkap'], ['sederhana', 'Sederhana'], ['mati', 'Mati']])}
      <p class="hintk" id="envInfo"></p><div class="subl">Suasana</div>
      ${seg('suasana', 'Suasana', [['otomatis', '🕒 Otomatis (ikut jam)'], ['siang', '☀️ Siang'], ['sore', '🌇 Sore'], ['malam', '🌙 Malam']])}<p class="hintk" id="suasanaInfo"></p>`) +
    grp('label', '🏷️', 'Label & percakapan', `<div class="subl" id="lblNama">Label nama orang</div>
      ${seg('label', 'Label nama orang', [['semua', 'Semua'], ['aktif', 'Hanya yang aktif'], ['sembunyi', 'Sembunyikan']])}
      ${cek('bubble', 'Bubble percakapan')}${cek('labelRuang', 'Label ruang')}`) +
    grp('kamera', '🎥', 'Kamera', `${cek('putar', 'Putar otomatis pelan')}${rng('kecepatan', 'Kecepatan & sensitivitas', .5, 2, .1)}
      ${rng('fov', 'Sudut pandang (FOV)', 30, 75, 1)}${cek('pad', 'Tombol arah di layar')}`) +
    grp('gerak', '🐢', 'Kurangi gerakan', `${seg('gerak', 'Kurangi gerakan', [['sistem', 'Ikuti sistem'], ['nyala', 'Nyala'], ['mati', 'Mati']])}
      <p class="hintk" id="rmInfo"></p>`) +
    `<div class="set-akhir"><button class="btn sm" type="button" id="bBawaan">↺ Kembalikan bawaan</button><p class="hintk" id="setInfo" aria-live="polite"></p></div>`;
  ingatDetails($('#pSet'), 'set');
  $('#pSet').addEventListener('change', ubahSet);
  $('#pSet').addEventListener('input', e => { if (e.target.type === 'range') ubahSet(e); });
  $('#bBawaan').onclick = () => {
    Object.assign(SET, BAWAAN); simpanSet(); hitungRM();
    terapkanKualitas(); terapkanLabel(); terapkanKamera(); terapkanPad(); terapkanLingkungan(); isiFormSet();
    catatan('↺ Pengaturan dikembalikan ke bawaan');
  };
  isiFormSet();
  if (SET_GAGAL) $('#setInfo').textContent = 'Pengaturan tidak bisa dibaca/disimpan di browser ini; memakai nilai bawaan.';
}
function isiOutput(){
  const ok = $('#o_kecepatan'), of = $('#o_fov');
  if (ok) ok.textContent = SET.kecepatan.toFixed(1) + '×';
  if (of) of.textContent = SET.fov + '°';
  isiRingkasSet();
}
// ringkasan nilai di judul tiap dropdown Pengaturan (terlihat walau dropdown tertutup)
function isiRingkasSet(){
  const tulis = (k, s) => { const e = document.getElementById('rk_' + k); if (e && e.textContent !== s) e.textContent = s; };
  const q = KUALITAS[SET.kualitas];
  tulis('kualitas', (q ? q.nama : SET.kualitas) + (SET.bayangan ? '' : ' · tanpa bayangan') + ' · ' + (SET.fps === 'maks' ? 'fps bebas' : SET.fps + ' fps'));
  tulis('lingkungan', ({lengkap:'Lengkap', sederhana:'Sederhana', mati:'Mati'})[SET.lingkungan] + ' · ' + ({otomatis:'ikut jam', siang:'siang', sore:'sore', malam:'malam'})[SET.suasana]);
  tulis('label', ({semua:'Semua', aktif:'Yang aktif', sembunyi:'Disembunyikan'})[SET.label] + (SET.bubble ? '' : ' · tanpa bubble'));
  tulis('kamera', `${SET.fov}° · ${Number(SET.kecepatan).toFixed(1)}×` + (SET.putar ? ' · putar' : ''));
  tulis('gerak', ({sistem:'Ikuti sistem', nyala:'Nyala', mati:'Mati'})[SET.gerak] + (SET.gerak === 'sistem' ? (RM ? ' (dikurangi)' : ' (normal)') : ''));
}
function isiFormSet(){
  for (const inp of $('#pSet').querySelectorAll('input')){
    const v = SET[inp.name];
    if (inp.type === 'radio') inp.checked = inp.value === v;
    else if (inp.type === 'checkbox') inp.checked = inp.name === 'pad' ? padNyala() : !!v;
    else if (inp.type === 'range') inp.value = v;
  }
  isiOutput(); isiInfoSet(); isiInfoKualitas(); isiInfoLingkungan();
}
function ubahSet(e){
  const t = e.target, n = t.name;
  if (!n || !(n in BAWAAN)) return;
  if (t.type === 'radio'){ if (!t.checked) return; SET[n] = t.value; }
  else if (t.type === 'checkbox') SET[n] = t.checked;
  else if (t.type === 'range') SET[n] = +t.value;
  simpanSet();
  if (n === 'kualitas'){ terapkanKualitas(); terapkanLingkungan(); }
  else if (n === 'lingkungan' || n === 'suasana') terapkanLingkungan();
  else if (n === 'bayangan') terapkanBayangan();
  else if (n === 'fps' || n === 'diam') isiInfoKualitas();
  else if (n === 'label' || n === 'bubble' || n === 'labelRuang') terapkanLabel();
  else if (n === 'putar' || n === 'kecepatan' || n === 'fov') terapkanKamera();
  else if (n === 'pad') terapkanPad();
  else if (n === 'gerak'){ hitungRM(); isiInfoSet(); }
  isiOutput();
}
function isiInfoKualitas(){
  const el = document.getElementById('qInfo'); if (!el) return;
  const q = KUALITAS[SET.kualitas] || KUALITAS.hd, cv = renderer.domElement;
  el.textContent = `${q.nama}: ${q.ket}. Resolusi render ${prAktif.toFixed(2)}× (${cv.width}×${cv.height} px)` +
    (jauhPR && q.jauh ? ', dinaikkan karena kamera jauh' : '') + ` · bayangan ${SET.bayangan ? ukuranBayangan() + ' px' : 'mati'}` +
    (FPS ? ` · ±${Math.round(FPS)} fps` : '') + (turunPR ? ` · diturunkan ${turunPR.toFixed(1)}× otomatis karena FPS rendah` : '') + '.';
  const fi = document.getElementById('fpsInfo');
  if (fi) fi.textContent = (SET.fps === 'maks' ? 'Tanpa batas: digambar secepat layar (60–120×/detik), paling berat untuk suhu & baterai.' :
      `Digambar maks ${SET.fps}× per detik.`) +
    (SET.diam ? ` Bila tidak ada divisi bekerja dan kamera tidak disentuh, turun ke ±${FPS_DIAM} fps; kembali penuh saat ada kabar atau kamera digeser.` : '') +
    (fpsSasaran === FPS_DIAM ? ' Sekarang: mode diam.' : '') +
    ((SET.kualitas === 'hd' || SET.kualitas === 'ultra') !== GPU_KENCANG ? ' Muat ulang halaman supaya pilihan GPU ikut kualitas.' : '');
}
function isiInfoLingkungan(){
  const el = document.getElementById('envInfo'); if (!el) return;
  const lv = levelLingkungan();
  el.textContent = ({lengkap:'Lengkap: langit & kabut, jalan, parkir & mobil, lampu jalan, pepohonan, bukit & siluet kota, awan, burung, kupu-kupu, papan status, dan bendera divisi.',
    sederhana:'Sederhana: langit & kabut, jalan, pagar, beberapa pohon, papan status, dan bendera divisi (lebih ringan).',
    mati:'Mati: latar polos persis desain; papan status & bendera divisi ikut disembunyikan.'})[lv] +
    (SET.lingkungan === 'lengkap' && lv === 'sederhana' ? ' Kualitas Hemat otomatis memakai Sederhana.' : '') +
    ' Malam: lampu jalan, lampu taman, lampu kantor, dan jendela menyala.';
  const si = document.getElementById('suasanaInfo'); if (si) si.textContent = infoSuasana();
}
function isiInfoSet(){
  const el = document.getElementById('rmInfo'); if (!el) return;
  el.textContent = `Sistem Anda: ${RMQ.matches ? 'minta gerakan dikurangi' : 'gerakan normal'}. Sekarang: ${RM ? 'gerakan dikurangi (santai lebih jarang, transisi kamera langsung, tanpa kedip)' : 'gerakan normal'}.`;
  isiRingkasSet();
}
function terapkanLabel(){
  const L = labelRenderer.domElement.classList;
  L.toggle('lb-aktif', SET.label === 'aktif'); L.toggle('lb-sembunyi', SET.label === 'sembunyi');
  L.toggle('no-bub', !SET.bubble); L.toggle('no-ruang', !SET.labelRuang);
}
function terapkanPad(){
  const on = padNyala();
  $('#pad').hidden = !on; $('#bPad').setAttribute('aria-pressed', on ? 'true' : 'false'); stage.classList.toggle('pad-on', on);
  const c = $('#pSet').querySelector('input[name=pad]'); if (c) c.checked = on;
}
$('#bPad').onclick = () => { SET.pad = !padNyala(); simpanSet(); terapkanPad(); catatan(SET.pad ? '🕹️ Tombol arah ditampilkan' : '🕹️ Tombol arah disembunyikan'); };

/* ================= tab Pegawai: nama & penampilan tiap anggota =================
   Nama hanya label tampilan; peran (nama bawaan) dan nama agent Claude tetap tampil di label/panel/log.
   Semua teks dari owner/berkas impor dipasang lewat textContent / value (tidak pernah innerHTML). */
const pegEl = $('#pPeg');
const TAMBAH_SLOT = new Map();          // slot cadangan yang ditambah owner di sesi ini, per tim
let pegSig = '', pegUndo = null, pegSeq = 0, pegTimer = null;
const el = (tag, cls, teks) => { const e = document.createElement(tag); if (cls) e.className = cls; if (teks != null) e.textContent = teks; return e; };
function slotTim(tk, dasar){
  const t = infoTimKunci(tk), nyata = state.teams.get(tk); let max = dasar;
  if (nyata) for (const m of nyata.members) max = Math.max(max, m.nomor);
  for (const s of Object.keys(PEG.orang)){ const p = pecahSlot(s); if (p && p.tk === tk) max = Math.max(max, p.n); }
  max = Math.min(99, max + (TAMBAH_SLOT.get(tk) || 0));
  return Array.from({length:max}, (_, i) => ({slot:tk + '#' + (i + 1), kode:t.support && i === 0 ? t.short : t.short + ' ' + (i + 1), n:i + 1, tk, cadangan:i + 1 > dasar}));
}
function tipePendukung(){
  const tipe = new Set(['general-purpose', 'Explore', 'Plan']);
  for (const n of state.agentInfo.keys()) if (!isDivName(n)) tipe.add(n);
  for (const t of state.teamList) if (t.support) tipe.add(t.key);
  for (const s of Object.keys(PEG.orang)){ const p = pecahSlot(s); if (p && !p.tk.startsWith('div:')) tipe.add(p.tk); }
  return [...tipe];
}
function grupPegawai(){
  const G = [{id:'pimpinan', judul:'Kepala & Resepsionis', ikon:'👑', warna:'#c9a227', bagian:[{slot:[{slot:'kepala', kode:'Kepala', ket:'Claude utama'}, {slot:'resepsionis', kode:'Resepsionis', ket:'skill resepsionis'}]}]}];
  for (const [k, dv] of Object.entries(DIVISI)) G.push({id:'div:' + k, judul:'Divisi ' + dv.nama, ikon:dv.ikon, warna:dv.warna, agen:'divisi-' + k, bagian:[{tk:'div:' + k, slot:slotTim('div:' + k, ANGGOTA_PER_DIVISI)}]});
  for (const t of state.teamList) if (!t.support && !t.div) G.push({id:t.key, judul:t.label, ikon:t.icon, warna:t.color, agen:t.who, bagian:[{tk:t.key, slot:slotTim(t.key, ANGGOTA_PER_DIVISI)}]});
  G.push({id:'dukung', judul:'Tim Pendukung', ikon:'🤝', warna:TEMA.pendukung, bagian:tipePendukung().map(tp => ({judul:tp, tk:tp, slot:slotTim(tp, 1)}))});
  return G;
}
const aktorSlot = slot => { for (const a of ACTORS.values()) if (a.slot === slot) return a; return null; };
function lookSekarang(slot){ const e = PEG.orang[slot]; if (e && e.look) return e.look; const a = aktorSlot(slot); return a ? a.look : lookBawaan(slot); }
const warnaSlot = slot => slot === 'kepala' ? '#c9a227' : slot === 'resepsionis' ? '#3b6cf6' : (pecahSlot(slot) ? infoTimKunci(pecahSlot(slot).tk).color : '#3b6cf6');
function warnaiAvatar(av, lk){ if (!lk) return; av.style.setProperty('--k', lk.hijab || KULIT_HEX[lk.kulit] || KULIT_HEX[0]); av.style.setProperty('--c', lk.atasan.warna); }
function sigPegawai(){ return grupPegawai().map(g => g.id + ':' + g.bagian.map(b => (b.tk || '') + b.slot.length).join(',')).join('|'); }
function bangunPegawai(){
  const buka = new Set([...pegEl.querySelectorAll('details[open]')].map(d => d.dataset.g));
  if (!pegEl.dataset.siap){ buka.add('pimpinan'); buka.add('semua'); pegEl.dataset.siap = '1'; }
  const gulir = pegEl.scrollTop;
  pegEl.textContent = '';
  // --- alat untuk semua pegawai (dropdown; judulnya = legend fieldset) ---
  const dA = el('details', 'ket'); dA.dataset.g = 'semua'; dA.open = buka.has('semua');
  const smA = el('summary'), icA = el('span', 'ic', '👥'); icA.setAttribute('aria-hidden', 'true');
  smA.append(icA, el('span', null, 'Semua pegawai')); dA.append(smA);
  const fs = el('fieldset', 'fs'); fs.append(el('legend', 'sr', 'Semua pegawai')); dA.append(fs);
  fs.append(el('p', 'hintk', 'Beri nama tiap anggota; nama tampil di label 3D, panel Tim, log Aktivitas, kartu detail, dan bubble. Peran (mis. “QA 1”) dan nama agent Claude tetap terlihat, dan pemetaan kejadian ke anggota tidak berubah. Kolom kosong = nama bawaan (abu-abu, mis. Bima); nama yang Anda isi selalu dipakai.'));
  const tb = el('div', 'pg-tb'); tb.style.margin = '8px 0 4px';
  const tombol = (teks, aksi, label) => { const b = el('button', 'btn sm', teks); b.type = 'button'; b.dataset.aksi = aksi; if (label) b.setAttribute('aria-label', label); return b; };
  tb.append(tombol('🎲 Acak semua', 'acakSemua', 'Acak penampilan semua pegawai'), tombol('↺ Semua ke referensi', 'refSemua', 'Kembalikan penampilan semua pegawai ke referensi'),
    tombol('🧹 Hapus semua nama', 'hapusNama'));
  const cb = el('label', 'row'); const cbi = document.createElement('input'); cbi.type = 'checkbox'; cbi.id = 'pgAcakBaru'; cbi.checked = PEG.acakBaru;
  cb.append(el('span', null, 'Anggota baru otomatis diacak'), cbi);
  const tb2 = el('div', 'pg-tb'); tb2.style.margin = '4px 0 0';
  const fi = document.createElement('input'); fi.type = 'file'; fi.id = 'pgFile'; fi.accept = '.json,application/json'; fi.hidden = true;
  tb2.append(tombol('⬇️ Ekspor JSON', 'ekspor', 'Ekspor data pegawai ke berkas JSON'), tombol('⬆️ Impor JSON', 'impor', 'Impor data pegawai dari berkas JSON'), fi);
  const msg = el('p', 'pg-msg'); msg.id = 'pgMsg'; msg.setAttribute('aria-live', 'polite');
  fs.append(tb, cb, el('p', 'hintk', 'Bila aktif, anggota sementara yang belum diatur mendapat penampilan acak. Bila mati, penampilan bawaan: karakter desain, atau tampilan otomatis dari nama slot (ORANG.tampilanDari).'), tb2, msg);
  pegEl.append(dA);
  if (PEG_GAGAL) pegPesan('Data pegawai tidak bisa disimpan di browser ini; berlaku sampai halaman ditutup. Pakai Ekspor JSON untuk menyimpan.');
  // --- per grup ---
  for (const g of grupPegawai()){
    const d = el('details', 'pg-grp'); d.dataset.g = g.id; d.open = buka.has(g.id);
    const sm = el('summary'); sm.style.setProperty('--c', g.warna);
    const ic = el('span', 'ic', g.ikon); ic.setAttribute('aria-hidden', 'true');
    const semua = g.bagian.flatMap(b => b.slot), bernama = semua.filter(s => namaSlot(s.slot)).length;
    sm.append(ic, el('span', null, g.judul), el('span', 'n', semua.length + ' pegawai' + (bernama ? ' · ' + bernama + ' bernama' : '')));
    d.append(sm);
    const t2 = el('div', 'pg-tb');
    t2.append(tombol('🎲 Acak ' + (g.id === 'pimpinan' ? 'keduanya' : 'grup ini'), 'acakGrup', 'Acak penampilan ' + g.judul), tombol('↺ Referensi', 'refGrup', 'Kembalikan penampilan ' + g.judul + ' ke referensi'));
    for (const b of t2.children) b.dataset.g = g.id;
    d.append(t2);
    for (const b of g.bagian){
      if (b.judul) d.append(el('div', 'pg-sub', b.judul));
      for (const s of b.slot) d.append(barisPegawai(s));
      if (b.tk){ const a = el('button', 'pg-add', '+ Slot cadangan'); a.type = 'button'; a.dataset.aksi = 'tambah'; a.dataset.tk = b.tk;
        a.setAttribute('aria-label', 'Tambah slot cadangan untuk ' + (b.judul || g.judul) + ' (nama untuk anggota sementara berikutnya)'); d.append(a); }
    }
    pegEl.append(d);
  }
  pegSig = sigPegawai(); pegEl.scrollTop = gulir;
}
function barisPegawai(s){
  const row = el('div', 'pg-row'); row.dataset.slot = s.slot;
  const av = el('span', 'pg-av'); av.setAttribute('aria-hidden', 'true'); warnaiAvatar(av, lookSekarang(s.slot));
  const id = 'pgn' + (++pegSeq);
  const lb = el('label', 'pg-kd', s.kode); lb.htmlFor = id;
  const ket = s.ket || (s.cadangan ? 'cadangan' : aktorSlot(s.slot) ? '' : 'belum hadir');
  if (ket) lb.append(el('small', null, ket));
  const inp = document.createElement('input'); inp.type = 'text'; inp.id = id; inp.className = 'pg-in'; inp.maxLength = MAKS_NAMA;
  inp.placeholder = milik(NAMA_BAWAAN, s.slot) ? milik(NAMA_BAWAAN, s.slot) + ' (bawaan)' : 'Nama…'; inp.value = namaTersimpan(s.slot); inp.dataset.slot = s.slot; inp.autocomplete = 'off'; inp.spellcheck = false;
  const bU = el('button', 'pg-b', '👕'); bU.type = 'button'; bU.dataset.aksi = 'ubah'; bU.dataset.slot = s.slot; bU.title = 'Ubah penampilan'; bU.setAttribute('aria-label', 'Ubah penampilan ' + s.kode);
  const bA = el('button', 'pg-b', '🎲'); bA.type = 'button'; bA.dataset.aksi = 'acak'; bA.dataset.slot = s.slot; bA.title = 'Acak penampilan'; bA.setAttribute('aria-label', 'Acak penampilan ' + s.kode);
  row.append(av, lb, inp, bU, bA);
  return row;
}
function cekDaftarPegawai(){ if (pegEl.contains(document.activeElement)) return; if (sigPegawai() !== pegSig) bangunPegawai(); }
function perbaruiAvatar(slot){
  for (const r of pegEl.querySelectorAll('.pg-row')) if (r.dataset.slot === slot) warnaiAvatar(r.querySelector('.pg-av'), lookSekarang(slot));
}
function pegPesan(teks, bisaUrung){
  const m = document.getElementById('pgMsg'); if (!m) return;
  m.textContent = teks;
  if (bisaUrung && pegUndo){ const b = el('button', 'btn sm', '↶ Urungkan'); b.type = 'button'; b.dataset.aksi = 'urung'; m.append(b); }
}
function simpanEntri(slot, e){
  if (e.nama || e.look){
    if (!PEG.orang[slot] && Object.keys(PEG.orang).length >= MAKS_SLOT){ pegPesan('Batas ' + MAKS_SLOT + ' pegawai tersimpan tercapai.'); return false; }
    PEG.orang[slot] = e;
  } else delete PEG.orang[slot];
  simpanPeg();
  if (PEG_GAGAL) pegPesan('Tidak bisa menyimpan di browser ini; perubahan berlaku sampai halaman ditutup. Pakai Ekspor JSON untuk menyimpan.');
  return true;
}
// terapkan ke figur yang sedang ada (nama; penampilan bila gantiLook)
function terapkanSlot(slot, gantiLook){
  for (const a of ACTORS.values()) if (a.slot === slot){
    a.terapkanNama();
    if (gantiLook){ const e = PEG.orang[slot]; a.acak = false; a.dandani((e && e.look) || lookBawaan(slot)); }
  }
  if (gantiLook) perbaruiAvatar(slot);
  detSig = ''; renderList(true);
}
function terapkanSemua(){
  for (const a of ACTORS.values()){
    const e = PEG.orang[a.slot], lk = (e && e.look) || (a.acak ? a.look : lookBawaan(a.slot));
    a.terapkanNama(); if (JSON.stringify(lk) !== JSON.stringify(a.look)) a.dandani(lk);
  }
  detSig = ''; renderList(true);
}
function setNama(slot, v){
  const nm = bersihNama(v), e = {...(PEG.orang[slot] || {})};
  if (nm) e.nama = nm; else delete e.nama;
  if (simpanEntri(slot, e)) terapkanSlot(slot, false);
  return nm;
}
function setLook(slot, lk){ const e = {...(PEG.orang[slot] || {})}; if (lk) e.look = lk; else delete e.look; if (simpanEntri(slot, e)) terapkanSlot(slot, true); }
const snapshotPeg = () => JSON.stringify({versi:VERSI_PEG, acakBaru:PEG.acakBaru, orang:PEG.orang});
function slotGrup(id){ const g = grupPegawai().find(x => x.id === id); return g ? g.bagian.flatMap(b => b.slot.map(s => s.slot)) : []; }
function semuaSlot(){ return grupPegawai().flatMap(g => g.bagian.flatMap(b => b.slot.map(s => s.slot))); }
function massal(slots, fn, pesan, keReferensi = false){
  pegUndo = snapshotPeg();
  for (const s of slots){ const e = {...(PEG.orang[s] || {})}; fn(s, e); if (e.nama || e.look) PEG.orang[s] = e; else delete PEG.orang[s]; }
  if (keReferensi) for (const a of ACTORS.values()) if (slots.includes(a.slot)) a.acak = false;
  simpanPeg(); terapkanSemua(); bangunPegawai(); pegPesan(pesan, true);
}
function ekspor(){
  const data = {aplikasi:'PADEV STUDIO CLAUDE', jenis:'pegawai', versi:VERSI_PEG, dibuat:new Date().toISOString(), acakBaru:PEG.acakBaru, orang:PEG.orang};
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], {type:'application/json'}));
  const a = document.createElement('a'); a.href = url; a.download = 'pegawai-kantor-padev.json'; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  pegPesan(`Diekspor: ${Object.keys(PEG.orang).length} pegawai ke pegawai-kantor-padev.json.`);
}
async function impor(file){
  if (!file) return;
  if (file.size > 256 * 1024){ pegPesan('Berkas terlalu besar (maks 256 KB).'); return; }
  let d = null;
  try { d = JSON.parse(await file.text()); } catch (e){ pegPesan('Berkas bukan JSON yang valid.'); return; }
  if (d && d.jenis != null && d.jenis !== 'pegawai'){ pegPesan('Berkas ini bukan data pegawai kantor.'); return; }
  const b = bersihPeg(d);
  if (!b){ pegPesan('Isi berkas tidak dikenali.'); return; }
  const masuk = Object.keys(b.orang).length, dibuang = d && d.orang && typeof d.orang === 'object' ? Math.max(0, Object.keys(d.orang).length - masuk) : 0;
  pegUndo = snapshotPeg();
  PEG.acakBaru = b.acakBaru; PEG.orang = b.orang; simpanPeg(); terapkanSemua(); bangunPegawai();
  pegPesan(`Diimpor: ${masuk} pegawai` + (dibuang ? ` (${dibuang} entri tidak valid diabaikan)` : '') + (b.lookLama ? ` · ${b.lookLama} penampilan berformat lama (sebelum desain v2) diabaikan, namanya tetap dipakai` : '') + '.', true);
}
pegEl.addEventListener('input', e => {
  const t = e.target; if (!t.classList.contains('pg-in')) return;
  clearTimeout(pegTimer); pegTimer = setTimeout(() => setNama(t.dataset.slot, t.value), 300);
});
pegEl.addEventListener('change', e => {
  const t = e.target;
  if (t.classList.contains('pg-in')){ clearTimeout(pegTimer); t.value = setNama(t.dataset.slot, t.value); const g = t.closest('details'); if (g) perbaruiRingkasGrup(g); }
  else if (t.id === 'pgAcakBaru'){ PEG.acakBaru = t.checked; simpanPeg(); pegPesan(t.checked ? 'Anggota baru akan mendapat penampilan acak.' : 'Anggota baru memakai penampilan referensi.'); }
  else if (t.id === 'pgFile'){ impor(t.files && t.files[0]); t.value = ''; }
});
function perbaruiRingkasGrup(d){ const n = d.querySelector('summary .n'); if (!n) return; const rows = d.querySelectorAll('.pg-row'); const b = [...rows].filter(r => namaSlot(r.dataset.slot)).length; n.textContent = rows.length + ' pegawai' + (b ? ' · ' + b + ' bernama' : ''); }
pegEl.addEventListener('click', e => {
  const b = e.target.closest('button[data-aksi]'); if (!b) return;
  const s = b.dataset.slot, g = b.dataset.g;
  switch (b.dataset.aksi){
    case 'ubah': bukaPenampilan(s, b); break;
    case 'acak': setLook(s, lookAcak(warnaSlot(s))); pegPesan('Penampilan ' + kodeSlot(s) + ' diacak.'); break;
    case 'acakGrup': massal(slotGrup(g), (x, en) => { en.look = lookAcak(warnaSlot(x)); }, 'Penampilan grup diacak.'); break;
    case 'refGrup': massal(slotGrup(g), (x, en) => { delete en.look; }, 'Penampilan grup dikembalikan ke referensi (desain).', true); break;
    case 'acakSemua': massal(semuaSlot(), (x, en) => { en.look = lookAcak(warnaSlot(x)); }, 'Penampilan semua pegawai diacak.'); break;
    case 'refSemua': massal([...new Set([...semuaSlot(), ...Object.keys(PEG.orang)])], (x, en) => { delete en.look; }, 'Penampilan semua pegawai dikembalikan ke referensi.', true); break;
    case 'hapusNama': massal(Object.keys(PEG.orang), (x, en) => { delete en.nama; }, 'Semua nama dihapus; label kembali ke nama bawaan (mis. Bima, Laras; peran tanpa nama bawaan memakai nomor seperti “Explore 1”).'); break;
    case 'tambah': {
      const tk = b.dataset.tk; TAMBAH_SLOT.set(tk, (TAMBAH_SLOT.get(tk) || 0) + 1); bangunPegawai();
      const rows = [...pegEl.querySelectorAll('.pg-row')].filter(r => pecahSlot(r.dataset.slot) && pecahSlot(r.dataset.slot).tk === tk);
      const last = rows[rows.length - 1]; if (last) last.querySelector('.pg-in').focus();
      break;
    }
    case 'ekspor': ekspor(); break;
    case 'impor': $('#pgFile').click(); break;
    case 'urung': if (pegUndo){ const d = bersihPeg(JSON.parse(pegUndo)); pegUndo = null; if (d){ PEG.acakBaru = d.acakBaru; PEG.orang = d.orang; simpanPeg(); terapkanSemua(); bangunPegawai(); pegPesan('Perubahan terakhir diurungkan.'); } } break;
  }
});

/* ---- dialog penampilan + pratinjau 3D (karakter desain v2: ORANG.buat) ---- */
const dlg = $('#pegDlg'), pgForm = $('#pgForm');
let dlgSlot = null, dlgAsal = null, dlgAwal = null, dlgTimer = null;
function formPenampilanHtml(){
  const opsi = o => Object.entries(o).map(([v, t]) => `<option value="${esc(v)}">${esc(t)}</option>`).join('');
  const dl = (k, a) => `<datalist id="dl_${k}">${a.map(c => `<option value="${c}">`).join('')}</datalist>`;
  const warna = (nama, lbl, d) => `<input class="pg-warna" type="color" name="${nama}" list="dl_${d}" aria-label="${esc(lbl)}">`;
  const pilih = (id, nama, lbl, o, w) => `<div class="pg-l"><label for="${id}">${esc(lbl)}</label><span class="ctl"><select id="${id}" name="${nama}">${opsi(o)}</select>${w || ''}</span></div>`;
  const cekW = (nama, lbl, w) => `<div class="pg-l"><label class="cek"><input type="checkbox" name="${nama}">${esc(lbl)}</label><span class="ctl">${w || ''}</span></div>`;
  const cek = (nama, lbl) => `<label><input type="checkbox" name="${nama}">${esc(lbl)}</label>`;
  return Object.entries(PALET).map(([k, a]) => dl(k, a)).join('') +
    `<fieldset class="pg-f"><legend id="pgLgNama">Nama tampilan</legend><input class="pg-nama" id="pgNama" name="nama" type="text" maxlength="${MAKS_NAMA}" aria-labelledby="pgLgNama" spellcheck="false">
      <p class="pg-note" id="pgNamaInfo"></p></fieldset>` +
    `<fieldset class="pg-f"><legend>Badan & kulit</legend><div class="seg" role="radiogroup" aria-label="Bentuk badan" style="margin:0 0 8px">
      <label><input type="radio" name="fem" value="0"><span>Pria</span></label><label><input type="radio" name="fem" value="1"><span>Wanita</span></label></div>
      <div class="pg-sw" id="pgKulit" role="radiogroup" aria-label="Warna kulit"></div></fieldset>` +
    `<fieldset class="pg-f"><legend>Rambut & hijab</legend>${pilih('pgRambut', 'gaya', 'Gaya rambut', GAYA.rambut, warna('warnaRambut', 'Warna rambut', 'rambut'))}
      ${cekW('hijab', 'Pakai hijab', warna('warnaHijab', 'Warna hijab', 'hijab'))}<p class="pg-note" id="pgHijabInfo"></p></fieldset>` +
    `<fieldset class="pg-f"><legend>Atasan</legend>${pilih('pgAtasan', 'atasan', 'Jenis atasan', GAYA.atasan, warna('warnaAtasan', 'Warna atasan', 'pakaian'))}
      ${cekW('dalamOn', 'Kemeja dalam (blazer/kardigan)', warna('warnaDalam', 'Warna kemeja dalam', 'pakaian'))}
      ${cekW('dasi', 'Dasi (blazer)', warna('warnaDasi', 'Warna dasi', 'pakaian'))}
      ${cekW('sablon', 'Sablon (kaos)', warna('warnaSablon', 'Warna sablon', 'pakaian'))}
      <div class="pg-c">${cek('gulung', 'Lengan digulung')}</div></fieldset>` +
    `<fieldset class="pg-f"><legend>Bawahan</legend>${pilih('pgBawahan', 'bawahan', 'Jenis bawahan', GAYA.bawahan, warna('warnaBawahan', 'Warna bawahan', 'bawahan'))}</fieldset>` +
    `<fieldset class="pg-f"><legend>Sepatu</legend>${pilih('pgSepatu', 'sepatu', 'Jenis sepatu', GAYA.sepatu, warna('warnaSepatu', 'Warna sepatu', 'sepatu'))}
      ${cekW('aksenOn', 'Aksen tumit (sneaker)', warna('warnaAksen', 'Warna aksen sepatu', 'aksen'))}
      ${cekW('solOn', 'Warna sol sendiri', warna('warnaSol', 'Warna sol', 'sepatu'))}</fieldset>` +
    `<fieldset class="pg-f"><legend>Aksesori</legend>${pilih('pgKacamata', 'kacamata', 'Kacamata', GAYA.kacamata)}
      ${pilih('pgHeadphone', 'headphone', 'Headphone', GAYA.headphone, warna('warnaHeadphone', 'Warna headphone', 'aksen'))}
      ${pilih('pgTopi', 'topi', 'Topi', GAYA.topi, warna('warnaTopi', 'Warna topi', 'pakaian'))}
      ${cekW('jam', 'Jam tangan', warna('warnaJam', 'Warna jam tangan', 'aksen'))}
      ${cekW('lanyard', 'Lanyard ID', warna('warnaLanyard', 'Warna lanyard', 'aksen'))}
      ${cekW('ransel', 'Ransel', warna('warnaRansel', 'Warna ransel', 'bawahan'))}
      ${pilih('pgPegang', 'pegang', 'Di tangan', GAYA.pegang)}
      <div class="pg-c">${cek('anting', 'Anting')}${cek('kumis', 'Kumis')}${cek('jenggot', 'Jenggot')}</div></fieldset>`;
}
function isiFormPenampilan(){
  const lk = lookSekarang(dlgSlot), f = pgForm.elements, a = lk.atasan, s = lk.sepatu, k = lk.aks || {};
  const sw = $('#pgKulit'); sw.textContent = '';
  KULIT_HEX.forEach((c, i) => {
    const l = el('label'); const r = document.createElement('input'); r.type = 'radio'; r.name = 'kulit'; r.value = String(i); r.checked = i === lk.kulit;
    const sp = el('span'); sp.style.setProperty('--c', c); l.append(r, sp, el('span', 'sr', 'Warna kulit ' + (i + 1))); sw.append(l);
  });
  f.nama.value = namaTersimpan(dlgSlot); f.nama.placeholder = 'Kosong = ' + (milik(NAMA_BAWAAN, dlgSlot) || kodeSlot(dlgSlot));
  for (const r of f.fem) r.checked = r.value === (lk.fem ? '1' : '0');
  const set = (n, v) => { f[n].value = v; }, cek = (n, v) => { f[n].checked = !!v; };
  set('gaya', lk.rambut ? lk.rambut.gaya : 'pendek'); set('warnaRambut', lk.rambut ? lk.rambut.warna : '#1d1916');
  cek('hijab', lk.hijab); set('warnaHijab', lk.hijab || PALET.hijab[0]);
  set('atasan', a.jenis); set('warnaAtasan', a.warna);
  cek('dalamOn', a.dalam); set('warnaDalam', a.dalam || '#ffffff');
  cek('dasi', a.dasi); set('warnaDasi', a.dasi || '#c0392b');
  cek('sablon', a.print); set('warnaSablon', a.print || '#ffffff'); cek('gulung', a.gulung);
  set('bawahan', lk.bawahan.jenis); set('warnaBawahan', lk.bawahan.warna);
  set('sepatu', s.jenis); set('warnaSepatu', s.warna);
  cek('aksenOn', s.aksen); set('warnaAksen', s.aksen || '#1d2433'); cek('solOn', s.sol); set('warnaSol', s.sol || '#f4f4f0');
  set('kacamata', k.kacamata || ''); set('headphone', k.headphone || ''); set('warnaHeadphone', k.warnaHeadphone || '#222222');
  set('topi', k.topi ? (k.topi.jenis === 'beanie' ? 'beanie' : k.topi.balik ? 'capBalik' : 'cap') : ''); set('warnaTopi', k.topi ? k.topi.warna : '#1d2433');
  cek('jam', k.jam); set('warnaJam', k.jam || '#222222'); cek('lanyard', k.lanyard); set('warnaLanyard', k.lanyard || '#4285f4');
  cek('ransel', k.ransel); set('warnaRansel', k.ransel || '#1d2433'); set('pegang', k.pegang || '');
  cek('anting', k.anting); cek('kumis', k.kumis); cek('jenggot', k.jenggot);
  aturKetergantungan(); isiJudulDialog();
}
function aturKetergantungan(){
  const f = pgForm.elements, hij = f.hijab.checked, at = f.atasan.value;
  f.gaya.disabled = f.warnaRambut.disabled = hij; f.warnaHijab.disabled = !hij; f.topi.disabled = hij; f.anting.disabled = hij;
  f.dalamOn.disabled = !(at === 'blazer' || at === 'kardigan'); f.warnaDalam.disabled = f.dalamOn.disabled || !f.dalamOn.checked;
  f.dasi.disabled = at !== 'blazer'; f.warnaDasi.disabled = f.dasi.disabled || !f.dasi.checked;
  f.sablon.disabled = at !== 'kaos'; f.warnaSablon.disabled = f.sablon.disabled || !f.sablon.checked;
  f.gulung.disabled = !LENGAN_PANJANG.includes(at);
  f.aksenOn.disabled = f.sepatu.value !== 'sneaker'; f.warnaAksen.disabled = f.aksenOn.disabled || !f.aksenOn.checked;
  f.warnaSol.disabled = !f.solOn.checked;
  f.warnaHeadphone.disabled = !f.headphone.value; f.warnaTopi.disabled = hij || !f.topi.value;
  f.warnaJam.disabled = !f.jam.checked; f.warnaLanyard.disabled = !f.lanyard.checked; f.warnaRansel.disabled = !f.ransel.checked;
  $('#pgHijabInfo').textContent = hij ? 'Dengan hijab, rambut, topi, dan anting tidak ditampilkan.' : '';
}
function isiJudulDialog(){
  const nm = namaSlot(dlgSlot), kd = kodeSlot(dlgSlot), p = pecahSlot(dlgSlot), t = p ? infoTimKunci(p.tk) : null;
  $('#pgTitle').textContent = 'Penampilan · ' + (nm ? nm + ' (' + kd + ')' : kd);
  $('#pgSub').textContent = dlgSlot === 'kepala' ? 'Claude utama (Kepala)' : dlgSlot === 'resepsionis' ? 'Resepsionis kantor · skill resepsionis (dijalankan Kepala)' :
    (t ? (t.support ? 'Tim Pendukung · agent ' + t.who : 'Divisi ' + t.short + ' · agent ' + t.who) : '') + (aktorSlot(dlgSlot) ? '' : ' · belum hadir di kantor');
  $('#pgNamaInfo').textContent = 'Maks ' + MAKS_NAMA + ' karakter. Label tetap menampilkan peran: “' + (nm || 'Nama') + ' · ' + kd.replace(/ \d+$/, '') + '” (tanpa nomor anggota).';
  const a = $('#pgCanvas'); a.setAttribute('aria-label', 'Pratinjau 3D ' + (nm || kd) + '. Tombol panah kiri/kanan untuk memutar.');
}
// baca form → penampilan v2 (bagian yang tidak ada di form, mis. warna tali sepatu, dipertahankan dari penampilan sekarang)
function bacaForm(){
  const f = pgForm.elements, v = n => f[n].value, c = n => f[n].checked && !f[n].disabled;
  const lk = salinLook(lookSekarang(dlgSlot));
  const kulit = [...f.kulit].find(r => r.checked);
  lk.fem = [...f.fem].some(r => r.checked && r.value === '1'); lk.kulit = kulit ? +kulit.value : lk.kulit;
  if (f.hijab.checked){ lk.hijab = v('warnaHijab'); delete lk.rambut; }
  else { delete lk.hijab; lk.rambut = {gaya:v('gaya'), warna:v('warnaRambut')}; }
  const a = lk.atasan = {jenis:v('atasan'), warna:v('warnaAtasan')};
  if (c('dalamOn')) a.dalam = v('warnaDalam'); if (c('dasi')) a.dasi = v('warnaDasi'); if (c('sablon')) a.print = v('warnaSablon'); if (c('gulung')) a.gulung = true;
  lk.bawahan = {jenis:v('bawahan'), warna:v('warnaBawahan')};
  const tali = lk.sepatu && lk.sepatu.tali;
  const s = lk.sepatu = {jenis:v('sepatu'), warna:v('warnaSepatu')};
  if (c('aksenOn')) s.aksen = v('warnaAksen'); if (c('solOn')) s.sol = v('warnaSol'); if (tali) s.tali = tali;
  const lama = lk.aks || {}, k = lk.aks = {};
  if (v('kacamata')){ k.kacamata = v('kacamata'); if (lama.warnaKacamata) k.warnaKacamata = lama.warnaKacamata; }
  if (v('headphone')){ k.headphone = v('headphone'); k.warnaHeadphone = v('warnaHeadphone'); }
  if (!f.topi.disabled && v('topi')){ const tp = v('topi'); k.topi = {jenis:tp === 'beanie' ? 'beanie' : 'cap', warna:v('warnaTopi')}; if (tp === 'capBalik') k.topi.balik = true; }
  if (c('jam')) k.jam = v('warnaJam'); if (c('lanyard')) k.lanyard = v('warnaLanyard'); if (c('ransel')) k.ransel = v('warnaRansel');
  if (v('pegang')) k.pegang = v('pegang');
  for (const n of ['anting', 'kumis', 'jenggot']) if (c(n)) k[n] = true;
  return bersihLook(lk);
}
function syncBarisNama(){
  for (const i of pegEl.querySelectorAll('.pg-in')) if (i.dataset.slot === dlgSlot && document.activeElement !== i) i.value = namaTersimpan(dlgSlot);
  const g = [...pegEl.querySelectorAll('details')].find(d => [...d.querySelectorAll('.pg-row')].some(r => r.dataset.slot === dlgSlot)); if (g) perbaruiRingkasGrup(g);
}
pgForm.addEventListener('submit', e => e.preventDefault());
pgForm.addEventListener('input', e => {
  if (!dlgSlot) return;
  if (e.target.name === 'nama'){ clearTimeout(dlgTimer); dlgTimer = setTimeout(() => { setNama(dlgSlot, e.target.value); isiJudulDialog(); syncBarisNama(); }, 300); return; }
  aturKetergantungan();
  // pratinjau langsung; karakter di kantor dibuat ulang setelah jeda singkat (geser warna tidak membuat ulang tiap piksel)
  const lk = bacaForm(), slot = dlgSlot; pasangPratinjau(lk);
  clearTimeout(dlgLookT); dlgLookT = setTimeout(() => { dlgLookT = null; setLook(slot, lk); }, 160);
  dlgLookF = () => setLook(slot, lk);
});
let dlgLookT = null, dlgLookF = null;
function kirimLookTertunda(){ if (dlgLookT){ clearTimeout(dlgLookT); dlgLookT = null; dlgLookF && dlgLookF(); } }
pgForm.addEventListener('change', e => { if (e.target.name === 'nama' && dlgSlot){ clearTimeout(dlgTimer); e.target.value = setNama(dlgSlot, e.target.value); isiJudulDialog(); syncBarisNama(); } });
function bukaPenampilan(slot, asal){
  if (!BUILT || !slot) return;
  dlgSlot = slot; dlgAsal = asal || null; dlgAwal = JSON.stringify(PEG.orang[slot] || null);
  if (!pgForm.dataset.siap){ pgForm.innerHTML = formPenampilanHtml(); pgForm.dataset.siap = '1'; }
  isiFormPenampilan(); $('#pgInfo').textContent = '';
  dlg.classList.add('show');
  siapkanPratinjau(); PRATINJAU.aktif = true; pasangPratinjau(lookSekarang(slot));
  $('#pgNama').focus();
}
function tutupPenampilan(){
  if (!dlg.classList.contains('show')) return;
  clearTimeout(dlgTimer); kirimLookTertunda();
  if (document.activeElement && document.activeElement.name === 'nama' && dlgSlot) setNama(dlgSlot, document.activeElement.value);
  dlg.classList.remove('show'); PRATINJAU.aktif = false; lepasPratinjau();
  syncBarisNama(); dlgSlot = null;
  if (dlgAsal && document.contains(dlgAsal)) dlgAsal.focus();
}
$('#pgAcak').onclick = () => { clearTimeout(dlgLookT); dlgLookT = null; setLook(dlgSlot, lookAcak(warnaSlot(dlgSlot))); isiFormPenampilan(); pasangPratinjau(lookSekarang(dlgSlot)); $('#pgInfo').textContent = '🎲 Penampilan diacak.'; };
$('#pgRef').onclick = () => { clearTimeout(dlgLookT); dlgLookT = null; setLook(dlgSlot, null); isiFormPenampilan(); pasangPratinjau(lookSekarang(dlgSlot)); $('#pgInfo').textContent = '↺ Kembali ke penampilan referensi (desain).'; };
$('#pgBatal').onclick = () => {
  clearTimeout(dlgLookT); dlgLookT = null;
  const e = dlgAwal ? JSON.parse(dlgAwal) : null;
  if (e) PEG.orang[dlgSlot] = e; else delete PEG.orang[dlgSlot];
  simpanPeg(); terapkanSlot(dlgSlot, true); isiFormPenampilan(); syncBarisNama(); pasangPratinjau(lookSekarang(dlgSlot));
  $('#pgInfo').textContent = 'Perubahan sejak dialog dibuka dibatalkan.';
};
$('#pgSelesai').onclick = $('#pgX').onclick = () => tutupPenampilan();
dlg.addEventListener('click', e => { if (e.target === dlg) tutupPenampilan(); });
// pratinjau: renderer WebGL kecil kedua; karakternya ORANG.buat (sama dengan di kantor), dianimasikan R.tick
const PRATINJAU = {r:null, sc:null, cam:null, root:null, P:null, sudut:.45, aktif:false, seret:null, w:0, h:0};
function siapkanPratinjau(){
  const P = PRATINJAU; if (P.r) return;
  const cv = $('#pgCanvas');
  P.r = new THREE.WebGLRenderer({canvas:cv, antialias:true, alpha:true});
  P.r.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  P.sc = new THREE.Scene();
  P.sc.add(new THREE.HemisphereLight(0xffffff, 0xd8d2c4, 1.0));
  const k = new THREE.DirectionalLight(0xffffff, 2.2); k.position.set(2, 4, 3); P.sc.add(k);
  const f = new THREE.DirectionalLight(0xfff4e6, .5); f.position.set(-3, 2, -2); P.sc.add(f);
  const lt = new THREE.Mesh(new THREE.CircleGeometry(.62, 40), new THREE.MeshStandardMaterial({color:'#cfd8e3', roughness:.95})); lt.rotation.x = -PI / 2; P.sc.add(lt); P.lantai = lt;
  P.cam = new THREE.PerspectiveCamera(28, 1, .1, 50);
  P.root = new THREE.Group(); P.sc.add(P.root);
  cv.addEventListener('pointerdown', e => { P.seret = {x:e.clientX, s:P.sudut}; try { cv.setPointerCapture(e.pointerId); } catch (x){} });
  cv.addEventListener('pointermove', e => { if (P.seret) P.sudut = P.seret.s + (e.clientX - P.seret.x) * .012; });
  for (const ev of ['pointerup', 'pointercancel']) cv.addEventListener(ev, () => { P.seret = null; });
  cv.addEventListener('keydown', e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight'){ e.preventDefault(); P.sudut += e.key === 'ArrowLeft' ? -.35 : .35; } });
  for (const b of dlg.querySelectorAll('[data-putar]')) b.addEventListener('click', () => { P.sudut += +b.dataset.putar * .6; });
}
function lepasPratinjau(){ const P = PRATINJAU; if (P.P){ buangKarakter(P.P); P.P = null; } }
function pasangPratinjau(lk){
  const P = PRATINJAU; if (!P.root || !lk) return;
  lepasPratinjau();
  const a = aktorSlot(dlgSlot);
  P.P = ORANG.buat(P.root, Object.assign(salinLook(lk), {id:a ? a.P.o.id : idAgen(dlgSlot), x:0, z:0, r:0, pose:'berdiri', aksi:'berdiri'}));
  if (P.lantai) P.lantai.material.color.set(matchMedia('(prefers-color-scheme: dark)').matches ? '#2b3547' : '#cfd8e3');   // alas ikut mode gelap
}
function renderPratinjau(){
  const P = PRATINJAU; if (!P.aktif || !P.r) return;
  const cv = P.r.domElement, w = cv.clientWidth, h = cv.clientHeight;
  if (!w || !h) return;
  if (w !== P.w || h !== P.h){
    P.w = w; P.h = h; P.r.setSize(w, h, false); P.cam.aspect = w / h;
    // karakter ±1,9 m: jarak kamera disesuaikan supaya muat tinggi & lebar
    const tinggi = 2.05, lebar = .95, fv = P.cam.fov * PI / 180, d = Math.max(tinggi / 2 / Math.tan(fv / 2), lebar / 2 / (Math.tan(fv / 2) * P.cam.aspect)) + .5;
    P.cam.position.set(0, 1.1, d); P.cam.lookAt(0, .95, 0); P.cam.updateProjectionMatrix();
  }
  if (!RM && !P.seret) P.sudut += 1 / 60 * .55;
  P.root.rotation.y = P.sudut;
  P.r.render(P.sc, P.cam);
}

/* ================= kartu detail orang ================= */
const detEl = $('#detail');
let detAsal = null, detSig = '';
// "Posisi" = ruang desain tempat orang itu berada sekarang (lantai grup induknya)
function posisiOrang(a){
  const p = a.P.root.position, n = a.lantai;
  if (n === 1 && p.y > .3) return 'Di tangga (menuju lantai 2)';
  const r = ruangDi(n, p.x, p.z);
  return (r ? r.nama : 'Area kantor') + ' · lantai ' + n;
}
function durasi(s){
  s = Math.max(0, Math.round(s)); if (s < 60) return s + ' dtk';
  const m = Math.floor(s / 60); if (m < 60) return m + ' mnt ' + (s % 60) + ' dtk';
  return Math.floor(m / 60) + ' jam ' + (m % 60) + ' mnt';
}
const lalu = t => durasi(NOW - t) + ' lalu';
const namaOrang = a => a.boss ? (a.namaDiri || 'Claude') + ' (Kepala)' : a.namaDiri ? a.namaDiri + ' (' + (a.npc ? 'Resepsionis' : a.peran) + ')' : a.name;
function mejaTeks(a){
  if (a.boss) return 'Ruang Pimpinan · meja pimpinan (lantai 2)';
  if (a.npc) return 'Lobby · meja resepsionis (lantai 1)';
  const d = a.desk; if (!d) return '—';
  const r = ruangKursi(d), sama = KURSI.filter(k => k.lantai === d.lantai && k.jenis === d.jenis && ruangKursi(k) === r), i = sama.indexOf(d);
  const jenis = {meja:'meja', meja_dev:'meja programmer', meja_berdiri:'meja berdiri', noc:'meja NOC', rapat:'kursi rapat'}[d.jenis] || 'tempat';
  return `${r ? r.nama : 'Kantor'} · ${jenis}${i >= 0 ? ' ' + (i + 1) + ' dari ' + sama.length : ''} (lantai ${d.lantai})` + ((d.dipakai || 0) > 1 ? ' · dipakai bersama' : '');
}
function bukaDetail(a, asal){ detAsal = asal || null; detSig = ''; renderDetail(); if (asal && !detEl.hidden) detEl.focus({preventScroll:true}); }
function tutupDetail(kembalikanFokus = true){
  const a = state.selected, diKartu = detEl.contains(document.activeElement);
  if (a){ state.selected = null; if (follow === a){ follow = null; ikutMode = 'ikuti'; } renderList(true); }
  detEl.hidden = true; detSig = '';
  if (kembalikanFokus && detAsal && document.contains(detAsal)) detAsal.focus();
  else if (diKartu) renderer.domElement.focus({preventScroll:true});      // fokus tidak hilang ke <body>
  detAsal = null;
}
function renderDetail(){
  const a = state.selected;
  if (!a || !BUILT){ if (!detEl.hidden){ detEl.hidden = true; detSig = ''; } return; }
  const t = a.team, st = a.status;
  const warna = a.boss ? '#c9a227' : a.npc ? '#94a3b8' : a.color;
  const ikon = a.boss ? '👑' : a.npc ? '🏢' : (t && t.icon) || '👤';
  const sub = a.boss ? (a.namaDiri ? 'Kepala · ' : '') + 'Claude utama · sesi Claude Code Anda' : a.npc ? (a.namaDiri ? 'Resepsionis · ' : '') + 'Resepsionis kantor · skill resepsionis (dijalankan Kepala)' :
    (a.namaDiri && !t ? a.peran + ' · ' : '') + (t ? (t.support ? t.label + ' · Tim Pendukung' : t.label) + ' · agent ' + t.who : '') + (a.temp ? ' · anggota sementara' : '');
  const act = a.activity;
  const rows = [['Ruang & meja', esc(mejaTeks(a))], ['Posisi', esc(posisiOrang(a))]];
  if (a.boss) rows.push(['Tugas dari Anda', a.tugasTeks ? esc(short(a.tugasTeks, 140)) : '—']);
  else if (a.npc) rows.push(['Tugas', 'Merapikan permintaan yang masih mentah jadi tiket (.ai/masuk/), lalu meneruskannya ke Kepala']);
  else { const ds = a.job ? (a.desc || a.job.desc) : a.desc; rows.push([a.job ? 'Tugas sekarang' : 'Tugas terakhir', ds ? esc(short(ds, 160)) : a.job ? 'Tugas baru' : '—']); }
  if (!a.npc){
    const al = a.alat;
    rows.push(['Alat terakhir', al ? `<span class="swc sm" style="--c:${SCREEN[al.cat] || SCREEN.other}" title="Warna layar"></span>${al.icon} ${esc(al.label)}` +
      (al.detail ? ' · ' + esc(short(al.detail, 60)) : '') + ` <span class="tm">(${lalu(al.ts)})</span>` : '—']);
  }
  if (a.boss){
    rows.push(['Terakhir bekerja', a.lastWork > 0 ? lalu(a.lastWork) : '—'], ['Divisi ditugaskan', (a.tugaskan || 0) + ' kali'], ['Jawaban selesai', String(a.selesai || 0)]);
  } else if (a.npc){
    rows.push(['Tugas diteruskan', (a.antar || 0) + ' kali (sesi ini)']);
  } else {
    const tot = (a.kerjaTotal || 0) + (a.job ? NOW - a.job.since : 0);
    rows.push(['Lama bertugas', a.job ? durasi(NOW - a.job.since) : 'Sedang tidak bertugas'], ['Total kerja', tot > 0 ? durasi(tot) + ' (sesi ini)' : '—'],
      ['Tugas selesai', (a.selesai || 0) + ' (sesi ini)']);
  }
  const desc = a.boss ? 'Kepala kantor: menerima tugas dari Anda, membagi ke divisi, lalu merangkum hasilnya.' : a.npc ? '' :
    (t && (t.desc || state.agentDesc.get(t.who))) || '';
  const rw = (a.riwayat || []).map(r => `<li class="${r.cls}"><span aria-hidden="true">${r.ikon}</span><span>${r.html ? r.teks : esc(r.teks)}<span class="tm">${hhmmss(r.ts)}</span></span></li>`).join('') ||
    '<li class="kosong">Belum ada aktivitas tercatat di sesi ini.</li>';
  const dl = rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join('');
  // skill: ringkasan skill divisi + skill yang sedang/terakhir dipakai orang ini (menyala live dari event Skill)
  let skh = '';
  if (!a.npc){
    const I = a.boss ? null : infoAgenTim(t);
    if (!a.boss){
      skh = '<div class="sk-t">Skill divisi</div>';
      if (I){
        const w = I.skills || [], o = I.skillsOpsional || [], me = {skill:a.skill};
        skh += `<div class="chips" style="--c:${t.color}">${I.model ? `<span class="chip model" title="Model">${esc(I.model)}</span>` : ''}` +
          (w.length ? w.map(s => chipSkill(s, me, 'wajib')).join('') : '<span class="chip ops">tanpa skill wajib</span>') +
          o.slice(0, 5).map(s => chipSkill(s, me, 'ops')).join('') + (o.length > 5 ? `<span class="chip ops">+${o.length - 5} opsional</span>` : '') +
          `<span class="chip ops">${(I.tools || []).length} alat</span></div>`;
      } else skh += '<p class="sk-p">Belum ada file agent untuk tipe ini.</p>';
    }
    skh += '<div class="sk-t">Skill dipakai</div>' + skillSekarangHtml(a.skill || null, false);
  }
  const ikut = follow === a, bh = ikut && ikutMode === 'bahu';
  const sig = [a.id, st, act, dl, desc, rw, ikut, bh, skh, a.namaDiri].join('\u0001');
  detEl.hidden = false;
  if (sig === detSig) return; detSig = sig;
  const ic = $('#dIc'); ic.textContent = ikon; ic.style.setProperty('--c', warna);
  $('#dNama').textContent = a.boss ? '👑 ' + (a.namaDiri || 'Claude') + ' · Kepala' : a.name; $('#dSub').textContent = sub;
  const s = $('#dSt'); s.className = 'st ' + st; s.textContent = ST_TXT[st] || st; $('#dAct').textContent = act;
  $('#dDl').innerHTML = dl; $('#dDesc').textContent = desc; $('#dRw').innerHTML = rw; $('#dSk').innerHTML = skh;
  $('#dSkill').hidden = !t || !t.key; $('#dUbah').hidden = !a.slot;
  const bi = $('#dIkut'); bi.setAttribute('aria-pressed', ikut && !bh ? 'true' : 'false'); bi.textContent = ikut && !bh ? '🎯 Mengikuti' : '🎯 Ikuti kamera';
  $('#dBahu').setAttribute('aria-pressed', bh ? 'true' : 'false');
}
$('#dIkut').onclick = () => { const a = state.selected; if (!a) return; if (follow === a && ikutMode === 'ikuti'){ follow = null; catatan('Kamera dilepas'); renderDetail(); } else ikuti(a); };
$('#dBahu').onclick = () => bahu(state.selected);
$('#dMeja').onclick = () => keMeja(state.selected);
$('#dTutup').onclick = () => tutupDetail();
// layar ≤1000 px: kartu detail menutupi panel → tutup dulu, baru buka kartu divisi di tab Tim / dialog pegawai
const detailMenutupPanel = () => matchMedia('(max-width:1000px)').matches;
$('#dSkill').onclick = () => { const a = state.selected; if (!a || !a.team) return; const t = a.team; if (detailMenutupPanel()) tutupDetail(false); if ($('#app').classList.contains('nopanel')) $('#bPanel').click(); bukaInfoDivisi(t); };
$('#dUbah').onclick = () => { const a = state.selected; if (a && a.slot) bukaPenampilan(a.slot, $('#dUbah')); };

/* ================= kamera & klik ================= */
const HOME_DIR = new THREE.Vector3(1, .62, 1.25).normalize(), HOME_GESER = new THREE.Vector3(2.2, 0, -1.7);   // kamera awal preview.html
const FLY_DIR = new THREE.Vector3(.45, 1.0, .85).normalize();          // arah kamera saat terbang ke ruang (lebih menukik)
const HOME_CAM = new THREE.Vector3(), HOME_TGT = new THREE.Vector3();
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const SUMBU_Y = V3(0, 1, 0);
let ikutMode = 'ikuti', tur = null;        // ikutMode: 'ikuti' (kamera ikut bergeser) | 'bahu' (orang ke-3, di belakang bahu)
controls.enablePan = true;
controls.screenSpacePanning = false;       // geser sejajar lantai
controls.minPolarAngle = 0; controls.maxPolarAngle = Math.PI / 2 - .06;   // tidak bisa masuk ke bawah lantai
controls.addEventListener('start', () => { hentikanTur(true); if (ikutMode === 'bahu') ikutMode = 'ikuti'; });

// Sudut kamera. tombol[0] = angka di keyboard.
const SUDUT = [
  {id:'iso', ikon:'🎥', nama:'Isometrik (bawaan)', tombol:['1', 'R'], ket:'Kamera awal desain (preview.html): seluruh kantor dari tenggara.', fn:() => keHome()},
  {id:'atas', ikon:'🗺️', nama:'Tampak atas', tombol:['2', 'T'], ket:'Denah dari atas, tepat di atas lantai yang sedang dipilih.', fn:() => topView()},
  {id:'depan', ikon:'🧭', nama:'Depan (dari selatan)', tombol:['3'], ket:'Dari sisi pintu masuk, menghadap utara.', fn:() => arahMata(V3(0, .8, 1))},
  {id:'belakang', ikon:'🧭', nama:'Belakang (dari utara)', tombol:['4'], ket:'Dari sisi utara (belakang Studio, Ruang Pimpinan, NOC).', fn:() => arahMata(V3(0, .8, -1))},
  {id:'kiri', ikon:'🧭', nama:'Kiri (dari barat · lobi)', tombol:['5'], ket:'Dari sisi Lobby menghadap timur.', fn:() => arahMata(V3(-1, .8, 0))},
  {id:'kanan', ikon:'🧭', nama:'Kanan (dari timur · taman)', tombol:['6'], ket:'Dari taman menghadap barat.', fn:() => arahMata(V3(1, .8, 0))},
  {id:'dekat', ikon:'🔍', nama:'Dekat (ruang teramai)', tombol:['7'], ket:'Close-up ruang dengan anggota bertugas terbanyak; bila sepi, Ruang Pimpinan.', fn:() => dekatRamai()},
  {id:'tur', ikon:'🎬', nama:'Sinematik (tur otomatis)', tombol:['8'], ket:'Berkeliling ruang demi ruang; berhenti saat Anda menyentuh kamera atau menekan Esc.', fn:() => mulaiTur()},
];
const SUDUT_ORANG = [
  {id:'ikuti', ikon:'🎯', nama:'Ikuti orang terpilih', tombol:['F'], ket:'Kamera ikut bergeser bersama orang yang dipilih.', fn:() => ikuti(state.selected)},
  {id:'bahu', ikon:'🎬', nama:'Orang ke-3 (belakang bahu)', tombol:['V'], ket:'Kamera di belakang bahu orang terpilih dan ikut ke mana ia pergi.', fn:() => bahu(state.selected)},
];
// Keyboard: kode tombol → gerak kamera (ditahan = terus bergerak)
const TOMBOL_GERAK = {KeyW:'maju', ArrowUp:'maju', KeyS:'mundur', ArrowDown:'mundur', KeyA:'kiri', ArrowLeft:'kiri', KeyD:'kanan', ArrowRight:'kanan',
  KeyQ:'putarKiri', KeyE:'putarKanan', Equal:'dekat', NumpadAdd:'dekat', PageUp:'dekat', Minus:'jauh', NumpadSubtract:'jauh', PageDown:'jauh'};
const CARA_GERAK = {
  'Mouse / trackpad':[[['Seret kiri'], 'Putar kamera'], [['Seret kanan', 'Shift + seret'], 'Geser kamera'], [['Scroll', 'cubit trackpad'], 'Zoom'],
    [['Klik orang', 'nama anggota'], 'Pilih & lihat detail'], [['Klik label ruang', 'nama divisi'], 'Terbang ke ruangnya'], [['Klik tempat kosong'], 'Batal pilih']],
  'Layar sentuh':[[['1 jari geser'], 'Putar'], [['2 jari cubit'], 'Zoom'], [['2 jari geser'], 'Geser'], [['Ketuk orang'], 'Pilih & lihat detail'],
    [['🕹️ Tombol arah'], 'Geser, putar, zoom dengan tombol']],
  'Keyboard':[[['W', 'A', 'S', 'D'], 'Geser (juga tombol panah)'], [['Q', 'E'], 'Putar kiri / kanan'], [['+', '−'], 'Zoom masuk / keluar (juga PgUp / PgDn)'],
    [['R'], 'Kembali ke sudut awal'], [['T'], 'Tampak atas'], [['1', '–', '8'], 'Sudut kamera (lihat daftar)'], [['L'], 'Ganti lantai: Lantai 1 → Lantai 2 → Terpisah'], [['F'], 'Ikuti orang terpilih'],
    [['V'], 'Orang ke-3 (belakang bahu)'], [['Esc'], 'Lepas ikuti / tutup kartu, menu, dialog']],
};

function select(a, asal = null){
  state.selected = (!a || state.selected === a) ? null : a; follow = state.selected; ikutMode = 'ikuti'; hentikanTur(); renderList(true);
  if (follow){
    pastikanLantai(follow.lantai);
    follow.bubble(follow.boss ? '👑 Kepala kantor' : (follow.job && follow.desc ? short(follow.desc, 60) : follow.activity), 'info', 3000);
    if (camera.position.distanceTo(controls.target) > 22){
      const p = follow.P.root.getWorldPosition(new THREE.Vector3());
      flyTo(p.clone().addScaledVector(FLY_DIR, 9), p.setY(p.y + .8), true);
    }
    bukaDetail(follow, asal);
  }
}
const ray = new THREE.Raycaster(), mouse = new THREE.Vector2(); let downAt = null;
renderer.domElement.addEventListener('pointerdown', e => downAt = [e.clientX, e.clientY]);
renderer.domElement.addEventListener('pointerup', e => {
  if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 5 || !BUILT) return;
  const r = renderer.domElement.getBoundingClientRect();
  mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(mouse, camera);
  // raycast ke seluruh mesh di bawah P.root tiap aktor (root.userData.aktor); lantai tersembunyi/tertutup diabaikan, pelat lantai 2 menghalangi
  const akar = [...AKAR].filter(r => terlihat(r) && lantaiTampak(r.parent === R.lantai2 ? 2 : 1));
  const hits = ray.intersectObjects(terlihat(R.lantai2) ? [...akar, ...PENGHALANG] : akar, true);
  let hit = null;
  for (const h of hits){
    if (!terlihat(h.object)) continue;
    if (PENGHALANG.includes(h.object)) break;
    let o = h.object; while (o && !o.userData.aktor) o = o.parent;
    if (o){ hit = o.userData.aktor; break; }
  }
  if (hit) select(hit); else if (state.selected) tutupDetail(false);
});
// Transisi kamera halus. Pilihan orang (kartu detail) tetap; hanya "ikuti" yang dilepas.
// sejajar = titik pandang ikut tinggi lantai sesudahnya (sudut awal, tampak atas, sudut sisi)
function flyTo(pos, tgt, keepFollow = false, laju = 1.2, sejajar = false){
  if (!keepFollow){ follow = null; ikutMode = 'ikuti'; }
  ikutLantai = sejajar;
  camAnim = {p0:camera.position.clone(), t0:controls.target.clone(), p1:pos.clone(), t1:tgt.clone(), s:RM ? .999 : 0, laju};
}
const tengahRuang = r => { const [x1, z1, x2, z2] = r.kotak[0]; return [(x1 + x2) / 2, (z1 + z2) / 2]; };
function flyToRuang(r){
  if (!r || !BUILT) return;
  hentikanTur();
  pastikanLantai(r.lantai);
  const [x, z] = r.label || tengahRuang(r);
  const t = keDunia(r.lantai, x, 0, z);
  flyTo(t.clone().addScaledVector(FLY_DIR, 11), t);
  userMoved = true;
}
// Jarak terdekat agar seluruh kotak kantor (BOX) muat di layar dari arah `dir` (dicari biner, memakai proyeksi kamera sungguhan).
const FIT_CAM = new THREE.PerspectiveCamera(45, 1, .1, 5000), _fv = new THREE.Vector3();
function jarakMuat(dir, tgt, isiX = .9, isiY = .86, kotak = BOX){
  if (!kotak) return 50;
  FIT_CAM.fov = camera.fov; FIT_CAM.aspect = camera.aspect; FIT_CAM.updateProjectionMatrix();
  let lo = 1, hi = 900;
  for (let i = 0; i < 30; i++){
    const mid = (lo + hi) / 2; let ok = true;
    FIT_CAM.position.copy(tgt).addScaledVector(dir, mid); FIT_CAM.lookAt(tgt); FIT_CAM.updateMatrixWorld();
    for (let k = 0; k < 8 && ok; k++){
      _fv.set(k & 1 ? kotak.max.x : kotak.min.x, k & 2 ? kotak.max.y : kotak.min.y, k & 4 ? kotak.max.z : kotak.min.z).project(FIT_CAM);
      if (Math.abs(_fv.z) > 1 || Math.abs(_fv.x) > isiX || Math.abs(_fv.y) > isiY) ok = false;
    }
    if (ok) hi = mid; else lo = mid;
  }
  return hi;
}
// Sudut awal = kamera awal preview.html persis (bola pembatas model saat mode Terpisah; jarak = r / tan(fov/2) × 0,82; digeser 2,2 / −1,7)
function computeHome(){
  if (!SPHERE) return;
  const dist = (SPHERE.radius / Math.tan(camera.fov * Math.PI / 360)) * .82;
  HOME_TGT.copy(SPHERE.center).add(HOME_GESER); HOME_CAM.copy(SPHERE.center).addScaledVector(HOME_DIR, dist).add(HOME_GESER);
  camera.near = Math.max(dist / 100, .01); camera.far = dist * 100; camera.updateProjectionMatrix();
  // kabut mulai di luar jarak tampilan awal → kantor tidak berkabut di sudut awal
  ENV.kabutDekat = Math.max(70, dist * 1.35);
  if (scene.fog){ scene.fog.near = ENV.kabutDekat; scene.fog.far = ENV.kabutDekat + KABUT_JAUH; }
  controls.maxDistance = dist * 2.4; controls.minDistance = 1.5;
}
// Reset = kamera awal preview, sudah pada tinggi pandang mode lantai sekarang (seperti preview setelah langkahLantai)
function keHome(){
  computeHome(); const dy = tinggiPandang(mode) - HOME_TGT.y;
  flyTo(HOME_CAM.clone().setY(HOME_CAM.y + dy), HOME_TGT.clone().setY(HOME_TGT.y + dy), false, 1.2, true); userMoved = false;
}
// titik pandang = tengah kotak lantai yang dipilih, pada tinggi lantainya
function titikMode(){ const kb = kotakMode(), c = kb.getCenter(new THREE.Vector3()); c.y = tinggiPandang(mode); return {kb, c}; }
function topView(){
  if (!SPHERE) return;
  const {kb, c} = titikMode(), dir = V3(0, 1, .001).normalize(), d = jarakMuat(dir, c, .93, .9, kb);
  flyTo(c.clone().addScaledVector(dir, d), c, false, 1.2, true); userMoved = true;
}
function arahMata(dir){
  if (!SPHERE) return;
  dir.normalize(); const {kb, c} = titikMode(), d = jarakMuat(dir, c, .9, .86, kb);
  flyTo(c.clone().addScaledVector(dir, d), c, false, 1.2, true); userMoved = true;
}
function ruangTeramai(){
  const n = new Map();
  for (const t of state.teamList) for (const m of t.members) if (m.job){ const r = ruangKursi(m.desk); if (r) n.set(r, (n.get(r) || 0) + 1); }
  let best = null, max = 0; for (const [r, k] of n) if (k > max){ best = r; max = k; }
  return best || RUANG_BY.pimpinan;
}
function dekatRamai(){
  const r = ruangTeramai(); pastikanLantai(r.lantai);
  const [x, z] = r.label || tengahRuang(r), t = keDunia(r.lantai, x, .4, z);
  flyTo(t.clone().addScaledVector(V3(.4, .85, .8).normalize(), 8), t); userMoved = true;
  return r.nama;
}
/* ---- tur sinematik ---- */
function tempatTur(i){ const r = RUANG_BY[TUR_SINEMATIK[i]]; return r ? {nama:r.nama, r} : null; }
function mulaiTur(){
  if (!BUILT) return;
  tur = {i:-1, tahan:0}; lanjutTur(); userMoved = true;
}
function lanjutTur(){
  const n = TUR_SINEMATIK.length; let p = null;
  for (let k = 0; k < n && !p; k++){ tur.i = (tur.i + 1) % n; p = tempatTur(tur.i); }
  if (!p){ tur = null; return; }
  pastikanLantai(p.r.lantai);
  const [px, pz] = p.r.label || tengahRuang(p.r), t = keDunia(p.r.lantai, px, .5, pz), az = Math.atan2(HOME_DIR.x, HOME_DIR.z) + tur.i * .95, pol = .98;
  const dir = V3(Math.sin(pol) * Math.sin(az), Math.cos(pol), Math.sin(pol) * Math.cos(az));
  flyTo(t.clone().addScaledVector(dir, 9.5), t, false, .5); tur.tahan = 0;
  catatan(`🎬 ${p.nama} · sentuh kamera atau tekan Esc untuk berhenti`, 3800);
}
function hentikanTur(beriTahu){ if (!tur) return; tur = null; if (beriTahu) catatan('⏹️ Tur sinematik berhenti'); }
function orbitY(sudut){ const o = camera.position.clone().sub(controls.target).applyAxisAngle(SUMBU_Y, sudut); camera.position.copy(controls.target).add(o); }
/* ---- kamera orang terpilih ---- */
const tmpB = V3();
function posBahu(a, pos, tgt){
  a.P.root.getWorldPosition(tmpB);
  const ry = a.P.root.rotation.y, fx = Math.sin(ry), fz = Math.cos(ry);      // arah hadap; kanan = (-fz, 0, fx)
  pos.set(tmpB.x - fx * 2.9 - fz * .5, tmpB.y + 2.25, tmpB.z - fz * 2.9 + fx * .5);
  tgt.set(tmpB.x + fx * 2.4, tmpB.y + 1.0, tmpB.z + fz * 2.4);
}
const PILIH_DULU = 'Pilih orang dulu: klik karakter atau nama anggota di panel';
function ikuti(a){
  if (!a){ catatan(PILIH_DULU); return; }
  hentikanTur(); pastikanLantai(a.lantai);
  if (state.selected !== a){ state.selected = a; bukaDetail(a); }
  follow = a; ikutMode = 'ikuti';
  if (camera.position.distanceTo(controls.target) > 22){ const p = a.P.root.getWorldPosition(V3()); flyTo(p.clone().addScaledVector(FLY_DIR, 9), p.setY(p.y + .8), true); }
  catatan('🎯 Mengikuti ' + namaOrang(a)); renderList(true);
}
function bahu(a){
  if (!a){ catatan(PILIH_DULU); return; }
  hentikanTur(); pastikanLantai(a.lantai);
  if (state.selected !== a){ state.selected = a; bukaDetail(a); }
  follow = a; ikutMode = 'bahu';
  const p = V3(), t = V3(); posBahu(a, p, t); flyTo(p, t, true, .9);
  catatan('🎬 Orang ke-3: ' + namaOrang(a) + ' · seret untuk melepas'); renderList(true);
}
function keMeja(a){
  if (!a || !a.desk || !BUILT) return;
  hentikanTur();
  pastikanLantai(a.desk.lantai);
  const p = keDunia(a.desk.lantai, a.desk.x, .4, a.desk.z);
  flyTo(p.clone().addScaledVector(FLY_DIR, 6), p); userMoved = true;
  catatan('🪑 Meja ' + namaOrang(a)); renderDetail();
}
function pilihSudut(id){
  const s = SUDUT.find(x => x.id === id) || SUDUT_ORANG.find(x => x.id === id);
  if (!s || !BUILT) return;
  tutupMenu(false);
  if (s.id !== 'tur') hentikanTur();
  const hasil = s.fn();
  if (SUDUT.includes(s) && s.id !== 'tur') catatan(s.ikon + ' ' + (typeof hasil === 'string' ? 'Dekat: ' + hasil : s.nama));
}
/* ---- catatan singkat di layar ---- */
let noteT = null;
function catatan(teks, ms = 2200){ const n = $('#note'); n.textContent = teks; n.classList.add('show'); clearTimeout(noteT); noteT = setTimeout(() => n.classList.remove('show'), ms); }
/* ---- menu sudut kamera ---- */
const camMenu = $('#camMenu'), bCam = $('#bCam');
function bangunMenu(){
  const item = s => `<button type="button" class="mi" role="menuitem" tabindex="-1" data-sudut="${s.id}"><span aria-hidden="true">${s.ikon}</span><span>${esc(s.nama)}</span><span aria-hidden="true">${s.tombol.map(k => `<kbd>${esc(k)}</kbd>`).join(' ')}</span></button>`;
  const lt = l => `<button type="button" class="mi" role="menuitemradio" aria-checked="false" tabindex="-1" data-lantai="${l[0]}"><span aria-hidden="true">🏢</span><span>${esc(l[1])}</span><span aria-hidden="true"><kbd>L</kbd></span></button>`;
  camMenu.innerHTML = `<div class="mh" aria-hidden="true">Seluruh kantor</div>${SUDUT.map(item).join('')}<hr><div class="mh" aria-hidden="true">Orang terpilih</div>${SUDUT_ORANG.map(item).join('')}` +
    `<hr><div class="mh" aria-hidden="true">Lantai</div>${[['l1', 'Lantai 1'], ['l2', 'Lantai 2'], ['terpisah', 'Terpisah (kedua lantai)']].map(lt).join('')}`;
}
const itemMenu = () => [...camMenu.querySelectorAll('.mi')];
function bukaMenu(akhir){
  camMenu.hidden = false; bCam.setAttribute('aria-expanded', 'true');
  const ada = !!state.selected;
  for (const b of camMenu.querySelectorAll('[data-sudut=ikuti],[data-sudut=bahu]')) b.setAttribute('aria-disabled', ada ? 'false' : 'true');
  for (const b of camMenu.querySelectorAll('[data-lantai]')) b.setAttribute('aria-checked', b.dataset.lantai === mode ? 'true' : 'false');
  const it = itemMenu(); (akhir ? it[it.length - 1] : it[0]).focus();
}
function tutupMenu(fokus = true){ if (camMenu.hidden) return; camMenu.hidden = true; bCam.setAttribute('aria-expanded', 'false'); if (fokus) bCam.focus(); }
bCam.addEventListener('click', () => camMenu.hidden ? bukaMenu(false) : tutupMenu());
bCam.addEventListener('keydown', e => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown'){ e.preventDefault(); bukaMenu(e.key === 'ArrowUp'); } });
camMenu.addEventListener('click', e => {
  const b = e.target.closest('.mi'); if (!b) return;
  if (b.dataset.lantai){ tutupMenu(false); pilihLantai(b.dataset.lantai, true); return; }
  if (b.getAttribute('aria-disabled') === 'true'){ catatan(PILIH_DULU); return; }
  pilihSudut(b.dataset.sudut);
});
camMenu.addEventListener('keydown', e => {
  const it = itemMenu(), i = it.indexOf(document.activeElement);
  const j = {ArrowDown:(i + 1) % it.length, ArrowUp:(i - 1 + it.length) % it.length, Home:0, End:it.length - 1}[e.key];
  if (j != null){ e.preventDefault(); it[j].focus(); }
  else if (e.key === 'Tab') tutupMenu(false);
});
document.addEventListener('pointerdown', e => { if (!camMenu.hidden && !e.target.closest('.mwrap')) tutupMenu(false); });
/* ---- gerak kamera: keyboard & tombol arah di layar ---- */
const TEKAN = new Map(), PAD_TEKAN = new Set();   // TEKAN = kode tombol keyboard → nama gerak; PAD_TEKAN = nama gerak
for (const b of $('#pad').querySelectorAll('button')){
  const g = b.dataset.gerak;
  if (!g){ b.addEventListener('click', () => pilihSudut(b.dataset.sudut)); continue; }
  b.addEventListener('pointerdown', e => { e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch (x){} PAD_TEKAN.add(g); b.classList.add('on'); });
  const lepas = () => { PAD_TEKAN.delete(g); b.classList.remove('on'); };
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(ev, lepas);
  b.addEventListener('click', e => { if (e.detail === 0){ PAD_TEKAN.add(g); setTimeout(() => PAD_TEKAN.delete(g), 220); } });   // Enter/Spasi = satu langkah
}
const tmpO = V3(), tmpF = V3(), tmpR = V3();
function gerakKamera(dt){
  if (!TEKAN.size && !PAD_TEKAN.size) return;
  const n = {maju:0, mundur:0, kiri:0, kanan:0, putarKiri:0, putarKanan:0, dekat:0, jauh:0};
  for (const g of TEKAN.values()) n[g] = 1;
  for (const g of PAD_TEKAN) n[g] = 1;
  const gz = n.maju - n.mundur, gx = n.kanan - n.kiri, gr = n.putarKiri - n.putarKanan, gd = n.dekat - n.jauh;
  if (!gx && !gz && !gr && !gd) return;
  hentikanTur(true); camAnim = null; userMoved = true;
  const k = SET.kecepatan, off = tmpO.copy(camera.position).sub(controls.target), dist = off.length();
  if (gx || gz){
    if (follow){ follow = null; ikutMode = 'ikuti'; renderDetail(); }
    const f = tmpF.set(-off.x, 0, -off.z); if (f.lengthSq() < 1e-8) f.set(0, 0, -1); f.normalize();
    const r = tmpR.set(-f.z, 0, f.x), sp = Math.max(dist, 4) * .42 * k * dt;     // ±0,4 × jarak per detik
    f.multiplyScalar(gz * sp).addScaledVector(r, gx * sp);
    controls.target.add(f); camera.position.add(f);
  }
  if (gr){ off.applyAxisAngle(SUMBU_Y, gr * 1.1 * k * dt); camera.position.copy(controls.target).add(off); }
  if (gd){
    if (ikutMode === 'bahu') ikutMode = 'ikuti';
    off.setLength(THREE.MathUtils.clamp(dist * Math.exp(-gd * .9 * k * dt), controls.minDistance, controls.maxDistance));
    camera.position.copy(controls.target).add(off);
  }
}
const mengetik = el => el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
function jebakFokus(e, box = $('#help .box')){
  const f = [...box.querySelectorAll('button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter(x => !x.disabled && x.offsetParent !== null); if (!f.length) return;
  const a = f[0], z = f[f.length - 1];
  if (e.shiftKey && document.activeElement === a){ e.preventDefault(); z.focus(); }
  else if (!e.shiftKey && document.activeElement === z){ e.preventDefault(); a.focus(); }
}
function tutupHelp(){ $('#help').classList.remove('show'); $('#bHelp').focus(); }
document.addEventListener('keydown', e => {
  const t = e.target, help = $('#help').classList.contains('show'), peg = dlg.classList.contains('show');
  // dialog Laporan (modal bawaan <dialog>: Esc menutup sendiri); tombol kamera/kantor tidak berlaku di dalamnya
  if (lapDlg.open){
    if (e.key === 'Tab') lapJebak(e);
    else if (e.key === 'Escape' && !lapDlg.matches(':modal')){ e.preventDefault(); lapTutup(); }   // non-modal (sisa cetak): Esc bawaan tidak berlaku
    return;
  }
  if (peg){
    if (e.key === 'Escape'){ e.preventDefault(); tutupPenampilan(); }
    else if (e.key === 'Tab') jebakFokus(e, $('#pegDlg .pg-box'));
    return;
  }
  if (e.key === 'Escape'){
    if (help){ tutupHelp(); return; }
    if (!camMenu.hidden){ tutupMenu(true); return; }
    if (t && t.closest && t.closest('#detail')){ tutupDetail(); return; }
    if (tur){ hentikanTur(true); return; }
    if (follow){ follow = null; ikutMode = 'ikuti'; catatan('Kamera dilepas'); renderDetail(); return; }
    if (state.selected){ tutupDetail(); return; }
    return;
  }
  if (help){ if (e.key === 'Tab') jebakFokus(e); return; }
  if (e.ctrlKey || e.metaKey || e.altKey || mengetik(t)) return;
  if (t && t.closest && t.closest('#camMenu')) return;
  const g = TOMBOL_GERAK[e.code] || {'+':'dekat', '-':'jauh'}[e.key];   // e.key: +/− di tata letak keyboard non-US
  if (g){
    // panah & PgUp/PgDn di panel/kartu tetap untuk menggulir; panah di tab untuk pindah tab
    if (/^(Arrow|Page)/.test(e.code) && t && t.closest && (t.closest('aside#panel, #detail, #aktivitas') || t.getAttribute('role') === 'tab')) return;
    e.preventDefault(); TEKAN.set(e.code, g); return;
  }
  if (e.repeat) return;
  const k = e.key.toLowerCase(); let id = null;
  if (k === 'l' && R){ e.preventDefault(); const u = ['l1', 'l2', 'terpisah']; pilihLantai(u[(u.indexOf(mode) + 1) % u.length], true); return; }
  if (/^(Digit|Numpad)[1-8]$/.test(e.code)) id = SUDUT[+e.code.slice(-1) - 1].id;
  else id = {r:'iso', t:'atas', f:'ikuti', v:'bahu'}[k] || null;
  if (id){ e.preventDefault(); pilihSudut(id); }
});
document.addEventListener('keyup', e => TEKAN.delete(e.code));
window.addEventListener('blur', () => { TEKAN.clear(); PAD_TEKAN.clear(); });
function terapkanKamera(){
  const k = SET.kecepatan;
  controls.rotateSpeed = k; controls.zoomSpeed = k; controls.panSpeed = k; controls.autoRotateSpeed = .5 * k;
  if (camera.fov !== SET.fov){
    camera.fov = SET.fov; camera.updateProjectionMatrix();
    if (BUILT){ computeHome(); if (!userMoved && !camAnim) keHome(); }
  }
}
function setDemoBtn(on){
  const b = $('#bDemo'); b.setAttribute('aria-pressed', on ? 'true' : 'false');
  b.innerHTML = `<span aria-hidden="true">${on ? '⏸️' : '▶️'}</span><span class="bl">Demo</span>`;
}
$('#bReset').onclick = () => pilihSudut('iso');
$('#bAtas').onclick = () => pilihSudut('atas');
$('#help').onclick = e => { if (e.target.id === 'help') tutupHelp(); };
$('#bHelp').onclick = () => { $('#help').classList.add('show'); $('#bHelpX').focus(); };
$('#bHelpX').onclick = () => tutupHelp();
// panel ciut/buka: satu status (.nopanel) untuk tombol 📋 dan pegangan di tepi panel; diingat per browser (UI.panel.ciut)
function setelPanel(ciut, simpan = true){
  $('#app').classList.toggle('nopanel', ciut);
  const g = $('#bPeg'), lbl = ciut ? 'Buka panel' : 'Ciutkan panel';
  $('#bPanel').setAttribute('aria-expanded', ciut ? 'false' : 'true'); $('#bPanel').setAttribute('aria-label', lbl); $('#bPanel').title = lbl;
  g.setAttribute('aria-expanded', ciut ? 'false' : 'true'); g.setAttribute('aria-label', lbl); g.title = lbl;
  g.querySelector('.pd').textContent = ciut ? '›' : '‹'; g.querySelector('.pv').textContent = ciut ? '˄' : '˅';
  if (simpan) uiSetel('panel', 'ciut', ciut);
}
const togglePanel = () => setelPanel(!$('#app').classList.contains('nopanel'));
$('#bPanel').onclick = togglePanel;
$('#bPeg').onclick = togglePanel;
// keadaan awal tanpa animasi
$('#app').classList.add('pn-awal');
setelPanel(uiBuka('panel', 'ciut', false), false);
requestAnimationFrame(() => requestAnimationFrame(() => $('#app').classList.remove('pn-awal')));
renderer.domElement.addEventListener('webglcontextlost', e => {
  e.preventDefault();
  if (SET.kualitas === 'hd' || SET.kualitas === 'ultra'){ SET.kualitas = 'standar'; simpanSet(); }
  addLog({icon:'⚠️', who:'Kantor', text:'Kartu grafis kehabisan memori. Kualitas disetel ke Standar; muat ulang halaman.', cls:'err'}, Date.now());
});

function resize(){
  const w = stage.clientWidth, h = stage.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h); labelRenderer.setSize(w, h);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  terapkanPR();     // kamera tidak disentuh (sama dengan preview: sudut awal tidak bergantung ukuran layar)
}
new ResizeObserver(resize).observe(stage); resize();

/* ================= loop ================= */
const tmpV = new THREE.Vector3(), tmpP = V3(), tmpT = V3();
let far = null, loopOn = false, bootAt = 0, fpsT0 = 0, fpsPrev = 0, fpsN = 0, lambat = 0, waktuT = 0, lastMs = 0;
/* Hemat suhu: gambar dibatasi SET.fps (bawaan 30). Bila "Hemat saat diam" nyala dan tidak ada yang bekerja, tidak ada kabar baru,
   dan kamera tidak bergerak/disentuh → turun ke FPS_DIAM. Tab tersembunyi sudah berhenti sendiri (requestAnimationFrame). */
function ramaikan(dtk = 10){ ramaiSampai = Math.max(ramaiSampai, performance.now() + dtk * 1000); }
function hitungSasaranFPS(ms){
  const maks = SET.fps === '60' ? 60 : SET.fps === 'maks' ? 0 : 30;   // 0 = tanpa batas (ikut layar)
  if (!SET.diam) return maks;
  const ramai = ms < ramaiSampai || camAnim || follow || tur || controls.autoRotate || TEKAN.size || PAD_TEKAN.size ||
    boss.isWorking || state.list.some(m => m.isWorking);
  return ramai ? maks : FPS_DIAM;
}
controls.addEventListener('start', () => ramaikan(3));
controls.addEventListener('change', () => ramaikan(3));
// Pengaman performa: bila rata-rata FPS < 30 (atau ±2/3 batas FPS) dua kali berturut-turut (±6 detik) di HD/Ultra,
// resolusi turun setingkat (0,5×). Tidak dinilai saat mode diam (FPS rendah memang disengaja).
function jagaFPS(){
  const ms = performance.now();
  if (ms - fpsPrev > 500){ fpsT0 = ms; fpsN = 0; }      // tab tersembunyi / jeda: mulai hitung ulang
  fpsPrev = ms; fpsN++;
  if (ms - fpsT0 < 3000) return;
  FPS = fpsN * 1000 / (ms - fpsT0); fpsT0 = ms; fpsN = 0;
  const ambang = fpsSasaran ? Math.min(30, fpsSasaran * .66) : 30;
  if ((SET.kualitas === 'hd' || SET.kualitas === 'ultra') && NOW - bootAt > 8 && fpsSasaran !== FPS_DIAM && FPS < ambang){
    if (++lambat >= 2){
      lambat = 0; const pr0 = prAktif;
      if (pr0 > 1.01){
        turunPR += .5; terapkanPR();
        addLog({icon:'⚙️', who:'Kantor', text:`Grafis tersendat (±${Math.round(FPS)} fps). Resolusi render diturunkan dari ${pr0.toFixed(2)}× ke ${prAktif.toFixed(2)}×. Pilih kualitas lagi di Pengaturan untuk mencoba ulang.`}, Date.now());
      }
    }
  } else lambat = 0;
  if (!$('#pSet').hidden) isiInfoKualitas();
}
/* langkahLantai = salinan preview.html. Bagian kamera (titik pandang ikut tinggi lantai) hanya saat kamera tidak sedang
   dipindah/ikut orang dan sudutnya "sejajar lantai" (awal, Reset, Tampak atas, sudut sisi, atau setelah ganti lantai). */
function langkahLantai(dt){
  const L2 = R.lantai2, k = 1 - Math.exp(-dt * 5);
  L2.position.y += (targetY(mode) - L2.position.y) * k;
  L2.visible = !(mode === 'l1' && L2.position.y > R.Y2 + 11);
  R.kolom.visible = mode === 'l2' && Math.abs(L2.position.y - R.Y2) < .08;
  const gap = L2.position.y - R.Y2;
  R.hantu.visible = mode === 'terpisah' && gap > .3; R.hantu.scale.y = Math.max(.01, gap); R.hantu.position.y = R.Y2 + gap / 2;
  if (!ikutLantai || camAnim || follow || tur) return;
  const ty = tinggiPandang(mode), dy = (ty - controls.target.y) * k;
  controls.target.y += dy; camera.position.y += dy;
}
const tinggiPandang = m => baseY + (m === 'l1' ? .2 : m === 'l2' ? R.Y2 - .3 : (R.Y2 + R.GAP) * .3);
function aturLantai(m, beriTahu){
  if (!['l1', 'l2', 'terpisah'].includes(m) || !R) return;
  mode = m; ikutLantai = true;
  for (const b of document.querySelectorAll('#lantai .bb')) b.setAttribute('aria-pressed', b.dataset.m === m ? 'true' : 'false');
  if (beriTahu) catatan({l1:'🏢 Lantai 1', l2:'🏢 Lantai 2', terpisah:'🏢 Kedua lantai terpisah'}[m]);
  for (const r of RUANG) if (r.tagObj) r.tagObj.visible = r.lantai === 2 || m !== 'l2';
}
// pilihan lantai dari pengguna menang: bila orang yang diikuti ada di lantai yang disembunyikan, kamera dilepas
function pilihLantai(m, beriTahu){
  if (follow && ((follow.lantai === 2 && m === 'l1') || (follow.lantai === 1 && m === 'l2'))){ follow = null; ikutMode = 'ikuti'; catatan('Kamera dilepas'); renderDetail(); }
  aturLantai(m, beriTahu);
}
for (const b of document.querySelectorAll('#lantai .bb')) b.onclick = () => pilihLantai(b.dataset.m);
// lantai orang/ruang harus tampak: Lantai 1 ↔ Lantai 2 bila perlu (mode Terpisah menampilkan keduanya)
function pastikanLantai(n){ if (n === 2 && mode === 'l1') aturLantai('l2', true); else if (n === 1 && mode === 'l2') aturLantai('l1', true); }
// Mode Terpisah: label CSS2D tidak ikut uji kedalaman, jadi label orang & ruang lantai 1 yang terhalang pelat lantai 2
// (dilihat dari kamera) disembunyikan. Raycast ke 4 pelat lantai 2, 10×/detik.
let cekTutupAt = 0;
const _rp = new THREE.Vector3(), _rd = new THREE.Vector3(), rayTutup = new THREE.Raycaster();
function tertutupPelat(o){
  o.getWorldPosition(_rp); _rd.copy(_rp).sub(camera.position); const d = _rd.length(); if (d < 1e-3) return false;
  rayTutup.set(camera.position, _rd.divideScalar(d)); rayTutup.far = d;
  return rayTutup.intersectObjects(PENGHALANG, false).length > 0;
}
function cekTertutup(){
  const aktif = mode === 'terpisah' && terlihat(R.lantai2);
  for (const a of [boss, reception, ...state.list]) a.tertutup = aktif && a.lantai === 1 && tertutupPelat(a.label);
  for (const r of RUANG) if (r.tagObj) r.tertutup = aktif && r.lantai === 1 && tertutupPelat(r.tagObj);
}
const JAM_FMT = new Intl.DateTimeFormat('id-ID', {weekday:'long', day:'numeric', month:'short', hour:'2-digit', minute:'2-digit', second:'2-digit'});
function isiJam(){ $('#jam').textContent = JAM_FMT.format(new Date()); }
isiJam(); setInterval(isiJam, 1000);
let gambarTs = 0;   // waktu frame rAF terakhir yang digambar (pembatas FPS memakai waktu frame, lebih stabil dari performance.now)
function loop(tsRaf){
  const ms = performance.now(), sas = hitungSasaranFPS(ms), ts = tsRaf || ms;
  if (sas !== fpsSasaran){ fpsSasaran = sas; fpsT0 = ms; fpsN = 0; lambat = 0; }   // ganti batas → ukur FPS dari awal
  if (sas && gambarTs && ts - gambarTs < 850 / sas){ requestAnimationFrame(loop); return; }   // belum waktunya menggambar (85% selang: tahan jitter)
  gambarTs = ts;
  const dt = Math.min((ms - (lastMs || ms)) / 1000, .12); lastMs = ms; waktuT += dt;
  const t = waktuT;
  NOW = ms / 1000;
  R.tick(t, dt);                     // animasi layar, LED, dan SEMUA karakter (desain)
  langkahLantai(dt);
  boss.update(dt, t); reception.update(dt, t);
  for (let i = 0; i < state.list.length; i++) state.list[i].update(dt, t);
  for (const g of OBROL) g.tick();
  // ruang: label disembunyikan bila lantainya tidak tampak / tertutup pelat lantai 2
  if (ms >= cekTutupAt){ cekTutupAt = ms + 100; cekTertutup(); }
  for (const r of RUANG) if (r.tagObj){ const v = lantaiTampak(r.lantai) && !r.tertutup; if (r.tagObj.visible !== v) r.tagObj.visible = v; }
  gerakKamera(dt);
  if (camAnim){
    camAnim.s = Math.min(1, camAnim.s + dt * (camAnim.laju || 1.2) * SET.kecepatan); const e = 1 - Math.pow(1 - camAnim.s, 3);
    camera.position.lerpVectors(camAnim.p0, camAnim.p1, e); controls.target.lerpVectors(camAnim.t0, camAnim.t1, e);
    if (camAnim.s >= 1) camAnim = null;
  } else if (follow){
    pastikanLantai(follow.lantai);
    if (ikutMode === 'bahu'){
      posBahu(follow, tmpP, tmpT); const k = RM ? 1 : 1 - Math.exp(-dt * 4);
      camera.position.lerp(tmpP, k); controls.target.lerp(tmpT, k);
    } else {
      follow.P.root.getWorldPosition(tmpV); tmpV.y += .8;
      const d = tmpV.sub(controls.target).multiplyScalar(Math.min(1, dt * 3));
      controls.target.add(d); camera.position.add(d);
    }
  } else if (tur){
    if (!tur.tahan) tur.tahan = NOW + (RM ? 6 : 4.5);
    if (NOW >= tur.tahan) lanjutTur(); else if (!RM) orbitY(dt * .12 * SET.kecepatan);
  }
  controls.autoRotate = SET.putar && !tur && !camAnim && !(follow && ikutMode === 'bahu') && !TEKAN.size && !PAD_TEKAN.size;
  controls.update();
  // batas kamera: titik pandang tidak keluar jauh dari kantor
  if (BOX){
    const tg = controls.target, m = 6;
    const cx = THREE.MathUtils.clamp(tg.x, BOX.min.x - m, BOX.max.x + m), cy = THREE.MathUtils.clamp(tg.y, BOX.min.y - .5, BOX.max.y + 2), cz = THREE.MathUtils.clamp(tg.z, BOX.min.z - m, BOX.max.z + m);
    if (cx !== tg.x || cy !== tg.y || cz !== tg.z){ camera.position.x += cx - tg.x; camera.position.y += cy - tg.y; camera.position.z += cz - tg.z; tg.set(cx, cy, cz); }
  }
  // near = jarak/100 seperti preview (di sudut awal persis sama); far tetap
  const dd = camera.position.distanceTo(controls.target);
  const nn = Math.max(dd / 100, .01);
  if (Math.abs(nn - camera.near) / camera.near > .15){ camera.near = nn; camera.updateProjectionMatrix(); }
  const isFar = dd > 30;
  if (isFar !== far){ far = isFar; labelRenderer.domElement.classList.toggle('far', far); }
  // HD dari jauh: resolusi dinaikkan saat kamera jauh (histeresis 28–32 m supaya tidak bolak-balik)
  const jb = jauhPR ? dd > 28 : dd > 32;
  if (jb !== jauhPR){ jauhPR = jb; terapkanPR(); }
  updateLingkungan(dt, t);
  jagaFPS();
  renderer.render(scene, camera); labelRenderer.render(scene, camera);
  renderPratinjau();
  requestAnimationFrame(loop);
}

/* ================= bangun kantor ================= */
// label mengambang di atas ruang (klik → terbang ke ruang)
function bangunLabelRuang(){
  for (const r of RUANG){
    if (!r.label) continue;
    const el = document.createElement('div'); el.className = 'room-tag'; el.style.setProperty('--c', warnaRuang(r));
    el.innerHTML = `<span class="ri" aria-hidden="true">${r.ikon}</span><span>${esc(r.nama)}</span><span class="rd" aria-hidden="true"></span><span class="rc"></span>`;
    el.title = 'Lihat ' + r.nama; el.addEventListener('click', () => flyToRuang(r));
    const o = new THREE.CSS2DObject(el); o.position.set(r.label[0], 2.5, r.label[1]); grupLantai(r.lantai).add(o);
    r.tagEl = el; r.tagObj = o; r.countEl = el.querySelector('.rc'); r.divEl = el.querySelector('.rd');
  }
}
function warnaRuang(r){ if (r.id === 'pimpinan') return '#c9a227'; const dv = Object.values(DIVISI).find(v => v.ruang === r.id); return dv ? dv.warna : TEMA.cadangan; }
// ikon divisi yang berkantor di ruang itu (dari meja anggotanya)
function isiDivisiRuang(){
  const per = new Map();
  for (const t of state.teamList) for (const m of t.members){ const r = ruangKursi(m.desk); if (!r) continue; const s = per.get(r) || new Set(); s.add(t.icon); per.set(r, s); }
  for (const r of RUANG){
    if (!r.tagEl) continue;
    const s = per.get(r), teks = s ? [...s].join('') : '';
    if (r.divEl.textContent !== teks) r.divEl.textContent = teks;
    const umum = !s && r.id !== 'pimpinan';
    r.tagEl.classList.toggle('umum', umum);
    if (!umum) r.tagEl.style.setProperty('--c', warnaRuang(r));
  }
}
async function build(list){
  await LOGO_READY;
  // font dimuat dulu supaya tulisan di lantai & layar desain memakai Plus Jakarta Sans (maks 2,5 dtk; tanpa internet tetap lanjut)
  try { await Promise.race([Promise.all(['800 72px "Plus Jakarta Sans"', '700 22px "Plus Jakarta Sans"', '600 18px "Plus Jakarta Sans"'].map(f => document.fonts.load(f))), sleep(2500)]); } catch (e){}
  bangunAdegan(); materialDesain();
  bangunLingkungan(); buildFlow(); bangunLabelRuang(); terapkanLingkungan();
  for (const a of list || []){
    if (!a || typeof a.name !== 'string' || !a.name || a.name.length > 80) continue;
    state.agentDesc.set(a.name, typeof a.description === 'string' ? a.description : ''); state.agentInfo.set(a.name, bersihInfoAgen(a));
  }
  // Kepala = karakter desain "pimpinan" di kursi pimpinan; Resepsionis = karakter desain (figuran, tanpa jalan)
  const Pk = R.orang.pimpinan, Pr = R.orang.resepsionis;
  boss = new Actor({boss:true, name:'Claude', slot:'kepala', P:Pk, kursi:Pk.kursi, bawaan:LOOK_DESAIN.pimpinan});
  reception = new Actor({npc:true, name:'Resepsionis', slot:'resepsionis', P:Pr, kursi:null, bawaan:LOOK_DESAIN.resepsionis});
  for (const a of [boss, reception]){ const e = PEG.orang[a.slot]; if (e && e.look) a.dandani(e.look); }
  infoLayar(boss.desk);
  const bossGrp = {ruang:RUANG_BY.pimpinan, label:'Ruang Pimpinan', icon:'👑', color:'#c9a227', noTag:true}; panelTeam(bossGrp); panelMember(boss, bossGrp);
  bossGrp.cntEl.textContent = 'Claude utama';
  const lobiGrp = {ruang:RUANG_BY.lobi, label:RUANG_BY.lobi.nama, icon:RUANG_BY.lobi.ikon, color:'#94a3b8', noTag:true}; panelTeam(lobiGrp); panelMember(reception, lobiGrp);
  lobiGrp.cntEl.textContent = 'Skill · bukan sub agent';
  // divisi: 3 anggota tetap = karakter desain yang cocok + karakter baru di kursi kosong (PETA_DIVISI)
  for (const [k, dv] of Object.entries(DIVISI)){
    const nm = 'divisi-' + k;
    const t = new Team('div:' + k, nm, {div:k, ruang:dv.ruang, label:'Divisi ' + dv.nama, short:dv.nama, icon:dv.ikon, color:dv.warna, desc:state.agentDesc.get(nm)});
    for (const p of PETA_DIVISI[k] || []){
      const P = p.orang && R.orang[p.orang] && !DESAIN_DIPAKAI.has(p.orang) ? R.orang[p.orang] : null;
      const kursi = P ? P.kursi : (KURSI_BY[p.kursi] && !KURSI_BY[p.kursi].pemilik ? KURSI_BY[p.kursi] : null);
      t.addMember({P, kursi});
    }
    while (t.members.length < ANGGOTA_PER_DIVISI) t.addMember({});
  }
  isiDivisiRuang();
  BUILT = true; bootAt = NOW;
  computeHome(); camera.position.copy(HOME_CAM); controls.target.copy(HOME_TGT); controls.update();
  isiKetSkill(); bangunKeterangan();
  if (!pegEl.hidden) bangunPegawai();
  renderList(true);
  if (PEG.lookLama){
    addLog({icon:'👕', who:'Kantor', text:`${PEG.lookLama} penampilan pegawai tersimpan berformat lama (sebelum desain v2) diabaikan; nama tetap dipakai. Atur ulang lewat tab Pegawai.`}, Date.now());
    simpanPeg(); PEG.lookLama = 0;      // simpan ulang sebagai versi 2 (nama saja) supaya pesan ini hanya sekali
  }
  if (!loopOn){ loopOn = true; lastMs = performance.now(); loop(); }
}

function setMode(m, msg){
  state.mode = m;
  const p = $('#pill'); p.className = m === 'live' ? 'live' : m === 'demo' ? 'demo' : m === 'off' ? 'off' : '';
  p.querySelector('span').textContent = msg || {live:window.KANTOR_HP ? 'Live · dari Mac' : 'Live · terhubung ke Claude Code', demo:'Mode demo', off:window.KANTOR_HP ? 'Mac tidak tersambung' : 'Terputus · jalankan server.js', connecting:'Menghubungkan…'}[m];
}
const params = new URLSearchParams(location.search);
// Kunci akses = SATU sumber untuk semua fetch & EventSource (pintu HP lewat Tailscale selalu wajib kunci untuk data).
// ?kunci= di URL → disimpan di localStorage lalu dihapus dari alamat (parameter lain tetap), supaya ikon/aplikasi terpasang
// dan muat ulang tanpa kunci di URL tetap jalan. Tanpa ?kunci= → kunci tersimpan. 401 → kunciDitolak() menghapus kunci tersimpan.
// Kunci tidak pernah ditampilkan di layar atau dicatat ke konsol.
const KUNCI_AKSES = 'padev-kantor-kunci';
const KUNCI = (() => {
  const dariUrl = params.get('kunci') || '';
  if (dariUrl) try { localStorage.setItem(KUNCI_AKSES, dariUrl); } catch (e){}
  if (params.has('kunci')){
    try {   // hanya bagian kunci= yang dibuang; parameter lain tetap persis seperti tertulis
      const sisa = location.search.slice(1).split('&').filter(b => b && decodeURIComponent(b.split('=')[0].replace(/\+/g, ' ')) !== 'kunci').join('&');
      history.replaceState(history.state, '', location.pathname + (sisa ? '?' + sisa : '') + location.hash);
    } catch (e){}
  }
  if (dariUrl) return dariUrl;
  try { return localStorage.getItem(KUNCI_AKSES) || ''; } catch (e){ return ''; }
})();
function kunciDitolak(){ try { localStorage.removeItem(KUNCI_AKSES); } catch (e){} }
const PESAN_KUNCI = 'Kunci salah atau kedaluwarsa · buka sekali lagi lewat link lengkap berisi ?kunci=';
// ?server= hanya diterima untuk origin loopback (http://localhost|127.0.0.1|[::1] port apa pun); selain itu diabaikan.
// Bila halaman dibuka lewat server (http), hanya origin yang sama (CSP connect-src 'self').
function originLoopback(v){
  try {
    const u = new URL(v);
    if (u.protocol === 'http:' && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(u.hostname) && !u.username && !u.password && u.pathname === '/' && !u.search && !u.hash
      && (!location.protocol.startsWith('http') || u.origin === location.origin)) return u.origin;
  } catch (e){}
  return null;
}
const SERVER_DITOLAK = !!params.get('server') && !originLoopback(params.get('server'));
if (SERVER_DITOLAK) console.warn('?server= diabaikan: hanya http://localhost, 127.0.0.1, atau [::1] (lewat server: origin yang sama) yang diizinkan.');
// Server = origin yang sama bila halaman dibuka dari laptop (loopback) atau lewat `tailscale serve` (https://<mesin>.<tailnet>.ts.net,
// jaringan pribadi owner untuk dibuka dari HP). Origin lain (mis. hosting demo publik) → null → mode demo.
function serverBase(){
  if (window.KANTOR_HP) return '';   // APK: /state & /events dari jembatan.js
  if (params.get('server') && !SERVER_DITOLAK) return originLoopback(params.get('server'));
  if (location.protocol.startsWith('http') && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) return '';
  if (location.protocol === 'https:' && /^[a-z0-9-]+\.[a-z0-9-]+\.ts\.net$/i.test(location.hostname)) return '';
  return null;
}
async function connect(){
  const base = serverBase();
  const qs = KUNCI ? '?kunci=' + encodeURIComponent(KUNCI) : '';
  let s = null;
  if (base !== null && !params.has('demo')){
    try {
      const r = await fetch(base + '/state' + qs);
      if (r.status === 401){ kunciDitolak(); await build([]); setMode('off', 'Kunci salah atau kedaluwarsa · buka lagi lewat link lengkap'); return; }
      if (r.ok) s = await r.json();
    } catch (e){ s = null; }
  }
  const catatServer = () => { if (SERVER_DITOLAK) addLog({icon:'⚠️', who:'Kantor', text:'Parameter ?server= diabaikan: hanya alamat localhost, 127.0.0.1, atau [::1] (lewat server: alamat yang sama) yang diizinkan.'}, Date.now()); };
  if (!s){ await build(DEMO); catatServer(); if (!params.has('diam')) startDemo(); else setMode('demo', 'Mode demo (berhenti)'); return; }
  if (window.KANTOR_HP) s.agents = DEMO;   // APK: data skill/alat divisi = salinan file agent (DEMO)
  await build(s.agents || []);
  catatServer();
  (s.recent || []).slice(-40).forEach(ev => terima(ev, false));
  addLog({icon:'🏢', who:'Kantor', text:(s.agents || []).length ? `${s.agents.length} sub agent terdaftar dimuat dari folder agents` : 'Belum ada file sub agent ditemukan. Tim non-divisi akan muncul di meja kosong saat mulai bekerja.'}, Date.now());
  bukaSiaran(base, qs);
}

// Siaran live tahan putus (HP: layar mati, pindah aplikasi, ganti Wi-Fi/data):
// - tersambung lagi → ambil /state, kabar yang terlewat diputar (≤15 menit: digerakkan, lebih lama: hanya dicatat);
// - EventSource CLOSED (mis. 502 saat Tailscale di HP belum bangun) → sambung ulang sendiri, jeda 3 → 30 dtk;
// - halaman tampil lagi setelah tersembunyi ≥20 dtk → sambungan lama bisa mati diam-diam, jadi dibuka ulang.
const sudahDiterima = new Set();
function terima(ev, live){
  const k = [ev.ts, ev.session, ev.agentId, ev.kind, ev.tool, ev.detail].join('|');
  if (sudahDiterima.has(k)) return;
  sudahDiterima.add(k);
  if (sudahDiterima.size > 400) sudahDiterima.delete(sudahDiterima.values().next().value);
  handle(ev, live);
}
let siaran = null, siaranJeda = 3000, siaranUlang = null, sembunyiSejak = 0;
function bukaSiaran(base, qs){
  if (siaran) siaran.close();
  clearTimeout(siaranUlang);
  let pertama = !siaran;
  const es = siaran = new EventSource(base + '/events' + qs);
  es.onopen = () => {
    state.esOpen = true; siaranJeda = 3000; if (!state.demo) setMode('live');
    if (!pertama) sinkronUlang(base, qs);
    pertama = false;
  };
  es.onmessage = m => { try { terima(JSON.parse(m.data), true); } catch (e){ console.warn(e); } };
  es.onerror = () => {
    state.esOpen = false; if (!state.demo) setMode('off');
    if (es.readyState === EventSource.CLOSED && es === siaran){
      siaranUlang = setTimeout(() => bukaSiaran(base, qs), siaranJeda);
      siaranJeda = Math.min(siaranJeda * 2, 30000);
    }
  };
  document.onvisibilitychange = () => {
    if (document.hidden){ sembunyiSejak = Date.now(); return; }
    if (es === siaran && (es.readyState === EventSource.CLOSED || Date.now() - sembunyiSejak >= 20000)) bukaSiaran(base, qs);
  };
}
async function sinkronUlang(base, qs){
  try {
    const r = await fetch(base + '/state' + qs);
    if (r.status === 401){ kunciDitolak(); if (siaran) siaran.close(); state.esOpen = false; setMode('off', PESAN_KUNCI); return; }
    if (!r.ok) return;
    const s = await r.json();
    (s.recent || []).slice(-40).forEach(ev => terima(ev, Date.now() - (ev.ts || 0) < 900000));
  } catch (e){}
}

// Mode demo: data agent sama dengan file agent nyata (model, skill wajib/opsional, alat) supaya tampilan skill sama dengan mode live.
// pakai = alat yang dipakai acak dalam simulasi.
const PW = n => n.map(x => 'mcp__playwright__browser_' + x);
const PW_DASAR = ['navigate', 'snapshot', 'take_screenshot', 'resize', 'click', 'type', 'fill_form', 'select_option', 'press_key', 'wait_for'];
const DEMO = [
  {name:'divisi-analis', model:'opus', skills:['pa-dev', 'audit', 'graphify'], skillsOpsional:['codebase-onboarding', 'inherit-legacy-style', 'deep-research', 'handover'],
    tools:['Read', 'Grep', 'Glob', 'Bash', 'Write', 'Skill', 'WebSearch', 'WebFetch'],
    description:'Analis sistem PA DEV. Pakai untuk memahami/memetakan kode, audit, analisis akar masalah, menyusun kebutuhan (SRS), model ancaman awal bersama divisi-security, desain data/ERD, dan rencana kerja SEBELUM kode diubah. Tidak mengubah kode; hanya boleh menulis dokumen analisis di docs/sdlc/.',
    pakai:['Read', 'Grep', 'Glob', 'Write'], task:['Susun SRS modul cuti', 'Petakan alur login lama', 'Rancang ERD laporan']},
  {name:'divisi-programmer', model:'opus', skills:['pa-dev', 'implement', 'debug'],
    skillsOpsional:['padev-secure-baseline', 'padev-security-fix', 'access-scope', 'auth-shield', 'auth-jwt', 'auth-oidc', 'user-management', 'ci-user-management', 'node-user-management', 'docker', 'release', 'padev-publish', 'handover', 'simplify', 'full-output-enforcement', 'claude-api', 'pdf', 'docx', 'xlsx', 'pptx'],
    tools:['Read', 'Grep', 'Glob', 'Bash', 'Edit', 'Write', 'Skill'],
    description:'Programmer PA DEV. Pakai untuk mengerjakan perubahan kode yang SUDAH disetujui owner — fitur, migrasi DB, controller/model, perbaikan bug, dan perbaikan temuan keamanan yang disetujui. Backend dan logika; tampilan/style diserahkan ke divisi-ui.',
    pakai:['Read', 'Edit', 'Bash', 'Grep', 'Write'], task:['Perbaiki bug halaman login', 'Tambah endpoint ekspor', 'Migrasi tabel pegawai']},
  {name:'divisi-ui', model:'opus', skills:['ui-engineering'],
    skillsOpsional:['design-taste-frontend', 'design-taste-frontend-v1', 'high-end-visual-design', 'minimalist-ui', 'industrial-brutalist-ui', 'redesign-existing-projects', 'stitch-design-taste', 'ui-ux-pro-max', 'gpt-taste', 'design-dna', 'design-audit', 'emil-design-eng', 'apple-design', 'pick-ui-library', 'prototype', 'brandkit', 'paint', 'cast', 'admin-um-ui', 'desktop-principles', 'mobile-principles', 'image-to-code', 'imagegen-frontend-web', 'imagegen-frontend-mobile', 'figma:figma-use', 'figma:figma-design-to-code', 'figma:figma-generate-design', 'figma:figma-generate-library', 'figma:figma-code-connect', 'animate', 'motion-design', 'motion-principles', 'css-native', 'framer-motion', 'gsap', 'find-animation-opportunities', 'improve-animations', 'review-animations', 'animation-vocabulary', 'canvas-generative'],
    tools:['Read', 'Grep', 'Glob', 'Bash', 'Edit', 'Write', 'Skill', 'WebFetch', ...PW(['navigate', 'snapshot', 'take_screenshot', 'resize', 'click', 'type', 'fill_form', 'hover', 'press_key', 'console_messages', 'evaluate', 'close']),
      'mcp__claude_ai_Figma__get_design_context', 'mcp__claude_ai_Figma__get_screenshot', 'mcp__claude_ai_Figma__get_metadata', 'mcp__claude_ai_Figma__get_variable_defs', 'mcp__claude_ai_Figma__search_design_system', 'mcp__claude_ai_Figma__use_figma'],
    description:'Divisi UI/UX, style, dan desain PA DEV. Pakai untuk merancang alur layar dan wireframe, membangun atau merapikan view/CSS/JS tampilan, responsif, aksesibilitas, animasi, dan desain dari Figma/gambar. Selalu memakai design system proyek yang sudah ada.',
    pakai:['Read', 'Edit', 'Write', 'mcp__playwright__browser_take_screenshot'], task:['Rapikan form cuti', 'Buat tampilan dasbor baru', 'Perbaiki tampilan mobile']},
  {name:'divisi-qa', model:'sonnet', skills:['run-app', 'run'], skillsOpsional:['debug', 'built-in-browser', 'chrome-browser', 'computer-use', 'review-animations'],
    tools:['Read', 'Grep', 'Glob', 'Bash', 'Write', 'Skill', ...PW([...PW_DASAR, 'console_messages', 'network_requests', 'close'])],
    description:'Divisi QA/penguji PA DEV. Pakai setelah ada perubahan kode atau sebelum rilis untuk menjalankan tes (PHPUnit/npm), menjalankan aplikasi dan mengecek alur di browser, mencocokkan kriteria terima, dan melaporkan yang gagal. Tidak pernah memperbaiki kode.',
    pakai:['Bash', 'Read', 'mcp__playwright__browser_navigate', 'Grep'], task:['Uji alur login', 'Jalankan tes regresi', 'Cek form di browser']},
  {name:'divisi-reviewer', model:'opus', skills:['pa-dev', 'review'], skillsOpsional:['inherit-legacy-style'], tools:['Read', 'Grep', 'Glob', 'Bash', 'Write', 'Skill'],
    description:'Reviewer kode independen PA DEV. Pakai setelah divisi-programmer atau divisi-ui selesai mengubah kode (per modul atau per diff), sebelum divisi-qa. Menilai patch terhadap PA DEV Framework dan STANDAR_KODE.md. Hanya MENILAI dan MELAPORKAN.',
    pakai:['Read', 'Grep', 'Glob', 'Bash'], task:['Review patch modul cuti', 'Review perubahan controller']},
  {name:'divisi-security', model:'opus', skills:[], skillsOpsional:['padev-security-audit', 'padev-secure-baseline', 'security-review', 'review', 'code-review', 'access-scope', 'auth-shield', 'auth-jwt', 'auth-oidc'],
    tools:['Read', 'Grep', 'Glob', 'Bash', 'Write', 'Skill', 'WebSearch', 'WebFetch'],
    description:'Auditor keamanan PA DEV. Pakai untuk model ancaman (STRIDE), review keamanan diff/modul, audit keamanan penuh sebelum rilis (OWASP ASVS L2 / Top 10), audit dependensi, dan verifikasi ulang setelah perbaikan. Hanya MENEMUKAN dan MELAPORKAN; tidak pernah memperbaiki.',
    pakai:['Grep', 'Read', 'Bash', 'WebSearch'], task:['Audit upload file', 'Cek celah SQL injection']},
  {name:'divisi-dokumentasi', model:'sonnet', skills:[], skillsOpsional:['docx', 'pdf'], tools:['Read', 'Grep', 'Glob', 'Bash', 'Write', 'Edit', 'Skill', ...PW([...PW_DASAR, 'close'])],
    description:'Penulis teknis PA DEV. Pakai menjelang rilis/serah terima atau saat owner minta dokumen untuk pengguna/klien — manual pengguna per peran, manual admin, dan dokumen serah terima (termasuk ekspor Word/PDF bila diminta). Tidak mengubah kode.',
    pakai:['Read', 'Write', 'Edit', 'Skill'], task:['Tulis manual admin', 'Susun dokumen serah terima']},
  {name:'divisi-devops', model:'opus', skills:[], skillsOpsional:[], tools:['Read', 'Grep', 'Glob', 'Bash', 'Edit', 'Write', 'Skill'],
    description:'DevOps PA DEV. Pakai untuk cek kesehatan server, membaca log container, analisis insiden produksi, menyusun runbook deploy/rollback, “pasca-pull” setelah owner menjalankan git pull di server, dan menjaga peta aplikasi. Dari laptop hanya MEMBACA server.',
    pakai:['Bash', 'Read', 'Bash', 'WebFetch'], task:['Cek log container', 'Siapkan runbook deploy']},
];
const SUPPORT_DEMO = [
  {name:'general-purpose', pakai:['Read', 'Grep', 'Glob', 'WebSearch'], task:['Cari referensi pustaka', 'Rangkum dokumentasi']},
  {name:'Explore', pakai:['Grep', 'Glob', 'Read'], task:['Jelajahi struktur repo', 'Cari file konfigurasi']},
];
const D = {
  file:['LoginController.php', 'CutiModel.php', 'app.css', 'form-cuti.php', 'routes.php', 'README.md', 'manual-admin.md', 'docker-compose.yml', 'test_login.php'],
  cmd:['php spark test', 'npm run build', 'git status', 'docker logs app', 'composer install'],
  q:['OWASP upload file', 'CodeIgniter 4 validation', 'best practice runbook'],
  url:['codeigniter.com/user_guide', 'owasp.org/cheatsheets', 'docs.docker.com'],
  pat:['TODO', 'function login', '$_POST', '*.php'],
  prompt:['Tolong perbaiki login dan uji ulang', 'Siapkan rilis modul cuti minggu ini', 'Audit keamanan sebelum deploy', 'Rapikan tampilan dasbor dan dokumentasinya'],
  done:['Selesai, semua tes lulus', 'Patch sudah siap direview', 'Laporan audit sudah disusun', 'Dokumen sudah diperbarui', 'Tampilan sudah rapi di 3 ukuran layar', 'Runbook deploy sudah siap'],
};
function demoDetail(tool, ag){
  switch (tool){
    case 'Read': case 'Write': case 'Edit': return rnd(D.file);
    case 'Bash': return rnd(D.cmd);
    case 'WebSearch': return rnd(D.q);
    case 'WebFetch': return rnd(D.url);
    case 'Grep': case 'Glob': return rnd(D.pat);
    case 'Skill': { const s = [...((ag && ag.skills) || []), ...((ag && ag.skillsOpsional) || []).slice(0, 4)]; return s.length ? rnd(s) : 'docx'; }
  }
  return '';
}
let demoRun = 0, demoSeq = 0;
function emit(ev){ ev.ts = Date.now(); handle(ev); }
async function demoJob(ag, run, delay){
  await sleep(delay); if (run !== demoRun) return;
  const id = 'demo-' + (++demoSeq);
  emit({kind:'tool', tool:'Agent', sub:ag.name, detail:rnd(ag.task)});
  await sleep(4500 + Math.random() * 3000); if (run !== demoRun) return;    // waktu untuk dipanggil & menerima brief
  emit({kind:'agent_start', who:ag.name, agentId:id});
  const m = state.byAgent.get(id);
  const steps = 3 + Math.floor(Math.random() * 4);
  const pakaiSkill = (ag.skills && ag.skills.length) || (ag.skillsOpsional && ag.skillsOpsional.length);
  // Anggota mungkin masih berjalan (brief di lantai 2 lalu kembali ke mejanya). Demo terus memakai alat sampai ia sempat
  // bekerja di mejanya selama `steps` langkah, supaya layar berwarna & gerakan mengetik terlihat (maks ±3 menit).
  for (let i = 0, diMeja = 0; i < 60 && diMeja < steps; i++){
    await sleep(1800 + Math.random() * 2600); if (run !== demoRun) return;
    // langkah pertama sering memuat skill (seperti agent nyata), sisanya alat yang biasa dipakai divisi
    const tool = pakaiSkill && (i === 0 ? Math.random() < .75 : Math.random() < .1) ? 'Skill' : rnd(ag.pakai);
    if (tool !== 'Skill' && Math.random() < .08) emit({kind:'tool_fail', who:ag.name, agentId:id, tool, text:'file tidak ditemukan'});
    else emit({kind:'tool', who:ag.name, agentId:id, tool, detail:demoDetail(tool, ag)});
    if (!m || (m.mode === 'work' && m.at === m.desk && !m.walking)) diMeja++;
  }
  await sleep(1500); if (run !== demoRun) return;
  emit({kind:'agent_stop', who:ag.name, agentId:id, text:rnd(D.done)});
}
async function demoLoop(run){
  await sleep(800);
  emit({kind:'session', text:'demo'});
  while (run === demoRun){
    await sleep(1500); if (run !== demoRun) return;
    emit({kind:'prompt', text:rnd(D.prompt)});
    await sleep(4200); if (run !== demoRun) return;
    emit({kind:'tool', tool:'TodoWrite', detail:'rencana kerja'});
    await sleep(1600); if (run !== demoRun) return;
    // urutan mengikuti alur kerja: ambil 2–3 tahap berurutan dari ALUR
    const s0 = Math.floor(Math.random() * (ALUR.length - 1));
    const team = ALUR.slice(s0, s0 + 2 + Math.floor(Math.random() * 2)).flat().map(k => DEMO.find(d => d.name === 'divisi-' + k)).filter(Boolean);
    if (Math.random() < .45) team.push(team[0]);                     // 2 tugas paralel untuk divisi yang sama
    if (Math.random() < .2) team.push(rnd(SUPPORT_DEMO));            // tipe non-divisi → Tim Pendukung (meja kosong)
    const jobs = team.map((ag, i) => demoJob(ag, run, i * 1300));
    if (Math.random() < .4){ await sleep(5000); if (run !== demoRun) return; emit({kind:'notify', type:'permission_prompt', text:'Izinkan menjalankan: php spark test?'}); await sleep(4000); if (run !== demoRun) return; emit({kind:'tool', tool:'Bash', detail:'php spark test'}); }
    await Promise.all(jobs); if (run !== demoRun) return;
    await sleep(3500);
    emit({kind:'tool', tool:'Write', detail:'hasil-akhir.md'});
    await sleep(2500);
    emit({kind:'stop', text:'Semua divisi sudah selesai, hasil ada di hasil-akhir.md'});
    await sleep(9000);
  }
}
function startDemo(){ state.demo = true; demoRun++; setDemoBtn(true); setMode('demo'); demoLoop(demoRun); }
function stopDemo(){
  state.demo = false; demoRun++; setDemoBtn(false);
  for (const m of state.list.slice()) if (m.job && (!m.job.agentId || String(m.job.agentId).startsWith('demo-'))){ m.release(); if (m.temp) m.afterReport(); else m.rest(); }
  boss.waiting = false;
  if (state.esOpen) setMode('live'); else setMode('off', serverBase() === null ? 'Tidak terhubung · buka lewat server.js' : undefined);
}
$('#bDemo').onclick = () => { if (!BUILT) return; state.demo ? stopDemo() : startDemo(); };

/* ================= tab Perintah: chat ke Claude Code di Mac owner (kontrak: .ai/brief/KONTRAK-chat.md §4, §6, §9) =================
   SEC-31: semua teks chat (pesan, jawaban, nama alat, path, alasan, nama proyek/akun) lewat textContent / new Option();
           tanpa Markdown→HTML, tanpa tautan otomatis, tanpa innerHTML.
   SEC-18: kunci perintah hanya di header X-Kantor-Perintah; disimpan di sessionStorage (bukan localStorage, bukan URL).
   SEC-29: jawaban hanya lewat GET /chat/aliran (fetch + ReadableStream), tidak lewat /events. Riwayat chat hanya di memori.
   Mode demo (tanpa server / ?demo): balasan palsu lokal, tanpa request apa pun. */
const CH_SES = 'padev-kantor-perintah';
const CH_DEMO = serverBase() === null || params.has('demo');
const CH_MAKS = 8000, CH_ALAT_MAKS = 30, CH_TEKS_MAKS = 300000;
const CH_RE_PR = /^[a-z0-9-]{1,40}$/, CH_RE_TG = /^t-[a-z0-9]{1,20}-[0-9a-f]{16}$/, CH_RE_KUNCI = /^[0-9a-fA-F]{32,256}$/;
const CH_AKHIR = new Set(['selesai', 'gagal', 'dihentikan', 'dibatalkan', 'batas_waktu']);
const chEl = {
  p:$('#pCht'), demo:$('#chDemo'), demoPl:$('#chDemoPl'), kunciF:$('#chKunciF'), kunciI:$('#chKunciI'), kunciS:$('#chKunciS'),
  info:$('#chInfo'), infoT:$('#chInfoT'), infoK:$('#chInfoK'), ulang:$('#chUlang'), ganti:$('#chGanti'),
  isi:$('#chIsi'), atas:$('#chAtas'), proyek:$('#chProyek'), akun:$('#chAkun'), model:$('#chModel'), pl:$('#chPl'), plT:$('#chPlT'),
  baru:$('#chBaru'), hapus:$('#chHapus'), tutup:$('#chTutup'), log:$('#chLog'), kerja:$('#chKerja'), kerjaM:$('#chKerjaM'), kerjaT:$('#chKerjaT'),
  stop:$('#chStop'), antre:$('#chAntre'), f:$('#chF'), pesan:$('#chPesan'), kirim:$('#chKirim'), hint:$('#chHint'), msg:$('#chFS'), um:$('#chUm'),
  dlg:$('#chDlg'), dlgT:$('#chDlgT'), dlgP:$('#chDlgP'), dlgDl:$('#chDlgDl'), dlgPsn:$('#chDlgPsn'), dlgYa:$('#chDlgYa'), dlgBatal:$('#chDlgBatal'),
};
const CH = {mulai:false, tampil:'', kunci:'', status:null, statusWaktu:0, stT:0, proyek:'', akun:'', model:'',
  baru:new Set(),          // proyek yang pesan berikutnya memulai percakapan baru (baru:true)
  wadah:new Map(),         // proyek → <div class="ch-wadah"> (riwayat di memori saja)
  segar:new Set(),         // proyek yang riwayatnya sudah dimuat sejak aliran tersambung
  rw:new Map(), tunda:new Map(),   // nomor muat riwayat per proyek · kejadian yang ditahan selama riwayat dimuat
  tugas:new Map(),         // tugas → {id, proyek, urut, mode, akun, final, o, c}
  pesan:new Map(),         // tugas → teks pesan owner (untuk antrean)
  menghentikan:new Set(), aliran:null, aliranOk:false, pernah:false, jeda:3000, ulang:0, terakhir:0, sembunyi:0, kirimSibuk:false, sigAntre:''};
const chSig = new WeakMap();

/* --- kunci perintah: sessionStorage (hilang saat tab ditutup) --- */
function chKunciMuat(){ try { return sessionStorage.getItem(CH_SES) || ''; } catch (e){ return ''; } }
function chKunciSimpan(k){ CH.kunci = k; try { sessionStorage.setItem(CH_SES, k); } catch (e){} }
function chKunciLupa(){ CH.kunci = ''; try { sessionStorage.removeItem(CH_SES); } catch (e){} }
function chHeader(json){
  const h = {'X-Kantor-Perintah':CH.kunci};
  if (KUNCI) h['X-Kantor-Kunci'] = KUNCI;      // kunci jauh yang sudah dipakai halaman (pintu HP)
  if (json) h['Content-Type'] = 'application/json';
  return h;
}
function chFetch(path, metode = 'GET', isi){
  const o = {method:metode, headers:chHeader(isi !== undefined), cache:'no-store', credentials:'same-origin', redirect:'error'};
  if (isi !== undefined) o.body = JSON.stringify(isi);
  return fetch(serverBase() + path, o);
}
async function chGalat(r){
  let t = ''; try { t = await r.text(); } catch (e){}
  let j = null; try { j = JSON.parse(t); } catch (e){}
  const p = j && typeof j === 'object' ? (j.error || j.pesan || j.alasan || j.message || '') : t;
  // lockout: server mengirim sisa detik di header Retry-After (body teks biasa)
  const ra = Number(r.headers.get('Retry-After'));
  const sampai = (j && Number(j.terkunciSampai)) || (r.status === 429 && ra > 0 ? Date.now() + ra * 1000 : 0);
  return {kode:r.status, pesan:short(String(p || ''), 200), sampai};
}
const chJam = ms => { const d = new Date(typeof ms === 'number' ? ms : String(ms || '')); return isNaN(d) ? '' : d.toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'}); };
const chMmss = ms => { const d = Math.max(0, Math.floor(ms / 1000)); return Math.floor(d / 60) + ':' + String(d % 60).padStart(2, '0'); };
function chDurasi(ms){
  const d = Math.max(0, Math.round((Number(ms) || 0) / 1000));
  if (d < 60) return d + ' dtk';
  const m = Math.floor(d / 60), s = d % 60;
  if (m < 60) return m + ' mnt' + (s ? ' ' + s + ' dtk' : '');
  return Math.floor(m / 60) + ' j' + (m % 60 ? ' ' + (m % 60) + ' mnt' : '');
}
const chModeNama = m => m === 'kerjakan' ? 'Kerjakan' : 'Rencana';
const chPr = id => (CH.status && CH.status.proyek.find(p => p.id === id)) || null;
function chAkunNama(p, id){ const pr = chPr(p), a = pr && pr.akun.find(x => x.id === id); return a ? a.label : String(id || ''); }
function chMsg(s, ok){ chEl.msg.textContent = s || ''; chEl.msg.classList.toggle('ok', !!ok); }
function chUm(s){ chEl.um.textContent = s || ''; }

/* --- tampilan: kunci | info | isi --- */
function chTampil(v){
  CH.tampil = v;
  chEl.kunciF.hidden = v !== 'kunci'; chEl.info.hidden = v !== 'info'; chEl.isi.hidden = v !== 'isi';
}
function chKosongkan(){
  CH.status = null; CH.wadah.clear(); CH.segar.clear(); CH.tunda.clear(); CH.tugas.clear(); CH.pesan.clear(); CH.menghentikan.clear(); CH.baru.clear();
  CH.sigAntre = ''; chEl.log.replaceChildren(); chEl.antre.replaceChildren(); chMsg('');
}
function chMintaKunci(pesan){
  chAliranTutup(); chKosongkan(); chKunciLupa(); chTampil('kunci');
  chEl.kunciS.textContent = pesan || ''; chEl.kunciS.classList.remove('ok');
  chEl.kunciI.value = ''; chEl.kunciI.removeAttribute('aria-invalid');
}
function chInfo(judul, ket, bisaUlang = true){
  chTampil('info'); chEl.infoT.textContent = judul; chEl.infoK.textContent = ket || '';
  chEl.ulang.hidden = !bisaUlang; chEl.ganti.hidden = CH_DEMO;
}
function chTerkunci(sampai){ chAliranTutup(); chInfo('Terkunci sementara', 'Terlalu banyak kunci perintah yang salah · terkunci sampai ' + chJam(sampai) + '. Coba lagi setelah itu.'); }
// penolakan yang mengganti tampilan; true = sudah ditangani
function chTolak(g, asal){
  const pintu = asal === 'status' || asal === 'aliran';
  if (g.kode === 401){ chMintaKunci('Kunci perintah ditolak · masukkan lagi.'); return true; }
  if (g.kode === 429 && g.sampai > Date.now()){ chTerkunci(g.sampai); return true; }
  if (!pintu) return false;
  chAliranTutup();
  if (g.kode === 404) chInfo('Fitur chat belum dinyalakan di server', 'Owner menyalakannya di Mac: isi KANTOR_CHAT=1 dan kunci perintah di .env, lalu jalankan ulang kantor. Tab lain tetap berjalan seperti biasa.');
  else if (g.kode === 403) chInfo('Perintah tidak diizinkan dari alamat ini', g.pesan || 'Buka lewat localhost di Mac, atau lewat Tailscale dengan akun yang terdaftar.');
  else if (g.kode === 429) chInfo('Terlalu banyak percobaan', 'Tunggu beberapa menit, lalu coba lagi.');
  else chInfo('Chat tidak bisa dimuat', 'Kode ' + g.kode + (g.pesan ? ' · ' + g.pesan : '') + '. Coba lagi sebentar lagi.');
  return true;
}

/* --- status (GET /chat/status) --- */
function chBersihAntre(a){
  return (Array.isArray(a) ? a : []).filter(x => x && CH_RE_TG.test(String(x.tugas))).slice(0, 10)
    .map(x => ({tugas:String(x.tugas), mode:x.mode === 'kerjakan' ? 'kerjakan' : 'rencana', akun:String(x.akun || ''), dibuat:Number(x.dibuat) || 0}));
}
function chBersihStatus(s){
  s = s && typeof s === 'object' ? s : {};
  const proyek = (Array.isArray(s.proyek) ? s.proyek : []).filter(p => p && CH_RE_PR.test(String(p.id))).slice(0, 60).map(p => ({
    id:String(p.id), nama:short(String(p.nama || p.id), 60), kerjakan:p.kerjakan === true,
    akun:(Array.isArray(p.akun) ? p.akun : []).filter(a => a && a.id != null).slice(0, 12).map(a => ({id:String(a.id).slice(0, 60), label:short(String(a.label || a.id), 40)})),
    aktif:p.aktif && CH_RE_TG.test(String(p.aktif.tugas)) ? {tugas:String(p.aktif.tugas), mode:p.aktif.mode === 'kerjakan' ? 'kerjakan' : 'rencana',
      akun:String(p.aktif.akun || ''), mulai:Number(p.aktif.mulai) || Date.now()} : null,
    antre:chBersihAntre(p.antre),
  }));
  const bm = s.batasMenit && typeof s.batasMenit === 'object' ? s.batasMenit : {}, pl = s.pelaksana && typeof s.pelaksana === 'object' ? s.pelaksana : {};
  return {pelaksana:{tersambung:pl.tersambung === true}, proyek,
    batasMenit:{rencana:Number(bm.rencana) || 20, kerjakan:Number(bm.kerjakan) || 60}, maksSerentak:Number(s.maksSerentak) || 2,
    model:(Array.isArray(s.model) ? s.model : []).map(m => typeof m === 'string' ? {id:m, label:m} : m && m.id != null ? {id:String(m.id), label:String(m.label || m.id)} : null)
      .filter(Boolean).slice(0, 12).map(m => ({id:m.id.slice(0, 60), label:short(m.label, 40)})),
    terkunciSampai:Number(s.terkunciSampai) || 0};
}
function chIsiSelect(sel, opsi, nilai){
  const sig = JSON.stringify(opsi);
  if (chSig.get(sel) !== sig){ sel.replaceChildren(...opsi.map(([v, t]) => new Option(t, v))); chSig.set(sel, sig); }
  if (opsi.some(o => o[0] === nilai)) sel.value = nilai;
}
function chIsiAkun(){
  const pr = chPr(CH.proyek);
  chIsiSelect(chEl.akun, pr ? pr.akun.map(a => [a.id, a.label]) : [], CH.akun);
  CH.akun = chEl.akun.value || '';
}
function chTerapkanStatus(s){
  const st = chBersihStatus(s);
  if (st.terkunciSampai > Date.now()){ chTerkunci(st.terkunciSampai); return false; }
  CH.status = st; CH.statusWaktu = Date.now();
  chIsiSelect(chEl.proyek, st.proyek.map(p => [p.id, p.nama]), CH.proyek);
  CH.proyek = chEl.proyek.value || '';
  chIsiAkun();
  chIsiSelect(chEl.model, [['', 'Model bawaan'], ...st.model.map(m => [m.id, m.label])], CH.model);
  CH.model = chEl.model.value || '';
  chEl.model.hidden = !st.model.length; chEl.atas.classList.toggle('tanpa-model', !st.model.length);
  chTampil('isi'); chPilihWadah(); chRender();
  return true;
}
async function chMuatStatus(awal){
  if (CH_DEMO) return chTerapkanStatus(chDemoStatus());
  if (!CH.kunci) return false;
  let r;
  try { r = await chFetch('/chat/status'); }
  catch (e){ if (awal || !CH.status) chInfo('Kantor tidak terjangkau', 'Periksa sambungan ke server kantor, lalu coba lagi.'); return false; }
  if (!r.ok){
    const g = await chGalat(r);
    if (!chTolak(g, 'status') && (awal || !CH.status)) chInfo('Status chat tidak bisa dimuat', 'Kode ' + g.kode + '.');
    return false;
  }
  let s; try { s = await r.json(); } catch (e){ return false; }
  if (!CH.kunci) return false;      // panel dikunci selama menunggu
  return chTerapkanStatus(s);
}
function chStatusNanti(){ if (CH_DEMO) return; clearTimeout(CH.stT); CH.stT = setTimeout(() => { if (CH.tampil === 'isi') chMuatStatus(); }, 900); }

/* --- percakapan per proyek (DOM di memori) --- */
function chWadah(p){ let w = CH.wadah.get(p); if (!w){ w = el('div', 'ch-wadah'); CH.wadah.set(p, w); } return w; }
function chDekatBawah(){ const l = chEl.log; return l.scrollHeight - l.scrollTop - l.clientHeight < 48; }
function chGulirBawah(){ chEl.log.scrollTop = chEl.log.scrollHeight; }
function chPilihWadah(){
  if (!CH.proyek){ chEl.log.replaceChildren(el('p', 'ch-kosong', 'Belum ada proyek terdaftar. Jalankan Kantor Pelaksana di Mac supaya daftar proyek muncul.')); return; }
  const w = chWadah(CH.proyek);
  if (chEl.log.firstChild !== w){ chEl.log.replaceChildren(w); chGulirBawah(); }
  // riwayat dimuat setelah aliran tersambung (supaya tidak ada potongan yang terlewat); proyek lain saat dipilih
  if (!CH.segar.has(CH.proyek) && (CH_DEMO || CH.pernah)) chMuatRiwayat(CH.proyek);
}
function chT(id, p, mode, akun){
  let t = CH.tugas.get(id);
  if (!t){ t = {id, proyek:p, urut:-1, mode:mode === 'kerjakan' ? 'kerjakan' : 'rencana', akun:String(akun || ''), final:false, o:null, c:null}; CH.tugas.set(id, t); }
  return t;
}
function chBaris(p, teks, kls){ const b = el('p', 'ch-i' + (kls ? ' ' + kls : ''), teks); chWadah(p).append(b); return b; }
function chKepala(nama, t, waktu){
  const hd = el('div', 'ch-hd');
  hd.append(el('b', null, nama), el('span', 'ch-chip' + (t.mode === 'kerjakan' ? ' kj' : ''), chModeNama(t.mode)));
  const ket = [chAkunNama(t.proyek, t.akun), chJam(waktu)].filter(Boolean).join(' · ');
  if (ket) hd.append(el('small', null, ket));
  return hd;
}
function chOwner(t, teks, waktu){
  if (t.o) return t.o;
  const w = el('div', 'ch-m ch-o');
  w.append(chKepala('Anda', t, waktu || Date.now()), el('p', 'ch-tx', String(teks || '').slice(0, CH_MAKS)));
  t.o = w; chWadah(t.proyek).append(w);
  return w;
}
function chClaude(t){
  if (t.c) return t.c;
  if (!t.o && CH.pesan.has(t.id)) chOwner(t, CH.pesan.get(t.id));
  const w = el('div', 'ch-m ch-c'), alat = el('ol', 'ch-alat'), tx = el('p', 'ch-tx'), ft = el('p', 'ch-ft'), tl = el('div', 'ch-tolak');
  alat.setAttribute('aria-label', 'Alat yang dipakai');
  w.append(chKepala('Claude', t), alat, tx, ft, tl);
  t.c = {w, alat, tx, ft, tl, node:null, nAlat:0, lebih:null};
  chWadah(t.proyek).append(w);
  return t.c;
}
function chTambahTeks(t, s){
  const c = chClaude(t); if (!s) return;
  if (!c.node){ c.node = document.createTextNode(''); c.tx.append(c.node); }
  if (c.node.length < CH_TEKS_MAKS) c.node.appendData(s);
}
function chSetTeks(t, s){
  const c = chClaude(t); s = String(s || '').slice(0, CH_TEKS_MAKS);
  if (!c.node){ if (!s) return; c.node = document.createTextNode(''); c.tx.append(c.node); }
  c.node.data = s;
}
function chAlat(t, nama, ringkas){
  const c = chClaude(t);
  nama = short(String(nama || 'Alat'), 40); ringkas = short(String(ringkas || ''), 80);
  c.nAlat++;
  if (c.nAlat <= CH_ALAT_MAKS){
    const li = el('li', null, (/^(Grep|Glob|WebSearch)$/.test(nama) ? '🔎 ' : '🔧 ') + nama + (ringkas ? ' · ' + ringkas : ''));
    li.title = li.textContent; c.alat.append(li); return;
  }
  if (!c.lebih){ c.lebih = el('li'); c.alat.append(c.lebih); }
  c.lebih.textContent = '+' + (c.nAlat - CH_ALAT_MAKS) + ' alat lain';
}
function chTolakan(t, daftar){
  const d = (Array.isArray(daftar) ? daftar : []).filter(x => x && typeof x === 'object').slice(0, 10);
  const c = chClaude(t); c.tl.replaceChildren();
  if (!d.length) return;
  const ul = el('ul');
  for (const x of d) ul.append(el('li', null, short(String(x.alat || 'Alat'), 40) + (x.ringkas ? ' · ' + short(String(x.ringkas), 80) : '')));
  c.tl.append(el('b', null, '⛔ ' + d.length + ' langkah ditolak (butuh izin)'), ul);
}
// tahap akhir sebuah tugas (dari aliran atau dari riwayat)
function chAkhir(t, tahap, ev){
  t.final = true;
  if (tahap === 'dibatalkan' && !t.c){
    const psn = CH.pesan.get(t.id);
    chBaris(t.proyek, (ev.alasan === 'kedaluwarsa' ? '⌛ Pesan antre kedaluwarsa (lebih dari 2 jam)' : '🚫 Pesan antre dibatalkan') + (psn ? ': “' + short(psn, 60) + '”' : ''));
    return;
  }
  const c = chClaude(t); c.w.classList.remove('jalan'); c.ft.className = 'ch-ft';
  switch (tahap){
    case 'selesai':
      if (typeof ev.teks === 'string' && ev.teks) chSetTeks(t, ev.teks);
      c.ft.textContent = '✅ Selesai' + (ev.durasiMs != null ? ' · ' + chDurasi(ev.durasiMs) : '');
      chTolakan(t, ev.ditolak); break;
    case 'gagal': c.ft.classList.add('err'); c.ft.textContent = '❌ Gagal' + (ev.alasan ? ' · ' + short(String(ev.alasan), 200) : ''); break;
    case 'dihentikan': c.ft.classList.add('lm'); c.ft.textContent = '⏹ Dihentikan ' + (ev.oleh === 'pelaksana_keluar' ? '· pelaksana berhenti' : 'oleh Anda'); break;
    case 'batas_waktu': c.ft.classList.add('err'); c.ft.textContent = '⏱ Batas waktu ' + (Number(ev.menit) || '') + ' menit habis · dihentikan'; break;
    case 'dibatalkan': c.ft.classList.add('lm'); c.ft.textContent = ev.alasan === 'kedaluwarsa' ? '⌛ Kedaluwarsa' : '🚫 Dibatalkan'; break;
  }
}
function chHapusLokal(p){
  const w = CH.wadah.get(p); if (w) w.replaceChildren();
  for (const [id, t] of CH.tugas) if (t.proyek === p && (t.final || !t.c)){ CH.tugas.delete(id); }
  if (p === CH.proyek){ chUm('Riwayat percakapan dihapus'); chRender(); }
}

/* --- kejadian chat (aliran / demo); dedupe per (tugas, urut) --- */
function chTerima(ev){
  if (!ev || typeof ev !== 'object' || !CH.status) return;
  const th = String(ev.tahap || '');
  if (th === 'pelaksana'){
    CH.status.pelaksana.tersambung = ev.tersambung === true; chRender();
    chUm(ev.tersambung === true ? 'Pelaksana tersambung' : 'Pelaksana tidak tersambung'); return;
  }
  const p = String(ev.proyek || ''); if (!CH_RE_PR.test(p)) return;
  if (CH.tunda.has(p)){ CH.tunda.get(p).push(ev); return; }     // riwayat proyek ini sedang dimuat → diputar setelahnya
  const pr = chPr(p);
  if (th === 'antrean'){ if (pr){ pr.antre = chBersihAntre(ev.antre); chRender(); } return; }
  if (th === 'riwayat_dihapus'){ chHapusLokal(p); return; }
  const id = String(ev.tugas || ''); if (!CH_RE_TG.test(id)) return;
  let t = CH.tugas.get(id);
  if (t && t.final) return;
  const akhir = CH_AKHIR.has(th), urut = Number(ev.urut);
  if (!akhir && !['dikirim', 'mulai', 'teks', 'alat'].includes(th)) return;
  if (!t) t = chT(id, p, ev.mode, ev.akun);
  if (!akhir){ if (!Number.isFinite(urut) || urut <= t.urut) return; t.urut = urut; }
  if (ev.mode === 'kerjakan' || ev.mode === 'rencana') t.mode = ev.mode;
  const lihat = p === CH.proyek && CH.tampil === 'isi', ikut = lihat && chDekatBawah();
  if (th === 'dikirim'){
    const psn = String(ev.pesan || '').slice(0, CH_MAKS);
    if (psn) CH.pesan.set(id, psn);
    if (ev.antre === true){ if (pr && !pr.antre.some(a => a.tugas === id)) pr.antre.push({tugas:id, mode:t.mode, akun:t.akun, dibuat:Number(ev.ts) || Date.now()}); }
    else chOwner(t, psn, Number(ev.ts) || Date.now());
  } else if (th === 'mulai'){
    chClaude(t).w.classList.add('jalan');
    if (pr){ pr.aktif = {tugas:id, mode:t.mode, akun:t.akun, mulai:Number(ev.ts) || Date.now()}; pr.antre = pr.antre.filter(a => a.tugas !== id); }
    if (lihat) chUm('Claude mulai bekerja');
  } else if (th === 'teks') chTambahTeks(t, typeof ev.teks === 'string' ? ev.teks : '');
  else if (th === 'alat') chAlat(t, ev.alat, ev.ringkas);
  else {
    chAkhir(t, th, ev);
    if (pr){ if (pr.aktif && pr.aktif.tugas === id) pr.aktif = null; pr.antre = pr.antre.filter(a => a.tugas !== id); }
    CH.menghentikan.delete(id);
    if (lihat){
      const ft = t.c ? t.c.ft.textContent : '';
      chUm(th === 'selesai' ? 'Jawaban Claude selesai. ' + short(t.c && t.c.node ? t.c.node.data : '', 300) : ft || 'Pesan antre dibatalkan');
    }
    chStatusNanti();
  }
  chRender();
  if (ikut) chGulirBawah();
}

/* --- riwayat (GET /chat/riwayat) --- */
async function chMuatRiwayat(p){
  if (!p) return;
  if (CH_DEMO){ CH.segar.add(p); return; }
  const n = (CH.rw.get(p) || 0) + 1; CH.rw.set(p, n);
  if (!CH.tunda.has(p)) CH.tunda.set(p, []);
  const putar = () => { if (CH.rw.get(p) !== n) return; const daftar = CH.tunda.get(p) || []; CH.tunda.delete(p); daftar.forEach(chTerima); };
  let r;
  try { r = await chFetch('/chat/riwayat?proyek=' + encodeURIComponent(p) + '&batas=50'); } catch (e){ putar(); return; }
  if (CH.rw.get(p) !== n) return;
  if (!r.ok){
    const g = await chGalat(r);
    if (!chTolak(g, 'riwayat')){ putar(); chBaris(p, 'Riwayat tidak bisa dimuat' + (g.pesan ? ' · ' + g.pesan : ' (kode ' + g.kode + ')'), 'err'); }
    return;
  }
  let j; try { j = await r.json(); } catch (e){ putar(); return; }
  if (CH.rw.get(p) !== n || !CH.status) return;
  CH.segar.add(p);
  chBangunRiwayat(p, j && typeof j === 'object' ? j : {});
  putar();
  if (p === CH.proyek){ chGulirBawah(); chRender(); }
}
function chBangunRiwayat(p, j){
  for (const [id, t] of CH.tugas) if (t.proyek === p) CH.tugas.delete(id);
  chWadah(p).replaceChildren();
  const pr = chPr(p), antre = new Set(pr ? pr.antre.map(a => a.tugas) : []);
  const waktu = e => typeof e.waktu === 'number' ? e.waktu : Date.parse(e.waktu) || 0;
  const entri = (Array.isArray(j.entri) ? j.entri : []).filter(e => e && typeof e === 'object' && CH_RE_TG.test(String(e.tugas))).sort((a, b) => waktu(a) - waktu(b));
  for (const e of entri){
    const id = String(e.tugas), t = chT(id, p, e.mode, e.akun);
    if (e.peran === 'owner'){
      CH.pesan.set(id, String(e.teks || '').slice(0, CH_MAKS));
      if (!antre.has(id)) chOwner(t, e.teks, waktu(e));
    } else if (e.peran === 'claude'){
      chClaude(t);
      if (e.teks) chSetTeks(t, String(e.teks));
      for (const a of (Array.isArray(e.alat) ? e.alat : []).slice(0, CH_ALAT_MAKS)){
        if (typeof a === 'string') chAlat(t, a, ''); else if (a && typeof a === 'object') chAlat(t, a.alat, a.ringkas);
      }
      const st = String(e.status || 'selesai');
      chAkhir(t, CH_AKHIR.has(st) ? st : 'selesai', {durasiMs:e.durasiMs, ditolak:e.ditolak, alasan:e.alasan, oleh:e.oleh, menit:e.menit});
    }
  }
  const ak = j.aktif && typeof j.aktif === 'object' && CH_RE_TG.test(String(j.aktif.tugas)) ? j.aktif : null;
  if (ak){
    const t = chT(String(ak.tugas), p, ak.mode, ak.akun);
    t.final = false; chClaude(t).w.classList.add('jalan');
    if (ak.teksSejauhIni) chSetTeks(t, String(ak.teksSejauhIni));
    t.urut = Number(ak.urut) || 0;
    if (pr) pr.aktif = {tugas:t.id, mode:t.mode, akun:t.akun, mulai:Number(ak.mulai) || Date.now()};
  }
}

/* --- aliran (GET /chat/aliran): fetch + ReadableStream, format SSE teks --- */
function chAliranTutup(){
  clearTimeout(CH.ulang);
  if (CH.aliran) try { CH.aliran.abort(); } catch (e){}
  CH.aliran = null; CH.aliranOk = false;
}
function chAliranJadwal(){
  clearTimeout(CH.ulang);
  CH.ulang = setTimeout(chAliranBuka, CH.jeda);
  CH.jeda = Math.min(CH.jeda * 2, 30000);
  // aliran belum pernah tersambung → riwayat tetap dimuat supaya percakapan lama terlihat
  if (!CH.pernah && CH.status && CH.proyek && !CH.segar.has(CH.proyek) && !CH.tunda.has(CH.proyek)) chMuatRiwayat(CH.proyek);
  chRender();
}
function chBlokSse(blok){
  let nama = 'message'; const data = [];
  for (const baris of blok.split('\n')){
    if (!baris || baris[0] === ':') continue;               // komentar (: ping)
    const i = baris.indexOf(':'), f = i < 0 ? baris : baris.slice(0, i);
    let v = i < 0 ? '' : baris.slice(i + 1); if (v[0] === ' ') v = v.slice(1);
    if (f === 'event') nama = v; else if (f === 'data') data.push(v);
  }
  if (nama !== 'chat' || !data.length) return;
  let ev; try { ev = JSON.parse(data.join('\n')); } catch (e){ return; }
  chTerima(ev);
}
async function chAliranBuka(){
  if (CH_DEMO || !CH.kunci) return;
  chAliranTutup();
  const ac = new AbortController(); CH.aliran = ac;
  let r;
  try { r = await fetch(serverBase() + '/chat/aliran', {headers:chHeader(false), cache:'no-store', credentials:'same-origin', redirect:'error', signal:ac.signal}); }
  catch (e){ if (CH.aliran === ac) chAliranJadwal(); return; }
  if (CH.aliran !== ac){ try { ac.abort(); } catch (e){} return; }
  if (!r.ok || !r.body){
    const g = await chGalat(r);
    if (CH.aliran !== ac) return;
    CH.aliran = null;
    if (!chTolak(g, 'aliran')) chAliranJadwal();
    return;
  }
  CH.aliranOk = true; CH.jeda = 3000; CH.terakhir = Date.now();
  // tersambung (lagi) → status + riwayat proyek terpilih (pakai aktif.teksSejauhIni & urut); proyek lain dimuat saat dipilih
  const awal = !CH.pernah; CH.pernah = true;
  CH.segar.clear();
  if (!awal) chMuatStatus().then(ok => { if (ok && CH.proyek && !CH.segar.has(CH.proyek)) chMuatRiwayat(CH.proyek); });
  else { chRender(); if (CH.proyek) chMuatRiwayat(CH.proyek); }
  const rd = r.body.getReader(), dek = new TextDecoder();
  let buf = '';
  try {
    for (;;){
      const {value, done} = await rd.read();
      if (done || CH.aliran !== ac) break;
      CH.terakhir = Date.now();
      buf += dek.decode(value, {stream:true}).replace(/\r\n?/g, '\n');
      if (buf.length > 4e6) break;                            // blok tanpa akhir: buang & sambung ulang
      let i;
      while ((i = buf.indexOf('\n\n')) >= 0){ const blok = buf.slice(0, i); buf = buf.slice(i + 2); chBlokSse(blok); }
    }
  } catch (e){}
  try { rd.cancel(); } catch (e){}
  if (CH.aliran === ac){ CH.aliran = null; CH.aliranOk = false; chAliranJadwal(); }
}
// layar HP mati / tab tersembunyi ≥20 dtk → sambungan lama bisa mati diam-diam (pola bukaSiaran); tanpa data >50 dtk (ping 20 dtk) → buka ulang
document.addEventListener('visibilitychange', () => {
  if (CH_DEMO || !CH.kunci || CH.tampil !== 'isi') return;
  if (document.hidden){ CH.sembunyi = Date.now(); return; }
  if (!CH.aliranOk || Date.now() - CH.sembunyi >= 20000) chAliranBuka();
});
setInterval(() => {
  if (!CH_DEMO && CH.aliranOk && Date.now() - CH.terakhir > 50000) chAliranBuka();
  if (!CH_DEMO && CH.tampil === 'isi' && !document.hidden && !chEl.p.hidden && Date.now() - CH.statusWaktu > 30000) chMuatStatus();
}, 10000);

/* --- render bagian status, antrean, mode, tombol --- */
function chMode(){ const r = chEl.f.querySelector('input[name="chMode"]:checked'); return r && r.value === 'kerjakan' ? 'kerjakan' : 'rencana'; }
function chModeAtur(m){
  for (const r of chEl.f.querySelectorAll('input[name="chMode"]')) r.checked = r.value === m;
  chRender();
}
function chHint(){
  const st = CH.status, pr = chPr(CH.proyek), n = chEl.pesan.value.length;
  let s = '', k = '';
  const jalan = st ? st.proyek.filter(x => x.aktif).length : 0;
  if (!st || !pr) s = '';
  else if (!st.pelaksana.tersambung){ s = 'Kirim nonaktif sampai pelaksana tersambung'; k = 'err'; }
  else if (pr.antre.length >= 3){ s = 'Antrean penuh · maks 3 pesan'; k = 'err'; }
  else if (n > CH_MAKS - 1000){ s = n.toLocaleString('id-ID') + ' / 8.000 karakter'; k = n >= CH_MAKS ? 'err' : ''; }
  else if (pr.aktif || jalan >= st.maksSerentak) s = pr.aktif ? 'Proyek sedang bekerja · pesan masuk antrean' : 'Batas tugas serentak penuh · pesan masuk antrean';
  else if (CH.baru.has(pr.id)) s = 'Pesan berikutnya memulai percakapan baru';
  else if (chMode() === 'kerjakan'){ s = 'Claude boleh mengubah file proyek ini'; k = 'kj'; }
  else s = 'Hanya membaca & menyusun rencana';
  chEl.hint.textContent = s; chEl.hint.className = 'ch-hint' + (k ? ' ' + k : '');
}
function chDetak(){
  const st = CH.status, pr = chPr(CH.proyek), ak = pr && pr.aktif;
  if (!ak) return;
  const batas = st.batasMenit[ak.mode] || 0;
  chEl.kerjaT.textContent = 'Bekerja · ' + chMmss(Date.now() - ak.mulai) + (batas ? ' / batas ' + batas + ':00' : '');
}
setInterval(() => { if (!chEl.kerja.hidden && !chEl.p.hidden) chDetak(); }, 1000);
function chRender(){
  const st = CH.status; if (!st) return;
  const pr = chPr(CH.proyek), pl = st.pelaksana.tersambung, ak = pr && pr.aktif, an = pr ? pr.antre : [];
  let kls = 'ok', teks = 'Pelaksana tersambung';
  if (!pl){ kls = 'err'; teks = 'Pelaksana tidak tersambung'; }
  else if (!CH_DEMO && !CH.aliranOk){ kls = 'warn'; teks = 'Aliran terputus · menyambung ulang…'; }
  chEl.pl.className = 'ch-pl ' + kls; chEl.plT.textContent = teks;
  chEl.kerja.hidden = !ak;
  if (ak){
    const henti = CH.menghentikan.has(ak.tugas);
    chEl.stop.disabled = henti; chEl.stop.textContent = henti ? 'Menghentikan…' : 'Hentikan';
    chEl.kerjaM.textContent = chModeNama(ak.mode); chEl.kerjaM.className = 'ch-chip' + (ak.mode === 'kerjakan' ? ' kj' : '');
    chDetak();
  }
  const sig = JSON.stringify([CH.proyek, an.map(a => a.tugas), [...CH.menghentikan]]);
  if (sig !== CH.sigAntre){
    CH.sigAntre = sig;
    const fokus = chEl.antre.contains(document.activeElement);
    chEl.antre.replaceChildren(...an.map((a, i) => {
      const li = el('li'), b = el('button', 'btn sm', CH.menghentikan.has(a.tugas) ? 'Membatalkan…' : 'Batal');
      b.type = 'button'; b.dataset.tugas = a.tugas; b.disabled = CH.menghentikan.has(a.tugas);
      b.setAttribute('aria-label', 'Batalkan antre nomor ' + (i + 1));
      const psn = CH.pesan.get(a.tugas);
      li.append(el('b', null, 'Antre #' + (i + 1)), el('span', 'ch-chip' + (a.mode === 'kerjakan' ? ' kj' : ''), chModeNama(a.mode)),
        el('span', 'ch-at', psn ? short(psn, 120) : 'Pesan dari perangkat lain'), b);
      return li;
    }));
    if (fokus && !chEl.antre.contains(document.activeElement)) chEl.pesan.focus();
  }
  chEl.antre.hidden = !an.length;
  const rk = chEl.f.querySelector('input[value="kerjakan"]'), bisaKj = !!(pr && pr.kerjakan);
  rk.disabled = !bisaKj; rk.parentElement.title = bisaKj ? '' : 'Proyek ini hanya boleh mode Rencana';
  if (!bisaKj && rk.checked){ rk.checked = false; chEl.f.querySelector('input[value="rencana"]').checked = true; }
  const kj = chMode() === 'kerjakan';
  chEl.f.classList.toggle('kj', kj); chEl.kirim.classList.toggle('kj', kj);
  chEl.kirim.disabled = !pl || !pr || CH.kirimSibuk || an.length >= 3;
  chEl.kirim.textContent = CH.kirimSibuk ? 'Mengirim…' : 'Kirim';
  chEl.pesan.disabled = !pr;
  chEl.hapus.disabled = !pr || !!ak; chEl.hapus.title = ak ? 'Hentikan tugas yang berjalan dulu' : '';
  chEl.baru.disabled = !pr; chEl.baru.setAttribute('aria-pressed', pr && CH.baru.has(pr.id) ? 'true' : 'false');
  chEl.proyek.disabled = !st.proyek.length; chEl.akun.disabled = !pr || !pr.akun.length;
  chEl.tutup.hidden = CH_DEMO;
  chHint();
}

/* --- dialog konfirmasi (<dialog> modal: fokus terkurung, Esc = batal) --- */
function chTanya(o){
  return new Promise(selesai => {
    const d = chEl.dlg;
    if (d.open){ selesai(false); return; }
    chEl.dlgT.textContent = o.judul; chEl.dlgP.textContent = o.isi;
    chEl.dlgDl.replaceChildren(...(o.rinci || []).flatMap(([k, v, kls]) => [el('dt', null, k), el('dd', kls || null, v)]));
    chEl.dlgDl.hidden = !(o.rinci || []).length;
    chEl.dlgPsn.textContent = o.pesan || ''; chEl.dlgPsn.hidden = !o.pesan;
    chEl.dlgYa.textContent = o.ya; chEl.dlgYa.className = 'btn' + (o.jenis ? ' ' + o.jenis : '');
    const balik = document.activeElement;
    d.returnValue = '';
    d.addEventListener('close', () => { if (balik && balik.isConnected && typeof balik.focus === 'function') balik.focus(); selesai(d.returnValue === 'ya'); }, {once:true});
    d.showModal(); chEl.dlgBatal.focus();
  });
}
chEl.dlgYa.addEventListener('click', () => chEl.dlg.close('ya'));
chEl.dlgBatal.addEventListener('click', () => chEl.dlg.close('batal'));
chEl.dlg.addEventListener('click', e => { if (e.target === chEl.dlg) chEl.dlg.close('batal'); });     // klik latar
chEl.dlg.addEventListener('keydown', e => e.stopPropagation());   // tombol kamera/kantor tidak berlaku di dalam dialog; Esc bawaan tetap menutup

/* --- aksi --- */
async function chHentikan(tugas){
  if (CH.menghentikan.has(tugas)) return;
  CH.menghentikan.add(tugas); chRender();
  if (CH_DEMO){ chDemoHentikan(tugas); chRender(); return; }
  try {
    const r = await chFetch('/chat/hentikan', 'POST', {tugas});
    if (!r.ok){
      const g = await chGalat(r); CH.menghentikan.delete(tugas);
      if (!chTolak(g, 'hentikan')) chMsg(g.kode === 404 ? 'Tugas sudah tidak ada.' : g.kode === 503 ? 'Pelaksana tidak tersambung · tugas belum dihentikan.' : 'Gagal menghentikan (kode ' + g.kode + ').');
      chStatusNanti();
    } else {
      const j = await r.json().catch(() => ({}));
      const t = CH.tugas.get(tugas);
      if (j && j.status === 'dibatalkan' && t) chTerima({tahap:'dibatalkan', tugas, proyek:t.proyek, alasan:'owner'});
    }
  } catch (e){ CH.menghentikan.delete(tugas); chMsg('Tidak bisa menghubungi kantor.'); }
  chRender();
}
chEl.stop.addEventListener('click', () => { const pr = chPr(CH.proyek); if (pr && pr.aktif) chHentikan(pr.aktif.tugas); });
chEl.antre.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('button[data-tugas]'); if (!b || b.disabled) return;
  const id = b.dataset.tugas, pr = chPr(CH.proyek);
  if (!CH_RE_TG.test(id)) return;
  if (!CH.tugas.has(id)) chT(id, CH.proyek, (pr && (pr.antre.find(a => a.tugas === id) || {}).mode) || 'rencana', '');
  chHentikan(id);
});
chEl.proyek.addEventListener('change', () => { CH.proyek = chEl.proyek.value; chIsiAkun(); chMsg(''); chPilihWadah(); chRender(); });
chEl.akun.addEventListener('change', () => { CH.akun = chEl.akun.value; });
chEl.model.addEventListener('change', () => { CH.model = chEl.model.value; });
chEl.f.addEventListener('change', e => { if (e.target && e.target.name === 'chMode') chRender(); });
function chTinggi(){ const ta = chEl.pesan; ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight + 2, 160) + 'px'; }
chEl.pesan.addEventListener('input', () => { chTinggi(); chHint(); });
chEl.pesan.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)){ e.preventDefault(); chEl.f.requestSubmit(); } });
chEl.baru.addEventListener('click', () => {
  const p = CH.proyek; if (!p) return;
  if (CH.baru.has(p)) CH.baru.delete(p); else CH.baru.add(p);
  chRender(); chUm(CH.baru.has(p) ? 'Pesan berikutnya memulai percakapan baru' : 'Percakapan dilanjutkan');
});
chEl.hapus.addEventListener('click', async () => {
  const pr = chPr(CH.proyek); if (!pr || pr.aktif) return;
  const ok = await chTanya({judul:'Hapus riwayat percakapan?', isi:'Riwayat chat proyek ini di server dihapus dan tidak bisa dikembalikan.',
    rinci:[['Proyek', pr.nama]], ya:'Hapus riwayat', jenis:'err'});
  if (!ok) return;
  if (CH_DEMO){ chHapusLokal(pr.id); chMsg('Riwayat dihapus.', true); return; }
  try {
    const r = await chFetch('/chat/riwayat?proyek=' + encodeURIComponent(pr.id), 'DELETE', {});
    if (r.ok){ chHapusLokal(pr.id); chMsg('Riwayat dihapus.', true); return; }
    const g = await chGalat(r);
    if (!chTolak(g, 'hapus')) chMsg(g.kode === 409 ? 'Proyek sedang bekerja · hentikan dulu sebelum menghapus riwayat.' : 'Gagal menghapus riwayat (kode ' + g.kode + ').');
  } catch (e){ chMsg('Tidak bisa menghubungi kantor.'); }
});
chEl.tutup.addEventListener('click', () => { chMintaKunci('Panel perintah dikunci · kunci sudah dihapus dari tab ini.'); chEl.kunciS.classList.add('ok'); chEl.kunciI.focus(); });
chEl.ganti.addEventListener('click', () => { chMintaKunci(''); chEl.kunciI.focus(); });

/* --- Pasangkan HP (APK PADEV Studio) dari laptop, seperti WhatsApp Web: QR → HP memindai → cocokkan kode 6 digit → terpasang.
   QR & kode berasal dari pelaksana (`--pasang-hp --mesin`: atestasi, audit, dan aturan yang sama dengan Terminal); halaman ini hanya
   menampilkan & meneruskan jawaban owner. Polling GET /chat/pasang tiap 1 dtk selama dialog terbuka. Teks lewat textContent. --- */
const hpEl = {dlg:$('#hpDlg'), st:$('#hpSt'), qr:$('#hpQr'), sas:$('#hpSas'), kode:$('#hpKode'), nama:$('#hpNama'), kerjakan:$('#hpKerjakan'),
  kerjakanL:$('#hpKerjakanL'), darurat:$('#hpDarurat'), daruratK:$('#hpDaruratK'), sert:$('#hpSert'), sertB:$('#hpSertB'),
  mulai:$('#hpMulai'), ya:$('#hpYa'), tidak:$('#hpTidak'), tutup:$('#hpTutup'), buka:$('#chHp'), kj:$('#hpKj'), kjB:$('#hpKjB'), kjI:$('#hpKjI')};
const HP_KJ_AWAL = hpEl.kjI.textContent;
let hpT = 0, hpO = {tahap:'diam'}, hpSertSha = '', hpPesanSendiri = '';
const HP_AKTIF = new Set(['menunggu', 'qr', 'sas', 'menyimpan']);
function hpGambarQr(modul){
  const n = modul.length, tepi = 4, s = Math.max(3, Math.floor(300 / (n + tepi * 2))), c = hpEl.qr;
  c.width = c.height = (n + tepi * 2) * s;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, c.width, c.height); g.fillStyle = '#000000';
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (modul[y][x] === '1') g.fillRect((x + tepi) * s, (y + tepi) * s, s, s);
}
function hpTampil(o){
  if (!hpEl.dlg.open) return;   // jawaban polling yang tiba setelah dialog ditutup tidak boleh menggambar ulang (kode darurat)
  hpO = o || {tahap:'diam'};
  const t = hpO.tahap, jam = ms => new Date(ms).toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'});
  for (const el of [hpEl.qr, hpEl.sas, hpEl.darurat, hpEl.sert, hpEl.sertB, hpEl.ya, hpEl.tidak]) el.hidden = true;
  hpEl.mulai.hidden = HP_AKTIF.has(t) || t === 'selesai';
  hpEl.kerjakanL.hidden = t === 'selesai';
  let teks = '';
  if (t === 'menunggu') teks = 'Menyiapkan QR di Mac…';
  else if (t === 'qr' && Array.isArray(hpO.modul)) {
    hpGambarQr(hpO.modul); hpEl.qr.hidden = false;
    teks = `Di HP: buka APK PADEV Studio → Pindai kode QR. Berlaku sampai ${jam(hpO.sampai)}. Jangan difoto/dibagikan.`;
  } else if (t === 'sas') {
    hpEl.kode.textContent = String(hpO.kode || '').replace(/^(\d{3})(\d{3})$/, '$1 $2');
    hpEl.nama.textContent = 'HP: ' + (hpO.nama || 'HP');
    hpEl.sas.hidden = false; hpEl.ya.hidden = false; hpEl.tidak.hidden = false;
    teks = 'Apakah kode ini SAMA dengan kode di layar HP?';
  } else if (t === 'menyimpan') teks = 'Menyimpan pemasangan…';
  else if (t === 'selesai') {
    teks = `✅ Terpasang: ${hpO.nama || 'HP'} · ${hpO.mode === 'rencana+kerjakan' ? 'Rencana + Kerjakan' : 'Rencana saja'}. Di HP ketuk Mulai.`;
    if (hpO.darurat){ hpEl.daruratK.textContent = hpO.darurat; hpEl.darurat.hidden = false; }
  } else if (t === 'gagal') {
    teks = 'Pemasangan gagal: ' + (hpO.pesan || 'gagal');
    if (hpO.sertifikat){
      hpSertSha = hpO.sertifikat;
      hpEl.sert.textContent = `APK di HP belum dikenal Mac (sertifikat ${hpSertSha.slice(0, 12)}…). Bila APK ini Anda pasang sendiri (GitHub Actions / bangun.sh), percayai lalu tampilkan QR lagi.`;
      hpEl.sert.hidden = false; hpEl.sertB.hidden = false;
    }
  } else if (t === 'sertifikat') teks = 'APK dicatat sebagai terpercaya. Klik "Tampilkan QR" lalu pindai lagi dari HP.';
  else teks = hpO.pelaksana === false ? 'Pelaksana di Mac belum berjalan — buka "Kantor Pelaksana" (bash siapkan-hp.sh) lalu coba lagi.'
    : 'Klik "Tampilkan QR", lalu pindai dari APK PADEV Studio di HP.';
  hpEl.st.textContent = hpPesanSendiri || teks;
  hpPesanSendiri = '';
  // Kerjakan semua proyek (HP yang sudah terpasang); disembunyikan selama pemasangan berjalan
  const kj = hpO.kerjakan;
  hpEl.kj.hidden = HP_AKTIF.has(t);
  hpEl.kjB.disabled = !!(kj && kj.tahap === 'menunggu');
  if (kj && kj.tahap === 'menunggu') hpEl.kjI.textContent = 'Mengaktifkan Kerjakan di Mac…';
  else if (kj && kj.tahap === 'selesai') hpEl.kjI.textContent = `✅ Kerjakan aktif di ${kj.proyek} proyek` + (kj.hp ? ` · ${kj.hp} HP dinaikkan` : '') + '. Di HP: tarik untuk segarkan (≤ 1 menit).';
  else if (kj && kj.tahap === 'gagal') hpEl.kjI.textContent = 'Gagal: ' + (kj.pesan || 'gagal');
  else hpEl.kjI.textContent = HP_KJ_AWAL;
}
async function hpMuat(){
  try {
    const r = await chFetch('/chat/pasang');
    if (r.status === 401){ hpEl.dlg.close(); chMintaKunci('Kunci perintah ditolak · masukkan lagi.'); return; }
    if (!r.ok){ hpEl.st.textContent = 'Server: ' + (await r.text().catch(() => '') || r.status); return; }
    hpTampil(await r.json());
  } catch (e){ hpEl.st.textContent = 'Server kantor tidak terjangkau.'; }
}
function hpPutar(){
  clearTimeout(hpT);
  if (!hpEl.dlg.open) return;
  hpMuat().finally(() => { if (hpEl.dlg.open) hpT = setTimeout(hpPutar, 1000); });
}
async function hpKirim(jalur, isi){
  try {
    const r = await chFetch(jalur, 'POST', isi || {});
    if (!r.ok){ hpPesanSendiri = (await r.text().catch(() => '')) || ('gagal (' + r.status + ')'); hpTampil(hpO); return; }
    hpTampil(await r.json());
  } catch (e){ hpEl.st.textContent = 'Server kantor tidak terjangkau.'; }
}
hpEl.buka.addEventListener('click', () => {
  hpEl.darurat.hidden = true; hpEl.daruratK.textContent = '';
  hpEl.dlg.showModal(); hpPutar();
});
hpEl.mulai.addEventListener('click', () => hpKirim('/chat/pasang/mulai'));
hpEl.ya.addEventListener('click', () => hpKirim('/chat/pasang/jawab', {setuju:true, kerjakan:hpEl.kerjakan.checked}));
hpEl.tidak.addEventListener('click', () => hpKirim('/chat/pasang/jawab', {setuju:false, kerjakan:false}));
hpEl.sertB.addEventListener('click', () => hpKirim('/chat/pasang/sertifikat', {sha:hpSertSha}));
hpEl.kjB.addEventListener('click', () => hpKirim('/chat/pasang/kerjakan'));
hpEl.tutup.addEventListener('click', () => hpEl.dlg.close());
hpEl.dlg.addEventListener('close', () => {
  clearTimeout(hpT);
  hpEl.daruratK.textContent = ''; hpEl.darurat.hidden = true;   // kode darurat tidak tertinggal di halaman
  if (HP_AKTIF.has(hpO.tahap)) chFetch('/chat/pasang/batal', 'POST', {}).catch(() => {});
});
if (CH_DEMO) hpEl.buka.hidden = true;
chEl.ulang.addEventListener('click', () => { chInfo('Menghubungkan…', '', false); chSambung(); });
function chPesanGalat(g){
  const tambah = g.pesan ? ' · ' + g.pesan : '';
  switch (g.kode){
    case 400: return 'Perintah ditolak server' + tambah;
    case 403: return 'Ditolak' + tambah;
    case 409: return 'Antrean penuh · maks 3 pesan menunggu.';
    case 413: return 'Perintah terlalu besar.';
    case 415: return 'Format kiriman ditolak server (415).';
    case 429: return 'Terlalu banyak perintah · maks 10 per menit dan 20 per jam. Tunggu sebentar.';
    case 503: return 'Pelaksana tidak tersambung · nyalakan Kantor Pelaksana di Mac.';
  }
  return 'Gagal mengirim (kode ' + g.kode + ')' + tambah;
}
chEl.f.addEventListener('submit', async e => {
  e.preventDefault();
  if (CH.kirimSibuk || chEl.kirim.disabled) return;
  let pr = chPr(CH.proyek); if (!pr) return;
  const pesan = chEl.pesan.value.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '');
  if (!pesan.trim()){ chMsg('Perintah masih kosong.'); chEl.pesan.focus(); return; }
  if (pesan.length > CH_MAKS){ chMsg('Perintah terlalu panjang (' + pesan.length.toLocaleString('id-ID') + ' / 8.000 karakter).'); return; }
  const mode = chMode();
  if (mode === 'kerjakan'){
    if (!pr.kerjakan) return;
    const ok = await chTanya({judul:'Jalankan mode Kerjakan?', isi:'Claude boleh membaca dan mengubah file di proyek ini tanpa bertanya lagi. git push tetap ditolak.',
      rinci:[['Proyek', pr.nama], ['Mode', 'Kerjakan (mengubah file)', 'kj'], ['Akun', chAkunNama(pr.id, CH.akun)]], pesan:short(pesan, 400), ya:'Ya, kerjakan', jenis:'kj'});
    const pr2 = chPr(CH.proyek);
    if (!ok || !pr2 || pr2.id !== pr.id || !pr2.kerjakan) return;
    pr = pr2;
  }
  const body = {proyek:pr.id, akun:CH.akun, mode, pesan};
  if (CH.baru.has(pr.id)) body.baru = true;
  if (CH.model) body.model = CH.model;
  if (mode === 'kerjakan') body.konfirmasi = pr.id;
  CH.kirimSibuk = true; chMsg(''); chRender();
  try {
    let j;
    if (CH_DEMO){ j = chDemoKirim(body); if (j.kode !== 202){ chMsg(chPesanGalat(j)); return; } }
    else {
      const r = await chFetch('/chat/kirim', 'POST', body);
      if (!r.ok){
        const g = await chGalat(r);
        if (g.kode === 503 && CH.status) CH.status.pelaksana.tersambung = false;
        if (!chTolak(g, 'kirim')) chMsg(chPesanGalat(g));
        return;
      }
      j = await r.json().catch(() => ({}));
    }
    const tugas = String(j.tugas || '');
    if (!CH_RE_TG.test(tugas)){ chMsg('Terkirim, tetapi balasan server tidak dikenal.'); chStatusNanti(); return; }
    CH.pesan.set(tugas, pesan);
    pr = chPr(body.proyek) || pr;
    const t = chT(tugas, pr.id, mode, body.akun);
    if (body.baru){ const b = el('p', 'ch-i pisah', 'Percakapan baru'); if (t.o) t.o.before(b); else chWadah(pr.id).append(b); }
    if (j.status === 'antre'){
      if (!pr.antre.some(a => a.tugas === tugas)) pr.antre.push({tugas, mode, akun:body.akun, dibuat:Date.now()});
      chUm('Pesan masuk antrean nomor ' + (Number(j.posisi) || pr.antre.length));
    } else if (!t.final) chOwner(t, pesan, Date.now());
    chEl.pesan.value = ''; chTinggi();
    CH.baru.delete(pr.id);
    chModeAtur('rencana');            // mode tidak lengket: setelah kirim kembali ke Rencana
    chGulirBawah();
  } catch (err){ chMsg('Tidak bisa mengirim · periksa sambungan ke kantor.'); }
  finally { CH.kirimSibuk = false; chRender(); }
});
chEl.kunciF.addEventListener('submit', e => {
  e.preventDefault();
  const k = chEl.kunciI.value.trim();
  if (!CH_RE_KUNCI.test(k)){
    chEl.kunciS.textContent = 'Kunci perintah berupa 32 karakter heksa atau lebih (0–9, a–f).'; chEl.kunciS.classList.remove('ok');
    chEl.kunciI.setAttribute('aria-invalid', 'true'); chEl.kunciI.focus(); return;
  }
  chEl.kunciI.value = ''; chEl.kunciI.removeAttribute('aria-invalid');
  chKunciSimpan(k); chEl.kunciS.textContent = 'Membuka…'; chEl.kunciS.classList.add('ok');
  chSambung(true);
});
async function chSambung(dariKunci){
  if (CH_DEMO){ chDemoMulai(); return; }
  if (!CH.kunci){ chMintaKunci(''); return; }
  const ok = await chMuatStatus(true);
  if (!ok) return;
  chAliranBuka();
  if (dariKunci && matchMedia('(pointer:fine)').matches) chEl.pesan.focus();
}
// dipanggil pilihTab() saat tab Perintah dibuka
function chBuka(){
  if (!CH.mulai){
    CH.mulai = true;
    if (CH_DEMO){ chDemoMulai(); return; }
    CH.kunci = chKunciMuat();
    if (!CH.kunci){ chMintaKunci(''); return; }
    chInfo('Menghubungkan…', '', false); chSambung(); return;
  }
  if (CH.tampil === 'isi'){ chGulirBawah(); if (!CH_DEMO && Date.now() - CH.statusWaktu > 15000) chMuatStatus(); }
}

/* --- mode demo: balasan palsu lokal, tanpa request --- */
const CH_DM = {pl:true, waktu:new Map(), proyek:[
  {id:'simpeg', nama:'SIMPEG', kerjakan:true, akun:[{id:'akun1', label:'Akun 1'}, {id:'akun2', label:'Akun 2'}], aktif:null, antre:[]},
  {id:'sinergi', nama:'Sinergi', kerjakan:true, akun:[{id:'akun1', label:'Akun 1'}, {id:'akun2', label:'Akun 2'}], aktif:null, antre:[]},
  {id:'kantor-divisi-3d', nama:'Kantor 3D (hanya Rencana)', kerjakan:false, akun:[{id:'akun1', label:'Akun 1'}], aktif:null, antre:[]},
]};
function chDemoStatus(){
  return {pelaksana:{tersambung:CH_DM.pl, versi:'demo'}, batasMenit:{rencana:20, kerjakan:60}, maksSerentak:2, model:['sonnet', 'opus'], terkunciSampai:null,
    proyek:CH_DM.proyek.map(p => ({id:p.id, nama:p.nama, kerjakan:p.kerjakan, akun:p.akun, aktif:p.aktif && {...p.aktif}, antre:p.antre.map(a => ({...a}))}))};
}
function chDemoId(){ const b = new Uint8Array(8); crypto.getRandomValues(b); return 't-' + Date.now().toString(36) + '-' + [...b].map(x => x.toString(16).padStart(2, '0')).join(''); }
const chDemoEmit = (p, t, e) => chTerima({kind:'chat', ts:Date.now(), tugas:t.tugas, proyek:p.id, akun:t.akun, ...e});
const chDemoAntre = p => chTerima({kind:'chat', ts:Date.now(), tahap:'antrean', proyek:p.id, antre:p.antre.map(a => ({...a}))});
const CH_DEMO_TEKS = {
  rencana:'Penyebab utama export Excel lambat ada di PegawaiController::exportExcel():\n\n' +
    '1. Data diambil sekaligus dengan findAll() (±12.000 baris) lalu ditulis sel per sel.\n' +
    '2. Setiap baris memanggil getJabatan() → satu query tambahan per pegawai (N+1).\n' +
    '3. View memakai <?= esc($nama) ?> — sudah aman, tidak perlu diubah.\n\n' +
    'Rencana (belum ada file yang diubah):\n- Ganti ke satu query JOIN jabatan.\n- Tulis per 1.000 baris.\n- Uji ulang dengan 12.000 data; target di bawah 5 detik.\n\n' +
    'Kirim dengan mode Kerjakan bila rencana ini disetujui.',
  kerjakan:'Perubahan selesai di PegawaiController.php:\n- Query JOIN jabatan (N+1 hilang).\n- Penulisan per 1.000 baris.\n\n' +
    'Tes php spark test --filter Pegawai: 14 lulus. git push tidak dijalankan (ditolak aturan).',
};
function chDemoJalan(p, t){
  p.aktif = {tugas:t.tugas, mode:t.mode, akun:t.akun, mulai:Date.now()};
  const kj = t.mode === 'kerjakan', teks = CH_DEMO_TEKS[t.mode];
  const alat = kj ? [['Read', 'app/Controllers/PegawaiController.php'], ['Grep', 'exportExcel'], ['Edit', 'app/Controllers/PegawaiController.php'], ['Bash', 'php spark test --filter Pegawai']]
    : [['Read', 'app/Controllers/PegawaiController.php'], ['Grep', 'exportExcel'], ['Read', 'app/Models/PegawaiModel.php']];
  const potong = []; for (let i = 0; i < teks.length;){ const n = 14 + Math.floor(Math.random() * 26); potong.push(teks.slice(i, i + n)); i += n; }
  const nas = [[900, {tahap:'mulai', mode:t.mode, sessionId:'demo', lanjut:true}]];
  alat.slice(0, 2).forEach(([a, r]) => nas.push([700, {tahap:'alat', alat:a, ringkas:r}]));
  const bagi = Math.floor(potong.length / 2);
  potong.slice(0, bagi).forEach(s => nas.push([110, {tahap:'teks', teks:s}]));
  alat.slice(2).forEach(([a, r]) => nas.push([900, {tahap:'alat', alat:a, ringkas:r}]));
  potong.slice(bagi).forEach(s => nas.push([110, {tahap:'teks', teks:s}]));
  nas.push([600, {tahap:'selesai', teks, ditolak:kj ? [{alat:'Bash', ringkas:'git push origin master'}] : [], sessionId:'demo'}]);
  let jeda = 0, urut = 0; const id = [];
  for (const [d, e] of nas){
    jeda += d;
    id.push(setTimeout(() => {
      if (e.tahap === 'selesai'){ e.durasiMs = Date.now() - p.aktif.mulai; chDemoSelesai(p, t.tugas); }
      chDemoEmit(p, t, {urut:++urut, ...e});
    }, jeda));
  }
  CH_DM.waktu.set(t.tugas, id);
}
function chDemoSelesai(p, tugas){
  (CH_DM.waktu.get(tugas) || []).forEach(clearTimeout); CH_DM.waktu.delete(tugas);
  if (p.aktif && p.aktif.tugas === tugas) p.aktif = null;
  setTimeout(() => {
    if (p.aktif || !p.antre.length) return;
    const n = p.antre.shift(); chDemoAntre(p);
    chDemoJalan(p, {...n, pesan:CH.pesan.get(n.tugas) || ''});
  }, 700);
}
function chDemoKirim(b){
  if (!CH_DM.pl) return {kode:503};
  const p = CH_DM.proyek.find(x => x.id === b.proyek); if (!p) return {kode:400, pesan:'proyek tidak dikenal'};
  if (b.mode === 'kerjakan' && (!p.kerjakan || b.konfirmasi !== p.id)) return {kode:403, pesan:'kerjakan tidak diizinkan untuk proyek ini'};
  const antre = !!p.aktif || CH_DM.proyek.filter(x => x.aktif).length >= 2;
  if (antre && p.antre.length >= 3) return {kode:409};
  const t = {tugas:chDemoId(), mode:b.mode, akun:b.akun, dibuat:Date.now()};
  if (antre) p.antre.push({...t});
  else p.aktif = {tugas:t.tugas, mode:t.mode, akun:t.akun, mulai:Date.now()};   // dipesan langsung supaya kiriman cepat berikutnya masuk antrean
  const posisi = antre ? p.antre.length : undefined;
  setTimeout(() => {
    chDemoEmit(p, t, {urut:0, tahap:'dikirim', mode:b.mode, pesan:b.pesan, antre, posisi});
    if (antre) chDemoAntre(p); else chDemoJalan(p, t);
  }, 80);
  return {kode:202, tugas:t.tugas, status:antre ? 'antre' : 'dikirim', posisi};
}
function chDemoHentikan(tugas){
  for (const p of CH_DM.proyek){
    if (p.aktif && p.aktif.tugas === tugas){
      const t = {tugas, akun:p.aktif.akun};
      setTimeout(() => { chDemoSelesai(p, tugas); chDemoEmit(p, t, {tahap:'dihentikan', oleh:'owner'}); }, 500);
      return;
    }
    const i = p.antre.findIndex(a => a.tugas === tugas);
    if (i >= 0){ const [a] = p.antre.splice(i, 1); chDemoEmit(p, a, {tahap:'dibatalkan', alasan:'owner'}); chDemoAntre(p); return; }
  }
}
function chDemoMulai(){
  chEl.demo.hidden = false;
  chTerapkanStatus(chDemoStatus());
  // satu percakapan contoh yang sudah selesai supaya tampilan tidak kosong
  const p = CH_DM.proyek[0], t = {tugas:chDemoId(), akun:'akun1'}, ts = Date.now() - 6 * 60000;
  chTerima({kind:'chat', ts, tugas:t.tugas, proyek:p.id, akun:t.akun, urut:0, tahap:'dikirim', mode:'rencana', pesan:'Jelaskan singkat struktur folder app/ di proyek ini.', antre:false});
  chDemoEmit(p, t, {urut:1, tahap:'mulai', mode:'rencana', sessionId:'demo', lanjut:false});
  chDemoEmit(p, t, {urut:2, tahap:'alat', alat:'Glob', ringkas:'app/**/*.php'});
  chDemoEmit(p, t, {urut:3, tahap:'alat', alat:'Read', ringkas:'app/Config/Routes.php'});
  chDemoEmit(p, t, {urut:4, tahap:'selesai', durasiMs:48000, ditolak:[], sessionId:'demo',
    teks:'Struktur app/ mengikuti CodeIgniter 4:\n- Controllers/ → 14 controller (Pegawai, Cuti, Laporan, …)\n- Models/ → 11 model\n- Views/ → layout + 38 view\n- Config/Routes.php → semua rute, filter auth di grup admin.'});
  chGulirBawah();
}
chEl.demoPl.addEventListener('click', () => {
  CH_DM.pl = !CH_DM.pl;
  chEl.demoPl.textContent = CH_DM.pl ? 'Simulasi pelaksana putus' : 'Sambungkan pelaksana lagi';
  chTerima({kind:'chat', ts:Date.now(), tahap:'pelaksana', tersambung:CH_DM.pl});
});

// panel Keterangan & Pengaturan, menu sudut kamera, lalu pengaturan tersimpan diterapkan sebelum kantor dibangun
bangunKeterangan(); bangunPengaturan(); bangunMenu();
terapkanKualitas(); terapkanLabel(); terapkanKamera(); terapkanPad();
connect();
// alat bantu uji: buka dengan ?debug untuk memeriksa keadaan dari konsol (window.KANTOR)
if (params.has('debug')) window.KANTOR = {renderer, scene, state, ACTORS, RUANG, KURSI, KURSI_BY, OBROL, handle, get R(){ return R; }, get ORANG(){ return ORANG; },
  get boss(){ return boss; }, get reception(){ return reception; }, camera, controls, get mode(){ return mode; }, aturLantai, keDunia,
  SET, key, pilihSudut, select, PEG, ENV, lookAcak, bukaPenampilan, bukaInfoDivisi, setNama, setLook, terapkanKualitas, terapkanLingkungan, ubahSet,
  get kualitas(){ return {pr:prAktif, turunPR, jauhPR, fps:FPS, bayang:key.shadow.mapSize.x, tipe:renderer.shadowMap.type, buffer:[renderer.domElement.width, renderer.domElement.height]}; }};
