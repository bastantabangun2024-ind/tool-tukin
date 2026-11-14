# Aplikasi Web — Sistem Informasi Tukin & Uang Makan

Status: **berjalan di produksi** — https://tool-tukin.vercel.app (Vercel + Supabase).
Dokumen audit/rancangan di `docs/` tetap dipakai sebagai acuan; ringkasan perubahan terbaru
ada di bagian **Perubahan 14 November 2026** di bawah.

Keputusan 10 November 2026: **berkas disimpan di Google Drive** (Supabase hanya Auth + database),
dan **potongan HUKDIS/TB diaktifkan sejak awal** (diisi admin saat verifikasi).
File kredensial yang perlu diisi: `.env.local` (template: `.env.example`).

## Perubahan 14 November 2026 (revisi 1–7)

Ringkasan pekerjaan revisi yang diminta:

1. **No. WA pada Data Pegawai.** Form admin mendapat isian **No. WA / HP**, tabel menampilkan
   tautan `wa.me`, dan kolom baru `pegawai.no_wa` ditambahkan lewat migrasi `0006_pegawai_no_wa.sql`.
   Nomor disimpan format internasional (`62812…`, tanpa `+`).
2. **Rincian Rekap Presensi di dasbor pegawai.** Kotak Rekap Presensi kini menampilkan daftar
   kejadian per hari: tanggal + nama hari, jam masuk/pulang, menit terlambat, pulang awal,
   tanpa absen masuk/pulang, tanpa keterangan, dan cuti/sakit/dinas. Sumbernya tabel `presensi`
   milik pengajuan terakhir (dimuat hanya saat dibutuhkan).
3. **Profil pegawai: No. HP + tombol Edit data.** Profil menampilkan nomor HP dan tombol
   **Edit data** untuk mengubahnya sendiri lewat endpoint baru `POST /api/profil` (token Supabase
   diverifikasi, RLS tetap menjaga data lain). Nama/NIP/jabatan/golongan tetap diubah admin.
4. **Menu baru “Unduh Rekap”.** Ada di sidebar dasbor. Pengguna memilih bulan (checklist),
   bagian **Kehadiran / Tukin / Uang Makan / All**, lalu mengunduh **PDF ringkas ukuran A4**:
   satu blok pendek per bulan berisi jumlah hadir, tanggal telat/pulang awal/tanpa absen/tanpa
   keterangan, cuti/sakit/DL/izin, lalu bruto, potongan (dan rinciannya), serta tukin bersih;
   uang makan berisi hari x tarif, PPh, dan bersih. Tanpa tabel besar dan tanpa kotak statistik,
   sehingga **12 bulan ≈ 3 halaman** (±20 KB).
   PDF dibuat di peramban tanpa pustaka luar (`public/lib/pdf.js` + `rekap-pdf.js`)
   sehingga tidak menambah beban server; pustaka baru dimuat saat tombol ditekan.
5. **Pendaftaran banyak pegawai lewat Excel.** Halaman **Daftar** (umum) punya tombol
   **Unduh format Excel pendaftaran**; pegawai mengisi satu baris per orang lalu mengirim file
   `.xlsx` ke admin. Di admin (Data Pegawai) ada **Unduh format Excel** dan **Unggah file Excel**;
   pratinjau menampilkan status tiap baris sebelum diimpor. Impor berjalan per 8 baris
   (`POST /api/pegawai/impor`) agar tidak melewati batas waktu Vercel, dan langsung membuat akun
   login (username NIP, password awal `12345678`). Pustaka Excel (881 KB) tetap dimuat malas.
6. **Database & kompresi.** Migrasi 0006 sudah dijalankan ke Supabase; ringkasan 30 pegawai,
   25 policy, ukuran database **12 MB**, tabel terbesar `presensi` 312 kB (186 baris).
   Yang bisa/ sudah dikompres: aset teks (HTML/CSS/JS/JSON/SVG) memakai **gzip** di server lokal
   dan **Brotli otomatis** di Vercel; `xlsx.full.min.js` + PDF hanya diunduh saat diperlukan;
   PostgreSQL otomatis mengompres teks/json besar lewat **TOAST** dan membersihkan baris mati
   lewat autovacuum. Angka `smallint/numeric` tidak perlu dikompres. Cache aset `/lib/` dan
   `/ikon/` sekarang 7 hari + `stale-while-revalidate` (header Vercel + server lokal).
   Periksa ulang kapan saja dengan `node scripts/periksa-database.mjs`.
