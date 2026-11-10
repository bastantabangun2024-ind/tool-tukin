// mesin.mjs — memuat mesin hitung offline (app.js + alat-drive.js) dari SATU sumber.
//
// Lokal   : memakai berkas asli di ../aplikasi-offline/ (tidak ada salinan).
// Vercel  : folder aplikasi-offline tidak ikut terunggah, jadi dipakai salinan
//           di public/lib/ yang dibuat oleh: node scripts/siapkan-mesin.mjs
//
// Keduanya berasal dari berkas yang sama, jadi rumus tidak pernah berbeda.

import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const AKAR = dirname(fileURLToPath(import.meta.url)); // .../aplikasi-web

const ASLI_APP = resolve(AKAR, '..', 'aplikasi-offline', 'APLIKASI');
const ASLI_DRIVE = resolve(AKAR, '..', 'aplikasi-offline', 'AMBIL-DARI-DRIVE');
const SALINAN = join(AKAR, 'public', 'lib');

const pakaiAsli = existsSync(join(ASLI_APP, 'app.js'));
const folderApp = pakaiAsli ? ASLI_APP : SALINAN;
const folderDrive = pakaiAsli ? ASLI_DRIVE : SALINAN;

export const ASAL_MESIN = pakaiAsli ? 'aplikasi-offline (asli)' : 'public/lib (salinan)';

const require = createRequire(import.meta.url);

// app.js membaca berkas Excel lewat XLSX global (sama seperti di browser)
globalThis.XLSX = require(pakaiAsli ? join(folderApp, 'lib', 'xlsx.full.min.js') : join(SALINAN, 'xlsx.full.min.js'));

export const Tukin = require(join(folderApp, 'app.js'));
export const Drive = require(join(folderDrive, 'alat-drive.js'));

// Berkas mesin yang disajikan ke browser lewat /lib/*.
export const BERKAS_LIB = {
  '/lib/app.js': join(folderApp, 'app.js'),
  '/lib/xlsx.full.min.js': pakaiAsli ? join(folderApp, 'lib', 'xlsx.full.min.js') : join(SALINAN, 'xlsx.full.min.js'),
  '/lib/pegawai.js': join(folderApp, 'pegawai.js'),
};
