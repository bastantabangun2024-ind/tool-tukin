/*
 * Uji otomatis app.js di Node — bandingkan hasil dengan angka file manual September 2026.
 * Jalankan:  node uji-app.js
 */
'use strict';

global.window = global; // uli pegawai.js pakai window.PEGAWAI
global.XLSX = require('../APLIKASI/lib/xlsx.full.min.js');
const fs = require('fs');
const path = require('path');
const T = require('../APLIKASI/app.js');
require('../APLIKASI/pegawai.js');
const DIR = __dirname;
const ROSTER = global.PEGAWAI;

let gagal = 0;
function sama(nama, dapat, harus) {
  const ok = JSON.stringify(dapat) === JSON.stringify(harus);
  console.log((ok ? '  OK  ' : 'GAGAL ') + nama + ' -> ' + JSON.stringify(dapat) +
    (ok ? '' : '  HARUSNYA: ' + JSON.stringify(harus)));
  if (!ok) gagal++;
}

const pathJoin = (p) => path.join(DIR, p);

function prosesFile(path) {
  const fileName = path.split('/').pop();
  const ident = T.parseNamaFile(fileName);
  if (!ident) throw new Error('nama file tidak terbaca: ' + fileName);
  const rows = T.bacaSheetPresensi(fs.readFileSync(pathJoin(path)).toString('binary'));
  const ketemu = ROSTER.filter(p => (p.namaKey || T.namaKey(p.nama)) === ident.namaKey);
  if (ketemu.length !== 1) throw new Error('roster match: ' + ketemu.length + ' untuk ' + ident.namaKey);
  return T.prosesSatuOrang(ketemu[0], rows);
}

console.log('== ARDI ==');
const ardi = prosesFile('BIMAS KRISTEN PPPK/ARDI_Presensi 9-2026.xlsx');
sama('hariMasuk', ardi.hariMasuk, 18);
sama('tkHari', ardi.tkHari, 0);
sama('libur (cuti)', ardi.liburList.length, 4);
sama('tgl cuti 15-18', ardi.liburList.map(k => k.tanggal.d), [15, 16, 17, 18]);
sama('telat 0', ardi.telatList.length, 0);
sama('psw 0', ardi.pswList.length, 0);
sama('noPresensi 0', ardi.noPresensiList.length, 0);
sama('potongan total = 0', ardi.rupiahPotongan.total, 0);
sama('tukin bersih', ardi.tukinBersih, 3319000);
sama('uang makan bruto', ardi.uangMakan.bruto, 666000);
sama('PPH', ardi.uangMakan.pph, 33300);
sama('uang makan bersih', ardi.uangMakan.bersih, 632700);

console.log('== CHRISTIN ==');
const chris = prosesFile('BIMAS KRISTEN PPPK/CHRISTIN_Presensi 9-2026.xlsx');
sama('hariMasuk', chris.hariMasuk, 22);
sama('tkHari', chris.tkHari, 0);
sama('libur 0', chris.liburList.length, 0);
sama('1 kejadian telat', chris.telatList.length, 1);
sama('telat di 2026-09-09', chris.telatList[0] ? (chris.telatList[0].tanggal.y + '-' + chris.telatList[0].tanggal.mo + '-' + chris.telatList[0].tanggal.d) : '-', '2026-9-9');
sama('telat 2 menit', chris.telatList[0] ? chris.telatList[0].telat : 0, 2);
sama('TL % = 0.5', chris.pct.tl, 0.5);
sama('TL Rp16.595', chris.rupiahPotongan.tl, 16595);
sama('PSW 0', chris.rupiahPotongan.psw, 0);
sama('total potongan', chris.rupiahPotongan.total, 16595);
sama('tukin bersih', chris.tukinBersih, 3302405);
sama('uang makan bruto', chris.uangMakan.bruto, 814000);
sama('PPH', chris.uangMakan.pph, 40700);
sama('uang makan bersih', chris.uangMakan.bersih, 773300);

