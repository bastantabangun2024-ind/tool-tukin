# Aplikasi Web — Sistem Informasi Tukin & Uang Makan

Status: **TAHAP 1 selesai (audit + rancangan)**. Belum ada kode produksi.
Sesuai catatan di `../website.md`, tahap berikutnya dikerjakan **setelah disetujui**.

Keputusan 10 November 2026: **berkas disimpan di Google Drive** (Supabase hanya Auth + database),
dan **potongan HUKDIS/TB diaktifkan sejak awal** (diisi admin saat verifikasi).
File kredensial yang perlu diisi: `.env.local` (template: `.env.example`).

## Dokumen

| Dokumen | Isi |
|---|---|
| [`docs/01-audit-aplikasi-lama.md`](docs/01-audit-aplikasi-lama.md) | Audit menyeluruh aplikasi offline: mesin hitung, format laporan, roster, bukti uji, 19 temuan + rekomendasi, bagian mana yang dipakai ulang |
| [`docs/02-rancangan-arsitektur.md`](docs/02-rancangan-arsitektur.md) | Arsitektur Vercel + Supabase, halaman, endpoint, alur pegawai/admin, validasi upload, pemakaian mesin hitung, Google Drive OAuth, keamanan, rencana 10 tahap |
| [`docs/03-skema-database.md`](docs/03-skema-database.md) | Rancangan 14 tabel + enum + indeks + RLS, metadata Drive, aturan berversi (SQL draf, **belum dijalankan**) |
| [`docs/04-setup-akun-dan-api.md`](docs/04-setup-akun-dan-api.md) | Apa yang perlu/ tidak perlu (Supabase, Google, Vercel, Git), langkah mengambil kunci, tabel env, keamanan |

## Rencana struktur kode (dibuat pada tahap berikutnya)

```
aplikasi-web/
├── public/                 # frontend statis, tanpa build step
│   ├── index.html          # dashboard publik: LOGIN ADMIN / DAFTAR PEGAWAI
│   ├── daftar.html         # formulir pendaftaran pegawai
│   ├── masuk.html          # login (admin & pegawai)
│   ├── layanan.html        # input NIP, upload presensi, pilih bulan/tahun, PROSES
│   ├── hasil.html          # ringkasan kehadiran / tukin / uang makan + KIRIM KE ADMIN
│   ├── admin/              # dashboard, pendaftar, data pegawai, verifikasi, rekap, aturan
│   └── aset/               # css, js klien, supabase-js
├── api/                    # Vercel Serverless Functions (Node)
│   ├── proses-presensi.js  # terima xlsx → validasi → hitung → simpan → kembalikan ringkasan
│   ├── unduh-hasil.js      # susun 3 workbook + signed URL
│   ├── drive-daftar.js     # Google Drive: daftar file folder (OAuth, server-side)
│   └── drive-ambil.js      # Google Drive: unduh isi file
├── lib/
│   ├── engine/             # SALINAN app.js offline (identik) + adapter Node
│   ├── validasi.js         # validasi nama file, header, periode, kepemilikan NIP
│   ├── supabase.js         # klien server (service role)
│   └── aturan.js           # pemuat aturan_potongan aktif per periode
├── scripts/
│   ├── sync-engine.mjs     # salin app.js dari aplikasi-offline + cek checksum
│   └── uji-paritas.mjs     # jalankan uji-app.js terhadap engine salinan
├── package.json
├── vercel.json
├── .env.example            # template kredensial (boleh di-commit)
├── .env.local              # isian kredensial (diabaikan git)
├── .gitignore
└── docs/                   # 01 audit, 02 arsitektur, 03 skema, 04 setup akun
```

## Aturan kerja

1. **Jangan mengubah rumus** (`3%`, `1,5%`, tangga TL/PSW, cap 100%, PPH) tanpa persetujuan admin.
2. Mesin hitung diambil dari `../aplikasi-offline/APLIKASI/app.js` (salinan identik + uji paritas),
   tidak ditulis ulang.
3. Semua hasil perhitungan disimpan bersama `aturan_versi` dan `periode`, dan yang sudah
   disetujui admin dikunci.
4. Rahasia (`SUPABASE_SECRET_KEY`, Google OAuth, `ENCRYPTION_KEY`) hanya di server; tidak pernah di frontend.
5. Berkas presensi & hasil disimpan di Google Drive; database hanya menyimpan metadata + `drive_file_id`.

