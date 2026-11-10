#!/usr/bin/env node
// buat-seed-pegawai.mjs — mengubah roster offline (aplikasi-offline/APLIKASI/pegawai.js)
// menjadi supabase/migrations/0003_seed_pegawai.sql.
// Jalankan: node scripts/buat-seed-pegawai.mjs
// Aman diulang: hasilnya upsert berdasarkan NIP.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const AKAR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sumber = join(AKAR, '..', 'aplikasi-offline', 'APLIKASI', 'pegawai.js');

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(readFileSync(sumber, 'utf8'), sandbox);
const roster = sandbox.window.PEGAWAI;

if (!Array.isArray(roster) || !roster.length) {
  console.error('Roster kosong / gagal dibaca:', sumber);
  process.exit(1);
}

function kutip(v) {
  if (v === null || v === undefined || v === '') return 'null';
  return "'" + String(v).replace(/'/g, "''") + "'";
}

// gol lama: "IX" (PPPK) atau "IV/b" (PNS) -> golongan + ruang
function pecahGol(gol) {
  const teks = String(gol || '').trim();
  if (!teks) return { golongan: null, ruang: null };
  const [golongan, ruang] = teks.split('/');
  return { golongan: golongan.trim() || null, ruang: (ruang || '').trim() || null };
}

const salah = [];
const nilai = roster.map((p) => {
  const nip = String(p.nip || '').trim();
  if (!/^[0-9]{18}$/.test(nip)) salah.push(`${p.nama}: NIP "${nip}" bukan 18 digit`);
  const { golongan, ruang } = pecahGol(p.gol);
  const status = String(p.status || 'PPPK').toUpperCase();
  const bidang = String(p.bidang || '').toUpperCase();
  return (
    `  (${kutip(nip)}, ${kutip(p.nama)}, ${kutip(p.namaKey)}, ${kutip(status)}, ` +
    `${kutip(golongan)}, ${kutip(ruang)}, ${kutip(p.jabatan)}, ${kutip(p.kelasJabatan)}, ` +
    `${Number(p.tukin) || 0}, ${Number(p.tarifUangMakan) || 37000}, ${Number(p.pphPct ?? 5)}, ` +
    `${kutip(bidang)})`
  );
});

if (salah.length) {
  console.error('Roster tidak valid:\n' + salah.join('\n'));
  process.exit(1);
}

const bidangUnik = [...new Set(roster.map((p) => String(p.bidang).toUpperCase()))];

const sql = `-- 0003_seed_pegawai.sql — HASIL GENERATE, jangan diedit manual.
-- Sumber: aplikasi-offline/APLIKASI/pegawai.js (${roster.length} pegawai)
-- Dibuat oleh: node scripts/buat-seed-pegawai.mjs
-- Bidang yang dipakai roster: ${bidangUnik.join(', ')}

begin;

insert into public.pegawai
  (nip, nama, nama_key, status_kepegawaian, golongan, ruang, jabatan, kelas_jabatan,
   bidang_id, tukin, tarif_uang_makan, pph_pct)
select v.nip, v.nama, v.nama_key, v.status_kepegawaian::public.status_kepegawaian,
       v.golongan, v.ruang, v.jabatan, v.kelas_jabatan,
       b.id, v.tukin, v.tarif_uang_makan, v.pph_pct
from (values
${nilai.join(',\n')}
) as v(nip, nama, nama_key, status_kepegawaian, golongan, ruang, jabatan, kelas_jabatan,
       tukin, tarif_uang_makan, pph_pct, bidang_kode)
join public.bidang b on b.kode = v.bidang_kode
on conflict (nip) do update set
  nama               = excluded.nama,
  nama_key           = excluded.nama_key,
  status_kepegawaian = excluded.status_kepegawaian,
  golongan           = excluded.golongan,
  ruang              = excluded.ruang,
  jabatan            = excluded.jabatan,
  kelas_jabatan      = excluded.kelas_jabatan,
  bidang_id          = excluded.bidang_id,
  tukin              = excluded.tukin,
  tarif_uang_makan   = excluded.tarif_uang_makan,
  pph_pct            = excluded.pph_pct;

commit;
`;

writeFileSync(join(AKAR, 'supabase', 'migrations', '0003_seed_pegawai.sql'), sql);

const perBidang = {};
for (const p of roster) {
  const k = String(p.bidang).toUpperCase();
  perBidang[k] = (perBidang[k] || 0) + 1;
}
console.log('Ditulis: supabase/migrations/0003_seed_pegawai.sql');
console.log(`Jumlah: ${roster.length} pegawai`);
console.log('Per bidang:', JSON.stringify(perBidang));