7. **Tombol absensi.kemenag.go.id.** Tulisan situs absensi pada petunjuk **Unggah Presensi**
   (halaman umum) dan panduan **Dasbor pegawai** kini berupa tombol pil (`a.tombol-situs`) yang
   membuka `https://absensi.kemenag.go.id` di tab baru. Di panel admin tombol yang sama
   ditempatkan di topbar karena panel admin tidak memiliki kotak unggah presensi.

Berkas baru/berubah utama:

| Berkas | Perubahan |
|---|---|
| `supabase/migrations/0006_pegawai_no_wa.sql` | kolom `pegawai.no_wa` + analyze |
| `app.mjs` | `no_wa` di simpan/daftar pegawai, `POST /api/profil`, `POST /api/pegawai/impor`, gzip aset |
| `public/admin.html` | isian No. WA, kolom WA, unduh template + unggah/impor Excel, tombol absensi |
| `public/dasbor.html` | rincian presensi, No. HP + edit profil, menu & form Unduh Rekap, tombol absensi |
| `public/daftar.html` | tombol unduh format Excel pendaftaran |
| `public/index.html`, `public/gaya.css` | tombol tautan `absensi.kemenag.go.id` + gaya `a.tombol-situs` |
| `public/lib/pdf.js`, `rekap-pdf.js`, `format-pegawai.js` | pembuat PDF A4, tata letak rekap, format Excel |
| `vercel.json` | cache 7 hari untuk `/lib/` dan `/ikon/` |
| `scripts/periksa-database.mjs` | laporan ukuran tabel/indeks database |

Status: seluruh revisi 1–7 sudah dijalankan, diuji seperlunya, di-commit, dan di-push ke
`main` (rangkaian commit `bab4e86`, `ea72454`, `808918f`, ditutup commit README ini).
Migrasi database sudah diterapkan ke Supabase.

## Perubahan 14 November 2026 (lanjutan) — format ekspor Excel

Ekspor **Ekspor Rekap** di panel admin kini mengikuti tata letak tiga berkas contoh di
`format_excel/` (Rekapitulasi Kehadiran / Tukin / Uang Makan Pembimas Katolik, September 2026):

| Berkas | Tata letak hasil ekspor |
|---|---|
| **Kehadiran** | Satu lembar `Worksheet`; judul `REKAPITULASI KEHADIRAN PEMBIMAS <BIDANG>` di baris 1; header di baris 2 (NAMA … KETERANGAN 2, SATKER_2, SATKER_3, STATUS PEGAWAI); satu baris per hari per pegawai; tanggal `2026-09-01 00:00:00`; jam tanpa nol di depan (`8:0`, `7:3`); CEPAT TELAT/PSW berupa angka; hari libur/Dinas Luar memakai kolom LIBUR/JENIS TUGAS/KETERANGAN; Sabtu–Minggu dikosongkan. |
| **Tukin** | Judul `REKAPITULASI TUKIN PEMBIMAS <BIDANG>` di baris 1, baris 2–3 kosong, header di baris 4, data mulai baris 5; tanpa kolom NO; ada kolom **NPWP** (kosong) setelah GOL/ RUANG; header `TK PERSEN`; nominal TUKIN dan TUKIN BERSIH berupa angka berformat rupiah (bukan teks); baris tanda tangan `Pembimas <Bidang>` di kolom Z, dua baris di bawah data. |
| **Uang Makan** | Judul `REKAPITULASI UANG MAKAN PEMBIMAS <BIDANG>` di baris 1, header di baris 4, data mulai baris 5; tanpa kolom NO; HARI MASUK, UANG MAKAN, PPH, JUMLAH BERSIH berupa angka (tiga kolom terakhir berformat rupiah); tanda tangan `Pembimas <Bidang>` di kolom I satu baris di bawah data. |

Angka **tidak berubah** — semuanya tetap berasal dari mesin hitung `TukinTool` (`public/lib/app.js`).
Yang baru hanya lapisan tata letak di `public/lib/format-rekap.js`; bila modul itu gagal dimuat,
ekspor otomatis kembali memakai format lama (`TukinTool.susunWorkbookBidang`).

