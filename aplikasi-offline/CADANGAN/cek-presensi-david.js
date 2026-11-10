/*
 * Cek isi file presensi DAVID_Presensi 10-2026.xlsx
 */
global.window = global;
global.XLSX = require('../APLIKASI/lib/xlsx.full.min.js');
const T = require('../APLIKASI/app.js');

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'BIMAS KRISTEN PPPK', 'DAVID_Presensi 10-2026.xlsx');
console.log('=== Membaca file:', filePath);
console.log('File ada?', fs.existsSync(filePath));

if (!fs.existsSync(filePath)) {
  console.log('File tidak ditemukan!');
  process.exit(1);
}

console.log('\n=== 1. Membaca sheet pertama ===\n');
const wb = XLSX.readFile(filePath);
console.log('Nama sheet:', wb.SheetNames[0]);
const sheet = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

console.log('Jumlah baris (termasuk header):', rows.length);
console.log('');

console.log('=== 2. Mencari header TANGGAL/JAM MASUK ===\n');
let hIdx = -1;
for (let i = 0; i < Math.min(rows.length, 10); i++) {
  const r0 = (rows[i] || []).map(c => String(c == null ? '' : c).toUpperCase());
  console.log('Baris ' + (i+1) + ':', r0.filter(x => x).join(' | '));
  if (r0.indexOf('TANGGAL') >= 0 && r0.indexOf('JAM MASUK') >= 0) {
    hIdx = i;
    console.log('>>> HEADER DITEMUKAN di baris ' + (i+1));
    break;
  }
}
console.log('');

if (hIdx < 0) {
  console.log('ERROR: Header TANGGAL/JAM MASUK tidak ditemukan!');
  console.log('Ini kemungkinan besar penyebab masalah.');
  console.log('File mungkin memiliki struktur kolom yang berbeda.');
  process.exit(1);
}

console.log('=== 3. Data per tanggal ===\n');
const H = { tanggal: 0, hari: 1, masuk: 2, pulang: 3, alasan: 4, deskripsi: 5 };

console.log('Header kolom:');
console.log('  [0] TANGGAL, [1] HARI, [2] JAM MASUK, [3] JAM PULANG, [4] ALASAN, [5] DESKRIPSI');
console.log('');

console.log(' semua baris data (setelah header):');
for (let j = hIdx + 1; j < rows.length; j++) {
  const r = rows[j] || [];
  const t = T.parseTanggal(r[H.tanggal]);
  if (!t) {
    console.log('  Baris ' + (j+1) + ': TIDAK VALID (tanggal tidak bisa di-parse)');
    console.log('    Isi:', r.filter(x => x !== null && x !== undefined).join(' | '));
    continue;
  }
  
  const masuk = T.parseTime(r[H.masuk]);
  const pulang = T.parseTime(r[H.pulang]);
  
  console.log('  Baris ' + (j+1) + ':');
  console.log('    Tanggal: ' + r[H.tanggal] + ' -> ' + (t ? t.y + '-' + t.mo + '-' + t.d : 'INVALID'));
  console.log('    Hari: ' + r[H.hari]);
  console.log('    JAM MASUK: "' + r[H.masuk] + '" -> ' + (masuk !== null ? masuk + ' menit ( ' + (masuk !== null ? Math.floor(masuk/60) + ':' + (masuk % 60) : '') + ' )' : 'NULL/EMPTY'));
  console.log('    JAM PULANG: "' + r[H.pulang] + '" -> ' + (pulang !== null ? pulang + ' menit' : 'NULL/EMPTY'));
  console.log('    ALASAN: "' + r[H.alasan] + '"');
  console.log('    DESKRIPSI: "' + r[H.deskripsi] + '"');
  console.log('');
}

console.log('=== 4. Cek khusus tanggal 20-21 Oktober 2026 ===\n');
const targetDates = ['2026-10-20', '2026-10-21', '2026-10-20 00:00:00', '2026-10-21 00:00:00'];
let found20 = false, found21 = false;

for (let j = hIdx + 1; j < rows.length; j++) {
  const r = rows[j] || [];
  const t = T.parseTanggal(r[H.tanggal]);
  if (!t) continue;
  
  const dateStr = t.y + '-' + String(t.mo).padStart(2, '0') + '-' + String(t.d).padStart(2, '0');
  
  if (dateStr === '2026-10-20') {
    found20 = true;
    console.log('  TANGGAL 20 OKTOBER 2026 DITEMUKAN:');
    console.log('    JAM MASUK: "' + r[H.masuk] + '" -> ' + (T.parseTime(r[H.masuk]) !== null ? 'VALID' : 'KOSONG/NULL'));
    console.log('    JAM PULANG: "' + r[H.pulang] + '" -> ' + (T.parseTime(r[H.pulang]) !== null ? 'VALID' : 'KOSONG/NULL'));
  }
  if (dateStr === '2026-10-21') {
    found21 = true;
    console.log('  TANGGAL 21 OKTOBER 2026 DITEMUKAN:');
    console.log('    JAM MASUK: "' + r[H.masuk] + '" -> ' + (T.parseTime(r[H.masuk]) !== null ? 'VALID' : 'KOSONG/NULL'));
    console.log('    JAM PULANG: "' + r[H.pulang] + '" -> ' + (T.parseTime(r[H.pulang]) !== null ? 'VALID' : 'KOSONG/NULL'));
  }
}

if (!found20) {
  console.log('  TANGGAL 20 OKTOBER 2026 TIDAK DITEMUKAN di file ini!');
}
if (!found21) {
  console.log('  TANGGAL 21 OKTOBER 2026 TIDAK DITEMUKAN di file ini!');
}
console.log('');

console.log('=== 5. Ringkasan Penyebab Kemungkinan ===\n');
if (!found20 || !found21) {
  console.log('Penyebab 1: Tanggal 20-21 tidak ada di file presensi');
  console.log('  -> File mungkin tidak lengkap (hanya berisi data sebelum 20 Oktober)');
}
if (found20 && found21) {
  console.log('Penyebab 2: Data tanggal ada tapi JAM MASUK kosong/null');
  console.log('  -> Aplikasi akan mengklasifikasikan sebagai "TIDAK REKAM PRESENSI MASUK"');
}
console.log('');
console.log('Penyebab 3: Format tanggal tidak sesuai');
console.log('  -> Aplikasi hanya mendukung format "2026-10-20" atau "2026-10-20 00:00:00"');
