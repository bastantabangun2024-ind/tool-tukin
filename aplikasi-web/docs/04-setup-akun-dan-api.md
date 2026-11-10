# 04 — Setup Akun & Kredensial (sebelum TAHAP 2)

Tanggal: 10 November 2026
Status: **panduan pengisian**. File yang perlu diisi: `aplikasi-web/.env.local`
(template lengkap: `aplikasi-web/.env.example`).

---

## 1. Jawaban singkat: apa yang benar-benar perlu?

| Layanan | Perlu? | Untuk apa | Perlu API key di aplikasi? |
|---|---|---|---|
| **Supabase** | **Ya, wajib** | Login (Auth), database PostgreSQL, RLS | Ya — URL + publishable key + secret key |
| **Google Cloud / Drive** | **Ya, wajib** (keputusan: simpan berkas di Drive) | Menyimpan file presensi & 3 file hasil, mengambil berkas dari folder Drive | Ya — OAuth client ID + secret |
| **Vercel** | **Ya** untuk online | Hosting halaman + fungsi serverless (tempat memproses xlsx & memegang rahasia) | **Tidak.** Tidak ada "API key Vercel" yang dipakai aplikasi. Deploy lewat GitHub atau `vercel` CLI |
| **Git/GitHub** | Tidak wajib, **sangat disarankan** | Riwayat perubahan + deploy otomatis ke Vercel | Tidak |
| **Supabase Storage** | **Tidak dipakai** | — | — (berkas disimpan di Drive) |
| **Service Account Google** | **Tidak perlu** | — | — (memakai OAuth sebagai admin, sesuai spesifikasi "OAuth resmi") |

Jadi yang perlu Kakak siapkan hanya **3 hal**: project Supabase, OAuth client Google,
dan akun Vercel. Tidak ada kunci rahasia Vercel yang perlu ditempel ke file.

---

## 2. Supabase (wajib)

1. Buat akun di supabase.com → **New project**.
   - Nama: `tool-tukin`
   - Region: **Southeast Asia (Singapore)** — paling dekat.
   - Simpan **database password** di tempat aman (dipakai untuk migrasi, bukan untuk aplikasi).
2. Buka **Connect** (atau Settings → **API Keys**), salin:
   - `Project URL` → `SUPABASE_URL`
   - `Publishable key` (`sb_publishable_...`) → `SUPABASE_PUBLISHABLE_KEY`
   - `Secret key` (`sb_secret_...`) → `SUPABASE_SECRET_KEY`
3. Bila project masih menampilkan **Legacy API keys** saja, salin `anon` →
   `SUPABASE_ANON_KEY` dan `service_role` → `SUPABASE_SERVICE_ROLE_KEY`.
   Supabase mempensiunkan kunci lama akhir 2026, jadi kunci baru lebih disarankan.
4. **Authentication → Providers → Email**: aktifkan.
   - Untuk 1 admin + pegawai terbatas, matikan "Allow new users to sign up" setelah
     akun admin pertama dibuat (pendaftaran pegawai tetap jalan lewat fungsi server).
5. **Authentication → URL Configuration**: isi `Site URL` = alamat aplikasi
   (sementara `http://localhost:3000`, nanti domain Vercel).

Arti kunci:
- **Publishable** = boleh ada di browser. Aman **hanya jika RLS aktif**.
- **Secret** = melewati RLS. Hanya di server/fungsi. Kalau bocor, seluruh data bisa dibaca.

---

## 3. Google Drive (wajib, karena penyimpanan di Drive)

1. Buka console.cloud.google.com → buat project (mis. `tool-tukin`).
2. **APIs & Services → Library** → aktifkan **Google Drive API**.
3. **OAuth consent screen**:
   - User type: **External** (akun Gmail biasa) atau **Internal** (kalau Workspace).
   - Isi nama aplikasi, email dukungan, email developer.
   - **Scopes**: tambahkan
     `.../auth/drive.readonly` dan `.../auth/drive.file`.
   - **Test users**: tambahkan `bastantabangun2024@gmail.com` (dan email admin lain bila ada).
4. **Credentials → Create credentials → OAuth client ID**:
   - Application type: **Web application**
   - **Authorized redirect URIs**:
     - `http://localhost:3000/api/drive/oauth/callback`
     - `https://<domain-vercel>/api/drive/oauth/callback`
   - Salin **Client ID** dan **Client secret**.
5. Isi `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`.

Catatan penting:
- Aplikasi akan tampil sebagai **"Google hasn't verified this app"** sampai proses
  verifikasi Google selesai. Sebagai admin/test user, klik **Advanced → Go to app**.
  Selama belum diverifikasi, jumlah pengguna dibatasi (maks 100 test user) — cukup
  untuk kebutuhan internal.
