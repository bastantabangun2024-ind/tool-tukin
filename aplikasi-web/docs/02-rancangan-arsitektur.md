# 02 — Rancangan Arsitektur (TAHAP 1)

Tanggal: 10 November 2026
Status: **rancangan, belum diimplementasi.** Tahap 2 dikerjakan setelah disetujui.

---

## 1. Keputusan arsitektur yang diusulkan

| Hal | Pilihan | Alasan |
|---|---|---|
| Frontend | **HTML + CSS + JavaScript biasa, tanpa build step**, memakai `supabase-js` dari CDN | Sesuai instruksi "pertahankan teknologi aplikasi lama"; tidak menambah tooling |
| Hosting | **Vercel** — frontend statis di `public/`, proses di `api/` (Node Serverless Function) | Sesuai `website.md` bagian C |
| Database & Auth | **Supabase** (PostgreSQL + Auth + RLS + Storage) | Sesuai instruksi |
| Proses Excel | Fungsi serverless `api/presensi/proses.js` memakai paket `xlsx` + mesin `app.js` | File tidak diproses di browser, hasil tidak bisa dimanipulasi pegawai |
| Mesin hitung | **Salinan identik** `aplikasi-offline/APLIKASI/app.js` → `lib/engine/tukin-engine.js`, dijaga skrip sinkron + uji paritas | "Jangan membangun ulang mesin perhitungan dari nol" |
| Penyimpanan berkas | **Google Drive** — berkas presensi & hasil rekap (keputusan 10 Nov 2026) | Admin sudah terbiasa dengan Drive; mudah dibagikan; Supabase Storage tidak dipakai |
| Akses Drive | **Drive API + OAuth** di server; refresh token admin tersimpan terenkripsi di tabel `pengaturan` | Mengganti helper `127.0.0.1` yang tidak mungkin dipakai online; tidak ada rahasia di browser |
| HUKDIS / TB | **Aktif sejak awal** (keputusan 10 Nov 2026), diisi admin saat verifikasi | Potongan disiplin & tugas belajar langsung terhitung, tetap tercatat per pengajuan |
| Bahasa | Indonesia, warna navy + putih, sidebar admin, kartu hasil, tabel responsif | Sesuai bagian 19 |

Catatan: `website.md` bagian A–I menyebut "1 admin saja", sedangkan tambahan dari ChatGPT
menjelaskan alur **banyak pegawai + pendaftaran + verifikasi admin**. Rancangan ini mengikuti
versi kedua; versi "1 admin" menjadi bagian kecil darinya (admin tetap memproses file secara massal).

---

## 2. Diagram

```
Pegawai (browser)                        Admin (browser)
   │  login (Supabase Auth, JWT)             │
   ▼                                         ▼
Vercel — public/ (statis: index, daftar, masuk, layanan, hasil, admin/*)
   │ fetch + Bearer token                    │
   ▼                                         ▼
Vercel — api/* (Node serverless)
   ├─ presensi/proses      : validasi → mesin tukin → simpan
   ├─ pengajuan/kirim      : draft → menunggu_verifikasi
   ├─ admin/verifikasi     : setujui / tolak / minta perbaikan
   ├─ hasil/unduh          : susun 3 workbook + signed URL
   ├─ rekap                : rekap & ekspor per periode/bidang
   └─ drive/*              : Google Drive API (khusus admin)
        │
        ├── Supabase: Postgres (RLS) + Storage privat + Auth
        └── Google Drive API (opsional, arsip)
```

Kunci: **browser tidak pernah menerima `SUPABASE_SERVICE_ROLE_KEY`**. Semua penulisan hasil
perhitungan hanya lewat fungsi server; RLS menjadi lapisan kedua untuk akses langsung.

---

## 3. Peran dan hak akses

| Kemampuan | Pegawai | Admin |
|---|---|---|
| Daftar akun (status menunggu) | ✅ | — |
| Login | ✅ (setelah disetujui) | ✅ |
| Melihat identitas sendiri (nama, NIP, gol, jabatan, bidang) | ✅ | ✅ |
| Upload presensi + proses bulan/tahun | ✅ | ✅ (atas nama siapa pun) |
| Mengubah aturan potongan | ❌ | ✅ |
| Melihat pengajuan orang lain | ❌ | ✅ (semua bidang) |
| Verifikasi / tolak / minta perbaikan | ❌ | ✅ |
| Mengubah hasil perhitungan yang sudah disetujui | ❌ | ✅ (tercatat di audit log) |
| HUKDIS / TB | ❌ (lihat saja) | ✅ |

