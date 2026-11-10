// server.mjs — server lokal Tool Tukin.
// Tanpa dependency: hanya modul bawaan Node + mesin hitung offline (app.js).
//
// Jalankan: node server.mjs   ->  http://localhost:3000
//
// Seluruh isi handler ada di app.mjs (dipakai juga oleh fungsi Vercel
// lewat api/[...jalur].mjs), jadi perilaku lokal dan Vercel sama.

import { createServer } from 'node:http';
import { handler } from './app.mjs';
import { ASAL_MESIN } from './mesin.mjs';

const PORT = Number(process.env.PORT || 3000);

const server = createServer((req, res) => {
  handler(req, res).catch((e) => {
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    }
    res.end(JSON.stringify({ pesan: String((e && e.message) || e) }));
  });
});

server.listen(PORT, () => {
  const url = process.env.SUPABASE_URL || '(lihat .env.local)';
  console.log(`Tool Tukin jalan di http://localhost:${PORT}`);
  console.log(`Supabase: ${url} | mesin hitung: ${ASAL_MESIN}`);
  console.log('Hentikan dengan Ctrl+C.');
});