Modul yang sama dipakai **aplikasi offline**: sumber acuannya
`aplikasi-offline/APLIKASI/lib/format-rekap.js` (dimuat `index.html`), lalu disalin ke
`public/lib/format-rekap.js` oleh `node scripts/siapkan-mesin.mjs` (build Vercel). Jadi tata letak
ekspor offline dan web selalu identik, sementara `app.js` (rumus) tetap tidak berubah.

Catatan pilihan:

- Nama berkas unduhan tetap memuat bidang, status, dan bulan (`Rekapitulasi Tukin Bimas KATOLIK PNS SEPT.xlsx`)
  agar beberapa bidang/status tidak saling menimpa saat diunduh bersamaan; berkas contoh memakai
  nama ringkas `…20269.xlsx` karena hanya berisi satu bidang.
- Baris tambahan di luar tabel pada berkas contoh (mis. nama pegawai di Z13 / I12) adalah sisa
  penyuntingan manual, jadi tidak ikut diekspor.

Berkas yang berubah: `aplikasi-offline/APLIKASI/lib/format-rekap.js` (baru, sumber acuan),
`aplikasi-offline/APLIKASI/index.html` (memuat modul + memakai penyusun baru),
`aplikasi-offline/APLIKASI/CARA-PAKAI.txt`, `public/lib/format-rekap.js` (salinan build),
`public/admin.html`, dan `scripts/siapkan-mesin.mjs` (ikut menyalin modul format).

Pengujian: berkas contoh Kehadiran dibaca ulang dengan mesin hitung lalu dibandingkan sel per sel
terhadap hasil ekspor — judul, header, posisi baris, nilai harian, serta Tukin Rp4.551.000 dan
uang makan 738.000 / PPh 110.700 / bersih 627.300 **sama**; format rupiah hanya dikenakan pada
kolom nominal seperti contoh.

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

- `public/masuk.html` — login **NIP / Username / Email** + password ke Supabase Auth; pegawai
  cukup mengetik 18 angka NIP (dipetakan ke `<NIP>@pegawai.tooltukin.id`), admin memakai username
  (dipetakan ke `<username>@admin.tooltukin.id`) atau email.
  Pesan galat Bahasa Indonesia. Setelah masuk: admin diarahkan ke `/admin.html`, pegawai ke `/dasbor.html`.
- `public/dasbor.html` — dasbor pegawai: profil, periode aktif, status pengajuan terakhir,
  rekap presensi, Tukin & uang makan milik sendiri, riwayat, dan panduan. Sesi hanya di
  `sessionStorage` (hilang saat tab ditutup).
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
   foreign key akan ikut menghapus riwayat presensi & rekapnya. Form punya kolom **Password akun**
   berikon mata, tiap baris punya tombol **Reset sandi** (kembali ke `12345678`), dan kolom
   **Status sandi** menunjukkan apakah pegawai masih memakai password awal.
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
- `POST /api/pegawai/password` — **[admin]** `{ id, reset: true }` mengembalikan password ke
  `12345678`, atau `{ id, password }` untuk password tertentu; akun memakai username NIP.
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

## Perubahan 11 November 2026 (tampilan, ekspor, ukuran situs)

Semua di bawah ini sudah tayang di https://tool-tukin.vercel.app.

### Notifikasi email dinonaktifkan sementara
- `kirimEmail()` hanya menghubungi Resend bila `EMAIL_NOTIFIKASI=aktif`. Tanpa itu tidak ada
  email ke admin maupun ke pegawai, dan tidak ada panggilan keluar ke Resend.
- Kredensial akun diberikan manual: dialog **Setujui** di tab *Pendaftar* menampilkan
  **username (NIP)** + password dengan tombol **Salin** per nilai dan **Salin Semua**
  (siap ditempel ke WhatsApp).
- `daftar.html` menjelaskan bahwa email & password diberikan admin setelah disetujui, bukan
  dikirim otomatis lewat email.
- Kode email tetap utuh; aktifkan lagi dengan `EMAIL_NOTIFIKASI=aktif` + domain pengirim yang
  sudah terverifikasi di Resend (`RESEND_FROM`).