console.log('== Tangga persen ==');
sama('1menit 0.5', T.tanggaPersen(1), 0.5);
sama('29menit 0.5', T.tanggaPersen(29), 0.5);
sama('30menit 1', T.tanggaPersen(30), 1);
sama('60menit 1', T.tanggaPersen(60), 1);
sama('61menit 1.25', T.tanggaPersen(61), 1.25);
sama('89menit 1.25', T.tanggaPersen(89), 1.25);
sama('90menit 1.5', T.tanggaPersen(90), 1.5);
sama('tidak absen 1.5', T.tanggaPersen(null), 1.5);

console.log('== Format ala manual ==');
sama('rupiah', T.rupiahString(3319000), ' Rp3,319,000 ');
sama('rupiah 0', T.rupiahString(0), ' Rp-   ');
sama('persen 0.5', T.persenString(0.5), '0.5');
sama('jam 480', T.fmtJam(480), '8:0');
sama('jam 1020 jumat', T.fmtJam(1020), '17:0');

console.log('== Susun workbook KRISTEN ==');
const wb = T.susunWorkbookBidang([ardi, chris], 2026, 9);
sama('nama file tukin', wb.fileTukin, 'Rekapitulasi Tukin Bimas KRISTEN SEPT.xlsx');
sama('nama file um', wb.fileUangMakan, 'Rekapitulasi Uang Makan Bimas KRISTEN SEPT.xlsx');
sama('nama file kehadiran', wb.fileKehadiran, 'Rekapitulasi Kehadiran Bimas KRISTEN SEPT.xlsx');
sama('sheet tukin', wb.wbTukin.SheetNames, ['TUKIN PPPK']);
sama('sheet kehadiran punya ARDI', wb.wbKehadiran.SheetNames.indexOf('ARDI') >= 0, true);
sama('sheet kehadiran punya CHRISTIN', wb.wbKehadiran.SheetNames.indexOf('CHRISTIN') >= 0, true);

console.log('== Link Google Drive ==');
sama('link folder', T.ambilIdDrive('https://drive.google.com/drive/folders/1JMTpoTqYlFZgeczrKLmeEBcx1qGc4fP6?usp=drive_link'),
  { id: '1JMTpoTqYlFZgeczrKLmeEBcx1qGc4fP6', jenis: 'folder' });
sama('link file', T.ambilIdDrive('https://drive.google.com/file/d/1Qgldpb-j73UQFwWOc62HWOckrPllDZrC/view?usp=sharing'),
  { id: '1Qgldpb-j73UQFwWOc62HWOckrPllDZrC', jenis: 'file' });
sama('link open?id', T.ambilIdDrive('https://drive.google.com/open?id=1Qgldpb-j73UQFwWOc62HWOckrPllDZrC'),
  { id: '1Qgldpb-j73UQFwWOc62HWOckrPllDZrC', jenis: null });
sama('link uc?export', T.ambilIdDrive('https://drive.google.com/uc?export=download&id=1Qgldpb-j73UQFwWOc62HWOckrPllDZrC'),
  { id: '1Qgldpb-j73UQFwWOc62HWOckrPllDZrC', jenis: null });
sama('id gundul', T.ambilIdDrive('1Qgldpb-j73UQFwWOc62HWOckrPllDZrC'),
  { id: '1Qgldpb-j73UQFwWOc62HWOckrPllDZrC', jenis: null });
sama('bukan link', T.ambilIdDrive('lihat folder saya ya'), null);
sama('banyak baris', T.parseDriveLinks(
  'https://drive.google.com/drive/folders/1JMTpoTqYlFZgeczrKLmeEBcx1qGc4fP6\nhttps://drive.google.com/drive/folders/1yWLYkZmzKkyYiv4dkfB6tvimzRUtD04b').length, 2);

console.log('== Nama file dari Drive ==');
sama('sudah berpola', T.namaFileDrive({ name: 'ARDI_Presensi 9-2026.xlsx', folder: 'Ardi Elisman Situmorang' }, ''),
  'ARDI_Presensi 9-2026.xlsx');
sama('tanpa nama -> nama folder', T.namaFileDrive({ name: 'Presensi 9-2026.xlsx', folder: 'MAYANI' }, ''),
  'MAYANI_Presensi 9-2026.xlsx');
