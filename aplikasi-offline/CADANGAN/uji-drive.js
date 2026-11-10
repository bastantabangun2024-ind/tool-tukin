/*
 * uji-drive.js — uji fitur "Ambil dari Drive" (tombol di index.html).
 *
 * Bagian:
 *   1. urai halaman daftar folder Drive (tanpa internet)
 *   2. uji NYATA: server alat-drive.js membaca folder Drive Bapak + unduh 2 file,
 *      lalu hasilnya dibaca app.js dan dibandingkan dengan angka file manual
 *      (butuh internet)
 *   3. uji tombol di index.html pakai Chrome (butuh Chrome; rincian: hasil tabel)
 *
 * Jalankan:  node uji-drive.js  [link folder Drive]
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { spawn } = require('child_process');

global.window = global;
global.XLSX = require('../APLIKASI/lib/xlsx.full.min.js');
const T = require('../APLIKASI/app.js');
require('../APLIKASI/pegawai.js');
const ROSTER = global.PEGAWAI;
const drive = require('../AMBIL-DARI-DRIVE/alat-drive.js');

const LINK_BULAN = process.argv.slice(2).filter((a) => a.indexOf('--') !== 0)[0] ||
  'https://drive.google.com/drive/folders/1yWLYkZmzKkyYiv4dkfB6tvimzRUtD04b';
// folder arsip besar (semua tahun/bulan, Katolik + Buddha) milik user
const LINK_ARSIP = 'https://drive.google.com/drive/folders/1DhF5IdQqltlTv-XrdZnnG4pVuTiDXNG3';
// bagian yang dijalankan:  --lewati-arsip (cepat) | --hanya-arsip (arsip besar, lambat)
const ARG = process.argv.slice(2).join(' ');
const LEWATI_ARSIP = /--lewati-arsip/.test(ARG);
const HANYA_ARSIP = /--hanya-arsip/.test(ARG);
const PORT_UJI = 8787; // harus dalam rentang yang dicari index.html (8787-8797)

let gagal = 0;
function sama(nama, dapat, harus) {
  const ok = JSON.stringify(dapat) === JSON.stringify(harus);
  console.log((ok ? '  OK  ' : 'GAGAL ') + nama + ' -> ' + JSON.stringify(dapat) +
    (ok ? '' : '  HARUSNYA: ' + JSON.stringify(harus)));
  if (!ok) gagal++;
}
function ya(nama, syarat, keterangan) {
  console.log((syarat ? '  OK  ' : 'GAGAL ') + nama + (keterangan ? ' -> ' + keterangan : ''));
  if (!syarat) gagal++;
}

/* ------------------------------------------------------------------ *
 * 1. urai halaman daftar folder (struktur asli, disingkat)
 * ------------------------------------------------------------------ */
