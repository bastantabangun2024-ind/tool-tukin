#!/usr/bin/env node
// cek-skema.mjs — memastikan migrasi sudah masuk ke project Supabase.
// Pakai: node scripts/cek-skema.mjs
// Membaca .env.local (tidak mencetak nilai rahasia).

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
const kunci = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !kunci) {
  console.error('SUPABASE_URL / SUPABASE_SECRET_KEY belum diisi di .env.local');
  process.exit(1);
}

const TABEL = [
  'bidang', 'users', 'pegawai', 'pendaftaran', 'aturan_potongan', 'file_presensi',
  'pengajuan_tukin', 'presensi', 'rekap_kehadiran', 'rekap_tukin', 'rekap_uang_makan',
  'hari_libur', 'pengaturan', 'audit_log',
];

const kepala = { apikey: kunci, Authorization: `Bearer ${kunci}` };

let gagal = 0;
for (const t of TABEL) {
  const res = await fetch(`${url}/rest/v1/${t}?select=*&limit=1`, {
    headers: { ...kepala, Prefer: 'count=exact' },
  });
  const teks = await res.text();
  let jumlah = '?';
  const cr = res.headers.get('content-range');
  if (cr && cr.includes('/')) jumlah = cr.split('/')[1];
  if (res.ok) {
    console.log(`OK    ${t.padEnd(18)} baris: ${jumlah}`);
  } else {
    gagal++;
    console.log(`GAGAL ${t.padEnd(18)} HTTP ${res.status} ${teks.slice(0, 120)}`);
  }
}

// RLS: kunci publishable tanpa login tidak boleh melihat pegawai
if (env.SUPABASE_PUBLISHABLE_KEY) {
  const res = await fetch(`${url}/rest/v1/pegawai?select=id`, {
    headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY },
  });
  const body = await res.text();
  const kosong = res.ok && body.trim() === '[]';
  console.log(
    kosong
      ? 'OK    RLS pegawai menolak akses tanpa login'
      : `PERIKSA RLS pegawai: HTTP ${res.status} ${body.slice(0, 120)}`,
  );
  if (!kosong) gagal++;
}

// Direktori publik harus bisa dipanggil tanpa login dan tanpa kolom sensitif
if (env.SUPABASE_PUBLISHABLE_KEY) {
  const res = await fetch(`${url}/rest/v1/rpc/direktori_pegawai`, {
    method: 'POST',
    headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
    body: '{}',
  });
  const body = await res.text();
  const sensitif = /tukin|golongan|"nip":/.test(body);
  console.log(
    res.ok && !sensitif
      ? `OK    direktori_pegawai() publik, ${JSON.parse(body || '[]').length} baris`
      : `PERIKSA direktori_pegawai(): HTTP ${res.status} ${body.slice(0, 160)}`,
  );
  if (!res.ok || sensitif) gagal++;
}

const res = await fetch(`${url}/rest/v1/bidang?select=kode,nama&order=kode`, { headers: kepala });
const bidang = res.ok ? await res.json() : [];
console.log(`\nBidang terdaftar: ${bidang.length}`);

const aturan = await fetch(
  `${url}/rest/v1/aturan_potongan?select=kode,nilai&versi=eq.1&order=kode`,
  { headers: kepala },
);
if (aturan.ok) {
  const daftar = await aturan.json();
  console.log(`Aturan versi 1 : ${daftar.length}`);
}

console.log(gagal === 0 ? '\nSEMUA CEK LULUS' : `\n${gagal} cek gagal`);
process.exit(gagal === 0 ? 0 : 1);
