// rekap.js — menyusun isi 3 berkas rekap (kehadiran, tukin, uang makan).
//
// Dipakai halaman admin (sebagai window.Rekap) dan bisa diuji di Node
// (module.exports) supaya angka yang diekspor bisa diperiksa tanpa browser.
// Sumber data: satu periode pengajuan_tukin + rekap_* dari Supabase.

(function (root, pabrik) {
  if (typeof module === 'object' && module.exports) module.exports = pabrik();
  else root.Rekap = pabrik();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var NAMA_BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli',
    'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  var SINGKAT = ['', 'JAN', 'FEB', 'MAR', 'APR', 'MEI', 'JUN', 'JUL', 'AGU', 'SEP', 'OKT', 'NOV', 'DES'];

  function labelBulan(b) { return NAMA_BULAN[Number(b) - 1] || String(b); }
  function singkat(b) { return SINGKAT[Number(b)] || String(b); }
  function angka(n) { var v = Number(n); return isFinite(v) ? v : 0; }

  // rekap_* berelasi satu-satu dengan pengajuan, sehingga PostgREST kadang
  // mengembalikan objek (bukan array satu elemen). Terima keduanya.
  function satuRekap(v) { return Array.isArray(v) ? v[0] : v; }

  function satu(x) {
    var p = x.pegawai || {};
    var bidang = (p.bidang && p.bidang.nama) || '';
    var gol = p.golongan ? (p.ruang ? p.golongan + '/' + p.ruang : p.golongan) : '';
    return {
      pengajuan: x,
      nama: p.nama || '',
      nip: p.nip || '',
      jabatan: p.jabatan || '',
      gol: gol,
      bidang: bidang,
      status: String(x.status || '').replace(/_/g, ' '),
      kh: satuRekap(x.rekap_kehadiran) || null,
      rt: satuRekap(x.rekap_tukin) || null,
      ru: satuRekap(x.rekap_uang_makan) || null,
    };
  }

  function urut(data) {
    return (data || []).slice().sort(function (a, b) {
      var na = (a.pegawai && a.pegawai.nama) || '';
      var nb = (b.pegawai && b.pegawai.nama) || '';
      return na.localeCompare(nb, 'id');
    });
  }

  // Kehadiran: satu baris per pegawai.
  function kehadiran(data, tahun, bulan) {
    var kolom = ['No', 'Nama', 'NIP', 'Jabatan', 'Golongan', 'Bidang', 'Periode', 'Status',
      'Hari kerja', 'Hadir', 'Telat', 'Pulang awal', 'Tanpa keterangan', 'Tanpa presensi masuk',
      'Tanpa presensi pulang', 'Cuti', 'Sakit', 'Dinas luar', 'Izin', 'Akhir pekan'];
    var lebar = [5, 34, 22, 30, 12, 26, 16, 20, 11, 8, 8, 11, 16, 20, 20, 8, 8, 11, 8, 12];
    var baris = urut(data).map(function (x, i) {
      var s = satu(x);
      var kh = s.kh || {};
      return [i + 1, s.nama, s.nip, s.jabatan, s.gol, s.bidang, labelBulan(bulan) + ' ' + tahun, s.status,
        angka(kh.hari_kerja), angka(kh.hadir), angka(kh.telat), angka(kh.pulang_awal),
        angka(kh.tk), angka(kh.tidak_presensi_masuk), angka(kh.tidak_presensi_pulang),
        angka(kh.cuti), angka(kh.sakit), angka(kh.dinas_luar), angka(kh.izin), angka(kh.weekend)];
    });
    return {
      sheet: 'Kehadiran',
      judul: 'REKAPITULASI KEHADIRAN — ' + labelBulan(bulan).toUpperCase() + ' ' + tahun,
      namaBerkas: 'Rekap Kehadiran ' + singkat(bulan) + ' ' + tahun + '.xlsx',
      kolom: kolom, lebar: lebar, baris: baris,
    };
  }

  // Tukin: potongan dalam rupiah dan persen.
  function tukin(data, tahun, bulan) {
    var kolom = ['No', 'Nama', 'NIP', 'Jabatan', 'Golongan', 'Bidang', 'Periode', 'Status',
      'Tukin bruto', 'Pot. TK', 'Pot. telat', 'Pot. pulang awal', 'Pot. HUKDIS', 'Pot. TB',
      'Pot. lain', 'Total %', 'Total potongan', 'Pajak', 'Tukin bersih'];
    var lebar = [5, 34, 22, 30, 12, 26, 16, 20, 14, 12, 12, 16, 13, 11, 11, 10, 15, 11, 14];
    var baris = urut(data).map(function (x, i) {
      var s = satu(x);
      var rt = s.rt || {};
      return [i + 1, s.nama, s.nip, s.jabatan, s.gol, s.bidang, labelBulan(bulan) + ' ' + tahun, s.status,
        angka(rt.tukin_bruto), angka(rt.pot_tk), angka(rt.pot_tl), angka(rt.pot_psw),
        angka(rt.pot_hukdis), angka(rt.pot_tb), angka(rt.pot_lain), angka(rt.total_persen),
        angka(rt.total_potongan), angka(rt.pajak), angka(rt.tukin_bersih)];
    });
    return {
      sheet: 'Tukin',
      judul: 'REKAPITULASI TUKIN — ' + labelBulan(bulan).toUpperCase() + ' ' + tahun,
      namaBerkas: 'Rekap Tukin ' + singkat(bulan) + ' ' + tahun + '.xlsx',
      kolom: kolom, lebar: lebar, baris: baris,
    };
  }

  // Uang makan.
  function uangMakan(data, tahun, bulan) {
    var kolom = ['No', 'Nama', 'NIP', 'Jabatan', 'Golongan', 'Bidang', 'Periode', 'Status',
      'Hari hadir', 'Tarif', 'Bruto', 'PPh %', 'PPh', 'Uang makan bersih'];
    var lebar = [5, 34, 22, 30, 12, 26, 16, 20, 11, 12, 14, 9, 12, 18];
    var baris = urut(data).map(function (x, i) {
      var s = satu(x);
      var ru = s.ru || {};
      return [i + 1, s.nama, s.nip, s.jabatan, s.gol, s.bidang, labelBulan(bulan) + ' ' + tahun, s.status,
        angka(ru.hari_hadir), angka(ru.tarif), angka(ru.bruto), angka(ru.pph_pct),
        angka(ru.pph), angka(ru.bersih)];
    });
    return {
      sheet: 'Uang Makan',
      judul: 'REKAPITULASI UANG MAKAN — ' + labelBulan(bulan).toUpperCase() + ' ' + tahun,
      namaBerkas: 'Rekap Uang Makan ' + singkat(bulan) + ' ' + tahun + '.xlsx',
      kolom: kolom, lebar: lebar, baris: baris,
    };
  }

  // Ringkasan untuk ditampilkan di halaman sebelum mengekspor.
  function ringkas(data) {
    var d = urut(data);
    var totalTukin = 0;
    var totalUm = 0;
    d.forEach(function (x) {
      var rt = satuRekap(x.rekap_tukin);
      var ru = satuRekap(x.rekap_uang_makan);
      totalTukin += angka(rt && rt.tukin_bersih);
      totalUm += angka(ru && ru.bersih);
    });
    return { jumlah: d.length, totalTukin: totalTukin, totalUangMakan: totalUm };
  }

  return {
    susun: function (data, tahun, bulan) {
      return {
        kehadiran: kehadiran(data, tahun, bulan),
        tukin: tukin(data, tahun, bulan),
        uangMakan: uangMakan(data, tahun, bulan),
      };
    },
    ringkas: ringkas,
    labelBulan: labelBulan,
    NAMA_BULAN: NAMA_BULAN,
  };
});
