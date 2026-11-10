/*
 * Uji perbaikan presensi masuk/pulang terpisah + uang makan.
 * Jalankan:  cd CADANGAN && node uji-presensi-terpisah.js
 */
'use strict';

global.window = global;
global.XLSX = require('../APLIKASI/lib/xlsx.full.min.js');
const fs = require('fs');
const path = require('path');
const T = require('../APLIKASI/app.js');
require('../APLIKASI/pegawai.js');
const ROSTER = global.PEGAWAI;

let gagal = 0;
function sama(nama, dapat, harus) {
  const ok = JSON.stringify(dapat) === JSON.stringify(harus);
  console.log((ok ? '  OK  ' : 'GAGAL ') + nama + ' -> ' + JSON.stringify(dapat) +
    (ok ? '' : '  HARUSNYA: ' + JSON.stringify(harus)));
  if (!ok) gagal++;
}
function ya(nama, kondisi, info) {
  console.log((kondisi ? '  OK  ' : 'GAGAL ') + nama + (info ? ' -> ' + info : ''));
  if (!kondisi) gagal++;
}
function pegawai(namaKey) { return ROSTER.filter(p => p.namaKey === namaKey)[0]; }
function row(tanggal, masuk, pulang, alasan, deskripsi) {
  return {
    tanggal: T.parseTanggal(tanggal), hari: '',
    masuk: T.parseTime(masuk), pulang: T.parseTime(pulang),
    alasan: alasan || '', deskripsi: deskripsi || ''
  };
}
// baca satu sel laporan kehadiran hasil ekspor
function selKehadiran(h, kolom) {
  const wb = T.susunWorkbookBidang([h], 2026, 10);
  const isi = XLSX.utils.sheet_to_json(wb.wbKehadiran.Sheets[h.pegawai.namaKey], { header: 1, defval: '' });
  return isi[2][kolom]; // baris 0 judul, 1 header, 2 data hari pertama
}
function selLembar(wb, namaSheet, baris, kolom) {
  const isi = XLSX.utils.sheet_to_json(wb.Sheets[namaSheet], { header: 1, defval: '' });
  return isi[baris][kolom];
}

const ardi = pegawai('ARDI'); // KRISTEN PPPK

console.log('== Pengujian 1: masuk 07:30, pulang kosong ==');
const r1 = [row('2026-10-05', '07:30', null)];
const k1 = T.klasifikasiHari(r1[0]);
const h1 = T.prosesSatuOrang(ardi, r1);
sama('klasifikasi = noPresensi pulang', k1.jenis + '/' + k1.sisi, 'noPresensi/pulang');
sama('masukMin dibawa', k1.masukMin, 450);
sama('masukAbsen dibawa', k1.masukAbsen, '7:30');
sama('ABSEN MASUK di laporan', selKehadiran(h1, 6), '7:30');
sama('JAM PULANG di laporan (jadwal)', selKehadiran(h1, 8), '16:30');
sama('ABSEN PULANG kosong = "-"', selKehadiran(h1, 9), '-');
ya('KETERANGAN tidak rekam presensi pulang', /TIDAK REKAM PRESENSI PULANG/.test(selKehadiran(h1, 13)), selKehadiran(h1, 13));
sama('uang makan dihitung 1 hari', h1.uangMakan.hariHadir, 1);
sama('uang makan bruto 1 x 37.000', h1.uangMakan.bruto, 37000);
sama('Tukin: PSW 1,5%', h1.pct.psw, 1.5);
sama('Tukin: TL 0%', h1.pct.tl, 0);
sama('Tukin: total 1,5%', h1.pct.total, 1.5);
sama('Tukin: potongan Rp', h1.rupiahPotongan.total, 49785);
const wb1 = T.susunWorkbookBidang([h1], 2026, 10);
sama('Excel tukin PSW %', selLembar(wb1.wbTukin, 'TUKIN PPPK', 3, 14), '1.5');
sama('Excel tukin TL %', selLembar(wb1.wbTukin, 'TUKIN PPPK', 3, 12), '0');
sama('Excel uang makan HARI MASUK', selLembar(wb1.wbUangMakan, 'UANG MAKAN', 3, 6), '1');

