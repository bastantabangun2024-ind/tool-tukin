# Tool Tukin — Perhitungan Tukin & Uang Makan

Aplikasi perhitungan Tukin (Tunjangan Kinerja) dan uang makan pegawai dari file presensi
`absensi.kemenag.go.id`. Terdiri dari dua bagian yang terpisah:

| Folder | Isi |
|---|---|
| `aplikasi-offline/` | Aplikasi lama (HTML/JS, tanpa server): `APLIKASI/`, `AMBIL-DARI-DRIVE/`, `CADANGAN/` (uji + diary), `TOOL-TUKIN-siap-upload.zip` |
| `aplikasi-web/` | Versi online: dokumen rancangan, migrasi database, halaman masuk, server lokal |
| `website.md` | Rencana lama + tambahan (10 tahap, TAHAP 1 = audit & rancangan) |

Rumus perhitungan ada di `aplikasi-offline/APLIKASI/app.js` dan menjadi **sumber kebenaran**;
versi web harus menghasilkan angka yang sama (uji paritas).

---

## Status per 10 November 2026

### Selesai

1. **Pemisahan folder** — aplikasi offline dipindah utuh ke `aplikasi-offline/`, aplikasi web
   disiapkan di `aplikasi-web/`; seluruh `require` relatif tetap jalan.
2. **TAHAP 1 — audit & rancangan** (`aplikasi-web/docs/01`–`04`): 19 temuan audit, arsitektur,
   skema database, checklist akun/API.
3. **Keputusan yang sudah diambil**
   - Penyimpanan berkas: **Google Drive** (Supabase hanya Auth + database).
   - **HUKDIS/TB aktif sekarang**, diisi admin per pengajuan (`hukdis_pct`, `tb_pct`).
   - Email + password untuk login; kunci Supabase baru (`sb_publishable_` / `sb_secret_`).
4. **TAHAP 2 — database Supabase** (sudah diterapkan, bukan draf):
   - 14 tabel, 8 enum, 25 policy RLS, trigger `updated_at`.
   - 11 bidang, 16 aturan potongan versi 1 (nilai identik `app.js`), 30 pegawai dari roster.
   - Admin pertama `bastantabangun2024@gmail.com` (peran `admin`), tercatat di `audit_log`.
5. **TAHAP 3 awal — halaman login lokal**:
   - `aplikasi-web/public/masuk.html` (email + password ke Supabase Auth),
     `public/dasbor.html` (profil, peran, ringkasan jumlah data untuk admin, tombol keluar).
   - `aplikasi-web/server.mjs`: server statis + `/api/konfigurasi` (hanya kunci publishable).
   - `aplikasi-web/jalankan-web.cmd`: klik dua kali untuk menjalankan server + buka browser.
6. **Ambil dari Drive di halaman admin** (10 Nov 2026, lanjutan):
   - Tab **Ambil dari Drive** di `public/admin.html`: tempel link folder Drive publik,
     pilih bulan + tahun → **Baca Folder** → daftar file → **Proses Semua File**.
   - `server.mjs` memakai pengambil Drive offline apa adanya
     (`aplikasi-offline/AMBIL-DARI-DRIVE/alat-drive.js`): tanpa kunci API, rekursif maks. 6 tingkat,
     melewati file rekap manual dan bulan lain, folder harus dibagikan "siapa saja yang punya link".
   - Nama file/folder dicocokkan ke daftar pegawai dengan aturan yang sama seperti `index.html`
     offline; file ganda untuk satu orang dipilih yang namanya jelas; nama ambigu dilaporkan.
   - Hasil: `pengajuan_tukin` + `presensi` + 3 tabel rekap per pegawai, status `menunggu_verifikasi`.
7. **Deploy Vercel Production Selesai & Live**:
   - Project `aplikasi-web` berhasil di-link dan di-deploy ke Vercel production.
   - Variabel lingkungan (`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`) telah disinkronkan ke Vercel.
   - Seluruh halaman publik, admin, mesin hitung di browser (`/lib/app.js`), dan endpoint serverless (`/api/konfigurasi`, `/api/pegawai`, dll.) telah diverifikasi live & aktif terhubung ke Supabase.
