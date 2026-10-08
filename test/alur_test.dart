// Alur kerja live (tab Kantor): status.kantor → satu putaran kerja per proyek.
import 'package:flutter_test/flutter_test.dart';
import 'package:padev_studio/layar/alur.dart';

Map<String, Object?> ev(int dt, String kind, {String proyek = 'simpeg', String? who, String? agentId, String? tool, String? sub, String? type}) => {
      'ts': 1791000000000 + dt * 1000,
      'kind': kind,
      'proyek': proyek,
      'who': ?who,
      'agentId': ?agentId,
      'tool': ?tool,
      'sub': ?sub,
      'type': ?type,
    };

void main() {
  final putaranLama = [ev(0, 'prompt'), ev(1, 'tool', tool: 'Agent', sub: 'divisi-qa'), ev(2, 'stop')];
  final putaran = [
    ev(10, 'prompt'),
    ev(11, 'tool', tool: 'Read'),
    ev(12, 'tool', tool: 'Agent', sub: 'divisi-analis'),
    ev(13, 'agent_start', who: 'divisi-analis', agentId: 'a1'),
    ev(14, 'tool', who: 'divisi-analis', agentId: 'a1', tool: 'Grep'),
    ev(20, 'agent_stop', who: 'divisi-analis', agentId: 'a1'),
    ev(21, 'tool', tool: 'Task', sub: 'divisi-programmer'),
    ev(22, 'agent_start', who: 'divisi-programmer', agentId: 'p1'),
    ev(23, 'tool', who: 'divisi-programmer', agentId: 'p1', tool: 'Edit'),
    ev(24, 'tool', tool: 'Agent', sub: 'Explore'),
    ev(25, 'agent_start', who: 'Explore', agentId: 'x1'),
    ev(26, 'notify', type: 'permission_prompt'),
    ev(30, 'prompt', proyek: 'etpp'),
  ];

  test('putaran terakhir proyek: perintah → analis selesai → programmer bekerja → menunggu izin', () {
    final a = AlurKerja.dari([...putaranLama, ...putaran], 'simpeg');
    expect(a.mulai, DateTime.fromMillisecondsSinceEpoch(1791000010000));
    expect(a.kepala, StatusAlur.menungguIzin);
    expect(a.divisi.containsKey('qa'), isFalse, reason: 'putaran lama tidak ikut');
    expect(a.divisi['analis']!.status, StatusAlur.selesai);
    expect(a.divisi['analis']!.jumlahAlat, 1);
    expect(a.divisi['programmer']!.status, StatusAlur.menungguIzin);
    expect(a.divisi['programmer']!.aktivitas, 'Mengubah berkas');
    expect(a.pendukung.single.nama, 'Explore');
    expect(a.berjalan, isTrue);
    expect(a.linimasa.first.jenis, 'izin');
    expect(a.linimasa.map((b) => b.teks), containsAll(['Perintah masuk ke Kepala', 'Kepala menugaskan Divisi Analis', 'Analis selesai', 'Programmer mulai bekerja']));
  });

  test('stop Kepala → selesai; proyek lain terpisah; proyek terbaru dipilih', () {
    final a = AlurKerja.dari([...putaran, ev(27, 'agent_stop', who: 'divisi-programmer', agentId: 'p1'), ev(28, 'stop')], 'simpeg');
    expect(a.kepala, StatusAlur.selesai);
    expect(a.berjalan, isFalse);
    expect(a.selesai, isNotNull);
    expect(a.divisi['programmer']!.status, StatusAlur.selesai);
    final e = AlurKerja.dari(putaran, 'etpp');
    expect(e.kepala, StatusAlur.bekerja);
    expect(e.divisi, isEmpty);
    expect(AlurKerja.proyekTerbaru(putaran), 'etpp');
    expect(AlurKerja.dari(putaran, 'tidak-ada').kosong, isTrue);
  });

  test('label alat tanpa isi; nama agen dirapikan', () {
    expect(labelAlat('Bash'), 'Menjalankan perintah');
    expect(labelAlat('mcp__playwright__browser_click'), 'Menguji di browser');
    expect(labelAlat(null), 'Bekerja');
    final a = AlurKerja.dari([ev(0, 'prompt'), ev(1, 'agent_start', who: 'plugin:code-reviewer', agentId: 'r')], 'simpeg');
    expect(a.divisi.keys.single, 'code-reviewer');
    expect(a.divisi.values.single.nama, 'Code reviewer');
  });
}
