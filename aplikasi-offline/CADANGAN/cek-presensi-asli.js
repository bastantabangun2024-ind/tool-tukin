/*
 * Cek file presensi asli: Presensi 10-2026.xlsx
 */
const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

const filePath = path.join(__dirname, 'Presensi 10-2026.xlsx');
console.log('=== Membaca file presensi asli ===\n');
console.log('File:', filePath);

const buf = fs.readFileSync(filePath);

JSZip.loadAsync(buf).then(zip => {
  const sharedStrings = zip.files['xl/sharedStrings.xml'];
  const sheet1 = zip.files['xl/worksheets/sheet1.xml'];
  
  Promise.all([
    sharedStrings.async('string'),
    sheet1.async('string')
  ]).then(([stringsContent, sheetContent]) => {
    // Parse shared strings
    const stringMatches = stringsContent.match(/<si><t[^>]*>([^<]*)<\/t><\/si>/g);
    const strings = stringMatches ? stringMatches.map(m => {
      const match = m.match(/<t[^>]*>([^<]*)<\/t>/);
      return match ? match[1] : '';
    }) : [];
    
    console.log('=== Daftar shared strings ===\n');
    strings.forEach((s, i) => console.log(i + ': ' + s));
    console.log('');
    
    // Cari tanggal 2026-10-20 dan 2026-10-21 beserta JAM MASUKnya
    console.log('=== Pencarian tanggal 20-21 Oktober 2026 ===\n');
    
    const oct20Idx = strings.indexOf('2026-10-20');
    const oct21Idx = strings.indexOf('2026-10-21');
    
    console.log('Index "2026-10-20":', oct20Idx);
    console.log('Index "2026-10-21":', oct21Idx);
    console.log('');
    
    // Cek apakah ada nilai di sekitar index tersebut
    if (oct20Idx >= 0) {
      console.log('Konteks sekitar 20 Oktober 2026:');
      for (let i = Math.max(0, oct20Idx - 3); i <= Math.min(strings.length - 1, oct20Idx + 5); i++) {
        console.log('  ' + i + ': ' + strings[i]);
      }
      console.log('');
    }
    
    if (oct21Idx >= 0) {
      console.log('Konteks sekitar 21 Oktober 2026:');
      for (let i = Math.max(0, oct21Idx - 3); i <= Math.min(strings.length - 1, oct21Idx + 5); i++) {
        console.log('  ' + i + ': ' + strings[i]);
      }
      console.log('');
    }
    
    // Parse sheet untuk melihat baris yang mengandung tanggal 20-21 Oktober
    console.log('=== Baris dalam sheet yang mengandung 20-21 Oktober ===\n');
    
    const rowRegex = /<row[^>]*>([\s\S]*?)<\/row>/g;
    let match;
    const rows = [];
    
    while ((match = rowRegex.exec(sheetContent)) !== null) {
      rows.push(match[1]);
    }
    
    // Fungsi untuk parse sel dalam baris
    function parseRow(rowContent) {
      const cells = [];
      const cellRegex = /<c r="([A-Z]+\d+)"[^>]*?(?:t="([^"]*)")?[^>]*?>(?:<v>([^<]*)<\/v>)?/g;
      let cellMatch;
      
      while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
        const cellRef = cellMatch[1];
        const cellType = cellMatch[2] || '';
        const cellValue = cellMatch[3] || '';
        
        let actualValue = cellValue;
        if (cellType === 's' && cellValue !== '') {
          const idx = parseInt(cellValue, 10);
          actualValue = idx >= 0 && idx < strings.length ? strings[idx] : '[ERROR: idx ' + idx + ']';
        }
        
        cells.push({ ref: cellRef, type: cellType, value: actualValue });
      }
      return cells;
    }
    
    // Tampilkan baris yang mengandung tanggal 2026-10-20 atau 2026-10-21
    rows.forEach((rowContent, rowIdx) => {
      const cells = parseRow(rowContent);
      
      // Cek apakah ada tanggal 20 atau 21 Oktober
      const hasOct20 = cells.some(c => c.value === '2026-10-20');
      const hasOct21 = cells.some(c => c.value === '2026-10-21');
      
      if (hasOct20 || hasOct21) {
        console.log('Baris ' + (rowIdx + 1) + ':');
        cells.forEach(c => {
          let note = '';
          if (c.value === '2026-10-20') note = ' <-- TANGGAL 20 OKT';
          if (c.value === '2026-10-21') note = ' <-- TANGGAL 21 OKT';
          console.log('  ' + c.ref + ': ' + c.value + note);
        });
        console.log('');
      }
    });
    
    // Cek apakah aplikasi bisa membaca file ini dengan benar menggunakan logika app.js
    console.log('=== Simulasi pemrosesan aplikasi (app.js) ===\n');
    
    // Cari baris yang mengandung 20 dan 21 Oktober
    const baris20 = [];
    const baris21 = [];
    
    rows.forEach((rowContent, rowIdx) => {
      const cells = parseRow(rowContent);
      const tanggalIdx = cells.findIndex(c => c.value === '2026-10-20' || c.value === '2026-10-21');
      
      if (tanggalIdx >= 0) {
        const tanggal = cells[tanggalIdx].value;
        const hari = cells.find(c => c.ref.startsWith('B'))?.value || '';
        const jamMasuk = cells.find(c => c.ref.startsWith('C'))?.value || null;
        const jamPulang = cells.find(c => c.ref.startsWith('D'))?.value || null;
        
        if (tanggal === '2026-10-20') {
          baris20.push({ tanggal, hari, jamMasuk, jamPulang });
        } else if (tanggal === '2026-10-21') {
          baris21.push({ tanggal, hari, jamMasuk, jamPulang });
        }
      }
    });
    
    console.log('Data tanggal 20 Oktober 2026:');
    if (baris20.length > 0) {
      baris20.forEach(b => {
        console.log('  Tanggal:', b.tanggal);
        console.log('  Hari:', b.hari);
        console.log('  JAM MASUK:', b.jamMasuk || '(KOSONG)');
        console.log('  JAM PULANG:', b.jamPulang || '(KOSONG)');
        console.log('');
      });
    } else {
      console.log('  TIDAK DITEMUKAN');
      console.log('');
    }
    
    console.log('Data tanggal 21 Oktober 2026:');
    if (baris21.length > 0) {
      baris21.forEach(b => {
        console.log('  Tanggal:', b.tanggal);
        console.log('  Hari:', b.hari);
        console.log('  JAM MASUK:', b.jamMasuk || '(KOSONG)');
        console.log('  JAM PULANG:', b.jamPulang || '(KOSONG)');
        console.log('');
      });
    } else {
      console.log('  TIDAK DITEMUKAN');
      console.log('');
    }
    
    // Kesimpulan
    console.log('=== KESIMPULAN ===\n');
    
    if (baris20.length === 0) {
      console.log('TIDAK ADA data tanggal 20 Oktober 2026 dalam file ini!');
    } else if (!baris20[0].jamMasuk) {
      console.log('Data 20 Oktober ada, tapi JAM MASUK KOSONG - INI PENYEBAB MASALAH');
    } else {
      console.log('Data 20 Oktober ada dengan JAM MASUK:', baris20[0].jamMasuk);
    }
    
    if (baris21.length === 0) {
      console.log('TIDAK ADA data tanggal 21 Oktober 2026 dalam file ini!');
    } else if (!baris21[0].jamMasuk) {
      console.log('Data 21 Oktober ada, tapi JAM MASUK KOSONG - INI PENYEBAB MASALAH');
    } else {
      console.log('Data 21 Oktober ada dengan JAM MASUK:', baris21[0].jamMasuk);
    }
    
  });
}).catch(err => {
  console.error('Error:', err.message);
});
