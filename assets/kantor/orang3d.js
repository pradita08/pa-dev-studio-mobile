/* PADEV STUDIO CLAUDE — karakter miniatur 3D.
   Rig bersendi (pinggul, lutut, bahu, siku, leher), gaya rambut & hijab,
   busana, sepatu, aksesoris, dan animasi idle supaya tidak kaku.
   Dipakai oleh Main.dc.html (kantor) dan Karakter.dc.html (katalog). */
(function () {
  'use strict';
  var KULIT = ['#f6d3b0', '#eab98b', '#d29a6a', '#b77b4f', '#95603c', '#6f4630'];

  /* ---------- daftar 17 pegawai (tampilan) ---------- */
  var DAFTAR = [
    { id: 'pimpinan', peran: 'Pimpinan', kulit: 1, rambut: { gaya: 'belah', warna: '#2a2522' },
      atasan: { jenis: 'blazer', warna: '#1f2a44', dalam: '#ffffff', dasi: '#c0392b' }, bawahan: { jenis: 'celana', warna: '#1d2330' },
      sepatu: { jenis: 'formal', warna: '#1a1614' }, aks: { kacamata: 'kotak', jam: '#c9a45a', kumis: true } },
    { id: 'it_server', peran: 'DevOps Engineer', kulit: 4, rambut: { gaya: 'undercut', warna: '#1d1916' },
      atasan: { jenis: 'hoodie', warna: '#3d4652' }, bawahan: { jenis: 'jeans', warna: '#34506e' },
      sepatu: { jenis: 'sneaker', warna: '#f4f4f0', aksen: '#4285f4' }, aks: { headphone: 'kepala', warnaHeadphone: '#ea4335', lanyard: '#4285f4', jam: '#222222' } },
    { id: 'staf_1', peran: 'Programmer', kulit: 3, rambut: { gaya: 'keriting', warna: '#1d1916' },
      atasan: { jenis: 'kaos', warna: '#e76f51', print: '#fbbc05' }, bawahan: { jenis: 'jeans', warna: '#2c3e50' },
      sepatu: { jenis: 'sneaker', warna: '#fbbc05', aksen: '#1d2433' }, aks: { headphone: 'leher', warnaHeadphone: '#222222' } },
    { id: 'staf_3', peran: 'Programmer', kulit: 2, rambut: { gaya: 'pendek', warna: '#4a2f1f' },
      atasan: { jenis: 'kemeja', warna: '#4d96ff', gulung: true }, bawahan: { jenis: 'celana', warna: '#a08a6a' },
      sepatu: { jenis: 'sneaker', warna: '#1d2433', sol: '#f4f4f0' }, aks: { kacamata: 'bulat', topi: { jenis: 'cap', warna: '#34a853', balik: true } } },
    { id: 'desainer', peran: 'Desainer UI/UX', fem: true, kulit: 0, rambut: { gaya: 'cepol', warna: '#7a4e2d' },
      atasan: { jenis: 'kaos', warna: '#b86bff', print: '#fbbc05' }, bawahan: { jenis: 'jeans', warna: '#3b5b8a' },
      sepatu: { jenis: 'sneaker', warna: '#ffffff', aksen: '#b86bff' }, aks: { anting: true } },
    { id: 'resepsionis', peran: 'Resepsionis', fem: true, kulit: 1, hijab: '#3b6cf6',
      atasan: { jenis: 'blazer', warna: '#f4f1ea', dalam: '#3b6cf6' }, bawahan: { jenis: 'rok', warna: '#2f3542' },
      sepatu: { jenis: 'flat', warna: '#1d2433' }, aks: { lanyard: '#34a853' } },
    { id: 'staf_2', peran: 'Staf Admin', fem: true, kulit: 0, hijab: '#e9b949',
      atasan: { jenis: 'tunik', warna: '#06b58f' }, bawahan: { jenis: 'rok', warna: '#3d4a5c' },
      sepatu: { jenis: 'flat', warna: '#6b4a33' }, aks: { jam: '#d4b25a' } },
    { id: 'rapat_1', peran: 'Project Manager', kulit: 2, rambut: { gaya: 'pendek', warna: '#1d1916' },
      atasan: { jenis: 'polo', warna: '#2a9d8f' }, bawahan: { jenis: 'celana', warna: '#3d4a5c' },
      sepatu: { jenis: 'sneaker', warna: '#f4f4f0', aksen: '#2a9d8f' }, aks: { jam: '#222222', jenggot: true } },
    { id: 'rapat_2', peran: 'Tim Proyek', fem: true, kulit: 3, hijab: '#8e7dbe',
      atasan: { jenis: 'kardigan', warna: '#f4a261', dalam: '#ffffff' }, bawahan: { jenis: 'rok', warna: '#4b4038' },
      sepatu: { jenis: 'flat', warna: '#8e7dbe' } },
    { id: 'pantry', peran: 'Staf Umum', fem: true, kulit: 1, rambut: { gaya: 'kuncir', warna: '#4a2f1f' },
      atasan: { jenis: 'kaos', warna: '#ef476f', print: '#ffffff' }, bawahan: { jenis: 'jeans', warna: '#34506e' },
      sepatu: { jenis: 'sneaker', warna: '#ffffff', aksen: '#ef476f' }, aks: { pegang: 'kopi', anting: true } },
    { id: 'lounge', peran: 'Copywriter', kulit: 4, rambut: { gaya: 'pendek', warna: '#1d1916' },
      atasan: { jenis: 'hoodie', warna: '#e9b949' }, bawahan: { jenis: 'jeans', warna: '#2c3e50' },
      sepatu: { jenis: 'sneaker', warna: '#ea4335', aksen: '#ffffff' }, aks: { topi: { jenis: 'beanie', warna: '#1d2433' }, headphone: 'leher', warnaHeadphone: '#f4f4f0', pegang: 'hp' } },
    { id: 'taman', peran: 'Marketing', kulit: 2, rambut: { gaya: 'belah', warna: '#4a2f1f' },
      atasan: { jenis: 'kemeja', warna: '#5c946e' }, bawahan: { jenis: 'celana', warna: '#c2a878' },
      sepatu: { jenis: 'boot', warna: '#6b4a33' }, aks: { ransel: '#1d2433', jam: '#222222' } },
    { id: 'rapat2_1', peran: 'Business Analyst', kulit: 0, rambut: { gaya: 'pendek', warna: '#4a2f1f' },
      atasan: { jenis: 'kemeja', warna: '#4285f4' }, bawahan: { jenis: 'celana', warna: '#2f3542' },
      sepatu: { jenis: 'formal', warna: '#5a3a22' }, aks: { kacamata: 'kotak', jam: '#c0c6cc' } },
    { id: 'rapat2_2', peran: 'Tim Proyek', fem: true, kulit: 3, hijab: '#34a853',
      atasan: { jenis: 'tunik', warna: '#fbbc05' }, bawahan: { jenis: 'rok', warna: '#2c3e50' },
      sepatu: { jenis: 'flat', warna: '#1d2433' } },
    { id: 'rapat2_3', peran: 'Account Manager', fem: true, kulit: 2, rambut: { gaya: 'bob', warna: '#1d1916' },
      atasan: { jenis: 'blazer', warna: '#ea4335', dalam: '#ffffff' }, bawahan: { jenis: 'celana', warna: '#1d2433' },
      sepatu: { jenis: 'formal', warna: '#1a1614' }, aks: { anting: true } },
    { id: 'gondola_1', peran: 'QA Engineer', kulit: 5, rambut: { gaya: 'keriting', warna: '#1d1916' },
      atasan: { jenis: 'kemeja', warna: '#ffffff', gulung: true }, bawahan: { jenis: 'jeans', warna: '#2c3e50' },
      sepatu: { jenis: 'sneaker', warna: '#34a853', aksen: '#ffffff' }, aks: { jenggot: true } },
    { id: 'gondola_2', peran: 'Content Creator', kulit: 1, rambut: { gaya: 'undercut', warna: '#4a2f1f' },
      atasan: { jenis: 'kaos', warna: '#34a853', print: '#ffffff' }, bawahan: { jenis: 'celana', warna: '#3d4a5c' },
      sepatu: { jenis: 'sneaker', warna: '#1d2433', sol: '#f4f4f0' }, aks: { lanyard: '#fbbc05', kacamata: 'bulat' } }
  ];

  function PadevOrang(THREE) {
    var TAU = Math.PI * 2, mats = {}, geos = {}, list = [];

    function M(hex, o) {
      o = o || {};
      var k = hex + '|' + (o.r == null ? '' : o.r) + '|' + (o.m || 0) + '|' + (o.ds ? 1 : 0) + '|' + (o.e || '') + '|' + (o.n || '');
      if (mats[k]) return mats[k];
      var m = new THREE.MeshStandardMaterial({ color: hex, roughness: o.r == null ? .62 : o.r, metalness: o.m || 0 });
      if (o.ds) m.side = THREE.DoubleSide;
      if (o.e) { m.emissive = new THREE.Color(o.e); m.emissiveIntensity = o.ei == null ? .5 : o.ei; }
      m.name = (o.n || 'orang') + '_' + String(hex).replace('#', '');
      return (mats[k] = m);
    }
    function geo(k, f) { return geos[k] || (geos[k] = f()); }
    function sph(r, w, h) { w = w || 20; h = h || 14; return geo('s' + r + '_' + w + '_' + h, function () { return new THREE.SphereGeometry(r, w, h); }); }
    function box(w, h, d) { return geo('b' + w + '_' + h + '_' + d, function () { return new THREE.BoxGeometry(w, h, d); }); }
    function cyl(a, b, h, s, open) { s = s || 18; return geo('c' + a + '_' + b + '_' + h + '_' + s + (open ? 'o' : ''), function () { return new THREE.CylinderGeometry(a, b, h, s, 1, !!open); }); }
    function cap(r, l) { return geo('p' + r + '_' + l, function () { return new THREE.CapsuleGeometry(r, l, 6, 14); }); }
    function add(p, g, m, x, y, z, name) {
      var me = new THREE.Mesh(g, m); me.position.set(x || 0, y || 0, z || 0); me.name = name || 'bagian';
      me.castShadow = true; me.receiveShadow = true; p.add(me); return me;
    }
    function grp(p, name, x, y, z) { var g = new THREE.Group(); g.name = name; g.position.set(x || 0, y || 0, z || 0); p.add(g); return g; }
    function limb(p, r, L, m, name) { return add(p, cap(r, Math.max(L - 2 * r, .01)), m, 0, -L / 2, 0, name); }
    function shade(hex, l) { var c = new THREE.Color(hex); c.offsetHSL(0, 0, l); return '#' + c.getHexString(); }
    function rng(seed) { var s = 0; for (var i = 0; i < seed.length; i++) s = (s * 31 + seed.charCodeAt(i)) % 2147483647; s = s || 7; return function () { s = (s * 16807) % 2147483647; return s / 2147483647; }; }

    /* ---------- sepatu ---------- */
    function sepatu(ankle, s) {
      var j = s.jenis || 'sneaker', c = s.warna || '#ffffff';
      var up = M(c, { r: j === 'formal' ? .25 : .6, m: j === 'formal' ? .15 : 0, n: 'sepatu' });
      var so = M(s.sol || (j === 'sneaker' ? '#f4f4f0' : '#2a2522'), { r: .75, n: 'sol' });
      var g = grp(ankle, 'sepatu_' + j, 0, 0, 0);
      if (j === 'boot') add(g, box(.125, .15, .2), up, 0, .0, 0, 'batang_boot');
      var low = j === 'flat';
      add(g, box(low ? .1 : .115, low ? .045 : .065, .22), up, 0, -.04, .035, 'badan_sepatu');
      var toe = add(g, sph(.056, 14, 10), up, 0, -.05, .135, 'ujung_sepatu'); toe.scale.set(low ? .9 : 1.02, low ? .5 : .62, 1.15);
      add(g, box(.125, .03, .29), so, 0, -.075, .05, 'sol');
      if (j === 'sneaker') {
        add(g, box(.05, .008, .09), M(s.tali || '#ffffff', { n: 'tali_sepatu' }), 0, -.004, .07, 'tali_sepatu');
        add(g, box(.12, .022, .05), M(s.aksen || shade(c, -.25), { n: 'aksen_sepatu' }), 0, -.05, -.065, 'aksen_tumit');
      }
      if (j === 'formal') add(g, box(.1, .012, .07), M('#111111', { n: 'hak' }), 0, -.094, -.06, 'hak');
      if (j === 'boot') add(g, box(.13, .02, .12), M(shade(c, -.2), { n: 'aksen_boot' }), 0, .07, 0, 'lipatan_boot');
      return g;
    }

    /* ---------- rambut & penutup kepala ---------- */
    /* cangkang bola dengan "jendela wajah" oval & batas bawah yang mengikuti kepala */
    function shellWin(key, r, win, sideY, backY) {
      return geo(key, function () {
        var g = new THREE.SphereGeometry(r, 80, 60), pos = g.attributes.position, idx = g.index.array, keep = [];
        var yMinAt = function (x, z) { var ang = Math.atan2(x, z); return sideY + (backY - sideY) * (1 - Math.cos(ang)) / 2; };
        for (var i = 0; i < idx.length; i += 3) {
          var cx = 0, cy = 0, cz = 0;
          for (var k = 0; k < 3; k++) { cx += pos.getX(idx[i + k]); cy += pos.getY(idx[i + k]); cz += pos.getZ(idx[i + k]); }
          cx /= 3; cy /= 3; cz /= 3;
          if (win && cz > 0 && (cx * cx) / (win.wx * win.wx) + ((cy - win.cy) * (cy - win.cy)) / (win.hy * win.hy) < 1) continue;
          if (sideY != null && cy < yMinAt(cx, cz)) continue;
          keep.push(idx[i], idx[i + 1], idx[i + 2]);
        }
        /* rapikan tepi: titik di tepi lubang ditarik tepat ke garis oval / garis bawah */
        var ec = {}, e, a, b;
        for (i = 0; i < keep.length; i += 3) for (k = 0; k < 3; k++) { a = keep[i + k]; b = keep[i + (k + 1) % 3]; e = a < b ? a + '_' + b : b + '_' + a; ec[e] = (ec[e] || 0) + 1; }
        var edgeV = {};
        for (e in ec) if (ec[e] === 1) { var ab = e.split('_'); edgeV[ab[0]] = 1; edgeV[ab[1]] = 1; }
        var nrm = g.attributes.normal;
        for (var vk in edgeV) {
          var v = +vk, x = pos.getX(v), y = pos.getY(v), z = pos.getZ(v), done = false;
          if (win && z > .02) {
            var ev = (x * x) / (win.wx * win.wx) + ((y - win.cy) * (y - win.cy)) / (win.hy * win.hy);
            if (ev < 2.2 && ev > .2) { var kk = 1 / Math.sqrt(ev); x *= kk; y = win.cy + (y - win.cy) * kk; z = Math.sqrt(Math.max(0, r * r - x * x - y * y)); done = true; }
          }
          if (!done && sideY != null) {
            var ym = yMinAt(x, z);
            if (Math.abs(y - ym) < .03) { var rad = Math.sqrt(Math.max(0, r * r - ym * ym)), hr = Math.sqrt(x * x + z * z) || 1; x = x / hr * rad; z = z / hr * rad; y = ym; done = true; }
          }
          if (done) { pos.setXYZ(v, x, y, z); nrm.setXYZ(v, x / r, y / r, z / r); }
        }
        g.setIndex(keep); return g;
      });
    }
    var UNIT = null;
    /* satu helai/gumpalan rambut, rebah mengikuti permukaan kepala */
    function helai(hg, m, ph, th, len, wid, thick, dir, lift, name) {
      if (!UNIT) UNIT = new THREE.SphereGeometry(1, 12, 8);
      var n = new THREE.Vector3(Math.sin(th) * Math.sin(ph), Math.cos(th), Math.sin(th) * Math.cos(ph));
      var d = dir.clone(); d.sub(n.clone().multiplyScalar(d.dot(n)));
      if (d.lengthSq() < 1e-6) d.set(0, 0, -1); d.normalize();
      var b = new THREE.Vector3().crossVectors(d, n).normalize();
      var R = .2 + (lift == null ? .012 : lift);
      var me = add(hg, UNIT, m, n.x * R, .16 + n.y * R, n.z * R, name || 'helai_rambut');
      me.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(b, d, n)); me.scale.set(wid, len, thick);
      return me;
    }
    function poni(hg, m, rand, side) {
      for (var i = 0; i < 6; i++) {
        var ph = -.5 + i * .2;
        helai(hg, m, ph, .8 + rand() * .05, .07, .042, .012, new THREE.Vector3(side * .8, -1, .15), .012, 'poni');
      }
    }
    function massa(hg, m, x, y, z, sx, sy, sz, rx, ry, rz, name) {
      var me = add(hg, sph(1, 32, 20), m, x, y, z, name || 'volume_rambut');
      me.scale.set(sx, sy, sz); me.rotation.set(rx || 0, ry || 0, rz || 0); return me;
    }
    function poniHalus(hg, m, side, w) {
      var p = add(hg, geo('poni' + w, function () { return new THREE.SphereGeometry(.224, 36, 16, Math.PI / 2 - w, w * 2, .5, .5); }), m, 0, .16, 0, 'poni');
      p.rotation.set(-.05, side * .22, side * .08); return p;
    }
    function rambut(P, hg, st, rand, fem, noTop) {
      var g = st.gaya || 'pendek', col = st.warna || '#1d1916', i;
      var hm = M(col, { r: .62, n: 'rambut' }), hmD = M(col, { r: .62, ds: true, n: 'rambut_dalam' });
      if (g === 'botak') return;
      if (!fem) {
        /* ---- rambut pria: dipahat halus ---- */
        var fade = g === 'undercut', sideM = fade ? M(shade(col, .05), { r: .85, n: 'rambut_tipis' }) : hm;
        add(hg, shellWin('rpL' + (fade ? 'u' : ''), fade ? .206 : .213, { wx: .16, hy: .2, cy: -.03 }, fade ? .02 : 0, -.13), sideM, 0, .16, 0, 'rambut');
        for (var sb = -1; sb <= 1; sb += 2) add(hg, box(.012, .05, .03), sideM, sb * .195, .128, .06, 'jambang');
        if (noTop) return;
        if (g === 'pendek') massa(hg, hm, 0, .335, -.01, .125, .055, .145, 0, 0, 0, 'volume_atas');
        if (g === 'belah') {
          massa(hg, hm, .02, .33, .005, .14, .075, .15, 0, 0, -.12, 'sisiran_samping');
          massa(hg, hm, .05, .365, .1, .085, .045, .07, -.35, 0, -.45, 'jambul');
          add(hg, box(.004, .006, .12), M(shade(col, -.2), { n: 'garis_belahan' }), -.07, .37, .06, 'garis_belahan').rotation.set(-.3, 0, .35);
        }
        if (g === 'undercut') {
          massa(hg, hm, 0, .34, 0, .12, .085, .17, .1, 0, 0, 'rambut_atas');
          massa(hg, hm, 0, .38, .1, .09, .05, .07, -.5, 0, 0, 'jambul');
        }
        if (g === 'keriting') {
          for (i = 0; i < 80; i++) {
            var th = rand() * 1.45, ph = rand() * TAU;
            if (Math.cos(ph) > .4 && th > .85) continue;
            var rr = .214 + rand() * .012;
            add(hg, sph(.036 + rand() * .018, 10, 8), hm, rr * Math.sin(th) * Math.sin(ph), .16 + rr * Math.cos(th), rr * Math.sin(th) * Math.cos(ph), 'keriting');
          }
        }
        return;
      }
      /* ---- rambut wanita: menutup sisi kepala, volume di ubun-ubun, poni ---- */
      add(hg, shellWin('rpW', .218, { wx: .148, hy: .21, cy: -.04 }, -.1, -.17), hm, 0, .16, 0, 'rambut');
      if (noTop) return;
      massa(hg, hm, 0, .335, -.02, .13, .065, .15, 0, 0, 0, 'volume_atas');
      if (g === 'cepol') {
        poniHalus(hg, hm, 1, .55);
        add(hg, sph(.1, 22, 16), hm, 0, .36, -.14, 'cepol');
        var wrap = add(hg, geo('ikatcepol', function () { return new THREE.TorusGeometry(.085, .015, 8, 24); }), hm, 0, .33, -.12, 'lilitan_cepol'); wrap.rotation.x = 1.0;
        add(hg, cyl(.07, .07, .02, 16), M('#fbbc05', { n: 'ikat_rambut' }), 0, .3, -.1, 'ikat_rambut').rotation.x = 1.0;
        for (var ls = -1; ls <= 1; ls += 2) { var lsG = grp(hg, 'helai_lepas', ls * .165, .2, .1); lsG.rotation.z = ls * .08; add(lsG, taper(.014, .016, .006, .17, .3), hm, 0, 0, 0, 'helai_lepas'); }
      }
      if (g === 'kuncir') {
        poniHalus(hg, hm, -1, .5);
        add(hg, sph(.04, 10, 8), M('#ea4335', { n: 'ikat_rambut' }), 0, .27, -.205, 'ikat_rambut');
        var pony = grp(hg, 'kuncir', 0, .27, -.215); pony.rotation.x = .45;
        add(pony, taper(.058, .066, .018, .36, .3), hm, 0, 0, 0, 'kuncir');
        P.pony = pony;
      }
      if (g === 'bob' || g === 'panjang') {
        var L = g === 'panjang';
        poniHalus(hg, hm, 1, .6);
        add(hg, geo('tirai' + g, function () {
          var pts = L ? [[.2, -.46], [.235, -.38], [.24, -.2], [.236, -.05], [.228, .06], [.222, .12]] : [[.205, -.22], [.232, -.19], [.238, -.12], [.234, -.02], [.226, .06], [.22, .12]];
          return new THREE.LatheGeometry(smooth(pts, 24), 40, .62, TAU - 1.24);
        }), hmD, 0, .16, 0, 'rambut_tirai');
      }
    }

    /* ---------- bentuk berlekuk & kain ---------- */
    var PROF_L = [[.001, -.06], [.13, -.05], [.152, 0], [.155, .06], [.148, .14], [.156, .22], [.172, .31], [.184, .39], [.178, .45], [.158, .5], [.118, .54], [.072, .565], [.001, .575]];
    var PROF_P = [[.001, -.06], [.14, -.05], [.163, 0], [.158, .06], [.128, .15], [.133, .22], [.158, .3], [.166, .35], [.156, .41], [.149, .46], [.136, .5], [.098, .54], [.066, .565], [.001, .575]];
    function smooth(pts, n) { var c = new THREE.SplineCurve(pts.map(function (p) { return new THREE.Vector2(p[0], p[1]); })); return c.getPoints(n || Math.max(10, pts.length * 4)); }
    function bodyGeo(fem) { return geo('badan' + (fem ? 'P' : 'L'), function () { return new THREE.LatheGeometry(smooth(fem ? PROF_P : PROF_L, 44), 30); }); }
    function tube(pts, seg, phiStart, phiLen) { return new THREE.LatheGeometry(smooth(pts), seg || 22, phiStart || 0, phiLen == null ? TAU : phiLen); }
    function taper(rT, rM, rB, L, mid) {
      return geo('tp' + [rT, rM, rB, L, mid].join('_'), function () {
        var pts = [], n = 12, i;
        pts.push(new THREE.Vector2(.001, -L - rB * .7));
        for (i = 3; i >= 1; i--) { var a = i / 4 * Math.PI / 2; pts.push(new THREE.Vector2(rB * Math.cos(a), -L - rB * .7 * Math.sin(a))); }
        for (i = n; i >= 0; i--) {
          var u = i / n, r = u < mid ? rT + (rM - rT) * Math.sin(u / mid * Math.PI / 2) : rM + (rB - rM) * (1 - Math.cos((u - mid) / (1 - mid) * Math.PI / 2));
          pts.push(new THREE.Vector2(r, -u * L));
        }
        for (i = 1; i <= 3; i++) { var b = i / 4 * Math.PI / 2; pts.push(new THREE.Vector2(rT * Math.cos(b), rT * .6 * Math.sin(b))); }
        pts.push(new THREE.Vector2(.001, rT * .6));
        return new THREE.LatheGeometry(pts, 16);
      });
    }
    function profR(prof, y) { for (var i = 1; i < prof.length; i++) if (prof[i][1] >= y) { var a = prof[i - 1], b = prof[i], f = (y - a[1]) / ((b[1] - a[1]) || 1); return a[0] + (b[0] - a[0]) * f; } return prof[prof.length - 1][0]; }
    function applyCloth(c, t, swX, swZ, wind) {
      var a = c.pos.array, b = c.base, span = (c.yTop - c.yBot) || 1;
      for (var i = 0; i < a.length; i += 3) {
        var x = b[i], y = b[i + 1], z = b[i + 2];
        if (y >= c.yTop) continue;
        var f = Math.min(1, (c.yTop - y) / span), r = Math.sqrt(x * x + z * z) || 1e-4, phi = Math.atan2(x, z);
        var fold = c.amp * f * (.7 * Math.sin(c.k * phi + c.ph) + .3 * Math.sin((c.k + 3) * phi - c.ph * 1.7 + t * wind * 1.3) + .35 * Math.sin(c.k * .5 * phi + t * wind));
        var sc = (r + fold) / r, f2 = f * f;
        a[i] = x * sc + swX * f2; a[i + 1] = y + (Math.abs(swX) + Math.abs(swZ)) * f2 * .15; a[i + 2] = z * sc + swZ * f2;
      }
      c.pos.needsUpdate = true; c.g.computeVertexNormals();
    }

    /* ---------- satu orang ---------- */
    function buat(parent, spec) {
      var o = spec, rand = rng(o.id || 'x');
      var P = { o: o, ph: rand() * 20, bp: 3 + rand() * 2.5, list: list };
      var sit = o.pose === 'duduk', fem = !!o.fem;
      var root = grp(parent, 'orang_' + (o.id || 'x'), o.x || 0, o.y || 0, o.z || 0); root.rotation.y = o.r || 0; root.userData.anim = true;
      P.root = root; P.r0 = o.r || 0; P.sit = sit; P.hy = o.hy != null ? o.hy : (sit ? .52 : .85);
      var skinHex = typeof o.kulit === 'string' ? o.kulit : KULIT[o.kulit || 0];
      var skin = M(skinHex, { r: .55, n: 'kulit' }), skinD = M(shade(skinHex, -.06), { r: .6, n: 'kulit_gelap' });
      var top = o.atasan || { jenis: 'kaos', warna: '#4285f4' }, bot = o.bawahan || { jenis: 'celana', warna: '#2f3542' };
      var acc = o.aks || {};
      var topM = M(top.warna, { r: top.jenis === 'blazer' ? .5 : .75, n: 'atasan' });
      var botM = M(bot.warna, { r: bot.jenis === 'jeans' ? .85 : .7, n: bot.jenis === 'rok' ? 'rok' : 'celana' });
      var white = M('#f7f7f2', { r: .5, n: 'putih' }), dark = M('#23262d', { r: .5, n: 'hitam' }), gold = M('#d4b25a', { r: .35, m: .4, n: 'emas' });

      /* ---------- badan berlekuk + pakaian mengambang ---------- */
      P.cloth = [];
      var j = top.jenis, rok = bot.jenis === 'rok';
      var longSleeve = j === 'kemeja' || j === 'hoodie' || j === 'blazer' || j === 'kardigan' || j === 'tunik';
      var cloth = function (mesh, yTop, yBot, amp, k, kind) {
        var g = mesh.geometry, pos = g.attributes.position;
        var c = { g: g, pos: pos, base: pos.array.slice(), yTop: yTop, yBot: yBot, amp: amp, k: k, kind: kind || 'hem', ph: rand() * 6 };
        applyCloth(c, 0, 0, 0, 0); P.cloth.push(c); return c;
      };
      var topC = M(top.warna, { r: .82, ds: true, n: 'kain_atasan' });
      var botC = M(bot.warna, { r: bot.jenis === 'jeans' ? .9 : .8, ds: true, n: rok ? 'kain_rok' : 'kain_celana' });
      var legM = M(shade(bot.warna, -.1), { r: .8, n: 'kaki_dalam' });
      var innerHex = j === 'blazer' || j === 'kardigan' ? (top.dalam || '#ffffff') : shade(top.warna, -.12);
      var innerM = M(innerHex, { r: .72, n: 'badan_dalam' });
      var SX = fem ? .215 : .235;

      /* panggul & kaki */
      var pel = grp(root, 'panggul', 0, P.hy, 0); P.pel = pel;
      var hipM = add(pel, sph(.165, 24, 16), rok ? botC : botM, 0, -.04, 0, 'pinggul'); hipM.scale.set(fem ? 1.05 : 1, .72, .82);
      if (j === 'kemeja') {
        add(pel, cyl(.166, .166, .035, 24), M('#2b2522', { r: .4, n: 'sabuk' }), 0, .015, 0, 'sabuk');
        add(pel, box(.045, .03, .012), gold, 0, .015, .166, 'gesper');
      }
      P.H = []; P.K = [];
      for (var si = 0; si < 2; si++) {
        var s = si ? 1 : -1;
        var hip = grp(pel, 'paha_sendi', s * .095, -.02, 0);
        add(hip, taper(fem ? .092 : .095, .084, .062, .36, .3), legM, 0, 0, 0, 'paha');
        var wide = rok ? .03 : 0;
        if (!rok || sit) add(hip, tube([[.1 + wide, -.37], [.102 + wide, -.26], [.103 + wide, -.12], [.098 + wide, -.03], [.088 + wide, .02]], 20), botC, 0, 0, 0, rok ? 'rok_paha' : 'celana_paha');
        var knee = grp(hip, 'lutut', 0, -.36, 0);
        add(knee, sph(.064, 12, 10), legM, 0, 0, 0, 'lutut');
        if (!rok || sit) add(knee, sph(.097 + wide * .6, 16, 12), botC, 0, 0, 0, 'lutut_kain');
        add(knee, taper(.063, .07, .044, .38, .32), legM, 0, 0, 0, 'betis');
        if (!rok || sit) {
          var shin = add(knee, tube([[.095 + wide, -.365], [.09 + wide, -.26], [.087 + wide, -.13], [.09 + wide, -.02], [.095 + wide, .03]], 20), botC, 0, 0, 0, rok ? 'rok_betis' : 'celana_betis');
          cloth(shin, -.26, -.365, .007, 5, 'celana');
        }
        var ankle = grp(knee, 'pergelangan_kaki', 0, -.38, 0);
        if (bot.jenis === 'jeans') add(ankle, cyl(.098, .098, .04, 20), M(shade(bot.warna, .14), { r: .85, n: 'lipatan_jeans' }), 0, .035, 0, 'lipatan_jeans');
        sepatu(ankle, o.sepatu || {});
        P.H.push(hip); P.K.push(knee);
      }
      if (rok) {
        if (sit) {
          add(pel, tube([[.2, -.12], [.186, -.05], [.169, .01], [.163, .05]], 26), botC, 0, 0, 0, 'rok_pinggang');
          add(pel, box(.36, .08, .42), botC, 0, -.03, .18, 'rok_pangkuan');
          var drape = add(pel, new THREE.CylinderGeometry(.22, .245, .42, 18, 8, true, -.95, 1.9), botC, 0, -.24, .2, 'rok_jatuh');
          cloth(drape, 0, -.21, .012, 9, 'rok');
        } else {
          var skirt = add(pel, tube([[.3, -.8], [.268, -.56], [.226, -.32], [.19, -.12], [.171, -.02], [.163, .05]], 32), botC, 0, 0, 0, 'rok_panjang');
          skirt.scale.z = .78; cloth(skirt, -.18, -.8, .022, 7, 'rok');
        }
      }

      /* badan & atasan */
      var sp = grp(pel, 'tulang_belakang', 0, .03, 0); P.sp = sp;
      var chest = grp(sp, 'dada', 0, 0, 0); P.tor = chest;
      var prof = fem ? PROF_P : PROF_L;
      add(chest, bodyGeo(fem), innerM, 0, 0, 0, 'badan').scale.z = .74;
      var loose = j === 'hoodie' ? .036 : (j === 'blazer' || j === 'kardigan') ? .03 : j === 'tunik' ? .026 : .022;
      var hemY = j === 'kemeja' ? null : j === 'tunik' ? (sit ? -.15 : -.44) : j === 'hoodie' ? -.13 : j === 'blazer' ? -.14 : j === 'kardigan' ? -.13 : -.1;
      var flare = j === 'tunik' ? (sit ? .08 : .135) : j === 'blazer' ? .04 : j === 'hoodie' ? .02 : .035;
      var openFront = j === 'blazer' || j === 'kardigan';
      var sh = [];
      if (hemY == null) sh.push([.162, -.03], [.176, .025], [.176, .08]);
      else { var r0 = profR(prof, 0) + loose; for (var hi = 0; hi <= 4; hi++) sh.push([r0 + flare * Math.pow(1 - hi / 4, 1.4), hemY * (1 - hi / 4)]); }
      prof.forEach(function (pt) { if (pt[1] > (hemY == null ? .12 : .02) && pt[1] <= .545) sh.push([pt[0] + loose * (pt[1] > .5 ? .55 : 1), pt[1]]); });
      sh.push([.09 + loose * .4, .56]);
      var shell = add(chest, tube(sh, 32, openFront ? .4 : 0, openFront ? TAU - .8 : TAU), topC, 0, 0, 0, 'baju');
      shell.scale.z = .74;
      if (hemY != null) cloth(shell, .04, hemY, j === 'tunik' ? .02 : .009, j === 'tunik' ? 7 : 6, j === 'tunik' ? 'rok' : 'baju');
      var zF = function (y, extra) { return (profR(prof, y) + loose) * .74 + (extra || .004); };
      if (j === 'kaos' && top.print) { var pr = add(chest, cyl(.058, .058, .012, 22), M(top.print, { n: 'sablon' }), 0, .35, zF(.35), 'sablon'); pr.rotation.x = Math.PI / 2 - .12;
        add(chest, box(.06, .012, .014), M(top.warna, { n: 'atasan' }), 0, .35, zF(.35, .012), 'sablon_garis'); }
      if (j === 'kemeja' || j === 'polo') {
        for (var c = -1; c <= 1; c += 2) { var col = add(chest, box(.1, .045, .02), topM, c * .056, .54, .1, 'kerah'); col.rotation.set(-.35, 0, c * .55); }
        add(chest, box(.024, j === 'polo' ? .12 : .4, .008), M(shade(top.warna, -.08), { n: 'plaket' }), 0, j === 'polo' ? .45 : .28, zF(.38), 'plaket');
        for (var bI = 0; bI < (j === 'polo' ? 2 : 5); bI++) add(chest, sph(.009, 6, 6), white, 0, .48 - bI * .08, zF(.48 - bI * .08, .01), 'kancing');
        if (j === 'kemeja') add(chest, box(.07, .065, .006), M(shade(top.warna, -.05), { n: 'saku' }), .078, .39, zF(.39), 'saku');
      }
      if (j === 'hoodie') {
        var hood = add(chest, new THREE.SphereGeometry(.17, 20, 12, Math.PI * .5, Math.PI, 0, Math.PI * .62), topC, 0, .5, -.1, 'tudung');
        hood.scale.set(1.1, .8, 1); hood.rotation.x = -.35;
        add(chest, box(.27, .11, .025), M(shade(top.warna, -.06), { n: 'saku_hoodie' }), 0, .12, zF(.12), 'saku_hoodie');
        for (var d = -1; d <= 1; d += 2) add(chest, cyl(.006, .006, .15, 6), white, d * .045, .42, zF(.42, .012), 'tali_hoodie');
        var rib = add(chest, tube([[r0 + flare + .004, hemY - .004], [r0 + flare + .006, hemY + .035]], 30), M(shade(top.warna, -.08), { r: .9, ds: true, n: 'rib_hoodie' }), 0, 0, 0, 'rib_hoodie'); rib.scale.z = .74;
      }
      if (j === 'blazer') {
        for (var l = -1; l <= 1; l += 2) { var lap = add(chest, box(.034, .22, .012), M(shade(top.warna, .05), { n: 'kerah_jas' }), l * .078, .42, .15, 'kerah_jas'); lap.rotation.set(-.12, -l * .4, l * .3); }
        if (top.dasi) { add(chest, box(.045, .24, .012), M(top.dasi, { n: 'dasi' }), 0, .36, zF(.36, -.012), 'dasi'); add(chest, box(.05, .04, .02), M(top.dasi, { n: 'dasi' }), 0, .5, zF(.5, -.02), 'simpul_dasi'); }
        for (var kj = -1; kj <= 1; kj += 2) add(chest, sph(.012, 6, 6), dark, kj * .07, .18, zF(.18, .002), 'kancing_jas');
        for (var pk = -1; pk <= 1; pk += 2) { var fl = add(chest, box(.11, .02, .03), topM, pk * .12, .1, zF(.1, -.004), 'tutup_saku_jas'); fl.rotation.y = -pk * .5; }
      }
      if (j === 'kardigan') for (var kb = 0; kb < 4; kb++) add(chest, sph(.011, 6, 6), M('#6b4a33', { n: 'kancing_kayu' }), .075, .43 - kb * .09, zF(.43 - kb * .09, -.004), 'kancing');
      add(sp, cyl(.056, .066, .1, 16), skin, 0, .57, 0, 'leher');

      /* lengan: otot meruncing + lengan baju longgar */
      P.S = []; P.E = []; P.W = [];
      for (var ai = 0; ai < 2; ai++) {
        var sgn = ai ? 1 : -1;
        var S = grp(sp, 'bahu', sgn * SX, .46, 0);
        add(S, sph(.07, 14, 10), longSleeve ? innerM : skin, 0, 0, 0, 'bahu');
        add(S, taper(.068, .06, .048, .27, .25), skin, 0, 0, 0, 'lengan_atas');
        var gul = !!top.gulung;
        var upEnd = longSleeve ? (gul ? -.31 : -.285) : -.16;
        var sl = add(S, tube(longSleeve ? [[.08, upEnd], [.083, -.18], [.085, -.06], [.078, .02], [.048, .075]] : [[.088, -.16], [.085, -.1], [.082, -.03], [.074, .03], [.048, .075]], 20), topC, 0, 0, 0, 'lengan_baju');
        if (!longSleeve) cloth(sl, -.09, -.16, .007, 5, 'lengan');
        var E = grp(S, 'siku', 0, -.27, 0);
        add(E, sph(.05, 12, 10), skin, 0, 0, 0, 'siku');
        add(E, taper(.05, .053, .037, .23, .25), skin, 0, 0, 0, 'lengan_bawah');
        if (longSleeve && !gul) {
          add(E, sph(.08, 14, 10), topC, 0, 0, 0, 'siku_baju');
          var fs = add(E, tube([[.071, -.2], [.075, -.12], [.078, -.03], [.08, .03]], 20), topC, 0, 0, 0, 'lengan_baju_bawah');
          cloth(fs, -.1, -.2, .005, 6, 'lengan');
          add(E, cyl(.068, .066, .03, 18), j === 'blazer' ? M(top.dalam || '#ffffff', { n: 'manset' }) : M(shade(top.warna, -.08), { n: 'manset' }), 0, -.215, 0, 'manset');
        }
        if (gul) add(E, cyl(.078, .074, .06, 18), topC, 0, -.01, 0, 'lipatan_lengan');
        var W = grp(E, 'pergelangan', 0, -.23, 0);
        var palm = add(W, sph(.048, 14, 10), skin, 0, -.045, 0, 'telapak'); palm.scale.set(.62, 1.05, 1);
        [-.026, -.009, .009, .026].forEach(function (fz, fi) {
          var fg = grp(W, 'jari', 0, -.083, fz); fg.rotation.z = -sgn * .35;
          add(fg, cap(.0115, [.02, .026, .026, .018][fi]), skin, 0, -.022, 0, 'jari');
        });
        var th = grp(W, 'jempol', -sgn * .02, -.03, .04); th.rotation.set(-.5, 0, -sgn * .5);
        add(th, cap(.013, .024), skin, 0, -.02, 0, 'jempol');
        if (ai === 0 && acc.jam) {
          add(W, cyl(.055, .055, .03, 16), M(acc.jam, { r: .4, m: .3, n: 'jam_tangan' }), 0, .01, 0, 'jam_tangan');
          var face = add(W, cyl(.022, .022, .012, 14), M('#e8eef2', { r: .25, m: .3, n: 'muka_jam' }), -.056, .01, 0, 'muka_jam'); face.rotation.z = Math.PI / 2;
        }
        P.S.push(S); P.E.push(E); P.W.push(W);
      }
      /* barang di tangan kanan */
      var Wr = P.W[1];
      if (acc.pegang === 'kopi') {
        var cup = grp(Wr, 'gelas_kopi', 0, -.085, .055);
        add(cup, cyl(.037, .03, .11, 16), white, 0, 0, 0, 'gelas_kopi');
        add(cup, cyl(.038, .034, .035, 16), M('#34a853', { n: 'sarung_gelas' }), 0, -.005, 0, 'sarung_gelas');
        add(cup, cyl(.04, .04, .014, 16), dark, 0, .06, 0, 'tutup_gelas');
      }
      if (acc.pegang === 'hp') {
        var hp = add(Wr, box(.052, .1, .01), dark, 0, -.085, .045, 'ponsel'); hp.rotation.x = -.2;
        add(hp, box(.046, .088, .002), M('#3a6df0', { e: '#3a6df0', ei: .7, n: 'layar_ponsel' }), 0, 0, .006, 'layar_ponsel');
      }
      if (acc.lanyard) {
        var lm = M(acc.lanyard, { n: 'tali_id' });
        for (var ly = -1; ly <= 1; ly += 2) { var st = add(sp, box(.016, .27, .008), lm, ly * .045, .42, .168, 'tali_id'); st.rotation.set(-.12, 0, -ly * .28); }
        add(sp, box(.075, .105, .012), white, 0, .27, .178, 'kartu_id');
        add(sp, box(.075, .025, .013), lm, 0, .31, .179, 'kartu_id_warna');
      }
      if (acc.ransel) {
        var bm = M(acc.ransel, { r: .7, n: 'ransel' });
        add(sp, box(.3, .36, .14), bm, 0, .3, -.2, 'ransel'); add(sp, box(.22, .13, .04), M(shade(acc.ransel, .08), { n: 'saku_ransel' }), 0, .2, -.285, 'saku_ransel');
        for (var rs = -1; rs <= 1; rs += 2) { add(sp, box(.045, .28, .015), bm, rs * .1, .35, .158, 'tali_ransel'); add(sp, box(.045, .02, .3), bm, rs * .1, .528, -.02, 'tali_bahu'); }
      }
      if (acc.headphone === 'leher') {
        var hpm = M(acc.warnaHeadphone || '#222222', { r: .4, n: 'headphone' });
        var nb = add(sp, geo('hpneck', function () { return new THREE.TorusGeometry(.15, .016, 8, 20, Math.PI); }), hpm, 0, .6, 0, 'headphone'); nb.rotation.x = Math.PI / 2;
        for (var hn = -1; hn <= 1; hn += 2) { var cu = add(sp, cyl(.06, .06, .05, 18), hpm, hn * .15, .58, .03, 'bantalan_headphone'); cu.rotation.z = Math.PI / 2; }
      }

      /* kepala */
      var hg = grp(sp, 'kepala_sendi', 0, .6, 0); P.hg = hg;
      var head = add(hg, sph(.2, 32, 24), skin, 0, .16, 0, 'kepala'); head.scale.set(.98, 1.04, .97);
      var jaw = add(hg, sph(.145, 24, 16), skin, 0, .095, .028, 'rahang'); jaw.scale.set(1, .82, 1);
      if (!o.hijab && !(fem && o.rambut)) for (var e = -1; e <= 1; e += 2) { var ear = add(hg, sph(.042, 10, 8), skin, e * .197, .15, 0, 'telinga'); ear.scale.set(.45, 1, .75); }
      P.eyes = [];
      var eyeM = M('#1a1a1a', { r: .25, n: 'mata' }), hiM = M('#ffffff', { e: '#ffffff', ei: .6, n: 'kilau_mata' });
      for (var ey = -1; ey <= 1; ey += 2) {
        var eg = grp(hg, 'mata', ey * .072, .175, .182);
        var eb = add(eg, sph(.028, 12, 10), eyeM, 0, 0, 0, 'mata'); eb.scale.set(1, 1.2, .55);
        add(eg, sph(.009, 6, 6), hiM, .009, .014, .013, 'kilau_mata');
        P.eyes.push(eg);
        var brow = add(hg, box(.065, .015, .02), M((o.rambut && o.rambut.warna) || '#2a2522', { n: 'alis' }), ey * .076, .237, .176, 'alis');
        brow.rotation.set(-.25, ey * -.12, ey * -.1);
      }
      var nose = add(hg, sph(.024, 10, 8), skinD, 0, .135, .197, 'hidung'); nose.scale.set(1, .9, .8);
      /* bibir: atas tipis, bawah lebih penuh, warna dari kulit */
      var lipC = new THREE.Color(skinHex).lerp(new THREE.Color(fem ? '#c0505a' : '#a8534a'), fem ? .55 : .42), lipHex = '#' + lipC.getHexString();
      var lipM = M(lipHex, { r: .4, n: 'bibir' }), lineM = M(shade(lipHex, -.28), { r: .5, n: 'garis_bibir' });
      var mouth = grp(hg, 'mulut', 0, .082, .181); mouth.rotation.x = -.28; P.mouth = mouth;
      var up = add(mouth, sph(.02, 18, 10), lipM, 0, .008, 0, 'bibir_atas'); up.scale.set(1.75, .42, .55);
      var peak = add(mouth, sph(.008, 8, 6), lipM, 0, .012, .004, 'busur_bibir'); peak.scale.set(1.6, .7, .8);
      var lo = add(mouth, sph(.021, 18, 10), lipM, 0, -.009, -.002, 'bibir_bawah'); lo.scale.set(1.5, .56, .62); P.lipLow = lo;
      var ln = add(mouth, geo('garismulut', function () { return new THREE.TorusGeometry(.033, .0032, 6, 22, Math.PI * .92); }), lineM, 0, .004, .007, 'garis_mulut');
      ln.rotation.z = Math.PI * 1.04; ln.scale.y = .3; P.mouthLine = ln;

      if (o.hijab) {
        /* kerudung: membingkai wajah oval, membungkus dagu, jatuh menutup bahu & dada */
        var hm = M(o.hijab, { r: .78, ds: true, n: 'hijab' });
        var hh = add(hg, shellWin('hijabK', .227, { wx: .146, hy: .186, cy: -.012 }), hm, 0, .16, 0, 'hijab'); hh.scale.set(1, 1.06, 1.02);
        var vol = add(hg, sph(.13, 20, 14), hm, 0, .2, -.12, 'volume_hijab'); vol.scale.set(1, .9, .9);
        add(hg, shellWin('ciputK', .221, { wx: .138, hy: .176, cy: -.024 }), M(shade(o.hijab, -.14), { r: .85, ds: true, n: 'ciput' }), 0, .16, 0, 'ciput');
        var hjd = add(sp, tube([[.272, .2], [.28, .3], [.285, .4], [.262, .455], [.21, .5], [.155, .54], [.11, .585]], 36), hm, 0, 0, 0, 'hijab_bawah');
        (function (g) { var p = g.attributes.position; for (var vi = 0; vi < p.count; vi++) { var vy = p.getY(vi); if (vy < .36) { var f = Math.min(1, (.36 - vy) / .13), an = Math.atan2(p.getX(vi), p.getZ(vi)); p.setY(vi, vy - .15 * Math.pow(Math.max(0, Math.cos(an)), 2) * f + .04 * Math.pow(Math.max(0, -Math.cos(an)), 2) * f); } } g.computeVertexNormals(); })(hjd.geometry);
        hjd.scale.z = .6; cloth(hjd, .38, .05, .012, 10, 'hijab');
        add(hg, sph(.012, 8, 6), gold, .1, .0, .15, 'bros_hijab');
      } else rambut(P, hg, o.rambut || {}, rand, fem, !!acc.topi);

      if (acc.jenggot) add(hg, geo('jenggot', function () { return new THREE.SphereGeometry(.207, 24, 10, 0, Math.PI, 1.72, .95); }), M((o.rambut && o.rambut.warna) || '#1d1916', { r: .8, ds: true, n: 'jenggot' }), 0, .16, 0, 'jenggot');
      if (acc.kumis || acc.jenggot) { var mu = add(hg, box(.085, .02, .022), M((o.rambut && o.rambut.warna) || '#1d1916', { r: .8, n: 'kumis' }), 0, .107, .19, 'kumis'); mu.rotation.x = -.3; }
      if (acc.kacamata) {
        var gm = M(acc.warnaKacamata || '#1f1f1f', { r: .3, n: 'kacamata' });
        var sq = acc.kacamata === 'kotak';
        for (var gx = -1; gx <= 1; gx += 2) {
          var rim = add(hg, geo(sq ? 'kacaK' : 'kacaB', function () { return sq ? new THREE.TorusGeometry(.05, .007, 6, 4) : new THREE.TorusGeometry(.043, .007, 8, 24); }), gm, gx * .073, .175, .2, 'bingkai_kacamata');
          if (sq) rim.rotation.z = Math.PI / 4;
          add(hg, box(.008, .01, .19), gm, gx * .122, .18, .1, 'gagang_kacamata');
        }
        add(hg, box(.045, .008, .01), gm, 0, .182, .205, 'jembatan_kacamata');
      }
      if (acc.headphone === 'kepala') {
        var hk = M(acc.warnaHeadphone || '#222222', { r: .4, n: 'headphone' });
        add(hg, geo('hphead', function () { return new THREE.TorusGeometry(.228, .016, 8, 28, Math.PI); }), hk, 0, .16, 0, 'headphone');
        for (var hc = -1; hc <= 1; hc += 2) { var cc = add(hg, cyl(.066, .066, .06, 18), hk, hc * .215, .15, 0, 'bantalan_headphone'); cc.rotation.z = Math.PI / 2;
          var ring = add(hg, cyl(.05, .05, .062, 16), dark, hc * .218, .15, 0, 'busa_headphone'); ring.rotation.z = Math.PI / 2; }
      }
      if (acc.topi) {
        var tm = M(acc.topi.warna || '#1d2433', { r: .75, n: 'topi' });
        if (acc.topi.jenis === 'beanie') {
          var bn = add(hg, geo('beanie', function () { return new THREE.SphereGeometry(.228, 24, 12, 0, TAU, 0, 1.3); }), tm, 0, .16, 0, 'kupluk'); bn.rotation.x = -.2;
          var fold = add(hg, geo('lipatkupluk', function () { return new THREE.TorusGeometry(.2, .035, 8, 26); }), tm, 0, .235, -.02, 'lipatan_kupluk'); fold.rotation.x = Math.PI / 2 - .2;
          add(hg, sph(.055, 10, 8), M('#f4f4f0', { r: .9, n: 'pompom' }), 0, .395, -.03, 'pompom');
        } else {
          var dome = add(hg, geo('capdome', function () { return new THREE.SphereGeometry(.224, 24, 12, 0, TAU, 0, 1.25); }), tm, 0, .16, 0, 'topi'); dome.rotation.x = -.15;
          var bz = acc.topi.balik ? -1 : 1;
          var brim = add(hg, box(.2, .018, .17), tm, 0, .3, bz * .2, 'lidah_topi'); brim.rotation.x = bz * .15;
          add(hg, sph(.018, 6, 6), tm, 0, .385, 0, 'kancing_topi');
        }
      }
      if (acc.anting && !o.hijab) for (var an = -1; an <= 1; an += 2) add(hg, sph(.018, 8, 6), gold, an * .2, .1, .0, 'anting');

      /* posisi awal & jalur */
      if (o.path) { P.path = o.path; P.ws = { i: 0, d: 0, wait: o.path[0].diam || 0, act: o.path[0].aksi || 'berdiri', face: o.path[0].hadap }; P.wph = 0; root.position.set(o.path[0].x, root.position.y, o.path[0].z); }
      list.push(P);
      if (o.bawa) aturBawa(P, o.bawa, o.asap);
      pose(P, 0, 0);
      return P;
    }

    /* ---------- animasi ---------- */
    function sm(x) { return x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x); }
    function pulse(t, period, start, dur, ease) { var p = ((t % period) + period) % period; return sm((p - start) / ease) * (1 - sm((p - start - dur) / ease)); }
    function arm(P, i, sx, out, ex, ez, wx) { var s = i ? 1 : -1; P.S[i].rotation.set(sx, 0, s * out); P.E[i].rotation.set(ex, 0, s * (ez || 0)); P.W[i].rotation.set(wx || 0, 0, 0); }
    function angDiff(a, b) { var d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; }
    /* Object3D.attach() menguraikan ulang matriks → Euler XYZ. Untuk hadap |yaw| > π/2 hasilnya (π, π − yaw, π), sehingga
       rotation.y tidak lagi sama dengan arah hadap (menambah rotation.y justru memutar ke arah sebaliknya: jalan mundur,
       duduk membelakangi meja). Grup lantai tidak berotasi, jadi arah hadap diambil dari sumbu +z lalu disimpan sebagai yaw murni. */
    function hanyaYaw(o) {
      var q = o.quaternion, fx = 2 * (q.x * q.z + q.w * q.y), fz = 1 - 2 * (q.x * q.x + q.y * q.y);
      o.rotation.set(0, Math.atan2(fx, fz), 0);
    }
    /* belok menuju arah langkah: cepat (min 5 rad/dtk), lalu faktor laju 0..1 — sudut > 45° = berbelok di tempat dulu */
    function belok(P, dA, dt) {
      var st = dA * Math.min(1, dt * 10), mn = Math.min(Math.abs(dA), 5 * dt);
      if (Math.abs(st) < mn) st = dA < 0 ? -mn : mn;
      P.root.rotation.y += st;
      var c = Math.cos(dA - st);
      return c <= .7071 ? 0 : Math.min(1, (c - .7071) / .2929);
    }
    /* barang di tangan kanan yang bisa dipasang/dilepas saat live: 'kopi' | 'rokok' | null */
    var asapM = null;
    function aturBawa(P, jenis, asap) {
      var Wr = P.W[1];
      if (jenis === 'kopi' && !P.propKopi) {
        var cup = P.propKopi = grp(Wr, 'gelas_kopi_bawa', 0, -.085, .055);
        add(cup, cyl(.037, .03, .11, 16), M('#f7f7f2', { r: .5, n: 'putih' }), 0, 0, 0, 'gelas_kopi');
        add(cup, cyl(.038, .034, .035, 16), M('#34a853', { n: 'sarung_gelas' }), 0, -.005, 0, 'sarung_gelas');
        add(cup, cyl(.04, .04, .014, 16), M('#23262d', { r: .5, n: 'hitam' }), 0, .06, 0, 'tutup_gelas');
      }
      if (jenis === 'rokok' && !P.propRokok) {
        var rk = P.propRokok = grp(Wr, 'rokok', .004, -.1, .035); rk.rotation.x = Math.PI / 2;
        var bt = add(rk, cyl(.0065, .0065, .06, 8), M('#f2efe8', { r: .8, n: 'batang_rokok' }), 0, -.012, 0, 'batang_rokok'); bt.castShadow = false;
        var fl = add(rk, cyl(.0068, .0068, .022, 8), M('#c8864a', { r: .8, n: 'filter_rokok' }), 0, .025, 0, 'filter_rokok'); fl.castShadow = false;
        var br = add(rk, sph(.007, 6, 4), M('#ff5a1f', { e: '#ff5a1f', ei: 1.3, n: 'bara_rokok' }), 0, -.043, 0, 'bara_rokok'); br.castShadow = false;
      }
      if (jenis === 'rokok' && asap && !P.asapG) {
        if (!asapM) { asapM = new THREE.MeshBasicMaterial({ color: '#e9edf2', transparent: true, opacity: .32, depthWrite: false }); asapM.name = 'asap_rokok'; }
        var ag = P.asapG = grp(P.hg, 'asap', 0, .08, .22); P.asapP = [];
        for (var ai = 0; ai < 3; ai++) { var pf = new THREE.Mesh(sph(.03, 6, 4), asapM); pf.name = 'kepulan_asap'; pf.visible = false; ag.add(pf); P.asapP.push(pf); }
      }
      if (P.propKopi) P.propKopi.visible = jenis === 'kopi';
      if (P.propRokok) P.propRokok.visible = jenis === 'rokok';
      P.asap = jenis === 'rokok' && !!asap;
      if (P.asapG) P.asapG.visible = P.asap;
      P.o.bawa = jenis || null;
    }

    function pose(P, t, dt) {
      var o = P.o, tt = t + P.ph, H = P.H, K = P.K, act = o.aksi || 'berdiri', hx = 0, hy = 0, hz = 0, talk = 0;
      var br = Math.sin(tt * 1.7);
      P.tor.scale.set(1 + .008 * br, 1 + .01 * br, 1 + .016 * br);
      P.S[0].position.y = P.S[1].position.y = .46 + .004 * br;
      var bl = (tt % P.bp) < .12 ? .12 : 1; P.eyes[0].scale.y = P.eyes[1].scale.y = bl;
      P.pel.position.set(0, P.hy, 0); P.pel.rotation.set(0, 0, 0); P.sp.rotation.set(0, 0, 0);
      P.root.rotation.y = P.root.rotation.y;
      var walking = false, ph = 0;

      /* rute dari luar (mode live): P.route = [{x, z, y, induk}] */
      if (P.route && P.route.length) {
        var tg = P.route[0];
        if (tg.induk && P.root.parent !== tg.induk) { tg.induk.attach(P.root); hanyaYaw(P.root); }
        var rdx = tg.x - P.root.position.x, rdz = tg.z - P.root.position.z, rd = Math.hypot(rdx, rdz), rv = P.routeV || 1.3, rs = rv * dt, ry = tg.y || 0;
        if (rd <= rs) {
          P.root.position.set(tg.x, ry, tg.z); P.route.shift();
          if (!P.route.length) { P.route = null; var rcb = P.routeCb; P.routeCb = null; if (rcb) rcb(P); }
          /* masih ada titik berikutnya: frame ini tetap "jalan" (tanpa ini aksi diam, mis. 'telepon', sempat memutar badan ke arah kursi) */
          else { walking = true; P.wph += dt * rv * 4.5; ph = P.wph; act = 'jalan'; }
        } else {
          /* hadap dulu ke arah langkah (belok di tempat bila sudut besar), baru melangkah */
          var rkf = belok(P, angDiff(Math.atan2(rdx, rdz), P.root.rotation.y), dt), rf = rs * rkf / rd;
          P.root.position.x += rdx * rf; P.root.position.z += rdz * rf; P.root.position.y += (ry - P.root.position.y) * Math.min(1, rf * 1.2);
          walking = true; P.wph += dt * rv * 4.5 * Math.max(rkf, .45); ph = P.wph; act = 'jalan';
        }
      }
      /* pejalan kaki */
      if (P.path && !P.route) {
        var st = P.ws, n = P.path.length;
        if (st.wait > 0) {
          st.wait -= dt; act = st.act || 'berdiri';
          if (st.face != null) P.root.rotation.y += angDiff(st.face, P.root.rotation.y) * Math.min(1, dt * 4);
        } else {
          var a = P.path[st.i], b = P.path[(st.i + 1) % n], dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz) || .001, v = o.laju || .7;
          var pk = belok(P, angDiff(Math.atan2(dx, dz), P.root.rotation.y), dt);
          st.d += v * dt * pk;
          if (st.d >= L) {
            st.i = (st.i + 1) % n; st.d = 0; var pnt = P.path[st.i];
            P.root.position.x = pnt.x; P.root.position.z = pnt.z;
            if (pnt.diam) { st.wait = pnt.diam; st.act = pnt.aksi || 'berdiri'; st.face = pnt.hadap; }
          } else {
            P.root.position.x = a.x + dx * st.d / L; P.root.position.z = a.z + dz * st.d / L;
            walking = true; P.wph += dt * v * 4.5 * Math.max(pk, .45); ph = P.wph; act = 'jalan';
          }
        }
      }

      /* kaki */
      if (P.sit) {
        var lean = act === 'santai';
        H[0].rotation.set(lean ? -1.3 : -1.57, 0, -.05); H[1].rotation.set(lean ? -1.3 : -1.57, 0, .05);
        K[0].rotation.x = lean ? 1.4 : 1.57; K[1].rotation.x = lean ? 1.4 : 1.57;
        if (!lean) { K[0].rotation.x += .06 * Math.sin(tt * .5); }
      } else if (walking) {
        var sw = Math.sin(ph);
        H[0].rotation.set(.42 * sw, 0, -.02); H[1].rotation.set(-.42 * sw, 0, .02);
        K[0].rotation.x = .08 + .85 * Math.pow(Math.max(0, -Math.cos(ph)), 1.3);
        K[1].rotation.x = .08 + .85 * Math.pow(Math.max(0, Math.cos(ph)), 1.3);
        P.pel.position.y = P.hy + .02 * (1 - Math.abs(sw)) - .01;
        P.pel.rotation.y = .08 * sw; P.sp.rotation.set(.05, -.12 * sw, 0);
      } else {
        var w = Math.sin(tt * .45);
        P.pel.position.x = .018 * w; P.pel.rotation.z = .025 * w; P.sp.rotation.z = -.035 * w;
        H[0].rotation.set(-.07 * Math.max(0, -w), 0, -.03 - .025 * w); H[1].rotation.set(-.07 * Math.max(0, w), 0, .03 - .025 * w);
        K[0].rotation.x = .14 * Math.max(0, -w); K[1].rotation.x = .14 * Math.max(0, w);
      }

      /* lengan, kepala, badan per aksi */
      var k;
      switch (act) {
        case 'ketik':
          k = .07 * Math.sin(tt * 13);
          arm(P, 0, -.5, -.16, -1.15 + k, 0, .15); arm(P, 1, -.5, -.16, -1.15 - k, 0, .15);
          hx = .12 + .03 * Math.sin(tt * .6); hy = .1 * Math.sin(tt * .23) + .35 * pulse(tt, 11, 7, 1.4, .35) * (o.lirik || 1);
          P.sp.rotation.x += P.sit ? .06 : .03; break;
        case 'bicara':
          arm(P, 0, -.55, -.12, -1.0);
          arm(P, 1, -.72 + .22 * Math.sin(tt * 1.7), .05 + .12 * Math.sin(tt * 1.1), -1.35 + .35 * Math.sin(tt * 2.3 + 1), 0, .25 * Math.sin(tt * 2.6));
          hy = (o.lihat || 0) + .3 * Math.sin(tt * .45); hx = .02 * Math.sin(tt * 2.2) - .02; P.sp.rotation.z += .03 * Math.sin(tt * .7); talk = 1; break;
        case 'dengar':
          arm(P, 0, -.5, -.12, -1.1); arm(P, 1, -.5, -.12, -1.1);
          if (pulse(tt, 14, 8, 3, .6) > 0) { var cz = pulse(tt, 14, 8, 3, .6); arm(P, 1, -.5 - .55 * cz, -.12 - .1 * cz, -1.1 - 1.2 * cz); }
          hy = (o.lihat || 0) + .12 * Math.sin(tt * .35); hx = .05 + .09 * pulse(tt, 4.5, 1, .5, .2); P.sp.rotation.x += .1; break;
        case 'telepon':
          arm(P, 0, -.5, -.14, -1.1);
          arm(P, 1, -1.05, .32, -2.45, 0, .2);
          hz = -.14; hy = .25 * Math.sin(tt * .3); hx = .02; talk = pulse(tt, 5, 0, 3.2, .3);
          P.root.rotation.y = P.r0 + .14 * Math.sin(tt * .4); break;
        case 'santai':
          P.sp.rotation.x -= .28;
          arm(P, 0, -.72, -.22, -1.3, 0, .1 * Math.sin(tt * 6)); arm(P, 1, -.72, -.22, -1.3, 0, .1 * Math.sin(tt * 6 + 1));
          hx = .38 - .45 * pulse(tt, 9, 5, 1.8, .4); hy = .25 * pulse(tt, 9, 5, 1.8, .4); break;
        case 'minum':
          var sip = pulse(tt, 7, 4, 1.4, .45);
          arm(P, 0, .04 + .02 * Math.sin(tt * .5), .14, -.15);
          arm(P, 1, -.35 - .25 * sip, -.12 - .18 * sip, -1.35 - 1.0 * sip);
          hx = -.2 * sip + .03; hy = .35 * Math.sin(tt * .25) * (1 - sip); break;
        case 'rokok':
          /* berdiri: satu tangan santai di sisi badan, tangan lain memegang rokok, tiap ±9 dtk diisap lalu asap diembuskan */
          var isap = pulse(tt, 9, 3, 1.3, .45);
          arm(P, 0, .04 + .02 * Math.sin(tt * .5), .14, -.18);
          arm(P, 1, -.3 - .32 * isap, .12 - .44 * isap, -1.5 - .9 * isap, 0, .1 * (1 - isap));
          hx = -.14 * isap + .04; hy = .3 * Math.sin(tt * .25) * (1 - isap); talk = .15 * isap; break;
        case 'hp':
          arm(P, 0, -.7, -.2, -1.25); arm(P, 1, -.7, -.2, -1.25, 0, .1 * Math.sin(tt * 5));
          hx = .42 - .45 * pulse(tt, 8, 5, 1.6, .4); hy = .2 * pulse(tt, 8, 5, 1.6, .4); break;
        case 'lambai':
          arm(P, 0, .04, .14, -.15);
          P.S[1].rotation.set(-.2, 0, 2.55 + .06 * Math.sin(tt * 3)); P.E[1].rotation.set(0, 0, .35 + .45 * Math.sin(tt * 8)); P.W[1].rotation.set(0, 0, 0);
          hz = .08; hy = .15 * Math.sin(tt * .5); talk = .4; break;
        case 'pinggang':
          arm(P, 0, .15, .62, -.2, -1.55); arm(P, 1, .15, .62, -.2, -1.55);
          hy = .4 * Math.sin(tt * .28); hx = -.03; break;
        case 'jalan':
          var s2 = Math.sin(ph);
          arm(P, 0, -.38 * s2, .13, -.32 - .12 * Math.max(0, -s2)); arm(P, 1, .38 * s2, .13, -.32 - .12 * Math.max(0, s2));
          hy = .2 * Math.sin(tt * .4); break;
        default:
          arm(P, 0, .03 + .03 * Math.sin(tt * .7), .14, -.16); arm(P, 1, .03 + .03 * Math.sin(tt * .7 + 1), .14, -.16);
          hy = .45 * Math.sin(tt * .3); hx = .03;
      }
      P.hg.rotation.set(hx + .015 * Math.sin(tt * 1.1), hy, hz);
      /* asap: 3 kepulan kecil naik & membesar lalu mengecil, 0,2–2,8 dtk setelah isapan (hanya saat aksi 'rokok' dan asap diizinkan) */
      if (P.asapG) {
        var asapOn = P.asap && act === 'rokok'; P.asapG.visible = asapOn;
        if (asapOn) {
          var ep = ((tt - 4.5) % 9 + 9) % 9 / 2.6;
          for (var pi2 = 0; pi2 < 3; pi2++) {
            var pf = P.asapP[pi2], q = ep - pi2 * .2;
            pf.visible = q > 0 && q < 1;
            if (pf.visible) { pf.position.set(.03 * Math.sin(q * 5 + pi2), .02 + q * .38, .03 + q * .2); pf.scale.setScalar((.5 + 1.8 * q) * (1 - sm((q - .6) / .4))); }
          }
        }
      }
      var op = talk * Math.abs(Math.sin(tt * 9)); P.lipLow.position.y = -.009 - .011 * op; P.mouthLine.scale.y = .3 + 1.1 * op;
      P.clAcc = (P.clAcc || 0) + dt;
      if (P.cloth.length && (P.clAcc > .045 || !P.clInit)) {
        P.clAcc = 0; P.clInit = true;
        var wind = walking ? 3 : 1, swX = walking ? 0 : -.012 * Math.sin(tt * .45), swZ = walking ? -.018 - .012 * Math.cos(ph * 2) : .005 * Math.sin(tt * .8);
        for (var ci = 0; ci < P.cloth.length; ci++) { var cl = P.cloth[ci], rk = cl.kind === 'rok' || cl.kind === 'hijab'; applyCloth(cl, tt, rk ? swX : 0, rk ? swZ : cl.kind === 'baju' ? swZ * .4 : 0, wind); }
      }
      if (P.pony) { P.pony.rotation.x = .45 + (walking ? .12 * Math.sin(ph * 2) : .05 * Math.sin(tt * 2.1)); P.pony.rotation.z = (walking ? .1 : .05) * Math.sin(tt * 1.4); }
    }

    function tick(t, dt) { for (var i = 0; i < list.length; i++) pose(list[i], t, dt); }

    /* ---------- kendali untuk mode live ----------
       jalanKe(P, titik, selesai, laju): titik = [{x, z, y?, induk?}] (koordinat lokal grup lantai "induk")
       atur(P, {pose:'duduk'|'berdiri', aksi, r, hy, lihat}) : ubah pose/aksi/arah hadap */
    function jalanKe(P, pts, cb, v) {
      P.route = (pts || []).slice(); P.routeCb = cb || null; P.routeV = v || 1.3;
      P.sit = false; P.hy = .85; P.o.pose = 'berdiri';
      if (!P.route.length) { P.route = null; if (cb) cb(P); }
    }
    function atur(P, o) {
      o = o || {};
      if (o.pose) { P.o.pose = o.pose; P.sit = o.pose === 'duduk'; P.hy = o.hy != null ? o.hy : (P.sit ? .52 : .85); }
      else if (o.hy != null) P.hy = o.hy;
      if (o.aksi) P.o.aksi = o.aksi;
      if (o.r != null) { P.r0 = o.r; P.root.rotation.set(0, o.r, 0); }
      if (o.lihat != null) P.o.lihat = o.lihat;
      if ('bawa' in o) aturBawa(P, o.bawa, o.asap);
    }
    /* tampilan otomatis untuk orang baru (mis. sub agent yang tidak ada di DAFTAR) */
    function tampilanDari(nama) {
      var r = rng(String(nama || 'x')), pick = function (a) { return a[Math.floor(r() * a.length)]; };
      var fem = r() < .45, hij = fem && r() < .5;
      var warna = ['#4285f4', '#ea4335', '#fbbc05', '#34a853', '#e76f51', '#2a9d8f', '#8e7dbe', '#ef476f', '#118ab2', '#5c946e', '#f4a261', '#3d4652'];
      var o = { id: 'agen_' + String(nama || 'x').replace(/[^a-z0-9]+/gi, '_'), peran: nama, fem: fem, kulit: Math.floor(r() * KULIT.length),
        atasan: { jenis: pick(hij ? ['tunik', 'kardigan', 'blazer'] : ['kaos', 'kemeja', 'polo', 'hoodie', 'kaos']), warna: pick(warna), print: '#ffffff', dalam: '#ffffff', gulung: r() < .3 },
        bawahan: { jenis: hij ? 'rok' : pick(['celana', 'jeans', 'jeans']), warna: pick(['#2f3542', '#34506e', '#3d4a5c', '#4b4038', '#a08a6a']) },
        sepatu: { jenis: hij ? 'flat' : pick(['sneaker', 'sneaker', 'formal']), warna: pick(['#f4f4f0', '#1d2433', '#6b4a33']) },
        aks: {} };
      if (hij) o.hijab = pick(warna); else o.rambut = { gaya: fem ? pick(['cepol', 'kuncir', 'bob']) : pick(['pendek', 'belah', 'undercut', 'keriting']), warna: pick(['#1d1916', '#2a2522', '#4a2f1f', '#7a4e2d']) };
      if (r() < .3) o.aks.kacamata = pick(['bulat', 'kotak']);
      if (r() < .3) o.aks.jam = '#222222';
      if (r() < .25) o.aks.headphone = 'leher';
      return o;
    }

    return { buat: buat, tick: tick, list: list, jalanKe: jalanKe, atur: atur, tampilanDari: tampilanDari, DAFTAR: DAFTAR, cari: function (id) { for (var i = 0; i < DAFTAR.length; i++) if (DAFTAR[i].id === id) return DAFTAR[i]; return null; } };
  }
  PadevOrang.DAFTAR = DAFTAR;
  window.PadevOrang = PadevOrang;
})();
