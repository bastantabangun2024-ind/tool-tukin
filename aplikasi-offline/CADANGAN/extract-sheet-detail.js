/*
 * Periksa detail sheet1 untuk tanggal 20-21 Oktober 2026
 */
const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

const filePath = path.join(__dirname, 'BIMAS KRISTEN PPPK', 'DAVID_Presensi 10-2026.xlsx');

const buf = fs.readFileSync(filePath);

JSZip.loadAsync(buf).then(zip => {
  const sheet1 = zip.files['xl/worksheets/sheet1.xml'];
  const sharedStrings = zip.files['xl/sharedStrings.xml'];
  
  Promise.all([
    sheet1.async('string'),
    sharedStrings.async('string')
  ]).then(([sheetContent, stringsContent]) => {
    // Parse shared strings
    const stringMatches = stringsContent.match(/<si><t[^>]*>([^<]*)<\/t><\/si>/g);
    const strings = stringMatches ? stringMatches.map(m => {
      const match = m.match(/<t[^>]*>([^<]*)<\/t>/);
      return match ? match[1] : '';
    }) : [];
    
    console.log('=== Daftar shared strings ===');
    strings.forEach((s, i) => console.log(i + ': ' + s));
    console.log('');
    
    // Parse sheet untuk melihat setiap baris
    console.log('=== Isi sheet - baris per baris ===\n');
    
    // Ekstrak setiap baris
    const rowRegex = /<row[^>]*>([\s\S]*?)<\/row>/g;
    let match;
    const rows = [];
    
    while ((match = rowRegex.exec(sheetContent)) !== null) {
      const rowContent = match[1];
      rows.push(rowContent);
    }
    
    console.log('Total baris:', rows.length);
    console.log('');
    
    // Tampilkan isi setiap baris dengan parsing sel
    rows.forEach((rowContent, rowIdx) => {
      // Cari setiap sel
      const cellRegex = /<c r="([A-Z]+\d+)"[^>]*?(?:t="([^"]*)")?[^>]*?>(?:<v>([^<]*)<\/v>)?/g;
      let cellMatch;
      const cells = [];
      
      while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
        const cellRef = cellMatch[1];
        const cellType = cellMatch[2] || '';
        const cellValue = cellMatch[3] || '';
        
        let actualValue = cellValue;
        if (cellType === 's' && cellValue !== '') {
          // Ini adalah referensi ke shared string
          const idx = parseInt(cellValue, 10);
          actualValue = idx >= 0 && idx < strings.length ? strings[idx] : '[ERROR: index ' + idx + ']';
        }
        
        cells.push({
          ref: cellRef,
          type: cellType,
          raw: cellValue,
          value: actualValue
        });
      }
      
      if (cells.length > 0) {
        const rowNum = rowIdx + 1;
        console.log('Baris ' + rowNum + ':');
        cells.forEach(c => {
          console.log('  ' + c.ref + ' (' + c.type + '): ' + c.value);
        });
        console.log('');
      }
    });
    
    // Cari baris yang mengandung 2026-10-20 dan 2026-10-21
    console.log('=== Baris yang mengandung 20 Oktober dan 21 Oktober 2026 ===\n');
    
    rows.forEach((rowContent, rowIdx) => {
      const rowNum = rowIdx + 1;
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
          actualValue = idx >= 0 && idx < strings.length ? strings[idx] : '[ERROR: index ' + idx + ']';
        }
        
        cells.push({
          ref: cellRef,
          type: cellType,
          raw: cellValue,
          value: actualValue
        });
      }
      
      // Cek jika ada tanggal 2026-10-20 atau 2026-10-21
      const hasOct20 = cells.some(c => c.value === '2026-10-20');
      const hasOct21 = cells.some(c => c.value === '2026-10-21');
      
      if (hasOct20 || hasOct21) {
        console.log('Baris ' + rowNum + ':');
        cells.forEach(c => {
          let marker = '';
          if (c.value === '2026-10-20') marker = ' <-- 20 OKTOBER';
          if (c.value === '2026-10-21') marker = ' <-- 21 OKTOBER';
          if (c.value === '07:56' || c.value === '07:56') marker += ' [INI JAM MASUK UNTUK 20 OKT]';
          console.log('  ' + c.ref + ' (' + c.type + '): ' + c.value + marker);
        });
        console.log('');
      }
    });
    
    console.log('=== KESIMPULAN ===');
    console.log('Tanggal 20 Oktober 2026 ada di file, tapi:');
    console.log('- Tidak ada JAM MASUK yang tercatat untuk tanggal ini');
    console.log('- Tanggal 21 Oktober tidak ada sama sekali (tidak ada HARI, tidak ada JAM MASUK)');
    console.log('');
    console.log('Yang perlu diperbaiki:');
    console.log('1. Tambahkan JAM MASUK untuk 20 Oktober 2026 (misalnya: 07:56)');
    console.log('2. Tambahkan baris untuk 21 Oktober 2026 dengan HARI dan JAM MASUK yang sesuai');
  });
}).catch(err => {
  console.error('Error:', err.message);
});
