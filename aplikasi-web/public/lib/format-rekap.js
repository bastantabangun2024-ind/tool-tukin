// format-rekap.js — menyusun 3 workbook rekap (Kehadiran, Tukin, Uang Makan)
// mengikuti format berkas contoh di folder `format_excel/`:
//
//   * satu lembar bernama "Worksheet" untuk tiap berkas;
//   * judul "REKAPITULASI ... PEMBIMAS <BIDANG>" tanpa kolom NO;
//   * Tukin & Uang Makan: judul di baris 1, baris 2–3 kosong, header di baris 4,
//     data mulai baris 5, nominal berupa ANGKA dengan format mata uang (bukan teks);
//   * Kehadiran: satu baris per hari per pegawai, kolom mengikuti unduhan
//     absensi.kemenag.go.id (termasuk KETERANGAN 2), tanggal "YYYY-MM-DD 00:00:00".
//
// Modul ini hanya mengatur TATA LETAK. Angka tetap berasal dari mesin hitung
// `TukinTool` (public/lib/app.js) yang disalin dari aplikasi offline.
//
// Dipakai halaman admin (window.FormatRekap) dan bisa diuji di Node
// (module.exports) dengan menyetel global.XLSX lebih dulu.

(function (root, pabrik) {
  if (typeof module === 'object' && module.exports) module.exports = pabrik();
  else root.FormatRekap = pabrik();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var NAMA_BULAN = ['', 'JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI',
    'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER'];
  var LABEL_BULAN = ['', 'JAN', 'FEB', 'MAR', 'APR', 'MEI', 'JUN', 'JUL', 'AGUS',
    'SEPT', 'OKT', 'NOV', 'DES'];
  var HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  var SATKER_3 = 'Kanwil Kementerian Agama Provinsi Aceh';

  // Format rupiah bawaan Excel (sama dengan berkas contoh).
  var FMT_RP = '_-"Rp"* #,##0_-;\\-"Rp"* #,##0_-;_-"Rp"* "-"??_-;_-@_-';

  function pustaka() {
    if (typeof XLSX !== 'undefined') return XLSX;
    if (typeof globalThis !== 'undefined' && globalThis.XLSX) return globalThis.XLSX;
    throw new Error('Pustaka XLSX belum dimuat');
  }

  function angka(n) { var v = Number(n); return isFinite(v) ? v : 0; }

  function judulBidang(bidang) { return String(bidang || '').trim().toUpperCase(); }

  // "KATOLIK" -> "Katolik" (dipakai untuk SATKER 2 & baris tanda tangan)
  function judulNama(teks) {
    return String(teks || '').toLowerCase().replace(/(^|\s)\S/g, function (huruf) {
      return huruf.toUpperCase();
    });
  }

  function statusPegawai(g) { return (g && g.status) || 'PPPK'; }
  function akhiranStatus(status) { return status === 'PPPK' ? '' : ' ' + status; }

  function hariDari(t) {
    if (!t) return '';
    return HARI[new Date(t.y, t.mo - 1, t.d).getDay()];
  }

  // "2026-09-01 00:00:00" (bulan & tanggal dua digit, seperti berkas contoh)
  function tanggalString(t) {
    if (!t) return '';
    return t.y + '-' + String(t.mo).padStart(2, '0') + '-' + String(t.d).padStart(2, '0') + ' 00:00:00';
  }

  // format jam ala berkas contoh: menit tanpa nol di depan ("8:0", "7:3", "16:35")
  function jam(m) {
    if (m === null || m === undefined) return null;
    var h = Math.floor(m / 60);
    return h + ':' + (m % 60);
  }

  // Lembar dengan format mata uang (hanya kolom nominal) + lebar kolom.
  function lembar(aoa, kolom, opsi) {
    opsi = opsi || {};
    var XLSX = pustaka();
    var ws = XLSX.utils.aoa_to_sheet(aoa);
    (opsi.kolomRp || []).forEach(function (c) {
      for (var r = opsi.barisMulai || 0; r < aoa.length; r++) {
        var sel = ws[XLSX.utils.encode_cell({ r: r, c: c })];
        if (sel && sel.t === 'n') sel.z = FMT_RP;
      }
    });
    if (kolom) ws['!cols'] = kolom;
    if (opsi.tinggi) ws['!rows'] = opsi.tinggi;
    return ws;
  }

  // ------------------------------------------------------------------ *
  // Kehadiran — satu baris per hari per pegawai, satu lembar.
  // ------------------------------------------------------------------ *
  function barisHari(g, k, satker2) {
    var jamMasuk = null;
    var absenMasuk = null;
    var cepatTelat = null;
    var jamPulang = null;
    var absenPulang = null;
    var psw = null;
    var libur = null;
    var jenisTugas = null;
    var ket = null;

    if (k.jenis === 'hadir') {
      jamMasuk = jam(k.woMasuk);
      absenMasuk = k.masukAbsen;
      cepatTelat = angka(k.cepat);                 // + = datang lebih awal, - = telat
      jamPulang = jam(k.woPulang);
      absenPulang = k.pulangAbsen;
      psw = angka(k.pulangMin - k.woPulang);       // + = pulang setelah wajib
    } else if (k.jenis === 'libur') {
      cepatTelat = 0;
      psw = 0;
      libur = k.libur || null;
      jenisTugas = k.jenisTugas || null;
      ket = k.keterangan || null;
    } else if (k.jenis === 'tk') {
      cepatTelat = 0;
      psw = 0;
      ket = 'Tanpa keterangan';
    } else if (k.jenis === 'noPresensi') {
      jamMasuk = jam(k.woMasuk);
      jamPulang = jam(k.woPulang);
      if (k.masukMin !== null && k.masukMin !== undefined) {
        absenMasuk = k.masukAbsen;
        cepatTelat = angka(k.woMasuk - k.masukMin);
      } else {
        cepatTelat = 0;
      }
      if (k.pulangMin !== null && k.pulangMin !== undefined) {
        absenPulang = k.pulangAbsen;
        psw = angka(k.pulangMin - k.woPulang);
      } else {
        psw = 0;
      }
      ket = 'Tidak presensi ' + (k.sisi === 'masuk' ? 'masuk' : 'pulang');
    }
    // weekend: seluruh kolom jam dan keterangan dibiarkan kosong

    return [g.nama, g.nip, g.jabatan, tanggalString(k.tanggal), hariDari(k.tanggal) || k.hari || null,
      jamMasuk, absenMasuk, cepatTelat, jamPulang, absenPulang, psw,
      libur, jenisTugas, ket, null, satker2, SATKER_3, statusPegawai(g)];
  }

  function lembarKehadiran(hasil, bidang) {
    var XLSX = pustaka();
    var kolomBidang = judulNama(bidang);
    var aoa = [
      ['REKAPITULASI KEHADIRAN PEMBIMAS ' + judulBidang(bidang)],
      ['NAMA', 'NIP', 'JABATAN', 'TANGGAL', 'HARI', 'JAM MASUK', 'ABSEN MASUK',
        'CEPAT TELAT', 'JAM PULANG', 'ABSEN PULANG', 'PSW', 'LIBUR', 'JENIS TUGAS',
        'KETERANGAN', 'KETERANGAN 2', 'SATKER_2', 'SATKER_3', 'STATUS PEGAWAI'],
    ];
    hasil.forEach(function (h) {
      var g = h.pegawai;
      var satker2 = 'Pembimbing Masyarakat ' + kolomBidang;
      (h.perDay || []).forEach(function (k) { aoa.push(barisHari(g, k, satker2)); });
    });
    var lebar = [{ wch: 9 }, null, null, { wch: 9.64 }, { wch: 6.73 }, { wch: 6.55 },
      { wch: 6.55 }, { wch: 5.73 }, { wch: 7.27 }, { wch: 7.27 }, { wch: 4.18 },
      { wch: 5.18 }, { wch: 9.09 }, null, null, null, null, { wch: 8.27 }];
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,
      lembar(aoa, lebar, { tinggi: [{ hpt: 15.5 }, { hpt: 43.5 }] }), 'Worksheet');
    return wb;
  }

  // ------------------------------------------------------------------ *
  // Tukin — judul baris 1, header baris 4, data baris 5 dst.
  // ------------------------------------------------------------------ *
  function barisTukin(h, tahun, bulan, kolomBidang) {
    var g = h.pegawai;
    var p = h.pct || {};
    var r = h.rupiahPotongan || {};
    return [String(tahun), String(bulan), g.nip, g.nama, g.gol || null, null, g.jabatan || null,
      g.kelasJabatan || null,
      angka(g.tukin),
      angka(h.tkHari), angka(p.tk),
      angka(r.tl), angka(p.tl),
      angka(r.psw), angka(p.psw),
      0, angka(p.hukdis),                       // HUKDIS (nominal diisi 0, % dari mesin)
      0, 0,                                     // CPNS
      0, 0,                                     // SKP
      0, angka(p.tb),                           // TB
      0, 0,                                     // potongan lain-lain
      angka(r.total), angka(p.total),
      angka(h.tukinBersih),
      'Pembimbing Masyarakat ' + kolomBidang, SATKER_3, statusPegawai(g)];
  }

  function lembarTukin(hasil, tahun, bulan, bidang) {
    var kolomBidang = judulNama(bidang);
    var aoa = [
      ['REKAPITULASI TUKIN PEMBIMAS ' + judulBidang(bidang)],
      [],
      [],
      ['TAHUN', 'BULAN', 'NIP', 'NAMA', 'GOL/ RUANG', 'NPWP', 'JABATAN', 'KELAS JABATAN',
        'TUKIN', 'TK JUMLAH', 'TK PERSEN', 'TL', 'TL %', 'PSW', 'PSW %', 'HUKDIS', 'HUKDIS %',
        'CPNS', 'CPNS %', 'SKP', 'SKP %', 'TB', 'TB %', 'POTONGAN LAIN-LAIN',
        'POTONGAN LAIN-LAIN %', 'TOTAL POTONGAN', 'TOTAL POTONGAN %', 'TUKIN BERSIH',
        'SATKER 2', 'SATKER 3', 'STATUS PEGAWAI'],
    ];
    hasil.forEach(function (h) { aoa.push(barisTukin(h, tahun, bulan, kolomBidang)); });
    // baris tanda tangan: dua baris kosong, lalu "Pembimas <Bidang>"
    aoa.push([]);
    aoa.push([]);
    var tandaTangan = [];
    tandaTangan[25] = 'Pembimas ' + kolomBidang;   // kolom Z (TOTAL POTONGAN)
    aoa.push(tandaTangan);

    var lebar = [{ wch: 6.45 }, { wch: 6 }, null, null, null, null, null, null,
      { wch: 13.09 }, { wch: 7.27 }, { wch: 6.73 }, { wch: 8 }, { wch: 5 }, { wch: 8 },
      { wch: 5 }, { wch: 8 }, { wch: 5 }, null, null, null, null, { wch: 8 }, { wch: 5 },
      null, null, { wch: 12 }, { wch: 6 }, { wch: 11.91 }, null, null, null];
    // berkas contoh hanya memformat TUKIN (I) dan TUKIN BERSIH (AB) sebagai rupiah
    var kolomRp = [8, 27];
    var wb = pustaka().utils.book_new();
    pustaka().utils.book_append_sheet(wb,
      lembar(aoa, lebar, { kolomRp: kolomRp, barisMulai: 4,
        tinggi: [{ hpt: 15.5 }, {}, {}, { hpt: 43.5 }] }), 'Worksheet');
    return wb;
  }

  // ------------------------------------------------------------------ *
  // Uang makan — judul baris 1, header baris 4, data baris 5 dst.
  // ------------------------------------------------------------------ *
  function barisUangMakan(h, tahun, bulan, kolomBidang) {
    var g = h.pegawai;
    var u = h.uangMakan || {};
    return [String(tahun), String(bulan), g.nip, g.nama, g.gol || null,
      angka(u.hariHadir), angka(u.bruto), angka(u.pph), angka(u.bersih),
      'Pembimbing Masyarakat ' + kolomBidang, SATKER_3, statusPegawai(g)];
  }

  function lembarUangMakan(hasil, tahun, bulan, bidang) {
    var kolomBidang = judulNama(bidang);
    var aoa = [
      ['REKAPITULASI UANG MAKAN PEMBIMAS ' + judulBidang(bidang)],
      [],
      [],
      ['TAHUN', 'BULAN', 'NIP', 'NAMA', 'GOL/ RUANG', 'HARI MASUK', 'UANG MAKAN', 'PPH',
        'JUMLAH BERSIH', 'SATKER_2', 'SATKER_3', 'STATUS PEGAWAI'],
    ];
    hasil.forEach(function (h) { aoa.push(barisUangMakan(h, tahun, bulan, kolomBidang)); });
    aoa.push([]);
    var tandaTangan = [];
    tandaTangan[8] = 'Pembimas ' + kolomBidang;    // kolom I (JUMLAH BERSIH)
    aoa.push(tandaTangan);

    var lebar = [null, null, { wch: 10.09 }, { wch: 14.73 }, null, null, { wch: 11.18 },
      { wch: 10.45 }, { wch: 10.73 }, { wch: 11.09 }, { wch: 12.18 }];
    var wb = pustaka().utils.book_new();
    pustaka().utils.book_append_sheet(wb,
      lembar(aoa, lebar, { kolomRp: [6, 7, 8], barisMulai: 4,
        tinggi: [{ hpt: 15.5 }, {}, {}, { hpt: 43.5 }] }), 'Worksheet');
    return wb;
  }

  // ------------------------------------------------------------------ *
  // API utama — bentuk hasil sama dengan TukinTool.susunWorkbookBidang
  // ------------------------------------------------------------------ *
  function susunWorkbookBidang(hasilBidang, tahun, bulan, status) {
    if (!hasilBidang || !hasilBidang.length) return null;
    var bidang = hasilBidang[0].pegawai.bidang;
    status = status || statusPegawai(hasilBidang[0].pegawai);
    var label = LABEL_BULAN[bulan] || ('BULAN-' + bulan);
    var akhiran = akhiranStatus(status);

    return {
      bidang: bidang,
      status: status,
      label: label,
      fileKehadiran: 'Rekapitulasi Kehadiran Bimas ' + bidang + akhiran + ' ' + label + '.xlsx',
      fileTukin: 'Rekapitulasi Tukin Bimas ' + bidang + akhiran + ' ' + label + '.xlsx',
      fileUangMakan: 'Rekapitulasi Uang Makan Bimas ' + bidang + akhiran + ' ' + label + '.xlsx',
      wbKehadiran: lembarKehadiran(hasilBidang, bidang),
      wbTukin: lembarTukin(hasilBidang, tahun, bulan, bidang),
      wbUangMakan: lembarUangMakan(hasilBidang, tahun, bulan, bidang),
    };
  }

  return {
    susunWorkbookBidang: susunWorkbookBidang,
    barisHari: barisHari,
    barisTukin: barisTukin,
    barisUangMakan: barisUangMakan,
    judulNama: judulNama,
    NAMA_BULAN: NAMA_BULAN,
  };
});