### Tampilan admin di layar HP
- Kelas `.tabel-kartu` (di `gaya.css`): tabel **Pendaftar**, **Data Pegawai**, **Ekspor Rekap**,
  dan **Sudah Unggah** berubah menjadi kartu bertumpuk di lebar ≤640 px — header tabel
  disembunyikan, tiap sel diberi label kolom, tombol aksi selebar kartu. Tidak ada lagi
  guliran horizontal.
- Baris *Rincian sebab potongan* tampil sebagai kartu bergaris putus-putus di bawah kartunya.

### Tab Data Pegawai
- Kotak **cari** (nama/NIP) + **dropdown bidang** di atas tabel, plus penghitung
  "x dari y pegawai". Filter ikut dipertahankan setelah menyimpan/mengaktifkan pegawai.

### Tab Ekspor Rekap
- Panah **▸** di tiap nama membuka **rincian sebab potongan** per hari: terlambat absensi masuk
  X menit, absensi pulang lebih awal X menit, tidak absensi masuk/pulang, tanpa keterangan,
  dinas luar — lengkap dengan hari, tanggal, jam masuk/pulang, dan persen potongannya.
- Kotak centang **Bidang** dan **Pegawai** (dengan pencarian) menentukan siapa yang masuk ke
  berkas yang diunduh.
- Tombol **⬇ 3 berkas** per bidang mengunduh kehadiran + tukin + uang makan bidang itu sekaligus,
  tanpa mengubah centang yang sedang aktif.

### Ukuran & kecepatan situs
- Aset statis disajikan Vercel dengan kompresi **Brotli**.
- `/lib/xlsx.full.min.js` diberi cache peramban `max-age=604800` (7 hari) lewat `vercel.json`.
  Mesin hitung (`/lib/app.js`) sengaja **tidak** di-cache lama agar hasil hitung di browser
  tidak tertinggal dari versi server.
- `xlsx.full.min.js` (881 KB) **tidak lagi diunduh saat tab admin dibuka**. Pustaka dimuat
  sekali saat ekspor pertama, lalu dipakai dari cache peramban. Halaman publik `index.html`
  masih memuatnya lebih awal karena dipakai untuk membaca berkas presensi yang diunggah.

### Keep-alive Supabase (GitHub Actions)
- `GET /api/awas` menjalankan satu query ringan **sungguhan** (`select id from bidang limit 1`)
  lalu membalas `{"ok":true,"waktu":...}`. Endpoint ini publik dan tidak membuka data apa pun.
- Sebagai lapis kedua, `vercel.json` juga mendaftarkan **cron harian** `17 1 * * *` ke `/api/awas`
  (paket Hobby hanya mengizinkan sekali sehari, eksekusi bisa bergeser ±1 jam).
- `.github/workflows/jaga-supabase.yml` memanggilnya **4x sehari** (01:17, 07:17, 13:17, 19:17 UTC
  = 08:17, 14:17, 20:17, 02:17 WIB) agar proyek Supabase Free tidak dijeda karena sepi aktivitas
  ±1 minggu. Workflow bisa juga dijalankan manual dari tab **Actions**.
- Catatan: di repo **publik**, GitHub menonaktifkan workflow terjadwal setelah 60 hari tanpa
  aktivitas repo — cukup commit/perubahan kecil untuk mengaktifkannya kembali. Di repo privat
  aturan itu tidak berlaku (memakai kuota menit Actions, ±20 menit/bulan untuk job ini).
- Tetap bukan jaminan resmi dari Supabase: email peringatan ±1 minggu sebelum jeda tetap
  dikirim, dan paket Pro satu-satunya yang dijamin bebas jeda + backup harian.

### Kapasitas data (perkiraan)
- Satu pengajuan = 1 baris `pengajuan_tukin` + ±22 baris `presensi` + 3 baris rekap.
- 300 pegawai × 12 bulan ≈ 79.000 baris presensi per tahun — puluhan MB per tahun, jadi batas
  database gratis Supabase (500 MB) masih longgar untuk beberapa tahun. Pantau di
  Dashboard → **Usage**. Batas gratis lain: 5 GB egress/bulan, 50.000 MAU, 2 proyek aktif,
  dan proyek **dijeda bila tidak ada aktivitas ±1 minggu**.

