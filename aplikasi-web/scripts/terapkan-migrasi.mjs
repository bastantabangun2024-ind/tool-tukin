#!/usr/bin/env node
// terapkan-migrasi.mjs — menjalankan file di supabase/migrations/ ke project Supabase.
//
// Pakai:
//   1. Buat Personal Access Token: https://supabase.com/dashboard/account/tokens
//   2. Isi .env.local: SUPABASE_ACCESS_TOKEN=sbp_...
//   3. node scripts/terapkan-migrasi.mjs
//
// Tanpa token, skrip mencetak cara manual (tempel ke SQL Editor) dan keluar dengan kode 1.
// Tanpa dependency: hanya fetch bawaan Node 18+.

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const AKAR = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function bacaEnv(berkas) {
  let teks = '';
  try {
    teks = readFileSync(join(AKAR, berkas), 'utf8');
  } catch {
    return {};
  }
  const hasil = {};
  for (const baris of teks.split(/\r?\n/)) {
    const cocok = baris.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!cocok) continue;
    let nilai = cocok[2].trim();
    if (
      (nilai.startsWith('"') && nilai.endsWith('"')) ||
      (nilai.startsWith("'") && nilai.endsWith("'"))
    ) {
      nilai = nilai.slice(1, -1);
    }
    hasil[cocok[1]] = nilai;
  }
  return hasil;
}

const env = { ...bacaEnv('.env.example'), ...bacaEnv('.env.local'), ...process.env };

const url = env.SUPABASE_URL;
if (!url) {
  console.error('SUPABASE_URL belum ada di .env.local');
  process.exit(1);
}

const ref = new URL(url).hostname.split('.')[0];
const token = env.SUPABASE_ACCESS_TOKEN;

const mapMigrasi = join(AKAR, 'supabase', 'migrations');
const berkas = readdirSync(mapMigrasi).filter((f) => f.endsWith('.sql')).sort();
if (!berkas.length) {
  console.error('Tidak ada file .sql di supabase/migrations');
  process.exit(1);
}

if (!token) {
  console.log('SUPABASE_ACCESS_TOKEN belum diisi — migrasi belum dijalankan.\n');
  console.log('Pilihan A (otomatis):');
  console.log('  1. https://supabase.com/dashboard/account/tokens → Generate new token');
  console.log('  2. tambahkan ke aplikasi-web/.env.local:  SUPABASE_ACCESS_TOKEN=sbp_...');
  console.log('  3. node scripts/terapkan-migrasi.mjs\n');
  console.log('Pilihan B (manual): buka SQL Editor project, tempel isi file berikut lalu Run,');
  console.log('urut sesuai nama:');
  for (const f of berkas) console.log('  - supabase/migrations/' + f);
  process.exit(1);
}

// Project gratis/paused bisa butuh beberapa detik untuk bangun.
async function jalankanSql(query, nama) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });
  const teks = await res.text();
  if (!res.ok) {
    throw new Error(`${nama}: HTTP ${res.status}\n${teks.slice(0, 1500)}`);
  }
  return teks;
}

for (const f of berkas) {
  const sql = readFileSync(join(mapMigrasi, f), 'utf8');
  process.stdout.write(`→ ${f} ... `);
  try {
    await jalankanSql(sql, f);
    console.log('OK');
  } catch (e) {
    console.log('GAGAL');
    console.error(String(e.message || e));
    process.exit(1);
  }
}

const cek = await jalankanSql(
  `select
     (select count(*) from public.bidang)           as bidang,
     (select count(*) from public.aturan_potongan)  as aturan,
     (select count(*) from public.pegawai)          as pegawai,
     (select count(*) from pg_policies
       where schemaname = 'public')                 as policy`,
  'cek',
);
console.log('\nRingkasan:', cek);
