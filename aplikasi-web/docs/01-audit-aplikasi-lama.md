# 01 — Audit Aplikasi Lama (TAHAP 1)

Tanggal audit: 10 November 2026
Objek: `aplikasi-offline/` (versi offline yang dipakai harian)
Tujuan: memastikan aplikasi web bisa memakai mesin yang sudah terbukti, dan mencatat
bagian yang **tidak boleh** dibawa apa adanya ke web.

---

## 1. Ringkasan

| Aspek | Keadaan |
|---|---|
| Bentuk | 1 halaman statis (`index.html`) + 1 file mesin hitung (`app.js`, UMD) + roster (`pegawai.js`) |
| Pemakaian | Dobel-klik `index.html`, tanpa login, tanpa database; hasil diproses di browser |
| Data | Roster 30 pegawai (26 PPPK + 4 PNS) di-hardcode; tarif tukin/uang makan/PPH ikut roster |
| Keluaran | 3 workbook Excel per kombinasi **bidang + status** (Kehadiran, Tukin, Uang Makan) |
| Uji | `uji-app.js` 141 assertion, `uji-presensi-terpisah.js` 85 assertion — LULUS; angka cocok dengan file manual September & Oktober |
| Kesiapan web | Mesin hitung siap dipakai ulang; lapisan identitas, aturan, penyimpanan, dan Drive harus diganti |

**Kesimpulan singkat:** perhitungannya sudah benar dan teruji. Yang belum ada adalah
semua hal yang membuatnya layak jadi sistem online berbilang pengguna: identitas berbasis NIP,
otorisasi, aturan yang bisa diubah, riwayat/audit, dan penyimpanan terpusat.

---

## 2. Inventaris file

| File | Baris | Peran |
|---|---:|---|
| `APLIKASI/app.js` | 671 | Mesin: parser presensi, klasifikasi harian, potongan, PPH, penyusun 3 workbook, utilitas penamaan file/Drive |
| `APLIKASI/index.html` | 439 | UI offline: pilih file, tabel hasil, dropdown ambigu, HUKDIS/TB, tombol unduh, panel "Ambil dari Drive" |
| `APLIKASI/pegawai.js` | 390 | Roster 30 pegawai (bidang, status, NIP, nama, gol, jabatan, kelas, tukin, tarif UM, PPH) |
| `APLIKASI/lib/xlsx.full.min.js` | — | SheetJS untuk baca/tulis Excel di browser |
| `AMBIL-DARI-DRIVE/alat-drive.js` | 322 | Helper Node lokal (127.0.0.1:8787–8797): daftar & unduh file Drive, menyaring rekap/gambar |
| `CADANGAN/uji-app.js` | — | Uji regresi (data September + PNS + Drive + format laporan) |
| `CADANGAN/uji-presensi-terpisah.js` | — | Uji presensi masuk/pulang terpisah (85 assertion) |
| `CADANGAN/build-roster.js` | — | Menyusun `pegawai.js` dari 6 folder rekap manual |

---

## 3. Mesin hitung — apa yang sebenarnya dilakukan `app.js`

### 3.1 Membaca file presensi (`bacaSheetPresensi`)
- Hanya **sheet pertama** yang dibaca.
- Baris header dicari di 10 baris pertama; harus memuat teks `TANGGAL` **dan** `JAM MASUK`.
- Kolom sesudah itu diambil **berdasarkan urutan (index)**, bukan nama:
  `0 TANGGAL · 1 HARI · 2 JAM MASUK · 3 JAM PULANG · 4 ALASAN TIDAK HADIR · 5 DESKRIPSI`.
- Jam diterima sebagai teks (`7:21`, `08.02`, `17:0`) atau angka menit; nilai numerik di luar
  0–1440 dianggap `null` (itulah cara `-990`/`-1020` dideteksi sebagai anomali).
- File tanpa header yang dikenali → error "bukan file presensi unduhan?".

**Implikasi web:** struktur file Kemenag saat ini belum tentu selamanya. Validasi harus
memakai pemeriksaan yang sama **dan** memberi pesan galat yang bisa ditindaklanjuti.

### 3.2 Identitas pegawai
- Diambil dari **nama file**: pola `NAMA_Presensi BULAN-TAHUN.xlsx` (`parseNamaFile`).
- Nama dicocokkan ke roster lewat `namaKey` (kata pertama nama, huruf besar).
- Bila nama file memuat nama lengkap + gelar, diambil kata pertama yang bukan gelar
  (`Dr. SAMAREL TELAUM BANUA…` → `SAMAREL`).