---

## 4. Halaman

| Rute | Akses | Isi |
|---|---|---|
| `/` | publik | Identitas aplikasi, 2 menu: **LOGIN ADMIN**, **DAFTAR PEGAWAI**, tautan layanan pegawai |
| `/daftar` | publik | Form: nama, NIP, pangkat/golongan, jabatan, bidang (11 pilihan), email, password, konfirmasi |
| `/masuk` | publik | Email + password (admin & pegawai; peran dibaca dari `users.peran`) |
| `/layanan` | pegawai | Input NIP (terisi otomatis, tidak bisa diubah), identitas dari DB, upload xlsx, pilih bulan & tahun, **PROSES** |
| `/hasil` | pegawai | Kartu kehadiran, tukin, uang makan + rincian per hari; tombol **KIRIM KE ADMIN** |
| `/admin` | admin | Statistik: total pegawai, disetujui, pendaftar baru, sudah upload, menunggu verifikasi, disetujui, per bidang |
| `/admin/pendaftar` | admin | Daftar pendaftar, detail, setujui/tolak, perbaikan data + riwayat |
| `/admin/pegawai` | admin | CRUD pegawai, cari, filter bidang, import/export Excel |
| `/admin/verifikasi` | admin | Detail pengajuan + file + rincian + tombol setujui/tolak/perbaikan/unduh/cetak |
| `/admin/rekap` | admin | Rekap Kehadiran / Tukin / Uang Makan, filter bulan-tahun-bidang-nama-NIP-status, export Excel, cetak PDF |
| `/admin/aturan` | admin | Aturan potongan (nama, persen, satuan, dasar hukum, berlaku mulai, aktif) + riwayat versi |
| `/admin/drive` | admin | Sambungkan Google Drive, pilih folder, daftar & ambil file presensi |
| `/akun` | pegawai | Profil, status pengajuan, riwayat |

Desain: sidebar admin, kartu statistik, tabel dengan pencarian; semua bahasa Indonesia;
responsif (tabel bisa digulir horizontal di HP).

---

## 5. Endpoint server

| Method & path | Akses | Fungsi |
|---|---|---|
| `POST /api/presensi/proses` | pegawai/admin | `multipart`: `file`, `bulan`, `tahun`; memvalidasi, menghitung, menyimpan `file_presensi` + `presensi` + `rekap_*`, status `draft`; mengembalikan ringkasan + daftar anomali |
| `POST /api/pengajuan/kirim` | pegawai | `{pengajuan_id}` → `menunggu_verifikasi`; cegah pengajuan ganda |
| `GET /api/pengajuan/:id` | pemilik/admin | Ringkasan + rincian harian |
| `POST /api/admin/verifikasi` | admin | `{pengajuan_id, aksi: setujui/tolak/perbaikan, catatan, hukdis_pct, tb_pct}`; menulis `audit_log` |
| `GET /api/hasil/unduh?pengajuan_id=` | pemilik/admin | Menyusun 3 workbook → signed URL (berlaku 5 menit) |
| `GET /api/rekap?bulan&tahun&bidang&status` | admin | JSON rekap + `format=xlsx` untuk ekspor |
| `POST /api/drive/daftar` | admin | `{folder_id, periode}` → daftar file xlsx (rekursif, saring rekap/gambar) |
| `POST /api/drive/ambil` | admin | `{file_id}` → isi file (diteruskan ke pipeline proses) |
| `GET /api/drive/oauth/callback` | admin | Menukar `code` → refresh token, simpan di `pengaturan` |

Batasan teknis Vercel yang harus dipatuhi:
- body request ≤ **4,5 MB** → satu file per panggilan (file presensi ±10–30 KB, aman);
- `maxDuration` default 10 detik (Hobby) → proses 1 orang cukup <1 detik; ekspor bidang
  berisi 20 orang juga cepat, tetapi tetap diuji;
