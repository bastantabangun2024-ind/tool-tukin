# Rencana Web App Tool Tukin & Uang Makan Bimas

> Versi web: Vercel + Supabase + (opsional) Google Drive  
> Email admin: bastantabangun2024@gmail.com

---

## A. Ringkasan Aplikasi

Aplikasi ini memproses file presensi bulanan pegawai Bimas (PPPK & PNS, bidang Kristen / Katolik / Buddha), lalu menghasilkan 3 file rekap:

1. **Rekapitulasi Kehadiran**
2. **Rekapitulasi Tukin**
3. **Rekapitulasi Uang Makan**

Dasar hukum potongan:
- PMA Nomor 11 Tahun 2019, Pasal 8 Ayat (1): TK = 3% per hari
- TL/PSW mengikuti tangga persen yang ada di `app.js`

Logika inti sudah ada di `APLIKASI/app.js` (dalam bentuk IIFE/UMD, bisa di-require di Node).

---

## B. Alasan Dirubah jadi Web

Versi lama:
- Dobel-klik `index.html` di komputer masing-masing
- File Excel diproses di browser (localhost)
- Fitur "Ambil dari Drive" butuh local server `AMBIL-DARI-DRIVE.cmd`
- Tidak ada login, tidak ada penyimpanan online

Versi web yang diinginkan:
- 1 admin user saja
- Bisa diakses dari browser mana saja
- File presensi di-upload lewat web
- File hasil bisa disimpan ke Google Drive (atau ke Supabase Storage)
- Lebih rapi, ada login, ada jejak file

---

## C. Arsitektur yang Disepakati

```
Browser (admin)
  │
  ▼
Vercel
  ├── Frontend statis (HTML/JS/CSS) → tampilan web
  └── Serverless Function → proses file xlsx
          │
          ▼
     Supabase
          ├── Auth → login 1 admin
          ├── (opsional) Storage → simpan file presensi & hasil
          └── Database → simpan metadata (nama file, bulan, tahun, status)

          ▼
     Google Drive (jika dipilih)
          └── Folder hasil rekap
```

Pilihan penyimpanan hasil rekap:
- **Google Drive**: hasil langsung masuk folder Drive admin, familiar, mudah dibagikan
- **Supabase Storage**: semuanya di satu tempat, cukup 3 env var Supabase
- Bisa juga kedua-duanya: hasil ada di web + auto-upload ke Drive

---

## D. Komponen yang Dibutuhkan

### 1. Frontend (Vercel static)
- Halaman login (form email + password, pakai Supabase Auth)
- Halaman utama setelah login:
  - Upload file presensi (bisa banyak sekaligus)
  - Tampilkan daftar pegawai yang diproses + masalah/anomali
  - Tombol unduh file hasil (jika disimpan di Supabase Storage)
  - atau tampilkan link file hasil (jika disimpan di Google Drive)
- Rujukan desain: `APLIKASI/index.html` versi sekarang
- Rujukan logika: `APLIKASI/app.js` + `APLIKASI/pegawai.js`

### 2. Backend (Vercel Serverless Function)
Ide: 1 fungsi yang menerima file, memproses, lalu mengembalikan hasil atau menyimpannya.

Alur fungsi:
1. Terima file xlsx ( dari upload frontend )
2. Baca isi file pakai `xlsx` / `xlsx.full.min.js`
3. Cari pegawai di roster (pegawai.js)
4. Hitung potongan + uang makan pakai logika `app.js`
5. Buat 3 workbook hasil:
   - Kehadiran
   - Tukin
   - Uang Makan
6. Simpan hasil:
   - Jika pakai Supabase Storage: upload ke storage bucket
   - Jika pakai Google Drive: upload ke folder yang sudah ditentukan
7. Kembalikan info ke frontend:
   - Nama file hasil
   - Link / tombol unduh
   - Catatan masalah

### 3. Supabase
Yang disiapkan:
- Project Supabase baru
- Auth: 1 user admin, atau buat user lewat dashboard
- (Opsional) Storage bucket untuk file presensi & hasil
- (Opsional) Tabel metadata file jika ingin mencatat riwayat proses

Environment variable yang akan digunakan di Vercel:
```
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY   ← kalau fungsi butuh akses admin ke storage/database
```