## Fase 2 — penyempurnaan grafik dasbor admin (12 November 2026)

Fokus: empat grafik SVG di dasbor admin dibuat terasa seperti dashboard administrasi
enterprise, tanpa menambah library, CDN, atau mengubah mesin hitung/database.

### Berkas yang berubah
- `public/lib/grafik.js` — mesin grafik SVG ditulis ulang: kurva *monotone cubic*, animasi
gambar garis (`stroke-dashoffset`), batang tumbuh, donat menyapu, tooltip `position: fixed`
yang dijepit ke dalam layar (mouse + sentuh), legenda interaktif, sorotan bulan/bidang,
empty/error/skeleton state, dan `ResizeObserver` dengan cache tinggi agar tidak render berulang.
- `public/admin.html` — sakelar **Jumlah / Rupiah** pada grafik tren, lencana periode per kartu,
deduplikasi pengajuan berdasarkan `id`, cache kunci render per grafik, debounce filter 140 ms,
dan tab yang sudah dibuka tidak mengambil ulang data.
- `public/gaya.css` — sistem desain kartu/tiang/sakelar/legenda/tooltip, animasi batang,
dan penyesuaian ponsel.

### Perilaku grafik
- **Tren**: mode *Jumlah* menampilkan total pengajuan per bulan; mode *Rupiah* membandingkan
Tukin bersih vs uang makan bersih (dua kurva). Legenda bisa diklik untuk menyembunyikan seri.
- **Perbandingan**: batang berkelompok Tukin vs uang makan per bulan; label nilai di samping
batang (disembunyikan otomatis bila ruang per bulan terlalu sempit), label total di legenda.
- **Status**: donat dengan total di tengah; saat segmen di-hover/disentuh, tengah berubah menjadi
persentase segmen. Legenda menampilkan jumlah + persen. Filter status sengaja tidak diterapkan
agar komposisi keseluruhan tetap terbaca (dinyatakan di caption kartu).
- **Per bidang**: batang horizontal dengan label angka; bidang yang difilter disorot, bidang lain
diredupkan. Filter bidang tidak diterapkan pada grafik ini (dinyatakan di caption).
- Nominal hanya tampil di panel admin yang sudah digerbangi peran; RLS tetap batas utama.

### Hasil uji (Chrome headless, sesi admin asli)
- 4 grafik, 0 nilai `NaN`, 0 console error; data 30 pegawai / 6 pengajuan (3 menunggu, 3 disetujui).
- Tooltip tampil di dalam viewport pada 1440 px dan 360 px; legenda menyembunyikan/memulihkan seri.
- Donat: total 6 → hover 50% → kembali 6; `stroke-dasharray` terisi dan transisi 0,85 dtk aktif.
- Filter status/bulan/bidang mengubah statistik, aktivitas, dan sorotan grafik; pindah tab tidak
menambah request (2 → 2); tahun tanpa data menampilkan empty state.
- Tanpa overflow horizontal pada 1440, 1366, 768, 390, dan 360 px; layout ponsel satu kolom.
- Tangkapan layar uji (lokal, tidak di-commit karena memuat nama/NIP pegawai):
`docs/tangkapan-layar/dasbor-admin-desktop.png` (1440 px) dan
`docs/tangkapan-layar/dasbor-admin-ponsel.png` (390 px).

### Catatan
- Bug lama `pad.top` (seharusnya `pad.atas`) diperbaiki; bug ini membuat atribut SVG bernilai `NaN`.
- Sudah di-commit (`e37c3c8`) dan di-push ke `main`. Deploy produksi 12 November 2026
berhasil lewat Vercel REST API; alias `tool-tukin.vercel.app` menyajikan `grafik.js`
yang sama persis dengan berkas di repositori (SHA-1 identik).

### Selesai 13 November 2026 (login NIP, reset & status sandi)

**Login pegawai memakai NIP**
- Supabase Auth memakai email sebagai username, jadi akun pegawai disimpan sebagai
  `<NIP>@pegawai.tooltukin.id`. Halaman masuk hanya meminta **NIP / Email**; NIP 18 angka
  otomatis dipetakan ke alamat internal tersebut.
