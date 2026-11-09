// Alur kerja live (tab Kantor, tanpa 3D): dari `status.kantor` (kejadian hook laptop TANPA isi — jenis, divisi, nama alat) dipetakan
// satu putaran kerja per proyek: perintah masuk → Kepala menugaskan divisi → divisi bekerja → selesai → Kepala melapor.
// Murni (tanpa Flutter) supaya teruji; tampilan di kantor.dart.

/// Tahap alur kerja divisi PA DEV (sama dengan strip "Alur kerja" kantor laptop, office.html ALUR). Satu tahap boleh paralel.
const tahapAlur = <(String, List<String>)>[
  ('Analisis', ['analis']),
  ('Membangun', ['programmer', 'ui']),
  ('Review', ['reviewer']),
  ('Uji & keamanan', ['qa', 'security']),
  ('Dokumentasi', ['dokumentasi']),
  ('Rilis', ['devops']),
];

const namaDivisi = {
  'analis': 'Analis',
  'programmer': 'Programmer',
  'ui': 'UI/UX',
  'reviewer': 'Reviewer',
  'qa': 'QA',
  'security': 'Security',
  'dokumentasi': 'Dokumentasi',
  'devops': 'DevOps',
};

enum StatusAlur { belum, ditugaskan, bekerja, menungguIzin, selesai, gagal }

class DivisiAlur {
  DivisiAlur(this.kunci, {this.ke = 0});

  /// 'programmer' (divisi) atau nama agen pendukung ('general-purpose', 'Explore', …).
  final String kunci;

  /// G9b: urutan dipanggil 1..3 bila ini satu ORANG (satu agentId) dari divisi [kunci]; 0 = baris gabungan divisi / agen pendukung.
  final int ke;
  StatusAlur status = StatusAlur.belum;
  String? aktivitas;

  /// Rincian alat terakhir (`status.kantor[].detail`, ≤80 huruf, sudah disamarkan Mac); null bila tidak ada.
  String? detail;
  DateTime? mulai, selesai;
  int jumlahAlat = 0;

  bool get divisi => namaDivisi.containsKey(kunci);
  String get nama => namaDivisi[kunci] ?? _rapikan(kunci);
}

class ButirLinimasa {
  const ButirLinimasa(this.waktu, this.teks, this.jenis);
  final DateTime waktu;
  final String teks;

  /// 'perintah' | 'tugas' | 'mulai' | 'selesai' | 'izin' | 'gagal' | 'lapor'
  final String jenis;
}

class AlurKerja {
  AlurKerja._();

  /// Kepala (Claude utama): bekerja / menunggu izin / selesai / diam.
  StatusAlur kepala = StatusAlur.belum;
  String? aktivitasKepala;

  /// Rincian alat terakhir Kepala (lihat [DivisiAlur.detail]); null bila tidak ada.
  String? detailKepala;
  DateTime? mulai, selesai, terakhir;

  /// Divisi & agen pendukung yang terlibat di putaran ini (urut pertama kali muncul).
  final Map<String, DivisiAlur> divisi = {};

  /// G9b: satu entri per ORANG (agentId) divisi, urut pertama kali muncul. [divisi] tetap gabungan per peran (alur tahap).
  final Map<String, DivisiAlur> orang = {};

  /// Orang-orang divisi [kunci] (urut ke).
  List<DivisiAlur> orangDivisi(String kunci) => [for (final o in orang.values) if (o.kunci == kunci) o];

  /// Linimasa tonggak (terbaru di atas), maks 30.
  final List<ButirLinimasa> linimasa = [];

  bool get kosong => mulai == null && divisi.isEmpty && linimasa.isEmpty;
  bool get berjalan => kepala == StatusAlur.bekerja || kepala == StatusAlur.menungguIzin;
  Iterable<DivisiAlur> get pendukung => divisi.values.where((d) => !d.divisi);
  int get aktif => divisi.values.where((d) => d.status == StatusAlur.bekerja || d.status == StatusAlur.menungguIzin).length;

  /// Proyek dengan kejadian terbaru (pilihan awal tab Kantor), atau null.
  static String? proyekTerbaru(List<Map<String, Object?>> kejadian) {
    String? p;
    var ts = -1;
    for (final e in kejadian) {
      final t = e['ts'], pr = e['proyek'];
      if (t is int && pr is String && t > ts) {
        ts = t;
        p = pr;
      }
    }
    return p;
  }