8. **Pemantau Pegawai Sudah & Belum Mengunggah Presensi**:
   - Tab **Sudah Unggah** kini dilengkapi pemilih periode (Bulan & Tahun), filter bidang, serta kartu ringkasan status (*Sudah Mengunggah*, *Belum Mengunggah*, *Menunggu Verifikasi*, *Disetujui*).
   - Admin dapat beralih ke sub-tab **Belum Mengunggah** untuk melihat langsung daftar nama, NIP, bidang, dan jabatan pegawai yang belum mengirimkan presensi pada periode tersebut, lengkap dengan tombol **Salin Daftar Belum Unggah** untuk dibagikan ke WhatsApp.
   - Di tab **Ekspor Rekap**, sistem otomatis menampilkan notifikasi peringatan jika masih ada pegawai aktif yang belum mengunggah presensi sebelum admin mengunduh laporan Excel.

### Alamat & akun

| Keperluan | Alamat |
|---|---|
| Website Live (Vercel) | https://tool-tukin.vercel.app |
| Halaman masuk / login | https://tool-tukin.vercel.app/masuk.html |
| Halaman Admin | https://tool-tukin.vercel.app/admin.html |
| Halaman masuk (lokal) | http://localhost:3000/masuk.html |
| Dasbor (lokal) | http://localhost:3000/dasbor.html |
| Dashboard Supabase | https://supabase.com/dashboard/project/nbgwulqufumtqnmlghef |
| API project | `https://nbgwulqufumtqnmlghef.supabase.co` |

Login memakai **email**, bukan username. Password admin dibuat acak saat pembuatan akun dan
ditampilkan **sekali** di layar — tidak disimpan di file mana pun dan tidak ditulis di README ini.
Segera ganti setelah menu akun tersedia.

### Cara menjalankan halaman web

```bash
cd aplikasi-web
node server.mjs          # lalu buka http://localhost:3000/masuk.html
```

Di Windows cukup klik dua kali `aplikasi-web/jalankan-web.cmd`. Jendela server harus tetap
terbuka selama aplikasi dipakai. Halaman ini masih lokal (belum di Vercel).

### Bukti uji hari ini

- `aplikasi-offline/CADANGAN/uji-app.js` → 141 asersi LULUS; `uji-presensi-terpisah.js` → 85 LULUS
  (mesin hitung offline tidak berubah).
- Migrasi diuji di **Postgres asli (PGlite)** dengan stub `auth.uid()`: 25 asersi LULUS
  (pengajuan ganda ditolak, `hukdis_pct > 100` ditolak, migrasi aman dijalankan dua kali).
- `aplikasi-web/scripts/cek-skema.mjs` ke project Supabase → SEMUA CEK LULUS
  (14 tabel, 25 policy, 11 bidang, 16 aturan, 30 pegawai).
- Uji RLS dengan token login: admin lihat 30 pegawai & boleh ubah `pengaturan`; anon tidak
  lihat `pengaturan` dan ditolak menulis `pegawai` (HTTP 401); `direktori_pegawai()` publik
  hanya `nama, nip_masked, bidang, jabatan`.
- Halaman: `/`, `/masuk.html`, `/dasbor.html` → HTTP 200; path tak dikenal → 404;
  login admin → 200 + peran `admin`; password salah → 400.
- **Ambil dari Drive** dengan folder asli Bapak ("9. SEPTEMBER 2026", 20 file presensi):
  14–15 pegawai tersimpan otomatis, tukin/uang makan sama dengan hitungan `app.js`, file rekap
  manual & 50+ berkas PDF/JPG dilewati, nama ambigu (DAVID, NELLY) dilaporkan. Data uji dihapus.
- **Deploy Vercel Production**:
  - Domain Utama: `https://tool-tukin.vercel.app` (alias lama: `https://aplikasi-web-seven.vercel.app`)
  - URL pengujian endpoint:
    - `/` (200 OK)
    - `/masuk.html` (200 OK)
    - `/admin.html` (200 OK)
    - `/lib/app.js` (200 OK, 28.8 KB)
    - `/api/konfigurasi` (200 OK, mengembalikan Supabase URL & publishable key)
    - `/api/pegawai?nip=197904112025211007` (200 OK, data pegawai Supabase berhasil dibaca)

