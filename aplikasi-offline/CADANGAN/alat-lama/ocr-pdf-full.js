// OCR seluruh halaman PDF scan PMA 11/2019:
// 1) render tiap halaman ke PNG (pdfjs-dist + @napi-rs/canvas)
// 2) OCR tiap PNG (tesseract.js, bahasa indonesia)
// Hasil digabung ke pma-ocr-full.txt
const fs = require('fs');
const path = require('path');
const { createCanvas } = require('@napi-rs/canvas');
const { createWorker } = require('tesseract.js');

const PDF_PATH = 'C:/Users/HP/tool-tukin/CADANGAN/PMA_NOMOR_11_TAHUN_2019.pdf';
const OUT_DIR = 'C:/Users/HP/tool-tukin/CADANGAN/halaman-ocr';
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

(async () => {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const data = new Uint8Array(fs.readFileSync(PDF_PATH));
  const doc = await pdfjs.getDocument({ data }).promise;
  console.log('Halaman:', doc.numPages);

  // 1) render semua halaman
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const scale = 2.0;
    const viewport = page.getViewport({ scale });
    const canvas = createCanvas(viewport.width, viewport.height);
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;
    const pngPath = path.join(OUT_DIR, `hal-${String(i).padStart(2, '0')}.png`);
    fs.writeFileSync(pngPath, canvas.toBuffer('image/png'));
    console.log('render ok:', pngPath);
  }

  // 2) OCR semua PNG
  const worker = await createWorker('ind');
  const out = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const pngPath = path.join(OUT_DIR, `hal-${String(i).padStart(2, '0')}.png`);
    const { data: d } = await worker.recognize(pngPath);
    out.push(`\n===== HALAMAN ${i} =====\n` + d.text);
    console.log('ocr ok:', pngPath);
  }
  await worker.terminate();
  fs.writeFileSync('C:/Users/HP/tool-tukin/CADANGAN/pma-ocr-full.txt', out.join('\n'));
  console.log('SELESAI → pma-ocr-full.txt');
})().catch(e => { console.error('GAGAL:', e.message); process.exit(1); });
