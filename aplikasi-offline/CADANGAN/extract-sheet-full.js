/*
 * Extract sheet1 lengkap dari Presensi 10-2026.xlsx
 */
const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

const filePath = path.join(__dirname, 'Presensi 10-2026.xlsx');

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
    
    console.log('=== Sheet Content (sheet1.xml) ===\n');
    console.log(sheetContent);
    console.log('');
    
    // Lihat dimensi sheet
    const dimMatch = sheetContent.match(/<dimension ref="([^"]+)"/);
    if (dimMatch) {
      console.log('Dimensi sheet:', dimMatch[1]);
    }
    console.log('');
    
    // Parse setiap baris dalam sheet
    console.log('=== Baris-baris dalam sheet ===\n');
    
    const rowRegex = /<row r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g;
    let match;
    let rowCount = 0;
    
    while ((match = rowRegex.exec(sheetContent)) !== null) {
      const rowNum = parseInt(match[1], 10);
      const rowContent = match[2];
      rowCount++;
      
      console.log('--- Baris ' + rowNum + ' ---');
      
      // Parse setiap sel dalam baris
      const cellRegex = /<c r="([A-Z]+\d+)"([^>]*)>(?:<v>([^<]*)<\/v>)?/g;
      let cellMatch;
      let firstCell = true;
      
      while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
        const cellRef = cellMatch[1];
        const cellAttrs = cellMatch[2];
        const cellValue = cellMatch[3] || '';
        
        let type = '';
        let tMatch = cellAttrs.match(/t="([^"]*)"/);
        if (tMatch) type = tMatch[1];
        
        let actualValue = cellValue;
        if (type === 's' && cellValue !== '') {
          const idx = parseInt(cellValue, 10);
          actualValue = idx >= 0 && idx < strings.length ? strings[idx] : '[ERROR: idx ' + idx + ']';
        }
        
        if (!firstCell) console.log(', ');
        console.log(cellRef + ' (' + type + '): ' + actualValue);
        firstCell = false;
      }
      
      console.log('');
    }
    
    console.log('Total baris:', rowCount);
    
    // Cetak shared strings untuk referensi
    console.log('');
    console.log('=== Daftar shared strings (indeks) ===\n');
    strings.forEach((s, i) => console.log(i + ': ' + s));
    
  });
}).catch(err => {
  console.error('Error:', err.message);
});