## Langkah berikutnya

Tahap 2 (database + auth Supabase) menunggu persetujuan dan pengisian `.env.local`.
Variabel yang harus ada: lihat `docs/04-setup-akun-dan-api.md` bagian 6. Sisa keputusan
yang belum dijawab ada di akhir `docs/02-rancangan-arsitektur.md`.

## TAHAP 2 — migrasi & admin pertama

```bash
# 1. terapkan skema (butuh SUPABASE_ACCESS_TOKEN di .env.local)
node scripts/terapkan-migrasi.mjs

# 2. pastikan tabel, RLS, dan seed masuk
node scripts/cek-skema.mjs

# 3. buat admin pertama (password acak dicetak sekali)
node scripts/buat-admin.mjs

# bila roster pegawai berubah, buat ulang seed lalu terapkan lagi
node scripts/buat-seed-pegawai.mjs
```

Tanpa `SUPABASE_ACCESS_TOKEN`, buka SQL Editor Supabase dan jalankan
`supabase/migrations/0001_init.sql`, `0002_seed_referensi.sql`, `0003_seed_pegawai.sql`
secara berurutan. Tanpa token, `terapkan-migrasi.mjs` mencetak daftar file yang perlu ditempel.

### Status TAHAP 2 (10 November 2026)

- Migrasi `0001–0003` diterapkan ke project Supabase: 14 tabel, 25 policy RLS,
  11 bidang, 16 aturan versi 1, 30 pegawai, 4 baris `pengaturan`.
- Admin pertama dibuat dan login diuji: `bastantabangun2024@gmail.com` (peran `admin`).
  Password awal ditampilkan sekali saat pembuatan; **wajib diganti** begitu halaman login ada.
- Diuji dengan token login sungguhan: admin melihat 30 pegawai dan boleh mengubah `pengaturan`;
  anon tidak melihat `pengaturan` (token Drive) dan ditolak menulis `pegawai` (HTTP 401);
  `direktori_pegawai()` publik hanya `nama, nip_masked, bidang, jabatan`.

## TAHAP 3 awal — halaman login (10 November 2026)

```bash
node server.mjs        # http://localhost:3000/masuk.html
```

- `public/masuk.html` — login email + password ke Supabase Auth; pesan galat Bahasa Indonesia.
- `public/dasbor.html` — profil & peran dari `public.users`, ringkasan jumlah data untuk admin,
  tombol keluar. Sesi hanya di `sessionStorage` (hilang saat tab ditutup).
- `server.mjs` — server statis tanpa dependency + `/api/konfigurasi` (hanya kunci publishable).
- `jalankan-web.cmd` — peluncur Windows (jalankan server + buka browser).

Diuji: halaman 200, login admin 200 dengan peran `admin`, password salah 400, path asing 404.
Server ini untuk lokal; versi Vercel memakai handler yang sama (lihat bagian *Deploy Vercel*).

## Halaman depan & admin (TAHAP 3, 10 November 2026)

Alamat: http://localhost:3000 (halaman depan) dan http://localhost:3000/masuk.html (login admin).

**Halaman depan (`public/index.html`)**
- Isi NIP → nama, NIP, jabatan, golongan, bidang tampil otomatis (dari `cari_pegawai`/`/api/pegawai`).
- Unggah file Excel presensi, pilih bulan + tahun, tekan **Proses**.
- Muncul ringkasan kehadiran (hari kerja, hadir, telat, pulang awal, tanpa keterangan,
  tanpa presensi masuk/pulang, cuti/sakit/dinas), kotak **Tukin** dan **Uang Makan**,
  lalu pesan "Selamat Data Anda Sudah Terupload".
- Menu **Daftar**: nama, NIP, pangkat/golongan, jabatan, bidang (11 pilihan), email.