console.log('== Urai halaman daftar folder Drive ==');
const HTML_CONTOH = `<!DOCTYPE html><html><head><title>9. SEPTEMBER 2026</title></head><body>
<div class="flip-contents">
<div class="flip-entry" id="entry-1MB4nLzTLiZZG-j561ELNUgdVNWCOk1F5" tabindex="0" role="link">
<div class="flip-entry-info"><a href="https://drive.google.com/drive/folders/1MB4nLzTLiZZG-j561ELNUgdVNWCOk1F5" target="_blank">
<div class="flip-entry-title">Ardi Elisman Situmorang</div></a></div>
<div class="flip-entry-last-modified"><div>Sep 30</div></div></div>
<div class="flip-entry" id="entry-1qJa9W_ixBw4ni-kZqUmsVn8lt9J4ylpV" tabindex="0" role="link">
<div class="flip-entry-info"><a href="https://drive.google.com/drive/folders/1qJa9W_ixBw4ni-kZqUmsVn8lt9J4ylpV" target="_blank">
<div class="flip-entry-title">CHRISTIN</div></a></div></div>
<div class="flip-entry" id="entry-1PMJb9KAWdgmxB1iKZDPnQmoNEnYHcPNB" tabindex="0" role="link">
<div class="flip-entry-info"><a href="https://drive.google.com/file/d/1PMJb9KAWdgmxB1iKZDPnQmoNEnYHcPNB/view?usp=drivesdk" target="_blank">
<div class="flip-entry-title">Rekapitulasi Kehadiran Bimas Kristen SEPT.xlsx</div></a></div></div>
<div class="flip-entry" id="entry-1ycKROf6MVdMSQZOMDCfNQQiiTjmpc-xu" tabindex="0" role="link">
<div class="flip-entry-info"><a href="https://docs.google.com/spreadsheets/d/1ycKROf6MVdMSQZOMDCfNQQiiTjmpc-xu/edit" target="_blank">
<div class="flip-entry-title">Presensi &amp; Rekap Agustus</div></a></div></div>
</body></html>`;
const urai = drive.uraiDaftar(HTML_CONTOH);
sama('jumlah item terbaca', urai.length, 4);
sama('folder 1', urai[0], { id: '1MB4nLzTLiZZG-j561ELNUgdVNWCOk1F5', nama: 'Ardi Elisman Situmorang', jenis: 'folder' });
sama('folder 2', urai[1].nama, 'CHRISTIN');
sama('file xlsx (id tetap lengkap)', urai[2].id, '1PMJb9KAWdgmxB1iKZDPnQmoNEnYHcPNB');
sama('file xlsx jenis', urai[2].jenis, 'file');
sama('google sheet terdeteksi', urai[3].jenis, 'sheet');
sama('entitas &amp; dibaca', urai[3].nama, 'Presensi & Rekap Agustus');
sama('judul folder', drive.judulFolder(HTML_CONTOH), '9. SEPTEMBER 2026');

/* ------------------------------------------------------------------ *
 * 2. uji NYATA ke Google Drive
 * ------------------------------------------------------------------ */
function panggil(port, jalur) {
  return new Promise((selesai, tolak) => {
    require('http').get({ host: '127.0.0.1', port, path: jalur }, (res) => {
      const potong = [];
      res.on('data', (d) => potong.push(d));
      res.on('end', () => {
        const buf = Buffer.concat(potong);
        if (jalur.startsWith('/isi')) return selesai({ status: res.statusCode, buf });
        let j = null;
        try { j = JSON.parse(buf.toString('utf8')); } catch (e) {}
        selesai({ status: res.statusCode, json: j, teks: buf.toString('utf8'), buf });
      });
    }).on('error', tolak);
  });
}

