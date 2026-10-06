/* PADEV STUDIO CLAUDE — model kantor 3D dua lantai.
   window.PadevKantor.build(THREE, orang) -> { model, lantai2, kolom, hantu, Y2, GAP, tick } */
(function () {
  'use strict';
  var Y2 = 3.1, GAP = 5.4;

  function build(THREE, ORANG) {
    var seed = 7;
    function rand() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    function pick(a) { return a[Math.floor(rand() * a.length)]; }
    var anims = [], mats = {};
    /* ---------- daftar kursi / titik untuk mode live ----------
       tiap kursi: {id, lantai, x, z, r, jenis, duduk, layar, dekat:[x,z], akses:'node', pemilik} (koordinat lokal grup lantai) */
    var LANTAI = 1, kursi = [];
    var titik = [];   /* titik santai berdiri (ngopi/rokok): bentuk sama dengan kursi supaya bisa dipakai rute() */
    function daftarTitik(k) { k.id = 'titik_' + k.jenis + '_' + (titik.filter(function (t) { return t.jenis === k.jenis; }).length + 1); k.lantai = k.lantai || LANTAI; k.duduk = false; k.pemilik = null; titik.push(k); return k; }
    function daftarKursi(k) { k.id = 'kursi_' + (kursi.length + 1); k.lantai = k.lantai || LANTAI; if (k.duduk == null) k.duduk = true; k.pemilik = null; kursi.push(k); return k; }
    function layarDi(g, nama) { var f = null; g.traverse(function (c) { if (!f && c.isMesh && c.name === nama) f = c; }); return f; }

    function mat(name, color, o) {
      o = o || {};
      if (mats[name]) return mats[name];
      var m = new THREE.MeshStandardMaterial({ color: color, roughness: o.r == null ? .82 : o.r, metalness: o.m || 0 });
      if (o.e) { m.emissive = new THREE.Color(o.e); m.emissiveIntensity = o.ei == null ? .6 : o.ei; }
      if (o.t) { m.transparent = true; m.opacity = o.t; m.depthWrite = false; }
      if (o.ds) m.side = THREE.DoubleSide;
      if (o.map) m.map = o.map;
      m.name = name; return (mats[name] = m);
    }

    /* ---------- tekstur kanvas ---------- */
    function canvasTex(w, h, draw) {
      var c = document.createElement('canvas'); c.width = w; c.height = h;
      var x = c.getContext('2d'); draw(x, w, h, 0);
      var t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
      return { c: c, x: x, t: t };
    }
    function F(sz, wt) { return (wt || 700) + ' ' + sz + 'px "Plus Jakarta Sans", system-ui, sans-serif'; }
    var MONO = function (sz) { return '500 ' + sz + 'px "SFMono-Regular", Menlo, Consolas, monospace'; };

    function drawScreen(k, c, w, h, t) {
      c.setTransform(1, 0, 0, 1, 0, 0); c.textAlign = 'left'; c.textBaseline = 'alphabetic'; c.shadowBlur = 0;
      var light = k === 'diagram' || k === 'infra';
      if (k === 'welcome') { var gr = c.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#ffc59a'); gr.addColorStop(1, '#e5896a'); c.fillStyle = gr; }
      else c.fillStyle = light ? '#fbfbf7' : k === 'direktori' || k === 'naik' ? '#1d2433' : k === 'pintu' ? '#f4f1ea' : '#0f1724';
      c.fillRect(0, 0, w, h);
      function title(s) { c.fillStyle = '#8fa3bf'; c.font = F(17); c.fillText(s, 20, 32); }
      function grid() {
        c.strokeStyle = 'rgba(143,163,191,.15)'; c.lineWidth = 1;
        for (var gx = 20; gx < w; gx += 40) { c.beginPath(); c.moveTo(gx, 48); c.lineTo(gx, h - 18); c.stroke(); }
        for (var gy = 48; gy < h - 10; gy += 40) { c.beginPath(); c.moveTo(20, gy); c.lineTo(w - 20, gy); c.stroke(); }
      }
      function rbox(x, y, bw, bh, col, fill) { c.beginPath(); c.roundRect ? c.roundRect(x, y, bw, bh, 10) : c.rect(x, y, bw, bh); if (fill) { c.fillStyle = fill; c.fill(); } c.strokeStyle = col; c.lineWidth = 4; c.stroke(); }
      function arrow(x1, y1, x2, y2, col) { c.strokeStyle = col; c.lineWidth = 4; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); var a = Math.atan2(y2 - y1, x2 - x1); c.beginPath(); c.moveTo(x2, y2); c.lineTo(x2 - 14 * Math.cos(a - .45), y2 - 14 * Math.sin(a - .45)); c.moveTo(x2, y2); c.lineTo(x2 - 14 * Math.cos(a + .45), y2 - 14 * Math.sin(a + .45)); c.stroke(); }
      var i, xx, yy;
      if (k === 'grafik' || k === 'bisnis') {
        title(k === 'grafik' ? 'CPU KLASTER · 24 JAM' : 'PENDAPATAN · KUARTAL INI'); grid();
        c.beginPath();
        for (i = 0; i <= 30; i++) {
          xx = 20 + i * (w - 40) / 30;
          var v = k === 'grafik' ? .5 + .22 * Math.sin(i * .55 + t * 1.3) + .1 * Math.sin(i * 1.7 + t * .8) : .22 + i / 44 + .06 * Math.sin(i * .9);
          yy = h - 20 - v * (h - 80); if (i) c.lineTo(xx, yy); else c.moveTo(xx, yy);
        }
        c.strokeStyle = k === 'grafik' ? '#34d399' : '#60a5fa'; c.lineWidth = 4; c.stroke();
        c.lineTo(w - 20, h - 20); c.lineTo(20, h - 20); c.closePath(); c.fillStyle = k === 'grafik' ? 'rgba(52,211,153,.18)' : 'rgba(96,165,250,.18)'; c.fill();
        c.fillStyle = '#e6edf6'; c.font = F(34, 800); c.textAlign = 'right';
        c.fillText(k === 'grafik' ? Math.round(41 + 9 * Math.sin(t * .9)) + '%' : '+18%', w - 22, 38); c.textAlign = 'left';
      } else if (k === 'status') {
        title('STATUS LAYANAN');
        var names = ['api-gateway', 'auth', 'database', 'cache', 'antrian', 'storage'];
        for (i = 0; i < names.length; i++) {
          yy = 72 + i * 36; var warn = i === 4, on = !warn || Math.sin(t * 5) > 0;
          c.fillStyle = warn ? (on ? '#fbbf24' : '#7c5d12') : '#34d399'; c.beginPath(); c.arc(34, yy - 6, 8, 0, Math.PI * 2); c.fill();
          c.fillStyle = '#e6edf6'; c.font = F(22, 600); c.fillText(names[i], 54, yy);
          c.fillStyle = warn ? '#fbbf24' : '#8fa3bf'; c.textAlign = 'right'; c.fillText(warn ? 'LAMBAT · 180 ms' : 'OK · ' + (12 + i * 7) + ' ms', w - 22, yy); c.textAlign = 'left';
        }
      } else if (k === 'cicd') {
        title('PIPELINE CI/CD · main');
        var st = ['Build', 'Test', 'Scan', 'Deploy'], prog = (t * .25) % 1;
        for (i = 0; i < 4; i++) {
          xx = 22 + i * 122; var done = i < 3;
          rbox(xx, 78, 104, 74, done ? '#34d399' : '#60a5fa', done ? 'rgba(52,211,153,.12)' : 'rgba(96,165,250,.12)');
          c.fillStyle = '#e6edf6'; c.font = F(22, 700); c.fillText(st[i], xx + 14, 112);
          c.fillStyle = done ? '#34d399' : '#60a5fa'; c.font = F(16, 700); c.fillText(done ? 'SELESAI' : 'BERJALAN', xx + 14, 138);
          if (i < 3) arrow(xx + 104, 115, xx + 120, 115, '#475569');
        }
        c.fillStyle = '#1e293b'; c.fillRect(22, 190, w - 44, 18); c.fillStyle = '#60a5fa'; c.fillRect(22, 190, (w - 44) * prog, 18);
        c.fillStyle = '#8fa3bf'; c.font = F(18, 600); c.fillText('rilis v2.4.' + (1 + Math.floor(t / 4) % 9) + ' → produksi', 22, 242);
      } else if (k === 'uptime') {
        title('UPTIME 30 HARI');
        c.fillStyle = '#34d399'; c.font = F(92, 800); c.textAlign = 'center'; c.fillText('99,98%', w / 2, 170); c.textAlign = 'left';
        for (i = 0; i < 30; i++) { c.fillStyle = i === 17 ? '#fbbf24' : '#34d399'; c.fillRect(24 + i * 15.5, 214, 11, 42); }
      } else if (k === 'log') {
        title('LOG · produksi');
        var L = ['[INFO] deploy v2.4.1 selesai', '[OK]   health check 200', '[INFO] autoscale +1 pod', '[OK]   backup harian beres', '[WARN] antrian 180 ms', '[INFO] cache hit 97%', '[OK]   sertifikat valid 84 hari', '[INFO] job cron sukses'];
        var off = Math.floor(t * 1.2);
        c.font = MONO(19);
        for (i = 0; i < 6; i++) { var line = L[(i + off) % L.length]; c.fillStyle = line.indexOf('WARN') > 0 ? '#fbbf24' : line.indexOf('OK') > 0 ? '#34d399' : '#93c5fd'; c.fillText(line, 22, 72 + i * 36); }
      } else if (k === 'peta') {
        title('TRAFIK JARINGAN');
        var N = [[90, 110], [230, 80], [380, 120], [150, 220], [300, 210], [440, 230]], E = [[0, 1], [1, 2], [0, 3], [1, 4], [2, 5], [3, 4], [4, 5]];
        c.strokeStyle = 'rgba(96,165,250,.45)'; c.lineWidth = 3;
        E.forEach(function (e) { c.beginPath(); c.moveTo(N[e[0]][0], N[e[0]][1]); c.lineTo(N[e[1]][0], N[e[1]][1]); c.stroke(); });
        E.forEach(function (e, j) { var p = (t * .5 + j * .37) % 1, a = N[e[0]], b = N[e[1]]; c.fillStyle = '#fbbf24'; c.beginPath(); c.arc(a[0] + (b[0] - a[0]) * p, a[1] + (b[1] - a[1]) * p, 5, 0, Math.PI * 2); c.fill(); });
        N.forEach(function (n) { c.fillStyle = '#34d399'; c.beginPath(); c.arc(n[0], n[1], 12, 0, Math.PI * 2); c.fill(); });
      } else if (k === 'kode' || k === 'kode2') {
        var code = k === 'kode' ? [
          [['#c084fc', 'async function '], ['#60a5fa', 'deploy'], ['#e6edf6', '(env) {']],
          [['#c084fc', '  const '], ['#e6edf6', 'build = '], ['#c084fc', 'await '], ['#60a5fa', 'ci.run'], ['#e6edf6', '();']],
          [['#c084fc', '  if '], ['#e6edf6', '(!build.ok) '], ['#c084fc', 'return '], ['#60a5fa', 'retry'], ['#e6edf6', '();']],
          [['#64748b', '  // uji dulu, baru rilis']],
          [['#c084fc', '  await '], ['#60a5fa', 'test'], ['#e6edf6', '(build);']],
          [['#c084fc', '  return '], ['#60a5fa', 'release'], ['#e6edf6', '(env, '], ['#fbbf24', "'v2.4'"], ['#e6edf6', ');']],
          [['#e6edf6', '}']]
        ] : [
          [['#c084fc', 'class '], ['#fbbf24', 'Booking '], ['#c084fc', 'extends '], ['#fbbf24', 'Model'], ['#e6edf6', ' {']],
          [['#e6edf6', '  table = '], ['#34d399', "'bookings'"], ['#e6edf6', ';']],
          [['#60a5fa', '  jadwal'], ['#e6edf6', '(tgl) {']],
          [['#c084fc', '    return '], ['#e6edf6', 'this.'], ['#60a5fa', 'where'], ['#e6edf6', '('], ['#34d399', "'tgl'"], ['#e6edf6', ', tgl);']],
          [['#e6edf6', '  }']],
          [['#64748b', '  // TODO: cache 5 menit']],
          [['#e6edf6', '}']]
        ];
        c.fillStyle = '#131c2b'; c.fillRect(0, 0, 46, h);
        c.font = MONO(18);
        for (i = 0; i < code.length; i++) {
          yy = 40 + i * 34; c.fillStyle = '#475569'; c.fillText(String(i + 1), 14, yy);
          xx = 60; code[i].forEach(function (tok) { c.fillStyle = tok[0]; c.fillText(tok[1], xx, yy); xx += c.measureText(tok[1]).width; });
        }
        if (Math.sin(t * 6) > 0) { c.fillStyle = '#e6edf6'; c.fillRect(xx + 2, 40 + (code.length - 1) * 34 - 18, 10, 22); }
      } else if (k === 'sprint') {
        title('SPRINT 12 · BURNDOWN'); grid();
        c.setLineDash([8, 8]); c.strokeStyle = '#64748b'; c.lineWidth = 3; c.beginPath(); c.moveTo(20, 60); c.lineTo(w - 20, h - 20); c.stroke(); c.setLineDash([]);
        c.strokeStyle = '#fbbf24'; c.lineWidth = 4; c.beginPath();
        var pts = [0, .08, .12, .25, .3, .42, .5, .55, .66];
        for (i = 0; i < pts.length; i++) { xx = 20 + i * (w - 40) / 12; yy = 60 + pts[i] * (h - 80); if (i) c.lineTo(xx, yy); else c.moveTo(xx, yy); }
        c.stroke();
        c.fillStyle = '#e6edf6'; c.font = F(30, 800); c.textAlign = 'right'; c.fillText('18/24 poin', w - 22, 38); c.textAlign = 'left';
      } else if (k === 'welcome') {
        c.fillStyle = '#ffffff'; c.font = F(54, 800); c.fillText('Selamat Datang', 34, 118);
        c.font = F(24, 700); c.fillText('di PADEV STUDIO CLAUDE', 36, 160);
        c.fillStyle = 'rgba(255,255,255,.85)'; c.font = F(18, 600); c.fillText('Ruang Diskusi Klien · santai saja, kopi sudah siap', 36, 236);
      } else if (k === 'diagram') {
        rbox(24, 60, 120, 64, '#3b6cf6'); rbox(196, 60, 120, 64, '#34a853'); rbox(368, 60, 120, 64, '#ea4335');
        rbox(24, 200, 120, 64, '#fbbc05'); rbox(196, 200, 120, 64, '#3b6cf6'); rbox(368, 200, 120, 64, '#34a853');
        c.font = F(22, 700); c.fillStyle = '#1d2433';
        c.fillText('Klien', 52, 100); c.fillText('API', 234, 100); c.fillText('Database', 378, 100); c.fillText('CI', 72, 240); c.fillText('CD', 238, 240); c.fillText('Rilis', 400, 240);
        arrow(146, 92, 192, 92, '#1d2433'); arrow(318, 92, 364, 92, '#1d2433'); arrow(146, 232, 192, 232, '#1d2433'); arrow(318, 232, 364, 232, '#1d2433');
        c.fillStyle = '#ea4335'; c.font = F(20, 700); c.fillText('alur fitur booking', 24, 34);
      } else if (k === 'infra') {
        rbox(176, 24, 160, 54, '#3b6cf6'); c.font = F(20, 700); c.fillStyle = '#1d2433'; c.fillText('Load Balancer', 190, 58);
        for (i = 0; i < 3; i++) { rbox(40 + i * 160, 128, 112, 50, '#34a853'); c.fillStyle = '#1d2433'; c.fillText('App ' + (i + 1), 66 + i * 160, 160); arrow(256, 80, 96 + i * 160, 126, '#475569'); }
        rbox(90, 238, 150, 54, '#ea4335'); rbox(290, 238, 150, 54, '#fbbc05');
        c.fillStyle = '#1d2433'; c.fillText('DB utama', 118, 272); c.fillText('Replika', 326, 272);
        arrow(96, 180, 150, 236, '#475569'); arrow(256, 180, 180, 236, '#475569'); arrow(242, 265, 288, 265, '#475569');
      } else if (k === 'direktori' || k === 'naik') {
        c.fillStyle = '#3b6cf6'; c.fillRect(0, 0, w, 10);
        c.fillStyle = '#ffffff'; c.font = F(k === 'naik' ? 52 : 60, 800); c.fillText(k === 'naik' ? 'NAIK KE' : 'LANTAI 2', 32, 92);
        if (k === 'naik') c.fillText('LANTAI 2', 32, 150);
        var rows = ['Ruang Pimpinan', 'DevOps · NOC', 'Ruang Server', 'Divisi Programmer', 'Lounge & Pantry', 'Teras'];
        var cols = ['#4285f4', '#ea4335', '#fbbc05', '#34a853', '#4285f4', '#34a853'];
        for (i = 0; i < rows.length; i++) { yy = (k === 'naik' ? 214 : 160) + i * 46; c.fillStyle = cols[i]; c.fillRect(32, yy - 20, 10, 26); c.fillStyle = '#e6edf6'; c.font = F(26, 700); c.fillText(rows[i], 56, yy); }
      } else if (k === 'pintu') {
        c.fillStyle = '#d64534'; c.fillRect(0, 0, w, 40); c.fillStyle = '#ffffff'; c.font = F(24, 800); c.fillText('AKSES TERBATAS', 18, 29);
        c.fillStyle = '#1d2433'; c.font = F(40, 800); c.fillText('RUANG SERVER', 18, 100);
      }
    }
    function screenMat(name, kind, animEvery, w, h) {
      w = w || 512; h = h || 288;
      var S = canvasTex(w, h, function (x, cw, ch) { drawScreen(kind, x, cw, ch, 0); });
      var m = new THREE.MeshBasicMaterial({ map: S.t, toneMapped: false }); m.name = 'layar_' + name;
      if (animEvery) anims.push({ every: animEvery, acc: 0, f: function (t) { drawScreen(kind, S.x, w, h, t); S.t.needsUpdate = true; } });
      return m;
    }

    var raisedTex = canvasTex(128, 128, function (c) { c.fillStyle = '#e4e8ed'; c.fillRect(0, 0, 128, 128); c.strokeStyle = '#b9c0c8'; c.lineWidth = 4; c.strokeRect(2, 2, 124, 124); });
    raisedTex.t.wrapS = raisedTex.t.wrapT = THREE.RepeatWrapping; raisedTex.t.repeat.set(5 / .6, 7 / .6);
    var plankTex = canvasTex(256, 256, function (c) { c.fillStyle = '#c49a6c'; c.fillRect(0, 0, 256, 256); c.fillStyle = '#a97f55'; for (var y = 0; y < 256; y += 32) c.fillRect(0, y, 256, 3); });
    plankTex.t.wrapS = plankTex.t.wrapT = THREE.RepeatWrapping; plankTex.t.repeat.set(6 / 1.6, 20 / 1.6);

    var K = {
      slab: mat('slab', '#cfc6b8'), wall: mat('dinding', '#f5f1ea'), trim: mat('list_kayu', '#d9d2c6'),
      parquet: mat('lantai_parket', '#e8dcc8'), client: mat('lantai_diskusi_klien', '#f3e2cb'), meet: mat('lantai_rapat', '#d7e3d2'),
      studio: mat('lantai_studio', '#f1e6d4'), store: mat('lantai_gudang', '#d6d0c6'),
      tile: mat('keramik_toilet', '#e1eaee'), lobby: mat('lantai_lobby', '#ece6dc'), pantry: mat('lantai_pantry', '#f0e2c9'),
      lounge: mat('lantai_lounge', '#e6d8c2'), musholla: mat('karpet_musholla', '#5f8f6b'),
      wood: mat('kayu', '#b8875a'), dark: mat('kayu_gelap', '#6b4a33'), metal: mat('besi', '#8a8f98', { r: .5, m: .3 }),
      black: mat('hitam', '#23262d', { r: .5 }), screen: mat('layar', '#11151c', { e: '#4d96ff', ei: .7, r: .3 }),
      screenG: mat('layar_hijau', '#11151c', { e: '#27c07a', ei: .7, r: .3 }), screenP: mat('layar_ungu', '#11151c', { e: '#b084ff', ei: .7, r: .3 }),
      chair: mat('kursi', '#3b4252'), white: mat('putih', '#f7f7f2', { r: .5 }), porcelain: mat('porselen', '#ffffff', { r: .25 }),
      glass: mat('kaca', '#cfeaf7', { t: .25, r: .05 }), window: mat('jendela', '#a9d6f0', { e: '#6fb7e6', ei: .35, r: .1 }),
      blue: mat('biru_brand', '#3b6cf6', { r: .6 }), coral: mat('koral', '#e76f51'), teal: mat('teal', '#2a9d8f'),
      yellow: mat('kuning', '#e9b949'), sofa: mat('sofa', '#56657a'), cream: mat('krem', '#efe6d6'),
      pot: mat('pot', '#c9b8a3'), leaf: mat('daun', '#4f9a5b'), leaf2: mat('daun_muda', '#6cb572'),
      grass: mat('rumput', '#8fbf6a'), deck: mat('dek_kayu', '#c49a6c'), stone: mat('batu', '#b8b4ab'),
      water: mat('air', '#7cc4e8', { r: .1, e: '#3a8fc0', ei: .15 }), trunk: mat('batang', '#7a5a40'),
      cardboard: mat('kardus', '#c8a27a'), rugPray: mat('sajadah', '#8e3b46'), rugPray2: mat('sajadah_hijau', '#2f6b54'),
      gold: mat('emas', '#d4b25a', { r: .4, m: .3 }), paving: mat('paving', '#d9d3c8'),
      gBlue: mat('g_biru', '#4285f4', { r: .55 }), gRed: mat('g_merah', '#ea4335', { r: .55 }),
      gYellow: mat('g_kuning', '#fbbc05', { r: .55 }), gGreen: mat('g_hijau', '#34a853', { r: .55 }),
      meet2: mat('karpet_rapat_2', '#cfdcf5'), shell: mat('cangkang_nap_pod', '#fbfaf6', { r: .35, ds: true }),
      pingpong: mat('meja_pingpong', '#2a5caa', { r: .5 }), moss: mat('lumut', '#3f7f4a'),
      // lantai 2 & tambahan
      ceo2: mat('lantai_pimpinan', '#d8c7ab'), noc: mat('lantai_noc', '#cdd5e1'), raised: mat('lantai_server', '#ffffff', { r: .7, map: raisedTex.t }),
      lounge2: mat('lantai_lounge_2', '#efe3cf'), prog: mat('lantai_programmer', '#e4e0d6'), plank: mat('dek_teras', '#ffffff', { r: .85, map: plankTex.t }),
      leather: mat('kulit_sofa', '#5a3d2b', { r: .5 }), navyRug: mat('karpet_navy', '#3d4f73'), rack: mat('rak_server', '#1c1f24', { r: .45, m: .2 }),
      rackUnit: mat('unit_server', '#2c313a', { r: .5 }), glassDark: mat('kaca_gelap', '#22303d', { t: .45, r: .1 }),
      red: mat('merah_pemadam', '#d64534', { r: .45 }), outdoor: mat('sofa_outdoor', '#e9e1d2'), sofaWarm: mat('sofa_hangat', '#e5896a'),
      terracotta: mat('karpet_bulat', '#e8b996'), pillar: mat('kolom', '#f2efe9', { r: .6 }), white2: mat('putih_dingin', '#eef1f4', { r: .45 }),
      steel: mat('baja', '#b9c0c8', { r: .35, m: .35 }), cYellow: mat('kabel_kuning', '#f2c230'), cBlue: mat('kabel_biru', '#3b82f6'),
      cOrange: mat('kabel_oranye', '#f97316'), planter: mat('pot_kayu', '#5b4636'),
      warm: mat('lampu_hangat', '#fff1c9', { e: '#ffd27a', ei: 1.2 }), keycap: mat('keycap', '#f1eee6', { r: .5 })
    };
    var GC = [K.gBlue, K.gRed, K.gYellow, K.gGreen];
    var BOOKS = ['#e76f51', '#2a9d8f', '#e9b949', '#4d96ff', '#8e7dbe', '#f4f1ea'].map(function (c, i) { return mat('buku_' + i, c); });
    var LEDS = ['#19e68c', '#4d96ff', '#19e68c', '#ffb020'].map(function (c, i) { return mat('led_' + i, '#111111', { e: c, ei: 1.2 }); });
    anims.push({ every: 0, f: function (t) { LEDS.forEach(function (m, i) { m.emissiveIntensity = Math.sin(t * (3.1 + i * 2.3) + i * 1.7) > -.2 ? 1.4 : .15; }); } });
    var beacon = mat('lampu_status_build', '#0f3', { e: '#19e68c', ei: 1.5 });
    anims.push({ every: 0, f: function (t) { beacon.emissiveIntensity = .6 + .9 * (.5 + .5 * Math.sin(t * 3)); } });
    var SCR = {
      grafik: screenMat('grafik', 'grafik', .25), status: screenMat('status', 'status', .3), cicd: screenMat('cicd', 'cicd', .2),
      uptime: screenMat('uptime', 'uptime'), log: screenMat('log', 'log', .5), peta: screenMat('peta', 'peta', .1),
      kode: screenMat('kode', 'kode', .5), kode2: screenMat('kode2', 'kode2', .5), bisnis: screenMat('bisnis', 'bisnis'),
      sprint: screenMat('sprint', 'sprint'), welcome: screenMat('welcome', 'welcome'),
      diagram: screenMat('diagram', 'diagram', 0, 512, 320), infra: screenMat('infra', 'infra', 0, 512, 320),
      direktori: screenMat('direktori', 'direktori', 0, 384, 460), naik: screenMat('naik', 'naik', 0, 384, 500), pintu: screenMat('pintu', 'pintu', 0, 384, 128)
    };

    /* ---------- pembantu geometri ---------- */
    function B(p, name, w, h, d, m, x, y, z, ry) {
      var me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      me.name = name; me.position.set(x, y + h / 2, z); me.rotation.y = ry || 0;
      me.castShadow = m !== K.glass; me.receiveShadow = true; p.add(me); return me;
    }
    function Cy(p, name, rt, rb, h, m, x, y, z, seg) {
      var me = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 32), m);
      me.name = name; me.position.set(x, y + h / 2, z); me.castShadow = me.receiveShadow = true; p.add(me); return me;
    }
    function Sp(p, name, r, m, x, y, z, seg) {
      seg = seg || 24;
      var me = new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.round(seg * .7)), m);
      me.name = name; me.position.set(x, y, z); me.castShadow = true; me.receiveShadow = true; p.add(me); return me;
    }
    function Cap(p, name, r, len, m, x, y, z) {
      var me = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 8, 20), m);
      me.name = name; me.position.set(x, y, z); me.castShadow = true; p.add(me); return me;
    }
    function G(p, name, x, z, ry, y) { var g = new THREE.Group(); g.name = name; g.position.set(x || 0, y || 0, z || 0); g.rotation.y = ry || 0; p.add(g); return g; }
    function Plane(p, name, w, h, m, x, y, z, ry) { var me = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); me.name = name; me.position.set(x, y, z); me.rotation.y = ry || 0; p.add(me); return me; }

    var T = .15, TALL = 2.9, IN = 2.3, LOW = .9;
    function segs(a0, a1, gaps) { var a = a0, out = []; (gaps || []).forEach(function (g) { out.push([a, g[0]]); a = g[1]; }); out.push([a, a1]); return out; }
    function wallZ(p, name, z, x1, x2, h, gaps, m) {
      m = m || K.wall;
      segs(x1, x2, gaps).forEach(function (s, i) { if (s[1] - s[0] > .01) B(p, name + '_' + i, s[1] - s[0], h, T, m, (s[0] + s[1]) / 2, 0, z); });
      if (h > 2.2) (gaps || []).forEach(function (g, i) { B(p, name + '_ambang_' + i, g[1] - g[0], h - 2.15, T, m, (g[0] + g[1]) / 2, 2.15, z); });
    }
    function wallX(p, name, x, z1, z2, h, gaps, m) {
      m = m || K.wall;
      segs(z1, z2, gaps).forEach(function (s, i) { if (s[1] - s[0] > .01) B(p, name + '_' + i, T, h, s[1] - s[0], m, x, 0, (s[0] + s[1]) / 2); });
      if (h > 2.2) (gaps || []).forEach(function (g, i) { B(p, name + '_ambang_' + i, T, h - 2.15, g[1] - g[0], m, x, 2.15, (g[0] + g[1]) / 2); });
    }
    function glassZ(p, name, z, x1, x2, gaps, tr) {
      tr = tr || K.trim;
      segs(x1, x2, gaps).forEach(function (s, i) {
        B(p, name + '_rel_' + i, s[1] - s[0], .1, .1, tr, (s[0] + s[1]) / 2, 0, z);
        B(p, name + '_kaca_' + i, s[1] - s[0], 2.2, .03, K.glass, (s[0] + s[1]) / 2, .1, z);
        [s[0], s[1]].forEach(function (px) { B(p, name + '_tiang_' + i, .06, 2.4, .1, tr, px, 0, z); });
      });
      B(p, name + '_atas', x2 - x1, .1, .12, tr, (x1 + x2) / 2, 2.3, z);
    }
    function glassX(p, name, x, z1, z2, gaps, tr) {
      tr = tr || K.trim;
      segs(z1, z2, gaps).forEach(function (s, i) {
        B(p, name + '_rel_' + i, .1, .1, s[1] - s[0], tr, x, 0, (s[0] + s[1]) / 2);
        B(p, name + '_kaca_' + i, .03, 2.2, s[1] - s[0], K.glass, x, .1, (s[0] + s[1]) / 2);
        [s[0], s[1]].forEach(function (pz) { B(p, name + '_tiang_' + i, .1, 2.4, .06, tr, x, 0, pz); });
      });
      B(p, name + '_atas', .12, .1, z2 - z1, tr, x, 2.3, (z1 + z2) / 2);
    }
    function railZ(p, name, z, x1, x2) {
      var n = Math.max(1, Math.ceil((x2 - x1) / 2));
      B(p, name + '_kaca', x2 - x1, .85, .025, K.glass, (x1 + x2) / 2, .08, z);
      B(p, name + '_pegangan', x2 - x1 + .05, .05, .07, K.steel, (x1 + x2) / 2, .97, z);
      for (var i = 0; i <= n; i++) B(p, name + '_tiang', .05, .98, .05, K.steel, x1 + (x2 - x1) * i / n, 0, z);
    }
    function railX(p, name, x, z1, z2) {
      var n = Math.max(1, Math.ceil((z2 - z1) / 2));
      B(p, name + '_kaca', .025, .85, z2 - z1, K.glass, x, .08, (z1 + z2) / 2);
      B(p, name + '_pegangan', .07, .05, z2 - z1 + .05, K.steel, x, .97, (z1 + z2) / 2);
      for (var i = 0; i <= n; i++) B(p, name + '_tiang', .05, .98, .05, K.steel, x, 0, z1 + (z2 - z1) * i / n);
    }

    /* ---------- perabot ---------- */
    function chair(p, x, z, ry, m, big) {
      var g = G(p, 'kursi', x, z, ry), s = big ? 1.2 : 1; m = m || K.chair;
      B(g, 'kaki_kursi', .5 * s, .04, .5 * s, K.black, 0, 0, 0);
      Cy(g, 'tiang_kursi', .035, .035, .4, K.metal, 0, .04, 0, 12);
      B(g, 'dudukan', .5 * s, .07, .5 * s, m, 0, .4, 0);
      B(g, 'sandaran', .5 * s, big ? .8 : .55, .07, m, 0, .47, -.26 * s);
      return g;
    }
    function desk(p, x, z, ry, o) {
      o = o || {};
      var g = G(p, 'meja', x, z, ry), w = o.w || 1.4, d = o.d || .7, top = o.top || K.wood;
      B(g, 'daun_meja', w, .05, d, top, 0, .7, 0);
      [-1, 1].forEach(function (sx) { B(g, 'kaki_meja', .05, .7, d - .08, K.metal, sx * (w / 2 - .06), 0, 0); });
      if (o.monitor !== false) {
        var mw = o.mw || .62;
        B(g, 'tiang_monitor', .05, .18, .05, K.black, 0, .75, .2);
        B(g, 'monitor', mw, .38, .04, K.black, 0, .9, .22);
        B(g, 'layar_monitor', mw - .06, .32, .005, o.screen || K.screen, 0, .93, .198);
        B(g, 'keyboard', .44, .02, .14, K.white, 0, .75, -.1);
      }
      if (rand() < .5) Cy(g, 'gelas', .045, .04, .1, pick([K.white, K.coral, K.teal, K.yellow]), -w / 2 + .2, .75, .05, 16);
      return g;
    }
    function station(p, x, z, ry, o) {
      o = o || {}; var g = G(p, 'meja_kerja', x, z, ry); chair(g, 0, 0, 0, o.chair, o.big); var dg = desk(g, 0, o.dist == null ? .62 : o.dist, 0, o);
      if (o.kursi) daftarKursi(Object.assign({ x: x, z: z, r: ry, jenis: 'meja', layar: layarDi(dg, 'layar_monitor') }, o.kursi));
      return g;
    }
    function plant(p, x, z, s) {
      var g = G(p, 'tanaman', x, z); g.scale.setScalar(s || 1);
      Cy(g, 'pot', .22, .17, .42, K.pot, 0, 0, 0);
      Sp(g, 'daun', .34, K.leaf, 0, .72, 0); Sp(g, 'daun', .24, K.leaf2, .16, .95, .06); Sp(g, 'daun', .22, K.leaf, -.14, .92, -.08);
      return g;
    }
    function tallPlant(p, x, z, s) {
      var g = G(p, 'tanaman_tinggi', x, z); g.scale.setScalar(s || 1);
      Cy(g, 'pot', .26, .2, .5, K.white, 0, 0, 0); Cy(g, 'batang', .03, .04, 1.1, K.trunk, 0, .5, 0, 8);
      Sp(g, 'daun', .38, K.leaf, 0, 1.55, 0); Sp(g, 'daun', .3, K.leaf2, .22, 1.8, .1); Sp(g, 'daun', .28, K.leaf, -.2, 1.85, -.1); Sp(g, 'daun', .24, K.leaf2, 0, 2.05, 0);
      return g;
    }
    function sofa(p, x, z, ry, len, m) {
      len = len || 2; m = m || K.sofa;
      var g = G(p, 'sofa', x, z, ry);
      B(g, 'sofa_dasar', len, .42, .85, m, 0, 0, 0);
      B(g, 'sofa_sandaran', len, .45, .2, m, 0, .42, -.33);
      [-1, 1].forEach(function (sx) { B(g, 'sofa_lengan', .18, .25, .85, m, sx * (len / 2 - .09), .42, 0); });
      return g;
    }
    function cushions(g, len, cols) { cols.forEach(function (c, i) { var b = B(g, 'bantal', .34, .32, .1, c, -len / 2 + .35 + i * ((len - .7) / Math.max(1, cols.length - 1)), .42, -.2); b.rotation.x = -.25; }); }
    function shelf(p, x, z, ry, w, h, d, levels, m, fill) {
      var g = G(p, 'rak', x, z, ry);
      [-1, 1].forEach(function (sx) { B(g, 'rak_sisi', .04, h, d, m, sx * (w / 2 - .02), 0, 0); });
      for (var i = 0; i <= levels; i++) B(g, 'rak_papan', w, .03, d, m, 0, i * (h - .03) / levels, 0);
      if (fill) for (var j = 0; j < levels; j++) fill(g, (j * (h - .03)) / levels + .03, w, d, j);
      return g;
    }
    function books(g, y, w, d) { var x = -w / 2 + .08; while (x < w / 2 - .12) { var bw = .05 + rand() * .05, bh = .2 + rand() * .1; B(g, 'buku', bw, bh, d * .8, pick(BOOKS), x + bw / 2, y, 0); x += bw + .01; if (rand() < .08) x += .15; } }
    function boxes(g, y, w, d) { var x = -w / 2 + .1; while (x < w / 2 - .35) { var bw = .3 + rand() * .15, bh = .22 + rand() * .15; B(g, 'kardus', bw, bh, d * .85, K.cardboard, x + bw / 2, y, 0); x += bw + .06; } }
    function trophy(p, x, y, z, s) { var g = G(p, 'piala', x, z, 0, y); g.scale.setScalar(s || 1); Cy(g, 'alas_piala', .06, .07, .05, K.dark, 0, 0, 0, 12); Cy(g, 'tangkai_piala', .015, .02, .08, K.gold, 0, .05, 0, 10); Cy(g, 'mangkuk_piala', .07, .03, .1, K.gold, 0, .13, 0, 16); return g; }
    function rug(p, name, w, d, m, x, z, ry) { return B(p, name, w, .012, d, m, x, .02, z, ry || 0); }
    function mug(p, x, y, z, m) { Cy(p, 'mug', .045, .04, .1, m || K.white, x, y, z, 14); }
    function succulent(p, x, y, z) { Cy(p, 'pot_mini', .05, .04, .07, K.pot, x, y, z, 12); Sp(p, 'sukulen', .055, K.leaf2, x, y + .1, z, 10); }
    function duck(p, x, y, z, ry) { var g = G(p, 'bebek_karet', x, z, ry || 0, y); Sp(g, 'badan_bebek', .05, K.gYellow, 0, .045, 0, 14).scale.set(1.2, .85, 1); Sp(g, 'kepala_bebek', .032, K.gYellow, 0, .1, .03, 12); B(g, 'paruh', .03, .012, .03, K.coral, 0, .09, .065); return g; }
    function label(p, text, x, z, ry, size) {
      size = size || .34;
      var c = document.createElement('canvas'), ctx = c.getContext('2d');
      var font = '800 72px "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.font = font; var tw = Math.ceil(ctx.measureText(text).width) + 60;
      c.width = tw; c.height = 110; ctx.font = font; ctx.letterSpacing = '6px';
      ctx.fillStyle = 'rgba(29,36,51,.62)'; ctx.textBaseline = 'middle'; ctx.fillText(text, 30, 58);
      var tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
      var m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }); m.name = 'label_' + text;
      var me = new THREE.Mesh(new THREE.PlaneGeometry(size * c.width / c.height, size), m);
      me.name = 'label_' + text; me.rotation.set(-Math.PI / 2, 0, ry || 0); me.position.set(x, .04, z); p.add(me); return me;
    }
    var logoTex = null;
    function logoSign(p, name, w, h, x, y, z, ry) {
      if (!logoTex) {
        var c = document.createElement('canvas'); c.width = 1600; c.height = 360; var x2 = c.getContext('2d');
        x2.fillStyle = '#1d2433'; x2.fillRect(0, 0, 1600, 360);
        x2.fillStyle = '#3b6cf6'; x2.beginPath(); x2.arc(170, 180, 95, 0, Math.PI * 2); x2.fill();
        x2.fillStyle = '#fff'; x2.font = '800 120px "Plus Jakarta Sans", system-ui'; x2.textBaseline = 'middle'; x2.fillText('P', 132, 186);
        x2.font = '800 118px "Plus Jakarta Sans", system-ui'; x2.fillText('PADEV STUDIO', 310, 140);
        x2.fillStyle = '#9fb6ff'; x2.font = '700 78px "Plus Jakarta Sans", system-ui'; x2.fillText('CLAUDE', 314, 262);
        logoTex = new THREE.CanvasTexture(c); logoTex.colorSpace = THREE.SRGBColorSpace; logoTex.anisotropy = 8;
      }
      var m = mat('logo_padev', '#ffffff', { r: .5, map: logoTex });
      var sign = new THREE.Mesh(new THREE.BoxGeometry(w, h, .06), [K.black, K.black, K.black, K.black, m, K.black]);
      sign.name = name; sign.position.set(x, y, z); sign.rotation.y = ry || 0; sign.castShadow = true; p.add(sign); return sign;
    }
    function screenOn(p, name, w, h, frameM, scrM, x, y, z, ry) {
      var g = G(p, name, x, z, ry, y);
      B(g, name + '_bingkai', w, h, .05, frameM || K.black, 0, 0, 0);
      Plane(g, name + '_layar', w - .06, h - .06, scrM, 0, h / 2, .027);
      return g;
    }
    function umbrellaSet(p, x, z, col, y) {
      var umb = G(p, 'payung_meja', x, z, 0, y || 0);
      Cy(umb, 'meja_taman', .45, .45, .04, K.white, 0, .72, 0); Cy(umb, 'kaki_meja_taman', .04, .04, .72, K.metal, 0, .0, 0, 10);
      Cy(umb, 'tiang_payung', .025, .025, 2.2, K.metal, 0, .0, 0, 10);
      var cone = new THREE.Mesh(new THREE.ConeGeometry(1.0, .4, 32), col); cone.name = 'payung'; cone.position.y = 2.2; cone.castShadow = true; umb.add(cone);
      [0, Math.PI / 2, Math.PI, Math.PI * 1.5].forEach(function (a) { chair(umb, Math.sin(a) * .8, Math.cos(a) * .8, a + Math.PI, K.white); });
      return umb;
    }
    function bistroSet(p, x, z, cols) {
      var g = G(p, 'meja_bistro', x, z);
      Cy(g, 'meja_bistro', .45, .45, .04, K.white, 0, .72, 0); Cy(g, 'kaki_bistro', .04, .06, .72, K.metal, 0, 0, 0, 10);
      [0, Math.PI / 2, Math.PI, Math.PI * 1.5].forEach(function (a, i) { chair(g, Math.sin(a) * .8, Math.cos(a) * .8, a + Math.PI, cols[i % cols.length]); });
      return g;
    }

    /* ============================================================
       MODEL
       ============================================================ */
    var model = new THREE.Group(); model.name = 'Kantor_Padev_Studio_Claude';
    var L1 = G(model, 'lantai_1');
    var L2 = G(model, 'lantai_2', 0, 0, 0, Y2 + GAP); L2.userData.hidup = true;

    /* ================= LANTAI 1 ================= */
    var floors = G(L1, 'lantai');
    B(floors, 'pelat_lantai', 30.4, .15, 20.4, K.slab, 0, -.15, 0);
    function F1(name, x1, z1, x2, z2, m) { return B(floors, name, x2 - x1, .02, z2 - z1, m, (x1 + x2) / 2, 0, (z1 + z2) / 2); }
    F1('lt_diskusi_klien', -15, -10, -9, -4, K.client); F1('lt_rapat', -9, -10, -3, -4, K.meet); F1('lt_studio', -3, -10, 5, -4, K.studio);
    F1('lt_tangga', 5, -10, 8.5, -4, K.lobby); F1('lt_gudang', 8.5, -10, 11.5, -4, K.store); F1('lt_toilet', 11.5, -10, 15, -4, K.tile);
    F1('lt_lobby', -15, -4, -8, 10, K.lobby); F1('lt_workspace_a', -8, -4, 9, 5, K.parquet); F1('lt_workspace_b', -3, 5, 3.6, 10, K.parquet);
    F1('lt_depan_rapat_2', 3.6, 5, 9, 5.4, K.parquet); F1('lt_rapat_2', 3.6, 5.4, 9, 10, K.meet2);
    F1('lt_musholla', -8, 5, -3, 10, K.musholla); F1('lt_pantry', 9, -4, 15, 3, K.pantry); F1('lt_lounge', 9, 3, 15, 10, K.lounge);

    var walls = G(L1, 'dinding');
    wallZ(walls, 'dinding_utara', -10, -15.075, 15.075, TALL);
    wallX(walls, 'dinding_barat', -15, -10, 10, TALL);
    wallZ(walls, 'dinding_selatan', 10, -15.075, 15.075, LOW, [[-13, -10]]);
    wallX(walls, 'dinding_timur', 15, -10, 10, LOW, [[3.6, 4.8]]);
    B(walls, 'list_atas_utara', 30.3, .1, .22, K.trim, 0, TALL, -10);
    B(walls, 'list_atas_barat', .22, .1, 20.2, K.trim, -15, TALL, 0);
    [-12, -6, -1.8, 1, 3.8].forEach(function (x) { B(walls, 'jendela_utara', 1.7, 1.2, .17, K.window, x, 1.1, -10); });
    [-7, 2, 7].forEach(function (z) { B(walls, 'jendela_barat', .17, 1.2, 1.7, K.window, -15, 1.1, z); });
    glassX(walls, 'kaca_klien_rapat', -9, -10, -4);
    glassX(walls, 'kaca_rapat_studio', -3, -10, -4);
    glassZ(walls, 'kaca_depan_klien', -4, -15, -9, [[-10.7, -9.7]], K.sofaWarm);
    glassZ(walls, 'kaca_depan_rapat', -4, -9, -3, [[-4.3, -3.3]], K.gGreen);
    glassZ(walls, 'kaca_rapat2_utara', 5.4, 3.6, 9, [[4.3, 5.3]], K.gBlue);
    glassX(walls, 'kaca_rapat2_barat', 3.6, 5.4, 10, [], K.gBlue);
    glassX(walls, 'kaca_rapat2_timur', 9, 5.4, 10, [], K.gBlue);
    wallZ(walls, 'dinding_depan_studio', -4, -3, 5, 1.0, [[0.2, 1.6]]);
    wallX(walls, 'dinding_studio_tangga', 5, -10, -4, IN);
    wallX(walls, 'dinding_tangga_gudang', 8.5, -10, -4, IN);
    wallX(walls, 'dinding_gudang_toilet', 11.5, -10, -4, IN);
    wallZ(walls, 'dinding_depan_gudang', -4, 8.5, 11.5, IN, [[9.5, 10.5]]);
    wallZ(walls, 'dinding_depan_toilet', -4, 11.5, 15, IN, [[12.4, 13.4]]);
    wallX(walls, 'dinding_lobby', -8, -4, 5, 1.0, [[-.5, 2.5]]);
    wallX(walls, 'dinding_musholla_barat', -8, 5, 10, IN);
    wallZ(walls, 'dinding_musholla_utara', 5, -8, -3, IN, [[-5, -4]]);
    wallX(walls, 'dinding_musholla_timur', -3, 5, 10, IN);
    wallZ(walls, 'dinding_pantry_lounge', 3, 9, 15, 1.0, [[11, 13]]);

    /* Ruang Diskusi Klien (bekas ruang pimpinan) */
    var cli = G(L1, 'ruang_diskusi_klien');
    Cy(cli, 'karpet_bulat', 1.6, 1.6, .012, K.terracotta, -12.2, .02, -7.0, 48);
    var sfK = sofa(cli, -14.45, -7.0, Math.PI / 2, 2.8, K.sofaWarm); cushions(sfK, 2.8, [K.gYellow, K.cream, K.teal]);
    var ac1 = sofa(cli, -10.1, -7.9, -Math.PI / 2, 1.0, K.teal); var ac2 = sofa(cli, -10.1, -6.1, -Math.PI / 2, 1.0, K.gYellow);
    Cy(cli, 'pouf', .3, .3, .4, K.cream, -12.2, 0, -5.1, 24);
    Cy(cli, 'meja_kopi_bulat', .6, .6, .05, K.wood, -12.2, .38, -7.0, 32); Cy(cli, 'kaki_meja_kopi', .07, .12, .38, K.dark, -12.2, 0, -7.0, 16);
    var bowl = new THREE.Mesh(new THREE.SphereGeometry(.14, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat('mangkuk', '#f4f1ea', { r: .4, ds: true }));
    bowl.name = 'mangkuk_camilan'; bowl.position.set(-12.35, .6, -7.1); cli.add(bowl);
    for (var sn = 0; sn < 5; sn++) Sp(cli, 'camilan', .035, pick([K.gYellow, K.coral, K.cardboard]), -12.35 + (rand() - .5) * .14, .5, -7.1 + (rand() - .5) * .14, 8);
    mug(cli, -11.9, .43, -6.8, K.white); mug(cli, -12.0, .43, -7.3, K.gRed);
    B(cli, 'tablet_portofolio', .26, .012, .18, K.black, -12.05, .43, -6.6, .3);
    succulent(cli, -12.6, .43, -6.7);
    B(cli, 'kredensa_tv', 2.4, .5, .45, K.wood, -12.2, 0, -9.7);
    screenOn(cli, 'tv_klien', 2.0, 1.15, K.black, SCR.welcome, -12.2, 1.0, -9.9, 0);
    succulent(cli, -13.1, .5, -9.7); trophy(cli, -11.3, .5, -9.7, 1);
    var cart = G(cli, 'troli_kopi', -9.65, -9.35);
    B(cart, 'meja_troli_kopi', .6, .82, .45, K.wood, 0, 0, 0); B(cart, 'mesin_kopi_klien', .28, .34, .26, K.black, .1, .82, 0);
    for (var cp = 0; cp < 3; cp++) mug(cart, -.18, .82, -.1 + cp * .1, K.white);
    var lampK = G(cli, 'lampu_lantai_klien', -14.5, -9.5);
    Cy(lampK, 'alas_lampu', .18, .2, .04, K.black, 0, 0, 0); Cy(lampK, 'tiang_lampu', .02, .02, 1.5, K.black, 0, .04, 0, 8);
    Cy(lampK, 'kap_lampu', .16, .26, .3, K.warm, 0, 1.5, 0);
    plant(cli, -9.35, -4.5, .9); plant(cli, -14.5, -4.5, .9);
    [[-8.9, K.gBlue], [-5.2, K.gGreen]].forEach(function (a) {
      B(cli, 'bingkai_seni', .04, .8, .6, K.dark, -14.9, 1.1, a[0]);
      B(cli, 'lukisan_abstrak', .045, .66, .46, a[1], -14.88, 1.17, a[0]);
      Sp(cli, 'lukisan_bulatan', .12, K.gYellow, -14.84, 1.55, a[0] + .08, 14).scale.set(.2, 1, 1);
    });

    /* Ruang Rapat */
    var meet = G(L1, 'ruang_rapat');
    B(meet, 'meja_rapat', 3.4, .05, 1.35, K.white, -6, .72, -7.2);
    Cy(meet, 'kaki_rapat', .08, .08, .72, K.metal, -7.2, 0, -7.2); Cy(meet, 'kaki_rapat', .08, .08, .72, K.metal, -4.8, 0, -7.2);
    [-7.1, -6, -4.9].forEach(function (x, i) {
      chair(meet, x, -8.2, 0, GC[i]); chair(meet, x, -6.2, Math.PI, GC[(i + 2) % 4]);
      daftarKursi({ x: x, z: -8.2, r: 0, jenis: 'rapat', dekat: [x, -8.9], akses: ['m1N'] });
      daftarKursi({ x: x, z: -6.2, r: Math.PI, jenis: 'rapat', dekat: [x, -5.5], akses: ['m1S'] });
    });
    chair(meet, -8.1, -7.2, Math.PI / 2, K.gGreen);
    screenOn(meet, 'tv_rapat', 2.2, 1.2, K.black, SCR.sprint, -6, .5, -9.9, 0);
    [-6.8, -5.4].forEach(function (x) { B(meet, 'laptop', .34, .02, .24, K.metal, x, .77, -7.6); });
    plant(meet, -3.5, -9.5, .8);

    /* Studio Desain */
    var studio = G(L1, 'studio_desain');
    [[-1.6, K.screenP], [1, K.screen], [3.6, K.screenG]].forEach(function (a) { station(studio, a[0], -8.3, Math.PI, { w: 1.8, d: .8, mw: .95, screen: a[1], top: K.white, kursi: { dekat: [a[0], -7.45], akses: ['sW2'] } }); });
    var board = G(studio, 'mood_board', 4.9, -7, -Math.PI / 2);
    B(board, 'papan_mood', 3.2, 1.4, .04, K.cream, 0, .9, 0);
    for (var mb = 0; mb < 14; mb++) B(board, 'kartu_warna', .32 + rand() * .2, .24 + rand() * .15, .01, pick([K.coral, K.teal, K.yellow, K.blue].concat(BOOKS)), -1.35 + (mb % 7) * .45, 1.05 + Math.floor(mb / 7) * .55 + (rand() - .5) * .08, .03);
    B(studio, 'meja_kerja_besar', 2.4, .05, 1.2, K.wood, 1, .88, -5.8);
    [-1, 1].forEach(function (sx) { B(studio, 'kaki_meja_besar', .08, .88, 1.1, K.metal, 1 + sx * 1.1, 0, -5.8); });
    for (var ks = 0; ks < 6; ks++) B(studio, 'kertas_sketsa', .3, .005, .22, pick([K.white, K.cream, K.yellow]), .2 + rand() * 1.6, .93, -6.2 + rand() * .8, rand());
    var easel = G(studio, 'easel', -2.2, -5.2, .5);
    [-.3, .3].forEach(function (sx) { B(easel, 'kaki_easel', .04, 1.7, .04, K.wood, sx, 0, 0); });
    B(easel, 'kanvas', .8, .6, .03, K.white, 0, .9, .03); B(easel, 'lukisan', .6, .35, .005, K.teal, 0, 1.03, .05);
    plant(studio, 4.5, -4.5, .8);

    /* Tangga ke lantai 2 (bekas ruang server) */
    var stair = G(L1, 'tangga');
    var NS = 17, SH = Y2 / NS, ST = .28, Z0 = -4.3, SX = 5.75, SW = 1.2, RUN = NS * ST, SL = Math.hypot(RUN, Y2), SA = Math.atan2(Y2, RUN);
    for (var si = 0; si < NS; si++) B(stair, 'anak_tangga', SW, .05, ST + .03, K.wood, SX, (si + 1) * SH - .05, Z0 - (si + .5) * ST);
    function incline(name, w, h, m, x, yOff) { var me = new THREE.Mesh(new THREE.BoxGeometry(w, h, SL), m); me.name = name; me.position.set(x, Y2 / 2 + yOff, Z0 - RUN / 2); me.rotation.x = SA; me.castShadow = me.receiveShadow = true; stair.add(me); return me; }
    incline('pengapit_tangga', .06, .24, K.black, SX + SW / 2 - .02, -.14); incline('pengapit_tangga', .06, .24, K.black, SX - SW / 2 + .02, -.14);
    incline('pegangan_tangga', .05, .05, K.steel, SX + SW / 2 + .02, .92); incline('pegangan_dinding', .04, .04, K.steel, 5.12, .85);
    incline('kaca_tangga', .02, .8, K.glass, SX + SW / 2 + .02, .5);
    for (var sp2 = 0; sp2 < NS; sp2 += 4) B(stair, 'tiang_pegangan', .04, .92, .04, K.steel, SX + SW / 2 + .02, (sp2 + 1) * SH, Z0 - (sp2 + .5) * ST);
    B(stair, 'pot_panjang', .45, .45, 3.4, K.planter, 8.15, 0, -7.4);
    for (var sh = 0; sh < 6; sh++) Sp(stair, 'semak', .26, sh % 2 ? K.leaf2 : K.leaf, 8.15, .6, -8.9 + sh * .6, 14);
    screenOn(stair, 'papan_naik', 1.0, 1.3, K.dark, SCR.naik, 7.45, .8, -9.92, 0);
    plant(stair, 6.9, -9.45, .8);

    /* Gudang */
    var store = G(L1, 'gudang');
    shelf(store, 10, -9.62, 0, 2.7, 2.1, .6, 4, K.metal, boxes);
    shelf(store, 11.1, -7.3, -Math.PI / 2, 2.2, 1.6, .55, 3, K.metal, boxes);
    for (var kd = 0; kd < 3; kd++) B(store, 'kardus_lantai', .55, .45, .5, K.cardboard, 9.2, kd * .45, -5.4, kd * .2);
    B(store, 'kardus_lantai', .5, .4, .45, K.cardboard, 9.85, 0, -5.2, .4);
    var trolley = G(store, 'troli', 10.3, -6.2, .3);
    B(trolley, 'alas_troli', .5, .04, .4, K.metal, 0, .08, 0); B(trolley, 'gagang_troli', .5, 1.1, .04, K.metal, 0, .08, -.2);
    [-.2, .2].forEach(function (sx) { Cy(trolley, 'roda', .08, .08, .05, K.black, sx, 0, .1, 16); });

    /* Toilet */
    var wc = G(L1, 'toilet');
    [12.8, 14.05].forEach(function (x) { B(wc, 'sekat_bilik', .06, 2, 1.7, K.white, x, 0, -9.15); });
    [[12.15, 1.2], [13.43, 1.2]].forEach(function (a) { B(wc, 'pintu_bilik', a[1] - .5, 2, .05, mat('pintu_toilet', '#8fb6c9'), a[0] + .25, 0, -8.3); });
    function kloset(p, x, z, ry) { var t = G(p, 'kloset', x, z, ry || 0); B(t, 'tangki', .4, .4, .18, K.porcelain, 0, .38, -.28); Cy(t, 'dudukan_kloset', .19, .15, .4, K.porcelain, 0, 0, 0); return t; }
    [12.15, 13.43, 14.55].forEach(function (x) { kloset(wc, x, -9.55); });
    B(wc, 'wastafel_meja', .55, .85, 2.2, K.white, 14.65, 0, -5.9);
    [-6.5, -5.3].forEach(function (z) { Cy(wc, 'wastafel', .18, .14, .1, K.porcelain, 14.62, .85, z); });
    B(wc, 'cermin', .02, .9, 2, mat('cermin', '#dfeef5', { r: .05, m: .3 }), 14.91, 1.2, -5.9);
    plant(wc, 12, -4.6, .6);

    /* Lobby */
    var lobby = G(L1, 'lobby');
    rug(lobby, 'karpet_lobby', 3.2, 3.6, K.cream, -13.1, 5.8);
    var rec = G(lobby, 'meja_resepsionis', -11.8, .95);
    B(rec, 'meja_depan', 3.2, 1.05, .5, K.white, 0, 0, 0); B(rec, 'panel_brand', 3.2, .5, .02, K.blue, 0, .3, .26);
    B(rec, 'top_resepsionis', 3.35, .05, .7, K.wood, 0, 1.05, -.05); B(rec, 'meja_dalam', 3, .05, .6, K.wood, 0, .72, -.5);
    B(rec, 'monitor_resepsionis', .55, .34, .04, K.black, .6, .77, -.55); B(rec, 'layar_resepsionis', .5, .28, .005, K.screen, .6, .8, -.573);
    chair(lobby, -11.8, -.2, 0, K.chair);
    logoSign(lobby, 'logo_padev_studio_claude', 4, .9, -14.9, 1.65, 3.2, Math.PI / 2);
    sofa(lobby, -14.4, 5.8, Math.PI / 2, 2.2, K.gGreen); sofa(lobby, -13.1, 8.9, Math.PI, 1.8, K.gBlue);
    var lw = G(lobby, 'dinding_tanaman');
    B(lw, 'panel_dinding_tanaman', .06, 2.3, 4.2, K.moss, -14.89, .15, -1.55);
    for (var li = 0; li < 12; li++) for (var lj = 0; lj < 6; lj++) Sp(lw, 'daun_dinding', .15 + rand() * .07, rand() < .5 ? K.leaf : K.leaf2, -14.8, .38 + lj * .38 + (rand() - .5) * .08, -3.45 + li * .345, 12);
    Cy(lobby, 'meja_kopi_lobby', .5, .5, .05, K.wood, -12.9, .4, 5.8); Cy(lobby, 'kaki_meja_lobby', .08, .15, .4, K.metal, -12.9, 0, 5.8);
    B(lobby, 'majalah', .3, .02, .22, K.coral, -12.8, .45, 5.7, .4);
    B(lobby, 'keset', 2.4, .015, .9, mat('keset', '#8a7d6b'), -11.5, .02, 9.4);
    plant(lobby, -8.6, 9.4); plant(lobby, -14.4, 9.4, .9); plant(lobby, -8.6, -3.4, .8);

    /* Open workspace (lebih lega) */
    var ws = G(L1, 'open_workspace');
    function pod(p, px, pz, col) {
      [-.75, .75].forEach(function (dx) {
        station(p, px + dx, pz - 1.02, 0, { screen: pick([K.screen, K.screenG]), top: K.white, kursi: { dekat: [px + dx, -3.0], akses: ['a1', 'b1', 'c1'] } });
        station(p, px + dx, pz + 1.02, Math.PI, { screen: pick([K.screen, K.screenG]), top: K.white, kursi: { dekat: [px + dx, 1.0], akses: ['f1', 'g1'] } });
      });
      B(p, 'sekat_pod', 2.9, .35, .03, col, px, .75, pz);
    }
    pod(ws, -5, -1.2, K.gBlue); pod(ws, -.5, -1.2, K.gRed);
    // meja komunal
    B(ws, 'meja_komunal', 4.2, .05, 1.0, K.wood, -2.8, .72, 3.2);
    [-1, 1].forEach(function (sx) { B(ws, 'kaki_komunal', .06, .72, .9, K.black, -2.8 + sx * 1.95, 0, 3.2); });
    [2.45, 3.95].forEach(function (z) { B(ws, 'bangku_komunal', 4.0, .45, .38, K.wood, -2.8, 0, z); });
    B(ws, 'laptop', .34, .02, .24, K.metal, -3.8, .77, 3.0); B(ws, 'laptop', .34, .02, .24, K.metal, -1.6, .77, 3.4);
    succulent(ws, -2.8, .77, 3.2); succulent(ws, -4.4, .77, 3.25);
    tallPlant(ws, -7.3, 4.3, 1); tallPlant(ws, 1.6, 4.3, .9); plant(ws, 2.4, -2.2, .7); plant(ws, 4.3, -3.65, .8); plant(ws, 7.1, -3.5, .8);
    // huddle
    Cy(ws, 'meja_huddle', .6, .6, .05, K.white, 5.8, .72, 2.6); Cy(ws, 'kaki_huddle', .06, .06, .72, K.metal, 5.8, 0, 2.6, 12);
    [0, Math.PI / 2, Math.PI, Math.PI * 1.5].forEach(function (a, i) { Cy(ws, 'stool_huddle', .2, .2, .46, GC[i], 5.8 + Math.sin(a) * .95, 0, 2.6 + Math.cos(a) * .95, 20); });
    var wb = G(ws, 'papan_tulis_beroda', 8.3, 2.6, Math.PI / 2);
    B(wb, 'bingkai_papan', 2.5, 1.3, .03, K.metal, 0, .85, .03);
    [-1, 1].forEach(function (sx) { B(wb, 'kaki_papan', .05, .9, .4, K.metal, sx * 1.15, 0, .03); });
    Plane(wb, 'papan_tulis', 2.4, 1.2, SCR.diagram, 0, 1.5, -.0).rotation.y = Math.PI;
    plant(ws, -2.5, 9.4); plant(ws, 8.4, 9.4); plant(ws, 8.4, -3.5, .8); plant(ws, -7.5, -3.5, .8); plant(ws, 3.2, 4.8, .8);

    /* Ruang Rapat 2 */
    var mr2 = G(L1, 'ruang_rapat_2');
    rug(mr2, 'karpet_rapat_2', 4, 2.8, K.cream, 6.1, 7.7);
    B(mr2, 'meja_rapat_2', 3.0, .05, 1.2, K.white, 6.1, .72, 7.7);
    [4.9, 7.3].forEach(function (x) { Cy(mr2, 'kaki_rapat_2', .08, .08, .72, K.metal, x, 0, 7.7); });
    [5.0, 6.1, 7.2].forEach(function (x, i) {
      chair(mr2, x, 6.7, 0, GC[i]); chair(mr2, x, 8.7, Math.PI, GC[(i + 1) % 4]);
      daftarKursi({ x: x, z: 6.7, r: 0, jenis: 'rapat', dekat: [x, 6.0], akses: ['r2D', 'r2E'] });
      daftarKursi({ x: x, z: 8.7, r: Math.PI, jenis: 'rapat', dekat: [x, 9.4], akses: ['r2S'] });
    });
    chair(mr2, 4.2, 7.7, Math.PI / 2, K.gGreen);
    B(mr2, 'stand_tv_rapat_2', .5, 1.0, .4, K.metal, 8.6, 0, 7.7);
    screenOn(mr2, 'tv_rapat_2', 1.8, 1.0, K.black, SCR.bisnis, 8.58, 1.0, 7.7, -Math.PI / 2);
    [5.4, 6.8].forEach(function (x) { B(mr2, 'laptop', .34, .02, .24, K.metal, x, .77, 7.35); });

    /* Gondola */
    function gondola(name, x, z, body) {
      var g = G(ws, name, x, z), W = 1.8, D = 2.2;
      B(g, 'lantai_gondola', W, .08, D, K.dark, 0, 0, 0);
      B(g, 'panel_belakang', W, .9, .08, body, 0, .08, D / 2 - .04);
      [-1, 1].forEach(function (sx) {
        B(g, 'panel_depan', .5, .9, .08, body, sx * (W / 2 - .25), .08, -D / 2 + .04);
        B(g, 'kaca_depan', .5, .77, .02, K.glass, sx * (W / 2 - .25), .98, -D / 2 + .04);
        B(g, 'panel_samping', .08, .9, D, body, sx * (W / 2 - .04), .08, 0);
        B(g, 'kaca_samping', .02, .77, D - .1, K.glass, sx * (W / 2 - .04), .98, 0);
        B(g, 'bangku_gondola', .42, .45, 1.5, K.cream, sx * (W / 2 - .29), .08, .15);
      });
      B(g, 'kaca_belakang', W - .1, .77, .02, K.glass, 0, .98, D / 2 - .04);
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (c) { B(g, 'tiang_gondola', .08, 1.97, .08, body, c[0] * (W / 2 - .04), .08, c[1] * (D / 2 - .04)); });
      [-1, 1].forEach(function (cz) { B(g, 'pita_atas', W, .3, .08, body, 0, 1.75, cz * (D / 2 - .04)); });
      [-1, 1].forEach(function (sx) { B(g, 'pita_atas_samping', .08, .3, D, body, sx * (W / 2 - .04), 1.75, 0); });
      B(g, 'atap_gondola', W + .12, .1, D + .12, K.white, 0, 2.05, 0);
      Cy(g, 'lengan_gantung', .04, .04, .55, K.metal, 0, 2.15, 0, 12);
      B(g, 'penjepit_kabel', .5, .14, .22, K.metal, 0, 2.7, 0);
      B(g, 'meja_gondola', .5, .04, .8, K.white, 0, .68, .15); Cy(g, 'kaki_meja_gondola', .03, .03, .6, K.metal, 0, .08, .15, 10);
      return g;
    }
    gondola('gondola_merah', -1.4, 7.7, K.gRed); gondola('gondola_kuning', 1.3, 7.7, K.gYellow);

    /* Musholla */
    var mus = G(L1, 'musholla');
    for (var mi = 0; mi < 3; mi++) { var rz = 6.2 + mi * 1.3; rug(mus, 'sajadah', 1.15, .7, mi % 2 ? K.rugPray2 : K.rugPray, -6.6, rz); B(mus, 'motif_sajadah', .3, .006, .5, K.gold, -7.05, .032, rz); }
    shelf(mus, -3.35, 7.5, -Math.PI / 2, 1.6, 1, .35, 2, K.wood, books);
    B(mus, 'sekat_saf', .04, .9, 1.4, K.cream, -5.2, 0, 8.9);
    shelf(mus, -4.5, 4.7, Math.PI, 1.2, .5, .3, 1, K.wood);
    for (var ms = 0; ms < 3; ms++) B(mus, 'sepatu_rak', .12, .08, .26, mat('sepatu_rak', '#2a2a2a'), -4.9 + ms * .3, .03, 4.62);
    plant(mus, -7.5, 9.4, .7);

    /* Pantry */
    var pan = G(L1, 'pantry');
    B(pan, 'kabinet_dapur', .65, .88, 5, K.white, 14.6, 0, -1.3); B(pan, 'top_dapur', .7, .05, 5.05, K.dark, 14.6, .88, -1.3);
    B(pan, 'kabinet_atas', .38, .7, 4, K.white, 14.75, 1.55, -1.3);
    B(pan, 'kulkas', .75, 1.95, .75, mat('kulkas', '#dfe3e8', { r: .35, m: .2 }), 14.55, 0, 1.95);
    B(pan, 'mesin_kopi', .32, .4, .3, K.black, 14.6, .93, -2.6); B(pan, 'microwave', .5, .3, .38, K.metal, 14.6, .93, .3);
    Cy(pan, 'dispenser', .13, .13, .5, mat('galon', '#9fd3f0', { t: .75, r: .1 }), 14.6, .93, -3.4);
    B(pan, 'bak_cuci', .45, .02, .6, K.metal, 14.6, .925, -1.2);
    B(pan, 'meja_bar', 1, .05, 2.8, K.wood, 11.2, 1, -1.2); B(pan, 'dasar_bar', .8, 1, 2.6, K.gRed, 11.2, 0, -1.2);
    [-2.2, -1.2, -.2].forEach(function (z, i) { Cy(pan, 'kursi_bar', .2, .2, .06, GC[(i + 1) % 4], 10.35, .7, z, 20); Cy(pan, 'kaki_bar', .03, .03, .7, K.metal, 10.35, 0, z, 10); });
    Cy(pan, 'meja_bundar', .55, .55, .05, K.white, 12.4, .72, 1.8); Cy(pan, 'kaki_bundar', .06, .06, .72, K.metal, 12.4, 0, 1.8, 12);
    [0, 2.1, 4.2].forEach(function (a, i) { Cy(pan, 'stool', .18, .18, .46, GC[i], 12.4 + Math.sin(a) * .85, 0, 1.8 + Math.cos(a) * .85, 20); });
    [-2, -.8].forEach(function (z) { Cy(pan, 'cangkir', .04, .035, .09, K.white, 11.2, 1.05, z, 16); });
    B(pan, 'rak_buah', .5, .06, .9, K.wood, 14.6, .93, -.55);
    for (var fr = 0; fr < 5; fr++) Sp(pan, 'buah', .06, GC[fr % 4], 14.5 + (fr % 2) * .15, 1.05, -.9 + fr * .18, 12);

    /* Lounge */
    var lng = G(L1, 'lounge');
    rug(lng, 'karpet_lounge', 3.0, 2.4, K.gYellow, 13.1, 6.4);
    sofa(lng, 14.4, 6.4, -Math.PI / 2, 2.4);
    B(lng, 'meja_lounge', 1.2, .38, .7, K.wood, 13.1, 0, 6.4, Math.PI / 2);
    [[11.9, 5.8, K.gRed], [11.9, 7.1, K.gBlue]].forEach(function (a) { Sp(lng, 'bean_bag', .45, a[2], a[0], .3, a[1]).scale.y = .65; });
    shelf(lng, 9.3, 6.5, Math.PI / 2, 3, 1.1, .35, 3, K.wood, books);
    var pp = G(lng, 'meja_pingpong', 11.8, 8.8);
    B(pp, 'daun_pingpong', 2.74, .04, 1.525, K.pingpong, 0, .72, 0); B(pp, 'garis_tengah', 2.74, .004, .02, K.white, 0, .76, 0);
    B(pp, 'net', .02, .15, 1.6, K.white, 0, .76, 0);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (c) { B(pp, 'kaki_pingpong', .06, .72, .06, K.black, c[0] * 1.2, 0, c[1] * .62); });
    var np = G(lng, 'nap_pod', 14.1, 8.9, -Math.PI / 2);
    Cy(np, 'alas_nap_pod', .5, .55, .12, K.metal, 0, 0, 0);
    var shellM = new THREE.Mesh(new THREE.SphereGeometry(.8, 40, 28, Math.PI / 2 + .95, Math.PI * 2 - 1.9), K.shell);
    shellM.name = 'cangkang_nap_pod'; shellM.scale.y = 1.15; shellM.position.y = 1.02; shellM.castShadow = true; np.add(shellM);
    Sp(np, 'bantalan_nap_pod', .6, K.gBlue, 0, .62, -.05).scale.y = .45;
    var lamp = G(lng, 'lampu_lantai', 9.9, 3.6);
    Cy(lamp, 'alas_lampu', .18, .2, .04, K.black, 0, 0, 0); Cy(lamp, 'tiang_lampu', .02, .02, 1.5, K.black, 0, .04, 0, 8);
    Cy(lamp, 'kap_lampu', .16, .26, .3, K.warm, 0, 1.5, 0);
    plant(lng, 9.6, 9.4); plant(lng, 14.5, 3.5, .7);

    /* Taman */
    var garden = G(L1, 'taman');
    B(garden, 'rumput', 7, .15, 20.4, K.grass, 18.7, -.15, 0);
    B(garden, 'rumput_depan', 30.4, .15, 3.5, K.grass, 3.5, -.15, 11.95);
    B(garden, 'rumput_sudut', 7, .15, 3.5, K.grass, 18.7, -.15, 11.95);
    B(garden, 'paving_masuk', 3, .03, 3.5, K.paving, -11.5, 0, 11.95);
    B(garden, 'dek_kayu', 3.2, .08, 5.8, K.deck, 16.9, 0, 4.2);
    for (var bs = 0; bs < 5; bs++) B(garden, 'batu_jalan', .6, .03, .45, K.stone, 17.6, 0, .7 - bs * .9);
    var pond = G(garden, 'kolam', 19.6, -5.2);
    Cy(pond, 'air_kolam', 1.35, 1.35, .04, K.water, 0, 0, 0, 48);
    var rim = new THREE.Mesh(new THREE.TorusGeometry(1.4, .12, 12, 48), K.stone); rim.name = 'tepi_kolam'; rim.rotation.x = Math.PI / 2; rim.position.y = .06; rim.castShadow = true; pond.add(rim);
    function tree(p, x, z, s) {
      var g = G(p, 'pohon', x, z); g.scale.setScalar(s || 1);
      Cy(g, 'batang', .12, .16, 1.6, K.trunk, 0, 0, 0, 16);
      Sp(g, 'tajuk', .85, K.leaf, 0, 2.0, 0); Sp(g, 'tajuk', .6, K.leaf2, .45, 2.3, .2); Sp(g, 'tajuk', .55, K.leaf, -.4, 2.35, -.25);
    }
    tree(garden, 20.8, -8.4); tree(garden, 21, 1.2, .9); tree(garden, 20.6, 8.2, 1.1); tree(garden, 17.2, -8.8, .8);
    [[16, 11.5], [-4, 11.6], [7, 11.6]].forEach(function (a) { tree(garden, a[0], a[1], .8); });
    function bench(x, z, ry) {
      var b = G(garden, 'bangku_taman', x, z, ry);
      B(b, 'dudukan_bangku', 1.6, .06, .45, K.deck, 0, .42, 0); B(b, 'sandaran_bangku', 1.6, .35, .05, K.deck, 0, .55, -.2);
      [-.7, .7].forEach(function (sx) { B(b, 'kaki_bangku', .06, .42, .4, K.black, sx, 0, 0); });
    }
    bench(17.3, -5.2, Math.PI / 2); bench(19.6, -7.4, 0);
    umbrellaSet(garden, 16.9, 2.6, K.gRed, .08); umbrellaSet(garden, 16.9, 5.8, K.gYellow, .08);
    [-1, 8.2].forEach(function (z) { var pl = G(garden, 'planter', 15.7, z); B(pl, 'kotak_planter', .7, .5, 1.6, K.dark, 0, 0, 0); for (var i = 0; i < 3; i++) Sp(pl, 'semak', .3, i % 2 ? K.leaf2 : K.leaf, 0, .6, -.5 + i * .5); });

    /* ================= LANTAI 2 ================= */
    LANTAI = 2;
    var f2 = G(L2, 'lantai');
    B(f2, 'pelat_lt2_a', 20.2, .15, 20.4, K.slab, -10.0, -.15, 0);
    B(f2, 'pelat_lt2_b', 8.6, .15, 20.4, K.slab, 10.7, -.15, 0);
    B(f2, 'pelat_lt2_bordes', 1.3, .15, .94 + .2, K.slab, 5.75, -.15, -9.63);
    B(f2, 'pelat_lt2_selatan', 1.3, .15, 14.5, K.slab, 5.75, -.15, 2.95);
    function F2(name, x1, z1, x2, z2, m) { return B(f2, name, x2 - x1, .02, z2 - z1, m, (x1 + x2) / 2, 0, (z1 + z2) / 2); }
    F2('lt2_pimpinan', -15, -10, -8, -3, K.ceo2); F2('lt2_noc', -8, -10, 0, -3, K.noc); F2('lt2_server', 0, -10, 5, -3, K.raised);
    F2('lt2_hall_a', 5, -10, 9, -9.06, K.lobby); F2('lt2_hall_b', 6.4, -9.06, 9, -4.3, K.lobby); F2('lt2_hall_c', 5, -4.3, 9, -3, K.lobby);
    F2('lt2_koridor', -15, -3, 9, -1, K.parquet); F2('lt2_lounge', -15, -1, -4, 10, K.lounge2); F2('lt2_programmer', -4, -1, 9, 10, K.prog);
    F2('lt2_teras', 9, -10, 15, 10, K.plank);

    var w2 = G(L2, 'dinding');
    wallZ(w2, 'dinding_utara_lt2', -10, -15.075, 9, TALL);
    wallX(w2, 'dinding_barat_lt2', -15, -10, 10, TALL);
    wallZ(w2, 'parapet_selatan_lt2', 10, -15.075, 9, LOW);
    B(w2, 'list_atas_utara_lt2', 24.2, .1, .22, K.trim, -3, TALL, -10);
    B(w2, 'list_atas_barat_lt2', .22, .1, 20.2, K.trim, -15, TALL, 0);
    [-12.5, -4, 2.5].forEach(function (x) { B(w2, 'jendela_utara_lt2', 1.9, 1.2, .17, K.window, x, 1.1, -10); });
    [-7, 2, 7].forEach(function (z) { B(w2, 'jendela_barat_lt2', .17, 1.2, 1.7, K.window, -15, 1.1, z); });
    glassX(w2, 'kaca_fasad_timur', 9, -10, 10, [[-6.4, -5.4], [6.2, 7.4]], K.steel);
    railX(w2, 'pagar_teras_timur', 15, -10, 10); railZ(w2, 'pagar_teras_utara', -10, 9, 15); railZ(w2, 'pagar_teras_selatan', 10, 9, 15);
    wallX(w2, 'dinding_pimpinan_noc', -8, -10, -3, IN);
    glassZ(w2, 'kaca_depan_pimpinan', -3, -15, -8, [[-9.7, -8.7]], K.dark);
    glassZ(w2, 'kaca_depan_noc', -3, -8, 0, [[-4.6, -3.6]], K.gBlue);
    glassX(w2, 'kaca_noc_server', 0, -10, -3, [], K.black);
    wallZ(w2, 'dinding_depan_server', -3, 0, 5, IN, [[3.5, 4.5]]);
    wallX(w2, 'dinding_server_tangga', 5, -10, -3, IN);
    wallZ(w2, 'dinding_toilet_utara', -1, -15, -12, IN);
    wallX(w2, 'dinding_toilet_timur', -12, -1, 2.6, IN);
    wallZ(w2, 'dinding_toilet_selatan', 2.6, -15, -12, IN, [[-13.8, -12.9]]);
    glassZ(w2, 'kaca_depan_programmer', -1, -4, 9, [[1.0, 2.2]], K.gGreen);
    wallX(w2, 'dinding_programmer_barat', -4, -1, 5, IN);
    glassX(w2, 'kaca_programmer_barat', -4, 5, 10, [[5.3, 6.3]], K.gGreen);
    railX(w2, 'pagar_void_tangga', 6.4, -9.06, -4.3); railZ(w2, 'pagar_void_tangga_selatan', -4.3, 5.08, 6.4);

    /* Ruang Pimpinan */
    var ceo = G(L2, 'ruang_pimpinan');
    rug(ceo, 'karpet_pimpinan', 3.4, 2.6, K.navyRug, -12.8, -5.2);
    var dk = G(ceo, 'meja_eksekutif', -11.5, -8.2);
    B(dk, 'daun_meja_eksekutif', 2.2, .06, .95, K.dark, 0, .7, 0);
    [-1, 1].forEach(function (sx) { B(dk, 'laci_meja', .5, .7, .85, K.dark, sx * .8, 0, 0); });
    B(dk, 'panel_depan', 1.1, .45, .03, K.dark, 0, .2, .44);
    B(dk, 'tiang_monitor', .06, .2, .06, K.black, .4, .76, .24);
    screenOn(dk, 'monitor_ceo', .74, .44, K.black, SCR.bisnis, .4, .8, .22, Math.PI);
    var lap = G(dk, 'laptop_ceo', -.45, 0, 0, .76);
    B(lap, 'alas_laptop', .34, .015, .24, K.steel, 0, 0, 0);
    var lid = B(lap, 'layar_laptop', .34, .23, .012, K.steel, 0, .015, .12); lid.rotation.x = .25;
    B(dk, 'papan_nama', .3, .07, .05, K.gold, 0, .76, .38);
    Cy(dk, 'tempat_pena', .035, .035, .1, K.black, -.9, .76, .25, 12);
    var dl = G(dk, 'lampu_meja', .9, .1, 0, .76); Cy(dl, 'alas_lampu_meja', .07, .08, .02, K.black, 0, 0, 0, 16);
    B(dl, 'lengan_lampu_meja', .02, .36, .02, K.black, 0, .02, 0).rotation.z = .25; Cy(dl, 'kepala_lampu_meja', .03, .07, .08, K.warm, -.08, .34, 0, 16);
    mug(dk, -.85, .76, -.1, K.white);
    chair(ceo, -11.5, -8.95, 0, K.black, true);
    daftarKursi({ x: -11.5, z: -8.95, r: 0, jenis: 'pimpinan', layar: layarDi(dk, 'monitor_ceo_layar'), dekat: [-9.8, -8.95], akses: ['ceoE'] });
    [[-12.1, -6.7], [-11.5, -6.55], [-10.9, -6.7]].forEach(function (a) { daftarKursi({ x: a[0], z: a[1], r: Math.PI, jenis: 'lapor', duduk: false, dekat: [a[0], a[1]], akses: ['ceoIn'] }); });
    chair(ceo, -12.1, -7.3, Math.PI, K.leather); chair(ceo, -10.9, -7.3, Math.PI, K.leather);
    shelf(ceo, -11.5, -9.72, 0, 3.0, 2.1, .38, 4, K.dark, function (g, y, w, d, lv) { if (lv === 2) { [-1, 0, 1].forEach(function (i) { trophy(g, i * .8, y, 0, .9); }); } else books(g, y, w, d); });
    B(ceo, 'kredensa', .45, .75, 2.2, K.dark, -8.35, 0, -6.2);
    trophy(ceo, -8.35, .75, -6.9, 1.1); trophy(ceo, -8.35, .75, -6.2, .9); B(ceo, 'bingkai_penghargaan', .03, .3, .24, K.gold, -8.3, .75, -5.5);
    logoSign(ceo, 'logo_padev_pimpinan', 1.8, .4, -8.1, 1.3, -6.2, -Math.PI / 2);
    var globe = G(ceo, 'bola_dunia', -9.0, -9.3);
    Cy(globe, 'kaki_bola_dunia', .15, .2, .7, K.dark, 0, 0, 0, 16); Sp(globe, 'bola_dunia', .24, mat('laut', '#3b82c4', { r: .4 }), 0, .95, 0, 24);
    var mer = new THREE.Mesh(new THREE.TorusGeometry(.27, .012, 8, 32), K.gold); mer.name = 'meridian'; mer.position.y = .95; mer.rotation.y = .5; globe.add(mer);
    Sp(globe, 'benua', .1, K.gGreen, .12, 1.02, .16, 12).scale.set(1, .7, .4);
    sofa(ceo, -14.45, -5.2, Math.PI / 2, 2.2, K.leather);
    sofa(ceo, -12.4, -3.8, Math.PI, 1.0, K.leather); sofa(ceo, -11.1, -5.2, -Math.PI / 2, 1.0, K.leather);
    B(ceo, 'meja_tamu_pimpinan', .9, .38, .6, K.wood, -13.2, 0, -5.2);
    succulent(ceo, -13.2, .38, -5.2);
    tallPlant(ceo, -14.4, -9.4, 1); plant(ceo, -8.6, -3.6, .9);

    /* DevOps / NOC */
    var noc = G(L2, 'devops_noc');
    B(noc, 'rangka_videowall', 5.0, 2.0, .1, K.black, -4, .75, -9.88);
    [['grafik', 'status', 'cicd'], ['uptime', 'log', 'peta']].forEach(function (row, ri) {
      row.forEach(function (k, ci) { Plane(noc, 'videowall_' + k, 1.5, .88, SCR[k], -5.6 + ci * 1.6, ri ? 1.27 : 2.23, -9.82); });
    });
    function nocDesk(x, texes) {
      var g = G(noc, 'meja_noc', x, -6.35, Math.PI);
      chair(g, 0, 0, 0, K.chair);
      B(g, 'daun_meja_noc', 1.9, .05, .8, K.white, 0, .7, .62);
      [-1, 1].forEach(function (sx) { B(g, 'kaki_meja_noc', .05, .7, .72, K.metal, sx * .88, 0, .62); });
      [[-.6, .35], [0, 0], [.6, -.35]].forEach(function (a, i) {
        var mg = G(g, 'monitor_noc', a[0], .84 - (i === 1 ? .04 : 0), a[1], .78);
        B(mg, 'monitor', .56, .34, .035, K.black, 0, .08, 0); Plane(mg, 'layar', .52, .3, texes[i], 0, .25, -.019).rotation.y = Math.PI;
        B(mg, 'kaki_monitor', .04, .1, .04, K.black, 0, 0, .02);
      });
      B(g, 'keyboard_mekanik', .44, .03, .15, K.black, 0, .75, .38); B(g, 'keycap', .42, .012, .13, K.keycap, 0, .78, .38);
      B(g, 'lampu_rgb', .44, .006, .02, mat('rgb', '#111', { e: '#b084ff', ei: 1.4 }), 0, .75, .455);
      Sp(g, 'mouse', .035, K.black, .35, .77, .4, 10).scale.set(1, .5, 1.4);
      Cy(g, 'tiang_lampu_build', .012, .012, .18, K.metal, -.85, .75, .85, 8); Sp(g, 'lampu_build', .045, beacon, -.85, .96, .85, 14);
      mug(g, .75, .75, .5, K.gRed);
      daftarKursi({ x: x, z: -6.35, r: Math.PI, jenis: 'noc', layar: layarDi(g, 'layar'), dekat: [x, -5.6], akses: ['nocIn'] });
      return g;
    }
    nocDesk(-5.5, [SCR.log, SCR.grafik, SCR.status]); nocDesk(-2.5, [SCR.peta, SCR.cicd, SCR.uptime]);
    var wbN = G(noc, 'papan_infra', -7.92, -5.3, Math.PI / 2, .85);
    B(wbN, 'bingkai_papan_infra', 1.9, 1.15, .03, K.metal, 0, 0, 0); Plane(wbN, 'papan_infra', 1.82, 1.08, SCR.infra, 0, .575, .02);
    [['WIB', -6.3], ['UTC', -5.3], ['SGT', -4.3]].forEach(function (a, i) {
      var cg = G(noc, 'jam_dunia', -7.9, a[1], Math.PI / 2, 2.1);
      var face = Cy(cg, 'muka_jam_dunia', .15, .15, .03, K.white, 0, -.015, 0, 24); face.rotation.x = Math.PI / 2; face.position.set(0, 0, 0);
      var rimC = new THREE.Mesh(new THREE.TorusGeometry(.15, .015, 8, 24), K.black); rimC.name = 'bingkai_jam'; cg.add(rimC);
      var hand1 = B(cg, 'jarum_jam', .015, .09, .01, K.black, 0, 0, .02); hand1.rotation.z = -i * 1.1;
      var hand2 = B(cg, 'jarum_menit', .01, .12, .01, K.gRed, 0, 0, .025); hand2.rotation.z = i * .7 + 1;
    });
    var fr2 = G(noc, 'kulkas_mini', -7.5, -3.55, Math.PI);
    B(fr2, 'badan_kulkas_mini', .55, .85, .5, K.white2, 0, 0, 0); B(fr2, 'pintu_kaca_kulkas', .47, .72, .01, K.glassDark, 0, .08, .255);
    for (var cn = 0; cn < 8; cn++) Cy(fr2, 'minuman_kaleng', .03, .03, .12, GC[cn % 4], -.15 + (cn % 4) * .1, .12 + Math.floor(cn / 4) * .34, .1, 12);
    plant(noc, -.6, -3.6, .8); tallPlant(noc, -7.4, -9.4, .9);

    /* Ruang Server */
    var srv = G(L2, 'ruang_server');
    function rack(x, z, ry, idx) {
      var g = G(srv, 'rak_server', x, z, ry);
      B(g, 'badan_rak', .76, 2.05, 1.0, K.rack, 0, 0, 0);
      for (var i = 0; i < 10; i++) {
        B(g, 'unit_server', .66, .14, .02, K.rackUnit, 0, .18 + i * .18, .5);
        B(g, 'led', .035, .025, .01, LEDS[(i + idx) % 4], -.27, .23 + i * .18, .515);
        B(g, 'led', .035, .025, .01, LEDS[(i + idx + 1) % 4], -.21, .23 + i * .18, .515);
        B(g, 'celah_disk', .3, .01, .005, K.black, .12, .25 + i * .18, .513);
      }
      B(g, 'pintu_kaca_rak', .72, 1.95, .015, K.glassDark, 0, .05, .525);
      B(g, 'label_rak', .4, .06, .01, GC[idx % 4], 0, 1.93, .53);
      return g;
    }
    [.6, 1.4, 2.2, 3.0, 3.8].forEach(function (x, i) { rack(x, -9.3, 0, i); });
    [.6, 1.4, 2.2, 3.0].forEach(function (x, i) { rack(x, -6.5, Math.PI, i + 2); });
    for (var ct = 0; ct < 7; ct++) B(srv, 'ubin_berlubang', .56, .006, .56, K.metal, .45 + ct * .6, .02, -7.9);
    B(srv, 'tray_kabel', 4.0, .05, .4, K.steel, 2.2, 2.2, -9.3); B(srv, 'tray_kabel', 3.4, .05, .4, K.steel, 1.9, 2.2, -6.5);
    [[K.cYellow, -.1], [K.cBlue, 0], [K.cOrange, .1]].forEach(function (a) {
      [-9.3, -6.5].forEach(function (z) { var c = Cy(srv, 'kabel', .035, .035, z === -9.3 ? 3.9 : 3.3, a[0], z === -9.3 ? 2.2 : 1.9, 2.25, z + a[1], 10); c.rotation.z = Math.PI / 2; c.position.y = 2.28; });
    });
    [.6, 1.4, 2.2, 3.0, 3.8].forEach(function (x) { B(srv, 'kabel_turun', .06, .15, .06, K.cBlue, x, 2.05, -9.3); });
    B(srv, 'crac', 1.0, 2.0, .8, K.white2, .6, 0, -3.55);
    for (var vg = 0; vg < 6; vg++) B(srv, 'kisi_crac', .8, .03, .01, K.metal, .6, .5 + vg * .2, -3.96);
    Plane(srv, 'layar_crac', .22, .12, SCR.uptime, .6, 1.8, -3.96).rotation.y = Math.PI;
    [1.6, 2.25].forEach(function (x) { B(srv, 'ups', .6, 1.2, .7, K.black, x, 0, -3.5); B(srv, 'layar_ups', .2, .1, .01, mat('layar_ups', '#111', { e: '#19e68c', ei: 1 }), x, .95, -3.86); });
    Cy(srv, 'tabung_fm200', .18, .18, 1.3, K.red, 2.95, 0, -3.4, 20); Cy(srv, 'katup_fm200', .05, .05, .1, K.steel, 2.95, 1.3, -3.4, 12);
    Cy(srv, 'apar', .08, .08, .45, K.red, 3.3, .0, -3.25, 16); Cy(srv, 'selang_apar', .02, .02, .1, K.black, 3.3, .45, -3.25, 8);
    var cctv = new THREE.Mesh(new THREE.SphereGeometry(.09, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), K.black); cctv.name = 'kamera_cctv'; cctv.rotation.x = Math.PI; cctv.position.set(4.75, 2.25, -9.75); srv.add(cctv);
    var cart2 = G(srv, 'kereta_kvm', 4.4, -7.9, -Math.PI / 2);
    B(cart2, 'badan_kereta_kvm', .5, .9, .45, K.metal, 0, 0, 0); B(cart2, 'monitor_kvm', .4, .26, .03, K.black, 0, .9, -.15); Plane(cart2, 'layar_kvm', .36, .22, SCR.log, 0, 1.03, -.13);
    B(cart2, 'keyboard_kvm', .36, .02, .12, K.black, 0, .9, .08);
    var door = G(srv, 'pintu_server', 3.5, -3, Math.PI / 2); B(door, 'daun_pintu_server', .95, 2.1, .05, K.steel, .475, 0, 0);
    B(srv, 'pembaca_kartu', .08, .12, .03, K.black, 3.3, 1.1, -2.9); B(srv, 'led_pembaca', .03, .02, .01, LEDS[0], 3.3, 1.2, -2.88);
    Plane(srv, 'papan_pintu_server', .6, .2, SCR.pintu, 4.0, 2.25, -2.91);

    /* Hall tangga lantai 2 */
    var hall = G(L2, 'hall_tangga');
    screenOn(hall, 'papan_direktori', 1.1, 1.3, K.dark, SCR.direktori, 7.7, .75, -9.92, 0);
    tallPlant(hall, 8.5, -9.45, 1); plant(hall, 8.5, -3.5, .8);
    var bh = G(hall, 'bangku_hall', 8.6, -7.2, -Math.PI / 2);
    B(bh, 'dudukan_bangku_hall', 1.4, .06, .45, K.wood, 0, .42, 0); [-.6, .6].forEach(function (sx) { B(bh, 'kaki_bangku_hall', .06, .42, .4, K.black, sx, 0, 0); });

    /* Koridor: bingkai foto tim di dinding ruang server */
    [[.9, K.gBlue], [2.5, K.gYellow]].forEach(function (a) {
      B(L2, 'bingkai_foto', .8, .6, .03, K.dark, a[0], 1.2, -2.9); B(L2, 'foto_tim', .7, .5, .01, a[1], a[0], 1.25, -2.88);
    });

    /* Toilet lantai 2 */
    var wc2 = G(L2, 'toilet_lt2');
    kloset(wc2, -13.4, -.45); B(wc2, 'wastafel_meja_lt2', .5, .85, 1.0, K.white, -14.65, 0, 1.5);
    Cy(wc2, 'wastafel_lt2', .17, .13, .1, K.porcelain, -14.62, .85, 1.5); B(wc2, 'cermin_lt2', .02, .8, .9, mat('cermin', '#dfeef5'), -14.91, 1.2, 1.5);
    plant(wc2, -12.5, 2.1, .55);

    /* Lounge & pantry lantai 2 */
    var lg2 = G(L2, 'lounge_pantry_lt2');
    B(lg2, 'kabinet_pantry_lt2', .65, .88, 4.6, K.white, -14.6, 0, 6.7); B(lg2, 'top_pantry_lt2', .7, .05, 4.65, K.dark, -14.6, .88, 6.7);
    B(lg2, 'kabinet_atas_lt2', .38, .7, 3.6, K.white, -14.75, 1.55, 6.9);
    B(lg2, 'kulkas_lt2', .75, 1.95, .75, mat('kulkas', '#dfe3e8'), -14.55, 0, 3.6);
    B(lg2, 'mesin_kopi_lt2', .32, .4, .3, K.black, -14.6, .93, 5.0); Cy(lg2, 'teko', .08, .1, .2, K.steel, -14.6, .93, 5.6, 16);
    B(lg2, 'rak_buah_lt2', .45, .06, .7, K.wood, -14.6, .93, 7.6);
    for (var f3 = 0; f3 < 4; f3++) Sp(lg2, 'buah', .06, GC[f3], -14.55, 1.05, 7.35 + f3 * .17, 12);
    B(lg2, 'meja_tinggi', .6, .05, 1.8, K.wood, -12.2, 1.0, 6.6); B(lg2, 'kaki_meja_tinggi', .5, 1.0, 1.6, K.white, -12.2, 0, 6.6);
    [5.9, 6.6, 7.3].forEach(function (z, i) { Cy(lg2, 'kursi_tinggi', .2, .2, .06, GC[i + 1], -11.5, .7, z, 20); Cy(lg2, 'kaki_kursi_tinggi', .03, .03, .7, K.metal, -11.5, 0, z, 10); });
    rug(lg2, 'karpet_lounge_lt2', 4.2, 3.4, K.cream, -8.2, 6.3);
    var sfL = sofa(lg2, -8.2, 8.9, Math.PI, 2.6, K.sofa); cushions(sfL, 2.6, [K.gRed, K.gYellow, K.gGreen]);
    sofa(lg2, -10.3, 6.2, Math.PI / 2, 1.0, K.gBlue); sofa(lg2, -6.3, 6.0, -Math.PI / 2, 1.0, K.gYellow);
    Cy(lg2, 'meja_kopi_lt2', .55, .55, .05, K.wood, -8.2, .38, 6.4, 32); Cy(lg2, 'kaki_meja_kopi_lt2', .07, .12, .38, K.dark, -8.2, 0, 6.4, 16);
    succulent(lg2, -8.1, .43, 6.3); B(lg2, 'buku_meja', .22, .04, .16, K.coral, -8.4, .43, 6.6, .3);
    var fb = G(lg2, 'meja_foosball', -8.3, 2.4);
    B(fb, 'badan_foosball', 1.4, .25, .75, K.wood, 0, .65, 0); B(fb, 'lapangan_foosball', 1.3, .01, .65, K.gGreen, 0, .9, 0);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (c) { B(fb, 'kaki_foosball', .07, .65, .07, K.dark, c[0] * .62, 0, c[1] * .3); });
    for (var fbr = 0; fbr < 6; fbr++) {
      var rx = -.55 + fbr * .22, rod = Cy(fb, 'batang_foosball', .012, .012, 1.05, K.steel, rx, .98, 0, 8); rod.rotation.x = Math.PI / 2; rod.position.y = .98;
      for (var pl2 = 0; pl2 < 3; pl2++) B(fb, 'pemain_foosball', .04, .12, .05, fbr % 2 ? K.gRed : K.gBlue, rx, .9, -.2 + pl2 * .2);
    }
    shelf(lg2, -4.3, 2.0, -Math.PI / 2, 2.4, 1.6, .35, 3, K.wood, books);
    function booth(x, z, col) {
      var g = G(lg2, 'phone_booth', x, z, -Math.PI / 2);
      B(g, 'booth_belakang', 1.1, 2.2, .08, col, 0, 0, -.51);
      [-1, 1].forEach(function (sx) { B(g, 'booth_samping', .08, 2.2, 1.1, col, sx * .51, 0, 0); });
      B(g, 'booth_atap', 1.1, .08, 1.1, col, 0, 2.2, 0);
      B(g, 'booth_pintu_kaca', .94, 2.0, .03, K.glass, 0, .1, .53); B(g, 'booth_gagang', .03, .3, .04, K.steel, .38, 1.0, .56);
      B(g, 'booth_kursi', .5, .45, .45, K.cream, 0, 0, -.2); B(g, 'booth_meja', .7, .04, .3, K.white, 0, .9, -.3);
      Cy(g, 'booth_lampu', .1, .12, .06, K.warm, 0, 2.1, 0, 16);
      return g;
    }
    booth(-5.3, 7.4, K.gYellow); booth(-5.3, 8.95, K.gRed);
    tallPlant(lg2, -11.3, 9.3, 1); plant(lg2, -4.6, 9.4, .8); plant(lg2, -11.2, 3.4, .8);

    /* Divisi Programmer */
    var pg = G(L2, 'divisi_programmer');
    function devStation(x, z, ry, o) {
      o = o || {};
      var g = G(pg, 'meja_programmer', x, z, ry);
      chair(g, 0, 0, 0, o.kursi || K.chair);
      var d = G(g, 'meja_dev', 0, .62);
      B(d, 'daun_meja', 1.5, .05, .75, K.white, 0, .7, 0);
      [-1, 1].forEach(function (sx) { B(d, 'kaki_meja', .05, .7, .68, K.black, sx * .69, 0, 0); });
      B(d, 'tiang_monitor', .05, .25, .05, K.black, 0, .75, .27);
      var m1 = G(d, 'monitor_utama', -.18, .26, 0, .95); B(m1, 'monitor', .62, .37, .035, K.black, 0, 0, 0); Plane(m1, 'layar', .58, .33, o.layar || SCR.kode, 0, .185, -.019).rotation.y = Math.PI;
      var m2 = G(d, 'monitor_vertikal', .42, .22, -.35, .82); B(m2, 'monitor', .36, .6, .035, K.black, 0, 0, 0); Plane(m2, 'layar', .32, .56, o.layar2 || SCR.kode2, 0, .3, -.019).rotation.y = Math.PI;
      B(d, 'keyboard_mekanik', .42, .03, .14, K.black, -.1, .75, -.1); B(d, 'keycap', .4, .012, .12, o.keycap || K.keycap, -.1, .78, -.1);
      B(d, 'lampu_rgb', .42, .006, .02, mat('rgb', '#111', { e: '#b084ff', ei: 1.4 }), -.1, .75, -.17);
      Sp(d, 'mouse', .035, K.black, .28, .77, -.1, 10).scale.set(1, .5, 1.4);
      var hs = G(d, 'stand_headphone', -.62, .1, 0, .75); Cy(hs, 'tiang_headphone', .012, .03, .3, K.black, 0, 0, 0, 8);
      var band = new THREE.Mesh(new THREE.TorusGeometry(.09, .012, 8, 18, Math.PI), o.hp || K.gRed); band.name = 'headphone'; band.position.y = .3; hs.add(band);
      [-1, 1].forEach(function (sx) { Cy(hs, 'bantalan_headphone', .045, .045, .04, K.black, sx * .09, .24, 0, 14).rotation.z = Math.PI / 2; });
      if (o.bebek) duck(d, .55, .75, -.2, -.6);
      if (o.mug) mug(d, .6, .75, .05, o.mug);
      if (o.sukulen) succulent(d, -.62, .75, -.25);
      for (var sn2 = 0; sn2 < 2; sn2++) B(d, 'sticky_note', .06, .06, .005, sn2 ? K.gYellow : K.gGreen, -.44 + sn2 * .08, 1.05, .235);
      daftarKursi({ x: x, z: z, r: ry, jenis: 'meja_dev', layar: layarDi(m1, 'layar'), dekat: [x, ry === 0 ? 1.0 : 5.0], akses: [ry === 0 ? 'pA' : 'pB'] });
      return g;
    }
    // kluster A & B (4 meja/kluster), jalur lega di antaranya
    devStation(-1.1, 1.9, 0, { bebek: true, mug: K.gBlue }); devStation(.5, 1.9, 0, { hp: K.gYellow, sukulen: true });
    devStation(-1.1, 4.1, Math.PI, { mug: K.white, keycap: K.gYellow }); devStation(.5, 4.1, Math.PI, { bebek: true, hp: K.gBlue });
    devStation(3.3, 1.9, 0, { sukulen: true, layar: SCR.kode2, layar2: SCR.kode }); devStation(4.9, 1.9, 0, { mug: K.gRed, keycap: K.gBlue });
    devStation(3.3, 4.1, Math.PI, { bebek: true }); devStation(4.9, 4.1, Math.PI, { sukulen: true, hp: K.gGreen });
    B(pg, 'sekat_kluster_a', 3.1, .35, .03, K.gGreen, -.3, .75, 3.0); B(pg, 'sekat_kluster_b', 3.1, .35, .03, K.gBlue, 4.1, .75, 3.0);
    // meja berdiri menghadap jendela
    [.5, 2.3, 4.1].forEach(function (x, i) {
      var g = G(pg, 'meja_berdiri', x, 9.0);
      B(g, 'daun_meja_berdiri', 1.4, .05, .7, K.wood, 0, 1.0, 0);
      [-1, 1].forEach(function (sx) { Cy(g, 'kaki_teleskop', .03, .035, 1.0, K.black, sx * .6, 0, 0, 10); B(g, 'kaki_dasar', .06, .03, .6, K.black, sx * .6, 0, 0); });
      B(g, 'tiang_monitor', .05, .25, .05, K.black, 0, 1.05, .25);
      var mm = G(g, 'monitor_berdiri', 0, .27, Math.PI, 1.22); B(mm, 'monitor', .6, .36, .035, K.black, 0, 0, 0); Plane(mm, 'layar', .56, .32, i % 2 ? SCR.kode2 : SCR.kode, 0, .18, .019);
      B(g, 'keyboard', .42, .03, .14, K.black, 0, 1.05, -.12);
      B(g, 'matras_berdiri', .8, .015, .5, K.black, 0, .02, -.75);
      if (i === 2) duck(g, .55, 1.05, -.15, .4);
      daftarKursi({ x: x, z: 8.25, r: 0, jenis: 'meja_berdiri', duduk: false, layar: layarDi(mm, 'layar'), dekat: [x, 7.6], akses: ['pC'] });
    });
    // kanban & neon di dinding barat
    B(pg, 'papan_kanban', .03, 1.2, 2.4, K.white, -3.91, .85, 3.0);
    [[K.gRed, 2.2], [K.gYellow, 3.0], [K.gGreen, 3.8]].forEach(function (a, ci) {
      B(pg, 'kepala_kolom', .035, .12, .75, a[0], -3.89, 1.93, a[1]);
      var nNotes = [5, 3, 4][ci];
      for (var nn = 0; nn < nNotes; nn++) { var st2 = B(pg, 'sticky_kanban', .035, .13, .13, pick([K.gYellow, K.cream, K.gBlue, K.coral, K.gGreen]), -3.88, 1.72 - Math.floor(nn / 2) * .2, a[1] - .17 + (nn % 2) * .34); st2.rotation.x = (rand() - .5) * .2; }
    });
    var neonC = canvasTex(512, 170, function (c, w, h) {
      c.clearRect(0, 0, w, h); c.textBaseline = 'middle';
      c.shadowColor = '#22d3ee'; c.shadowBlur = 22; c.fillStyle = '#b8f6ff'; c.font = '800 88px "SFMono-Regular", Menlo, monospace'; c.fillText('</>', 20, 72);
      c.shadowColor = '#f472b6'; c.shadowBlur = 18; c.fillStyle = '#ffd1ea'; c.font = '800 34px "Plus Jakarta Sans", system-ui, sans-serif'; c.fillText('DIVISI', 212, 50); c.fillText('PROGRAMMER', 212, 100);
    });
    var neonM = new THREE.MeshBasicMaterial({ map: neonC.t, transparent: true, depthWrite: false, toneMapped: false }); neonM.name = 'neon_programmer';
    Plane(pg, 'neon_programmer', 1.5, .5, neonM, -3.9, 1.65, .75, Math.PI / 2);
    // papan tulis & TV sprint di sisi timur
    var wbP = G(pg, 'papan_tulis_programmer', 8.4, .9, -Math.PI / 2);
    B(wbP, 'bingkai_papan', 1.9, 1.2, .03, K.metal, 0, .85, 0); [-1, 1].forEach(function (sx) { B(wbP, 'kaki_papan', .05, .9, .4, K.metal, sx * .85, 0, 0); });
    Plane(wbP, 'papan_tulis', 1.82, 1.12, SCR.diagram, 0, 1.45, .02);
    B(pg, 'stand_tv_sprint', .5, 1.0, .4, K.metal, 8.5, 0, 3.4);
    screenOn(pg, 'tv_sprint', 1.6, .92, K.black, SCR.sprint, 8.48, 1.0, 3.4, -Math.PI / 2);
    // pojok santai
    rug(pg, 'karpet_santai', 2.4, 1.8, K.gYellow, 6.9, 8.7);
    [[6.2, 8.3, K.gRed], [7.4, 9.1, K.gBlue]].forEach(function (a) { Sp(pg, 'bean_bag', .42, a[2], a[0], .28, a[1]).scale.y = .65; });
    B(pg, 'meja_rendah', .6, .3, .45, K.wood, 6.9, 0, 8.7); B(pg, 'konsol_game', .25, .05, .15, K.black, 6.9, .3, 8.7);
    [-1, 1].forEach(function (sx) { Sp(pg, 'stik_game', .04, K.black, 6.9 + sx * .18, .34, 8.6, 10).scale.set(1.4, .5, 1); });
    tallPlant(pg, -3.4, 9.4, 1); plant(pg, -3.4, -.4, .8); plant(pg, 5.9, 9.5, .8); plant(pg, 8.5, -.4, .8);

    /* Teras */
    var ter = G(L2, 'teras');
    var pergola = G(ter, 'pergola', 12.3, 0);
    [[-1.8, -2], [1.8, -2], [-1.8, 2], [1.8, 2]].forEach(function (c) { Cy(pergola, 'tiang_pergola', .07, .07, 2.5, K.wood, c[0], 0, c[1], 12); });
    [-2, 2].forEach(function (z) { B(pergola, 'balok_pergola', 4.0, .12, .12, K.wood, 0, 2.5, z); });
    for (var sl = 0; sl < 10; sl++) B(pergola, 'bilah_pergola', .06, .08, 4.4, K.wood, -1.8 + sl * .4, 2.62, 0);
    for (var bl = 0; bl < 16; bl++) { var bz = -2 + (bl % 8) * .57, bx = bl < 8 ? -1.8 : 1.8; Sp(pergola, 'lampu_gantung', .035, K.warm, bx, 2.42 - .06 * Math.sin((bl % 8) / 7 * Math.PI), bz, 8); }
    sofa(ter, 12.3, -1.3, 0, 2.2, K.outdoor); sofa(ter, 12.3, 1.3, Math.PI, 2.2, K.outdoor);
    B(ter, 'meja_teras', 1.1, .35, .6, K.wood, 12.3, 0, 0);
    bistroSet(ter, 11.8, -6.6, [K.gBlue, K.gRed, K.gYellow, K.gGreen]);
    [11.2, 13.4].forEach(function (x) {
      var lo = G(ter, 'kursi_berjemur', x, 6.8);
      B(lo, 'alas_kursi_berjemur', .65, .3, 1.8, K.white, 0, 0, 0);
      var back = B(lo, 'sandaran_berjemur', .65, .06, .7, K.outdoor, 0, .3, -.72); back.rotation.x = .75; back.position.y = .52;
    });
    B(ter, 'meja_samping', .4, .4, .4, K.wood, 12.3, 0, 6.4);
    umbrellaSet(ter, 12.3, 8.6, K.gYellow, 0).children.forEach(function (c) { if (c.name === 'kursi') c.visible = false; });
    B(ter, 'pot_teras_timur_a', .6, .5, 4.5, K.planter, 14.55, 0, -5.5); B(ter, 'pot_teras_timur_b', .6, .5, 4.5, K.planter, 14.55, 0, 5.2);
    B(ter, 'pot_teras_utara', 4.2, .5, .5, K.planter, 11.8, 0, -9.55);
    for (var pt = 0; pt < 7; pt++) { Sp(ter, 'semak_teras', .28, pt % 2 ? K.leaf2 : K.leaf, 14.55, .62, -7.4 + pt * .65, 12); Sp(ter, 'semak_teras', .28, pt % 2 ? K.leaf : K.leaf2, 14.55, .62, 3.2 + pt * .65, 12); Sp(ter, 'semak_teras', .26, pt % 2 ? K.leaf2 : K.leaf, 9.95 + pt * .62, .6, -9.55, 12); }
    tallPlant(ter, 9.6, 9.4, 1); tallPlant(ter, 9.6, -3.5, .9);
    /* meja kerja rooftop: meja A (4 kursi, utara pergola) & meja B (2 kursi, selatan pergola), laptop di tiap kursi */
    function laptopTeras(p, x, z, ry) {
      var g = G(p, 'laptop_teras', x, z, ry, .75);
      B(g, 'alas_laptop', .34, .015, .24, K.steel, 0, 0, 0);
      var lid = B(g, 'tutup_laptop', .34, .23, .012, K.steel, 0, .015, .12); lid.rotation.x = .25;
      B(lid, 'layar_laptop', .3, .19, .002, K.screen, 0, -.095, -.008);
      return g;
    }
    function mejaTeras(x, z, w, kursiTeras) {
      var g = G(ter, 'meja_kerja_teras', x, z);
      B(g, 'daun_meja_teras', w, .05, .85, K.wood, 0, .7, 0);
      [-1, 1].forEach(function (sx) { B(g, 'kaki_meja_teras', .05, .7, .75, K.black, sx * (w / 2 - .06), 0, 0); });
      Cy(g, 'pot_kecil_teras', .06, .05, .1, K.pot, 0, .75, 0, 12); Sp(g, 'daun', .08, K.leaf, 0, .88, 0, 10);
      kursiTeras.forEach(function (k) {
        chair(ter, k[0], k[1], k[2], K.outdoor);
        var lp = laptopTeras(ter, k[0] + Math.sin(k[2]) * .5, k[1] + Math.cos(k[2]) * .5, k[2]);
        daftarKursi({ x: k[0], z: k[1], r: k[2], jenis: 'teras', layar: layarDi(lp, 'layar_laptop'), dekat: [k[0], k[3]], akses: [k[4]] });
      });
    }
    mejaTeras(12.4, -3.9, 1.9, [[11.95, -4.6, 0, -5.15, 'terasN'], [12.85, -4.6, 0, -5.15, 'terasN'], [11.95, -3.2, Math.PI, -2.65, 'terasC'], [12.85, -3.2, Math.PI, -2.65, 'terasC']]);
    mejaTeras(12.4, 3.7, 1.9, [[11.95, 4.4, Math.PI, 4.95, 'terasS'], [12.85, 4.4, Math.PI, 4.95, 'terasS']]);
    /* titik santai berdiri (bukan kursi kerja): ngopi di pantry lt 1, merokok HANYA di luar gedung (taman lt 1 & tepi teras lt 2) */
    LANTAI = 1;
    daftarTitik({ jenis: 'kopi', x: 13.95, z: -3.3, r: Math.PI / 2, dekat: [13.2, -3.3], akses: ['pantryE'], nama: 'pantry' });
    daftarTitik({ jenis: 'kopi', x: 12.05, z: -1.95, r: -Math.PI / 2, dekat: [12.6, -1.95], akses: ['pantryE'], nama: 'pantry' });
    daftarTitik({ jenis: 'kopi', x: 12.05, z: -.75, r: -Math.PI / 2, dekat: [12.6, -.75], akses: ['pantryE'], nama: 'pantry' });
    daftarTitik({ jenis: 'rokok', x: 18.2, z: 3.9, r: .46, dekat: [17.4, 4.2], akses: ['tamanL'], nama: 'taman' });
    daftarTitik({ jenis: 'rokok', x: 18.6, z: 4.7, r: -2.68, dekat: [17.4, 4.2], akses: ['tamanL'], nama: 'taman' });
    daftarTitik({ jenis: 'rokok', x: -10.1, z: 12.55, r: .5, dekat: [-11.0, 12.2], akses: ['luarPintu'], nama: 'halaman depan' });
    LANTAI = 2;
    daftarTitik({ jenis: 'rokok', x: 14.45, z: -2.65, r: Math.PI / 2, dekat: [13.9, -2.65], akses: ['terasC'], nama: 'teras' });
    daftarTitik({ jenis: 'rokok', x: 10.5, z: 8.6, r: 0, dekat: [10.3, 7.9], akses: ['terasW'], nama: 'teras' });

    /* ---------- label ---------- */
    label(L1, 'DISKUSI KLIEN', -12, -4.6, 0, .3); label(L1, 'RUANG RAPAT', -6, -4.6); label(L1, 'STUDIO DESAIN', 1, -4.6, 0, .3);
    label(L1, 'TANGGA', 7.4, -4.6, 0, .28); label(L1, 'GUDANG', 10, -4.6, 0, .28); label(L1, 'TOILET', 13.25, -4.6, 0, .28);
    label(L1, 'LOBBY · RESEPSIONIS', -11.5, 3.2); label(L1, 'OPEN WORKSPACE', 1.8, 1.0, 0, .4);
    label(L1, 'MUSHOLLA', -5.5, 5.6, 0, .3); label(L1, 'PANTRY', 12.4, 2.6, 0, .3); label(L1, 'LOUNGE', 11.6, 3.5, 0, .3);
    label(L1, 'RUANG RAPAT 2', 6.1, 6.0, 0, .3); label(L1, 'GONDOLA MEETING', -.05, 5.7, 0, .28);
    label(L1, 'HUDDLE', 5.8, 1.3, 0, .26); label(L1, 'GAME · NAP POD', 11.8, 7.7, 0, .26); label(L1, 'TAMAN', 19.9, 3.2, 0, .5);
    label(L2, 'RUANG PIMPINAN', -10.4, -3.55, 0, .28); label(L2, 'DEVOPS · NOC', -5.9, -3.55, 0, .3); label(L2, 'RUANG SERVER', 2.2, -4.8, 0, .26);
    label(L2, 'TANGGA', 7.6, -3.55, 0, .28); label(L2, 'DIVISI PROGRAMMER', 2.4, .55, 0, .34); label(L2, 'LOUNGE & PANTRY', -9.6, 4.3, 0, .3);
    label(L2, 'TOILET', -13.5, .9, 0, .24); label(L2, 'TERAS LANTAI 2', 12.3, 4.3, 0, .4);

    /* ---------- orang (17, tidak ada tambahan) ---------- */
    var orang = {};
    var TEMPAT = {
      resepsionis: { l: 1, x: -11.8, z: -.2, r: 0, pose: 'duduk', aksi: 'ketik' },
      rapat_1: { l: 1, x: -7.1, z: -8.2, r: 0, pose: 'duduk', aksi: 'bicara', lihat: .45 },
      rapat_2: { l: 1, x: -4.9, z: -6.2, r: Math.PI, pose: 'duduk', aksi: 'dengar', lihat: .4 },
      desainer: { l: 1, x: 1, z: -8.3, r: Math.PI, pose: 'duduk', aksi: 'ketik' },
      staf_2: { l: 1, x: .25, z: -.18, r: Math.PI, pose: 'duduk', aksi: 'ketik' },
      pantry: { l: 1, x: 13.9, z: -2.4, r: Math.PI / 2, pose: 'berdiri', aksi: 'minum' },
      lounge: { l: 1, x: 14.25, z: 6.4, r: -Math.PI / 2, pose: 'duduk', aksi: 'santai', hy: .5 },
      taman: { l: 1, pose: 'berdiri', aksi: 'jalan', laju: .7, path: [
        { x: 17.6, z: 1.0, diam: 2.5, aksi: 'berdiri' }, { x: 17.6, z: -2.8 }, { x: 19.4, z: -2.9 },
        { x: 21.2, z: -3.9, diam: 3.5, aksi: 'lambai', hadap: -Math.PI / 2 }, { x: 19.4, z: -2.9 }, { x: 17.6, z: -2.8 }] },
      rapat2_1: { l: 1, x: 5.0, z: 6.7, r: 0, pose: 'duduk', aksi: 'ketik' },
      rapat2_2: { l: 1, x: 7.2, z: 8.7, r: Math.PI, pose: 'duduk', aksi: 'bicara', lihat: .3 },
      rapat2_3: { l: 1, x: 4.2, z: 7.7, r: Math.PI / 2, pose: 'duduk', aksi: 'dengar', lihat: .15 },
      gondola_1: { l: 1, x: -2.01, z: 7.85, r: Math.PI / 2, pose: 'duduk', aksi: 'bicara', hy: .56 },
      gondola_2: { l: 1, x: -.79, z: 7.55, r: -Math.PI / 2, pose: 'duduk', aksi: 'dengar', hy: .56 },
      pimpinan: { l: 2, x: -11.5, z: -8.95, r: 0, pose: 'duduk', aksi: 'telepon' },
      it_server: { l: 2, x: -5.5, z: -6.35, r: Math.PI, pose: 'duduk', aksi: 'ketik' },
      staf_1: { l: 2, x: .5, z: 1.9, r: 0, pose: 'duduk', aksi: 'ketik', lirik: -1 },
      staf_3: { l: 2, x: 2.3, z: 8.25, r: 0, pose: 'berdiri', aksi: 'ketik' }
    };
    ORANG.DAFTAR.forEach(function (d) {
      var tp = TEMPAT[d.id]; if (!tp) return;
      var spec = {}; for (var k in d) spec[k] = d[k]; for (var k2 in tp) spec[k2] = tp[k2];
      var P = ORANG.buat(tp.l === 2 ? L2 : L1, spec); orang[d.id] = P;
      if (tp.x != null) kursi.forEach(function (k) { if (k.lantai === tp.l && Math.abs(k.x - tp.x) < .05 && Math.abs(k.z - tp.z) < .05) { k.pemilik = d.id; P.kursi = k; } });
    });

    /* ---------- kolom struktur & penanda tangga (mode terpisah) ---------- */
    var kolom = G(model, 'kolom_struktur'); kolom.userData.hidup = true; kolom.visible = false;
    [[15, -10], [15, -5], [15, 0], [15, 5], [15, 10], [-15, 10], [-10, 10], [-5, 10], [0, 10], [5, 10], [10, 10]].forEach(function (c) { Cy(kolom, 'kolom', .14, .14, Y2 - .15, K.pillar, c[0], 0, c[1], 16); });
    var ghostM = new THREE.MeshBasicMaterial({ color: '#4285f4', transparent: true, opacity: .16, depthWrite: false }); ghostM.name = 'penanda_tangga';
    var hantu = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1, 4.76), ghostM); hantu.name = 'penanda_jalur_tangga'; hantu.position.set(5.75, Y2 + .5, -6.68); hantu.userData.hidup = true; model.add(hantu);

    /* ---------- pusatkan pada lantai 1 ---------- */
    var bb = new THREE.Box3().setFromObject(L1), ctr = bb.getCenter(new THREE.Vector3());
    model.children.forEach(function (c) { c.position.x -= ctr.x; c.position.z -= ctr.z; });
    model.position.y = -bb.min.y;

    /* bekukan matriks benda statis (hemat CPU) */
    (function freeze(o) {
      if (o.userData.anim) return;
      if (!o.userData.hidup) { o.updateMatrix(); o.matrixAutoUpdate = false; }
      o.children.forEach(freeze);
    })(model);
    model.matrixAutoUpdate = true;

    /* ---------- peta jalur (graf titik lorong) ---------- */
    var NODE = {
      a1: [1, -7.2, -3.0], b1: [1, -3.8, -3.0], c1: [1, .9, -3.0], d1: [1, 5.75, -3.0], e1: [1, 8.0, -3.0],
      f1: [1, -7.2, 1.0], g1: [1, 2.6, 1.0], h1: [1, 8.0, 1.0],
      lobi: [1, -8.7, 1.0], lobiN: [1, -9.4, -2.7], klienL: [1, -10.2, -3.4], klienD: [1, -10.2, -4.9],
      rapatD: [1, -3.8, -4.9], m1S: [1, -3.9, -5.5], m1N: [1, -3.9, -8.9],
      studioD: [1, .9, -4.9], sW: [1, -.6, -4.9], sW2: [1, -.6, -7.45],
      pantry: [1, 9.8, .8], lounge: [1, 11.8, 2.5], loungeD: [1, 11.8, 3.8], taman: [1, 14.4, 4.2], tamanL: [1, 16.0, 4.2],
      r2L: [1, 4.8, 4.8], r2D: [1, 4.8, 6.0], r2E: [1, 7.9, 6.0], r2S: [1, 7.9, 9.4],
      gU: [1, 2.6, 5.9], g1D: [1, -1.4, 6.3], g2D: [1, 1.3, 6.3],
      tBawah: [1, 5.75, -3.6],
      tAtas: [2, 5.75, -9.55], h2a: [2, 7.4, -9.4], h2b: [2, 7.4, -4.2], k2e: [2, 7.4, -2.0], k2srv: [2, 4.0, -2.0], k2prog: [2, 1.6, -2.0],
      k2noc: [2, -4.1, -2.0], k2ceo: [2, -9.2, -2.0], ceoD: [2, -9.2, -3.8], ceoIn: [2, -9.8, -6.2], ceoE: [2, -9.8, -8.95],
      nocD: [2, -4.1, -3.9], nocIn: [2, -4.1, -5.6], srvD: [2, 4.0, -3.6], srvIn: [2, 4.2, -4.6],
      progD: [2, 1.6, -.3], pA: [2, 1.9, 1.0], pB: [2, 1.9, 5.0], pC: [2, 1.9, 7.6],
      pantryE: [1, 12.8, .3], pintuD: [1, -11.5, 8.9], luarPintu: [1, -11.5, 11.5],
      terasP: [2, 8.3, -5.9], terasU: [2, 10.1, -5.9], terasN: [2, 10.5, -5.15], terasC: [2, 10.5, -2.65],
      progT: [2, 8.3, 6.8], terasW: [2, 10.0, 6.8], terasS: [2, 10.2, 4.95]
    };
    var ADJ = {};
    ('a1-b1 b1-c1 c1-d1 d1-e1 a1-f1 f1-g1 g1-h1 e1-h1 f1-lobi lobi-lobiN lobiN-klienL klienL-klienD b1-rapatD rapatD-m1S m1S-m1N ' +
     'c1-studioD studioD-sW sW-sW2 h1-pantry pantry-lounge lounge-loungeD loungeD-taman taman-tamanL g1-r2L r2L-r2D r2D-r2E r2E-r2S ' +
     'g1-gU gU-g1D gU-g2D d1-tBawah tBawah-tAtas tAtas-h2a h2a-h2b h2b-k2e k2e-k2srv k2srv-k2prog k2prog-k2noc k2noc-k2ceo ' +
     'k2ceo-ceoD ceoD-ceoIn ceoIn-ceoE k2noc-nocD nocD-nocIn k2srv-srvD srvD-srvIn k2prog-progD progD-pA pA-pB pB-pC ' +
     'pantry-pantryE lobi-pintuD pintuD-luarPintu h2b-terasP terasP-terasU terasU-terasN terasN-terasC pC-progT progT-terasW terasW-terasS').split(' ').forEach(function (e) {
      var ab = e.split('-'); (ADJ[ab[0]] = ADJ[ab[0]] || []).push(ab[1]); (ADJ[ab[1]] = ADJ[ab[1]] || []).push(ab[0]);
    });
    var titikLapor = kursi.filter(function (k) { return k.jenis === 'lapor'; });
    kursi.concat(titik).forEach(function (k) {
      if (Array.isArray(k.akses)) { var best = null, bd = 1e9; k.akses.forEach(function (n) { var d = Math.hypot(NODE[n][1] - k.dekat[0], NODE[n][2] - k.dekat[1]); if (d < bd) { bd = d; best = n; } }); k.akses = best; }
    });
    function nodeLen(a, b) { return NODE[a][0] !== NODE[b][0] ? 6 : Math.hypot(NODE[a][1] - NODE[b][1], NODE[a][2] - NODE[b][2]); }
    function cariJalur(a, b) {
      var dist = {}, prev = {}, left = Object.keys(NODE); dist[a] = 0;
      while (left.length) {
        left.sort(function (x, y) { return (dist[x] == null ? 1e9 : dist[x]) - (dist[y] == null ? 1e9 : dist[y]); });
        var u = left.shift(); if (dist[u] == null || u === b) break;
        (ADJ[u] || []).forEach(function (v) { var nd = dist[u] + nodeLen(u, v); if (dist[v] == null || nd < dist[v]) { dist[v] = nd; prev[v] = u; } });
      }
      var path = [b]; while (path[0] !== a) { if (!prev[path[0]]) return [a, b]; path.unshift(prev[path[0]]); } return path;
    }
    var FL = function (n) { return n === 2 ? L2 : L1; };
    /* rute(dari, ke): dari/ke = objek kursi (dari R.kursi / R.titikLapor). Hasil: titik untuk ORANG.jalanKe */
    function rute(dari, ke) {
      var out = [], push = function (lt, x, z, y) { out.push({ x: x, z: z, y: y || 0, lantai: lt, induk: FL(lt) }); };
      push(dari.lantai, dari.dekat[0], dari.dekat[1]);
      var nodes = cariJalur(dari.akses, ke.akses);
      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i], N = NODE[n], nx = nodes[i + 1];
        push(N[0], N[1], N[2]);
        if (n === 'tBawah' && nx === 'tAtas') { push(1, SX, Z0 - .05, 0); push(1, SX, Z0 - RUN + .2, Y2); }
        if (n === 'tAtas' && nx === 'tBawah') { push(1, SX, Z0 - RUN + .2, Y2); push(1, SX, Z0 - .05, 0); }
      }
      push(ke.lantai, ke.dekat[0], ke.dekat[1]);
      push(ke.lantai, ke.x, ke.z);
      return out;
    }

    function tick(t, dt) {
      for (var i = 0; i < anims.length; i++) {
        var a = anims[i];
        if (!a.every) { a.f(t); continue; }
        a.acc += dt; if (a.acc >= a.every) { a.acc = 0; a.f(t); }
      }
      ORANG.tick(t, dt);
    }
    return { model: model, lantai1: L1, lantai2: L2, kolom: kolom, hantu: hantu, Y2: Y2, GAP: GAP, tick: tick,
      orang: orang, kursi: kursi, titikLapor: titikLapor, titikSantai: titik, rute: rute, NODE: NODE, ADJ: ADJ };
  }
  window.PadevKantor = { build: build, Y2: Y2, GAP: GAP };
})();
