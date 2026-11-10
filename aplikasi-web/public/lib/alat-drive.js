/*
 * alat-drive.js — pengambil file presensi dari Google Drive untuk Tool Tukin.
 * =====================================================================
 * Kenapa ada file ini?
 *   Chrome MELARANG halaman index.html (dobel-klik file://) mengambil isi
 *   file dari Google (diblokir CORS), sedangkan Node tidak dibatasi itu.
 *   Jadi file kecil ini yang mengambil dari Drive, lalu index.html
 *   mengambilnya dari sini (127.0.0.1).
 *
 * Cara pakai:
 *   1. Dobel-klik  AMBIL-DARI-DRIVE.cmd  (biarkan jendelanya terbuka)
 *   2. Di index.html: tempel link folder Drive -> klik "Ambil dari Drive"
 *   Tanpa kunci API, tanpa paket npm, tanpa login Google
 *   (folder harus dibagikan "siapa saja yang punya link").
 *
 * Endpoint (hanya untuk komputer ini):
 *   GET /status                 -> {"ok":true,...}
 *   GET /daftar?link=<link>     -> daftar file .xlsx di folder itu (rekursif)
 *   GET /isi?id=<fileId>&jenis= -> isi file (xlsx) sebagai biner
 */
'use strict';

const http = require('http');
const T = require('./app.js');

const PORT_AWAL = 8787;
const PORT_AKHIR = 8797;
const KEDALAMAN_MAKS = 6;   // cukup untuk: tahun / bulan / nama penyuluh / file
const BATAS_FILE = 400;
const BATAS_FOLDER = 200;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';

/* ------------------------------------------------------------------ *
 * Urai halaman daftar folder Drive (embeddedfolderview, tanpa kunci API)
 * ------------------------------------------------------------------ */
function uraiEntitas(s) {
  return String(s)
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .trim();
}

function uraiDaftar(html) {
  const potongan = String(html).split('<div class="flip-entry"').slice(1);
  const item = [];
  potongan.forEach(function (p) {
    const idM = /id="entry-([-\w]+)"/.exec(p);
    const namaM = /flip-entry-title">([^]*?)<\/div>/.exec(p);
    if (!idM || !namaM) return;
    const jenis = /\/drive\/folders\//.test(p) ? 'folder'
      : /docs\.google\.com\/spreadsheets/.test(p) ? 'sheet'
        : 'file';
    item.push({ id: idM[1], nama: uraiEntitas(namaM[1]), jenis: jenis });
  });
  return item;
}

function judulFolder(html) {
  const m = /<title>([^]*?)<\/title>/.exec(String(html));
  return m ? uraiEntitas(m[1]) : '';
}

async function ambilTeks(url) {
  const r = await fetch(url, { redirect: 'follow', headers: { 'user-agent': UA } });
  if (!r.ok) throw new Error('Google menjawab status ' + r.status);
  return r.text();
}

function urlDaftar(id, hal) {
  return 'https://drive.google.com/embeddedfolderview?id=' + encodeURIComponent(id) +
    (hal ? '&page=' + hal : '') + '#list';
}

/* ------------------------------------------------------------------ *
 * File rekap buatan tangan ("Rekapitulasi Kehadiran/Tukin/Uang Makan"),
 * termasuk yang berawalan "Salinan", "Salinan dari", "FIX_", supaya tidak
 * ikut dianggap file presensi penyuluh.
 * ------------------------------------------------------------------ */