- Semua **30 pegawai** sudah dimigrasikan ke username NIP dengan password awal `12345678`.
  Daftar kredensial hasil migrasi ada di `../userpaswordpegawai.md` (di-ignore Git — jangan di-commit).
- Pegawai baru dari tab **Data Pegawai** dan pendaftar yang disetujui otomatis dibuatkan akun
  login dengan username NIP; password memakai isian admin atau `12345678`.

**Akun admin**
- Username admin: **`admin_tukin`** (disimpan di Auth sebagai `admin_tukin@admin.tooltukin.id`).
  Email lama `bastantabangun2024@gmail.com` sudah tidak berlaku.
- Password admin diatur langsung di Supabase Auth dan **tidak ditulis di repositori**.
- Baris `public.users` milik admin ikut diperbarui agar email dan peran `admin` tetap konsisten.
- Halaman masuk menerima NIP (pegawai), username admin, atau email.

**Wajib ganti password**
- Akun baru/reset diberi metadata `harus_ganti_password: true` di Supabase Auth.
- Saat pegawai masuk, dasbor menampilkan kartu **Ganti password** (dua kolom berikon mata).
  Setelah berhasil, flag di-set `false` sehingga prompt tidak muncul lagi.
- Halaman mandiri **`/ganti-password.html`** memakai sesi login yang aktif — pegawai tidak perlu
  memasukkan password lama atau login ulang. Halaman ini ditautkan dari sidebar dasbor pegawai
  dan panel admin.
- Reset oleh admin mengembalikan password ke `12345678` **dan** menyalakan flag lagi, sehingga
  pegawai diminta mengganti password pada login berikutnya.

**Admin melihat status sandi**
- Kolom **Status sandi** di tabel Data Pegawai: **Password awal** (flag aktif),
  **Sudah diganti** (flag `false`), atau **Belum ada akun** (belum tertaut ke Auth).
- Status dibaca dari metadata akun Supabase Auth lewat `GET /api/pegawai/daftar`; tabel dimuat
  ulang otomatis setelah simpan/reset sehingga status langsung berubah.

**Verifikasi**
- `node --check app.mjs` + seluruh skrip inline HTML valid.
- Pemetaan status diuji ke Supabase: 30 pegawai, 30 akun, semuanya berstatus **Password awal**.
- Login nyata NIP `198810312025211009` + `12345678` → HTTP 200 dengan
  `harus_ganti_password: true`; ganti password lewat `PUT /auth/v1/user` diuji berhasil.
- Produksi `https://tool-tukin.vercel.app`: `/masuk.html`, `/ganti-password.html`,
  `/lib/sandi.js`, `/api/konfigurasi` semuanya 200; halaman masuk sudah memakai NIP.

**Deploy**
- Commit `a9ea0fc` di-push ke `main`; workflow **Deploy ke Vercel** selesai **success**
  (run `43451627800`). Sebelumnya `cf3738a` juga sudah tayang.
- Secret `VERCEL_TOKEN` (scope **Full Account**) sudah disimpan di GitHub, jadi deploy
  berikutnya cukup `git push` ke `main` — tidak perlu token di chat atau CLI lagi.
- **Penting:** token Vercel yang pernah ditempel di chat harus dicabut di
  https://vercel.com/account/tokens lalu diganti dengan token baru; perbarui secret GitHub
  setelahnya. Jangan pernah menempel token di chat lagi.

## Aplikasi PWA (13 November 2026)

Situs bisa dipasang sebagai aplikasi Android langsung dari Chrome — **tanpa membuat APK**.
Aplikasi tetap memakai halaman dan API yang sama; pembaruan situs otomatis terbawa.

- `public/manifest.webmanifest` — nama **Tool Tukin**, `start_url` `/masuk.html`,
  mode `standalone`, warna tema `#1d4ed8`.
- `public/ikon/tt-192.png`, `tt-512.png`, `tt-180.png` — ikon bawaan bertuliskan **TT**.
- `public/sw.js` — service worker ringan: hanya menyimpan aset statis (`gaya.css`, ikon,
  `lib/`). HTML, `/api/*`, dan Supabase **tidak pernah di-cache** agar data tidak basi.
