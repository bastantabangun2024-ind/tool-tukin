#!/usr/bin/env node
// buat-admin.mjs — membuat akun admin pertama (email sudah dikonfirmasi).
//
// Pakai:
//   node scripts/buat-admin.mjs                       # email dari ADMIN_EMAIL
//   node scripts/buat-admin.mjs --email x@y.z --nama "Nama"
//   node scripts/buat-admin.mjs --password 'Rahasia123!'   # opsional, jika ingin menentukan sendiri
//
// Bila --password tidak diberikan, skrip membuat password acak dan menampilkannya SEKALI.
// Password hanya dikirim ke Supabase Auth; tidak disimpan di mana pun oleh skrip ini.
// Prasyarat: migrasi 0001 sudah dijalankan (tabel public.users ada).

import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
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

const arg = process.argv.slice(2);
function ambil(nama) {
  const i = arg.indexOf(`--${nama}`);
  return i >= 0 ? arg[i + 1] : undefined;
}

const email = (ambil('email') || env.ADMIN_EMAIL || '').trim().toLowerCase();
const nama = ambil('nama') || 'Administrator';
if (!email || !email.includes('@')) {
  console.error('Email admin tidak valid. Isi ADMIN_EMAIL di .env.local atau pakai --email.');
  process.exit(1);
}

const password = ambil('password') || randomBytes(12).toString('base64url') + '!7a';
const dibuatkanPassword = !ambil('password');

const kepala = {
  apikey: kunci,
  Authorization: `Bearer ${kunci}`,
  'Content-Type': 'application/json',
};

async function cariUser() {
  const res = await fetch(`${url}/auth/v1/admin/users?page=1&per_page=200`, { headers: kepala });
  if (!res.ok) throw new Error(`Gagal membaca daftar user: HTTP ${res.status} ${await res.text()}`);
  const json = await res.json();
  const daftar = json.users || json;
  return daftar.find((u) => (u.email || '').toLowerCase() === email);
}

let user = await cariUser();
if (user) {
  console.log(`User Auth sudah ada: ${email} (${user.id}) — tidak dibuat ulang.`);
} else {
  const res = await fetch(`${url}/auth/v1/admin/users`, {
    method: 'POST',
    headers: kepala,
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { nama, peran: 'admin' },
    }),
  });
  const teks = await res.text();
  if (!res.ok) {
    console.error(`Gagal membuat user: HTTP ${res.status}\n${teks.slice(0, 800)}`);
    process.exit(1);
  }
  user = JSON.parse(teks);
  console.log(`User Auth dibuat: ${email} (${user.id})`);
}

// Profil di public.users (upsert agar aman dijalankan ulang)
const profil = await fetch(`${url}/rest/v1/users?on_conflict=id`, {
  method: 'POST',
  headers: { ...kepala, Prefer: 'resolution=merge-duplicates,return=representation' },
  body: JSON.stringify({ id: user.id, email, nama, peran: 'admin', aktif: true }),
});
const teksProfil = await profil.text();
if (!profil.ok) {
  console.error(`Gagal menulis public.users: HTTP ${profil.status}\n${teksProfil.slice(0, 800)}`);
  process.exit(1);
}

// Catat di audit log
await fetch(`${url}/rest/v1/audit_log`, {
  method: 'POST',
  headers: kepala,
  body: JSON.stringify({
    aktor_id: user.id,
    aksi: 'buat_admin',
    tabel: 'users',
    record_id: user.id,
    data_baru: { email, peran: 'admin' },
  }),
});

// Uji login sungguhan dengan kunci publishable (bukan secret key)
if (env.SUPABASE_PUBLISHABLE_KEY && dibuatkanPassword) {
  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const json = await res.json().catch(() => ({}));
  if (res.ok && json.access_token) {
    const me = await fetch(`${url}/rest/v1/users?select=peran,email&id=eq.${user.id}`, {
      headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${json.access_token}` },
    });
    const baris = me.ok ? await me.json() : [];
    console.log(`Login diuji: OK, peran terbaca = ${baris[0]?.peran ?? 'tidak terbaca'}`);
  } else {
    console.log(`Login diuji: GAGAL (HTTP ${res.status}) ${JSON.stringify(json).slice(0, 200)}`);
  }
}

if (dibuatkanPassword) {
  console.log('\n=== PASSWORD ADMIN (tampil sekali) ===');
  console.log(password);
  console.log('Segera ganti lewat menu akun setelah aplikasi web jalan.\n');
} else {
  console.log('\nPassword memakai yang diberikan lewat --password.');
}
