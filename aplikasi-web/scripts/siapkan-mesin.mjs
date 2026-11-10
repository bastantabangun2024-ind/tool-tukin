// siapkan-mesin.mjs — menyalin mesin hitung offline ke public/lib.
//
// Kenapa: di Vercel, Root Directory = aplikasi-web sehingga folder
// ../aplikasi-offline tidak ikut terunggah. Salinan di public/lib dipakai
// bersama oleh browser (/lib/app.js) dan oleh fungsi serverless.
//
// Jalankan setiap kali berkas di aplikasi-offline/APLIKASI berubah:
//   node scripts/siapkan-mesin.mjs
//
// Aman dijalankan di Vercel: kalau folder offline tidak ada, skrip berhenti
// tanpa mengubah apa pun (salinan yang sudah di-commit tetap dipakai).

import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const AKAR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OFFLINE = resolve(AKAR, '..', 'aplikasi-offline');
const TUJUAN = join(AKAR, 'public', 'lib');

const SUMBER = [
  { dari: join(OFFLINE, 'APLIKASI', 'app.js'), ke: 'app.js' },
  { dari: join(OFFLINE, 'APLIKASI', 'lib', 'xlsx.full.min.js'), ke: 'xlsx.full.min.js' },
  { dari: join(OFFLINE, 'APLIKASI', 'pegawai.js'), ke: 'pegawai.js' },
  { dari: join(OFFLINE, 'AMBIL-DARI-DRIVE', 'alat-drive.js'), ke: 'alat-drive.js' },
];

const adaSumber = existsSync(join(OFFLINE, 'APLIKASI', 'app.js'));
if (!adaSumber) {
  console.log('Folder aplikasi-offline tidak ada (mis. saat build Vercel) — salinan public/lib dipakai apa adanya.');
  process.exit(0);
}

await mkdir(TUJUAN, { recursive: true });

for (const b of SUMBER) {
  if (!existsSync(b.dari)) {
    console.warn(`Lewati ${b.ke}: sumber tidak ditemukan (${b.dari})`);
    continue;
  }
  if (b.ke === 'alat-drive.js') {
    // Di folder aslinya alat-drive.js memanggil require('../APLIKASI/app.js');
    // di public/lib posisinya sejajar app.js.
    const isi = await readFile(b.dari, 'utf8');
    const hasil = isi.replace(/require\((['"])\.\.\/APLIKASI\/app\.js\1\)/, "require('./app.js')");
    if (hasil === isi) console.warn('Peringatan: pola require app.js di alat-drive.js tidak ditemukan, salinan apa adanya.');
    await writeFile(join(TUJUAN, b.ke), hasil);
  } else {
    await copyFile(b.dari, join(TUJUAN, b.ke));
  }
  console.log(`Disalin: ${b.ke}`);
}

await writeFile(
  join(TUJUAN, 'README.md'),
  [
    '# Salinan mesin hitung',
    '',
    'Folder ini **dibuat otomatis** oleh `node scripts/siapkan-mesin.mjs` — jangan diedit manual.',
    '',
    'Sumber sebenarnya: `aplikasi-offline/APLIKASI/{app.js,pegawai.js,lib/xlsx.full.min.js}` dan',
    '`aplikasi-offline/AMBIL-DARI-DRIVE/alat-drive.js`.',
    '',
    'Di komputer lokal server memakai berkas asli tersebut; di Vercel dipakai salinan ini',
    'karena folder `aplikasi-offline` tidak ikut terunggah.',
    '',
  ].join('\n'),
);

console.log(`Selesai. Salinan di ${TUJUAN}`);
