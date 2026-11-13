// Menyamakan akun login SEMUA pegawai:
//   username = NIP  (di Supabase Auth disimpan sebagai <NIP>@pegawai.tooltukin.id)
//   password awal = 12345678
// Akun yang sudah ada diperbarui, yang belum ada dibuat, lalu ditautkan ke
// baris `pegawai` dan profil `users`. Sifatnya idempoten — aman dijalankan ulang.
//
// Jalankan:
//   cd aplikasi-web && node scripts/buat-akun-pegawai.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const DOMAIN = 'pegawai.tooltukin.id';
const SANDI_AWAL = '12345678';

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

async function json(url, opsi) {
  const r = await fetch(url, opsi);
  const t = await r.text();
  let j = null;
  try { j = t ? JSON.parse(t) : null; } catch { j = null; }
  return { ok: r.ok, status: r.status, j, t };
}

async function userAuthById(id) {
  if (!id) return null;
  const r = await json(`${URL_DB}/auth/v1/admin/users/${encodeURIComponent(id)}`, { headers: kepalaServer });
  return r.ok && r.j && r.j.id ? r.j : null;
}

async function daftarUserAuth() {
  const semua = [];
  for (let page = 1; page <= 10; page++) {
    const r = await json(`${URL_DB}/auth/v1/admin/users?page=${page}&per_page=200`, { headers: kepalaServer });
    if (!r.ok) break;
    const daftar = Array.isArray(r.j?.users) ? r.j.users : Array.isArray(r.j) ? r.j : [];
    semua.push(...daftar);
    if (daftar.length < 200) break;
  }
  return semua;
}

function cariEmail(daftar, email) {
  const target = String(email || '').toLowerCase();
  return daftar.find((u) => String(u.email || '').toLowerCase() === target) || null;
}

async function simpanAkun({ email, nama, password, user }) {
  const badan = {
    email,
    password,
    email_confirm: true,
    user_metadata: { nama, peran: 'pegawai', harus_ganti_password: true },
  };
  if (user) {
    const r = await json(`${URL_DB}/auth/v1/admin/users/${user.id}`, {
      method: 'PUT', headers: kepalaServer, body: JSON.stringify(badan),
    });
    if (!r.ok) throw new Error(`perbarui akun HTTP ${r.status} ${r.t.slice(0, 200)}`);
    return { user: { ...user, ...(r.j || {}) }, baru: false };
  }
  const r = await json(`${URL_DB}/auth/v1/admin/users`, {
    method: 'POST', headers: kepalaServer, body: JSON.stringify(badan),
  });
  if (!r.ok) throw new Error(`buat akun HTTP ${r.status} ${r.t.slice(0, 200)}`);
  return { user: r.j, baru: true };
}

const daftarPegawai = await json(
  `${URL_DB}/rest/v1/pegawai?select=id,nip,nama,status_kepegawaian,user_id,bidang:bidang_id(nama)&order=nama`,
  { headers: kepalaServer },
);
if (!daftarPegawai.ok) {
  console.error('Gagal membaca pegawai:', daftarPegawai.status, daftarPegawai.t.slice(0, 300));
  process.exit(1);
}

const semuaAuth = await daftarUserAuth();
const hasil = [];

for (const p of daftarPegawai.j) {
  const nip = String(p.nip || '').replace(/\s/g, '');
  const email = `${nip}@${DOMAIN}`;
  const bidang = (p.bidang && p.bidang.nama) || '';

  try {
    if (!/^\d{18}$/.test(nip)) throw new Error('NIP bukan 18 angka');

    let user = await userAuthById(p.user_id);
    if (!user) user = cariEmail(semuaAuth, email);

    // Akun lama (email berbasis nama) mungkin belum tertaut di pegawai.user_id.
    if (!user) {
      const profil = await json(
        `${URL_DB}/rest/v1/users?select=id,email&nama=eq.${encodeURIComponent(p.nama)}&peran=eq.pegawai&limit=1`,
        { headers: kepalaServer },
      );
      const akunLama = profil.ok && Array.isArray(profil.j) ? profil.j[0] : null;
      if (akunLama) user = cariEmail(semuaAuth, akunLama.email) || (await userAuthById(akunLama.id));
    }

    const { user: akun, baru } = await simpanAkun({ email, nama: p.nama, password: SANDI_AWAL, user });

    await json(`${URL_DB}/rest/v1/users?on_conflict=id`, {
      method: 'POST',
      headers: { ...kepalaServer, Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ id: akun.id, email, nama: p.nama, peran: 'pegawai', aktif: true }),
    });

    const taut = await json(`${URL_DB}/rest/v1/pegawai?id=eq.${encodeURIComponent(p.id)}`, {
      method: 'PATCH',
      headers: { ...kepalaServer, Prefer: 'return=minimal' },
      body: JSON.stringify({ user_id: akun.id }),
    });
    if (!taut.ok) throw new Error(`taut pegawai HTTP ${taut.status} ${taut.t.slice(0, 200)}`);

    hasil.push({ ...p, nip, email, password: SANDI_AWAL, baru });
    console.log(`${baru ? 'BARU ' : 'PERBARUI'} NIP ${nip.padEnd(18)} ${p.nama}`);
  } catch (e) {
    hasil.push({ ...p, nip, email, password: '', galat: String(e.message || e) });
    console.error('GAGAL', nip, p.nama, '|', String(e.message || e));
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
>
> Semua akun memakai **username = NIP** dan **password awal = ${SANDI_AWAL}**.
> Saat masuk pertama kali, aplikasi otomatis menampilkan pilihan ganti password.
> Jika pegawai lupa password, admin cukup klik **Reset sandi** di menu Data Pegawai.

| No | Nama | NIP (username) | Bidang | Password awal |
|---:|---|---|---|---|
${sukses
  .map(
    (h, i) =>
      `| ${i + 1} | ${h.nama} | ${h.nip} | ${(h.bidang && h.bidang.nama) || '-'} | ${SANDI_AWAL} |`,
  )
  .join('\n')}
${hasil.some((h) => h.galat) ? `\n## Gagal dibuat\n\n${hasil.filter((h) => h.galat).map((h) => `- ${h.nama} (${h.nip}) — ${h.galat}`).join('\n')}\n` : ''}## Catatan

- Supabase Auth memakai email sebagai username, jadi NIP disimpan sebagai
  \`<NIP>@${DOMAIN}\`. Pegawai cukup mengetik NIP di halaman masuk.
- Setelah pegawai mengganti password, password di file ini tidak lagi berlaku.
  Untuk mengembalikan ke password awal, gunakan tombol **Reset sandi** di
  menu Data Pegawai atau jalankan ulang script ini.
`;

writeFileSync('../userpaswordpegawai.md', markdown, 'utf8');
console.log(`\nSelesai: ${sukses.length} akun siap. Password awal: ${SANDI_AWAL}. File: userpaswordpegawai.md`);