**Halaman admin (`public/admin.html`, login wajib, hanya peran admin)**
1. Sudah Unggah — daftar pengajuan + tukin bersih/potongan, tombol Setujui/Tolak.
2. Pendaftar — daftar pendaftaran menunggu, tombol Setujui/Tolak.
3. **Data Pegawai** — form tambah pegawai baru dan ubah pegawai yang sudah ada (nama, NIP,
   pangkat/golongan/ruang, jabatan, kelas jabatan, bidang, status kepegawaian, tukin,
   tarif uang makan, PPh, satker). Tersimpan di tabel **`pegawai`** Supabase — bukan di Drive.
   `nama_key` dihitung otomatis dengan `namaKey()` mesin offline agar pencocokan nama file
   Drive tetap sama; NIP ganda ditolak (409). Tiap baris punya tombol **Ubah**,
   **Nonaktifkan/Aktifkan** (baris nonaktif ditampilkan redup; riwayat pengajuan tetap utuh),
   dan **Hapus** — hapus permanen ditolak (409) bila pegawai sudah punya pengajuan, karena
   foreign key akan ikut menghapus riwayat presensi & rekapnya.
4. **Ambil dari Drive** — tempel link folder Drive publik + bulan/tahun, **Baca Folder**
   (menampilkan file yang ketemu & yang dilewati), lalu **Proses Semua File**: presensi diunduh,
   nama file/folder dicocokkan dengan daftar pegawai, dihitung, dan disimpan `menunggu_verifikasi`.
   Memakai `aplikasi-offline/AMBIL-DARI-DRIVE/alat-drive.js` apa adanya (tanpa kunci API),
   aturan pencocokan nama sama dengan `index.html` offline.
   Tiap file dikirim sebagai **satu permintaan** (`berkas: { id, nama, jalur, folder }`) supaya
   tidak kena batas waktu fungsi Vercel; folder tidak ditelusuri ulang per file.
   Bila nama file cocok dengan **lebih dari satu pegawai** (mis. dua "DAVID"), file tidak lagi
   hanya dilaporkan gagal: muncul baris **“Perlu dipilih”** berisi daftar kandidat; admin memilih
   orangnya lalu menekan **Proses**, dan file itu diproses ulang dengan `pegawai_id` pilihan.
5. **Ekspor Rekap** — pilih bulan + tahun, **Muat data**, lalu unduh **Rekap Kehadiran**,
   **Rekap Tukin**, **Rekap Uang Makan**, atau ketiganya. Berkas dibuat di browser dengan
   `public/lib/xlsx.full.min.js` (tanpa server, jadi tidak kena batas waktu Vercel).
   Isi penyusun rekap ada di `public/rekap.js` (dipakai juga oleh uji Node).
6. Pengaturan Potongan — 16 aturan versi 1, nilai bisa diubah lalu disimpan.

**Endpoint baru (`server.mjs`)**
- `GET /api/pegawai?nip=` — identitas pegawai, tanpa tukin.
- `POST /api/proses` — memakai `aplikasi-offline/APLIKASI/app.js` apa adanya (bukan salinan),
  menyimpan `pengajuan_tukin` + `presensi` + 3 tabel rekap.
- `POST /api/daftar` — menyimpan pendaftaran status `menunggu`.
- `POST /api/drive/daftar` — baca folder Drive (`{ link, bulan, tahun }`) → daftar file presensi,
  yang dilewati, dan pesan (folder arsip disaring bulan/tahun).
- `POST /api/drive/proses` — tanpa `berkas`: unduh + hitung + simpan semua file folder sekaligus
  (lokal). Dengan `berkas: { id, nama, jalur, folder }`: hanya file itu (dipakai halaman admin,
  satu request per file). Aturan "file pertama dipertahankan kecuali yang baru namanya lebih
  jelas" disimpan di `pengajuan_tukin.aturan_snapshot.sumber_file` agar tetap berlaku walau
  tiap file diproses terpisah.
- `GET /api/pegawai/daftar` — **[admin]** daftar pegawai untuk tab Data Pegawai.
- `POST /api/pegawai/simpan` — **[admin]** tambah (`id` kosong) atau ubah (`id` diisi) pegawai.
- `POST /api/pegawai/aktif` — **[admin]** `{ id, aktif }` menonaktifkan/mengaktifkan pegawai.
- `POST /api/pegawai/hapus` — **[admin]** hapus permanen; 409 bila sudah punya pengajuan.
  Semua endpoint admin memverifikasi token Supabase ke `/auth/v1/user` lalu mencocokkan
  peran `admin` di tabel `users`; tanpa itu → 401.