### 4. Google Drive (jika dipilih)
Yang diperlukan:
- Google Cloud Console →buat project
- Aktifkan Google Drive API
- Buat Service Account
- Unduh JSON credentials
- Buat folder di Drive
- Bagikan folder tersebut ke email service account
- Simpan di environment variable Vercel:
  - Misalnya: `GOOGLE_SERVICE_ACCOUNT_JSON` (isi JSON sebagai string/JSON)
  - `DRIVE_FOLDER_ID` (ID folder tujuan)

---

## E. Skenario Penggunaan Harian (admin)

1. Admin buka URL web
2. Login pakai akun admin
3. Upload file-file presensi bulan ini
4. Web memproses dan menampilkan:
   - Rekap singkat per pegawai
   - Baris yang perlu dicek manual
5. Admin klik tombol hasil:
   - Jika pakai Supabase Storage: unduh file hasil langsung dari web
   - Jika pakai Google Drive: web menunjukkan link file di Drive
6. Selesai untuk bulan itu

---

## F. Yang Sudah Ada (bisa dipakai lagi)

- `APLIKASI/app.js` — logika proses utama (baca sheet, klasifikasi, hitung potongan/uang makan, buat workbook)
- `APLIKASI/pegawai.js` — data roster pegawai
- `APLIKASI/index.html` — referensi tampilan & alur upload
- `CADANGAN/package.json` — ada beberapa dependency yang bisa jadi bahan acuan (jszip, pdf-parse, dll), tapi untuk web app yang ini yang benar-benar dibutuhkan hanyalah library xlsx

Library yang paling relevan untuk proses di server:
- `xlsx` atau `xlsx.full.min.js` — baca dan buat file xlsx

---

## G. Yang Perlu Ditambahkan / Dibuat Baru

1. Struktur project web (bukan hanya folder `APLIKASI/`)
2. Serverless function untuk proses file
3. Halaman login admin
4. Halaman upload & hasil
5. Konfigurasi Supabase
6. Penyimpanan file (pilih 1: Google Drive, atau Supabase Storage)
7. Environment variable di Vercel

---

## H. Pilihan yang Perlu Kakak Tentukan Nanti

1. **Penyimpanan hasil rekap** → Google Drive, Supabase Storage, atau keduanya?
2. **Layout halaman** → disamakan dengan tampilan sekarang, atau lebih sederhana?
3. **Riwayat proses** → apakah perlu tersimpan di database, atau cukup antar upload?
4. **Apakah admin akan upload file presensi, atau file presensi otomatis masuk lewat folder tertentu juga bisa?**

---

## I. Catatan Kecil untuk Esok

- Versi ini masih rencana, bukan implementasi.
- Logika hitung sudah ada, jadi pekerjaanutama selanjutnya adalah bungkus logika itu ke dalam web app + serverless function.
- Kalau nanti kakak mau, kita bisa mulai dari bagian kecil dulu, misalnya:
  - Setup awal project Vercel
  - Serverless function pertama yang cuma baca file xlsx
  - Lalu baru lanjut ke proses penuh

---

*File ini dibuat untuk bahan bacaan sebelum implementasi web app Tool Tukin & Uang Makan Bimas versi online.*


dari ChatGPT

# PROYEK PEMBANGUNAN SISTEM INFORMASI TUKIN DAN UANG MAKAN ONLINE

## 1. LATAR BELAKANG

Saya memiliki aplikasi lama bernama TOOL TUKIN yang sebelumnya dibuat menggunakan HTML, CSS, dan JavaScript.

Aplikasi lama memiliki mesin perhitungan kehadiran, Tunjangan Kinerja (Tukin), Uang Makan, serta pengolahan file Excel presensi.

Saya ingin mengembangkan aplikasi tersebut menjadi SISTEM INFORMASI TUKIN DAN UANG MAKAN ONLINE yang dapat diakses oleh seluruh pegawai melalui internet.

Konsep aplikasi terbaru adalah:

- Pegawai melakukan pendaftaran akun.
- Pegawai login atau mengakses layanan pengajuan.
- Pegawai memasukkan NIP.
- Sistem mengenali identitas pegawai dari database.
- Pegawai mengunggah file Excel hasil unduhan absensi Kementerian Agama.
- Pegawai memilih bulan dan tahun.
- Sistem menghitung kehadiran, Tukin, dan uang makan.
- Pegawai melihat hasil perhitungan.
- Pegawai mengirimkan hasil kepada administrator.
- Administrator memeriksa, memverifikasi, dan mengelola seluruh data.