- runtime Node, `xlsx` versi sesuai `package.json` web (bukan `xlsx.full.min.js` browser).

---

## 6. Alur kerja

### 6.1 Pegawai

```
daftar → (admin setujui) → login → /layanan
  → input NIP (otomatis) → pilih bulan & tahun → upload xlsx → PROSES
  → validasi lulus?  tidak → pesan galat spesifik, tidak ada data disimpan
                     ya    → simpan draft + tampilkan /hasil
  → periksa ringkasan (kehadiran, tukin, uang makan + rincian harian)
  → KIRIM KE ADMIN → "SELAMAT, DATA ANDA BERHASIL DIUNGGAH…" → status menunggu_verifikasi
  → (admin minta perbaikan) → upload ulang → kirim lagi
  → (disetujui) → hasil dikunci, pegawai bisa unduh Excel
```

### 6.2 Admin

```
login → /admin (statistik) → /admin/pendaftar (setujui pendaftar)
  → /admin/verifikasi (periksa satu per satu: berkas, rincian, HUKDIS/TB)
  → setujui / tolak / minta perbaikan → hasil disetujui terkunci + audit log
  → /admin/rekap (per bulan/bidang) → export Excel / cetak PDF
  → /admin/drive (opsional: tarik berkas presensi dari Drive)
```

### 6.3 Status pengajuan

`draft → menunggu_verifikasi → sedang_diperiksa → { perlu_perbaikan → menunggu_verifikasi,
disetujui, ditolak }`

Aturan kunci:
- satu baris `pengajuan` per `(pegawai_id, tahun, bulan)`; pengajuan ulang memakai baris yang
  sama dan hanya boleh bila status `perlu_perbaikan`/`ditolak` atau admin menyalakan
  `izinkan_ulang`;
- hasil berstatus `disetujui` tidak bisa diubah pegawai; perubahan hanya oleh admin dan tercatat;
- `aturan_versi` + snapshot aturan disimpan pada pengajuan, sehingga hasil periode lama
  tidak berubah ketika admin mengubah aturan.

---

## 7. Validasi upload (detail)

Dijalankan seluruhnya di server sebelum data disimpan.

| Pemeriksaan | Aturan | Perilaku |
|---|---|---|
| Jenis file | ekstensi `.xlsx`, isi diawali `PK` (zip), maks 2 MB | tolak |
| Struktur | sheet pertama punya `TANGGAL` & `JAM MASUK` di 10 baris pertama; ≥1 baris tanggal | tolak |
| Periode | bulan & tahun dari kolom TANGGAL harus sama dengan pilihan pegawai | tolak |
| Nama file | pola `NAMA_Presensi BULAN-TAHUN.xlsx` (kalau tidak sesuai: hanya peringatan) | peringatan |
| Nama pegawai | nama file (bila ada) cocok dengan `pegawai.nama`/`namaKey` | peringatan; admin bisa lanjut |
| NIP | file presensi **tidak memuat NIP** → kepemilikan dari sesi login | keterbatasan yang didokumentasikan |
| Duplikat | `(pegawai_id, tahun, bulan)` sudah ada **atau** `sha256` file sama | tolak dengan pesan |
| Anomali | pulang kosong >4 jam lebih awal, jam di luar 00:00–23:59, tanggal ganda, hari Sabtu/Minggu berpresensi | tampilkan "perlu dicek"; tetap boleh simpan `draft` |
| Baris tanpa presensi & tanpa alasan | dihitung TK sesuai aturan aktif | tampil di ringkasan sebelum kirim |

Prinsip: **data yang formatnya salah tidak pernah disimpan**; data yang hanya *mencurigakan*
disimpan sebagai `draft` dengan penanda, dan baru boleh dikirim setelah pegawai melihat peringatannya.

---

## 8. Pemakaian mesin hitung (TAHAP 6)

1. `scripts/sync-engine.mjs` menyalin `../aplikasi-offline/APLIKASI/app.js` →
   `lib/engine/tukin-engine.js` dan membandingkan checksum SHA-256; gagal bila berbeda.
