// app.mjs — handler HTTP Tool Tukin (dipakai server lokal DAN Vercel).
//
// Dipanggil oleh:
//   server.mjs              -> node server.mjs (lokal, http://localhost:3000)
//   api/[...jalur].mjs      -> fungsi serverless Vercel (semua /api/*)
//
// Endpoint:
//   GET  /api/konfigurasi        URL + kunci publishable Supabase
//   GET  /api/pegawai?nip=...    identitas pegawai (nama, jabatan, bidang)
//   POST /api/proses             hitung presensi -> pengajuan + rekap di database
//   POST /api/daftar             simpan pendaftaran akun baru
//   POST /api/drive/daftar       baca folder Google Drive (link publik) -> daftar file presensi
//   POST /api/drive/proses       hitung + simpan SATU file (bila "berkas" dikirim),
//                                atau semua file dalam folder (tanpa "berkas")
//   GET  /api/pegawai/daftar     [admin] daftar pegawai untuk form tambah/ubah
//   POST /api/pegawai/simpan     [admin] tambah pegawai baru / ubah pegawai (id dikirim)
//   GET  /lib/app.js|/lib/xlsx.full.min.js|/lib/pegawai.js  (mesin offline)
//   GET  /*                      file statis dari public/

import { readFileSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Tukin, Drive, BERKAS_LIB } from './mesin.mjs';

const AKAR = dirname(fileURLToPath(import.meta.url));
const PUBLIK = join(AKAR, 'public');