- Nama kembar (2 `DAVID`, 2 `NELLY`) → dropdown pilihan manual, disimpan di `localStorage`
  dengan kunci **nama file**.

**Temuan penting:** file presensi Kemenag **tidak memuat NIP**. Artinya di web pun NIP
tidak bisa diverifikasi dari isi file; identitas harus datang dari akun yang login, dan
kecocokan nama file hanya bisa dipakai sebagai peringatan (lihat `02` bagian validasi).

### 3.3 Klasifikasi satu hari (`klasifikasiHari`)
| Kondisi | Jenis | Potongan |
|---|---|---|
| Sabtu/Minggu | `weekend` | 0 (tetap ditulis di rekap kehadiran) |
| Ada `ALASAN` mengandung "dinas luar" | `libur` (kolom JENIS TUGAS) | 0 |
| Ada `ALASAN` lain (Cuti/Izin/Sakit) | `libur` (kolom LIBUR) | 0 |
| Jam masuk & pulang kosong | `tk` | 3% / hari |
| Hanya jam pulang | `noPresensi` sisi masuk | 1,5% / kejadian |
| Hanya jam masuk | `noPresensi` sisi pulang | 1,5% / kejadian, ditandai anomali |
| Lengkap | `hadir` | telat / pulang lebih awal sesuai tangga |

Jam wajib: masuk **08:00**, pulang **16:30** (Jumat **17:00**). Hari kerja = Senin–Jumat,
**tanpa kalender hari libur nasional**.

Tangga potongan TL/PSW (`tanggaPersen`, per kejadian):
`1–29 mnt 0,5% · 30–60 mnt 1% · 61–89 mnt 1,25% · ≥90 mnt / tidak absen 1,5%`.

### 3.4 Agregasi (`prosesSatuOrang`)
- `hariMasuk` = hari kerja dengan presensi masuk **dan** pulang lengkap.
- `hariHadirUangMakan` = hadir + `noPresensi` (satu sisi valid sudah dihitung).
- TK = jumlah hari `tk` × 3%; TL = telat + 1,5% × (tidak presensi masuk);
  PSW = pulang lebih awal + 1,5% × (tidak presensi pulang).
- HUKDIS & TB = angka manual dari UI (persen), bukan dari file.
- Total persen dibatasi **maksimal 100%** per bulan; tiap komponen dirupiahkan
  (`Math.round(tukin × % / 100)`), `tukinBersih = tukin − rupiah(total%)`.
- Uang makan = `tarif × hariHadirUangMakan`; PPH per orang (`pphPct`), tarif Rp35.000 tanpa PPH.
- **Tidak ada PPh atas tukin** — hanya uang makan.

### 3.5 Ekspor Excel
- Nama file meniru manual: `Rekapitulasi Kehadiran/Tukin/Uang Makan Bimas <BIDANG>[ PNS] <LABEL BULAN>.xlsx`.
- Kehadiran: sheet `DATA PENYULUH` + satu sheet per pegawai (nama = `namaKey`).
- Tukin: 1 sheet `TUKIN PPPK`/`TUKIN PNS`; Uang Makan: 1 sheet `UANG MAKAN`, plus baris
  catatan `PAJAK UANG MAKAN` (5% / 15%).
- Format sel **sengaja berupa teks** menyerupai file manual:
  rupiah `" Rp3,319,000 "`, nol `" Rp-   "`, persen `0.5`, jam `8:0`/`17:0`,
  tanggal `2026-9-01 00:00:00`, PSW `-990` bila pulang tidak terekam.
- `CEPAT TELAT` ditulis **positif = datang lebih awal**, negatif = telat (mengikuti manual).

---

## 4. Roster (`pegawai.js`)

- 30 pegawai: KRISTEN 20 PPPK, KATOLIK 3, BUDDHA 3, ditambah 4 PNS
  (SAMAREL IV/b, BASTANTA III/b, BARON IV/a, SUWARNO IV/a).
- Field: `bidang, status, nip, nama, namaKey, gol, jabatan, kelasJabatan, tukin, tarifUangMakan, pphPct`.
- Nilai tukin/PPH berlaku sebagai **data**, bukan rumus — inilah yang harus pindah ke database
  supaya bisa diubah admin tanpa mengubah kode.
- `gol` untuk PPPK memakai kelas (IX, VII), untuk PNS memakai golongan (IV/a, III/b) —
  format tidak seragam, perlu dinormalisasi saat migrasi (golongan + ruang dipisah).

---

## 5. Fitur "Ambil dari Drive" (offline)