sama('nama folder panjang -> kata pertama', T.namaFileDrive({ name: 'Presensi 9-2026.xlsx', folder: 'Ardi Elisman Situmorang' }, ''),
  'ARDI_Presensi 9-2026.xlsx');
sama('bulan-tahun dari kolom bantu', T.namaFileDrive({ name: 'presensi.xlsx', folder: 'CHRISTIN' }, '09-2026'),
  'CHRISTIN_Presensi 9-2026.xlsx');
sama('tak bisa dipastikan', T.namaFileDrive({ name: 'presensi.xlsx', folder: '' }, ''), 'presensi.xlsx');
sama('periodeDariNama', T.periodeDariNama('Presensi 9-2026.xlsx'), '9-2026');
sama('periodeDariNama bulan 10', T.periodeDariNama('PRESENSI OKTOBER 10_2026'), '10-2026');
sama('periodeDariNama tanpa pola', T.periodeDariNama('presensi september.xlsx'), null);

console.log('== Bulan-tahun dari jalur folder Drive ==');
sama('jalur tahun / bulan', T.periodeDariJalur('TUKIN UANG MAKAN PPPK / BIMAS KATOLIK / 1. 2026 / 9. SEPTEMBER / ELIYANI BR GINTING fix'), '9-2026');
sama('folder tahun "1. 2026" tidak dianggap bulan 1', T.periodeDariJalur('BIMAS KATOLIK / 1. 2026 / 10. OKTOBER / Lusiana Rotua Naibaho'), '10-2026');
sama('tahun di depan', T.periodeDariJalur('BIMAS KATOLIK / 2025 / DES / LUSIANA FIX'), '12-2025');
sama('bulan singkat tanpa spasi', T.periodeDariJalur('BIMAS KATOLIK / 1. 2026 / 5.MEI / MARLIANA SIBAGARIANG_FIX'), '5-2026');
sama('salah ketik Septemeber', T.periodeDariJalur('9. SEPTEMBER / Presensi Septemeber 2026 Eliyani Ginting.xlsx'), '9-2026');
sama('tanpa bulan / tahun', T.periodeDariJalur('presensi.xlsx'), null);
sama('nama penyuluh Agustina tidak jadi bulan 8',
  T.periodeDariJalur('BIMAS KATOLIK / 1. 2026 / 9. SEPTEMBER / AGUSTINA / Presensi.xlsx'), '9-2026');
sama('nama bebas -> dari jalur', T.namaFileDrive({
  name: 'Presensi Septemeber 2026 Eliyani Ginting.xlsx',
  folder: 'ELIYANI BR GINTING fix',
  jalur: 'BIMAS KATOLIK / 1. 2026 / 9. SEPTEMBER'
}, ''), 'ELIYANI_Presensi 9-2026.xlsx');
sama('nama bebas tanpa jalur -> bulan dari nama file',
  T.namaFileDrive({ name: 'Presensi Septemeber 2026.xlsx', folder: 'ELIYANI' }, ''), 'ELIYANI_Presensi 9-2026.xlsx');
sama('tanpa bulan sama sekali -> tetap apa adanya',
  T.namaFileDrive({ name: 'presensi.xlsx', folder: 'ELIYANI' }, ''), 'presensi.xlsx');

console.log('== Nama folder penyuluh -> nama pegawai ==');
sama('folder biasa', T.namaDariFolder('Ardi Elisman Situmorang'), 'ARDI');
sama('folder bernomor + "SS UANG MAKAN"', T.namaDariFolder('01. ADES SS UANG MAKAN, TUKIN DAN LKB FIX'), 'ADES');
sama('folder "FIX_1." + gelar', T.namaDariFolder('FIX_1. ELIYANI BR GINTING ( SS TUKIN & UANG MAKAN)'), 'ELIYANI');
sama('folder rekap', T.namaDariFolder('RUSMIDAWATI REKAP SEPTEMBER 2026'), 'RUSMIDAWATI');
sama('folder kosong', T.namaDariFolder(''), '');
sama('namaFileDrive folder bernomor', T.namaFileDrive({ nama: 'Presensi 11-2025 ANSANI.xlsx', folder: '02. ANSANI FIX' }, ''),
  'ANSANI_Presensi 11-2025.xlsx');

