/*
 * Tool Tukin & Uang Makan Bimas PPPK + PNS (KRISTEN / KATOLIK / BUDDHA)
 * =====================================================================
 * Dipakai di browser (dobel-klik index.html, offline, tanpa server)
 * dan di Node (uji-app.js) — UMD style.
 *
 * DASAR HUKUM POTONGAN TUKIN
 *   Peraturan Menteri Agama (PMA) Nomor 11 Tahun 2019
 *   tentang Pemberian, Pengurangan, dan Penghentian Tunjangan Kinerja
 *   Pegawai pada Kementerian Agama.
 *
 *   Pasal 8 Ayat (1):
 *     Pegawai yang tidak masuk kerja tanpa alasan yang sah
 *     (tanpa keterangan) dikenakan pengurangan/pemotongan tunjangan
 *     kinerja sebesar 3% (tiga persen) untuk setiap 1 (satu) hari
 *     tidak masuk kerja.
 *
 * Aturan potongan (PMA 11/2019):
 *  - TK = tidak masuk kerja tanpa keterangan (Pasal 8 Ayat (1)) : 3% / hari
 *  - Tidak di tempat tugas               : 2% / hari (via HUKDIS/TB manual UI)
 *  - Tidak presensi masuk ATAU pulang    : 1,5% / kejadian
 *  - Telat (TL) & Pulang Sebelum Waktu (PSW), /kejadian:
 *      1-29 menit  : 0,5%   30-60 menit : 1%
 *      61-89 menit : 1,25%  >=90 menit  : 1,5%
 *  - Total potongan dibatasi maksimal 100% / bulan
 *  - Denda hanya hari kerja (Senin-Jumat); Sabtu/Minggu diabaikan
 *
 * Uang makan = tarif/hari x jumlah hari kerja yang punya minimal satu presensi
 * (masuk atau pulang) yang valid; cuti/DL/TK tidak dihitung. PPH 5% — pegawai
 * dengan tarif khusus 35.000 tidak kena PPH.
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(root.XLSX);
  } else {
    root.TukinTool = factory(root.XLSX);
  }
})(typeof self !== 'undefined' ? self : this, function (XLSX) {
  'use strict';

  // di Node, XLSX bisa di-set belakangan lewat global (global.XLSX = ...)
  XLSX = XLSX || (typeof globalThis !== 'undefined' ? globalThis.XLSX : undefined);

  /* ------------------------------------------------------------------ *
   * Konstanta & aturan
   * ------------------------------------------------------------------ */
  var JAM_MASUK_WAJIB_MIN = 8 * 60;      // 08:00
  var PULANG_16_30 = 16 * 60 + 30;       // 16:30
  var PULANG_JUMAT = 17 * 60;            // 17:00

  var NAMA_BULAN = ['', 'JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI',
    'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER'];
  var LABEL_BULAN = ['', 'JAN', 'FEB', 'MAR', 'APR', 'MEI', 'JUN', 'JUL', 'AGUS',
    'SEPT', 'OKT', 'NOV', 'DES'];

  var SATKER_3 = 'Kanwil Kementerian Agama Provinsi Aceh';

  // status pegawai per orang: 'PPPK' (roster lama) atau 'PNS' (roster baru).
  // Rumus potongan sama; yang berbeda hanya tukin (pangkat/golongan) dan PPH uang makan.
  function statusPegawai(g) { return (g && g.status) || 'PPPK'; }
  // akhiran nama file: PPPK tetap seperti dulu (tanpa akhiran), PNS ditandai " PNS"
  function akhiranStatus(status) { return status === 'PPPK' ? '' : ' ' + status; }

  var DASH_RP = ' Rp-   ';

  /* ------------------------------------------------------------------ *
   * Util umum
   * ------------------------------------------------------------------ */
  function namaKey(nama) {
    // kata pertama dari nama lengkap, huruf besar, tanpa tanda baca
    var first = String(nama || '').trim().split(/\s+/)[0] || '';
    return first.toUpperCase().replace(/[^A-Z]/g, '');
  }

  function parseNamaFile(fileName) {
    // contoh: "ARDI_Presensi 9-2026.xlsx"
    var m = /^(.+?)\s*_\s*[Pp]resensi\s+(\d{1,2})-(\d{4})\.xlsx$/i.exec(fileName);
    if (!m) return null;
    return {
      namaKey: m[1].trim().toUpperCase(),
      bulan: parseInt(m[2], 10),
      tahun: parseInt(m[3], 10)
    };
  }

  // "07:21" -> 441 | "16:30" -> 990 | "17:0" -> 1020 | angka 480/990 (menit-jam) | "-" -> null
  function parseTime(v) {
    if (v === null || v === undefined) return null;
    if (typeof v === 'number') {
      if (!isFinite(v) || v < 0 || v >= 1440) return null; // -990 dst -> anomali -> null
      return Math.round(v);
    }
    var s = String(v).trim();
    if (!s || s === '-' || s === '--') return null;
    var m = /^(\d{1,2})[.:\s](\d{1,2})(?::\d{1,2})?$/.exec(s);
    if (m) {
      var h = parseInt(m[1], 10), mi = parseInt(m[2], 10);
      if (h <= 23 && mi < 60) return h * 60 + mi;
    }
    return null;
  }

  function parseTanggal(v) { // "2026-09-01" / "2026-9-01 00:00:00"
    var m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(String(v == null ? '' : v).trim());
    if (!m) return null;
    return { y: +m[1], mo: +m[2], d: +m[3] };
  }

  function dowHari(t) { return new Date(t.y, t.mo - 1, t.d).getDay(); }
  function isJumat(t) { return dowHari(t) === 5; }
  function hariKerja(t) { return dowHari(t) >= 1 && dowHari(t) <= 5; }

  // format jam ala manual kehadiran: "8:0", "16:30", "17:0", "7:21"
  function fmtJam(m) {
    if (m === null || m === undefined) return '';
    var h = Math.floor(m / 60), mm = m % 60;
    return h + ':' + (mm === 0 ? '0' : String(mm).padStart(2, '0'));
  }
  // tanggal ala manual kehadiran: "2026-9-01 00:00:00" (bulan tak nol, tanggal nol)
  function fmtTanggalManual(t) {
    return t.y + '-' + t.mo + '-' + String(t.d).padStart(2, '0') + ' 00:00:00';
  }

  // rupiah ala manual: " Rp3,319,000 " ; nol -> " Rp-   "
  function rupiahString(n) {
    n = Math.round(n || 0);
    if (!n) return DASH_RP;
    return ' Rp' + n.toLocaleString('en-US') + ' ';
  }
  // persen ala manual: "0.5"
  function persenString(p) {
    return String(Math.round((p || 0) * 1000) / 1000);
  }

  /* ------------------------------------------------------------------ *
   * Tangga potongan TL / PSW (persen dari tukin)
   * ------------------------------------------------------------------ */
  function tanggaPersen(menit) {
    if (menit === null || menit === undefined) return 1.5; // tidak absen
    if (menit <= 29) return 0.5;
    if (menit <= 60) return 1;
    if (menit <= 89) return 1.25;
    return 1.5;
  }

  var RE_DINAS_LUAR = /dinas\s*luar/i;

  /* ------------------------------------------------------------------ *
   * 1. Parse isi file presensi (unduhan absensi.kemenag.go.id)
   * ------------------------------------------------------------------ */
  function bacaSheetPresensi(arrayOrBinary) {
    var wb = XLSX.read(arrayOrBinary, {
      type: typeof arrayOrBinary === 'string' ? 'binary' : 'array'
    });
    var sn = wb.SheetNames[0];
    var rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: null });
    var hIdx = -1;
    for (var i = 0; i < Math.min(rows.length, 10); i++) {
      var r0 = (rows[i] || []).map(function (c) { return String(c == null ? '' : c).toUpperCase(); });
      if (r0.indexOf('TANGGAL') >= 0 && r0.indexOf('JAM MASUK') >= 0) { hIdx = i; break; }
    }
    if (hIdx < 0) throw new Error('Header TANGGAL/JAM MASUK tidak ditemukan — ini bukan file presensi unduhan?');
    var H = { tanggal: 0, hari: 1, masuk: 2, pulang: 3, alasan: 4, deskripsi: 5 };
    var data = [];
    for (var j = hIdx + 1; j < rows.length; j++) {
      var r = rows[j] || [];
      var t = parseTanggal(r[H.tanggal]);
      if (!t) continue;
      data.push({
        tanggal: t,
        hari: String(r[H.hari] == null ? '' : r[H.hari]).trim(),
        masuk: parseTime(r[H.masuk]),
        pulang: parseTime(r[H.pulang]),
        alasan: String(r[H.alasan] == null ? '' : r[H.alasan]).trim(),
        deskripsi: String(r[H.deskripsi] == null ? '' : r[H.deskripsi]).trim()
      });
    }
    if (!data.length) throw new Error('Tidak ada baris tanggal di file presensi');
    return data;
  }

  /* ------------------------------------------------------------------ *
   * 2. Klasifikasi satu hari kerja
   * ------------------------------------------------------------------ */
  function klasifikasiHari(row) {
    var t = row.tanggal;
    if (!hariKerja(t)) return { jenis: 'weekend' };
    var jumat = isJumat(t);
    var woMasuk = JAM_MASUK_WAJIB_MIN;
    var woPulang = jumat ? PULANG_JUMAT : PULANG_16_30;

    if (row.alasan) {
      var dl = RE_DINAS_LUAR.test(row.alasan);
      return {
        jenis: 'libur', sub: row.alasan,
        libur: dl ? '' : row.alasan,          // Cuti/Sakit dll -> kolom LIBUR
        jenisTugas: dl ? row.alasan : '',     // Dinas Luar -> kolom JENIS TUGAS
        keterangan: row.deskripsi,
        woMasuk: woMasuk, woPulang: woPulang
      };
    }
    if (row.masuk === null && row.pulang === null) {
      return { jenis: 'tk', woMasuk: woMasuk, woPulang: woPulang };
    }
    // Presensi masuk dan pulang dibaca terpisah: jam yang valid tetap dibawa
    // ke hasil klasifikasi walau sisi lainnya kosong, supaya tidak hilang dari
    // laporan kehadiran. Potongan Tukin tetap 1,5% untuk sisi yang tidak direkam.
    if (row.masuk === null) {
      return {
        jenis: 'noPresensi', sisi: 'masuk', pct: tanggaPersen(null),
        pulangMin: row.pulang, pulangAbsen: fmtJam(row.pulang),
        woMasuk: woMasuk, woPulang: woPulang
      };
    }
    if (row.pulang === null) {
      // anomali umum: tidak rekam kepulangan -> 1,5% (ditandai untuk konfirmasi user)
      return {
        jenis: 'noPresensi', sisi: 'pulang', pct: tanggaPersen(null), anomali: true,
        masukMin: row.masuk, masukAbsen: fmtJam(row.masuk),
        woMasuk: woMasuk, woPulang: woPulang
      };
    }
    // hadir
    var telat = row.masuk - woMasuk;        // >0 = telat (menit)
    var pswAwal = woPulang - row.pulang;    // >0 = pulang lebih awal (menit)
    var out = {
      jenis: 'hadir',
      masukMin: row.masuk, pulangMin: row.pulang,
      masukAbsen: fmtJam(row.masuk), pulangAbsen: fmtJam(row.pulang),
      cepat: telat < 0 ? -telat : 0,
      telat: telat > 0 ? telat : 0,
      pswAwal: pswAwal > 0 ? pswAwal : 0,
      woMasuk: woMasuk, woPulang: woPulang
    };
    if (out.telat) out.telatPct = tanggaPersen(out.telat);
    if (out.pswAwal) {
      out.pswPct = tanggaPersen(out.pswAwal);
      out.anomali = out.pswAwal > 240; // pulang sangat awal -> cek manual
    }
    return out;
  }

  /* ------------------------------------------------------------------ *
   * 3. Proses satu orang
   * ------------------------------------------------------------------ */
  function prosesSatuOrang(pegawai, rowsPresensi, manual) {
    manual = manual || {};
    var perDay = [];
    var hariMasuk = 0, tkHari = 0;
    // dasar uang makan dipisah dari hariMasuk (yang tetap = presensi lengkap):
    // hari kerja dengan minimal satu presensi masuk/pulang yang valid.
    var hariHadirUangMakan = 0;
    var liburList = [], tkList = [], telatList = [], pswList = [], noPresensiList = [], anomaliList = [];

    rowsPresensi.forEach(function (row) {
      var k = klasifikasiHari(row);
      k.tanggal = row.tanggal;
      k.hari = row.hari;
      perDay.push(k);
      // Sabtu/Minggu tetap ditulis di rekap kehadiran (jam dikosongkan),
      // tapi tidak dihitung sebagai hari masuk / libur / TK
      if (k.jenis === 'weekend') return;
      if (k.jenis === 'hadir') { hariMasuk++; hariHadirUangMakan++; if (k.anomali) anomaliList.push(k); }
      if (k.jenis === 'libur') liburList.push(k);
      if (k.jenis === 'tk') { tkHari++; tkList.push(k); }
      if (k.jenis === 'noPresensi') {
        noPresensiList.push(k);
        hariHadirUangMakan++;
        if (k.anomali) anomaliList.push(k);
      }
      if (k.jenis === 'hadir') {
        if (k.telat) telatList.push(k);
        if (k.pswAwal) pswList.push(k);
      }
    });

    // persen TL & PSW ala kolom manual:
    //  TL kolom  = telat + tidak presensi MASUK
    //  PSW kolom = pulang lebih awal + tidak presensi PULANG
    var pctTelat = telatList.reduce(function (s, k) { return s + (k.telatPct || 0); }, 0);
    var pctPswAwal = pswList.reduce(function (s, k) { return s + (k.pswPct || 0); }, 0);
    var evMasuk = noPresensiList.filter(function (k) { return k.sisi === 'masuk'; })
      .reduce(function (s, k) { return s + 1.5; }, 0);
    var evPulang = noPresensiList.filter(function (k) { return k.sisi === 'pulang'; })
      .reduce(function (s, k) { return s + 1.5; }, 0);

    var hukdisPct = num(manual.hukdisPct);
    var tbPct = num(manual.tbPct);
    var pctTK = tkHari * 3;

    var pct = {
      tk: pctTK,
      tl: pctTelat + evMasuk,
      psw: pctPswAwal + evPulang,
      hukdis: hukdisPct,
      tb: tbPct
    };
    var totalMentah = pct.tk + pct.tl + pct.psw + pct.hukdis + pct.tb;
    var capped = totalMentah > 100;
    var totalPct = Math.min(totalMentah, 100);
    pct.total = totalPct;

    var tukin = pegawai.tukin;
    function rupiah(p) { return Math.round(tukin * p / 100); }

    // uang makan: dihitung dari hariHadirUangMakan (bukan hariMasuk),
    // karena satu sisi presensi yang valid sudah cukup.
    var tarif = pegawai.tarifUangMakan || 37000;
    var uangMakanBruto = hariHadirUangMakan * tarif;
    // PPH uang makan per orang: PNS golongan IV 15%, golongan III / PPPK 5%,
    // tarif khusus 35.000 (mis. Marliana Katolik) tanpa PPH.
    var pphPct = pegawai.pphPct != null ? pegawai.pphPct : (tarif === 35000 ? 0 : 5);
    var pph = Math.round(uangMakanBruto * pphPct / 100);

    return {
      pegawai: pegawai,
      perDay: perDay,
      liburList: liburList, tkList: tkList,
      telatList: telatList, pswList: pswList, noPresensiList: noPresensiList,
      anomaliList: anomaliList,
      hariMasuk: hariMasuk,
      hariHadirUangMakan: hariHadirUangMakan,
      tkHari: tkHari,
      pct: pct,
      rupiahPotongan: {
        tk: rupiah(pct.tk), tl: rupiah(pct.tl), psw: rupiah(pct.psw),
        total: rupiah(totalPct)
      },
      tukinBersih: tukin - rupiah(totalPct),
      uangMakan: {
        tarif: tarif, hariHadir: hariHadirUangMakan, pphPct: pphPct,
        bruto: uangMakanBruto, pph: pph, bersih: uangMakanBruto - pph
      }
    };
  }

  function num(v) {
    var n = parseFloat(v);
    return isFinite(n) && n > 0 ? n : 0;
  }

  /* ------------------------------------------------------------------ *
   * 4. Export Excel — struktur meniru file manual
   * ------------------------------------------------------------------ */
  function aoaToSheet(aoa) { return XLSX.utils.aoa_to_sheet(aoa); }

  function barisTukin(no, h, tahun, bulan) {
    var g = h.pegawai;
    var p = h.pct, r = h.rupiahPotongan;
    return [String(no), tahun, bulan, g.nip, g.nama,
      g.gol, g.jabatan, g.kelasJabatan, rupiahString(g.tukin),
      String(h.tkHari), persenString(p.tk),
      r.tl ? rupiahString(r.tl) : DASH_RP, persenString(p.tl),
      r.psw ? rupiahString(r.psw) : DASH_RP, persenString(p.psw),
      DASH_RP, '0', DASH_RP, '0', DASH_RP, '0',
      DASH_RP, '0', DASH_RP, '0',
      r.total ? rupiahString(r.total) : DASH_RP, persenString(p.total),
      rupiahString(h.tukinBersih),
      g.satker2, SATKER_3, statusPegawai(g)];
  }

  function ikat(out, fungsi, args) { return fungsi.apply(null, args); }

  function metaDariPegawai(h, bidang, tahun, bulan) {
    var g = h.pegawai;
    return {
      tahun: tahun, bulan: bulan, nip: g.nip, nama: g.nama,
      gol: g.gol, jabatan: g.jabatan, kelasJabatan: g.kelasJabatan,
      tukin: g.tukin, satker2: 'Pembimbing Masyarakat ' + bidang
    };
  }

  function lembarTukin(hasil, tahun, bulan, bidang, status) {
    status = status || 'PPPK';
    var aoa = [];
    aoa.push(['REKAPITULASI TUKIN ' + status + ' BIMAS ' + bidang]);
    aoa.push([]);
    aoa.push(['NO', 'TAHUN', 'BULAN', 'NIP', 'NAMA', 'GOL/ RUANG', 'JABATAN',
      'KELAS JABATAN', 'TUKIN', 'TK JUMLAH', 'TK %', 'TL', 'TL %', 'PSW', 'PSW %',
      'HUKDIS', 'HUKDIS %', 'CPNS', 'CPNS %', 'SKP', 'SKP %', 'TB', 'TB %',
      'POTONGAN LAIN-LAIN', 'POTONGAN LAIN-LAIN %', 'TOTAL POTONGAN', 'TOTAL POTONGAN %',
      'TUKIN BERSIH', 'SATKER 2', 'SATKER 3', 'STATUS PEGAWAI']);
    hasil.forEach(function (h, i) {
      aoa.push(barisTukin(i + 1, h, tahun, bulan));
    });
    return aoaToSheet(aoa);
  }

  function lembarUangMakan(hasil, tahun, bulan, bidang, status) {
    status = status || 'PPPK';
    var aoa = [];
    aoa.push(['', 'REKAPITULASI UANG MAKAN ' + status + ' BIMAS ' + bidang]);
    aoa.push([]);
    aoa.push(['NO', 'TAHUN', 'BULAN', 'NIP', 'NAMA', 'GOL/ RUANG', 'HARI MASUK',
      'UANG MAKAN', 'PPH', 'JUMLAH BERSIH', 'SATKER_2', 'SATKER_3', 'STATUS PEGAWAI']);
    hasil.forEach(function (h, i) {
      var g = h.pegawai, u = h.uangMakan;
      var m = metaDariPegawai(h, bidang, tahun, bulan);
      aoa.push([String(i + 1), m.tahun, m.bulan, m.nip, m.nama, m.gol,
        String(u.hariHadir), rupiahString(u.bruto),
        u.pph ? rupiahString(u.pph) : DASH_RP,
        rupiahString(u.bersih), m.satker2, SATKER_3, statusPegawai(g)]);
    });
    // tarif PPH yang berlaku di berkas ini (PPPK 5%, PNS golongan IV 15%)
    var pphBerlaku = 5;
    hasil.forEach(function (h) { pphBerlaku = Math.max(pphBerlaku, h.uangMakan.pphPct); });
    aoa.push([]);
    aoa.push(['PAJAK UANG MAKAN', '', pphBerlaku + '%']);
    return aoaToSheet(aoa);
  }

  function lembarKehadiran(hasil, bidang, status) {
    status = status || 'PPPK';
    var wb = XLSX.utils.book_new();
    var daftar = [['NO', 'NAMA', 'NIP', 'NIK']];
    hasil.forEach(function (h, i) { daftar.push([String(i + 1), h.pegawai.nama, h.pegawai.nip, '']); });
    XLSX.utils.book_append_sheet(wb, aoaToSheet(daftar), 'DATA PENYULUH');

    hasil.forEach(function (h) {
      var g = h.pegawai;
      // nama sheet = kata nama pegawai (dari roster, supaya "Dr. SAMAREL ..." tetap "SAMAREL")
      var namaSheet = unikSheetName(wb, g.namaKey || namaKey(g.nama) || g.nama.slice(0, 10));
      var aoa = [
        ['REKAPITULASI KEHADIRAN BIMAS ' + bidang + ' ' + status],
        ['NAMA', 'NIP', 'JABATAN', 'TANGGAL', 'HARI', 'JAM MASUK', 'ABSEN MASUK',
          'CEPAT TELAT', 'JAM PULANG', 'ABSEN PULANG', 'PSW', 'LIBUR', 'JENIS TUGAS',
          'KETERANGAN', 'SATKER_2', 'SATKER_3', 'STATUS PEGAWAI']
      ];
      h.perDay.forEach(function (k) { aoa.push(barisKehadiran(g, k)); });
      XLSX.utils.book_append_sheet(wb, aoaToSheet(aoa), namaSheet);
    });
    return wb;
  }

  function barisKehadiran(g, k) {
    var woM = fmtJam(k.woMasuk), woP = fmtJam(k.woPulang);
    var jamMasuk = '', absenMasuk = '', cepatTelat = '', jamPulang = '', absenPulang = '', psw = '';
    var libur = '', jenisTugas = '', ket = k.keterangan || '';

    if (k.jenis === 'hadir') {
      jamMasuk = woM; absenMasuk = k.masukAbsen;
      cepatTelat = String(k.woMasuk - k.masukMin); // + = datang lebih awal, - = telat
      jamPulang = woP; absenPulang = k.pulangAbsen;
      psw = String(k.pulangMin - k.woPulang);      // + = pulang setelah wajib
      if (k.telat) ket = (ket ? ket + '; ' : '') + 'TELAT ' + k.telat + ' MENIT';
      if (k.pswAwal) ket = (ket ? ket + '; ' : '') + 'PULANG LEBIH AWAL ' + k.pswAwal + ' MENIT';
    } else if (k.jenis === 'libur') {
      jamMasuk = woM; absenMasuk = '-'; jamPulang = woP; absenPulang = '-';
      libur = k.libur; jenisTugas = k.jenisTugas;
    } else if (k.jenis === 'tk') {
      jamMasuk = woM; absenMasuk = '-'; jamPulang = woP; absenPulang = '-';
      ket = 'TK (TANPA KETERANGAN — PMA 11/2019 Pasal 8 ay.1, POTONGAN 3%*/HARI)';
    } else if (k.jenis === 'weekend') {
      jamMasuk = '-'; absenMasuk = '-'; jamPulang = '-'; absenPulang = '-';
    } else if (k.jenis === 'noPresensi') {
      jamMasuk = woM; jamPulang = woP;
      // tampilkan sisi yang benar-benar terekam di Excel; sisi yang kosong = '-'
      if (k.masukMin !== null && k.masukMin !== undefined) {
        absenMasuk = k.masukAbsen;
        cepatTelat = String(k.woMasuk - k.masukMin); // + = datang lebih awal, - = telat
      } else {
        absenMasuk = '-';
      }
      if (k.pulangMin !== null && k.pulangMin !== undefined) {
        absenPulang = k.pulangAbsen;
        psw = String(k.pulangMin - k.woPulang);    // + = pulang setelah wajib
      } else {
        absenPulang = '-';
        psw = '-990';
      }
      ket = (ket ? ket + '; ' : '') + 'TIDAK REKAM PRESENSI ' + k.sisi.toUpperCase() + ' (POTONGAN 1,5%)';
    }

    return [g.nama, g.nip, g.jabatan, fmtTanggalManual(k.tanggal), k.hari,
      jamMasuk, absenMasuk, cepatTelat, jamPulang, absenPulang, psw,
      libur, jenisTugas, ket, g.satker2, SATKER_3, statusPegawai(g)];
  }

  function unikSheetName(wb, dasar) {
    var nama = dasar, i = 2;
    while (wb.SheetNames.indexOf(nama) >= 0) nama = dasar + ' ' + i;
    return nama;
  }

  /* ------------------------------------------------------------------ *
   * 5. Ambil file presensi langsung dari link Google Drive
   *    (dipakai tombol "Ambil dari Drive" di index.html)
   *    - folder dibaca rekursif (subfolder penyuluh ikut terbaca)
   *    - butuh KUNCI API Google + folder dibagikan "siapa saja yang punya link"
   * ------------------------------------------------------------------ */
  var POLA_PERIODE = /^(\d{1,2})-(\d{4})$/;

  // link Drive apa saja -> { id, jenis } ; jenis 'folder'|'file'|null (null = tanya Drive)
  function ambilIdDrive(link) {
    var s = String(link == null ? '' : link).trim().replace(/^<|>$/g, '');
    if (!s) return null;
    var m = /\/folders\/([-\w]{10,})/.exec(s);
    if (m) return { id: m[1], jenis: 'folder' };
    m = /\/file\/d\/([-\w]{10,})/.exec(s);
    if (m) return { id: m[1], jenis: 'file' };
    m = /[?&]id=([-\w]{10,})/.exec(s);
    if (m) return { id: m[1], jenis: null };
    m = /^([-\w]{15,})$/.exec(s);
    if (m) return { id: m[1], jenis: null };
    return null;
  }

  // teks tempelan (banyak baris) -> [{ link, id }]
  function parseDriveLinks(teks) {
    return String(teks == null ? '' : teks)
      .split(/[\r\n,;\s]+/)
      .map(function (x) { return x.trim(); })
      .filter(function (x) { return x.length > 0; })
      .map(function (x) { return { link: x, id: ambilIdDrive(x) }; });
  }

  // nama folder penyuluh -> kata nama pegawai.
  // buang bagian pengacau: nomor urut, "FIX", "SS TUKIN", "UANG MAKAN", tanda baca.
  var KATA_PENGACAU = /^(FIX|SS|S|LKB|TUKIN|TUNJANGAN|KINERJA|UANG|MAKAN|REKAP|REKAPITULASI|PRESENSI|ABSENSI|TERBARU|OK|NEW|FINAL|FULL|EDIT|BARU)$/i;
  function namaDariFolder(namaFolder) {
    var kata = String(namaFolder == null ? '' : namaFolder).split(/[\s_.\-()&,]+/).filter(function (x) { return x.length > 0; });
    for (var i = 0; i < kata.length; i++) {
      var k = kata[i].replace(/[^A-Za-z]/g, '');
      if (k.length >= 3 && !KATA_PENGACAU.test(k)) return k.toUpperCase();
    }
    return '';
  }

  // apakah teks (nama file + jalur folder) menyebut bulan & tahun tertentu?
  // dipakai untuk menyaring arsip besar (mis. link folder induk semua bulan).
  function cocokPeriodeDrive(teks, bulan, tahun) {
    var s = String(teks == null ? '' : teks).toUpperCase();
    var th = String(tahun == null ? '' : tahun);
    var reBulan = new RegExp('(?:^|[^A-Z])' + NAMA_BULAN[bulan] + '(?:[^A-Z]|$)');
    var reSingkat = new RegExp('(?:^|[^A-Z])' + LABEL_BULAN[bulan] + '(?:[^A-Z]|$)');
    var reAngka = new RegExp('(?:^|\\D)0?' + bulan + '\\s*[-_. ]\\s*' + th + '(?:\\D|$)');
    if (!reBulan.test(s) && !reSingkat.test(s) && !reAngka.test(s)) return false;
    var tahunLain = s.match(/\b(20\d{2})\b/g) || [];
    return s.indexOf(th) >= 0 || tahunLain.length === 0;
  }

  // nama file dari Drive: pakai nama aslinya kalau sudah berpola
  // ("ARDI_Presensi 9-2026.xlsx"); kalau tidak, gabungkan nama folder penyuluh
  // dengan bulan-tahun dari nama file ("Presensi 9-2026.xlsx" -> "MAYANI_Presensi 9-2026.xlsx").
  function namaFileDrive(file, periode) {
    var nama = String((file && (file.name || file.nama)) || 'presensi.xlsx').replace(/[\\/:*?"<>|]/g, ' ').trim();
    if (parseNamaFile(nama)) return nama;
    var induk = namaDariFolder(file && file.folder) || namaKey((file && file.folder) || '');
    // bulan-tahun: dari nama file, kalau tidak ada dari JALUR folder Drive
    // (mis. "... / 1. 2026 / 9. SEPTEMBER / ELIYANI BR GINTING fix"), karena banyak
    // file penyuluh dinamai bebas ("Presensi Septemeber 2026 Eliyani Ginting.xlsx").
    var bulanTahun = periodeDariNama(nama) ||
      periodeDariJalur((file && file.jalur ? file.jalur + ' / ' : '') + nama);
    if (!bulanTahun) {
      var p = String(periode == null ? '' : periode).trim();
      if (POLA_PERIODE.test(p)) bulanTahun = (+p.split('-')[0]) + '-' + p.split('-')[1];
    }
    if (induk && bulanTahun) return induk + '_Presensi ' + bulanTahun + '.xlsx';
    return nama;
  }

  // cari "9-2026" / "9_2026" / "09 2026" di dalam nama file -> "9-2026"
  function periodeDariNama(nama) {
    var m = /(?:^|\D)(\d{1,2})\s*[-_ ]\s*(\d{4})(?:\D|$)/.exec(String(nama || ''));
    if (!m) return null;
    var b = parseInt(m[1], 10);
    if (b < 1 || b > 12) return null;
    return b + '-' + m[2];
  }

  // tahun (20xx) yang paling dekat dengan posisi bulan di dalam teks
  function tahunTerdekat(teks, posisi) {
    var s = String(teks || '');
    var re = /\b20\d{2}\b/g, t, terbaik = null, jarak = Infinity;
    while ((t = re.exec(s))) {
      var d = Math.abs(t.index - posisi);
      if (d < jarak) { jarak = d; terbaik = t[0]; }
    }
    return terbaik;
  }

  // baca bulan-tahun dari NAMA FILE atau JALUR folder Drive -> "9-2026"
  // bentuk yang dikenali: "9-2026", "6_2026", "9. SEPTEMBER 2026", "5.MEI / 1. 2026",
  // "2025 / DES", "Oktober 2026", bahkan salah ketik "Septemeber" (4 huruf pertama).
  function periodeDariJalur(teks) {
    var s = String(teks == null ? '' : teks).toUpperCase();
    // 1. bentuk angka; titik sengaja TIDAK dipakai karena folder tahun bernama "1. 2026"
    var m = /(?:^|\D)(\d{1,2})\s*[-_]\s*(20\d{2})(?:\D|$)/.exec(s);
    if (m) {
      var bAngka = parseInt(m[1], 10);
      if (bAngka >= 1 && bAngka <= 12) return bAngka + '-' + m[2];
    }
    // 2. nama bulan (4 huruf pertama, atau singkatan JAN/FEB/DES) yang paling awal
    //    muncul, lalu tahun terdekat
    var bulan = null, posisi = -1;
    for (var b = 1; b <= 12; b++) {
      var bentuk = String(NAMA_BULAN[b]).slice(0, 4);
      var singkat = String(LABEL_BULAN[b] || '');
      var pola = bentuk + '[A-Z]*' + (singkat && singkat !== bentuk ? '|' + singkat : '');
      var mm = new RegExp('(?:^|[^A-Z])(' + pola + ')(?:[^A-Z]|$)').exec(s);
      if (!mm) continue;
      if (bulan === null || mm.index < posisi) { bulan = b; posisi = mm.index; }
    }
    if (bulan === null) return null;
    var tahun = tahunTerdekat(s, posisi);
    return tahun ? bulan + '-' + tahun : null;
  }

  /* ------------------------------------------------------------------ *
   * 6. API utama
   * ------------------------------------------------------------------ */
  function susunWorkbookBidang(hasilBidang, tahun, bulan, status) {
    if (!hasilBidang || !hasilBidang.length) return null;
    var bidang = hasilBidang[0].pegawai.bidang;
    status = status || statusPegawai(hasilBidang[0].pegawai);
    var label = LABEL_BULAN[bulan] || ('BULAN-' + bulan);
    var akhiran = akhiranStatus(status); // PPPK: "" ; PNS: " PNS"

    var wbTukin = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wbTukin, lembarTukin(hasilBidang, tahun, bulan, bidang, status), 'TUKIN ' + status);

    var wbUangMakan = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wbUangMakan, lembarUangMakan(hasilBidang, tahun, bulan, bidang, status), 'UANG MAKAN');

    var wbKehadiran = lembarKehadiran(hasilBidang, bidang, status);

    return {
      bidang: bidang,
      status: status,
      label: label,
      fileKehadiran: 'Rekapitulasi Kehadiran Bimas ' + bidang + akhiran + ' ' + label + '.xlsx',
      fileTukin: 'Rekapitulasi Tukin Bimas ' + bidang + akhiran + ' ' + label + '.xlsx',
      fileUangMakan: 'Rekapitulasi Uang Makan Bimas ' + bidang + akhiran + ' ' + label + '.xlsx',
      wbKehadiran: wbKehadiran, wbTukin: wbTukin, wbUangMakan: wbUangMakan
    };
  }

  var api = {
    namaKey: namaKey,
    statusPegawai: statusPegawai,
    akhiranStatus: akhiranStatus,
    parseNamaFile: parseNamaFile,
    parseTime: parseTime,
    parseTanggal: parseTanggal,
    bacaSheetPresensi: bacaSheetPresensi,
    klasifikasiHari: klasifikasiHari,
    prosesSatuOrang: prosesSatuOrang,
    tanggaPersen: tanggaPersen,
    rupiahString: rupiahString,
    persenString: persenString,
    fmtJam: fmtJam,
    fmtTanggalManual: fmtTanggalManual,
    barisTukin: barisTukin,
    lembarTukin: lembarTukin,
    lembarUangMakan: lembarUangMakan,
    lembarKehadiran: lembarKehadiran,
    barisKehadiran: barisKehadiran,
    unikSheetName: unikSheetName,
    susunWorkbookBidang: susunWorkbookBidang,
    ambilIdDrive: ambilIdDrive,
    parseDriveLinks: parseDriveLinks,
    namaFileDrive: namaFileDrive,
    namaDariFolder: namaDariFolder,
    cocokPeriodeDrive: cocokPeriodeDrive,
    periodeDariNama: periodeDariNama,
    periodeDariJalur: periodeDariJalur,
    LABEL_BULAN: LABEL_BULAN,
    NAMA_BULAN: NAMA_BULAN
  };
  return api;
});