- Butuh `AMBIL-DARI-DRIVE.cmd` + Node.js; server kecil di `127.0.0.1` (port 8787–8797).
- Daftar folder dibaca dari halaman `embeddedfolderview` Google Drive (**bukan API resmi**),
  isi file diunduh lewat `uc?export=download`.
- Rekursif (tahun → bulan → folder penyuluh), menyaring file rekap manual, PDF, JPG, PNG.
- Bulan-tahun dibaca dari nama file atau **jalur folder** (`1. 2026 / 9. SEPTEMBER`).

**Tidak bisa dipakai di web**: browser di Vercel tidak boleh bergantung pada `127.0.0.1`,
dan pembacaan HTML Drive rapuh. Harus diganti Google Drive API + OAuth di sisi server
(lihat `02` bagian 8).

---

## 6. Bukti uji yang ada

| Uji | Cakupan | Hasil |
|---|---|---|
| `uji-app.js` | Data September Kristen + PNS + penyaring Drive + format laporan | 141 assertion LULUS (dijalankan ulang 10 Nov 2026 setelah folder dipisah) |
| `uji-presensi-terpisah.js` | Masuk/pulang terpisah, lintas bidang & status, data Oktober | 85 assertion LULUS |
| Data asli Oktober | HENDRO, MAYANI, DAVID (jam tidak lengkap) | Uang makan 22/21/22 hari, potongan tetap 1,5%/3%/3,5% |
| Data manual September/Oktober Katolik | Tukin, hari masuk, PPH | Cocok persis dengan file buatan user |
| `uji-drive.js` | Folder Drive KRISTEN/KATOLIK asli | LULUS (butuh internet + Chrome) |

Angka acuan yang bisa dipakai sebagai *golden test* aplikasi web:

| Pegawai | Hadir | Tukin | Potongan | Uang makan | PPH | UM bersih |
|---|---:|---:|---:|---:|---:|---:|
| ARDI (IX, Sept) | 18 | 3.319.000 | 0 | 666.000 | 33.300 | 632.700 |
| CHRISTIN (IX, Sept) | 22 | 3.319.000 | 16.595 (telat 2 mnt) | 814.000 | 40.700 | 773.300 |
| SAMAREL (IV/b, PNS Sept) | 17 | 4.551.000 | 0 | 697.000 | 104.550 | 592.450 |
| SUWARNO (IV/a, PNS Sept) | 19 | 4.551.000 | 68.265 (TL 1,5%) | 779.000 | 116.850 | 662.150 |

---

## 7. Temuan audit

Tingkat: **Kritis** = menghalangi sistem online; **Tinggi** = menyalahi aturan/keamanan;
**Sedang** = hasil bisa berbeda dari yang diharapkan; **Rendah** = rapi-rapi.