### Belum dikerjakan

- Unggah berkas **ke** Google Drive (OAuth admin). Pembacaan folder Drive sudah jalan.
- Pilihan HUKDIS/TB oleh admin untuk hasil yang masuk lewat Drive (tidak ada input per file).
- Mesin hitung di web (port `app.js` + uji paritas angka terhadap golden test).
- Isi HUKDIS/TB oleh admin saat verifikasi pengajuan.
- Isi `hari_libur` (libur nasional 2026) agar tidak dihitung sebagai hari kerja.
- Domain khusus (kustom) bila dibutuhkan (saat ini sudah live di domain Vercel).
- Ganti password admin.

---

## Catatan Evaluasi & Kekurangan Ide Website (Perspektif Pegawai / PPPK)

*Simulasi pengalaman pengguna saat bertindak sebagai salah satu pegawai (misal: PPPK Penyuluh Agama Kristen) yang menggunakan website ini secara mandiri:*

### 1. Ketiadaan Dasbor Akun Pegawai (Tidak Ada Riwayat / Self-Service)
* **Kondisi Saat Ini:** Pegawai hanya bisa memasukkan NIP, unggah file, dan melihat ringkasan satu kali di layar. Begitu halaman ditutup atau refresh, pegawai tidak bisa lagi memantau status pengajuannya.
* **Keluhan Pegawai:** *"Apakah berkas saya sudah disetujui atau ditolak admin? Berapa uang makan saya bulan lalu? Saya tetap harus chat WA manual ke admin kepegawaian untuk tanya status."*
* **Rekomendasi:** Aktifkan login mandiri pegawai (berbasis email/password dari menu Daftar) sehingga pegawai punya dasbor arsip bulanan (bisa melihat riwayat slip tukin & uang makan dari bulan-bulan sebelumnya).

### 2. Isu Privasi & Keamanan (Form NIP Terbuka Bebas)
* **Kondisi Saat Ini:** Siapa pun di internet bisa mengetik 18 digit NIP pegawai lain di halaman depan tanpa login. Nama, jabatan, golongan, dan bidang langsung muncul terbuka.
* **Keluhan Pegawai:** *"Data kepegawaian dan estimasi tukin saya bisa dilihat atau bahkan diisengi orang lain yang tahu NIP saya."*
* **Rekomendasi:** Batasi pencarian data/unggah file hanya untuk pengguna yang sudah login, atau tambahkan verifikasi tanggal lahir / PIN sederhana jika tetap tanpa login.

### 3. Tidak Ada Bukti Tanda Terima / Unduh Slip Pengajuan
* **Kondisi Saat Ini:** Setelah klik Proses, hanya muncul pesan *"Selamat Data Anda Sudah Terupload"*.
* **Keluhan Pegawai:** *"Jika sewaktu-waktu admin bilang saya belum mengumpulkan presensi, saya tidak memegang bukti digital bahwa saya sudah kirim tepat waktu sebelum deadline."*
* **Rekomendasi:** Tambahkan tombol **"Unduh Bukti Pengajuan (PDF / Struk)"** yang mencantumkan nama, NIP, tanggal & jam submit, serta ringkasan kehadiran.

### 4. Beban Alur Manual Pengambilan File dari Portal Resmi
* **Kondisi Saat Ini:** Pegawai harus membuka `absensi.kemenag.go.id`, login, unduh file Excel bulanan ke perangkat, lalu buka web Tool Tukin ini untuk unggah ulang.
* **Keluhan Pegawai:** *"Bagi penyuluh yang tugas di lapangan dan hanya bawa ponsel pintar, proses unduh xlsx dari web kemenag lalu upload ke web ini di browser HP lumayan merepotkan dan rawan salah unduh bulan."*
* **Rekomendasi:** Berikan validasi ekstra di frontend jika file Excel yang diunggah pegawai ternyata bukan periode bulan/tahun yang dipilih di dropdown agar pegawai tidak keliru.

