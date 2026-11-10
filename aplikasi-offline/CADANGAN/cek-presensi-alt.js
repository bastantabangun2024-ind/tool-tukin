/*
 * Cek file presensi DAVID - pendekatan berbeda
 */
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'BIMAS KRISTEN PPPK', 'DAVID_Presensi 10-2026.xlsx');
console.log('=== Membaca file sebagai binary ===\n');
console.log('File:', filePath);

try {
  const buf = fs.readFileSync(filePath);
  console.log('Ukuran file:', buf.length, 'bytes');
  console.log('');

  // Cek apakah file tersebut adalah ZIP (xlsx adalah zip)
  const signature = buf.slice(0, 2);
  console.log('Signature (2 bytes pertama):', signature[0].toString(16), signature[1].toString(16));
  console.log('Apakah ZIP (PK)?', signature[0] === 0x50 && signature[1] === 0x4B ? 'YA' : 'TIDAK');
  console.log('');

  // Coba baca sebagai string (untuk pemeriksaan dasar)
  console.log('=== Mencari teks "TANGGAL" dan "2026-10-20" dalam file ===\n');
  
  // Konversi ke string (bukan binary, untuk pencarian teks)
  let text = '';
  for (let i = 0; i < Math.min(buf.length, 50000); i++) {
    text += String.fromCharCode(buf[i]);
  }
  
  // Cari "TANGGAL" (case insensitive)
  const tanggalIdx = text.toUpperCase().indexOf('TANGGAL');
  console.log('Posisi "TANGGAL" dalam file:', tanggalIdx >= 0 ? tanggalIdx : 'TIDAK DITEMUKAN');
  
  // Cari "2026-10-20" atau "2026-10-21"
  const oct20Idx = text.indexOf('2026-10-20');
  const oct21Idx = text.indexOf('2026-10-21');
  console.log('Posisi "2026-10-20":', oct20Idx >= 0 ? oct20Idx : 'TIDAK DITEMUKAN');
  console.log('Posisi "2026-10-21":', oct21Idx >= 0 ? oct21Idx : 'TIDAK DITEMUKAN');
  console.log('');

  // Cek juga format tanggal lain yang mungkin
  const datePatterns = [
    '2026/10/20', '2026/10/21',
    '20/10/2026', '21/10/2026',
    '20-Oct', '21-Oct',
    'Oktober 20', 'Oktober 21',
    '10/20/2026', '10/21/2026',
    '10.20.2026', '10.21.2026'
  ];
  
  console.log('Pencarian pola tanggal lain:');
  datePatterns.forEach(p => {
    const idx = text.indexOf(p);
    console.log('  "' + p + '":', idx >= 0 ? idx : 'TIDAK DITEMUKAN');
  });
  console.log('');

  // Cek kehadiran kata "MASUK"
  const jamMasukIdx = text.toUpperCase().indexOf('JAM MASUK');
  console.log('Posisi "JAM MASUK":', jamMasukIdx >= 0 ? jamMasukIdx : 'TIDAK DITEMUKAN');

  const masukIdx = text.toUpperCase().indexOf('MASUK');
  console.log('Posisi "MASUK" (umum):', masukIdx >= 0 ? masukIdx : 'TIDAK DITEMUKAN');
  console.log('');

  // Tampilkan beberapa karakter di sekitar posisi "2026-10-20" jika ditemukan
  if (oct20Idx >= 0) {
    const start = Math.max(0, oct20Idx - 50);
    const end = Math.min(text.length, oct20Idx + 100);
    console.log('Konteks di sekitar "2026-10-20":');
    console.log('  ...' + text.slice(start, end) + '...');
    console.log('');
  }
  
  if (oct21Idx >= 0) {
    const start = Math.max(0, oct21Idx - 50);
    const end = Math.min(text.length, oct21Idx + 100);
    console.log('Konteks di sekitar "2026-10-21":');
    console.log('  ...' + text.slice(start, end) + '...');
    console.log('');
  }

  console.log('=== KESIMPULAN ===\n');
  if (tanggalIdx < 0) {
    console.log('MASALAH: Kata "TANGGAL" tidak ditemukan dalam file.');
    console.log('Artinya: File ini TIDAK MEMILIKI header standar yang diharapkan aplikasi.');
    console.log('Kemungkinan:');
    console.log('  1. File memiliki struktur kolom yang berbeda');
    console.log('  2. File kosong / tidak berisi data kehadiran');
    console.log('  3. File bukan file presensi yang valid');
  } else if (oct20Idx < 0 && oct21Idx < 0) {
    console.log('MASALAH: Tanggal 20-21 Oktober 2026 tidak ditemukan dalam file.');
    console.log('Artinya: File mungkin tidak berisi data untuk kedua tanggal tersebut.');
    console.log('Atau format tanggal berbeda (mis. "20/10/2026" atau "20-Oct-2026").');
  } else {
    console.log('Data tanggal 20-21 Oktober 2026 DITEMUKAN dalam file.');
    console.log('Namun perlu diperiksa apakah JAM MASUK untuk kedua tanggal kosong.');
  }

} catch (e) {
  console.error('Error:', e.message);
}
