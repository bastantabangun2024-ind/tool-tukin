/*
 * Extract dan periksa isi file XLSX (ZIP) untuk melihat strukturnya
 */
const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

const filePath = path.join(__dirname, 'BIMAS KRISTEN PPPK', 'DAVID_Presensi 10-2026.xlsx');
console.log('=== Membaca file XLSX sebagai ZIP ===\n');
console.log('File:', filePath);

const buf = fs.readFileSync(filePath);

JSZip.loadAsync(buf).then(zip => {
  console.log('\nIsi ZIP (daftar file di dalam XLSX):');
  console.log('');

  Object.keys(zip.files).forEach(name => {
    const file = zip.files[name];
    const size = file._data ? file._data._byteLength || file._data.length : '?';
    console.log('  ' + name + ' (' + (typeof size === 'number' ? size + ' bytes' : size) + ')');
  });
  console.log('');

  // Coba baca file [Content_Types].xml
  const contentTypes = zip.files['[Content_Types].xml'];
  if (contentTypes) {
    contentTypes.async('string').then(str => {
      console.log('=== [Content_Types].xml ===');
      console.log(str.substring(0, 500) + (str.length > 500 ? '...' : ''));
      console.log('');

      // Cek workbook.xml untuk melihat sheet names
      const workbook = zip.files['xl/workbook.xml'];
      if (workbook) {
        workbook.async('string').then(str => {
          console.log('=== xl/workbook.xml (daftar sheet) ===');
          console.log(str);
          console.log('');

          // Jika ada sheet, coba baca isinya
          const sheet1Path = 'xl/worksheets/sheet1.xml';
          const sheet1 = zip.files[sheet1Path];
          if (sheet1) {
            sheet1.async('string').then(sheetContent => {
              console.log('=== ' + sheet1Path + ' (isi sheet) ===');
              console.log(sheetContent.substring(0, 3000) + (sheetContent.length > 3000 ? '...' : ''));
              console.log('');

              // Cek apakah ada nilai di dalam sel
              console.log('=== Mencari elemen data dalam sheet ===');
              const rowMatches = sheetContent.match(/<row[^>]*>/gi);
              console.log('Jumlah <row>:', rowMatches ? rowMatches.length : 0);

              const cellMatches = sheetContent.match(/<c[ >]/gi);
              console.log('Jumlah <c> (cell):', cellMatches ? cellMatches.length : 0);

              // Cari apakah ada nilai di dalam sel
              const valueMatches = sheetContent.match(/<v>[^<]*<\/v>/g);
              if (valueMatches) {
                console.log('Jumlah nilai <v>:', valueMatches.length);
                console.log('Contoh nilai:');
                valueMatches.slice(0, 20).forEach(v => console.log('  ' + v));
              } else {
                console.log('TIDAK ADA nilai <v> dalam sheet!');
                console.log('Artinya: Sheet kosong atau hanya berisi formatting, tidak ada data.');
              }
            });
          } else {
            console.log('Tidak ada sheet1.xml di dalam file!');
          }
        });
      } else {
        console.log('Tidak ada xl/workbook.xml di dalam file!');
      }
    });
  } else {
    console.log('Tidak ada [Content_Types].xml - ini bukan file XLSX yang valid!');
  }
}).catch(err => {
  console.error('Error:', err.message);
});