function namaRekapManual(nama) {
  var s = String(nama || '')
    .replace(/\.(xlsx|xlsm|xls)$/i, '')
    .toUpperCase()
    .replace(/[_\-.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  var awalan = /^(SALINAN|COPY|DUPLIKAT|FIX|NEW|BARU|TERBARU|DARI)\b\s*/;
  while (awalan.test(s)) s = s.replace(awalan, '');
  return /^REKAP/.test(s);
}

/* ------------------------------------------------------------------ *
 * Telusuri folder (rekursif) -> daftar file spreadsheet
 * ------------------------------------------------------------------ */
async function telusuri(akar, onProgres, filter) {
  const hasil = { folder: [], file: [], dilewati: [], pesan: [], lainBulan: 0 };
  const antre = [{ id: akar.id, jalur: '', namaInduk: akar.nama || '', kedalaman: 0 }];
  let jumlahFolder = 0;

  while (antre.length) {
    const kini = antre.shift();
    if (++jumlahFolder > BATAS_FOLDER) {
      hasil.pesan.push('⚠ Berhenti: lebih dari ' + BATAS_FOLDER + ' folder (link mungkin terlalu tinggi, mis. folder induk semua tahun). Tempel link folder BULAN saja.');
      break;
    }
    let item;
    try {
      item = uraiDaftar(await ambilTeks(urlDaftar(kini.id)));
    } catch (e) {
      hasil.pesan.push('⛔ Gagal membaca folder "' + (kini.jalur || kini.id) + '": ' + e.message +
        ' (cek internet / pastikan folder dibagikan "siapa saja yang punya link").');
      continue;
    }
    for (const it of item) {
      const jalur = kini.jalur ? kini.jalur + ' / ' + it.nama : (kini.namaInduk ? kini.namaInduk + ' / ' + it.nama : it.nama);
      if (it.jenis === 'folder') {
        if (kini.kedalaman + 1 > KEDALAMAN_MAKS) {
          hasil.pesan.push('⚠ Folder terlalu dalam (' + KEDALAMAN_MAKS + ' tingkat), dilewati: ' + jalur);
          continue;
        }
        hasil.folder.push({ id: it.id, nama: it.nama, jalur: jalur });
        antre.push({ id: it.id, jalur: jalur, namaInduk: it.nama, kedalaman: kini.kedalaman + 1 });
      } else if (it.jenis === 'sheet' || /\.(xlsx|xlsm|xls)$/i.test(it.nama)) {
        if (namaRekapManual(it.nama)) {
          hasil.dilewati.push({ nama: it.nama, jalur: jalur, alasan: 'file rekap manual (bukan presensi)' });
          continue;
        }
        if (filter && !T.cocokPeriodeDrive(jalur + ' ' + it.nama, filter.bulan, filter.tahun)) {
          hasil.dilewati.push({ nama: it.nama, jalur: jalur, alasan: 'bulan lain (bukan ' + filter.bulan + '-' + filter.tahun + ')' });
          hasil.lainBulan++;
          continue;
        }
        if (hasil.file.length >= BATAS_FILE) {
          hasil.pesan.push('⚠ Batas ' + BATAS_FILE + ' file tercapai, sisanya dilewati.');
          break;
        }
        hasil.file.push({
          id: it.id, nama: it.nama, jenis: it.jenis,
          jalur: kini.jalur, folder: kini.namaInduk
        });
      } else {
        hasil.dilewati.push({ nama: it.nama, jalur: jalur, alasan: 'bukan spreadsheet' });
      }
    }
    if (typeof onProgres === 'function') {
      onProgres('Dibaca: ' + (kini.jalur || kini.namaInduk || 'folder awal') + ' (' + item.length + ' item)');
    }
  }
  return hasil;
}

/* ------------------------------------------------------------------ *
 * Unduh isi satu file (xlsx / Google Sheet) -> Buffer
 * ------------------------------------------------------------------ */
async function ambilIsi(file) {
  const kandidat = file.jenis === 'sheet'
    ? ['https://docs.google.com/spreadsheets/d/' + file.id + '/export?format=xlsx']
    : ['https://drive.google.com/uc?export=download&id=' + file.id];
  let alasan = 'tidak diketahui';

  for (const url of kandidat) {
    let r;
    try {
      r = await fetch(url, { redirect: 'follow', headers: { 'user-agent': UA } });
    } catch (e) {
      alasan = 'tidak bisa menghubungi Google (' + (e && e.name ? e.name : 'gagal') + ')';
      continue;
    }
    if (!r.ok) { alasan = 'Google menjawab status ' + r.status; continue; }
    let buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > 3 && buf[0] === 0x50 && buf[1] === 0x4b) return buf; // PK -> xlsx

    // file besar: Google menampilkan halaman konfirmasi -> ikutkan tokennya
    const html = buf.toString('utf8');
    const c = /confirm=([0-9A-Za-z_-]+)/.exec(html);
    if (c) {
      const u = /uuid=([-\w]+)/.exec(html);
      const r2 = await fetch(url + '&confirm=' + c[1] + (u ? '&uuid=' + u[1] : ''),
        { redirect: 'follow', headers: { 'user-agent': UA } });
      if (r2.ok) {
        buf = Buffer.from(await r2.arrayBuffer());
        if (buf.length > 3 && buf[0] === 0x50 && buf[1] === 0x4b) return buf;
      }
      alasan = 'halaman konfirmasi Google tidak menghasilkan file';
    } else {
      alasan = 'isi bukan file Excel (mungkin perlu login / file tidak publik)';
    }
  }
  throw new Error(alasan);
}

/* ------------------------------------------------------------------ *
 * Server kecil untuk index.html
 * ------------------------------------------------------------------ */
function kirimCors(res, kode, tipe, isi) {
  res.writeHead(kode, {
    'Content-Type': tipe,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Private-Network': 'true',
    'Cache-Control': 'no-store'
  });
  res.end(isi);
}

function buatServer(port) {
  return http.createServer(function (req, res) {
    const u = new URL(req.url, 'http://127.0.0.1');
    const jalur = u.pathname;

    if (req.method === 'OPTIONS') return kirimCors(res, 204, 'text/plain', '');

    if (jalur === '/status') {
      return kirimCors(res, 200, 'application/json; charset=utf-8',
        JSON.stringify({ ok: true, versi: '1.0', port: port }));
    }

    if (jalur === '/daftar') {
      const link = u.searchParams.get('link') || '';
      const mPeriode = /^(\d{1,2})-(\d{4})$/.exec((u.searchParams.get('periode') || '').trim());
      const filter = mPeriode ? { bulan: parseInt(mPeriode[1], 10), tahun: mPeriode[2] } : null;
      const daftar = T.parseDriveLinks(link).filter(function (x) { return x.id; });
      if (!daftar.length) {
        return kirimCors(res, 400, 'application/json; charset=utf-8',
          JSON.stringify({ error: 'Link Drive tidak dikenali. Contoh: https://drive.google.com/drive/folders/XXXX' }));
      }
      const akar = daftar[0].id;
      (async function () {
        try {
          if (akar.jenis === 'file') {
            return kirimCors(res, 200, 'application/json; charset=utf-8',
              JSON.stringify({ file: [{ id: akar.id, nama: 'file-drive.xlsx', jenis: 'file', jalur: '', folder: '' }], folder: [], dilewati: [], pesan: [] }));
          }
          let nama = '';
          let isi = { folder: [], file: [], dilewati: [], pesan: [] };
          nama = judulFolder(await ambilTeks(urlDaftar(akar.id)));
          isi = await telusuri({ id: akar.id, nama: nama }, function (m) { process.stdout.write('  ' + m + '\n'); }, filter);
          process.stdout.write('  => ' + isi.file.length + ' file spreadsheet, ' + isi.dilewati.length + ' dilewati' +
            (filter ? ' (penyaring bulan ' + filter.bulan + '-' + filter.tahun + ')' : '') + '\n');
          process.stdout.write('  => daftar siap: ' + isi.file.slice(0, 3).map(function (f) { return f.nama; }).join(', ') + (isi.file.length > 3 ? ', ...' : '') + '\n');
          if (filter && isi.lainBulan) {
            isi.pesan.push('ℹ ' + isi.lainBulan + ' file bulan lain dilewati karena penyaring bulan-tahun ' +
              filter.bulan + '-' + filter.tahun + ' (kosongkan kolom itu kalau ingin semua bulan).');
          }
          kirimCors(res, 200, 'application/json; charset=utf-8',
            JSON.stringify({ folderAkar: nama, folder: isi.folder, file: isi.file, dilewati: isi.dilewati, pesan: isi.pesan, lainBulan: isi.lainBulan }));
        } catch (e) {
          kirimCors(res, 500, 'application/json; charset=utf-8', JSON.stringify({ error: e.message }));
        }
      })();
      return;
    }

    if (jalur === '/isi') {
      const id = u.searchParams.get('id') || '';
      const jenis = u.searchParams.get('jenis') || 'file';
      if (!id) return kirimCors(res, 400, 'text/plain; charset=utf-8', 'id kosong');
      (async function () {
        try {
          const buf = await ambilIsi({ id: id, jenis: jenis });
          kirimCors(res, 200, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buf);
        } catch (e) {
          kirimCors(res, 502, 'text/plain; charset=utf-8', 'Gagal mengambil file ' + id + ': ' + e.message);
        }
      })();
      return;
    }

    kirimCors(res, 404, 'text/plain; charset=utf-8', 'tidak ada: ' + jalur);
  });
}

function jalankan(port) {
  if (typeof fetch !== 'function') {
    console.log('\n  Node.js di komputer ini terlalu lama (butuh Node 18 atau lebih baru).');
    console.log('  Unduh versi baru di https://nodejs.org lalu jalankan file ini lagi.\n');
    process.exit(1);
  }
  const server = buatServer(port);
  server.on('error', function (e) {
    if (e.code === 'EADDRINUSE' && port < PORT_AKHIR) {
      jalankan(port + 1);
    } else if (e.code === 'EADDRINUSE') {
      console.log('\n  Port ' + PORT_AWAL + '-' + PORT_AKHIR + ' semuanya terpakai.');
      console.log('  Tutup jendela alat-drive.js lain, lalu jalankan lagi.\n');
      process.exit(1);
    } else {
      console.log('\n  Gagal membuka server: ' + e.message + '\n');
      process.exit(1);
    }
  });
  server.listen(port, '127.0.0.1', function () {
    console.log('');
    console.log('  ================================================================');
    console.log('   PENGAMBIL PRESENSI DARI GOOGLE DRIVE  —  siap (port ' + port + ')');
    console.log('  ================================================================');
    console.log('   Biarkan jendela ini TERBUKA selama memakai fitur Drive.');
    console.log('');
    console.log('   Langkah di tool (index.html):');
    console.log('    1. Dobel-klik index.html');
    console.log('    2. Panel "1b. Ambil dari Google Drive": tempel link folder Drive');
    console.log('       (disarankan link folder BULAN, mis. "9. SEPTEMBER 2026")');
    console.log('    3. Klik tombol "Ambil dari Drive"');
    console.log('');
    console.log('   Folder Drive harus dibagikan "Siapa saja yang punya link".');
    console.log('   Tutup jendela ini (atau Ctrl+C) kalau sudah selesai.');
    console.log('');
  });
}

if (require.main === module) {
  jalankan(PORT_AWAL);
}

module.exports = {
  uraiDaftar: uraiDaftar,
  ambilTeks: ambilTeks,
  judulFolder: judulFolder,
  telusuri: telusuri,
  ambilIsi: ambilIsi,
  buatServer: buatServer,
  urlDaftar: urlDaftar
};