  /// Putaran kerja terakhir proyek [proyek]: mulai dari perintah terakhir ke Kepala (prompt tanpa agentId).
  static AlurKerja dari(List<Map<String, Object?>> kejadian, String proyek) {
    final a = AlurKerja._();
    final ev = kejadian.where((e) => e['proyek'] == proyek && e['ts'] is int).toList()
      ..sort((x, y) => (x['ts'] as int).compareTo(y['ts'] as int));
    var awal = 0;
    for (var i = ev.length - 1; i >= 0; i--) {
      if (ev[i]['kind'] == 'prompt' && ev[i]['agentId'] == null) {
        awal = i;
        break;
      }
    }
    final agen = <String, String>{}; // agentId → kunci divisi
    // G9b: ke = urutan agentId pertama kali muncul per peran, dari SELURUH ev (sama dengan Rekap, KONTRAK §10.14); ke-3 dst → 3.
    // shortcut: buffer `status.kantor` terbatas, sesi panjang bisa kehilangan agentId awal → ke bisa bergeser; Rekap tetap benar karena dihitung Mac.
    final urutan = <String, List<String>>{}; // peran → agentId urut muncul
    for (final e in ev) {
      final id = e['agentId'];
      final k = _kunciAgen(e['who'] is String ? e['who'] as String : null);
      if (id is String && namaDivisi.containsKey(k) && !(urutan[k] ??= []).contains(id)) urutan[k]!.add(id);
    }
    String kunciDari(Object? who) => _kunciAgen(who is String ? who : null);
    DivisiAlur div(String k) => a.divisi.putIfAbsent(k, () => DivisiAlur(k));
    DivisiAlur? orangDari(String k, String id) =>
        namaDivisi.containsKey(k) ? a.orang.putIfAbsent(id, () => DivisiAlur(k, ke: (urutan[k]!.indexOf(id) + 1).clamp(1, 3))) : null;

    for (final e in ev.skip(awal)) {
      final w = DateTime.fromMillisecondsSinceEpoch(e['ts'] as int);
      final kind = e['kind'], tool = e['tool'] is String ? e['tool'] as String : null;
      final agentId = e['agentId'] is String ? e['agentId'] as String : null;
      final detail = kind == 'tool' && e['detail'] is String ? e['detail'] as String : null;
      a.terakhir = w;
      if (agentId == null) {
        // ---- Kepala (sesi utama)
        switch (kind) {
          case 'prompt':
            a.mulai ??= w;
            a.kepala = StatusAlur.bekerja;
            a.aktivitasKepala = 'Menerima perintah';
            a._catat(w, 'Perintah masuk ke Kepala', 'perintah');
          case 'tool' when tool == 'Agent' || tool == 'Task':
            a.kepala = StatusAlur.bekerja;
            a.detailKepala = detail;
            final d = div(kunciDari(e['sub'] ?? 'general-purpose'));
            if (d.status == StatusAlur.belum || d.status == StatusAlur.selesai) d.status = StatusAlur.ditugaskan;
            a.aktivitasKepala = 'Menugaskan ${d.nama}';
            a._catat(w, 'Kepala menugaskan ${d.divisi ? 'Divisi ' : ''}${d.nama}', 'tugas');
          case 'tool':
            a.kepala = StatusAlur.bekerja;
            a.aktivitasKepala = labelAlat(tool);
            a.detailKepala = detail;
          case 'tool_done':
            if (a.kepala == StatusAlur.menungguIzin) a.kepala = StatusAlur.bekerja;
          case 'tool_fail':
            a._catat(w, 'Kepala: ${labelAlat(tool)} gagal', 'gagal');
          case 'notify' when e['type'] == 'permission_prompt' || e['type'] == 'elicitation_dialog':
            a.kepala = StatusAlur.menungguIzin;
            for (final d in [...a.divisi.values, ...a.orang.values]) {
              if (d.status == StatusAlur.bekerja) d.status = StatusAlur.menungguIzin;
            }
            a._catat(w, 'Menunggu izin Anda di laptop', 'izin');
          case 'stop':
            a.kepala = StatusAlur.selesai;
            a.selesai = w;
            a.aktivitasKepala = 'Melapor hasil';
            a._catat(w, 'Selesai — Kepala melapor hasil', 'lapor');
          default:
            break;
        }
        continue;
      }
      // ---- divisi / agen pendukung (sub agent)
      final k = agen[agentId] ??= kunciDari(e['who']);
      final gabungan = div(k);
      // orang diproses dulu, lalu gabungan divisi (dicatat ke linimasa sekali; status akhirnya bergantung orang lain)
      for (final d in [?orangDari(k, agentId), gabungan]) {
        final utama = identical(d, gabungan);
        void catat(String teks, String jenis) {
          if (utama) a._catat(w, teks, jenis);
        }

        final lain = a.orang.values.any((o) => o.kunci == k && !identical(o, d) && (o.status == StatusAlur.bekerja || o.status == StatusAlur.menungguIzin));
        switch (kind) {
          case 'agent_start':
            d
              ..status = StatusAlur.bekerja
              ..mulai = w
              ..aktivitas = 'Mulai bekerja';
            catat('${gabungan.nama} mulai bekerja', 'mulai');
          case 'tool':
            if (d.status != StatusAlur.selesai) d.status = StatusAlur.bekerja;
            d
              ..mulai ??= w
              ..jumlahAlat += 1
              ..aktivitas = labelAlat(tool)
              ..detail = detail;
          case 'tool_done':
            if (d.status == StatusAlur.menungguIzin) d.status = StatusAlur.bekerja;
          case 'tool_fail':
            d.aktivitas = '${labelAlat(tool)} gagal';
            catat('${gabungan.nama}: ${labelAlat(tool)} gagal', 'gagal');
          case 'notify' when e['type'] == 'permission_prompt':
            d.status = StatusAlur.menungguIzin;
            if (utama) a.kepala = StatusAlur.menungguIzin;
            catat('${gabungan.nama} menunggu izin Anda di laptop', 'izin');
          case 'agent_stop':
            // gabungan baru "selesai" bila tak ada orang lain di divisi itu yang masih bekerja
            if (!utama || !lain) {
              d
                ..status = StatusAlur.selesai
                ..selesai = w
                ..aktivitas = 'Selesai, melapor ke Kepala';
            }
            catat('${gabungan.nama} selesai', 'selesai');
          default:
            break;
        }
      }
    }
    return a;
  }