- `GET /lib/app.js`, `/lib/xlsx.full.min.js`, `/lib/pegawai.js` — mesin hitung. Lokal dilayani
  dari `aplikasi-offline/APLIKASI/`; di Vercel dari salinan `public/lib/`.

**Diuji:** file `Hendro_Presensi 10-2026.xlsx` (31 baris) → hadir 21, tukin bersih 3.269.215,
uang makan bersih 773.300, sama persis dengan hitungan `app.js` langsung; rincian harian
31 baris, ketiga rekap tersimpan, status `menunggu_verifikasi`; pendaftaran tersimpan `menunggu`.
Data uji dihapus setelah pengujian.

**Diuji juga (Drive):** folder "9. SEPTEMBER 2026" → 20 file presensi, 15 pegawai tersimpan
(hadir/tukin sama dengan `app.js`), file rekap manual + PDF/JPG dilewati, nama ambigu (DAVID,
NELLY) dilaporkan, link ngawur → HTTP 400. Data uji dihapus setelah pengujian.

**Kolom rekap yang diekspor**

- *Kehadiran*: hari kerja, hadir, telat, pulang awal, tanpa keterangan, tanpa presensi
  masuk/pulang, cuti, sakit, dinas luar, izin, akhir pekan.
- *Tukin*: tukin bruto, potongan TK/telat/pulang awal/HUKDIS/TB/lain, total %, total potongan,
  pajak, tukin bersih.
- *Uang makan*: hari hadir, tarif, bruto, PPh %, PPh, bersih.

**Diuji (ekspor):** dua pengajuan Oktober 2026 (Hendro, David) → ketiga berkas dibuat
(18,6–18,7 KB, 2 baris data), dibaca ulang dan isinya cocok: Hendro bruto 3.319.000 − 49.785
= 3.269.215; David 3.319.000 − 116.165 = 3.282.835; uang makan keduanya 773.300; total
6.472.050 dan 1.546.600. Data uji dihapus setelah pengujian.

**Perbaikan sekalian:** `rekap_*` berelasi satu-satu sehingga PostgREST mengirim **objek**,
bukan array — kolom tukin di tab *Sudah Unggah* sebelumnya bisa tampil “—”. Sekarang dibaca
lewat `satuRekap()` yang menerima keduanya.

**Belum:** unggah berkas **ke** Google Drive, isi HUKDIS/TB oleh admin saat verifikasi.

**Sudah (perbaikan lanjutan):** pembuatan akun otomatis saat pendaftaran disetujui,
cek status pendaftaran tanpa login, unduh bukti, dan catatan privasi NIP.
(Notifikasi email via Resend dinonaktifkan sementara — kredensial akun diberikan manual oleh admin.)

## Struktur kode (siap Vercel)

| Berkas | Peran |
|---|---|
| `app.mjs` | seluruh handler HTTP (API + berkas statis). Dipakai bersama lokal & Vercel. |
| `server.mjs` | hanya `createServer` + `listen` untuk lokal. |
| `api/[...jalur].mjs` | pintu masuk fungsi serverless Vercel untuk semua `/api/*`. |
| `mesin.mjs` | memuat `app.js` + `alat-drive.js`: pakai berkas asli di offline, atau salinan `public/lib/`. |
| `scripts/siapkan-mesin.mjs` | menyalin mesin offline ke `public/lib/` (dipakai browser & fungsi). |
| `vercel.json` | build `siapkan-mesin`, output `public`, `maxDuration` 60 detik. |

Menjalankan ulang salinan setelah mesin offline berubah:

```bash
node scripts/siapkan-mesin.mjs
```

Salinan di `public/lib/` **dibuat otomatis** — jangan diedit manual; sumbernya tetap
`aplikasi-offline/APLIKASI/app.js`. Di komputer lokal server tetap memakai berkas asli
(terlihat di log: `mesin hitung: aplikasi-offline (asli)`).

## Deploy Vercel

1. Import repo GitHub di Vercel → **Root Directory: `aplikasi-web`** (framework: *Other*).
2. **Environment Variables** (Production + Preview):
   `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`.
   Jangan pernah memakai kunci *service role/secret* di halaman web — hanya fungsi server
   yang membacanya; browser hanya menerima kunci publishable lewat `/api/konfigurasi`.
3. Deploy. Build menjalankan `node scripts/siapkan-mesin.mjs`; karena folder
   `aplikasi-offline` tidak ikut terunggah, skrip memakai salinan `public/lib/` yang sudah ada.
