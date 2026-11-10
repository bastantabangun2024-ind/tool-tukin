# Diary Tool Tukin — 15 Oktober 2026

## 🗂️ 10 November 2026 — APLIKASI OFFLINE DIPISAH DARI APLIKASI WEB (TAHAP 1)
Permintaan user: (1) pisahkan folder aplikasi offline dengan aplikasi web, (2) untuk aplikasi
web, baca `website.md` (catatan lama + tambahan dari ChatGPT) dan kerjakan detail tugasnya.
Tambahan ChatGPT menetapkan TAHAP 1 = audit aplikasi lama + rancangan arsitektur, lalu
**berhenti menunggu persetujuan**; jadi sesi ini tidak menulis kode web.

### Struktur baru
tool-tukin/
- `website.md` (tetap di akar, sebagai acuan)
- `aplikasi-offline/` — isi lama dipindah utuh: `APLIKASI/`, `AMBIL-DARI-DRIVE/`, `CADANGAN/`,
  `TOOL-TUKIN-siap-upload.zip`, plus `README.md` baru.
- `aplikasi-web/` — `README.md` + `docs/01-audit-aplikasi-lama.md`,
  `docs/02-rancangan-arsitektur.md`, `docs/03-skema-database.md`. Belum ada kode.

Tidak ada path relatif yang diubah: `alat-drive.js` (`../APLIKASI/app.js`), skrip uji, dan
`build-roster.js` tetap menemukan berkasnya karena ketiga folder tetap berdampingan.

### Bukti
- `node aplikasi-offline/CADANGAN/uji-app.js` → **Semua uji LULUS** (141 assertion).
- `node aplikasi-offline/CADANGAN/uji-presensi-terpisah.js` → **LULUS** (85 assertion).
- `require('./APLIKASI/app.js')` dan `require('./AMBIL-DARI-DRIVE/alat-drive.js')` OK.
- `APLIKASI/CARA-PAKAI.txt` diberi catatan lokasi baru (petunjuk lama tetap berlaku).

### Hasil audit yang perlu dibaca sebelum tahap 2
- 19 temuan (A1–A19) di `aplikasi-web/docs/01-audit-aplikasi-lama.md`; yang kritis: identitas
  dari nama file (file presensi Kemenag tidak memuat NIP), belum ada auth/RLS, roster hardcode.
- Temuan sedang yang perlu keputusan: SATKER 2 kosong di sheet Tukin, aturan PMA yang belum
  dihitung (sakit 15+ hari, cuti besar, tugas belajar, alasan penting >2 hari), hari libur nasional.
- Rancangan memilih frontend HTML/JS tanpa build, Vercel functions, Supabase (Auth+DB+Storage),
  mesin hitung **salinan identik** `app.js` + uji paritas, Drive lewat OAuth server-side.

### Berikutnya (menunggu persetujuan user)
TAHAP 2: project Supabase, skema tabel + RLS, admin pertama. Keputusan yang perlu diambil
(10 poin) ada di bagian 13 `02-rancangan-arsitektur.md`.

## 🩹 5 November 2026 — PRESENSI MASUK/PULANG TERPISAH & UANG MAKAN DIPERBAIKI
Permintaan user: pegawai punya JAM MASUK tetapi JAM PULANG kosong di file
absensi.kemenag.go.id, namun kedua jam hilang dari rekap. Uang makan juga salah
karena pegawai dianggap tidak hadir bila salah satu presensi kosong.

### Akar masalah
- `klasifikasiHari()` membuat satu objek `noPresensi` untuk kedua arah, tetapi tidak
  membawa `masukMin`/`masukAbsen` (saat pulang kosong) maupun `pulangMin`/`pulangAbsen`
  (saat masuk kosong).
- `barisKehadiran()` karena itu mengisi kolom ABSEN dengan `-`, sehingga jam yang sah hilang.
- `prosesSatuOrang()` memakai satu variabel `hariMasuk` (hanya hari presensi lengkap)
  untuk menghitung uang makan.

### Perubahan kode
- `APLIKASI/app.js` — `klasifikasiHari()`: sisi `noPresensi` kini membawa data presensi
  yang valid dari sisi lainnya. `barisKehadiran()`: ABSEN MASUK/PULANG menampilkan jam
  asli, CEPAT TELAT/PSW dihitung bila datanya ada, sisi kosong tetap `-` (PSW pulang
  kosong tetap `-990`). `prosesSatuOrang()`: variabel baru `hariHadirUangMakan`
  (hadir + noPresensi; TK/cuti/libur tidak dihitung) dipakai untuk hari UM, bruto, PPH,
  dan bersih; `hariMasuk` dan seluruh persentase potongan Tukin tidak berubah.
- `APLIKASI/app.js` — `lembarUangMakan()`: kolom HARI MASUK memakai `u.hariHadir`
  (bug `undefined` ditemukan saat uji ekspor).
- `APLIKASI/index.html` — kolom "hari UM" membaca `uangMakan.hariHadir`.
- `APLIKASI/CARA-PAKAI.txt` — penjelasan kolom "hadir"/"hari UM" dan rumus uang makan.
- `CADANGAN/uji-presensi-terpisah.js` — uji baru (5 skenario + lintas bidang/status +
  data asli Oktober + ekspor Excel).
- `TOOL-TUKIN-siap-upload.zip` — paket aplikasi diperbarui.

