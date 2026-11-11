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
import { randomBytes } from 'node:crypto';
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

// --- email -----------------------------------------------------------------
// Notifikasi email SENGAJA DINONAKTIFKAN secara default (permintaan sementara).
// Aktifkan lagi kapan saja dengan mengisi EMAIL_NOTIFIKASI=aktif di env
// (bersamaan dengan RESEND_API_KEY & RESEND_FROM); tanpa itu semua pemanggilan
// kirimEmail() langsung dilewati tanpa kontak ke Resend.
function emailAktif() {
  const nilai = String(env.EMAIL_NOTIFIKASI ?? '').trim().toLowerCase();
  return ['1', 'true', 'ya', 'aktif', 'on'].includes(nilai);
}

async function kirimEmail({ to, subject, text, html }) {
  if (!emailAktif()) {
    return { ok: false, dinonaktifkan: true, pesan: 'Notifikasi email sedang dinonaktifkan' };
  }
  const kunci = env.RESEND_API_KEY || '';
  if (!kunci) {
    console.warn('[email] RESEND_API_KEY belum diisi; email tidak dikirim:', subject, '->', to);
    return { ok: false, pesan: 'RESEND_API_KEY belum diisi' };
  }
  const dari = env.RESEND_FROM || 'Tool Tukin <onboarding@resend.dev>';
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${kunci}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: dari, to: Array.isArray(to) ? to : [to], subject, text, html }),
    });
    const teks = await res.text();
    if (!res.ok) return { ok: false, pesan: `Email gagal: HTTP ${res.status} ${teks.slice(0, 200)}` };
    return { ok: true, id: (JSON.parse(teks || '{}').id || '') };
  } catch (e) {
    return { ok: false, pesan: `Email gagal: ${String(e && e.message || e)}` };
  }
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

// --- helper akun Supabase Auth (service role) ------------------------------
async function cariUserAuth(email) {
  const target = String(email || '').trim().toLowerCase();
  if (!target) return null;
  let page = 1;
  for (let i = 0; i < 10; i++) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=${page}&per_page=200`, {
      headers: { apikey: KUNCI_SERVER, Authorization: `Bearer ${KUNCI_SERVER}` },
    });
    if (!res.ok) break;
    const json = await res.json().catch(() => ({}));
    const daftar = Array.isArray(json.users) ? json.users : (Array.isArray(json) ? json : []);
    const ketemu = daftar.find((u) => String(u.email || '').toLowerCase() === target);
    if (ketemu) return ketemu;
    if (daftar.length < 200) break;
    page++;
  }
  return null;
}

async function buatAtauPerbaruiUserAuth({ email, nama, password }) {
  let user = await cariUserAuth(email);
  if (!user) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: { apikey: KUNCI_SERVER, Authorization: `Bearer ${KUNCI_SERVER}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { nama, peran: 'pegawai' } }),
    });
    const teks = await res.text();
    if (!res.ok) throw new Error(`Gagal membuat akun login: HTTP ${res.status} ${teks.slice(0, 300)}`);
    user = JSON.parse(teks || '{}');
  } else {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${user.id}`, {
      method: 'PUT',
      headers: { apikey: KUNCI_SERVER, Authorization: `Bearer ${KUNCI_SERVER}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, email_confirm: true, user_metadata: { nama, peran: 'pegawai' } }),
    });
    if (!res.ok) {
      const teks = await res.text();
      throw new Error(`Gagal memperbarui akun login: HTTP ${res.status} ${teks.slice(0, 300)}`);
    }
    const json = await res.json().catch(() => null);
    if (json && json.id) user = json;
  }
  // upsert profil public.users
  await db('users?on_conflict=id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({ id: user.id, email: String(email).trim().toLowerCase(), nama, peran: 'pegawai', aktif: true }),
  });
  return user;
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