console.log('== Penyaring bulan-tahun (link folder arsip) ==');
sama('september cocok', T.cocokPeriodeDrive('TUKIN / BIMAS KRISTEN / 9. SEPTEMBER 2026 / MAYANI Presensi 9-2026.xlsx', 9, 2026), true);
sama('maret ditolak', T.cocokPeriodeDrive('BIMAS KATOLIK / 1. 2026 / 3. MARET / MARLIANA Presensi 3-2026.xlsx', 9, 2026), false);
sama('nov 2025 ditolak untuk nov 2026', T.cocokPeriodeDrive('BIMAS BUDDHA / 2025 / NOV / ADES Presensi 11-2025.xlsx', 11, 2026), false);
sama('nov 2025 diterima kalau diminta', T.cocokPeriodeDrive('BIMAS BUDDHA / 2025 / NOV / ADES Presensi 11-2025.xlsx', 11, 2025), true);
sama('nama bulan panjang (September)', T.cocokPeriodeDrive('BIMAS KATOLIK / 1. 2026 / 9. SEPTEMBER / Presensi Septemeber 2026 Eliyani.xlsx', 9, 2026), true);
sama('MARLIANA bukan MARet', T.cocokPeriodeDrive('BIMAS KATOLIK / 1. 2026 / 9. SEPTEMBER / MARLIANA SIBAGARIANG fix', 3, 2026), false);
sama('bulan angka + tahun di nama file', T.cocokPeriodeDrive('BIMAS KATOLIK / 5.MEI / LUSIANA Presensi 5-2026.xlsx', 5, 2026), true);
sama('tanpa sebutan bulan', T.cocokPeriodeDrive('BIMAS KRISTEN / MARLIANA SIBAGARIANG FIX / presensi.xlsx', 9, 2026), false);

// tulis output nyata untuk dicek manual di Excel (bundle browser tidak bisa writeFile di Node)
function simpan(wb, file) {
  fs.writeFileSync(path.join(DIR, 'hasil-uji', file), XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}
simpan(wb.wbTukin, 'tukin-kr-test.xlsx');
simpan(wb.wbUangMakan, 'um-kr-test.xlsx');
simpan(wb.wbKehadiran, 'kehadiran-kr-test.xlsx');

// cek isi baris tukin CHRISTIN
const rowChris = T.barisTukin(2, chris, 2026, 9);
sama('baris TL string', rowChris[11], ' Rp16,595 ');
sama('baris TL %', rowChris[12], '0.5');
sama('baris TOTAL POTONGAN', rowChris[25], ' Rp16,595 ');
sama('baris TOTAL POTONGAN %', rowChris[26], '0.5');
sama('baris TUKIN BERSIH', rowChris[27], ' Rp3,302,405 ');

/* ------------------------------------------------------------------ *
 * PNS: roster baru + hasil hitung dibandingkan file manual September 2026
 * (ABSEN SEPTEMBER 2026 PNS/PEMBIMAS ...). Rumus sama, tukin & PPH berbeda.
 * ------------------------------------------------------------------ */
console.log('== Roster PNS ==');
const PNS = ROSTER.filter(p => p.status === 'PNS');
sama('jumlah pegawai PNS', PNS.length, 4);
sama('sebaran bidang PNS', PNS.map(p => p.bidang).sort(), ['BUDDHA', 'KATOLIK', 'KRISTEN', 'KRISTEN']);
sama('26 PPPK tetap utuh', ROSTER.filter(p => (p.status || 'PPPK') === 'PPPK').length, 26);
const samarel = PNS.filter(p => p.namaKey === 'SAMAREL')[0];
sama('SAMAREL gol IV/b', samarel.gol, 'IV/b');
sama('SAMAREL tukin IV/b', samarel.tukin, 4551000);
sama('SAMAREL tarif uang makan gol IV', samarel.tarifUangMakan, 41000);
sama('SAMAREL PPH 15%', samarel.pphPct, 15);
sama('BASTANTA tukin III/b', PNS.filter(p => p.namaKey === 'BASTANTA')[0].tukin, 2928000);
sama('BASTANTA PPH 5%', PNS.filter(p => p.namaKey === 'BASTANTA')[0].pphPct, 5);
sama('BARON tukin IV/a', PNS.filter(p => p.namaKey === 'BARON')[0].tukin, 4551000);
sama('SUWARNO tukin IV/a', PNS.filter(p => p.namaKey === 'SUWARNO')[0].tukin, 4551000);

// rakit ulang baris presensi dari rekap kehadiran manual (kolom TANGGAL..KETERANGAN)
function presensiDariKehadiran(folder, nip) {
  const wb = XLSX.read(fs.readFileSync(path.join(DIR, 'ABSEN SEPTEMBER 2026 PNS', folder,
    'Rekapitulasi Kehadiran20269.xlsx')), { type: 'buffer' });
  const r = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: '' });
  return r.filter(x => String(x[1]).trim() === nip).map(x => ({
    tanggal: T.parseTanggal(x[3]), hari: x[4],
    masuk: T.parseTime(x[6]), pulang: T.parseTime(x[9]),
    alasan: String(x[11] || x[12] || '').trim(), deskripsi: String(x[13] || '').trim()
  }));
}