### 5. Ketidakpastian Potongan Tambahan (HUKDIS / TB) & Ketiadaan Kolom Catatan
* **Kondisi Saat Ini:** Pegawai melihat angka tukin bersih di web, namun ada keterangan *"Potongan HUKDIS/TB diisi admin saat verifikasi"*.
* **Keluhan Pegawai:** *"Angka bersih yang saya lihat di web belum tentu sama persis dengan yang saya terima di rekening bank karena admin bisa menambah potongan di belakang tanpa saya ketahui alasannya."*
* **Rekomendasi:** Sediakan kolom **"Catatan / Keterangan Pegawai"** (misal: keterangan surat tugas dinas luar atau dispensasi) saat mengunggah, dan transparansi rincian potongan jika admin menerapkan HUKDIS/TB saat verifikasi.

### 6. Ketiadaan Notifikasi Real-Time (WhatsApp / Email)
* **Kondisi Saat Ini:** Pegawai tidak mendapat notifikasi otomatis saat pengajuannya disetujui atau ditolak dengan catatan perbaikan.
* **Rekomendasi:** Integrasikan notifikasi email otomatis (atau pesan WhatsApp via bot gateway sederhana) begitu admin mengklik **Setujui** atau **Tolak** di dasbor admin.

---

## Menyimpan perubahan ke GitHub (aman)

Repo: `https://github.com/bastantabangun2024-ind/tool-tukin` (private).
Alur singkat setiap kali selesai mengubah sesuatu — jalankan di folder `tool-tukin`:

```bash
git status                 # lihat apa yang berubah
git diff                   # baca isi perubahannya
git add -A
git diff --cached --name-only | grep -E '\.env|node_modules|username pasword'   # harus kosong
git commit -m "Penjelasan singkat perubahan"
git push
```

**Aturan aman:**

1. **Jangan pernah** `git add` paksa file rahasia: `.env.local`, `username pasword.txt`,
   `*.pem`. Ketiganya sudah masuk `.gitignore`; kalau `grep` di atas mengeluarkan hasil,
   batalkan dengan `git restore --staged <berkas>`.
2. Repo wajib **private** — `aplikasi-offline/CADANGAN/permasalahan/` berisi presensi asli pegawai.
3. Satu commit = satu perubahan yang jelas. Hindari `git commit -a` tanpa memeriksa `git status`.
4. Bila ada perubahan dari komputer lain: `git pull --rebase` dulu, baru `git push`.
5. Kalau kunci `.env.local` **terlanjur** ter-commit: jangan hanya hapus filenya — segera
   ganti kunci di Supabase (Settings → API) karena riwayat git tetap menyimpannya.
6. Menambah berkas baru pada mesin hitung offline? Jalankan `node aplikasi-web/scripts/siapkan-mesin.mjs`
   lebih dulu agar salinan `public/lib/` ikut berubah, lalu commit keduanya.

---

## Berkas penting

```
aplikasi-offline/APLIKASI/app.js              mesin hitung (sumber kebenaran rumus)
aplikasi-offline/CADANGAN/uji-app.js          uji regresi mesin hitung
aplikasi-offline/CADANGAN/hasil-hari-ini.md   diary pekerjaan
aplikasi-web/docs/01..04                      audit, arsitektur, skema, setup akun
aplikasi-web/supabase/migrations/0001..0003   skema + seed (sudah diterapkan)
aplikasi-web/scripts/                         migrasi, cek skema, buat admin, seed pegawai
aplikasi-web/app.mjs                          handler HTTP (lokal + Vercel)
aplikasi-web/api/[...jalur].mjs               fungsi serverless Vercel
aplikasi-web/vercel.json                     konfigurasi deploy Vercel
aplikasi-web/public/                          halaman masuk, dasbor, admin, public/lib
aplikasi-web/.env.example                     daftar variabel (tanpa nilai rahasia)
```

Kredensial disimpan di `aplikasi-web/.env.local` (diabaikan git). Jangan pernah mengirim isi
file itu lewat chat, dan jangan menaruh `sb_secret_` di frontend.
