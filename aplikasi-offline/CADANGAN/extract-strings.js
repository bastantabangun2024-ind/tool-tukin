/*
 * Extract shared strings dari file XLSX DAVID
 */
const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

const filePath = path.join(__dirname, 'BIMAS KRISTEN PPPK', 'DAVID_Presensi 10-2026.xlsx');
console.log('=== Membaca sharedStrings.xml dari file DAVID ===\n');
console.log('File:', filePath);

const buf = fs.readFileSync(filePath);

JSZip.loadAsync(buf).then(zip => {
  const sharedStrings = zip.files['xl/sharedStrings.xml'];
  if (!sharedStrings) {
    console.log('TIDAK ADA sharedStrings.xml - mungkin data langsung di dalam sheet');
    return;
  }
  
  sharedStrings.async('string').then(str => {
    console.log('=== Isi sharedStrings.xml ===\n');
    console.log(str);
    console.log('');
    
    // Parse string untuk mendapatkan teks
    const stringMatches = str.match(/<t[^>]*>([^<]*)<\/t>/g);
    if (stringMatches) {
      console.log('=== Daftar teks yang tersimpan ===\n');
      stringMatches.forEach((match, idx) => {
        const text = match.replace(/<[^>]*>/g, '');
        console.log(idx + ': ' + text);
      });
    }
  });
}).catch(err => {
  console.error('Error:', err.message);
});