- `public/lib/pwa.js` — mendaftarkan service worker; dimuat di enam halaman publik/admin.
- `vercel.json` — header `application/manifest+json` untuk manifest dan `no-cache` untuk `sw.js`.
- Teks kecil **created: Bastanta Bangun with Freebuff** di sudut kanan bawah lewat
  `body::after` di `public/gaya.css`.

**Cara memasang:** buka https://tool-tukin.vercel.app/masuk.html di Chrome Android → menu ⋮ →
**Instal aplikasi / Tambahkan ke layar utama**. Ikon TT muncul di layar utama dan aplikasi
terbuka tanpa address bar.

**Beban sistem:** PWA tidak menambah beban server. Jumlah request ke Vercel/Supabase sama
seperti membuka situs di browser; service worker justru menghemat unduhan aset statis pada
kunjungan berikutnya. Ukuran aplikasi hanya ikon + cache beberapa ratus KB, tanpa runtime baru.

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
6. **Deploy otomatis lewat GitHub Actions:** `.github/workflows/deploy-vercel.yml` berjalan pada
   setiap push ke `main` (dan bisa dijalankan manual dari tab **Actions** → *Deploy ke Vercel* →
   *Run workflow*). Workflow memakai `vercel pull` → `vercel build` → `vercel deploy --prebuilt`.
   Yang perlu disiapkan sekali di GitHub: **Settings → Secrets and variables → Actions → New
   repository secret** bernama `VERCEL_TOKEN` (buat di Vercel → *Account Settings → Tokens*).
   `VERCEL_ORG_ID` dan `VERCEL_PROJECT_ID` sudah tertanam di workflow dan sama dengan
   `aplikasi-web/.vercel/project.json`. Tanpa secret `VERCEL_TOKEN`, job deploy akan gagal
   (build integrasi Git Vercel tetap berjalan sendiri bila integrasi itu aktif).
   **Setelah secret tersimpan, deploy berikutnya cukup `git push` ke `main`** — workflow membaca
   secret itu sendiri, jadi tidak ada permintaan token lagi dan token tidak perlu ditempel di chat.

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

### 8. Rincian potongan di tab Sudah Unggah (11 November 2026)
- Nama pegawai di tab **Sudah Unggah** kini punya tanda panah **▸** seperti di tab **Ekspor Rekap**.
  Saat diklik, baris rincian terbuka berisi tanggal, sebab potongan (telat, pulang awal,
  tidak presensi, tanpa keterangan, cuti/sakit/dinas/izin), persen potongan, serta jam masuk/pulang.
- Admin dapat memeriksa rincian ini **sebelum** menekan **Setujui** atau **Reset**.
- Detail memakai data `presensi` yang tersimpan saat pengajuan dibuat, sehingga angkanya sama
  dengan yang masuk ke rekap. Tersedia juga pada tabel riwayat **ditolak**.
- Query tab Sudah Unggah ditambah `presensi(*)`; tombol panah memakai atribut `data-rincian`
  dan fungsi `htmlRincianPotongan()` yang sudah dipakai tab Ekspor Rekap.
- Perubahan: `public/admin.html` (`muatUnggah`, `renderTabelSudah`, handler `data-rincian`).

## Perubahan 12 November 2026 (redesain UI/UX — dasbor administrasi)

Tampilan dirombak menjadi dasbor administrasi kepegawaian (navy/royal blue, kartu rounded,
sidebar, grafik). **Tidak ada** perubahan pada mesin hitung, rumus Tukin/uang makan, endpoint
API, skema database, kredensial, atau konfigurasi rahasia. Semua fitur lama tetap ada.

### Berkas yang diubah / ditambah