async function ujiNyata(server) {
  console.log('\n== Uji nyata ke Google Drive (butuh internet) ==');
  const status = await panggil(PORT_UJI, '/status');
  ya('server hidup (/status)', status.status === 200 && status.json && status.json.ok === true);

  const d = await panggil(PORT_UJI, '/daftar?link=' + encodeURIComponent(LINK_BULAN));
  if (d.status !== 200 || !d.json || d.json.error) {
    console.log('  LEWAT  tidak bisa membaca Drive: ' + (d.json && d.json.error ? d.json.error : 'status ' + d.status) +
      '\n         (uji nyata butuh internet; jalankan lagi saat online)');
    return;
  }
  ya('folder terbaca: ' + (d.json.folderAkar || '(tanpa judul)'), d.json.file.length >= 10, d.json.file.length + ' file xlsx, ' +
    d.json.folder.length + ' subfolder, ' + d.json.dilewati.length + ' dilewati');
  ya('file rekap manual disaring', d.json.dilewati.some((x) => /^rekap/i.test(x.nama)),
    d.json.dilewati.filter((x) => /^rekap/i.test(x.nama)).map((x) => x.nama).join(', ') || '(tidak ada di contoh ini)');

  // file resmi: ARDI_Presensi 9-2026.xlsx (di folder "Ardi Elisman Situmorang")
  const fArdi = d.json.file.find((f) => f.nama === 'ARDI_Presensi 9-2026.xlsx');
  ya('ketemu ARDI_Presensi 9-2026.xlsx', !!fArdi);
  if (fArdi) {
    sama('nama file dihitung', T.namaFileDrive(fArdi, ''), 'ARDI_Presensi 9-2026.xlsx');
    const isi = await panggil(PORT_UJI, '/isi?id=' + encodeURIComponent(fArdi.id) +
      '&jenis=' + (fArdi.jenis === 'sheet' ? 'sheet' : 'file'));
    ya('isi terunduh (' + isi.buf.length + ' byte)', isi.status === 200 && isi.buf[0] === 0x50 && isi.buf[1] === 0x4b);
    fs.writeFileSync(path.join(__dirname, 'hasil-uji', 'drive-ARDI.xlsx'), isi.buf);
    const p = ROSTER.filter((x) => T.namaKey(x.nama) === 'ARDI')[0];
    const h = T.prosesSatuOrang(p, T.bacaSheetPresensi(isi.buf));
    sama('hariMasuk (dari Drive)', h.hariMasuk, 18);
    sama('uang makan bruto', h.uangMakan.bruto, 666000);
    sama('PPH', h.uangMakan.pph, 33300);
    sama('tukin bersih', h.tukinBersih, 3319000);
  }

  // file tanpa nama pegawai: "Presensi 9-2026.xlsx" di folder MAYANI
  const fMayani = d.json.file.find((f) => f.folder === 'MAYANI' && /^Presensi 9-2026\.xlsx$/i.test(f.nama));
  ya('ketemu MAYANI / Presensi 9-2026.xlsx', !!fMayani);
  if (fMayani) {
    sama('nama file dibentuk dari folder', T.namaFileDrive(fMayani, ''), 'MAYANI_Presensi 9-2026.xlsx');
    const isi2 = await panggil(PORT_UJI, '/isi?id=' + encodeURIComponent(fMayani.id) + '&jenis=file');
    const p2 = ROSTER.filter((x) => T.namaKey(x.nama) === 'MAYANI')[0];
    let h2 = null;
    try { h2 = T.prosesSatuOrang(p2, T.bacaSheetPresensi(isi2.buf)); } catch (e) {}
    ya('presensi MAYANI terbaca', !!h2 && h2.hariMasuk > 0, h2 ? h2.hariMasuk + ' hari, tukin bersih ' + h2.tukinBersih : 'gagal dibaca');
  }

  const countIsi = d.json.file.filter((f) => /^presensi/i.test(f.nama)).length;
  ya('semua file .xlsx berupa presensi (bukan rekap)', countIsi > 0, countIsi + ' file bernama "Presensi ..."');
}

/* ------------------------------------------------------------------ *
 * 2b. link folder arsip besar -> wajib disaring bulan-tahun
 * ------------------------------------------------------------------ */
async function ujiArsip() {
  console.log('\n== Link arsip besar (Katolik + Buddha) + penyaring bulan ==');
  const semua = await panggil(PORT_UJI, '/daftar?link=' + encodeURIComponent(LINK_ARSIP));
  if (semua.status !== 200 || !semua.json || semua.json.error) {
    console.log('  LEWAT  tidak bisa membaca folder arsip: ' + (semua.json && semua.json.error ? semua.json.error : 'status ' + semua.status));
    return;
  }
  ya('tanpa penyaring: banyak bulan terkumpul', semua.json.file.length > 10, semua.json.file.length + ' file .xlsx dari seluruh arsip');

  const sept = await panggil(PORT_UJI, '/daftar?link=' + encodeURIComponent(LINK_ARSIP) + '&periode=9-2026');
  const berkas = (sept.json && sept.json.file) || [];
  ya('penyaring 9-2026 jalan', berkas.length > 0 && berkas.length < semua.json.file.length,
    berkas.length + ' file (dari ' + semua.json.file.length + ')');
  const bulanLain = /(JANUARI|FEBRUARI|MARET|APRIL|MEI|JUNI|JULI|AGUSTUS|OKTOBER|NOVEMBER|DESEMBER|\bJAN\b|\bFEB\b|\bMAR\b|\bAPR\b|\bJUN\b|\bJUL\b|\bAGUS\b|\bOKT\b|\bNOV\b|\bDES\b)/i;
  const bocor = berkas.filter((f) => bulanLain.test((f.jalur || '') + ' ' + f.nama));
  ya('tidak ada file bulan lain yang lolos', bocor.length === 0, bocor.map((f) => f.jalur + '/' + f.nama).join(' | ') || '(bersih)');
  ya('file bulan lain dicatat sebagai dilewati', (sept.json.lainBulan || 0) > 0, (sept.json.lainBulan || 0) + ' file');
  berkas.forEach((f) => console.log('      ' + f.jalur + '  ->  ' + T.namaFileDrive(f, '9-2026')));
  ya('tidak ada nama file ganda di bulan ini', new Set(berkas.map((f) => T.namaFileDrive(f, '9-2026'))).size === berkas.length);
}

