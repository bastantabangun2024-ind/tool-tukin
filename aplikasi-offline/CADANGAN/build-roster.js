// Bangun roster pegawai dari file Rekapitulasi Tukin + Uang Makan.
// Sumber: 3 bidang PPPK (BIMAS ... PPPK) + 3 bidang PNS (ABSEN SEPTEMBER 2026 PNS/PEMBIMAS ...).
// Output: APLIKASI/pegawai.js — window.PEGAWAI = [...]
// Roster dipakai oleh aplikasi offline untuk mapping nama pendek <-> data pegawai.
const xlsx = require('../APLIKASI/lib/xlsx.full.min.js');
const fs = require('fs');
const path = require('path');

const FOLDERS = [
  { bidang: 'KRISTEN', status: 'PPPK', dir: path.join(__dirname, 'BIMAS KRISTEN PPPK') },
  { bidang: 'KATOLIK', status: 'PPPK', dir: path.join(__dirname, 'BIMAS KATOLIK PPPK') },
  { bidang: 'BUDDHA', status: 'PPPK', dir: path.join(__dirname, 'BIMAS BUDDHA PPPK') },
  { bidang: 'KRISTEN', status: 'PNS', dir: path.join(__dirname, 'ABSEN SEPTEMBER 2026 PNS', 'PEMBIMAS KRISTEN') },
  { bidang: 'KATOLIK', status: 'PNS', dir: path.join(__dirname, 'ABSEN SEPTEMBER 2026 PNS', 'PEMBIMAS KATOLIK') },
  { bidang: 'BUDDHA', status: 'PNS', dir: path.join(__dirname, 'ABSEN SEPTEMBER 2026 PNS', 'PEMBIMAS BUDDHA') },
];

const parseRp = (v) => {
  if (v == null) return 0;
  // format " Rp3,319,000 " / "Rp-" -> hanya angka
  const s = String(v).replace(/[^0-9]/g, '');
  const n = Number(s);
  return isNaN(n) ? 0 : n;
};

// kata pertama nama (gelar seperti "Dr." / "Drs." / "H." dilewati) -> "SAMAREL", "ARDI", "DAVID"
const GELAR = /^(DR|DRS|DRA|IR|H|HJ|PROF|NY|NYI)$/;
const namaKey = (nama) => {
  const kata = String(nama == null ? '' : nama).split(/[\s,.]+/).filter((x) => x.length > 0);
  for (const k of kata) {
    const bersih = k.replace(/[^A-Za-z]/g, '').toUpperCase();
    if (bersih.length < 3 || GELAR.test(bersih)) continue;
    return bersih;
  }
  return '';
};

// bundle SheetJS di browser tidak bisa readFile -> baca sendiri lalu serahkan buffer
const baca = (file) => xlsx.read(fs.readFileSync(file), { type: 'buffer' });
const sheetPertama = (file) => {
  const wb = baca(file);
  const ws = wb.Sheets[wb.SheetNames[0]];
  return xlsx.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });
};

const roster = [];
for (const { bidang, status: statusFolder, dir } of FOLDERS) {
  const files = fs.readdirSync(dir);
  const tukinFile = files.find((f) => /Tukin/i.test(f) && /\.xlsx$/i.test(f));
  const umFile = files.find((f) => /Uang.?Makan/i.test(f) && /\.xlsx$/i.test(f));
  if (!tukinFile) { console.error('Tukin TIDAK ADA:', dir); continue; }
  const rows = sheetPertama(path.join(dir, tukinFile));
  // baris header berada di mana kolomnya "NIP"
  const headIdx = rows.findIndex((r) => r.includes('NIP'));
  const head = rows[headIdx];
  const c = (name) => head.indexOf(name);
  for (let i = headIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    const nip = String(r[c('NIP')] || '').trim();
    if (!/^\d{15,18}$/.test(nip)) continue; // lewat baris legend
    const nama = String(r[c('NAMA')] || '').trim().replace(/,+$/, '');
    if (!nama) continue;
    const statusKolom = c('STATUS PEGAWAI') >= 0 ? String(r[c('STATUS PEGAWAI')] || '').trim().toUpperCase() : '';
    roster.push({
      bidang,
      status: statusKolom || statusFolder,
      nip,
      nama,
      namaKey: namaKey(nama),
      gol: String(r[c('GOL/ RUANG')] || r[c('GOL/RUANG')] || '').trim(),
      jabatan: String(r[c('JABATAN')] || '').trim(),
      kelasJabatan: String(r[c('KELAS JABATAN')] || r[c('KELAS JAB')] || '').trim(),
      tukin: parseRp(r[c('TUKIN')]),
    });
  }
  // tarif uang makan + PPH per orang dari file uang makan (jika ada)
  if (umFile) {
    const rows2 = sheetPertama(path.join(dir, umFile));
    const hIdx2 = rows2.findIndex((r) => r.includes('NIP'));
    const head2 = rows2[hIdx2];
    const c2 = (name) => head2.indexOf(name);
    for (let i = hIdx2 + 1; i < rows2.length; i++) {
      const r = rows2[i];
      const nip = String(r[c2('NIP')] || '').trim();
      if (!/^\d{15,18}$/.test(nip)) continue;
      const hari = Number(String(r[c2('HARI MASUK')] || '').trim()) || 0;
      const um = parseRp(r[c2('UANG MAKAN')]);
      const pph = parseRp(r[c2('PPH')]);
      const p = roster.find((x) => x.nip === nip && x.bidang === bidang);
      if (p && hari > 0 && um > 0) {
        // tarif harian dibulatkan ke ribuan (mis. 41.000 untuk PNS golongan IV)
        const tarif = Math.round(um / hari / 1000) * 1000;
        if (isFinite(tarif) && tarif > 0) p.tarifUangMakan = tarif;
        // tarif PPH: PNS golongan IV 15%, golongan III / PPPK 5%, khusus 35.000 tanpa PPH
        if (pph > 0 && um > 0) p.pphPct = Math.round((pph / um) * 100);
      }
    }
  }
}

// pastikan tarif default
for (const p of roster) {
  if (!p.tarifUangMakan) p.tarifUangMakan = 37000;
}

const out = 'window.PEGAWAI = ' + JSON.stringify(roster, null, 1) + ';\n';
fs.writeFileSync(path.join(__dirname, '..', 'APLIKASI', 'pegawai.js'), out);
console.log('TOTAL PEGAWAI:', roster.length);
const per = {};
roster.forEach((p) => { per[p.bidang + ' ' + p.status] = (per[p.bidang + ' ' + p.status] || 0) + 1; });
console.log(per);
roster.forEach((p) => {
  if (p.status === 'PNS') console.log(p.namaKey, '|', p.gol, '|', p.tukin, '|', p.tarifUangMakan, '|', p.pphPct + '%');
});
