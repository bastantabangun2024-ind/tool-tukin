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
Server ini hanya untuk lokal; deploy Vercel belum dikerjakan.

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
3. **Ambil dari Drive** — tempel link folder Drive publik + bulan/tahun, **Baca Folder**
   (menampilkan file yang ketemu & yang dilewati), lalu **Proses Semua File**: presensi diunduh,
   nama file/folder dicocokkan dengan daftar pegawai, dihitung, dan disimpan `menunggu_verifikasi`.
   Memakai `aplikasi-offline/AMBIL-DARI-DRIVE/alat-drive.js` apa adanya (tanpa kunci API),
   aturan pencocokan nama sama dengan `index.html` offline.
4. Pengaturan Potongan — 16 aturan versi 1, nilai bisa diubah lalu disimpan.

**Endpoint baru (`server.mjs`)**
- `GET /api/pegawai?nip=` — identitas pegawai, tanpa tukin.
- `POST /api/proses` — memakai `aplikasi-offline/APLIKASI/app.js` apa adanya (bukan salinan),
  menyimpan `pengajuan_tukin` + `presensi` + 3 tabel rekap.
- `POST /api/daftar` — menyimpan pendaftaran status `menunggu`.
- `POST /api/drive/daftar` — baca folder Drive (`{ link, bulan, tahun }`) → daftar file presensi,
  yang dilewati, dan pesan (folder arsip disaring bulan/tahun).
- `POST /api/drive/proses` — unduh + hitung + simpan semua file dari folder Drive sekaligus.
- `GET /lib/app.js`, `/lib/xlsx.full.min.js` — mesin hitung disajikan langsung dari folder offline.

**Diuji:** file `Hendro_Presensi 10-2026.xlsx` (31 baris) → hadir 21, tukin bersih 3.269.215,
uang makan bersih 773.300, sama persis dengan hitungan `app.js` langsung; rincian harian
31 baris, ketiga rekap tersimpan, status `menunggu_verifikasi`; pendaftaran tersimpan `menunggu`.
Data uji dihapus setelah pengujian.

**Diuji juga (Drive):** folder "9. SEPTEMBER 2026" → 20 file presensi, 15 pegawai tersimpan
(hadir/tukin sama dengan `app.js`), file rekap manual + PDF/JPG dilewati, nama ambigu (DAVID,
NELLY) dilaporkan, link ngawur → HTTP 400. Data uji dihapus setelah pengujian.

**Belum:** unggah berkas **ke** Google Drive, pilihan pegawai untuk nama ambigu, isi HUKDIS/TB
oleh admin saat verifikasi, ekspor 3 file Excel, dan pembuatan akun otomatis saat pendaftaran
disetujui.
