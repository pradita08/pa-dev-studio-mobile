// Kantor 3D untuk tab Kantor APK PADEV Studio (F2). Disalin ke APK oleh buat-kantor-apk.js (jangan edit salinannya di APK).
// Dimuat di WebView terkunci: tanpa jaringan, tanpa jembatan native. Data masuk SATU ARAH dari native:
//   window.kantorHp.terima('<json>')  json = {tema:'terang'|'gelap', proyek:'Nama', divisi:[{nama, peran, status, ke, ringkas?}]}
//   window.kantorHp.jeda(true|false)  hentikan/lanjutkan render (tab tidak terlihat / aplikasi ke latar)
// Semua teks dari data tampil lewat textContent. Adegan = desain/ (desain/API.md), tabel divisi = peta.js (dari office.html).
'use strict';
(function () {
  const THREE = window.THREE, PETA = window.PETA_KANTOR || {};
  const PETA_DIVISI = PETA.PETA_DIVISI || {}, DIVISI = PETA.DIVISI || {}, PINTU = PETA.PINTU;
  const STATUS = ['bekerja', 'menunggu_izin', 'diam'];
  const TEKS_STATUS = { bekerja: 'Bekerja', menunggu_izin: 'Menunggu izin — setujui di laptop', diam: 'Menunggu tugas' };
  const LAJU = 1.6, MAKS_DIVISI = 10;
  const $ = id => document.getElementById(id);
  const pesan = $('pesan');
  const kosong = { terima() {}, jeda() {} };

  function gagal(teks) { pesan.textContent = teks; pesan.hidden = false; window.kantorHp = kosong; }
  if (!THREE || !window.PadevOrang || !window.PadevKantor) return gagal('Berkas kantor 3D tidak lengkap.');

  /* ---------- renderer, kamera, cahaya (dari desain/preview.html, disesuaikan HP) ---------- */
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' }); }
  catch (e) { return gagal('Perangkat ini tidak mendukung tampilan 3D.'); }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;   // PCFSoft usang di r184
  const stage = $('stage');
  stage.appendChild(renderer.domElement);
  const label2d = new THREE.CSS2DRenderer();
  label2d.domElement.style.position = 'fixed'; label2d.domElement.style.inset = '0'; label2d.domElement.style.pointerEvents = 'none';
  stage.appendChild(label2d.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, .01, 500);
  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = .08; controls.enablePan = false; controls.maxPolarAngle = Math.PI * .47;
  scene.add(new THREE.HemisphereLight(0xffffff, 0xd8d2c4, 1.0));
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(24, 42, 30); key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
  key.shadow.bias = -.0003; key.shadow.normalBias = .035; key.shadow.camera.far = 200; scene.add(key);
  const fill = new THREE.DirectionalLight(0xfff4e6, .5); fill.position.set(-5, 3, -4); scene.add(fill);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.ShadowMaterial({ opacity: .18 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

  const ORANG = window.PadevOrang(THREE);
  const R = window.PadevKantor.build(THREE, ORANG);
  let mode = 'terpisah';
  const targetY = m => (m === 'l2' ? R.Y2 : m === 'l1' ? R.Y2 + 14 : R.Y2 + R.GAP);
  R.lantai2.position.y = targetY(mode);
  scene.add(R.model);
  R.model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(R.model), sphere = box.getBoundingSphere(new THREE.Sphere());
  ground.position.y = box.min.y;
  const baseY = R.model.position.y, geser = new THREE.Vector3(2.2, 0, -1.7);
  const span = sphere.radius * 1.6;
  Object.assign(key.shadow.camera, { left: -span, right: span, top: span, bottom: -span }); key.shadow.camera.updateProjectionMatrix();

  // kamera awal = artboard desain; layar tegak (HP) → mundur agar lebar gedung tetap muat
  function pasKamera() {
    const dist = (sphere.radius / Math.tan(camera.fov * Math.PI / 360)) * .82 * Math.max(1, 1.15 / camera.aspect);
    camera.position.copy(sphere.center).add(new THREE.Vector3(1, .62, 1.25).normalize().multiplyScalar(dist)).add(geser);
    camera.near = Math.max(dist / 100, .01); camera.far = dist * 100; camera.updateProjectionMatrix();
    controls.target.copy(sphere.center).add(geser); controls.minDistance = dist * .25; controls.maxDistance = dist * 1.6; controls.update();
  }
  function langkahLantai(dt) {
    const L2 = R.lantai2, k = 1 - Math.exp(-dt * 5);
    L2.position.y += (targetY(mode) - L2.position.y) * k;
    L2.visible = !(mode === 'l1' && L2.position.y > R.Y2 + 11);
    R.kolom.visible = mode === 'l2' && Math.abs(L2.position.y - R.Y2) < .08;
    const gap = L2.position.y - R.Y2;
    R.hantu.visible = mode === 'terpisah' && gap > .3; R.hantu.scale.y = Math.max(.01, gap); R.hantu.position.y = R.Y2 + gap / 2;
    const ty = baseY + (mode === 'l1' ? .2 : mode === 'l2' ? R.Y2 - .3 : (R.Y2 + R.GAP) * .3), dy = (ty - controls.target.y) * k;
    controls.target.y += dy; camera.position.y += dy;
  }
  const tombolLantai = document.querySelectorAll('.lantai button');
  tombolLantai.forEach(b => {
    b.addEventListener('click', () => {
      mode = b.dataset.m;
      tombolLantai.forEach(x => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
    });
  });

  /* ---------- kursi & karakter ---------- */
  const KURSI = R.kursi.concat((PETA.KURSI_TAMBAHAN || []).map(k => Object.assign({ pemilik: null }, k)));
  const KURSI_BY = {};
  KURSI.forEach(k => { KURSI_BY[k.id] = k; });
  const grupLantai = l => (l === 2 ? R.lantai2 : R.lantai1);
  const peranPendek = p => String(p || '').toLowerCase().replace(/^divisi-/, '');
  const warnaDivisi = p => new THREE.Color((DIVISI[peranPendek(p)] || {}).warna || '#4d96ff');
  // orang3d.js hanya mengisi fase langkah untuk figuran ber-path; tanpa ini kaki/lengan NaN saat jalanKe (sama dengan office.html)
  const siapJalan = P => { if (!Number.isFinite(P.wph)) P.wph = 0; };
  function buangKarakter(P) {
    const i = ORANG.list.indexOf(P); if (i >= 0) ORANG.list.splice(i, 1);
    if (P.root.parent) P.root.parent.remove(P.root);
    const dipakai = new Set();
    for (const Q of ORANG.list) Q.root.traverse(o => { if (o.geometry) dipakai.add(o.geometry); });
    P.root.traverse(o => { if (o.geometry && !dipakai.has(o.geometry)) o.geometry.dispose(); });
  }
  // kursi kosong untuk anggota tanpa slot tetap: workspace & studio lt 1, lalu lt 2 (sederhana dari allocKursi office.html)
  function kursiBebas(peran) {
    const bebas = k => !k.pemilik && !k.dipakaiHp && k.jenis !== 'pimpinan' && k.jenis !== 'lapor';
    const it = /(dev|code|program|engineer|test|qa|security|server|api|fullstack|review)/i.test(peran);
    const lt1 = [k => k.lantai === 1 && k.jenis === 'meja', k => k.lantai === 1 && k.jenis === 'rapat'];
    const lt2 = [k => k.lantai === 2 && k.jenis === 'meja_dev', k => k.lantai === 2 && k.jenis === 'meja_berdiri', k => k.lantai === 2 && k.jenis === 'teras'];
    for (const f of it ? lt2.concat(lt1) : lt1.concat(lt2)) { const k = KURSI.find(x => bebas(x) && f(x)); if (k) return k; }
    return null;
  }
  function layar(k, warna) {   // warna null = kembali ke asal
    if (!k || !k.layar) return;
    if (!k.layarAsal) {
      const m = k.layar.material.clone(); k.layar.material = m;
      k.layarAsal = { m, emisif: !!m.emissive && !m.map, em: m.emissive ? m.emissive.clone() : null, ei: m.emissiveIntensity, col: m.color.clone() };
    }
    const L = k.layarAsal;
    if (warna) { if (L.emisif) { L.m.emissive.copy(warna); L.m.emissiveIntensity = .9; } else L.m.color.copy(warna).lerp(new THREE.Color('#ffffff'), .35); }
    else { if (L.emisif) { L.m.emissive.copy(L.em); L.m.emissiveIntensity = L.ei; } else L.m.color.copy(L.col); }
  }

  /* ---------- label & kartu detail ---------- */
  const kartu = $('kartu');
  let kartuUntuk = null;
  function bukaKartu(a) {
    kartuUntuk = a;
    $('kNama').textContent = a.data.nama;
    $('kPeran').textContent = a.data.peranTampil;
    $('kStatus').textContent = TEKS_STATUS[a.data.status];
    $('kStatus').className = 'status ' + a.data.status;
    $('kRingkas').textContent = a.data.ringkas || '';
    kartu.hidden = false;
  }
  $('tutup').addEventListener('click', () => { kartu.hidden = true; kartuUntuk = null; });
  function buatLabel(a) {
    const el = document.createElement('div');
    const titik = document.createElement('span'); titik.className = 'titik';
    const teks = document.createElement('span');
    el.append(titik, teks);
    el.addEventListener('click', () => bukaKartu(a));
    const obj = new THREE.CSS2DObject(el);
    obj.position.set(0, 1.85, 0);
    a.P.root.add(obj);
    a.label = { obj, el, teks };
  }
  function perbaruiLabel(a) {
    a.label.el.className = 'label ' + a.data.status;
    a.label.teks.textContent = a.data.nama;
    if (kartuUntuk === a) bukaKartu(a);
  }
  function lepasLabel(a) {
    if (!a.label) return;
    a.label.obj.removeFromParent(); a.label.el.remove(); a.label = null;
    if (kartuUntuk === a) { kartu.hidden = true; kartuUntuk = null; }
  }

  /* ---------- aktor: satu per slot divisi (peran#ke) ---------- */
  const aktor = new Map();
  function posisikan(a) {   // pose sesuai status, di kursinya
    const k = a.kursi, d = a.data;
    if (d.status === 'bekerja') { ORANG.atur(a.P, { pose: k.duduk ? 'duduk' : 'berdiri', aksi: 'ketik', r: k.r }); layar(k, warnaDivisi(d.peran)); }
    else if (d.status === 'menunggu_izin') { ORANG.atur(a.P, { pose: 'berdiri', aksi: 'lambai', r: k.r }); layar(k, new THREE.Color('#f0a341')); }
    else {
      layar(k, null);
      if (a.asli) ORANG.atur(a.P, a.asli);
      else ORANG.atur(a.P, { pose: k.duduk ? 'duduk' : 'berdiri', aksi: 'santai', r: k.r });
    }
  }
  function hadirkan(kunci, d) {
    const slot = (PETA_DIVISI[peranPendek(d.peran)] || [])[d.ke - 1] || {};
    const desain = slot.orang && R.orang[slot.orang];
    if (desain && desain.kursi && ![...aktor.values()].some(x => x.P === desain)) {
      const a = { kunci, P: desain, kursi: desain.kursi, data: d, desain: true, berjalan: false,
        asli: { pose: desain.o.pose || (desain.sit ? 'duduk' : 'berdiri'), aksi: desain.o.aksi || 'santai', r: desain.r0 } };
      aktor.set(kunci, a); buatLabel(a); posisikan(a); return a;
    }
    let kursi = slot.kursi && KURSI_BY[slot.kursi];
    if (!kursi || kursi.pemilik || kursi.dipakaiHp) kursi = kursiBebas(d.peran);
    if (!kursi || !PINTU) return null;   // kantor penuh: tetap tampil di daftar APK
    kursi.dipakaiHp = true;
    const P = ORANG.buat(grupLantai(PINTU.lantai), Object.assign(ORANG.tampilanDari(kunci), { x: PINTU.x, z: PINTU.z, r: PINTU.r, pose: 'berdiri', aksi: 'jalan' }));
    siapJalan(P);
    const a = { kunci, P, kursi, data: d, desain: false, berjalan: true };
    aktor.set(kunci, a); buatLabel(a);
    ORANG.jalanKe(P, R.rute(PINTU, kursi), () => { a.berjalan = false; if (aktor.get(kunci) === a) posisikan(a); }, LAJU);
    return a;
  }
  function pulangkan(a) {
    aktor.delete(a.kunci);
    lepasLabel(a);
    layar(a.kursi, null);
    if (a.desain) { ORANG.atur(a.P, a.asli); return; }
    a.berjalan = true;
    const kursi = a.kursi;
    ORANG.jalanKe(a.P, R.rute(kursi, PINTU), () => { kursi.dipakaiHp = false; buangKarakter(a.P); }, LAJU);
  }

  /* ---------- data dari native (tidak dipercaya: divalidasi & dipotong) ---------- */
  const teks = (v, n) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]+/g, ' ').trim().slice(0, n) : '');
  function rapikan(x) {
    if (!x || typeof x !== 'object') return null;
    const peran = teks(x.peran, 80), status = STATUS.includes(x.status) ? x.status : 'diam';
    const ke = Number.isInteger(x.ke) && x.ke >= 1 && x.ke <= 3 ? x.ke : 1;
    if (!peran) return null;
    const pendek = peranPendek(peran), meta = DIVISI[pendek];
    const peranTampil = meta ? meta.nama : pendek;
    return { peran, ke, status, nama: teks(x.nama, 60) || peranTampil, peranTampil, ringkas: teks(x.ringkas, 300) };
  }
  function terima(json) {
    let d;
    try { d = JSON.parse(String(json)); } catch (e) { return; }
    if (!d || typeof d !== 'object') return;
    document.body.classList.toggle('gelap', d.tema === 'gelap');
    const daftar = (Array.isArray(d.divisi) ? d.divisi : []).slice(0, MAKS_DIVISI).map(rapikan).filter(Boolean);
    const baru = new Map();
    for (const x of daftar) { const k = peranPendek(x.peran) + '#' + x.ke; if (!baru.has(k)) baru.set(k, x); }
    for (const a of [...aktor.values()]) if (!baru.has(a.kunci)) pulangkan(a);
    for (const [k, x] of baru) {
      let a = aktor.get(k);
      if (!a) { a = hadirkan(k, x); if (!a) continue; }
      a.data = x; perbaruiLabel(a);
      if (!a.berjalan) posisikan(a);
    }
    const aktif = daftar.filter(x => x.status !== 'diam').length;
    $('judul').textContent = (teks(d.proyek, 60) || 'Kantor') + (aktif ? ' · ' + aktif + ' aktif' : daftar.length ? '' : ' · sepi');
    $('titik').className = 'titik' + (aktif ? ' aktif' : '');
    $('info').hidden = false;
  }

  /* ---------- putaran render ---------- */
  function ukur() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h); label2d.setSize(w, h); camera.aspect = w / Math.max(h, 1); camera.updateProjectionMatrix();
  }
  addEventListener('resize', ukur); ukur(); pasKamera();
  let t = 0, dijeda = false, sebelum = performance.now();
  function bingkai() {
    const kini = performance.now(), dt = Math.min((kini - sebelum) / 1000, .05); sebelum = kini; t += dt;
    R.tick(t, dt); langkahLantai(dt); controls.update();
    renderer.render(scene, camera); label2d.render(scene, camera);
  }
  function jeda(ya) {
    dijeda = !!ya;
    renderer.setAnimationLoop(dijeda || document.hidden ? null : bingkai);
    if (!dijeda) sebelum = performance.now();
  }
  document.addEventListener('visibilitychange', () => jeda(dijeda));
  renderer.domElement.addEventListener('webglcontextlost', e => { e.preventDefault(); gagal('Tampilan 3D berhenti (memori grafis penuh). Buka ulang tab Kantor.'); });
  jeda(false);

  window.kantorHp = Object.freeze({ terima, jeda });
})();