console.log('== Pengujian 2: masuk kosong, pulang 17:00 ==');
const r2 = [row('2026-10-05', null, '17:00')];
const k2 = T.klasifikasiHari(r2[0]);
const h2 = T.prosesSatuOrang(ardi, r2);
sama('klasifikasi = noPresensi masuk', k2.jenis + '/' + k2.sisi, 'noPresensi/masuk');
sama('pulangMin dibawa', k2.pulangMin, 1020);
sama('pulangAbsen dibawa', k2.pulangAbsen, '17:0');
sama('ABSEN MASUK kosong = "-"', selKehadiran(h2, 6), '-');
sama('JAM PULANG di laporan (jadwal)', selKehadiran(h2, 8), '16:30');
sama('ABSEN PULANG di laporan', selKehadiran(h2, 9), '17:0');
sama('PSW di laporan (+30 menit)', selKehadiran(h2, 10), '30');
ya('KETERANGAN tidak rekam presensi masuk', /TIDAK REKAM PRESENSI MASUK/.test(selKehadiran(h2, 13)), selKehadiran(h2, 13));
sama('uang makan dihitung 1 hari', h2.uangMakan.hariHadir, 1);
sama('uang makan bruto', h2.uangMakan.bruto, 37000);
sama('Tukin: TL 1,5%', h2.pct.tl, 1.5);
sama('Tukin: PSW 0%', h2.pct.psw, 0);
sama('Tukin: total 1,5%', h2.pct.total, 1.5);
sama('Excel tukin TL %', selLembar(T.susunWorkbookBidang([h2], 2026, 10).wbTukin, 'TUKIN PPPK', 3, 12), '1.5');

console.log('== Pengujian 3: masuk 07:30, pulang 16:30 ==');
const r3 = [row('2026-10-05', '07:30', '16:30')];
const k3 = T.klasifikasiHari(r3[0]);
const h3 = T.prosesSatuOrang(ardi, r3);
sama('klasifikasi hadir', k3.jenis, 'hadir');
sama('ABSEN MASUK', selKehadiran(h3, 6), '7:30');
sama('ABSEN PULANG', selKehadiran(h3, 9), '16:30');
sama('hariMasuk (lengkap)', h3.hariMasuk, 1);
sama('uang makan 1 hari', h3.uangMakan.hariHadir, 1);
sama('tidak ada potongan Tukin', h3.rupiahPotongan.total, 0);
sama('tukin bersih utuh', h3.tukinBersih, ardi.tukin);

console.log('== Pengujian 4: masuk & pulang kosong, alasan kosong ==');
const r4 = [row('2026-10-05', null, null, '', '')];
const k4 = T.klasifikasiHari(r4[0]);
const h4 = T.prosesSatuOrang(ardi, r4);
sama('klasifikasi TK', k4.jenis, 'tk');
sama('TK 1 hari', h4.tkHari, 1);
sama('Tukin: TK 3%', h4.pct.tk, 3);
sama('Tukin: total 3%', h4.pct.total, 3);
sama('Tukin: potongan Rp99.570', h4.rupiahPotongan.total, 99570);
sama('uang makan tidak dihitung', h4.uangMakan.hariHadir, 0);
sama('uang makan bruto 0', h4.uangMakan.bruto, 0);
sama('uang makan bersih 0', h4.uangMakan.bersih, 0);
sama('ABSEN MASUK "-"', selKehadiran(h4, 6), '-');
sama('ABSEN PULANG "-"', selKehadiran(h4, 9), '-');

console.log('== Pengujian 5: KRISTEN PPPK, masuk 07:30, pulang kosong ==');
const h5 = T.prosesSatuOrang(pegawai('ARDI'), [row('2026-10-05', '07:30', null)]);
sama('status pegawai', T.statusPegawai(h5.pegawai), 'PPPK');
sama('bidang', h5.pegawai.bidang, 'KRISTEN');
sama('jam masuk tidak hilang', selKehadiran(h5, 6), '7:30');
sama('uang makan 1 hari', h5.uangMakan.hariHadir, 1);
sama('potongan pulang tetap ada', h5.pct.psw, 1.5);