| Berkas | Perubahan |
|---|---|
| `public/gaya.css` | Sistem desain baru: token warna navy/royal, sidebar + topbar, kartu statistik, grafik, skeleton, modal, tabel kartu, responsif. Semua kelas lama tetap dipertahankan. |
| `public/lib/grafik.js` | **Baru.** Perender grafik SVG tanpa dependency: garis, batang (horizontal/vertikal), batang berkelompok, donat. Tooltip, legenda, animasi ringan, empty state, skeleton, dan gambar ulang saat lebar berubah. |
| `public/admin.html` | Kerangka sidebar/topbar baru + tab **Dasbor**: 5 kartu statistik, 4 grafik, filter bulan/tahun/bidang/status, aktivitas terbaru dengan Detail & Verifikasi. Tab lama (Sudah Unggah, Pendaftar, Data Pegawai, Ambil dari Drive, Ekspor Rekap, Pengaturan) tidak diubah logikanya. |
| `public/dasbor.html` | Dasbor pegawai baru: profil, periode aktif, status pengajuan terakhir, rekap presensi, Tukin & uang makan milik sendiri, riwayat, panduan. |
| `public/masuk.html` | Tampilan login baru; pegawai diarahkan ke `/dasbor.html`, admin ke `/admin.html`. |
| `public/index.html`, `public/daftar.html` | Navigasi menuju Dasbor + favicon. Logika unggah/pendaftaran tidak berubah. |
| `README.md` | Catatan perubahan ini. |

### Sumber data grafik

Semua angka berasal dari Supabase melalui sesi pengguna (bukan dummy):

- `pegawai?aktif=eq.true` → total pegawai dan daftar bidang.
- `pengajuan_tukin?tahun=eq.<tahun>&select=...pegawai(...),rekap_tukin(...),rekap_uang_makan(...)`
  → agregasi status, tren bulanan, nominal Tukin vs uang makan, pengajuan per bidang, dan
  aktivitas terbaru. Filter bulan/bidang/status diterapkan di klien pada data yang sudah diambil.
- Detail pengajuan mengambil `presensi(*)` saat dialog dibuka agar payload awal tetap ringan.

Grafik **tidak memakai library baru**: proyek ini tanpa build step dan tanpa React. Perender SVG
kecil dipilih agar tetap ringan, tanpa CDN, dan tetap jalan offline — memenuhi kebutuhan tooltip,
legenda, animasi, empty state, dan skeleton.

### Keamanan

- `admin.html` sekarang memeriksa peran `users.peran`; akun non-admin dialihkan ke `/dasbor.html`.
- RLS Supabase tetap menjadi batas utama: pegawai hanya membaca baris miliknya. Ini diuji dengan
  token pegawai sungguhan — 1 baris `pegawai`, 1 pengajuan, 0 baris milik orang lain.
- Anon tanpa login tidak dapat membaca `pengajuan_tukin` (hasil `[]`).
- Tidak ada kunci rahasia di frontend; hanya kunci publishable dari `/api/konfigurasi`.

### Pengujian (12 November 2026)

- `node scripts/siapkan-mesin.mjs` (perintah build Vercel) berhasil; semua halaman & aset 200.
- Login pegawai sungguhan berhasil; dasbor menampilkan nama, periode, status Disetujui, hadir 15,
  Tukin bersih Rp2.913.360, dan uang makan; 1 baris riwayat; 4 langkah panduan.
- Login admin lewat formulir sungguhan berhasil (diarahkan ke `/admin.html`), lalu panel diuji
  dengan data penuh: **30 pegawai, 6 pengajuan, 3 menunggu, 3 disetujui**. Filter status dan bidang
  mengubah angka dengan benar (contoh Bimas Katolik: 4 pegawai, 3 pengajuan), ketujuh tab berpindah
  dan menampilkan judul masing-masing, tab **Sudah Unggah** Oktober 2026 menampilkan 6 sudah /
  24 belum, tab **Data Pegawai** menampilkan 30 baris, dan dialog detail memuat rincian potongan.
- Ukuran ponsel 390 px: tidak ada guliran horizontal; sidebar menjadi off-canvas; kartu 2 kolom.
- Console bersih: tidak ada error grafik, resource, maupun exception.
- Perhitungan Tukin/uang makan tidak diuji ulang karena `app.js`, `rekap.js`, `app.mjs`, dan
  migrasi database tidak disentuh.

### Belum / catatan

- Password admin diperbarui 12 November 2026 melalui Supabase Auth Admin API. Password baru
  disimpan di `username pasword.txt` (berkas ini di-ignore Git); nilai sandi tidak ditulis di
  dokumentasi ini. Login admin sudah diverifikasi ulang dengan sandi tersebut.
- Tab Data Pegawai bergantung pada endpoint server admin; tidak berubah.
- Rekomendasi lanjutan: ekspor PDF dasbor, notifikasi dalam aplikasi, dan pagination aktivitas
  bila pengajuan sudah ribuan.
