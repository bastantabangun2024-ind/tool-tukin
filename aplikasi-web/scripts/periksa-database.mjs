#!/usr/bin/env node
// periksa-database.mjs — laporan ringan kondisi database Supabase.
//
// Menampilkan ukuran database, tabel terbesar, jumlah baris, dan indeks/TOAST.
// Hanya membaca (SELECT), tidak mengubah data. Butuh SUPABASE_ACCESS_TOKEN
// dan SUPABASE_URL di .env.local (sama seperti terapkan-migrasi.mjs).
//
//   node scripts/periksa-database.mjs

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const AKAR = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function bacaEnv(berkas) {
  try {
    return Object.fromEntries(
      readFileSync(join(AKAR, berkas), 'utf8')
        .split(/\r?\n/)
        .map((b) => b.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/))
        .filter(Boolean)
        .map((m) => [m[1], m[2].replace(/^['"]|['"]$/g, '').trim()]),
    );
  } catch {
    return {};
  }
}

const env = { ...bacaEnv('.env.example'), ...bacaEnv('.env.local'), ...process.env };
const url = env.SUPABASE_URL;
const token = env.SUPABASE_ACCESS_TOKEN;

if (!url) {
  console.error('SUPABASE_URL belum ada di .env.local');
  process.exit(1);
}
if (!token) {
  console.error('SUPABASE_ACCESS_TOKEN belum ada di .env.local — laporan tidak bisa dijalankan.');
  process.exit(1);
}

const ref = new URL(url).hostname.split('.')[0];

async function sql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const teks = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}\n${teks.slice(0, 1200)}`);
  return JSON.parse(teks || '[]');
}

const ukuran = await sql(`
  select
    pg_size_pretty(pg_database_size(current_database())) as ukuran_database,
    (select count(*) from public.pegawai) as pegawai,
    (select count(*) from public.pengajuan_tukin) as pengajuan,
    (select count(*) from public.presensi) as baris_presensi,
    (select count(*) from public.pendaftaran) as pendaftaran
`);

const tabel = await sql(`
  select
    relname as tabel,
    n_live_tup as baris,
    pg_size_pretty(pg_total_relation_size(relid)) as total,
    pg_size_pretty(pg_relation_size(relid)) as data,
    pg_size_pretty(pg_total_relation_size(relid) - pg_relation_size(relid)) as indeks_dan_toast,
    n_dead_tup as baris_mati
  from pg_catalog.pg_stat_user_tables
  order by pg_total_relation_size(relid) desc
  limit 15
`);

const indeks = await sql(`
  select
    relname as tabel,
    indexrelname as indeks,
    pg_size_pretty(pg_relation_size(indexrelid)) as ukuran
  from pg_stat_user_indexes
  order by pg_relation_size(indexrelid) desc
  limit 15
`);

console.log('\n== Ringkasan database ==');
console.log(ukuran[0] || ukuran);

console.log('\n== Tabel terbesar (data, indeks, TOAST) ==');
console.table(tabel);

console.log('\n== Indeks terbesar ==');
console.table(indeks);

console.log('\nCatatan: PostgreSQL sudah mengompres nilai teks/json besar lewat TOAST,');
console.log('dan autovacuum membersihkan baris mati. Kolom angka kecil (smallint/numeric)');
console.log('tidak perlu dikompres lagi; yang bisa dikecilkan hanya arsip presensi lama.');
