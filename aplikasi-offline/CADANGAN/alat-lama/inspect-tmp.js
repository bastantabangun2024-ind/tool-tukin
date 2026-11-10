const xlsx = require('C:/Users/HP/karo/node_modules/xlsx');
const fs = require('fs');

const files = process.argv.slice(2);
for (const f of files) {
  console.log('\n==================================================');
  console.log('FILE:', f.replace(/^.*tool-tukin\//, 'tool-tukin/'), /\.(xlsm|xls)$/i.test(f) ? '' : '');
  const wb = xlsx.readFile(f, { cellDates: false });
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    const range = ws['!ref'] || '(kosong)';
    console.log(`\n--- Sheet: "${name}"  range=${range}`);
    const rows = xlsx.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });
    const maxRows = Math.min(rows.length, 30);
    for (let i = 0; i < maxRows; i++) {
      const r = rows[i];
      // tampilkan maksimal 12 kolom pertama agar terbaca
      const shown = r.slice(0, 12).map(v => String(v).slice(0, 24));
      if (shown.some(v => v !== '')) {
        console.log(String(i).padStart(2), '|', shown.join(' | '));
      }
    }
    if (rows.length > maxRows) console.log(`... (${rows.length} baris total)`);
  }
}