4. Di Supabase → *Authentication → URL Configuration*, isi **Site URL** dengan domain Vercel.
5. Batas waktu fungsi 60 detik (Hobby). Karena itu tab Ambil dari Drive mengirim satu file per
   permintaan; jangan mengubahnya menjadi satu permintaan untuk seluruh folder.

**Diuji (tiruan Vercel):** folder tanpa `aplikasi-offline` dan tanpa `.env.local` → mesin dimuat
`public/lib (salinan)`, `/lib/app.js` 200 (28.817 B), `/lib/pegawai.js` 200, halaman depan 200;
dengan kredensial hanya dari variabel lingkungan → `/api/konfigurasi` 200 dan query database jalan.

**Status Deploy Production (10 November 2026):**
- Domain / URL Live: `https://tool-tukin.vercel.app` (alias: `https://aplikasi-web-seven.vercel.app`)
- Direct Deployment: `https://aplikasi-lx09m8dw1-bastantabangun2024-1024.vercel.app`
- Environment variables (`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`) terpasang di Vercel Production & Preview.
- Seluruh endpoint diuji langsung: `/` 200, `/masuk.html` 200, `/admin.html` 200, `/lib/app.js` 200, `/api/konfigurasi` 200, `/api/pegawai` 200.

## Catatan Hari Ini (10 November 2026) — perbaikan lanjutan

### 1. Perbaikan upload Drive: duplicate key presensi
- Gejala: `Database: HTTP 409 {"code":"23505", ... "duplicate key value violates unique constraint presensi_pengajuan_id_tanggal_key"}` saat upload Drive (mis. pegawai "Winner", PPPK Bimas Buddha, bulan Oktober).
- Penyebab: baris `(pengajuan_id, tanggal)` yang sama sudah ada dari run sebelumnya (proses ganda / upload ulang) dan penghapusan awal tidak membersihkannya.
- Perbaikan di `app.mjs` (`simpanPengajuan`):
  - bersihkan pengajuan duplikat untuk pegawai & periode yang sama (cascade hapus sisa presensi/rekap lama);
  - hapus `presensi`/`rekap_*` milik pengajuan aktif sebelum insert;
  - retry otomatis pada insert `presensi`: jika masih `23505`, hapus ulang lalu coba lagi;
  - ubah insert `rekap_kehadiran`, `rekap_tukin`, `rekap_uang_makan` menjadi upsert (`on_conflict=pengajuan_id`, `resolution=merge-duplicates`).
- Commit: `a2d0301` — "Perbaiki upload Drive: tangani duplicate key presensi (pengajuan_id, tanggal)".
- Deploy: Vercel production `https://tool-tukin.vercel.app` (alias).

### 2. Ekspor rekap bulanan dipisah per bidang
- Tombol ekspor (Kehadiran/Tukin/Uang Makan) kini mengunduh satu berkas per bidang (nama file menyertakan bidang, mis. `Rekap Kehadiran Bimas Kristen OKT 2026.xlsx`); "Ketiga berkas" mengunduh semua kategori × semua bidang.
- Judul sheet juga menyertakan bidang.
- Perubahan: `public/rekap.js` (fungsi `kehadiran/tukin/uangMakan` menerima parameter `bidang`; tambah `susunPerBidang`), `public/admin.html` (`unduhRekap` memakai `susunPerBidang`).
- Verifikasi Node: `require('./public/rekap.js')` → `susunPerBidang` menghasilkan 1 grup per bidang dengan nama berkas yang benar.
- Commit: `e3d915d` — "Ekspor rekap bulanan dipisah per bidang".
- Deploy: Vercel production `https://tool-tukin.vercel.app`.

### Rencana besok
- Lanjut perbaikan lain (sesuai kebutuhan). Kode sudah di-push & di-deploy.

## Catatan Hari Ini (11 November 2026) — perbaikan pendaftaran

### 1. Halaman pendaftaran terpisah + bukti unduh
- `public/daftar.html` dibuat sebagai halaman pendaftaran terpisah (bukan lagi toggle di beranda).
- `index.html` diubah ke tautan `/daftar.html`; wording login diperbaiki.
- Validasi dasar di klien (NIP 18 digit, email wajib) sebelum kirim.
- Bukti pengajuan (index) dan bukti pendaftaran (daftar) dapat diunduh `.txt` (client-side).