| # | Tingkat | Temuan | Dampak di web | Rekomendasi |
|---|---|---|---|---|
| A1 | Kritis | Identitas berasal dari nama file, bukan NIP | Siapa pun bisa mengunggah file atas nama orang lain | Identitas dari sesi login + NIP; cocokkan nama file sebagai peringatan; simpan `diunggah_oleh` |
| A2 | Kritis | Tidak ada login/otorisasi sama sekali | Semua data terbuka bagi siapa pun yang punya file | Supabase Auth + RLS; pegawai hanya melihat datanya |
| A3 | Kritis | Roster di-hardcode di `pegawai.js` | Admin tidak bisa menambah pegawai/pendaftar | Tabel `pegawai` + `users` + `pendaftaran`; `pegawai.js` hanya sumber migrasi awal |
| A4 | Tinggi | Semua aturan potongan berupa konstanta kode (3%, 1,5%, tangga, 08:00/16:30/17:00, cap 100%) | Perubahan juknis butuh deploy; hasil lama bisa berubah bila kode diubah | Tabel `aturan_potongan` berversi; mesin menerima objek aturan; `aturan_versi` disimpan di setiap hasil |
| A5 | Tinggi | HUKDIS/TB disimpan di `localStorage` per nama file | Tidak ada jejak siapa mengisi apa; hilang bila browser dibersihkan | Input hanya admin, tersimpan per pengajuan + `audit_log` |
| A6 | Tinggi | Nama kembar diselesaikan dropdown manual di browser | Keputusan tidak tercatat dan tidak konsisten antar komputer | Selesaikan lewat NIP (login) — nama kembar otomatis hilang; untuk file lama sediakan pemetaan admin |
| A7 | Tinggi | Drive lewat server lokal + scraping HTML | Tidak bisa jalan di Vercel; bukan API resmi, mudah patah | Google Drive API + OAuth server-side; token disimpan di server |
| A8 | Sedang | Kolom **SATKER 2** kosong di sheet Tukin (`barisTukin` memakai `g.satker2` yang tidak ada di roster, sedangkan sheet Uang Makan memakai nilai hasil hitung) | Berkas Tukin berbeda dari manual | Isi dari `pegawai.satker_2` (default `Pembimbing Masyarakat <BIDANG>`) |
| A9 | Sedang | Rupiah/persen/tanggal ditulis sebagai **teks** | Bagus untuk meniru manual, tapi tidak bisa di-SUM di Excel | Pertahankan untuk berkas resmi; tambahkan sheet/kolom angka bila diminta |
| A10 | Sedang | Pembulatan per komponen lalu total dibulatkan sekali | Jumlah komponen bisa beda Rp1 dari total | Pertahankan perilaku sekarang (sudah diterima manual) dan kunci dalam uji paritas |
| A11 | Sedang | Aturan PMA yang belum dihitung: sakit 15+ hari, cuti besar bertingkat, tugas belajar >6 bulan, alasan penting >2 hari, "tidak di tempat tugas" 2%/hari | Semua `ALASAN` saat ini 0% → potongan bisa kurang | Putuskan bersama admin; tambahkan sebagai aturan di tabel, bukan hardcode |
| A12 | Sedang | Tidak ada kalender hari libur nasional | Hari libur nasional dianggap hari kerja; kalau tidak ada presensi & tidak ada alasan → TK 3% | Tambah tabel `hari_libur` (admin) sejak TAHAP 6 |
| A13 | Sedang | Tidak ada audit log/riwayat/versi aturan pada hasil | Hasil yang sudah disahkan bisa berubah tanpa jejak | `audit_log` + penguncian hasil disetujui |
| A14 | Rendah | Nama bidang kapital (`KRISTEN`) vs label resmi, dan `SATKER_3` hardcode "Kanwil Kementerian Agama Provinsi Aceh" | Tidak konsisten dengan daftar 11 bidang | Tabel `bidang` + `satker` di database |
| A15 | Rendah | Validasi file minim: hanya header, tidak memeriksa periode/NIP/duplikat | File bulan lain bisa diproses sebagai bulan ini | Validasi periode dari isi tanggal + hash file + kunci unik |
| A16 | Rendah | PPH uang makan mengikuti `pphPct` per orang; tarif 35.000 otomatis 0% (aturan implisit di kode) | Sulit diaudit | Pindahkan `pph_pct` ke `pegawai`; hapus aturan implisit |
| A17 | Rendah | Tidak ada batas ukuran/jumlah file | Fungsi Vercel bisa menolak tanpa pesan jelas | Batas 2 MB/file, 1 file/proses, pesan galat spesifik |
| A18 | Rendah | Presensi hari Sabtu/Minggu tidak dihitung walau terekam | Tugas di hari libur tidak masuk rekap | Konfirmasi ke admin; bila perlu, jadikan aturan |
| A19 | Info | Dua rencana di `website.md` berbeda: bagian A–I "1 admin, upload sendiri" vs tambahan ChatGPT "banyak pegawai, pendaftaran, verifikasi" | Bisa salah arah pembangunan | Rancangan di `02` memakai versi **multi-pegawai + admin**, karena versi pertama sudah terlampaui |

---

## 8. Yang dipakai ulang (tanpa menulis ulang rumus)

Wajib dipakai ulang apa adanya, lalu diuji paritas:

- `bacaSheetPresensi`, `parseTime`, `parseTanggal`, `klasifikasiHari`, `tanggaPersen`
- `prosesSatuOrang` (inti potongan + uang makan + PPH)
- `barisKehadiran`, `lembarTukin`, `lembarUangMakan`, `lembarKehadiran`, `susunWorkbookBidang`
  (format dan nama file identik dengan manual)
- `periodeDariNama`, `periodeDariJalur`, `namaFileDrive` (dipakai ulang oleh fitur Drive di server)

**Tidak dipakai di web:** pembacaan Drive via `127.0.0.1`, `localStorage`, roster hardcode,
dan semua konstanta aturan yang harus bisa diubah admin.

---

## 9. Batas TAHAP 1

Yang **sudah** dilakukan: pemisahan folder, audit ini, rancangan arsitektur, dan draf skema database.
Yang **belum**: pembuatan project Supabase, kode fungsi serverless, halaman web, migrasi roster.
Semua itu tahap 2 dan seterusnya, menunggu persetujuan.