### Aturan uang makan yang sekarang berlaku
| Kondisi presensi | Uang makan |
|---|---|
| Masuk ada, pulang ada | dihitung 1 hari |
| Masuk ada, pulang kosong | dihitung 1 hari |
| Masuk kosong, pulang ada | dihitung 1 hari |
| Masuk kosong, pulang kosong (TK) | tidak dihitung |
| Cuti / izin / dinas luar / hari libur | tidak dihitung (aturan lama) |

### Bukti uji (`node CADANGAN/uji-presensi-terpisah.js`)
- Uji 1 (masuk 07:30, pulang kosong): ABSEN MASUK `7:30` tampil, UM 1 hari Rp37.000,
  Tukin PSW 1,5% = Rp49.785.
- Uji 2 (masuk kosong, pulang 17:00): ABSEN PULANG `17:0` tampil, UM 1 hari,
  Tukin TL 1,5% = Rp49.785.
- Uji 3 (07:30 / 16:30): hadir normal, UM 1 hari, potongan Rp0.
- Uji 4 (keduanya kosong): TK 3% = Rp99.570, UM 0 hari.
- Uji 5 (KRISTEN PPPK, masuk 07:30, pulang kosong): jam masuk tetap ada di Excel,
  UM 1 hari, potongan pulang 1,5%.
- Lintas bidang/status (Katolik, Buddha, PNS) lolos; 85 assertion, 0 gagal.
- Data asli: HENDRO 23 Okt ABSEN MASUK `7:18` (CEPAT TELAT 42); MAYANI 16 Okt
  ABSEN PULANG `17:26`; DAVID 20 Okt `7:0`. Uang makan HENDRO 22 hari (dari 21),
  MAYANI 21 (dari 19), DAVID 22 (dari 20); potongan Tukin tetap 1,5%/3%/3,5%.
- Regresi `node CADANGAN/uji-app.js` (data September + PNS + Drive + format laporan)
  tetap LULUS (141 assertion).
- Contoh laporan hasil uji (HENDRO, MAYANI, DAVID — Oktober 2026) tersimpan di
  `CADANGAN/hasil-uji/`: `Rekapitulasi Kehadiran/Tukin/Uang Makan Bimas KRISTEN OKT.xlsx`.
- `TOOL-TUKIN-siap-upload.zip` dikemas ulang dan isinya dibandingkan byte-per-byte
  dengan file aplikasi di folder `APLIKASI/` + `AMBIL-DARI-DRIVE/` — semua COCOK.

### File yang berubah
`APLIKASI/app.js`, `APLIKASI/index.html`, `APLIKASI/CARA-PAKAI.txt`,
`CADANGAN/uji-presensi-terpisah.js` (baru), `TOOL-TUKIN-siap-upload.zip` (diperbarui).