  void _catat(DateTime w, String teks, String jenis) {
    linimasa.insert(0, ButirLinimasa(w, teks, jenis));
    if (linimasa.length > 30) linimasa.removeLast();
  }
}

/// 'divisi-programmer' → 'programmer'; agen lain apa adanya (tanpa awalan plugin).
String _kunciAgen(String? who) {
  final n = (who ?? 'general-purpose').trim();
  final m = RegExp(r'^divisi-([a-z]+)$').firstMatch(n);
  if (m != null && namaDivisi.containsKey(m.group(1))) return m.group(1)!;
  return n.contains(':') ? n.split(':').last : n;
}

String _rapikan(String s) {
  final t = s.replaceAll(RegExp(r'[-_]+'), ' ').trim();
  return t.isEmpty ? 'Agen' : t[0].toUpperCase() + t.substring(1);
}

/// Nama alat Claude Code → kegiatan yang mudah dibaca (tanpa isi/berkas).
String labelAlat(String? t) {
  if (t == null || t.isEmpty) return 'Bekerja';
  if (t.startsWith('mcp__playwright')) return 'Menguji di browser';
  if (t.contains('figma') || t.contains('Figma')) return 'Membuka desain Figma';
  if (t.startsWith('mcp__')) return 'Memakai ${_rapikan(t.split('__').length > 1 ? t.split('__')[1] : t)}';
  return switch (t) {
    'Read' => 'Membaca berkas',
    'Edit' || 'MultiEdit' || 'Write' || 'NotebookEdit' => 'Mengubah berkas',
    'Bash' => 'Menjalankan perintah',
    'Grep' || 'Glob' => 'Mencari di kode',
    'WebFetch' || 'WebSearch' => 'Riset di web',
    'TodoWrite' => 'Menyusun daftar tugas',
    'Skill' => 'Memakai skill',
    'Agent' || 'Task' => 'Menugaskan divisi',
    'AskUserQuestion' => 'Bertanya ke Anda',
    'ExitPlanMode' => 'Menyusun rencana',
    _ => t,
  };
}