console.log('== Lintas bidang & status ==');
[
  { key: 'ELIYANI', bidang: 'KATOLIK', status: 'PPPK' },
  { key: 'ADES', bidang: 'BUDDHA', status: 'PPPK' },
  { key: 'SAMAREL', bidang: 'KRISTEN', status: 'PNS' },
  { key: 'BARON', bidang: 'KATOLIK', status: 'PNS' },
  { key: 'SUWARNO', bidang: 'BUDDHA', status: 'PNS' }
].forEach(function (uji) {
  const p = pegawai(uji.key);
  const hMasuk = T.prosesSatuOrang(p, [row('2026-10-05', '07:30', null)]);
  const hPulang = T.prosesSatuOrang(p, [row('2026-10-05', null, '17:00')]);
  sama(uji.key + ' ' + uji.bidang + '/' + uji.status + ' masuk tetap tampil', selKehadiran(hMasuk, 6), '7:30');
  sama(uji.key + ' pulang tetap tampil', selKehadiran(hPulang, 9), '17:0');
  sama(uji.key + ' uang makan 1 hari (masuk saja)', hMasuk.uangMakan.hariHadir, 1);
  sama(uji.key + ' uang makan 1 hari (pulang saja)', hPulang.uangMakan.hariHadir, 1);
});

console.log('== Data asli Oktober 2026 (file permasalahan) ==');
function prosesBerkas(file, namaKey) {
  const rows = T.bacaSheetPresensi(fs.readFileSync(path.join(__dirname, file)).toString('binary'));
  return T.prosesSatuOrang(pegawai(namaKey), rows);
}
const hendro = prosesBerkas('permasalahan/Hendro_Presensi 10-2026.xlsx', 'HENDRO');
const mayani = prosesBerkas('permasalahan/Mayani_Presensi 10-2026.xlsx', 'MAYANI');
const david = prosesBerkas('permasalahan/David Hadamenan_Presensi 10-2026.xlsx', 'DAVID');
function barisTanggal(h, d) {
  const wb = T.susunWorkbookBidang([h], 2026, 10);
  const isi = XLSX.utils.sheet_to_json(wb.wbKehadiran.Sheets[h.pegawai.namaKey], { header: 1, defval: '' });
  return isi.filter(x => String(x[3]).indexOf('2026-10-' + String(d).padStart(2, '0')) === 0)[0];
}
const hd23 = barisTanggal(hendro, 23);
sama('HENDRO 23 Okt ABSEN MASUK', hd23[6], '7:18');
sama('HENDRO 23 Okt CEPAT TELAT', hd23[7], '42');
sama('HENDRO 23 Okt keterangan', /TIDAK REKAM PRESENSI PULANG/.test(hd23[13]), true);
const my16 = barisTanggal(mayani, 16);
sama('MAYANI 16 Okt ABSEN PULANG', my16[9], '17:26');
sama('MAYANI 16 Okt keterangan', /TIDAK REKAM PRESENSI MASUK/.test(my16[13]), true);
const dv20 = barisTanggal(david, 20);
sama('DAVID 20 Okt ABSEN MASUK', dv20[6], '7:0');
sama('DAVID 20 Okt keterangan', /TIDAK REKAM PRESENSI PULANG/.test(dv20[13]), true);
// uang makan ikut menghitung hari-hari tersebut
sama('HENDRO hariHadirUangMakan > hariMasuk', hendro.hariHadirUangMakan > hendro.hariMasuk, true);
sama('selisih = jumlah noPresensi', hendro.hariHadirUangMakan - hendro.hariMasuk, hendro.noPresensiList.length);
sama('MAYANI selisih = jumlah noPresensi', mayani.hariHadirUangMakan - mayani.hariMasuk, mayani.noPresensiList.length);
sama('DAVID selisih = jumlah noPresensi', david.hariHadirUangMakan - david.hariMasuk, david.noPresensiList.length);
sama('HENDRO uang makan bruto = hariHadir x 37.000', hendro.uangMakan.bruto, hendro.hariHadirUangMakan * 37000);
sama('MAYANI uang makan bruto = hariHadir x 37.000', mayani.uangMakan.bruto, mayani.hariHadirUangMakan * 37000);

console.log(gagal ? ('\n*** ' + gagal + ' UJI GAGAL ***') : '\nSemua uji LULUS ✔');
process.exit(gagal ? 1 : 0);
