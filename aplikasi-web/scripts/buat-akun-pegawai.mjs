// Membuat / menyegarkan akun login pegawai di Supabase Auth, menautkannya ke
// baris `pegawai`, lalu menulis daftar kredensial ke ../userpaswordpegawai.md.
//
// Jalankan ulang kapan saja (mis. ada pegawai baru atau password ingin diganti):
//   cd aplikasi-web && node scripts/buat-akun-pegawai.mjs
//
// Sifatnya idempoten: email yang sudah ada akan diperbarui passwordnya,
// jadi file kredensial selalu berisi password yang berlaku.
import { readFileSync, writeFileSync } from 'node:fs';
import { randomInt } from 'node:crypto';

const DOMAIN = 'pegawai.tooltukin.id';
const HURUF = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

const env = {};
for (const baris of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = baris.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const URL_DB = env.SUPABASE_URL;
const KUNCI_SERVER = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_DB || !KUNCI_SERVER) {
  console.error('SUPABASE_URL / SUPABASE_SECRET_KEY belum ada di .env.local');
  process.exit(1);
}

const kepalaServer = {
  apikey: KUNCI_SERVER,
  Authorization: 'Bearer ' + KUNCI_SERVER,
  'Content-Type': 'application/json',
};

function sandi(panjang = 12) {
  let s = '';
  for (let i = 0; i < panjang; i++) s += HURUF[randomInt(HURUF.length)];
  return s;
}

// "Dr. SAMAREL TELAUM BANUA, S PAK, M.Pd." -> "samarel.telaum"
function slugNama(nama) {
  const dasar = String(nama || '')
    .split(',')[0]
    .replace(/\b(Dr|Drs|Dra|H|Hj)\.?\s+/gi, '');
  const kata = dasar
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((k) => k && !['br', 'bin', 'binti'].includes(k));
  return kata.slice(0, 2).join('.') || 'pegawai';
}

async function json(url, opsi) {
  const r = await fetch(url, opsi);
  const t = await r.text();
  let j = null;
  try { j = t ? JSON.parse(t) : null; } catch { j = null; }
  return { ok: r.ok, status: r.status, j, t };
}

async function cariUser(email) {
  const r = await json(`${URL_DB}/auth/v1/admin/users?per_page=200`, { headers: kepalaServer });
  if (!r.ok || !r.j) return null;
  const daftar = Array.isArray(r.j.users) ? r.j.users : [];
  return daftar.find((u) => String(u.email || '').toLowerCase() === email.toLowerCase()) || null;
}

async function buatAtauPerbarui({ email, nama, password }) {
  const ada = await cariUser(email);
  if (!ada) {
    const r = await json(`${URL_DB}/auth/v1/admin/users`, {
      method: 'POST',
      headers: kepalaServer,
      body: JSON.stringify({
        email,
        password,
        email_confirm: true,
        user_metadata: { nama, peran: 'pegawai' },
      }),
    });
    if (!r.ok) throw new Error(`buat akun HTTP ${r.status} ${r.t.slice(0, 200)}`);
    return { user: r.j, baru: true };
  }
  const r = await json(`${URL_DB}/auth/v1/admin/users/${ada.id}`, {
    method: 'PUT',
    headers: kepalaServer,
    body: JSON.stringify({
      password,
      email_confirm: true,
      user_metadata: { nama, peran: 'pegawai' },
    }),
  });
  if (!r.ok) throw new Error(`perbarui akun HTTP ${r.status} ${r.t.slice(0, 200)}`);
  return { user: { ...ada, ...(r.j || {}) }, baru: false };
}

const hasil = [];
const dipakai = new Set();

const daftarPegawai = await json(
  `${URL_DB}/rest/v1/pegawai?select=id,nip,nama,status_kepegawaian,user_id,bidang:bidang_id(nama)&order=nama`,
  { headers: kepalaServer },
);
if (!daftarPegawai.ok) {
  console.error('Gagal membaca pegawai:', daftarPegawai.status, daftarPegawai.t.slice(0, 300));
  process.exit(1);
}

for (const p of daftarPegawai.j) {
  let lokal = slugNama(p.nama);
  if (dipakai.has(lokal)) {
    let n = 2;
    while (dipakai.has(lokal + n)) n++;
    lokal = lokal + n;
  }
  dipakai.add(lokal);
  const email = `${lokal}@${DOMAIN}`;
  const password = sandi();
  const bidang = (p.bidang && p.bidang.nama) || '';

  try {
    const { user, baru } = await buatAtauPerbarui({ email, nama: p.nama, password });

    await json(`${URL_DB}/rest/v1/users?on_conflict=id`, {
      method: 'POST',
      headers: { ...kepalaServer, Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ id: user.id, email, nama: p.nama, peran: 'pegawai', aktif: true }),
    });

    const taut = await json(`${URL_DB}/rest/v1/pegawai?id=eq.${encodeURIComponent(p.id)}`, {
      method: 'PATCH',
      headers: { ...kepalaServer, Prefer: 'return=minimal' },
      body: JSON.stringify({ user_id: user.id }),
    });
    if (!taut.ok) throw new Error(`taut pegawai HTTP ${taut.status} ${taut.t.slice(0, 200)}`);

    hasil.push({ ...p, email, password, baru });
    console.log(`${baru ? 'BARU ' : 'PERBARUI'} ${email.padEnd(34)} ${p.nama}`);
  } catch (e) {
    hasil.push({ ...p, email, password: '', galat: String(e.message || e) });
    console.error('GAGAL', email, '|', String(e.message || e));
  }
}

const sukses = hasil.filter((h) => !h.galat);
const tanggal = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });

const markdown = `# Username & Password Akun Pegawai

Dibuat: ${tanggal} (WIB)
Jumlah pegawai: ${sukses.length}${hasil.length !== sukses.length ? ` dari ${hasil.length}` : ''}
Halaman login: https://tool-tukin.vercel.app/masuk.html

> **RAHASIA — jangan di-commit ke Git dan jangan dibagikan ke grup umum.**
> File ini sudah masuk \`.gitignore\`. Bagikan kredensial satu per satu ke pegawai
> yang bersangkutan (WhatsApp pribadi), lalu minta segera ganti password.
> Password di sini adalah password sementara yang berlaku saat file ini dibuat.

| No | Nama | NIP | Bidang | Username (email) | Password |
|---:|---|---|---|---|---|
${sukses
  .map(
    (h, i) =>
      `| ${i + 1} | ${h.nama} | ${h.nip} | ${(h.bidang && h.bidang.nama) || '-'} | ${h.email} | ${h.password} |`,
  )
  .join('\n')}
${hasil.some((h) => h.galat) ? `\n## Gagal dibuat\n\n${hasil.filter((h) => h.galat).map((h) => `- ${h.nama} (${h.nip}) — ${h.galat}`).join('\n')}\n` : ''}
## Catatan

- Username memakai **email** karena aplikasi login dengan email + password.
- Password boleh diganti kapan saja oleh pegawai di aplikasi; kalau perlu
  dibuat ulang seluruhnya, jalankan \`cd aplikasi-web && node scripts/buat-akun-pegawai.mjs\`
  (password lama otomatis diganti dan file ini ditimpa).
- Pegawai baru yang masuk lewat pendaftaran akan otomatis mendapat akun saat
  pendaftarannya disetujui admin — tidak perlu dijalankan ulang, kecuali ingin
  menyamakan format.
`;

writeFileSync('../userpaswordpegawai.md', markdown, 'utf8');
console.log(`\nSelesai: ${sukses.length} akun siap. File: userpaswordpegawai.md`);