## 2. TEKNOLOGI

Gunakan arsitektur:
- Frontend: pertahankan teknologi aplikasi lama jika masih sesuai.
- Hosting: Vercel.
- Database: Supabase PostgreSQL.
- Login: Supabase Auth.
- Penyimpanan file: Supabase Storage.
- Integrasi Google Drive: Google Drive API dan OAuth.
- Pengolahan Excel: pertahankan library yang sudah tersedia jika masih kompatibel.

Jangan membangun ulang mesin perhitungan dari nol sebelum memahami seluruh source code lama.

## 3. HALAMAN DEPAN / DASHBOARD PUBLIK

Buat halaman depan yang profesional, sederhana, dan responsif.

Tampilkan identitas aplikasi:

SISTEM INFORMASI TUKIN DAN UANG MAKAN PEGAWAI

Sediakan dua menu utama:

A. LOGIN ADMIN
B. DAFTAR PEGAWAI

Sediakan halaman layanan pegawai untuk mengajukan perhitungan Tukin dan Uang Makan.

Halaman layanan pegawai memuat:

1. Input NIP.
2. Identitas pegawai:
   - Nama.
   - NIP.
   - Pangkat/Golongan.
   - Jabatan.
   - Bidang.
3. Upload file Excel presensi.
4. Pilihan bulan.
5. Pilihan tahun.
6. Tombol PROSES.

Identitas pegawai harus diambil dari database dan hanya ditampilkan kepada pengguna yang sudah terautentikasi serta memiliki akses terhadap data tersebut.

File Excel harus divalidasi sebelum diproses.

## 4. MENU PENDAFTARAN PEGAWAI

Buat formulir pendaftaran dengan kolom:

1. Nama lengkap.
2. NIP.
3. Pangkat/Golongan.
4. Jabatan.
5. Bidang.
6. Email aktif.
7. Password.
8. Konfirmasi password.

Pilihan bidang wajib:

- Tata Usaha.
- Kanwil.
- PAI.
- Bimas Buddha.
- Bimas Hindu.
- Bimas Kristen.
- Bimas Katolik.
- PenaisZawa.
- Penmad.
- Pontren.
- Urais.

Fitur pendaftaran:
- Validasi NIP.
- Validasi email.
- Pemeriksaan duplikasi NIP.
- Pemeriksaan kelengkapan data.
- Penyimpanan ke database.
- Status pendaftaran menunggu persetujuan admin.
- Notifikasi ketika akun disetujui atau ditolak.

Jangan memberikan akses penuh secara otomatis setelah pendaftaran.

## 5. MENU LOGIN ADMIN

Buat halaman login administrator menggunakan username/email dan password.

Hanya administrator yang memiliki hak akses penuh terhadap seluruh sistem.

Setelah login, tampilkan dashboard administrator.

## 6. DASHBOARD ADMINISTRATOR

Tampilkan statistik:

- Total pegawai terdaftar.
- Total pegawai yang sudah disetujui.
- Total pendaftar baru.
- Total pegawai yang sudah upload presensi.
- Total pengajuan menunggu verifikasi.
- Total pengajuan yang sudah disetujui.
- Statistik berdasarkan bidang.

## 7. MENU DATA PENDAFTAR

Admin dapat:

- Melihat seluruh pegawai yang mendaftar.
- Melihat detail pendaftaran.
- Memeriksa NIP.
- Memeriksa bidang.
- Menyetujui pendaftaran.
- Menolak pendaftaran.
- Memperbaiki data dengan pencatatan riwayat perubahan.
- Menghapus data duplikat dengan konfirmasi.

## 8. MENU DATA PEGAWAI

Buat database seluruh pegawai.

Kolom:
- Nama.
- NIP.
- Pangkat/Golongan.
- Jabatan.
- Bidang.
- Kelas jabatan.
- Status kepegawaian.
- Besaran Tukin.
- Tarif Uang Makan.
- Persentase pajak.
- Status aktif/nonaktif.

Sediakan:
- Tambah pegawai.
- Edit pegawai.
- Hapus pegawai.
- Pencarian pegawai.
- Filter berdasarkan bidang.
- Import Excel.
- Export Excel.

## 9. MENU UPLOAD PRESENSI PEGAWAI

Pegawai yang sudah disetujui dapat mengunggah file Excel presensi.

Sediakan:
- Input NIP.
- Identitas pegawai otomatis dari database.
- Upload file Excel.
- Pilihan bulan.
- Pilihan tahun.
- Tombol PROSES.