2. Adapter `lib/engine/index.js` menyetel `global.XLSX` lalu `require('./tukin-engine.js')`.
3. Perubahan mesin **hanya satu arah**: offline → web. Mesin web tidak boleh diubah manual.
4. `scripts/uji-paritas.mjs` menjalankan `uji-app.js` + `uji-presensi-terpisah.js` memakai engine
   salinan; hasilnya harus sama dengan versi offline (golden test di `01` bagian 6).
5. Untuk aturan yang bisa diubah admin, `prosesSatuOrang` diberi parameter aturan opsional
   (`ATURAN`) dengan **nilai default persis seperti sekarang**:

```js
// nilai default = perilaku offline hari ini
ATURAN = {
  tkPersenPerHari: 3,
  tidakPresensiPersen: 1.5,
  tanggaTelat: [{ maksMenit: 29, persen: 0.5 }, { maksMenit: 60, persen: 1 },
                { maksMenit: 89, persen: 1.25 }, { maksMenit: null, persen: 1.5 }],
  batasTotalPersen: 100,
  jamMasukWajib: '08:00',
  jamPulang: '16:30',
  jamPulangJumat: '17:00'
}
```

Uji paritas wajib membuktikan: dengan `ATURAN` default, keluaran **byte-identik** dengan versi offline.

---

## 9. Google Drive — penyimpanan utama + pengambilan berkas (TAHAP 8)

Keputusan 10 November 2026: **berkas disimpan di Drive**, bukan di Supabase Storage.
Supabase tetap menyimpan database & autentikasi saja.

- OAuth 2.0 **server-side**, scope `drive.readonly` (membaca folder presensi yang sudah ada)
  + `drive.file` (membuat folder & file hasil).
- Admin menekan "Sambungkan Drive" → consent → `refresh_token` disimpan **terenkripsi**
  di tabel `pengaturan` (kunci `ENCRYPTION_KEY`), tidak pernah dikirim ke browser.
- Susunan folder yang dibuat aplikasi:
  ```
  TUKIN/<TAHUN>/<BULAN>/presensi/<NIP>_Presensi <B>-<TAHUN>.xlsx
  TUKIN/<TAHUN>/<BULAN>/hasil/Rekapitulasi {Kehadiran,Tukin,Uang Makan} Bimas <BIDANG>[ PNS] <LABEL>.xlsx
  ```
- Database menyimpan metadata: `file_presensi.drive_file_id`, `drive_folder_id`, `sha256`,
  ukuran, periode. Isi berkas tidak diduplikasi di Supabase.
- `api/drive/daftar` menelusuri folder rekursif memakai **Drive API** (`files.list`), menyaring
  nama berawalan REKAP/SALINAN, PDF, JPG, PNG — logika penyaring dipakai ulang dari `app.js`.
- Bulan-tahun dibaca dari nama file **atau jalur folder** (`periodeDariJalur`), sama seperti offline.
- `DRIVE_FOLDER_ID` / `DRIVE_FOLDER_HASIL_ID` disimpan sebagai pengaturan, bukan env, supaya
  admin bisa mengganti per periode tanpa deploy.
- Tanpa OAuth, fitur Drive nonaktif; unggah manual tetap jalan penuh (berkas tetap diunggah
  ke Drive saat proses).
- Catatan operasional: aplikasi tampil sebagai *unverified app* sampai verifikasi Google selesai;
  admin perlu didaftarkan sebagai test user (lihat `04-setup-akun-dan-api.md`).

---

## 10. Keamanan

| Kebutuhan | Cara |
|---|---|
| Password | Supabase Auth (bcrypt), tidak pernah disimpan sendiri |
| Otorisasi data | RLS di semua tabel + fungsi `is_admin()` |
| Pegawai hanya lihat miliknya | policy `pegawai.user_id = auth.uid()` untuk `select`; `insert` hanya untuk dirinya |
| File presensi tidak publik | bucket privat; akses hanya signed URL 5 menit lewat fungsi server |
| Service role key | hanya di env Vercel, tidak pernah ke frontend |
| Validasi upload | bagian 7 |
| Pengajuan ganda | unique index + cek hash file |
| Audit | `audit_log` untuk setujui/tolak/perbaikan/ubah aturan/ubah data pegawai |
| Hasil disetujui | dikunci di level API; perubahan hanya admin + tercatat |
| Backup | Supabase PITR/backup harian (paket sesuai kebutuhan) |
| Rate limit | pembatasan sederhana di fungsi proses (mis. 10 proses/menit/pengguna) |