// Gabungkan baris-baris presensi yang memiliki tanggal sama sebelum dihitung
function gabungHariSama(hariList) {
  if (!Array.isArray(hariList)) return [];
  const map = new Map();
  for (const h of hariList) {
    if (!h || !h.tanggal) continue;
    const k = `${h.tanggal.y}-${h.tanggal.mo}-${h.tanggal.d}`;
    if (!map.has(k)) {
      map.set(k, { ...h });
    } else {
      const ada = map.get(k);
      // Jam masuk: pilih yang paling awal
      if (ada.masuk === null && h.masuk !== null) ada.masuk = h.masuk;
      else if (ada.masuk !== null && h.masuk !== null) ada.masuk = Math.min(ada.masuk, h.masuk);

      // Jam pulang: pilih yang paling akhir
      if (ada.pulang === null && h.pulang !== null) ada.pulang = h.pulang;
      else if (ada.pulang !== null && h.pulang !== null) ada.pulang = Math.max(ada.pulang, h.pulang);

      if (!ada.alasan && h.alasan) ada.alasan = h.alasan;
      if (!ada.deskripsi && h.deskripsi) ada.deskripsi = h.deskripsi;
    }
  }
  return Array.from(map.values());
}

// Hitung satu pegawai dari data presensi, lalu simpan pengajuan + rincian + rekap.
async function simpanPengajuan(p, hari, tahun, bulan, sumberFile) {
  const hariBersih = gabungHariSama(hari);
  const hasil = Tukin.prosesSatuOrang(objekPegawai(p), hariBersih, {});

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

  // Bersihkan pengajuan duplikat untuk pegawai & periode yang sama (jika ada),
  // agar sisa baris presensi/rekap milik pengajuan lama ikut terhapus (cascade).
  await db(`pengajuan_tukin?pegawai_id=eq.${p.id}&tahun=eq.${tahun}&bulan=eq.${bulan}&id=neq.${idPengajuan}`, { method: 'DELETE' });

  await db(`presensi?pengajuan_id=eq.${idPengajuan}`, { method: 'DELETE' });
  await db(`rekap_kehadiran?pengajuan_id=eq.${idPengajuan}`, { method: 'DELETE' });
  await db(`rekap_tukin?pengajuan_id=eq.${idPengajuan}`, { method: 'DELETE' });
  await db(`rekap_uang_makan?pengajuan_id=eq.${idPengajuan}`, { method: 'DELETE' });

  const rincianMap = new Map();
  for (const d of hasil.perDay) {
    const jenis = jenisSql(d.jenis);
    const tanggal = tanggalSql(d.tanggal);
    if (!jenis || !tanggal) continue;
    let persen = 0;
    let kode = null;
    if (d.jenis === 'tk') { persen = 3; kode = 'tk_harian'; }
    else if (d.jenis === 'noPresensi') { persen = d.pct || 1.5; kode = 'tanpa_presensi'; }
    else if (d.jenis === 'hadir') {
      persen = (d.telatPct || 0) + (d.pswPct || 0);
      kode = d.telatPct ? 'telat' : (d.pswPct ? 'psw' : null);
    }
    const item = {
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
    if (!rincianMap.has(tanggal)) {
      rincianMap.set(tanggal, item);
    } else {
      const ada = rincianMap.get(tanggal);
      ada.jam_masuk = ada.jam_masuk || item.jam_masuk;
      ada.jam_pulang = ada.jam_pulang || item.jam_pulang;
      ada.menit_telat = Math.max(ada.menit_telat || 0, item.menit_telat || 0);
      ada.menit_pulang_awal = Math.max(ada.menit_pulang_awal || 0, item.menit_pulang_awal || 0);
      if (item.jenis === 'hadir' && ada.jenis !== 'hadir') {
        ada.jenis = 'hadir';
        ada.potongan_kode = item.potongan_kode;
        ada.potongan_persen = item.potongan_persen;
      }
    }
  }
  const rincian = Array.from(rincianMap.values());

  if (rincian.length) {
    const tulisPresensi = async () => {
      await db('presensi?on_conflict=pengajuan_id,tanggal', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates' },
        body: JSON.stringify(rincian),
      });
    };
    try {
      await tulisPresensi();
    } catch (e) {
      // Jika masih ada baris duplikat (mis. sisa dari run sebelumnya), hapus lalu coba lagi.
      if (/23505|duplicate key/i.test(String(e && e.message))) {
        await db(`presensi?pengajuan_id=eq.${idPengajuan}`, { method: 'DELETE' });
        await tulisPresensi();
      } else {
        throw e;
      }
    }
  }

  const hitung = (kunci) => rincian.filter((r) => r.libur_sub && new RegExp(kunci, 'i').test(r.libur_sub)).length;
  await db('rekap_kehadiran?on_conflict=pengajuan_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates' },
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

  await db('rekap_tukin?on_conflict=pengajuan_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates' },
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

  await db('rekap_uang_makan?on_conflict=pengajuan_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates' },
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
// `pegawai` diisi bila admin sudah memilih pegawai untuk nama yang ambigu.
// Hasil: { status: 'tersimpan', baris, ganti } | { status: 'ambigu', lewat } | { status: 'dilewati', lewat }.
async function prosesSatuFile(f, { pegawaiSemua, bulan, tahun, pegawai }) {
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

  let p = pegawai || null;
  if (!p) {
    const cari = cocokPegawai(pegawaiSemua, ident ? ident.namaKey : Tukin.namaDariFolder(f.folder), namaFile);

    if (cari.tidakAda) {
      return { status: 'dilewati', lewat: { nama: f.nama, jalur: f.jalur, status: 'gagal', alasan: 'nama tidak ada di daftar pegawai' } };
    }
    if (cari.ambigu) {
      // Bukan kegagalan: admin bisa memilih pegawai yang benar lalu file ini diproses ulang.
      return {
        status: 'ambigu',
        lewat: {
          nama: f.nama, jalur: f.jalur, status: 'ambigu',
          alasan: 'nama cocok dengan ' + cari.ambigu.length + ' pegawai, pilih salah satu',
          kandidat: cari.ambigu.map((x) => ({ id: x.id, nama: x.nama, nip: x.nip })),
        },
      };
    }
    p = cari.pegawai;
  }

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

    // Keep-alive Supabase Free plan: satu query ringan tapi nyata ke database
    // (bukan sekadar balas "ok"), dipanggil .github/workflows/jaga-supabase.yml
    // 4x sehari agar proyek tidak dijeda karena tidak ada aktivitas.
    if (jalur === '/api/awas') {
      const mulai = Date.now();
      const baris = await db('bidang?select=id&limit=1');
      return kirimJson(res, 200, {
        ok: true,
        waktu: new Date().toISOString(),
        bidang: Array.isArray(baris) ? baris.length : 0,
        ms: Date.now() - mulai,
      });
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
          'tukin,tarif_uang_makan,pph_pct,satker_2,aktif,bidang_id,bidang:bidang_id(nama,kode)&order=aktif.desc,nama',
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

    // Nonaktifkan / aktifkan pegawai. Riwayat pengajuan tidak disentuh.
    if (jalur === '/api/pegawai/aktif' && req.method === 'POST') {
      await wajibAdmin(req);
      const b = await bacaBody(req);
      if (!b.id) return kirimJson(res, 400, { pesan: 'Pegawai belum dipilih' });
      const hasil = await db(`pegawai?id=eq.${encodeURIComponent(String(b.id))}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ aktif: !!b.aktif }),
      });
      if (!hasil || !hasil.length) return kirimJson(res, 404, { pesan: 'Pegawai tidak ditemukan' });
      return kirimJson(res, 200, {
        pesan: `${hasil[0].nama} ${hasil[0].aktif ? 'diaktifkan' : 'dinonaktifkan'}`,
        aktif: hasil[0].aktif,
      });
    }

    // Hapus permanen. Ditolak bila pegawai sudah punya pengajuan, karena
    // foreign key akan mengikut menghapus riwayat presensi & rekapnya.
    if (jalur === '/api/pegawai/hapus' && req.method === 'POST') {
      await wajibAdmin(req);
      const b = await bacaBody(req);
      const id = b.id ? String(b.id) : '';
      if (!id) return kirimJson(res, 400, { pesan: 'Pegawai belum dipilih' });

      const ada = await db(`pegawai?select=id,nama&id=eq.${encodeURIComponent(id)}`);
      if (!ada || !ada.length) return kirimJson(res, 404, { pesan: 'Pegawai tidak ditemukan' });

      const pengajuan = await db(`pengajuan_tukin?select=id&pegawai_id=eq.${encodeURIComponent(id)}&limit=1`);
      if (pengajuan && pengajuan.length) {
        return kirimJson(res, 409, {
          pesan: `${ada[0].nama} sudah punya data pengajuan; pakai Nonaktifkan saja agar riwayatnya tidak hilang`,
        });
      }

      await db(`pegawai?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
      return kirimJson(res, 200, { pesan: `${ada[0].nama} dihapus dari daftar pegawai` });
    }

    if (jalur === '/api/daftar' && req.method === 'POST') {
      const b = await bacaBody(req);
      const wajib = ['nama', 'nip', 'jabatan', 'golongan', 'bidang', 'email'];
      const kurang = wajib.filter((k) => !b[k] || !String(b[k]).trim());
      if (kurang.length) return kirimJson(res, 400, { pesan: `Belum diisi: ${kurang.join(', ')}` });
      if (!/^\d{18}$/.test(String(b.nip).trim())) return kirimJson(res, 400, { pesan: 'NIP harus 18 angka' });
      if (!String(b.email).includes('@')) return kirimJson(res, 400, { pesan: 'Email tidak valid' });

      const bidang = await db(`bidang?select=id,kode,nama&kode=eq.${encodeURIComponent(String(b.bidang).toUpperCase())}`);
      if (!bidang || !bidang.length) return kirimJson(res, 400, { pesan: 'Bidang tidak dikenal' });

      let hasil;
      try {
        hasil = await db('pendaftaran', {
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
      } catch (e) {
        const pesan = String(e && e.message || e);
        if (/23505|unique|duplicate/i.test(pesan)) {
          return kirimJson(res, 409, { pesan: 'NIP ini sudah memiliki pendaftaran yang menunggu. Cek status pendaftaran.' });
        }
        throw e;
      }

      // Notifikasi email ke admin (best effort, tidak memblokir respons)
      const adminEmail = env.ADMIN_EMAIL || '';
      if (adminEmail) {
        kirimEmail({
          to: adminEmail,
          subject: `Pendaftaran baru: ${String(b.nama).trim()} (${String(b.nip).trim()})`,
          text: `Ada pendaftaran akun pegawai baru.\n\nNama: ${String(b.nama).trim()}\nNIP: ${String(b.nip).trim()}\nJabatan: ${String(b.jabatan).trim()}\nBidang: ${bidang[0].nama}\nEmail: ${String(b.email).trim()}\n\nSilakan buka tab Pendaftar di aplikasi admin untuk memutuskan.`,
        }).catch(() => {});
      }

      return kirimJson(res, 200, { pesan: 'Pendaftaran terkirim', id: hasil && hasil[0] && hasil[0].id });
    }

    // Cek status pendaftaran (ringan, tanpa login)
    if (jalur === '/api/daftar/status' && req.method === 'GET') {
      const nip = String(url.searchParams.get('nip') || '').replace(/\s/g, '');
      const email = String(url.searchParams.get('email') || '').trim().toLowerCase();
      if (!/^\d{18}$/.test(nip)) return kirimJson(res, 400, { pesan: 'NIP harus 18 angka' });
      if (!email || !email.includes('@')) return kirimJson(res, 400, { pesan: 'Email tidak valid' });
      const baris = await db(
        `pendaftaran?select=id,status,catatan_admin,created_at,diputuskan_pada&nip=eq.${nip}&email=eq.${encodeURIComponent(email)}&order=created_at.desc&limit=1`,
      );
      if (!Array.isArray(baris) || !baris.length) {
        return kirimJson(res, 404, { pesan: 'Pendaftaran tidak ditemukan untuk NIP & email ini' });
      }
      const p = baris[0];
      return kirimJson(res, 200, {
        id: p.id,
        status: p.status,
        catatan_admin: p.catatan_admin,
        diajukan_pada: p.created_at,
        diputuskan_pada: p.diputuskan_pada,
      });
    }

    // Keputusan admin atas pendaftaran: setujui (buat akun) / tolak.
    if (jalur === '/api/pendaftaran/putuskan' && req.method === 'POST') {
      const admin = await wajibAdmin(req);
      const b = await bacaBody(req);
      const id = String(b.id || '').trim();
      const aksi = String(b.aksi || '').trim().toLowerCase();
      if (!id) return kirimJson(res, 400, { pesan: 'Pendaftaran belum dipilih' });
      if (!['setujui', 'tolak'].includes(aksi)) return kirimJson(res, 400, { pesan: 'Aksi harus setujui atau tolak' });

      const baris = await db(`pendaftaran?select=*&id=eq.${encodeURIComponent(id)}`);
      const p = Array.isArray(baris) ? baris[0] : null;
      if (!p) return kirimJson(res, 404, { pesan: 'Pendaftaran tidak ditemukan' });
      if (p.status !== 'menunggu') return kirimJson(res, 409, { pesan: `Pendaftaran sudah berstatus ${p.status}` });

      const catatan = b.catatan ? String(b.catatan).trim() : null;
      const now = new Date().toISOString();

      if (aksi === 'tolak') {
        await db(`pendaftaran?id=eq.${encodeURIComponent(id)}`, {
          method: 'PATCH',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify({ status: 'ditolak', catatan_admin: catatan, diputuskan_oleh: admin.id, diputuskan_pada: now }),
        });
        kirimEmail({
          to: p.email,
          subject: 'Pendaftaran akun Tool Tukin ditolak',
          text: `Halo ${p.nama},\n\nPendaftaran akun Anda ditolak oleh admin.\n${catatan ? 'Catatan: ' + catatan + '\n' : ''}\nHubungi admin bila ada pertanyaan.`,
        }).catch(() => {});
        await db('audit_log', {
          method: 'POST',
          body: JSON.stringify({ aktor_id: admin.id, aksi: 'tolak_pendaftaran', tabel: 'pendaftaran', record_id: id, data_baru: { status: 'ditolak' } }),
        }).catch(() => {});
        return kirimJson(res, 200, { pesan: 'Pendaftaran ditolak', email: p.email });
      }

      // setujui: buat/tautkan akun login + pegawai
      const password = randomBytes(10).toString('base64url') + '!7A';
      let user;
      try {
        user = await buatAtauPerbaruiUserAuth({ email: p.email, nama: p.nama, password });
      } catch (e) {
        return kirimJson(res, 500, { pesan: String(e && e.message || e) });
      }

      // cari pegawai dengan NIP ini
      const adaPegawai = await db(`pegawai?select=id,user_id&nip=eq.${encodeURIComponent(p.nip)}`);
      let pegawaiId = (Array.isArray(adaPegawai) && adaPegawai[0]) ? adaPegawai[0].id : null;
      if (!pegawaiId) {
        const bidangId = p.bidang_id;
        const hasilPegawai = await db('pegawai', {
          method: 'POST',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify({
            user_id: user.id,
            nip: p.nip,
            nama: p.nama,
            nama_key: Tukin.namaKey(p.nama),
            pangkat: p.pangkat,
            golongan: p.golongan,
            jabatan: p.jabatan,
            bidang_id: bidangId,
            status_kepegawaian: 'PPPK',
            tukin: 0,
            tarif_uang_makan: 37000,
            pph_pct: 5,
            aktif: true,
          }),
        });
        pegawaiId = hasilPegawai && hasilPegawai[0] && hasilPegawai[0].id;
      } else {
        await db(`pegawai?id=eq.${encodeURIComponent(pegawaiId)}`, {
          method: 'PATCH',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify({ user_id: user.id, aktif: true }),
        });
      }

      await db(`pendaftaran?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ status: 'disetujui', catatan_admin: catatan, diputuskan_oleh: admin.id, diputuskan_pada: now }),
      });

      const emailHasil = await kirimEmail({
        to: p.email,
        subject: 'Akun Tool Tukin Anda sudah aktif',
        text: `Halo ${p.nama},\n\nPendaftaran akun Anda disetujui.\n\nEmail login: ${p.email}\nPassword sementara: ${password}\n\nSilakan masuk di ${env.APP_BASE_URL || ''}/masuk.html dan segera ganti password.\n${catatan ? 'Catatan admin: ' + catatan : ''}`,
      });

      await db('audit_log', {
        method: 'POST',
        body: JSON.stringify({ aktor_id: admin.id, aksi: 'setujui_pendaftaran', tabel: 'pendaftaran', record_id: id, data_baru: { status: 'disetujui', pegawai_id: pegawaiId, user_id: user.id } }),
      }).catch(() => {});

      return kirimJson(res, 200, {
        pesan: 'Pendaftaran disetujui dan akun dibuat',
        email: p.email,
        passwordSementara: password,
        emailTerkirim: emailHasil.ok,
        emailDinonaktifkan: !!emailHasil.dinonaktifkan,
        catatanEmail: emailHasil.ok ? '' : emailHasil.pesan,
      });
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
        // Admin memilih pegawai untuk nama yang ambigu.
        let paksa = null;
        if (b.pegawai_id) {
          paksa = pegawaiSemua.find((x) => x.id === String(b.pegawai_id)) || null;
          if (!paksa) return kirimJson(res, 400, { pesan: 'Pegawai yang dipilih tidak ditemukan' });
        }
        const r = await prosesSatuFile(f, { pegawaiSemua, bulan, tahun, pegawai: paksa });
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
