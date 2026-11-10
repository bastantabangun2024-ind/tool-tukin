# Aplikasi Offline — Tool Tukin & Uang Makan Bimas

Versi lama yang dipakai harian: **dobel-klik `APLIKASI/index.html`**, 100% offline,
tanpa login, tanpa server (kecuali fitur "Ambil dari Drive" yang memakai helper Node lokal).

Folder ini **tidak berubah isinya** — hanya dipindahkan dari akar project ke dalam
`aplikasi-offline/` supaya terpisah dari aplikasi web.

## Isi

| Folder | Fungsi |
|---|---|
| `APLIKASI/` | `index.html`, `app.js` (mesin hitung), `pegawai.js` (roster 30 pegawai), `lib/xlsx.full.min.js`, `CARA-PAKAI.txt` |
| `AMBIL-DARI-DRIVE/` | `AMBIL-DARI-DRIVE.cmd` + `alat-drive.js` (helper Node lokal, port 8787–8797) |
| `CADANGAN/` | Arsip, data contoh, skrip uji (`uji-app.js`, `uji-presensi-terpisah.js`, `uji-drive.js`), `build-roster.js`, diary `hasil-hari-ini.md` |

`APLIKASI/` dan `AMBIL-DARI-DRIVE/` **harus tetap berdampingan** — `alat-drive.js`
memakai `require('../APLIKASI/app.js')`. Jangan dipisah.

## Cara pakai

Petunjuk lengkap ada di `APLIKASI/CARA-PAKAI.txt`. Ringkasnya:

1. Dobel-klik `AMBIL-DARI-DRIVE.cmd` (kalau mau ambil file dari Drive), biarkan jendelanya terbuka.
2. Dobel-klik `APLIKASI/index.html`.
3. Pilih file presensi (atau tempel link Drive di panel 1b), cek baris kuning, unduh 3 file Excel per bidang.

## Uji

Dari folder ini:

```bash
node CADANGAN/uji-app.js               # 141 assertion (data September + PNS + Drive + format)
node CADANGAN/uji-presensi-terpisah.js # 85 assertion (presensi masuk/pulang terpisah)
node CADANGAN/uji-drive.js             # butuh internet + Chrome
```

Status terakhir (10 Nov 2026, setelah folder dipisah): `uji-app.js` **LULUS**.

## Catatan penting

- `app.js` di folder ini adalah **sumber kebenaran rumus**. Aplikasi web memakai salinan
  yang identik (lihat `../aplikasi-web/docs/02-rancangan-arsitektur.md`), bukan menulis ulang rumus.
- `TOOL-TUKIN-siap-upload.zip` (paket untuk diunggah ke Drive) ada di folder ini.
