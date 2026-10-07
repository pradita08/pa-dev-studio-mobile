// Jembatan kantor 3D APK (tab Kantor): halaman = office.html website APA ADANYA (dibangun buat-kantor-apk.js), hanya sumber
// datanya diganti. Di laptop office.html membaca GET /state + EventSource /events dari server.js; di HP keduanya dipalsukan di
// sini dan diisi dari native lewat window.kantorHp.terima(json) (status.kantor dari Mac: kejadian hook TANPA isi — tanpa
// detail/teks/path, sesi di-hash). Tidak ada jaringan: fetch lain dijawab 404 lokal, CSP connect-src 'none'.
// Dimuat SEBELUM skrip modul kantor (skrip biasa, bukan modul).
'use strict';
(function () {
  window.KANTOR_HP = true;

  const KIND = ['session', 'session_end', 'prompt', 'tool', 'tool_done', 'tool_fail', 'agent_start', 'agent_stop', 'stop', 'notify'];
  const LAMA_MS = 3 * 60 * 1000;      // kejadian lebih tua dari ini saat tiba tidak dianimasikan (hanya riwayat awal)
  const TUNGGU_AWAL_MS = 2500;        // /state menunggu data pertama dari native paling lama segini
  const teks = (v, n) => typeof v === 'string' && v.length > 0 && v.length <= n ? v : undefined;

  // satu kejadian dari native → bentuk normalize() server.js (hanya field yang dikenal, tipe & panjang diperiksa)
  function bersih(e) {
    if (!e || typeof e !== 'object' || !KIND.includes(e.kind) || typeof e.ts !== 'number' || !isFinite(e.ts)) return null;
    const o = { ts: e.ts, kind: e.kind, session: teks(e.session, 64) || null, who: teks(e.who, 80) || null, agentId: teks(e.agentId, 64) || null };
    const tool = teks(e.tool, 120); if (tool) o.tool = tool;
    const sub = teks(e.sub, 80); if (sub) o.sub = sub;
    const type = teks(e.type, 40); if (type) o.type = type;
    if (o.kind === 'tool') o.detail = '';
    return o;
  }
  const kunci = e => [e.ts, e.session, e.agentId, e.kind, e.tool].join('|');

  const dilihat = new Set();
  let awal = null;              // riwayat awal untuk /state (null = data pertama belum tiba)
  let stateDijawab = false;
  const penunggu = [];
  const sumber = new Set();     // EventSource palsu yang terbuka
  const antre = [];
  let pemutar = null, tsPutarTerakhir = 0, dijeda = false, tersambung = true;

  function tandai(e) {
    dilihat.add(kunci(e));
    if (dilihat.size > 600) dilihat.delete(dilihat.values().next().value);
  }
  function siarkan(e) {
    const data = JSON.stringify(e);
    for (const s of sumber) if (s.readyState === 1 && typeof s.onmessage === 'function') { try { s.onmessage({ data }); } catch (x) { /* halaman menangani sendiri */ } }
  }
  // putar kejadian baru dengan jeda aslinya (0,12–1,5 dtk) supaya orang bergerak berurutan seperti di laptop, bukan serentak
  function putar() {
    pemutar = null;
    if (dijeda || !antre.length) return;
    const e = antre.shift();
    siarkan(e);
    tsPutarTerakhir = e.ts;
    if (antre.length) {
      const jeda = antre.length > 25 ? 120 : Math.min(1500, Math.max(120, antre[0].ts - e.ts));
      pemutar = setTimeout(putar, jeda);
    }
  }
  function jadwal() { if (!pemutar && !dijeda && antre.length) pemutar = setTimeout(putar, 60); }

  function jawabState() {
    stateDijawab = true;
    const recent = (awal || []).slice(-40);
    while (penunggu.length) penunggu.shift()(recent);
  }

  function terima(json) {
    let d;
    try { d = JSON.parse(json); } catch (x) { return; }
    if (!d || typeof d !== 'object') return;
    if (typeof d.tersambung === 'boolean' && d.tersambung !== tersambung) {
      tersambung = d.tersambung;
      for (const s of sumber) {
        s.readyState = tersambung ? 1 : 0;
        const f = tersambung ? s.onopen : s.onerror;
        if (typeof f === 'function') { try { f({}); } catch (x) { /* abaikan */ } }
      }
    }
    const daftar = (Array.isArray(d.kejadian) ? d.kejadian : []).map(bersih).filter(Boolean).sort((a, b) => a.ts - b.ts);
    if (awal === null) {
      awal = daftar;
      if (!stateDijawab) { for (const e of daftar) tandai(e); if (penunggu.length) jawabState(); return; }
    }
    const kini = Date.now();
    for (const e of daftar) {
      if (dilihat.has(kunci(e))) continue;
      tandai(e);
      if (kini - e.ts > LAMA_MS || e.ts < tsPutarTerakhir - LAMA_MS) continue;
      antre.push(e);
    }
    antre.sort((a, b) => a.ts - b.ts);
    if (antre.length > 80) antre.splice(0, antre.length - 80);
    jadwal();
  }

  function jeda(ya) {
    dijeda = !!ya;
    if (dijeda) { clearTimeout(pemutar); pemutar = null; } else jadwal();
  }

  const respons = (isi, status) => new Response(isi, { status, headers: { 'Content-Type': 'application/json' } });
  window.fetch = function (input) {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    let jalur = '';
    try { jalur = new URL(url, location.href).pathname; } catch (x) { jalur = ''; }
    if (jalur === '/state') {
      return new Promise(selesai => {
        const kirim = recent => selesai(respons(JSON.stringify({ agents: [], recent }), 200));
        if (awal !== null) { stateDijawab = true; kirim(awal.slice(-40)); return; }
        penunggu.push(kirim);
        setTimeout(() => { if (!stateDijawab) jawabState(); }, TUNGGU_AWAL_MS);
      });
    }
    return Promise.resolve(respons('{}', 404));   // token, limit, chat, dll. hanya ada di kantor laptop
  };

  class SumberPalsu {
    constructor() {
      this.readyState = 0; this.onopen = null; this.onmessage = null; this.onerror = null;
      sumber.add(this);
      setTimeout(() => {
        if (this.readyState === 2) return;
        this.readyState = tersambung ? 1 : 0;
        const f = tersambung ? this.onopen : this.onerror;
        if (typeof f === 'function') f({});
        jadwal();
      }, 0);
    }
    close() { this.readyState = 2; sumber.delete(this); }
    addEventListener() {}
    removeEventListener() {}
  }
  SumberPalsu.CONNECTING = 0; SumberPalsu.OPEN = 1; SumberPalsu.CLOSED = 2;
  window.EventSource = SumberPalsu;

  window.kantorHp = Object.freeze({ terima, jeda });
})();