---

## 11. Environment variable (Vercel)

Template lengkap: `aplikasi-web/.env.example`; file isian: `aplikasi-web/.env.local`.

```
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY      # sb_publishable_... (boleh di browser)
SUPABASE_SECRET_KEY           # sb_secret_...      (server saja)
# alias lama bila project belum punya kunci baru:
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY

GOOGLE_CLIENT_ID              # wajib (Drive = penyimpanan)
GOOGLE_CLIENT_SECRET          # server saja
GOOGLE_REDIRECT_URI
GOOGLE_OAUTH_SCOPES           # drive.readonly + drive.file
DRIVE_FOLDER_ID               # opsional, bisa diisi dari /admin/drive
DRIVE_FOLDER_HASIL_ID         # opsional

APP_BASE_URL
ADMIN_EMAIL=bastantabangun2024@gmail.com
ENCRYPTION_KEY                # openssl rand -base64 32
TZ=Asia/Jakarta

VERCEL_TOKEN                  # opsional, hanya CLI deploy
```

Supabase mempensiunkan kunci `anon`/`service_role` akhir 2026; gunakan
`sb_publishable_...`/`sb_secret_...`. Tidak ada API key Vercel yang dipakai aplikasi.

---

## 12. Rencana 10 tahap

| Tahap | Isi | Status |
|---|---|---|
| 1 | Audit aplikasi lama + rancangan arsitektur | ✅ selesai (dokumen ini) |
| 2 | Project Supabase, skema tabel, RLS, admin pertama | ⏳ menunggu persetujuan |
| 3 | Halaman depan, daftar pegawai, login | ⏳ |
| 4 | Dashboard admin + data pendaftar + data pegawai | ⏳ |
| 5 | Halaman layanan pegawai (NIP, upload, bulan/tahun) | ⏳ |
| 6 | Migrasi mesin hitung (salinan + aturan berversi + uji paritas) | ⏳ |
| 7 | Proses Excel server + validasi + pengiriman ke admin | ⏳ |
| 8 | Verifikasi, rekapitulasi, export/cetak, pengaturan aturan, Google Drive | ⏳ |
| 9 | Pengujian menyeluruh (paritas, RLS, alur status, anomali) | ⏳ |
| 10 | Deployment Vercel + domain + dokumentasi pemakaian | ⏳ |

Estimasi kasar: tahap 2–5 ± 1 sesi besar, 6–7 ± 1 sesi, 8–10 ± 1 sesi; bergantung pada
keputusan di bawah.

---

## 13. Keputusan yang perlu diambil sebelum TAHAP 2

1. ✅ **Penyimpanan hasil** — diputuskan 10 Nov 2026: **Google Drive** (presensi + hasil).
2. **Login pegawai**: email + password (disarankan) atau NIP + password?
3. **Notifikasi**: cukup di dalam aplikasi (disarankan) atau email saat akun disetujui/ditolak?
4. ✅ **HUKDIS & TB** — diputuskan 10 Nov 2026: **diaktifkan sekarang**, diisi admin
   saat verifikasi (persen per pengajuan, tercatat di `rekap_tukin` + `audit_log`).
5. **Aturan yang bisa diubah**: hanya persen & jam kerja (disarankan), atau seluruh tangga
   termasuk batas 100% dan aturan PPH?
6. **Aturan PMA yang belum dihitung** (sakit 15+ hari, cuti besar, tugas belajar, alasan penting
   >2 hari, "tidak di tempat tugas" 2%/hari): diaktifkan sekarang, atau nanti setelah verifikasi
   dengan juknis?
7. **Hari libur nasional**: perlu tabel hari libur (disarankan) atau tetap Senin–Jumat saja?
8. **Periode**: tetap memakai **bulan presensi** (Oktober dibayar November), bukan bulan pembayaran?
9. **Format Excel**: tetap identik manual (rupiah teks) atau ditambah kolom angka untuk SUM?
10. **Roster awal**: import dari `pegawai.js` (30 pegawai, disarankan) atau import Excel dari admin?