Validasi file:
- Pastikan format Excel sesuai dengan format absensi Kemenag.
- Pastikan file dapat dibaca.
- Pastikan NIP sesuai dengan akun pegawai.
- Pastikan periode file sesuai dengan periode yang dipilih.
- Deteksi file duplikat.
- Deteksi data yang tidak lengkap.
- Deteksi presensi yang tidak dikenali.
- Tampilkan pesan kesalahan yang jelas.

Jangan langsung menyimpan data yang tidak valid.

## 10. HASIL PROSES PRESENSI

Setelah tombol PROSES ditekan, tampilkan ringkasan:

A. DATA KEHADIRAN

- Jumlah hari kerja.
- Jumlah kehadiran.
- Jumlah keterlambatan.
- Jumlah pulang sebelum waktunya.
- Jumlah tidak presensi masuk.
- Jumlah tidak presensi pulang.
- Jumlah tanpa keterangan.
- Jumlah cuti.
- Jumlah dinas luar.
- Jenis ketidakhadiran lainnya sesuai aturan.

B. HASIL TUKIN

Tampilkan:
- Tukin bruto.
- Potongan keterlambatan.
- Potongan pulang cepat.
- Potongan tanpa keterangan.
- Potongan lainnya.
- Total potongan.
- Pajak jika berlaku.
- Tukin bersih.

C. HASIL UANG MAKAN

Tampilkan:
- Jumlah hari yang memenuhi syarat.
- Tarif uang makan.
- Uang makan bruto.
- Potongan pajak.
- Potongan lainnya jika berlaku.
- Uang makan bersih.

Tampilkan rincian perhitungan agar pegawai dapat memahami bagaimana hasil diperoleh.

## 11. PENGIRIMAN HASIL

Setelah pegawai memeriksa hasil perhitungan, sediakan tombol:

KIRIM DATA KE ADMIN

Ketika berhasil dikirim, tampilkan:

"SELAMAT, DATA ANDA BERHASIL DIUNGGAH."

"Data presensi dan hasil perhitungan Anda sudah masuk ke sistem dan menunggu verifikasi administrator."

Simpan:
- NIP.
- Nama pegawai.
- Bidang.
- Bulan.
- Tahun.
- File Excel.
- Ringkasan kehadiran.
- Hasil Tukin.
- Hasil uang makan.
- Waktu pengiriman.
- Status pengajuan.

Status pengajuan:
- Draft.
- Menunggu verifikasi.
- Sedang diperiksa.
- Perlu perbaikan.
- Disetujui.
- Ditolak.

Pegawai hanya dapat melihat pengajuan miliknya sendiri.

Cegah pengajuan ganda untuk NIP dan periode yang sama, kecuali admin mengizinkan pengajuan ulang.

## 12. MENU PENGATURAN POTONGAN

Buat menu khusus administrator.

Sediakan pengaturan:

A. POTONGAN TUKIN
- Keterlambatan.
- Pulang sebelum waktunya.
- Tidak presensi masuk.
- Tidak presensi pulang.
- Tidak masuk tanpa keterangan.
- Cuti atau ketidakhadiran sesuai ketentuan.
- Pelanggaran disiplin.
- Potongan lainnya sesuai juknis.

B. POTONGAN UANG MAKAN
- Pengaturan hari yang memenuhi syarat.
- Ketentuan kehadiran.
- Tarif berdasarkan golongan jika berlaku.
- Pajak.
- Ketentuan potongan lainnya.

C. PENGATURAN LAINNYA

Setiap aturan harus mempunyai:
- Nama potongan.
- Persentase.
- Satuan per kejadian atau per hari.
- Keterangan.
- Dasar ketentuan/juknis.
- Tanggal mulai berlaku.
- Status aktif/nonaktif.

Penting:
Jangan membuat persentase potongan secara asal.
Gunakan aturan dari aplikasi lama sebagai referensi awal dan sediakan pengaturan yang dapat diperbarui oleh administrator.

Setiap perubahan aturan harus tercatat dan tidak mengubah hasil perhitungan periode yang sudah disahkan.

## 13. MENU VERIFIKASI ADMIN

Admin dapat memeriksa setiap pengajuan.

Tampilkan:
- Identitas pegawai.
- File Excel.
- Periode.
- Rincian kehadiran.
- Hasil perhitungan Tukin.
- Hasil uang makan.
- Total potongan.

