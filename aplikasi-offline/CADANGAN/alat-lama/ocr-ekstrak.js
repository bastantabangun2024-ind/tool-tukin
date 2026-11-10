const { createWorker } = require('tesseract.js');

(async () => {
  const file = process.argv[2] || 'C:/Users/HP/tool-tukin/CADANGAN/pma 11 tahun 2019.jpeg';
  const worker = await createWorker('ind');
  const { data } = await worker.recognize(file);
  console.log('===== HASIL OCR: ' + file + ' =====');
  console.log(data.text);
  await worker.terminate();
})().catch(e => { console.error('GAGAL:', e.message); process.exit(1); });