## 🆕 3 November 2026 — PEGAWAI PNS DITAMBAHKAN (KRISTEN / KATOLIK / BUDDHA)
Permintaan user: rekap PPPK sudah memuaskan; sekarang tambahkan **pegawai PNS** di tiap bidang.
Rumus sama, hanya tukin berbeda karena pangkatnya berbeda. Sumber data baru:
`CADANGAN/ABSEN SEPTEMBER 2026 PNS/PEMBIMAS {KRISTEN,KATOLIK,BUDDHA}/`
(3 file: Rekapitulasi Kehadiran / Tukin / Uang Makan \`20269.xlsx\`).

### Data PNS yang masuk roster (4 orang, total roster 26 -> 30)
| Bidang | Nama | Gol | Tukin | UM/hari | PPH |
|---|---|---|---|---|---|
| KRISTEN | Dr. SAMAREL TELAUM BANUA, S PAK, M.Pd. | IV/b | 4.551.000 | 41.000 | 15% |
| KRISTEN | BASTANTA, S.S. | III/b | 2.928.000 | 37.000 | 5% |
| KATOLIK | BARON FERRY SON PANDIANGAN, S.Ag, M.Th | IV/a | 4.551.000 | 41.000 | 15% |
| BUDDHA | SUWARNO, S.Ag, M.Pd | IV/a | 4.551.000 | 41.000 | 15% |

### Perubahan kode
- `APLIKASI/pegawai.js`: 4 entri PNS baru berisi `status: "PNS"`, `pphPct` (15 / 5).
- `APLIKASI/app.js`:
  - `statusPegawai(g)` + `akhiranStatus()` — status per orang (bukan konstanta `PPPK` lagi)
    dipakai di baris Tukin, Uang Makan, Kehadiran, judul lembar, dan nama file.
  - PPH uang makan per orang: `pegawai.pphPct` (PNS gol IV 15%, gol III/PPPK 5%,
    tarif khusus 35.000 tetap tanpa PPH).
  - `susunWorkbookBidang(hasil, tahun, bulan, status)`; sheet `TUKIN PNS`;
    berkas PNS bernama "… Bimas <BIDANG> PNS <BULAN>.xlsx", **PPPK tetap tanpa akhiran**
    (nama file lama tidak berubah).
  - Nama sheet kehadiran pakai `namaKey` roster supaya "Dr. SAMAREL …" jadi `SAMAREL`, bukan `DR`.
- `APLIKASI/index.html`: tombol unduh dikelompokkan per `BIDANG|STATUS` ("Unduh KRISTEN PNS"),
  status ditulis kecil di bawah kolom bidang; pencocokan nama tahan gelar
  ("Dr. SAMAREL TELAUM BANUA…" -> SAMAREL) dan memakai `namaKey` roster.
- `CADANGAN/build-roster.js`: sekarang membaca 6 folder (3 PPPK + 3 PNS), baca file lewat
  `fs.readFileSync` (bundle SheetJS di browser tidak punya `readFile`), menyimpan `status`,
  `pphPct`, dan `namaKey` yang melewati gelar. Dijalankan: 30 pegawai, 26 PPPK **tidak berubah**
  (dibandingkan per-field dengan roster lama).
- `APLIKASI/CARA-PAKAI.txt`: judul, tombol unduh, bagian "PEGAWAI PNS", struktur folder.

### Bukti uji
- `node CADANGAN/uji-app.js` -> **141 assertion LULUS** (sebelumnya 104). Tambahan uji PNS:
  roster 4 PNS + 26 PPPK utuh; SAMAREL 17 hari / tukin 4.551.000 / UM 697.000 / PPH 104.550 /
  bersih 592.450; BASTANTA 22 hari / 2.928.000 / 814.000 / 40.700; BARON 18 hari / 738.000 /
  110.700 / 627.300; SUWARNO 19 hari / TL 1,5% = 68.265 / tukin 4.482.735 / UM 779.000 /
  PPH 116.850 — **semua sama dengan file manual PNS September**. Berkas PNS terpisah (nama,
  sheet, judul, status, catatan pajak 15%) juga diuji; PPPK tetap tanpa akhiran & PPH 5%.
  Contoh output: `hasil-uji/tukin-pns-kr-test.xlsx`, `um-pns-kr-test.xlsx`, `kehadiran-pns-kr-test.xlsx`.
- Catatan data (bukan bug): di rekap manual BUDDHA, ABSEN MASUK SUWARNO 2026-09-07 kosong
  padahal kolom CEPAT TELAT -225 (artinya masuk 11:45); manual menghitung hari itu sebagai hari
  masuk (19 hari). Di uji, jam masuk itu diisi 11:45 lalu hasilnya cocok persis. Kalau file
  presensi asli memuat 11:45, tool otomatis memberi 19 hari + TL 1,5% seperti manual.

### Cara pakai untuk PNS
Sama seperti PPPK: pilih file presensi (mis. `SAMAREL_Presensi 9-2026.xlsx`) atau ambil dari
Drive, lalu klik "Unduh <BIDANG> PNS". Presensi PNS belum ada di folder ini — tinggal diunduh
dari absensi.kemenag.go.id seperti biasa.

## 🗂️ 2 November 2026 (sore) — FOLDER DIRAPIKAN JADI 3 SAJA
Permintaan user: isi folder `C:\Users\HP\tool-tukin` terlalu banyak, cukup 3 kelompok:
(1) file ambil dari Drive, (2) index.html + berkasnya, (3) sisanya sebagai arsip.

### Struktur sekarang
```
tool-tukin/
├── APLIKASI/          (936 KB)  index.html, app.js, pegawai.js, lib/xlsx.full.min.js, CARA-PAKAI.txt
├── AMBIL-DARI-DRIVE/  (17 KB)   AMBIL-DARI-DRIVE.cmd, alat-drive.js
└── CADANGAN/          (234 MB)  BIMAS KRISTEN/KATOLIK/BUDDHA, uji-app.js, uji-drive.js,
                                 build-roster.js, alat-lama/, halaman-ocr/, hasil-uji/,
                                 node_modules/, PDF+JPG+txt PMA 11/2019, diary ini
```

### Penyesuaian path (agar tidak ada yang rusak)
- `AMBIL-DARI-DRIVE/alat-drive.js`: `require('./app.js')` -> `require('../APLIKASI/app.js')`.
- `CADANGAN/uji-app.js` & `uji-drive.js`: `require` ke `../APLIKASI/...` dan
  `../AMBIL-DARI-DRIVE/alat-drive.js`; data dibaca lewat `path.join(__dirname, ...)`
  (folder `BIMAS .../` dan `hasil-uji/` ada di CADANGAN), jadi bisa dijalankan dari
  folder mana pun. `uji-drive.js` juga memuat `../APLIKASI/index.html` di Chrome.
- `CADANGAN/build-roster.js`: baca `CADANGAN/BIMAS ...` dan tulis `APLIKASI/pegawai.js`;
  `require` xlsx diganti ke `../APLIKASI/lib/xlsx.full.min.js` (tidak lagi menunjuk
  `C:/Users/HP/karo/node_modules/xlsx`). **Belum dijalankan** (akan menimpa pegawai.js).
- `CADANGAN/alat-lama/*.js`: path absolut PMA/halaman-ocr/pma-ocr-full.txt diarahkan ke `CADANGAN/`.
- `APLIKASI/index.html`: dua teks bantuan menyebut "AMBIL-DARI-DRIVE.cmd di folder
  AMBIL-DARI-DRIVE, sebelah folder APLIKASI".
- `APLIKASI/CARA-PAKAI.txt`: langkah pakai + bagian STRUKTUR FOLDER ditulis ulang,
  ditambah bagian "SIMPAN / CADANGAN DI GOOGLE DRIVE".

### Bukti uji
- `node CADANGAN/uji-app.js` (dari root maupun dari CADANGAN) -> **Semua uji LULUS ✔**
- `require('./AMBIL-DARI-DRIVE/alat-drive.js')` dan `require('./APLIKASI/app.js')` OK.
- Aset `index.html` lengkap: `lib/xlsx.full.min.js`, `pegawai.js`, `app.js` ada di APLIKASI.
- Uji Drive ke internet **tidak** dijalankan sore ini.

### Keputusan untuk Google Drive
- Yang diunggah cukup 2 folder berdampingan: `APLIKASI/` + `AMBIL-DARI-DRIVE/`
  (path relatif `../APLIKASI/app.js` butuh keduanya di folder induk yang sama).
- `CADANGAN/` tidak perlu diunggah (node_modules 213 MB, gambar OCR, data contoh);
  kalau mau arsip, taruh terpisah di folder Drive lain.
- Peringatan: jangan biarkan Windows mengubah nama jadi `APLIKASI (1)` setelah diunduh.

---

## 🔧 2 November 2026 — PERBAIKAN "AMBIL DARI DRIVE" FOLDER KATOLIK
Laporan user: link folder PPPK Bimas Katolik sudah ditempel, tombol "Ambil dari Drive"
tidak menghasilkan apa-apa (tabel kosong).

### Sebab (terbukti, bukan dugaan)
- Folder Katolik menamai file secara bebas: `Presensi Septemeber 2026 Eliyani Ginting.xlsx`,
  `Absensi Mei 2026.xlsx`, `Presensi  Juni-2026 Eliyani Br Ginting, S.S.xlsx`, dst.
- `namaFileDrive` hanya mencari bulan-tahun di NAMA FILE. Kalau kolom bulan-tahun (1b)
  kosong, 21 dari 39 file tidak menghasilkan nama berpola `NAMA_Presensi BULAN-TAHUN`
  → `terimaFile` melempar error → semua baris jadi ⛔ dan tabel tidak terisi.
- Filter rekap hanya `/^\s*rekap/`, sehingga "Salinan Rekapitulasi ..." dan
  "FIX_Rekapitulasi ..." lolos dianggap file presensi.

### Perbaikan
- `app.js`: `periodeDariJalur()` + `tahunTerdekat()` — bulan-tahun dibaca dari JALUR folder
  Drive (`1. 2026 / 9. SEPTEMBER`, `2025 / DES`, `5.MEI`), termasuk salah ketik
  ("Septemeber", pakai 4 huruf pertama) dan bulan yang muncul lebih awal menang
  (nama penyuluh "AGUSTINA" tidak dianggap Agustus). `namaFileDrive` memakai jalur ini
  sebelum kolom bulan-tahun manual.
- `alat-drive.js`: `namaRekapManual()` — buang awalan SALINAN/COPY/FIX/BARU/TERBARU/DARI
  sebelum cek "REKAP", jadi file rekap manual tidak ikut terbaca.
- `index.html`: kalau kolom bulan-tahun kosong dan folder berisi >1 bulan, muncul saran
  isi kolom itu (mis. `9-2026`) agar hanya satu bulan diambil.

### Bukti uji (folder Drive asli)
- Folder `BIMAS KATOLIK` tanpa kolom bulan-tahun: 32/32 file terbaca (sebelumnya 21 gagal),
  0 file rekap lolos. Dengan `9-2026`: tepat 3 file (ELIYANI, LUSIANA, MARLIANA).
- Klik tombol nyata di Chrome (`file://`): "32 dari 32 file presensi diambil dari Drive",
  3 baris tabel, tanpa error "nama file tidak sesuai pola".
- Regresi folder KRISTEN: tetap 20/20 file, 19 baris tabel; `node uji-app.js` semua LULUS
  (ditambah 10 assertion baru untuk `periodeDariJalur`).

### Catatan data (bukan bug tool)
- `MARLIANA ... 1. JAN ... MARLIANA PRESENSI JAN 2026.xlsx` → "Tidak ada baris tanggal"
  (isi file Januari berbeda/kosong) — perlu dicek manual.
- Folder Katolik 2025 masih ada `RUDOLF SIBAGARIANG` yang tidak ada di roster.

---

## ✅ 2 November 2026 (lanjutan) — VERIFIKASI KATOLIK OKTOBER 2026 (TUKIN/UM BAYAR NOVEMBER)
Permintaan user: "untuk bulan November (tukin uang makan Oktober) Bimas Katolik PPPK, link drivenya
… bagaimana agar file Excel-nya terbaca sehingga keluar rekap kehadiran, tukin dan uang makan."

### Link & isi folder yang dipakai
- Link: `https://drive.google.com/drive/folders/1Zx4rPKDHFMirGDS6U1lgWkBlEqrQj81a`
  (folder **10. OKTOBER**, id `1Zx4rPKDHFMirGDS6U1lgWkBlEqrQj81a`, di bawah `BIMAS KATOLIK / 1. 2026`).
- Isi: 3 file presensi (`Eliyani Br Ginting/Presensi Eliyani Br Ginting _Oktober 2026.xlsx`,
  `Lusiana Rotua Naibaho/Presensi 10-2026.xlsx`, `MARLIANA SIBAGARIANG/Presensi 10-2026.xlsx`),
  3 file `Salinan Rekapitulasi … KATOLIK OKT.xlsx`, dan 6 gambar (SS tukin/uang makan).
  Total 12 item → 3 diambil, **9 dilewati** (rekap manual & gambar).
- Nama bebas tetap terbaca: `Presensi Eliyani Br Ginting _Oktober 2026.xlsx` → `ELIYANI_Presensi 10-2026.xlsx`
  (bulan-tahun dari jalur `1. 2026 / 10. OKTOBER`).

### PENTING: kolom bulan-tahun = 10-2026, bukan 11-2026
Tool menamai hasil dari **bulan presensi**, bukan bulan pembayaran. Diuji: isi `11-2026` →
**0 file** ("3 file bulan lain dilewati"). Jadi tukin/uang makan yang dibayar November tetap
memakai `10-2026` dan file keluar bernama `… Bimas KATOLIK OKT.xlsx`.

### Langkah pakai (yang dijanjikan ke user)
1. Dobel-klik `AMBIL-DARI-DRIVE.cmd`, biarkan jendela terbuka.
2. Dobel-klik `index.html`.
3. Panel 1b: tempel link folder, kolom bulan-tahun isi `10-2026`, klik **Ambil dari Drive**.
4. Tunggu "3 dari 3 file presensi diambil dari Drive" → tabel 3 baris.
5. Klik **Unduh KATOLIK** → 3 file ke folder Unduhan.
6. Kalau muncul "Pengambil Drive belum jalan" → jendela `.cmd` sudah tertutup, buka lagi.

### Hasil hitung (terverifikasi, disimpan di `hasil-uji/`)
| Pegawai | Hadir | Tukin bersih | Uang makan | PPH | UM bersih |
|---|---|---|---|---|---|
| ELIYANI BR GINTING, S.S (IX) | 22 | Rp3.319.000 | Rp814.000 | Rp40.700 | Rp773.300 |
| LUSIANA ROTUA NAIBAHO, S.Ag (IX) | 22 | Rp3.319.000 | Rp814.000 | Rp40.700 | Rp773.300 |
| MARLIANA SIBAGARIANG, A.Md (VII) | 22 | Rp2.702.000 | Rp770.000 | – (tarif 35.000, bebas PPH) | Rp770.000 |

- Tanpa telat / PSW / TK / cuti pada ketiga orang.
- **Cocok persis** dengan `Salinan Rekapitulasi Tukin/Uang Makan Bimas KATOLIK OKT.xlsx`
  buatan user (tukin 3.319.000 / 3.319.000 / 2.702.000; hari masuk 22; PPH 40.700).
- File uji yang dihasilkan: `hasil-uji/Rekapitulasi Kehadiran Bimas KATOLIK OKT.xlsx`
  (sheet DATA PENYULUH + ELIYANI/LUSIANA/MARLIANA), `… Tukin … OKT.xlsx` (TUKIN PPPK),
  `… Uang Makan … OKT.xlsx` (UANG MAKAN).

### Beda tampilan vs file manual (bukan bug, sudah ada sejak awal)
- `SATKER_2` ditulis "Pembimbing Masyarakat **KATOLIK**" (manual: "Katolik").
- Rupiah ditulis sebagai teks format ` Rp814.000 ` (manual: angka murni 814000).

### Sisa / catatan
- `MARLIANA … 1. JAN … MARLIANA PRESENSI JAN 2026.xlsx` masih "Tidak ada baris tanggal"
  (isi file Januari beda) — perlu dicek manual, tidak menghalangi bulan Oktober.
- `RUDOLF SIBAGARIANG` (folder Katolik 2025) masih tidak ada di roster.
- Kalau nanti user mau nama file keluar "NOV" (bulan bayar), perlu perubahan kode — belum diminta.

---

## 🆕 16 Oktober 2026 (siang) — FITUR "AMBIL DARI GOOGLE DRIVE" (panel 1b)
Permintaan user: "tombol upload bisa langsung ke presensi penyuluh via link drive"
(folder Drive user: editor untuk semua orang → tiap penyuluh punya subfolder + file presensi).

### Hasil investigasi (penting, jangan diulang)
- Dari halaman `file://` (index.html dobel-klik) **Chrome memblokir isi file Drive**:
  `drive.google.com/uc?export=download` & `drive.usercontent.google.com/download`
  → "No 'Access-Control-Allow-Origin' header is present" (origin `null` tidak dilayani ACAO,
  walau curl/server melihat ACAO `*`). Drive API `www.googleapis.com` sendiri boleh dibaca
  (uji kunci palsu → 400 terbaca), tapi langkah unduh isinya lewat redirect tetap diblokir
  → **versi kunci API murni-browser tidak dipakai (tidak bisa diandalkan)**.
- Yang JALAN dan sudah dibuktikan dengan data asli: **helper Node lokal** (Node tidak dibatasi CORS):
  - daftar folder via `drive.google.com/embeddedfolderview?id=<ID>` (tanpa kunci API, tanpa login)
  - unduh isi via `drive.google.com/uc?export=download&id=<ID>` (9514 byte, magic PK ✓)
  - halaman `file://` boleh mengambil dari `http://127.0.0.1` (server helper kirim CORS `*`)

### Yang dibuat
- `alat-drive.js` — server kecil 127.0.0.1:8787 (Node saja, tanpa npm baru):
  `/status`, `/daftar?link=&periode=9-2026`, `/isi?id=`. Membaca folder **rekursif**
  (tahun / bulan / folder nama penyuluh / file), menyaring file rekap manual & PDF/JPG/PNG,
  dan menyaring bulan lain kalau kolom bulan-tahun diisi.
- `AMBIL-DARI-DRIVE.cmd` — peluncur dobel-klik (cek Node ada, kasih petunjuk di jendelanya).
- `index.html` panel **1b**: tempel link (boleh banyak baris) + kolom bulan-tahun + tombol
  "Ambil dari Drive". Hasil langsung masuk pipeline lama (tabel, HUKDIS/TB, unduh 3 Excel).
  Tambahan: "Kosongkan daftar", sumber file ditulis di tabel ("Drive: jalur"), dan satu orang
  yang punya 2 file otomatis dipakai yang namanya paling jelas (catatan kuning).
- `app.js`: `ambilIdDrive`, `parseDriveLinks`, `namaFileDrive` (nama folder + bulan-tahun
  kalau nama file tak berpola), `namaDariFolder` (buang "01.", "FIX", "SS TUKIN" dll.),
  `cocokPeriodeDrive`, `periodeDariNama`. Ditambah: `cariPegawai` di index.html mencoba
  kata pertama kalau nama file memuat nama lengkap ("ELIYANI BR GINTING_Presensi 2-2026.xlsx").

### Bukti uji (data asli dari Drive user)
- `node uji-app.js` → **semua LULUS** (64 assertion; lama 40 + Drive/nama folder/penyaring).
- `node uji-drive.js` → **semua LULUS**:
  - folder KRISTEN "9. SEPTEMBER 2026": 20/20 file diambil, **ARDI 18 hari / UM 666.000 /
    PPH 33.300 / tukin 3.319.000** (sama dengan file manual), CHRISTIN 22 hari TL Rp16.595,
    MAYANI "Presensi 9-2026.xlsx" → dibaca 20 hari. 56 file rekap/PDF/JPG disaring.
  - link arsip besar (Katolik+Buddha, `1DhF5IdQqltlTv-XrdZnnG4pVuTiDXNG3`): tanpa penyaring
    75 file; dengan penyaring `9-2026` → **6 file saja** (ADES, ANSANI, WINNER, ELIYANI,
    LUSIANA, MARLIANA), tidak ada bulan lain yang lolos, 69 dicatat dilewati.
  - uji tombol nyata di Chrome (index.html) → 17 baris tabel terisi dari Drive.
- Contoh hasil unduhan dari Drive: `hasil-uji/drive-ARDI.xlsx`.

### Sisa / catatan
- Helper harus jalan (jendela `.cmd` terbuka) saat memakai panel 1b; tanpa itu tool tetap
  normal untuk pilih file manual.
- Penyuluh sebaiknya satu bulan satu folder (seperti KRISTEN) supaya cukup tempel 1 link;
  link arsip tetap bisa tapi wajib diisi kolom bulan-tahun.
- Belum dikonfirmasi user: PSW `-990/-1020` (SUTIKNO / ELIYANI / MAYANI) dihitung 1,5%.

---

## 🎉 LANJUTAN 16 Oktober 2026 — TOOL SELESAI & LULUS UJI
Semua langkah "rencana besok" sudah dikerjakan:
- **`app.js`** (UMD): parser presensi (nama/bulan/tahun dari nama file), klasifikasi harian (hadir / libur / TK / telat / psw-awal / tidak-presensi), tangga PMA, PPH uang makan, cap 100%, dan penyusun 3 workbook per bidang meniru struktur file manual persis (kolom, format `" Rp3,319,000 "`, `" Rp-   "`, persen `0.5`, jam `8:0`/`17:0`, tanggal `2026-9-01 00:00:00`, Dinas Luar di kolom JENIS TUGAS, PSW `-990` untuk tidak rekam kepulangan).
- **`index.html`**: UI dobel-klik — pilih banyak file, tabel hasil, deteksi anomali (baris kuning), dropdown untuk nama ambigu (2 DAVID) tersimpan localStorage, kolom manual HUKDIS/TB, unduh per bidang + Unduh SEMUA.
- **`uji-app.js`**: 40 assertion LULUS — ARDI (hadir 18, cuti 4×15-18, UM 666.000, PPH 33.300, bersih 632.700, potongan 0) & CHRISTIN (hadir 22, telat 2 menit 2026-09-09 → TL Rp16.595 0,5%, UM 814.000/40.700/773.300, tukin bersih 3.302.405) + tangga persen + format + nama file + sheet. Contoh output Excel tersimpan di `hasil-uji/`.
- **`CARA-PAKAI.txt`**: petunjuk bulanan untuk user.
- Skrip sekali-pakai (OCR/inspect) dipindah ke `alat-lama/`; folder kini bersih: index.html, app.js, pegawai.js, uji-app.js, CARA-PAKAI.txt, build-roster.js.

**Sisa untuk demo:** dobel-klik index.html di Chrome & uji unduhan nyata (tombol unduh); konfirmasi user tentang kasus PSW `?` (SUTIKNO/ELIYANI/MAYANI tipe: tidak rekam kepulangan = 1,5%).

---

## ⇡ Catatan sesi asli — 15 Oktober 2026

### 1. Pemetaan format file (3 bidang, selesai)
- **File presensi** (unduhan per orang dari absensi.kemenag.go.id):
  1 sheet `Worksheet`: `TANGGAL | HARI | JAM MASUK | JAM PULANG | ALASAN TIDAK HADIR | DESKRIPSI` (30–31 baris; Sabtu/Minggu kosong).
  Nama pegawai = awalan nama file sebelum `_Presensi` (contoh: `ARDI_Presensi 9-2026.xlsx`), bulan-tahun di akhir nama file (`9-2026`).
- **Rekapitulasi Kehadiran** (karya manual user): 1 sheet per orang: `NAMA | NIP | JABATAN | TANGGAL | HARI | JAM MASUK (harus 8:00) | ABSEN MASUK | CEPAT TELAT (menit; negatif = telat) | JAM PULANG (harus: 16:30, Jumat 17:00) | ABSEN PULANG | PSW (menit; negatif = pulang terlambat/kosong anomali) | LIBUR (Cuti Tahunan, Dinas Luar, dll.)`
- **Rekapitulasi Tukin**: `NO | TAHUN | BULAN | NIP | NAMA | GOL/RUANG | JABATAN | KELAS JABATAN | TUKIN | TK JUMLAH | TK PERSEN | TL (rupiah)` + legend TK/TL/PSW/HUKDIS/TB.
- **Rekapitulasi Uang Makan**: `NO | TAHUN | BULAN | NIP | NAMA | GOL/RUANG | HARI MASUK | UANG MAKAN | PPH | JUMLAH BERSIH` + baris tarif (`1 HARI = Rp37.000` / Katolik punya juga `Rp35.000` untuk Marliana Gol VII) + `PAJAK UANG MAKAN 5%`.

### 2. Aturan potongan — diekstrak dari SK via OCR (selesai & dikonfirmasi user)
- PDF `PMA_NOMOR_11_TAHUN_2019.pdf` = scan (19 hlm, tanpa teks) → dirender per halaman dengan pdfjs-dist + @napi-rs/canvas lalu OCR tesseract.js (bahasa `ind`) → `pma-ocr-full.txt`; jpeg ss Instagram juga dibaca via OCR (`pma-ocr-jpeg.txt`).
- **Tukin (tanpa alasan sah):**
  - Tidak masuk kerja (TK) → **3%/hari**
  - Tidak di tempat tugas tanpa izin/penugasan → **2%**
  - Tidak presensi masuk ATAU pulang → **1,5%/kejadian**
  - TL & PSW (tangga sama, dikonfirmasi user):
    - 1–29 menit → **0,5%**; 30–59 menit → **1%**; 61–89 menit → **1,25%**; ≥90 menit / tidak absen → **1,5%**
  - Potongan kumulatif maksimal **100%/bulan**
- **Cuti sah → tukin 0%** (sakit 1–14 hri 0%, 15 hri+ mulai 1,5%/hri; bersalin anak 1–3 = 0%, ke-4+: b1 30%/b2 40%/b3 50%; alasan penting 1–2 hri 0%, >2 → 2,5%/hri; cuti besar b1 50%, b2 75%, b3 90%; Tugas Belajar >6 bln → 50% sejak bulan ke-7). **HUKDIS & TB → kolom manual di tool (keputusan user).**
- **Uang makan** = tarif/hari × **jumlah hari hadir kerja saja** (cuti/DL/TK tidak dihitung); **PPH 5%** dari uang makan (kecuali per-orang khusus, mis. Marliana Katolik: tanpa PPH, tarif 35.000).
- **Verifikasi silang dengan data September cocok:** telat 2 menit × 0,5% × 3.319.000 = Rp16.595 ✔; Ades Buddha 0,5% × 2.928.000 = Rp14.640 ✔; Ardi cuti 4 hri → hari masuk 18 → 666.000 → PPH 33.300 ✔.

### 3. Aset yang sudah dibuat di folder ini
- `pegawai.js` — **roster 26 pegawai** (KRISTEN 20, KATOLIK 3, BUDDHA 3): bidang, nip, nama, namaKey (kata pertama), gol, jabatan, kelasJabatan, tukin (dibaca dari file, contoh Gol IX = 3.319.000; SABAR VII Penata = 2.928.000; Marliana VII Pengelola = 2.702.000), tarifUangMakan (default 37.000; Marliana 35.000). Dibangun oleh `build-roster.js` dari file Rekapitulasi Tukin/Uang Makan September.
- `lib/xlsx.full.min.js` — library SheetJS (disalin dari node_modules project situs) untuk baca/tulis Excel di browser, **100% offline**.
- `node_modules` (pdf-parse, tesseract.js, pdfjs-dist, @napi-rs/canvas) + skrip sekali-pakai: `inspect-tmp.js`, `build-roster.js`, `extract-pdf.js`, `ocr-ekstrak.js`, `ocr-pdf-full.js`, hasil ekstraksi `pma-ekstrak.txt`, `pma-ocr-jpeg.txt`, `pma-ocr-full.txt`, `halaman-ocr/hal-01..19.png`.

### Keputusan user yang tercatat
- Bentuk **A** (dobel-klik `index.html`, tanpa server) di folder `C:\Users\HP\tool-tukin`
- **Tidak mengubah project situs IMKKSA** (repo karo tetap bersih, situs tetap di deploy `17b4e42`).
- TK/tidak-presensi dipindai **otomatis** dari file presensi; HUKDIS/TB/koreksi via **manual UI**.
- Uang makan hanya dari hari hadir; no huge extra rules.

---

## ⬜ Rencana besok (16 Oktober 2026) — lanjut di sini

1. **Tulis `app.js`** (UMD-style agar bisa dites dari Node):
   - parse unduhan presensi (nama/bulan/tahun dari nama file),
   - klasifikasi tiap hari kerja: hadir / TK (3%) / alasan sah (cuti/DL; 0%) / telat (tangga PMA) / PSW (tangga sama) / tidak-presensi (1,5%/kejadian),
   - aneh-aneg data: PSW -990/-1020 & absen masuk 480 → perlakukan sbg kejadian tidak-presensi 1,5%, tunjukkan di UI agar bisa dikoreksi manual,
   - hitung: hariMasuk, TK JUMLAH, TK PERSEN, TL (rupiah sdg TL+PSW+no-presens+manual HUKDIS/TB), potongan kumulatif maks 100%,
   - uang makan: tarif × hariMasuk − PPH 5% (per-orang flag pph),
   - export **3 file Excel per bidang** dengan struktur & nama yang meniru file manual: `Rekapitulasi Kehadiran/Tukin/Uang Makan Bimas <BIDANG> <LABEL>.xlsx` + (opsional) sheet rekap gabungan.
2. **Tulis `index.html`**: UI sederhana (pilih banyak file presensi; tabel hasil per orang bertag bidang; jika nama ambigu/ketemu ganda seperti 2 DAVID → dropdown tetapkan manual, disimpan localStorage agar bulan depan otomatis; kolom manual HUKDIS/TB %; tombol unduh per bidang & "unduh semua").
3. **Uji di Node** dengan 2 contoh unduhan (ARDI & CHRISTIN September) vs file manual user:
   - ARDI: hariMasuk 18, uang makan 666.000, PPH 33.300, bersih 632.700, potongan tukin Rp0, TK 0.
   - CHRISTIN: hariMasuk 22, uang makan 814.000, PPH 40.700, TL = Rp16.595 (telat 2 menit di 2026-09-09!), TK 0.
4. **Tulis `CARA-PAKAI.txt`** + bersihkan skrip sekali-pakai (pindah ke `alat-lama/`) + uji dobel-klik di Chrome (file://).
5. Roster bisa di-refresh tiap bulan dengan `node build-roster.js` kalau daftar pegawai berubah.

## 🧪 Data uji penting (supaya besok tidak mencari lagi)
- ARDI: cuti tahunan 15–18 Sep (4 hari) → tk 0, hari masuk 18.
- CHRISTIN: telat **2 menit di 2026-09-09** (absen 8:02 vs 08:00) → TL Rp16.595 (0,5%).
- Marliana Katolik (Gol VII, tarif 35.000) → tanpa PPH.
- SABAR: Dinas Luar 15–18 Sep → tidak dihitung hari masuk, tukin 0%.
- SUTIKNO & ELIYANI: anomali absen pulang (PSW −990 / −1020) → 1,5%/kejadian menurut aturan "tidak rekam kehadiran pulang" — mohon konfirmasi ulang user saat demo.

## 📌 Cara resumi keadaan
- Project situs IMKKSA: master = `17b4e42` (hapus NIK), bersih, sudah live.
- Folder tool: `C:\Users\HP\tool-tukin` — semua progress tool tersendiri, tidak terkait repo situs.

### TAHAP 2 — skema Supabase + admin (10 November 2026)

- `aplikasi-web/supabase/migrations/0001_init.sql`: 14 tabel, 8 enum, trigger `updated_at`,
  `is_admin()`, `pegawai_saya()`, `direktori_pegawai()` (security definer), 25 policy RLS.
- `0002_seed_referensi.sql`: 11 bidang, 16 aturan potongan versi 1 (nilai sama dengan `app.js`),
  `jam_kerja`, `aturan_versi_aktif`, kunci folder Drive.
- `0003_seed_pegawai.sql`: 30 pegawai hasil generate `scripts/buat-seed-pegawai.mjs`
  (22 Kristen, 4 Katolik, 4 Buddha); semua NIP 18 digit.
- Enum `jenis_hari` disesuaikan dengan keluaran `klasifikasiHari()`:
  `hadir | libur | tk | tidak_presensi | weekend` + kolom `sisi`, `libur_sub`, `jenis_tugas`.
- Diterapkan ke Supabase 10 Nov 2026; `scripts/cek-skema.mjs` → SEMUA CEK LULUS.
- Admin pertama `bastantabangun2024@gmail.com` (login diuji, peran `admin` terbaca),
  tercatat di `audit_log` sebagai `buat_admin`.
- Uji RLS dengan token login: admin lihat 30 pegawai & boleh ubah `pengaturan`; anon
  tidak lihat `pengaturan` dan ditolak menulis `pegawai` (HTTP 401); direktori publik
  hanya 4 kolom non-sensitif.
- Uji migrasi di Postgres asli (PGlite) sebelum diterapkan: 25 asersi lulus, termasuk
  pengajuan ganda ditolak, `hukdis_pct > 100` ditolak, dan migrasi aman dijalankan dua kali.
- Catatan data: 1 dari 4 PNS bergolongan III/b (PPh uang makan 5%, bukan 15%).
- HUKDIS/TB aktif: `hukdis_pct` & `tb_pct` per pengajuan (diisi admin), bukan setelan global.

### TAHAP 3 awal — halaman login lokal (10 November 2026)

- `aplikasi-web/server.mjs`: server statis + `/api/konfigurasi`. Dua bug ditemukan & diperbaiki:
  `process.env` kosong menimpa `.env.local`, dan `readFileSync` tanpa `'utf8'` membuat parse gagal
  (Buffer.split tidak ada, tertangkap `catch` sehingga env dianggap kosong).
- `public/masuk.html` + `public/dasbor.html`: login Supabase Auth, profil/peran, ringkasan data admin.
- `jalankan-web.cmd`: peluncur Windows.
- Uji: `/`, `/masuk.html`, `/dasbor.html` 200; 404 untuk path asing; login admin 200 (peran `admin`);
  password salah 400; `/api/konfigurasi` mengembalikan URL + kunci publishable saja.
- Ringkasan menyeluruh hari ini dicatat di `README.md` akar project.