console.log('== PNS KRISTEN: SAMAREL (IV/b, 5 hari Dinas Luar) ==');
const sR = presensiDariKehadiran('PEMBIMAS KRISTEN', samarel.nip);
const sH = T.prosesSatuOrang(samarel, sR);
sama('hariMasuk', sH.hariMasuk, 17);
sama('libur dinas luar', sH.liburList.length, 5);
sama('potongan 0', sH.rupiahPotongan.total, 0);
sama('tukin bersih', sH.tukinBersih, 4551000);
sama('uang makan bruto', sH.uangMakan.bruto, 697000);
sama('tarif 41.000', sH.uangMakan.tarif, 41000);
sama('PPH 15% = 104.550', sH.uangMakan.pph, 104550);
sama('uang makan bersih', sH.uangMakan.bersih, 592450);

console.log('== PNS KRISTEN: BASTANTA (III/b, PPH 5%) ==');
const bH = T.prosesSatuOrang(PNS.filter(p => p.namaKey === 'BASTANTA')[0],
  presensiDariKehadiran('PEMBIMAS KRISTEN', '198605162020121008'));
sama('hariMasuk', bH.hariMasuk, 22);
sama('tukin bersih', bH.tukinBersih, 2928000);
sama('uang makan bruto', bH.uangMakan.bruto, 814000);
sama('PPH 5% = 40.700', bH.uangMakan.pph, 40700);

console.log('== PNS KATOLIK: BARON (IV/a, 4 hari Dinas Luar) ==');
const baron = PNS.filter(p => p.namaKey === 'BARON')[0];
const baronH = T.prosesSatuOrang(baron, presensiDariKehadiran('PEMBIMAS KATOLIK', baron.nip));
sama('hariMasuk', baronH.hariMasuk, 18);
sama('tukin bersih', baronH.tukinBersih, 4551000);
sama('uang makan bruto', baronH.uangMakan.bruto, 738000);
sama('PPH 15% = 110.700', baronH.uangMakan.pph, 110700);