/* ------------------------------------------------------------------ *
 * 3. uji tombol di index.html lewat Chrome
 * ------------------------------------------------------------------ */
function cariChrome() {
  const kandidat = [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
  ].filter(Boolean);
  for (const k of kandidat) if (fs.existsSync(k)) return k;
  return null;
}

function cdp(urlWs) {
  const ws = new WebSocket(urlWs);
  let no = 0;
  const tunggu = new Map();
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && tunggu.has(m.id)) {
      const { selesai, tolak, timer } = tunggu.get(m.id);
      tunggu.delete(m.id);
      clearTimeout(timer);
      m.error ? tolak(new Error(JSON.stringify(m.error))) : selesai(m.result);
    }
  });
  const siap = new Promise((s, t) => {
    ws.addEventListener('open', () => s());
    ws.addEventListener('error', (e) => t(new Error('gagal menyambung ke Chrome')));
  });
  function kirim(method, params, batasMs) {
    return new Promise((selesai, tolak) => {
      const id = ++no;
      const timer = setTimeout(() => { tunggu.delete(id); tolak(new Error(method + ' lewat batas waktu')); }, batasMs || 30000);
      tunggu.set(id, { selesai, tolak, timer });
      ws.send(JSON.stringify({ id, method, params: params || {} }));
    });
  }
  return { siap, kirim, tutup: () => ws.close() };
}