Sediakan tombol:
- Setujui.
- Tolak.
- Minta perbaikan.
- Download file Excel.
- Cetak laporan.

Hasil yang sudah disetujui dapat dikunci agar tidak berubah tanpa persetujuan admin.

## 14. MENU REKAPITULASI

Buat tiga jenis laporan:

A. REKAPITULASI KEHADIRAN

B. REKAPITULASI TUKIN

C. REKAPITULASI UANG MAKAN

Semua laporan dapat difilter berdasarkan:
- Bulan.
- Tahun.
- Bidang.
- Nama pegawai.
- NIP.
- Status pengajuan.

Sediakan fitur:
- Export Excel.
- Cetak PDF.
- Tampilan rekap keseluruhan.
- Tampilan rekap per bidang.

## 15. INTEGRASI GOOGLE DRIVE

Pertahankan integrasi Google Drive untuk membantu administrator mengambil file presensi.

Gunakan Google Drive API dan autentikasi OAuth resmi.

Jangan menggunakan server localhost sebagai ketergantungan aplikasi online.

Jangan menyimpan token rahasia di frontend.

Sediakan pengaturan folder Drive dan periode presensi.

## 16. KEAMANAN SISTEM

Wajib menerapkan:

- Supabase Auth.
- Row Level Security.
- Pemisahan akses administrator dan pegawai.
- Pegawai hanya dapat melihat data miliknya.
- Pegawai tidak dapat mengubah aturan potongan.
- Pegawai tidak dapat mengubah hasil perhitungan secara manual.
- Admin dapat melihat seluruh bidang.
- Password tidak disimpan dalam bentuk teks biasa.
- File presensi tidak dapat diakses publik.
- Validasi file upload.
- Audit log.
- Backup database.
- Perlindungan terhadap pengajuan ganda.

## 17. DATABASE

Gunakan struktur tabel yang saling berelasi:

- bidang.
- pegawai.
- users.
- pendaftaran.
- aturan_potongan.
- presensi.
- file_presensi.
- pengajuan_tukin.
- rekap_kehadiran.
- rekap_tukin.
- rekap_uang_makan.
- audit_log.

Gunakan foreign key dan indeks yang sesuai.

Tambahkan kolom periode dan versi aturan pada setiap hasil perhitungan.

## 18. MIGRASI APLIKASI LAMA

Pertahankan:
- app.js.
- pegawai.js.
- Rumus Tukin.
- Rumus Uang Makan.
- Rumus potongan.
- Pembacaan file Excel.
- Ekspor laporan.

Sebelum migrasi, lakukan audit menyeluruh.

Bandingkan hasil perhitungan aplikasi lama dan baru menggunakan file presensi yang sama.

Jangan mengubah rumus sebelum mendapatkan persetujuan administrator.

## 19. DESAIN

Gunakan desain profesional, modern, dan responsif.

Warna utama biru navy dan putih.

Gunakan:
- Dashboard modern.
- Sidebar admin.
- Formulir pegawai yang sederhana.
- Tabel yang mudah dibaca.
- Kartu hasil perhitungan.
- Notifikasi keberhasilan.
- Tampilan HP dan desktop.

Gunakan bahasa Indonesia.

## 20. TAHAP PENGERJAAN

Kerjakan secara bertahap:

TAHAP 1: Audit aplikasi lama dan rancangan arsitektur.

TAHAP 2: Pembuatan database Supabase dan autentikasi.

TAHAP 3: Pembuatan halaman pendaftaran dan login.

TAHAP 4: Pembuatan dashboard admin.

TAHAP 5: Pembuatan halaman layanan pegawai.

TAHAP 6: Migrasi mesin perhitungan Tukin dan uang makan.

TAHAP 7: Pembuatan upload dan pemrosesan Excel.

TAHAP 8: Integrasi Google Drive.

TAHAP 9: Verifikasi dan rekapitulasi.

TAHAP 10: Pengujian menyeluruh dan deployment Vercel.

PENTING:
Jangan mengerjakan semua tahap sekaligus.
Mulai dari TAHAP 1.
Tampilkan hasil audit dan rancangan terlebih dahulu.
Tunggu persetujuan saya sebelum melanjutkan ke tahap berikutnya.

Target akhir adalah aplikasi online yang benar-benar berfungsi, aman, dan siap digunakan oleh pegawai serta administrator.