console.log('== PNS BUDDHA: SUWARNO (IV/a, 3 hari Dinas Luar + telat 225 menit) ==');
const suwarno = PNS.filter(p => p.namaKey === 'SUWARNO')[0];
const suwR = presensiDariKehadiran('PEMBIMAS BUDDHA', suwarno.nip);
// Di rekap manual, ABSEN MASUK 2026-09-07 kosong padahal CEPAT TELAT -225
// (artinya masuk 11:45). Manual tetap menghitung hari itu sebagai hari kerja
// (hari masuk 19), jadi jam masuknya diisi di sini sesuai maksud kolom tersebut.
const hari7 = suwR.filter(x => x.tanggal && x.tanggal.d === 7)[0];
hari7.masuk = 11 * 60 + 45;
const suwH = T.prosesSatuOrang(suwarno, suwR);
sama('hariMasuk', suwH.hariMasuk, 19);
sama('libur dinas luar', suwH.liburList.length, 3);
sama('telat 225 menit -> 1.5%', suwH.pct.tl, 1.5);
sama('TL Rp68.265', suwH.rupiahPotongan.tl, 68265);
sama('tukin bersih', suwH.tukinBersih, 4482735);
sama('uang makan bruto', suwH.uangMakan.bruto, 779000);
sama('PPH 15% = 116.850', suwH.uangMakan.pph, 116850);
sama('uang makan bersih', suwH.uangMakan.bersih, 662150);

console.log('== Berkas PNS terpisah dari PPPK ==');
const wbPns = T.susunWorkbookBidang([sH, bH], 2026, 9);
sama('nama file tukin PNS', wbPns.fileTukin, 'Rekapitulasi Tukin Bimas KRISTEN PNS SEPT.xlsx');
sama('nama file um PNS', wbPns.fileUangMakan, 'Rekapitulasi Uang Makan Bimas KRISTEN PNS SEPT.xlsx');
sama('nama file kehadiran PNS', wbPns.fileKehadiran, 'Rekapitulasi Kehadiran Bimas KRISTEN PNS SEPT.xlsx');
sama('sheet tukin PNS', wbPns.wbTukin.SheetNames, ['TUKIN PNS']);
sama('status di berkas', wbPns.status, 'PNS');
const isiPns = XLSX.utils.sheet_to_json(wbPns.wbTukin.Sheets['TUKIN PNS'], { header: 1, defval: '' });
sama('judul tukin PNS', isiPns[0][0], 'REKAPITULASI TUKIN PNS BIMAS KRISTEN');
sama('status pegawai di baris tukin', isiPns[3][30], 'PNS');
sama('tukin IV/b di baris', isiPns[3][8], ' Rp4,551,000 ');
sama('tukin III/b di baris', isiPns[4][8], ' Rp2,928,000 ');
const isiUm = XLSX.utils.sheet_to_json(wbPns.wbUangMakan.Sheets['UANG MAKAN'], { header: 1, defval: '' });
sama('PPH baris SAMAREL', isiUm[3][8], ' Rp104,550 ');
sama('PPH baris BASTANTA', isiUm[4][8], ' Rp40,700 ');
sama('catatan pajak 15%', isiUm[isiUm.length - 1][2], '15%');
sama('sheet kehadiran pakai kata nama (bukan "DR")', wbPns.wbKehadiran.SheetNames, ['DATA PENYULUH', 'SAMAREL', 'BASTANTA']);
const isiHadir = XLSX.utils.sheet_to_json(wbPns.wbKehadiran.Sheets['SAMAREL'], { header: 1, defval: '' });
sama('judul kehadiran PNS', isiHadir[0][0], 'REKAPITULASI KEHADIRAN BIMAS KRISTEN PNS');
sama('status di kehadiran', isiHadir[2][16], 'PNS');
// PPPK tetap seperti dulu (tanpa akhiran status, PPH 5%)
sama('PPPK tetap tanpa akhiran', wb.fileTukin, 'Rekapitulasi Tukin Bimas KRISTEN SEPT.xlsx');
const isiUmPppk = XLSX.utils.sheet_to_json(wb.wbUangMakan.Sheets['UANG MAKAN'], { header: 1, defval: '' });
sama('PPPK catatan pajak tetap 5%', isiUmPppk[isiUmPppk.length - 1][2], '5%');
simpan(wbPns.wbTukin, 'tukin-pns-kr-test.xlsx');
simpan(wbPns.wbUangMakan, 'um-pns-kr-test.xlsx');
simpan(wbPns.wbKehadiran, 'kehadiran-pns-kr-test.xlsx');

console.log(gagal ? ('\n*** ' + gagal + ' UJI GAGAL ***') : '\nSemua uji LULUS ✔');
process.exit(gagal ? 1 : 0);
