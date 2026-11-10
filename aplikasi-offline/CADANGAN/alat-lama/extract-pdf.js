const fs = require('fs');
const { PDFParse } = require('pdf-parse');
const buf = fs.readFileSync('C:/Users/HP/tool-tukin/CADANGAN/PMA_NOMOR_11_TAHUN_2019.pdf');
(async () => {
  const parser = new PDFParse({ data: new Uint8Array(buf) });
  const result = await parser.getText();
  console.log('Jumlah halaman:', result.pages?.length || result.numpages || '?');
  console.log('===== TEKS =====');
  console.log(result.text);
  await parser.destroy();
})().catch(e => { console.error('GAGAL:', e.message); process.exit(1); });