function bacaEnv(berkas) {
  try {
    return Object.fromEntries(
      readFileSync(berkas, 'utf8')
        .split(/\r?\n/)
        .map((b) => b.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/))
        .filter(Boolean)
        .map((m) => [m[1], m[2].replace(/^['"]|['"]$/g, '').trim()]),
    );
  } catch {
    return {};
  }
}

const dariProses = Object.fromEntries(
  Object.entries(process.env).filter(([, v]) => typeof v === 'string' && v.trim() !== ''),
);
const env = {
  ...bacaEnv(join(AKAR, '.env.example')),
  ...bacaEnv(join(AKAR, '.env.local')),
  ...dariProses,
};

const SUPABASE_URL = env.SUPABASE_URL || '';
const KUNCI_PUBLIK = env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY || '';
const KUNCI_SERVER = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || '';

const TIPE = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function kirimJson(res, kode, data) {
  res.writeHead(kode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function bacaBody(req, batas = 8 * 1024 * 1024) {
  return new Promise((selesai, gagal) => {
    let ukuran = 0;
    const potongan = [];
    req.on('data', (c) => {
      ukuran += c.length;
      if (ukuran > batas) {
        gagal(new Error('Data terlalu besar (maksimal 8 MB)'));
        req.destroy();
        return;
      }
      potongan.push(c);
    });
    req.on('end', () => {
      try {
        const teks = Buffer.concat(potongan).toString('utf8');
        selesai(teks ? JSON.parse(teks) : {});
      } catch {
        gagal(new Error('Body bukan JSON yang valid'));
      }
    });
    req.on('error', gagal);
  });
}

async function db(jalur, opsi = {}) {
  if (!SUPABASE_URL || !KUNCI_SERVER) throw new Error('Kunci server Supabase belum diisi di .env.local');
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${jalur}`, {
    ...opsi,
    headers: {
      apikey: KUNCI_SERVER,
      Authorization: `Bearer ${KUNCI_SERVER}`,
      'Content-Type': 'application/json',
      ...(opsi.headers || {}),
    },
  });
  const teks = await res.text();
  if (!res.ok) throw new Error(`Database: HTTP ${res.status} ${teks.slice(0, 300)}`);
  return teks ? JSON.parse(teks) : null;
}

// --- admin -----------------------------------------------------------------
// Token akses Supabase milik browser diverifikasi ke Supabase, lalu peran
// dicocokkan ke tabel users. Tanpa token/peran admin -> 401.
async function penggunaDariToken(req) {
  const mentah = String(req.headers.authorization || '');
  const token = mentah.replace(/^Bearer\s+/i, '').trim();
  if (!token || !SUPABASE_URL || !KUNCI_PUBLIK) return null;

  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: KUNCI_PUBLIK, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const akun = await res.json().catch(() => null);
  if (!akun || !akun.id) return null;

  const baris = await db(`users?select=id,email,peran,aktif&id=eq.${akun.id}`);
  const u = baris && baris[0];
  if (!u || !u.aktif || u.peran !== 'admin') return null;
  return u;
}

async function wajibAdmin(req) {
  const u = await penggunaDariToken(req);
  if (!u) {
    const e = new Error('Hanya admin yang boleh. Silakan masuk ulang.');
    e.status = 401;
    throw e;
  }
  return u;
}

const STATUS_PEGAWAI = ['PNS', 'PPPK', 'CPNS', 'PPPK_PW'];
const KOLOM_ANGKA = [
  ['tukin', 'Tukin bruto'],
  ['tarif_uang_makan', 'Tarif uang makan'],
  ['pph_pct', 'PPh (%)'],
];

function angkaAtauNull(nilai, nama) {
  if (nilai === undefined) return undefined;
  if (nilai === null || nilai === '') return null;
  const n = Number(nilai);
  if (!Number.isFinite(n) || n < 0) {
    const e = new Error(`${nama} harus angka 0 atau lebih`);
    e.status = 400;
    throw e;
  }
  return n;
}

// --- mesin hitung ----------------------------------------------------------
function jadikanWaktu(menit) {
  if (menit === null || menit === undefined) return null;
  const j = Math.floor(menit / 60);
  const m = menit % 60;
  return `${String(j).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
}

function tanggalSql(t) {
  if (!t || !t.y) return null;
  return `${t.y}-${String(t.mo).padStart(2, '0')}-${String(t.d).padStart(2, '0')}`;
}

// jenis keluaran klasifikasiHari() -> enum jenis_hari
function jenisSql(jenis) {
  if (jenis === 'noPresensi') return 'tidak_presensi';
  if (['hadir', 'libur', 'tk', 'weekend'].includes(jenis)) return jenis;
  return null;
}

// Susun objek pegawai persis seperti roster offline, lalu pakai mesin hitung yang sama.
function objekPegawai(p) {
  return {
    nip: p.nip,
    nama: p.nama,
    gol: p.golongan ? (p.ruang ? `${p.golongan}/${p.ruang}` : p.golongan) : '',
    jabatan: p.jabatan || '',
    kelasJabatan: p.kelas_jabatan || '',
    tukin: Number(p.tukin) || 0,
    tarifUangMakan: Number(p.tarif_uang_makan) || 37000,
    pphPct: p.pph_pct === null ? undefined : Number(p.pph_pct),
    status: p.status_kepegawaian,
    satker2: p.satker_2 || '',
  };
}

// Hitung satu pegawai dari data presensi, lalu simpan pengajuan + rincian + rekap.
async function simpanPengajuan(p, hari, tahun, bulan, sumberFile) {
  const hasil = Tukin.prosesSatuOrang(objekPegawai(p), hari, {});

  const pengajuan = await db('pengajuan_tukin?on_conflict=pegawai_id,tahun,bulan', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({
      pegawai_id: p.id,
      bidang_id: p.bidang_id,
      tahun,
      bulan,
      status: 'menunggu_verifikasi',
      dikirim_pada: new Date().toISOString(),
      aturan_versi: 1,
      aturan_snapshot: {
        tk: 3,
        tanpa_presensi: 1.5,
        tangga: [0.5, 1, 1.25, 1.5],
        batas: 100,
        ...(sumberFile ? { sumber_file: sumberFile } : {}),
      },
    }),
  });
  const idPengajuan = pengajuan[0].id;

  await db(`presensi?pengajuan_id=eq.${idPengajuan}`, { method: 'DELETE' });
  await db(`rekap_kehadiran?pengajuan_id=eq.${idPengajuan}`, { method: 'DELETE' });
  await db(`rekap_tukin?pengajuan_id=eq.${idPengajuan}`, { method: 'DELETE' });
  await db(`rekap_uang_makan?pengajuan_id=eq.${idPengajuan}`, { method: 'DELETE' });

  const rincian = hasil.perDay
    .map((d) => {
      const jenis = jenisSql(d.jenis);
      const tanggal = tanggalSql(d.tanggal);
      if (!jenis || !tanggal) return null;
      let persen = 0;
      let kode = null;
      if (d.jenis === 'tk') { persen = 3; kode = 'tk_harian'; }
      else if (d.jenis === 'noPresensi') { persen = d.pct || 1.5; kode = 'tanpa_presensi'; }
      else if (d.jenis === 'hadir') {
        persen = (d.telatPct || 0) + (d.pswPct || 0);
        kode = d.telatPct ? 'telat' : (d.pswPct ? 'psw' : null);
      }
      return {
        pengajuan_id: idPengajuan,
        pegawai_id: p.id,
        tanggal,
        jenis,
        sisi: d.sisi || null,
        jam_masuk: jadikanWaktu(d.masukMin),
        jam_pulang: jadikanWaktu(d.pulangMin),
        menit_telat: d.telat || 0,
        menit_pulang_awal: d.pswAwal || 0,
        potongan_kode: kode,
        potongan_persen: persen,
        libur_sub: d.libur || d.sub || null,
        jenis_tugas: d.jenisTugas || null,
        keterangan: d.keterangan || null,
        anomali: !!d.anomali,
      };
    })
    .filter(Boolean);

  if (rincian.length) await db('presensi', { method: 'POST', body: JSON.stringify(rincian) });

  const hitung = (kunci) => rincian.filter((r) => r.libur_sub && new RegExp(kunci, 'i').test(r.libur_sub)).length;
  await db('rekap_kehadiran', {
    method: 'POST',
    body: JSON.stringify({
      pengajuan_id: idPengajuan,
      hari_kerja: rincian.filter((r) => r.jenis !== 'weekend').length,
      hadir: hasil.hariMasuk,
      telat: hasil.telatList.length,
      pulang_awal: hasil.pswList.length,
      tidak_presensi_masuk: hasil.noPresensiList.filter((x) => x.sisi === 'masuk').length,
      tidak_presensi_pulang: hasil.noPresensiList.filter((x) => x.sisi === 'pulang').length,
      tk: hasil.tkHari,
      libur: hasil.liburList.length,
      cuti: hitung('cuti'),
      sakit: hitung('sakit'),
      dinas_luar: hitung('dinas'),
      izin: hitung('izin'),
      weekend: hasil.perDay.filter((d) => d.jenis === 'weekend').length,
      anomali: hasil.anomaliList.map((x) => ({
        tanggal: tanggalSql(x.tanggal),
        menit_pulang_awal: x.pswAwal || 0,
        sisi: x.sisi || null,
      })),
    }),
  });

  await db('rekap_tukin', {
    method: 'POST',
    body: JSON.stringify({
      pengajuan_id: idPengajuan,
      tukin_bruto: Number(p.tukin) || 0,
      pot_tk: hasil.rupiahPotongan.tk,
      pot_tl: hasil.rupiahPotongan.tl,
      pot_psw: hasil.rupiahPotongan.psw,
      pot_hukdis: 0,
      pot_tb: 0,
      hukdis_pct: 0,
      tb_pct: 0,
      pot_lain: 0,
      total_persen: hasil.pct.total,
      total_potongan: hasil.rupiahPotongan.total,
      pajak: 0,
      tukin_bersih: hasil.tukinBersih,
      rincian: { persen: hasil.pct, rupiah: hasil.rupiahPotongan },
    }),
  });

  await db('rekap_uang_makan', {
    method: 'POST',
    body: JSON.stringify({
      pengajuan_id: idPengajuan,
      hari_hadir: hasil.uangMakan.hariHadir,
      tarif: hasil.uangMakan.tarif,
      bruto: hasil.uangMakan.bruto,
      pph_pct: hasil.uangMakan.pphPct,
      pph: hasil.uangMakan.pph,
      bersih: hasil.uangMakan.bersih,
    }),
  });

  return {
    pengajuanId: idPengajuan,
    pegawai: {
      nama: p.nama,
      nip: p.nip,
      jabatan: p.jabatan || '',
      bidang: p.bidang && p.bidang.nama,
    },
    periode: { tahun, bulan },
    kehadiran: {
      hariKerja: rincian.filter((r) => r.jenis !== 'weekend').length,
      hadir: hasil.hariMasuk,
      telat: hasil.telatList.length,
      pulangAwal: hasil.pswList.length,
      tanpaKeterangan: hasil.tkHari,
      tanpaPresensiMasuk: hasil.noPresensiList.filter((x) => x.sisi === 'masuk').length,
      tanpaPresensiPulang: hasil.noPresensiList.filter((x) => x.sisi === 'pulang').length,
      cutiSakitDinas: hasil.liburList.length,
    },
    tukin: {
      bruto: Number(p.tukin) || 0,
      persenTotal: hasil.pct.total,
      potongan: hasil.rupiahPotongan.total,
      bersih: hasil.tukinBersih,
      rincianPersen: hasil.pct,
    },
    uangMakan: hasil.uangMakan,
  };
}

// --- Drive -----------------------------------------------------------------
// "9-2026" -> { bulan: 9, tahun: 2026 }; kosong -> null (semua bulan)
function periodeDrive(b) {
  const bulan = Number(b.bulan);
  const tahun = Number(b.tahun);
  if (!(bulan >= 1 && bulan <= 12) || !(tahun >= 2020 && tahun <= 2100)) return null;
  return { bulan, tahun };
}

// Baca folder Drive dengan pengambil yang sama seperti versi offline.
async function bacaFolderDrive(link, filter) {
  const daftar = Tukin.parseDriveLinks(link).filter((x) => x.id);
  if (!daftar.length) {
    const e = new Error('Link Drive tidak dikenali. Contoh: https://drive.google.com/drive/folders/XXXX');
    e.status = 400;
    throw e;
  }
  // parseDriveLinks -> { link, id: { id, jenis } } (sama seperti alat-drive.js)
  const akar = daftar[0].id;
  if (akar.jenis === 'file') {
    return {
      folderAkar: '', file: [{ id: akar.id, nama: 'file-drive.xlsx', jenis: 'file', jalur: '', folder: '' }],
      dilewati: [], pesan: [], lainBulan: 0,
    };
  }
  let nama = '';
  try { nama = Drive.judulFolder(await Drive.ambilTeks(Drive.urlDaftar(akar.id))); } catch { nama = ''; }
  const isi = await Drive.telusuri({ id: akar.id, nama }, () => {}, filter);
  return {
    folderAkar: nama, folder: isi.folder, file: isi.file, dilewati: isi.dilewati,
    pesan: isi.pesan, lainBulan: isi.lainBulan,
  };
}

// Cocokkan nama file/folder ke pegawai — aturan yang sama dengan index.html offline.
function kataNama(teks) {
  return String(teks == null ? '' : teks).toUpperCase().replace(/[^A-Z\s]/g, ' ')
    .split(/\s+/)
    .filter((k) => k.length >= 3 && !/^(DR|DRS|DRA|IR|H|HJ|PROF|NY|NYI)$/.test(k));
}

function cocokPegawai(daftar, namaKey, namaFile) {
  const cari = (kunci) => daftar.filter((x) => Tukin.namaKey(x.nama) === kunci);
  let kunci = String(namaKey || '').trim().toUpperCase();
  let ketemu = cari(kunci);
  if (!ketemu.length) {
    const kata = kataNama(kunci);
    if (kata.length) { ketemu = cari(kata[0]); kunci = kata[0]; }
  }
  if (!ketemu.length) {
    const kata1 = String(kunci || '').trim().split(/\s+/)[0];
    if (kata1 && kata1 !== kunci) ketemu = cari(kata1);
  }
  if (ketemu.length === 1) return { pegawai: ketemu[0], otomatis: true };
  if (ketemu.length > 1) return { ambigu: ketemu, namaFile };
  return { tidakAda: true };
}

function barisPeriode(hari) {
  return hari
    .map((h) => h && h.tanggal && `${h.tanggal.y}-${h.tanggal.mo}`)
    .filter(Boolean);
}

// File Drive yang sudah pernah diproses untuk periode ini (disimpan di
// aturan_snapshot.sumber_file) — dipakai aturan "file pertama dipertahankan,
// kecuali yang baru namanya lebih jelas". Ini pengganti catatan in-memory
// karena tiap file kini diproses dalam request terpisah.
async function sumberLama(p, tahun, bulan) {
  const baris = await db(
    `pengajuan_tukin?select=aturan_snapshot&pegawai_id=eq.${p.id}&tahun=eq.${tahun}&bulan=eq.${bulan}`,
  );
  const nama = baris && baris[0] && baris[0].aturan_snapshot && baris[0].aturan_snapshot.sumber_file;
  return typeof nama === 'string' && nama ? nama : null;
}

// Proses SATU file Drive: cocokkan nama -> hitung -> simpan.
// Hasil: { status: 'tersimpan', baris, ganti } atau { status: 'dilewati', lewat }.
async function prosesSatuFile(f, { pegawaiSemua, bulan, tahun }) {
  let buf;
  try {
    buf = await Drive.ambilIsi(f);
  } catch (e1) {
    // sekali lagi: koneksi ke Google kadang putus sesaat
    buf = await Drive.ambilIsi(f);
  }
  const hari = Tukin.bacaSheetPresensi(buf);
  const namaFile = Tukin.namaFileDrive(f, `${bulan}-${tahun}`);
  const ident = Tukin.parseNamaFile(namaFile);
  const jelasAsli = !!Tukin.parseNamaFile(f.nama); // nama file asli sudah berpola NAMA_Presensi B-T
  const cari = cocokPegawai(pegawaiSemua, ident ? ident.namaKey : Tukin.namaDariFolder(f.folder), namaFile);

  if (cari.tidakAda) {
    return { status: 'dilewati', lewat: { nama: f.nama, jalur: f.jalur, status: 'gagal', alasan: 'nama tidak ada di daftar pegawai' } };
  }
  if (cari.ambigu) {
    return {
      status: 'dilewati',
      lewat: {
        nama: f.nama, jalur: f.jalur, status: 'gagal',
        alasan: 'nama cocok dengan ' + cari.ambigu.length + ' pegawai: ' + cari.ambigu.map((x) => x.nama).join('; '),
      },
    };
  }

  const p = cari.pegawai;

  const periodeIsi = new Set(barisPeriode(hari));
  if (periodeIsi.size > 1) {
    return { status: 'dilewati', lewat: { nama: f.nama, jalur: f.jalur, status: 'gagal', alasan: 'isi file lebih dari satu bulan' } };
  }
  if (periodeIsi.size && !periodeIsi.has(`${tahun}-${bulan}`)) {
    return { status: 'dilewati', lewat: { nama: f.nama, jalur: f.jalur, status: 'gagal', alasan: 'isi file bukan bulan yang dipilih' } };
  }

  // Aturan offline: file pertama dipertahankan, kecuali yang baru jelas namanya
  // sedangkan yang lama tidak.
  const lama = await sumberLama(p, tahun, bulan);
  if (lama && lama !== f.nama) {
    const lamaJelas = !!Tukin.parseNamaFile(lama);
    if (!jelasAsli || lamaJelas) {
      return {
        status: 'dilewati',
        lewat: {
          nama: f.nama, jalur: f.jalur, status: 'ganda',
          alasan: 'pegawai sama sudah diambil dari ' + lama + ', file ini dilewati',
        },
      };
    }
  }

  const r = await simpanPengajuan(p, hari, tahun, bulan, f.nama);
  return {
    status: 'tersimpan',
    ganti: lama && lama !== f.nama ? lama : null,
    baris: {
      nama: p.nama, nip: p.nip, file: f.nama, jalur: f.jalur, status: 'tersimpan',
      pengajuanId: r.pengajuanId,
      hadir: r.kehadiran.hadir,
      tukinBersih: r.tukin.bersih,
      uangMakanBersih: r.uangMakan.bersih,
    },
  };
}

// --- handler ---------------------------------------------------------------
export async function handler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const jalur = decodeURIComponent(url.pathname);

  try {
    if (jalur === '/api/konfigurasi') {
      if (!SUPABASE_URL || !KUNCI_PUBLIK) {
        return kirimJson(res, 500, { pesan: 'SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY belum diisi di .env.local' });
      }
      return kirimJson(res, 200, { url: SUPABASE_URL, kunci: KUNCI_PUBLIK });
    }

    if (jalur === '/api/pegawai' && req.method === 'GET') {
      const nip = (url.searchParams.get('nip') || '').replace(/\s/g, '');
      if (!/^\d{18}$/.test(nip)) return kirimJson(res, 400, { pesan: 'NIP harus 18 angka' });
      const baris = await db(
        `pegawai?select=nip,nama,jabatan,golongan,ruang,status_kepegawaian,bidang:bidang_id(nama)&nip=eq.${nip}`,
      );
      if (!baris || !baris.length) return kirimJson(res, 404, { pesan: 'NIP tidak ditemukan pada daftar pegawai' });
      const p = baris[0];
      return kirimJson(res, 200, {
        nip: p.nip,
        nama: p.nama,
        jabatan: p.jabatan,
        golongan: p.golongan,
        ruang: p.ruang,
        status: p.status_kepegawaian,
        bidang: p.bidang && p.bidang.nama,
      });
    }

    // --- admin: daftar & simpan pegawai -----------------------------------
    if (jalur === '/api/pegawai/daftar' && req.method === 'GET') {
      await wajibAdmin(req);
      const baris = await db(
        'pegawai?select=id,nip,nama,pangkat,golongan,ruang,jabatan,kelas_jabatan,status_kepegawaian,' +
          'tukin,tarif_uang_makan,pph_pct,satker_2,aktif,bidang_id,bidang:bidang_id(nama,kode)&order=nama',
      );
      return kirimJson(res, 200, { pegawai: Array.isArray(baris) ? baris : [] });
    }

    if (jalur === '/api/pegawai/simpan' && req.method === 'POST') {
      const admin = await wajibAdmin(req);
      const b = await bacaBody(req);

      const nip = String(b.nip || '').replace(/\s/g, '');
      const nama = String(b.nama || '').trim();
      if (!/^\d{18}$/.test(nip)) return kirimJson(res, 400, { pesan: 'NIP harus 18 angka' });
      if (nama.length < 3) return kirimJson(res, 400, { pesan: 'Nama pegawai belum diisi' });
      if (!b.bidang_id) return kirimJson(res, 400, { pesan: 'Bidang belum dipilih' });
      const bidang = await db(`bidang?select=id,nama&id=eq.${encodeURIComponent(b.bidang_id)}`);
      if (!bidang || !bidang.length) return kirimJson(res, 400, { pesan: 'Bidang tidak dikenal' });

      const status = String(b.status_kepegawaian || 'PPPK').toUpperCase();
      if (!STATUS_PEGAWAI.includes(status)) {
        return kirimJson(res, 400, { pesan: `Status kepegawaian harus salah satu: ${STATUS_PEGAWAI.join(', ')}` });
      }

      const data = {
        nip,
        nama,
        nama_key: Tukin.namaKey(nama),
        pangkat: b.pangkat ? String(b.pangkat).trim() : null,
        golongan: b.golongan ? String(b.golongan).trim() : null,
        ruang: b.ruang ? String(b.ruang).trim() : null,
        jabatan: b.jabatan ? String(b.jabatan).trim() : null,
        kelas_jabatan: b.kelas_jabatan ? String(b.kelas_jabatan).trim() : null,
        bidang_id: bidang[0].id,
        status_kepegawaian: status,
        satker_2: b.satker_2 ? String(b.satker_2).trim() : null,
        aktif: b.aktif === undefined ? true : !!b.aktif,
      };

      const salah = [];
      for (const [kolom, label] of KOLOM_ANGKA) {
        const n = angkaAtauNull(b[kolom], label);
        if (n === undefined) continue;
        if (n === null) salah.push(`${label} belum diisi`);
        else data[kolom] = n;
      }
      if (salah.length) return kirimJson(res, 400, { pesan: salah.join('; ') });

      const id = b.id ? String(b.id) : null;
      try {
        if (id) {
          const hasil = await db(`pegawai?id=eq.${encodeURIComponent(id)}`, {
            method: 'PATCH',
            headers: { Prefer: 'return=representation' },
            body: JSON.stringify(data),
          });
          if (!hasil || !hasil.length) return kirimJson(res, 404, { pesan: 'Pegawai tidak ditemukan' });
          return kirimJson(res, 200, { pesan: `Data ${nama} diperbarui`, id: hasil[0].id });
        }

        data.created_at = new Date().toISOString();
        const hasil = await db('pegawai', {
          method: 'POST',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify(data),
        });
        return kirimJson(res, 200, { pesan: `${nama} ditambahkan ke daftar pegawai`, id: hasil[0].id });
      } catch (e) {
        const pesan = String(e.message || e);
        if (/duplicate key|uniq|23505/i.test(pesan)) {
          return kirimJson(res, 409, { pesan: `NIP ${nip} sudah terdaftar` });
        }
        throw e;
      }
    }

    if (jalur === '/api/daftar' && req.method === 'POST') {
      const b = await bacaBody(req);
      const wajib = ['nama', 'nip', 'jabatan', 'golongan', 'bidang', 'email'];
      const kurang = wajib.filter((k) => !b[k] || !String(b[k]).trim());
      if (kurang.length) return kirimJson(res, 400, { pesan: `Belum diisi: ${kurang.join(', ')}` });
      if (!/^\d{18}$/.test(String(b.nip).trim())) return kirimJson(res, 400, { pesan: 'NIP harus 18 angka' });
      if (!String(b.email).includes('@')) return kirimJson(res, 400, { pesan: 'Email tidak valid' });

      const bidang = await db(`bidang?select=id,kode&kode=eq.${encodeURIComponent(String(b.bidang).toUpperCase())}`);
      if (!bidang || !bidang.length) return kirimJson(res, 400, { pesan: 'Bidang tidak dikenal' });

      const hasil = await db('pendaftaran', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          nama: String(b.nama).trim(),
          nip: String(b.nip).trim(),
          pangkat: b.pangkat || null,
          golongan: b.golongan || null,
          jabatan: String(b.jabatan).trim(),
          bidang_id: bidang[0].id,
          email: String(b.email).trim().toLowerCase(),
          status: 'menunggu',
        }),
      });
      return kirimJson(res, 200, { pesan: 'Pendaftaran terkirim', id: hasil && hasil[0] && hasil[0].id });
    }

    if (jalur === '/api/proses' && req.method === 'POST') {
      const b = await bacaBody(req);
      const nip = String(b.nip || '').replace(/\s/g, '');
      const tahun = Number(b.tahun);
      const bulan = Number(b.bulan);
      if (!/^\d{18}$/.test(nip)) return kirimJson(res, 400, { pesan: 'NIP harus 18 angka' });
      if (!(tahun >= 2020 && tahun <= 2100)) return kirimJson(res, 400, { pesan: 'Tahun tidak valid' });
      if (!(bulan >= 1 && bulan <= 12)) return kirimJson(res, 400, { pesan: 'Bulan tidak valid' });
      if (!Array.isArray(b.hari) || !b.hari.length) return kirimJson(res, 400, { pesan: 'Isi presensi kosong' });

      const baris = await db(
        `pegawai?select=*,bidang:bidang_id(nama)&nip=eq.${nip}`,
      );
      if (!baris || !baris.length) return kirimJson(res, 404, { pesan: 'NIP tidak terdaftar' });
      const p = baris[0];

      // Periode yang dipilih harus cocok dengan isi file.
      const periodeFile = new Set(barisPeriode(b.hari));
      if (periodeFile.size > 1) {
        return kirimJson(res, 400, { pesan: 'File berisi lebih dari satu bulan; periksa file presensi' });
      }

      const r = await simpanPengajuan(p, b.hari, tahun, bulan);
      return kirimJson(res, 200, { pesan: 'Selamat Data Anda Sudah Terupload', ...r });
    }

    if (jalur === '/api/drive/daftar' && req.method === 'POST') {
      const b = await bacaBody(req);
      const filter = periodeDrive(b);
      const isi = await bacaFolderDrive(b.link, filter);
      return kirimJson(res, 200, isi);
    }

    if (jalur === '/api/drive/proses' && req.method === 'POST') {
      const b = await bacaBody(req);
      const tahun = Number(b.tahun);
      const bulan = Number(b.bulan);
      if (!(tahun >= 2020 && tahun <= 2100)) return kirimJson(res, 400, { pesan: 'Tahun tidak valid' });
      if (!(bulan >= 1 && bulan <= 12)) return kirimJson(res, 400, { pesan: 'Bulan tidak valid' });

      const pegawaiSemua = await db(
        'pegawai?select=*,bidang:bidang_id(nama)&order=nama',
      );
      if (!pegawaiSemua || !pegawaiSemua.length) return kirimJson(res, 500, { pesan: 'Daftar pegawai kosong' });

      // Mode 1 file: daftar file sudah dibaca lebih dulu oleh /api/drive/daftar,
      // jadi folder tidak perlu ditelusuri ulang (ini yang bikin timeout di Vercel).
      if (b.berkas && b.berkas.id) {
        const f = {
          id: String(b.berkas.id),
          nama: String(b.berkas.nama || 'file-drive.xlsx'),
          jalur: String(b.berkas.jalur || ''),
          folder: String(b.berkas.folder || ''),
          jenis: 'file',
        };
        const r = await prosesSatuFile(f, { pegawaiSemua, bulan, tahun });
        return kirimJson(res, 200, {
          folderAkar: '',
          fileDitemukan: 1,
          hasil: r.status === 'tersimpan' ? [r.baris] : [],
          dilewati: r.status === 'tersimpan' ? [] : [r.lewat],
          diganti: r.status === 'tersimpan' && r.ganti ? [{ nama: r.ganti, status: 'diganti', alasan: 'diganti ' + f.nama + ' (nama file lebih jelas)' }] : [],
        });
      }

      // Mode folder: semua file dalam satu request (lokal / folder kecil).
      const isi = await bacaFolderDrive(b.link, { bulan, tahun });
      const hasil = [];
      const dilewati = (isi.dilewati || []).map((d) => ({ ...d, status: 'dilewati' }));

      for (const f of isi.file || []) {
        try {
          const r = await prosesSatuFile(f, { pegawaiSemua, bulan, tahun });
          if (r.status === 'tersimpan') {
            if (r.ganti) {
              const i = hasil.findIndex((x) => x.nip === r.baris.nip);
              dilewati.push({ nama: r.ganti, jalur: '', status: 'ganda', alasan: 'diganti ' + f.nama + ' (nama file lebih jelas)' });
              if (i >= 0) hasil[i] = r.baris;
              else hasil.push(r.baris);
            } else {
              hasil.push(r.baris);
            }
          } else {
            dilewati.push(r.lewat);
          }
        } catch (e) {
          dilewati.push({ nama: f.nama, jalur: f.jalur, status: 'gagal', alasan: String(e.message || e) });
        }
      }

      return kirimJson(res, 200, {
        folderAkar: isi.folderAkar,
        pesan: isi.pesan,
        fileDitemukan: (isi.file || []).length,
        hasil,
        dilewati,
      });
    }

    // mesin hitung offline (berkas asli, tanpa salinan)
    if (BERKAS_LIB[jalur]) {
      const isi = await readFile(BERKAS_LIB[jalur]);
      res.writeHead(200, { 'Content-Type': TIPE[extname(jalur)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      return res.end(isi);
    }

    // file statis (di Vercel bagian ini tidak dipakai: aset dilayani platform)
    let jalurBerkas = jalur === '/' ? '/index.html' : jalur;
    const berkas = normalize(join(PUBLIK, jalurBerkas));
    if (!berkas.startsWith(PUBLIK + sep)) return kirimJson(res, 403, { pesan: 'Akses ditolak' });

    const info = await stat(berkas);
    if (!info.isFile()) throw new Error('bukan berkas');
    const isi = await readFile(berkas);
    res.writeHead(200, {
      'Content-Type': TIPE[extname(berkas).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(isi);
  } catch (e) {
    if (String(e.message || '').includes('ENOENT')) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end('<h1>404</h1><p>Halaman tidak ditemukan. <a href="/">Kembali</a></p>');
    }
    return kirimJson(res, e.status || 500, { pesan: String(e.message || e) });
  }
}

export default handler;