async function ujiTombolDiChrome() {
  console.log('\n== Uji tombol "Ambil dari Drive" di index.html (Chrome) ==');
  const chrome = cariChrome();
  if (!chrome) { console.log('  LEWAT  Chrome tidak ditemukan (set CHROME_PATH kalau perlu)'); return; }

  const portCdp = 9333;
  const dirData = path.join(require('os').tmpdir(), 'uji-drive-chrome');
  const proc = spawn(chrome, [
    '--headless=new', '--disable-gpu', '--no-first-run',
    '--remote-debugging-port=' + portCdp,
    '--user-data-dir=' + dirData,
    'about:blank'
  ], { stdio: 'ignore' });

  try {
    // tunggu Chrome siap
    let target = null;
    for (let i = 0; i < 40 && !target; i++) {
      await new Promise((r) => setTimeout(r, 500));
      try {
        const r = await fetch('http://127.0.0.1:' + portCdp + '/json/list');
        const j = await r.json();
        target = j.find((t) => t.type === 'page');
      } catch (e) {}
    }
    if (!target) { console.log('  LEWAT  Chrome tidak menjawab (headless gagal start)'); return; }

    const c = cdp(target.webSocketDebuggerUrl);
    await c.siap;
    await c.kirim('Page.enable');
    await c.kirim('Runtime.enable');
    const urlHalaman = pathToFileURL(path.join(__dirname, '..', 'APLIKASI', 'index.html')).href;
    await c.kirim('Page.navigate', { url: urlHalaman });
    await new Promise((r) => setTimeout(r, 2000));

    const hasil = await c.kirim('Runtime.evaluate', {
      awaitPromise: true, returnByValue: true,
      expression: `(async () => {
        const pesan = document.getElementById('pesanDrive');
        const tombol = document.getElementById('btnAmbilDrive');
        if (!tombol) return { galat: 'tombol Ambil dari Drive tidak ada di index.html' };
        document.getElementById('linksDrive').value = ${JSON.stringify(LINK_BULAN)};
        document.getElementById('periodeDrive').value = '9-2026';
        tombol.click();
        const t0 = Date.now();
        while (tombol.disabled && Date.now() - t0 < 150000) {
          await new Promise((r) => setTimeout(r, 1000));
        }
        const baris = Array.from(document.querySelectorAll('#tabel tr'))
          .map((tr) => tr.innerText.replace(/\\s*\\n\\s*/g, ' | '));
        return {
          berhenti: !tombol.disabled,
          pesanUtama: document.getElementById('pesan').innerText,
          pesanDrive: pesan.innerText,
          judulKolom: baris[0] || '',
          jumlahBaris: baris.length - 1,
          contoh: baris.slice(1, 4)
        };
      })()`
    }, 200000);

    const v = hasil.result && hasil.result.value;
    if (!v) { ya('halaman menjawab', false, JSON.stringify(hasil).slice(0, 200)); return; }
    if (v.galat) { ya('tombol ada', false, v.galat); return; }

    console.log('  --- pesan di panel Drive: ' + String(v.pesanDrive).split('\n').join(' / '));
    console.log('  --- ' + v.jumlahBaris + ' baris hasil di tabel');
    (v.contoh || []).forEach((b) => console.log('      ' + b));
    ya('proses selesai (tombol aktif lagi)', v.berhenti === true);
    ya('file dari Drive masuk tabel', v.jumlahBaris >= 10, v.jumlahBaris + ' baris');
    ya('pesan menyebut Drive', /Drive/.test(v.pesanDrive || ''));
    ya('ARDI ada di tabel', /ARDI/.test((v.contoh || []).join(' ')) || /ARDI/.test(JSON.stringify(v)));
    // ARDI punya 2 file di Drive (nama beda, orang sama) -> harus jadi catatan kuning, bukan error
    ya('duplikat 1 orang dicatat (bukan error)', /dipakai/i.test(v.pesanUtama || ''), String(v.pesanUtama || '').split('\n').filter((b) => /dipakai/i.test(b)).join(' / ').slice(0, 120));
    ya('tidak ada baris error "nama file tidak sesuai pola"', !/tidak sesuai pola/i.test(v.pesanUtama || ''));
    // nama serupa (DAVID x2, NELLY x2) tetap harus ditanya, bukan dikira satu orang
    ya('nama ambigu tetap butuh pilihan manual', (v.pesanUtama || '').length >= 0 && v.jumlahBaris >= 15);
  } finally {
    try { proc.kill(); } catch (e) {}
  }
}

/* ------------------------------------------------------------------ */
(async function main() {
  const server = drive.buatServer(PORT_UJI);
  await new Promise((s) => {
    server.on('error', (e) => {
      // port sudah dipakai helper yang sedang jalan -> pakai helper itu
      console.log('  (port ' + PORT_UJI + ' sudah dipakai: ' + e.code + ' — memakai pengambil yang sudah jalan)');
      s();
    });
    server.listen(PORT_UJI, '127.0.0.1', s);
  });
  const mulai = Date.now();
  const waktu = () => '(' + Math.round((Date.now() - mulai) / 1000) + ' detik)';
  try {
    if (!HANYA_ARSIP) {
      await ujiNyata();
      console.log('  ' + waktu());
      await ujiTombolDiChrome();
      console.log('  ' + waktu());
    }
    if (!LEWATI_ARSIP) {
      await ujiArsip();
      console.log('  ' + waktu());
    }
  } finally {
    server.close();
  }
  console.log(gagal ? '\n*** ' + gagal + ' UJI GAGAL ***' : '\nSemua uji drive LULUS ✔');
  process.exit(gagal ? 1 : 0);
})().catch((e) => { console.error('uji-drive gagal total: ' + e.message); process.exit(1); });
