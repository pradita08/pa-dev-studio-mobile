// Uji cari proyek di tab Proyek (lokal di HP: nama/id, tanpa beda huruf besar/kecil).
import 'package:flutter_test/flutter_test.dart';
import 'package:padev_studio/layar/beranda.dart';
import 'package:padev_studio/layar/data.dart';

Proyek _p(String id, String nama) => Proyek(id: id, nama: nama, akun: const ['akun1'], hp: 'rencana', sibuk: false);

void main() {
  final daftar = [_p('simpeg', 'SIMPEG'), _p('simukpbj', 'SIMUK PBJ'), _p('web-dkk-v2', 'Web DKK v2')];

  test('kata kosong/spasi → semua proyek', () {
    expect(saringProyek(daftar, ''), daftar);
    expect(saringProyek(daftar, '   '), daftar);
  });

  test('cocok nama atau id, tanpa beda huruf besar/kecil', () {
    expect(saringProyek(daftar, 'sim').map((p) => p.id), ['simpeg', 'simukpbj']);
    expect(saringProyek(daftar, 'PBJ').map((p) => p.id), ['simukpbj']);
    expect(saringProyek(daftar, 'dkk-v2').map((p) => p.id), ['web-dkk-v2']);
    expect(saringProyek(daftar, ' dkk ').map((p) => p.id), ['web-dkk-v2']);
  });

  test('tidak ada yang cocok → kosong', () {
    expect(saringProyek(daftar, 'labkesda'), isEmpty);
  });
}