- `drive.readonly` termasuk **restricted scope**: verifikasi Google (termasuk security
  assessment) diperlukan bila aplikasi dipakai publik. Untuk internal, cukup mode testing.
- `drive.file` (non-sensitif) hanya memberi akses ke file/folder yang dibuat aplikasi.
- **Refresh token** disimpan terenkripsi di tabel `pengaturan` (kunci `ENCRYPTION_KEY`),
  tidak pernah dikirim ke browser.

Susunan folder di Drive (dibuat otomatis oleh aplikasi):

```
TUKIN/
├── 2026/
│   └── 10. OKTOBER/
│       ├── presensi/  <NIP>_Presensi 10-2026.xlsx
│       └── hasil/     Rekapitulasi Kehadiran/Tukin/Uang Makan Bimas <BIDANG> OKT.xlsx
```

---

## 4. Vercel (hosting)

1. Buat akun Vercel (boleh login dengan GitHub/Google).
2. **Add New → Project → Import** repository `tool-tukin` (butuh GitHub, lihat bagian 5)
   atau jalankan `vercel` dari folder `aplikasi-web` (tanpa GitHub).
3. Root directory: **`aplikasi-web`**. Framework preset: **Other**.
4. **Settings → Environment Variables**: tempel semua isi `.env.local`
   (Production **dan** Preview). `SUPABASE_SECRET_KEY`, `GOOGLE_CLIENT_SECRET`,
   `ENCRYPTION_KEY` **wajib** ditandai sensitif.
5. Setelah dapat domain, perbarui:
   - `APP_BASE_URL` di Vercel,
   - `GOOGLE_REDIRECT_URI` di Vercel **dan** di Google Cloud,
   - `Site URL` di Supabase.
6. Region fungsi: pilih **Singapore** agar dekat ke Supabase dan Drive.

Tidak ada API key Vercel yang perlu dimasukkan ke `.env.local`; `VERCEL_TOKEN`
hanya bila Kakak ingin deploy lewat CLI/otomatisasi.

---

## 5. Git/GitHub (disarankan)

Folder project saat ini **belum** berupa repository git. Bila ingin:

```bash
cd aplikasi-web
git init
git add .
git commit -m "TAHAP 1: audit, rancangan, skema, template env"
```

`.gitignore` sudah mengecualikan `.env.local`, `.vercel/`, dan `node_modules/`.
Setelah repo masuk GitHub, Vercel akan otomatis deploy setiap kali ada commit.
Tanpa Git pun aplikasi tetap bisa online lewat `vercel` CLI — hanya kehilangan riwayat.

---

## 6. Tabel variabel & sumbernya

| Variabel | Wajib | Diambil dari | Aman di browser? |
|---|---|---|---|
| `SUPABASE_URL` | ✅ | Supabase → Connect | ✅ |
| `SUPABASE_PUBLISHABLE_KEY` | ✅ | Supabase → Connect | ✅ (dengan RLS) |
| `SUPABASE_SECRET_KEY` | ✅ | Supabase → API Keys | ❌ server saja |
| `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` | opsional | Legacy API keys | anon ✅ / service_role ❌ |
| `GOOGLE_CLIENT_ID` | ✅ | Google Cloud → Credentials | ✅ (memang publik) |
| `GOOGLE_CLIENT_SECRET` | ✅ | Google Cloud → Credentials | ❌ server saja |
| `GOOGLE_REDIRECT_URI` | ✅ | disusun sendiri | ✅ |
| `DRIVE_FOLDER_ID` / `DRIVE_FOLDER_HASIL_ID` | opsional | isi dari `/admin/drive` | ✅ |
| `APP_BASE_URL` | ✅ | domain aplikasi | ✅ |
| `ADMIN_EMAIL` | ✅ | sudah ditentukan | ✅ |
| `ENCRYPTION_KEY` | ✅ | `openssl rand -base64 32` | ❌ server saja |
| `VERCEL_TOKEN` | ❌ | Vercel → Account Tokens | ❌ (jangan di aplikasi) |

---

## 7. Yang perlu Kakak lakukan sekarang

1. Isi `aplikasi-web/.env.local` (3 kelompok: Supabase, Google, aplikasi).
2. Buat project Supabase + OAuth client sesuai langkah di atas.
3. Beri tahu saya bila sudah terisi (cukup bilang "sudah"), **jangan kirim isi kuncinya
   ke chat** — saya membaca dari file saat menjalankan tahap 2.
4. Setelah itu TAHAP 2: jalankan skema database + RLS + akun admin pertama, lalu uji
   login dan satu proses presensi.