### 2. Status pendaftaran tanpa beban Supabase
- Endpoint `GET /api/daftar/status?nip=&email=` (satu query terindeks) untuk cek status tanpa login.
- UI "Cek Status Pendaftaran" di `daftar.html`.

### 3. Persetujuan admin + akun + email
- Endpoint `POST /api/pendaftaran/putuskan` (admin) menangani setujui/tolak.
- Setujui: buat/aktifkan akun Supabase Auth, buat/tautkan baris `pegawai`, kirim email kredensial sementara.
- Tolak: ubah status + kirim email penolakan (+ catatan).
- Admin UI pendaftar diubah memakai endpoint ini; menampilkan password sementara bila email belum terkirim.
- Notifikasi email ke admin saat pendaftaran baru dikirim (best effort).
  **Nonaktif sementara** — lihat bagian 5.

### 4. Privasi NIP
- Lookup NIP hanya menampilkan data dasar (nama, jabatan, bidang, status); tukin/gaji tidak ditampilkan.
- Catatan privasi ditambahkan di beranda.

### 5. Email (Resend) — **NONAKTIF sementara**
- Status sekarang: **notifikasi email dimatikan**. Tanpa `EMAIL_NOTIFIKASI=aktif`, fungsi `kirimEmail()`
  langsung kembali tanpa menghubungi Resend, jadi tidak ada email ke admin maupun ke pegawai.
- Kredensial akun pegawai (dibuat saat pendaftaran disetujui) disampaikan **manual** oleh admin:
  dialog konfirmasi di tab Pendaftar menampilkan email + password sementara untuk disalin.
- Untuk mengaktifkan kembali: isi `EMAIL_NOTIFIKASI=aktif`, `RESEND_API_KEY`, dan `RESEND_FROM`
  dengan domain pengirim yang **sudah terverifikasi di Resend** (lihat `.env.example`).
- Integrasi Resend memakai `fetch` (tanpa dependency baru). Domain `*.vercel.app` **tidak bisa**
  diverifikasi karena DNS-nya bukan milik Anda; `onboarding@resend.dev` hanya bisa mengirim ke
  email pemilik akun Resend.

### Kekurangan / catatan
- Email real memerlukan domain pengirim terverifikasi; sementara itu notifikasi email dimatikan
  dan kredensial pegawai diberikan langsung oleh admin.
- Akun pegawai dibuat dengan password sementara dan status kepegawaian default `PPPK`; admin dapat menyesuaikan data pegawai setelahnya.
- Belum ada reset password mandiri / session expiry handling; pengguna mengandalkan email kredensial dari admin.
- Status check publik hanya memerlukan NIP + email; cukup untuk kebutuhan internal, tetapi belum ada rate limit.
- Tidak ada rollback bila pembuatan akun berhasil tetapi pembuatan baris `pegawai` gagal (jarang, perlu dicek manual).

### 6. Tombol Reset di tab Sudah Unggah
- Pada tab "Sudah Unggah", setiap penyuluh berstatus `menunggu_verifikasi` kini memiliki dua tombol: **Setujui** dan **Reset**.
- Tombol **Reset** menghapus pengajuan tersebut (beserta presensi & rekapnya lewat cascade) dari database,
  sehingga nama penyuluh hilang dari "Sudah Unggah" dan dari "Rekap".
- Tombol Reset juga tersedia untuk status `ditolak`/`perlu_perbaikan` agar data lama bisa dibersihkan.
- Rekap sudah memfilter status `ditolak`, dan setelah reset data otomatis tidak ikut rekap.
- Perubahan: `public/admin.html` (`renderTabelSudah` + handler `data-reset`).

### 7. Indikator progres saat "Proses Semua File" (Drive)
- Saat menekan **Proses Semua File**, kini tampil bar progres (0–100%) + teks "Progres: i / N file"
  dan nama file yang sedang diproses, plus pesan "Sedang memproses… harap tunggu".
- Setelah selesai, bar penuh (hijau) dan ringkasan "Selesai: X pegawai tersimpan".
- Tombol tetap nonaktif selama proses berlangsung.
- Perubahan: `public/admin.html` (fungsi `lanjut` + `selesai` pada tab Drive).
