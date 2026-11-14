// rekap-pdf.js — PDF A4 ringkas rekap presensi, tukin, dan uang makan.
//
// Satu bulan = satu blok pendek berisi:
//   Kehadiran  : jumlah hadir + tanggal telat / pulang awal / tanpa absen /
//                tanpa keterangan / cuti / sakit / dinas luar / izin
//   Tukin      : bruto, potongan (dan rinciannya), bersih
//   Uang makan : hari hadir x tarif, PPh, bersih
//
// Dibutuhkan: /lib/pdf.js (window.PDF) sudah dimuat lebih dulu.

(function (root) {
  'use strict';

  var BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli',
    'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  var HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', "Jum'at", 'Sabtu'];
  var HARI_SINGKAT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

  var NAVY = '#12306e';
  var BIRU = '#1d4ed8';
  var ABU = '#64748b';
  var GARIS = '#d7e0ee';

  function angka(n) {
    var v = Number(n);
    return isFinite(v) ? v : 0;
  }

  function rupiah(n) {
    return 'Rp' + Math.round(angka(n)).toLocaleString('id-ID');
  }

  function persen(n) {
    var v = Math.round(angka(n) * 100) / 100;
    return String(v).replace('.', ',') + '%';
  }

  function satu(v) { return Array.isArray(v) ? v[0] : v; }

  function tanggalPanjang(iso) {
    var c = String(iso || '').split('-');
    if (c.length !== 3) return String(iso || '-');
    var d = new Date(Number(c[0]), Number(c[1]) - 1, Number(c[2]));
    return HARI[d.getDay()] + ', ' + Number(c[2]) + ' ' +
      (BULAN[Number(c[1]) - 1] || '') + ' ' + c[0];
  }

  // "2026-11-03" -> "Sen 3/11"
  function tanggalSingkat(iso) {
    var c = String(iso || '').split('-');
    if (c.length !== 3) return String(iso || '');
    var d = new Date(Number(c[0]), Number(c[1]) - 1, Number(c[2]));
    return HARI_SINGKAT[d.getDay()] + ' ' + Number(c[2]) + '/' + Number(c[1]);
  }

  function statusTeks(s) {
    return String(s || '-').replace(/_/g, ' ');
  }

  function unik(daftar) {
    var hasil = [];
    daftar.forEach(function (x) { if (x && hasil.indexOf(x) === -1) hasil.push(x); });
    return hasil;
  }

  function daftarTanggal(daftar) {
    var isi = unik(daftar);
    if (!isi.length) return '';
    var tampil = isi.slice(0, 8).join(', ');
    return tampil + (isi.length > 8 ? ' +' + (isi.length - 8) + ' hari' : '');
  }

  function tanggalDariPresensi(presensi) {
    var k = { telat: [], pulangAwal: [], tanpaAbsen: [], tk: [], cuti: [], sakit: [], dinas: [], izin: [] };
    (presensi || []).forEach(function (r) {
      var tgl = tanggalSingkat(r.tanggal);
      if (angka(r.menit_telat) > 0) k.telat.push(tgl);
      if (angka(r.menit_pulang_awal) > 0) k.pulangAwal.push(tgl);
      if (r.jenis === 'tidak_presensi') {
        k.tanpaAbsen.push(tgl + (r.sisi === 'masuk' ? ' masuk' : r.sisi === 'pulang' ? ' pulang' : ''));
      }
      if (r.jenis === 'tk') k.tk.push(tgl);
      if (r.jenis === 'libur' && r.libur_sub) {
        var sub = String(r.libur_sub).toLowerCase();
        if (/dinas/.test(sub)) k.dinas.push(tgl);
        else if (/sakit/.test(sub)) k.sakit.push(tgl);
        else if (/izin/.test(sub)) k.izin.push(tgl);
        else k.cuti.push(tgl);
      }
    });
    return k;
  }

  function ringkasKehadiran(kh, presensi) {
    if (!kh) return 'Rekap kehadiran belum tersedia.';
    var k = tanggalDariPresensi(presensi);
    var bagian = ['Hadir ' + angka(kh.hadir) + ' dari ' + angka(kh.hari_kerja) + ' hari kerja'];

    var potongan = [];
    if (k.telat.length) potongan.push('Telat ' + k.telat.length + ' (' + daftarTanggal(k.telat) + ')');
    if (k.pulangAwal.length) potongan.push('Pulang awal ' + k.pulangAwal.length + ' (' + daftarTanggal(k.pulangAwal) + ')');
    if (k.tanpaAbsen.length) potongan.push('Tanpa absen ' + k.tanpaAbsen.length + ' (' + daftarTanggal(k.tanpaAbsen) + ')');
    if (k.tk.length) potongan.push('Tanpa keterangan ' + k.tk.length + ' (' + daftarTanggal(k.tk) + ')');
    if (potongan.length) bagian.push(potongan.join(' · '));

    var libur = [];
    if (k.cuti.length) libur.push('Cuti ' + k.cuti.length + ' (' + daftarTanggal(k.cuti) + ')');
    if (k.sakit.length) libur.push('Sakit ' + k.sakit.length + ' (' + daftarTanggal(k.sakit) + ')');
    if (k.dinas.length) libur.push('DL ' + k.dinas.length + ' (' + daftarTanggal(k.dinas) + ')');
    if (k.izin.length || angka(kh.izin)) {
      libur.push('Izin ' + (k.izin.length || angka(kh.izin)) +
        (k.izin.length ? ' (' + daftarTanggal(k.izin) + ')' : ''));
    }
    if (libur.length) bagian.push(libur.join(' · '));
    return bagian.join(' · ');
  }

  function ringkasTukin(rt) {
    if (!rt) return 'Rekap tukin belum tersedia.';
    var pot = [];
    if (angka(rt.pot_tk)) pot.push('TK ' + rupiah(rt.pot_tk));
    if (angka(rt.pot_tl)) pot.push('telat ' + rupiah(rt.pot_tl));
    if (angka(rt.pot_psw)) pot.push('pulang awal ' + rupiah(rt.pot_psw));
    if (angka(rt.pot_hukdis)) pot.push('HUKDIS ' + rupiah(rt.pot_hukdis));
    if (angka(rt.pot_tb)) pot.push('TB ' + rupiah(rt.pot_tb));
    if (angka(rt.pot_lain)) pot.push('lain ' + rupiah(rt.pot_lain));

    var teks = 'Bruto ' + rupiah(rt.tukin_bruto);
    if (pot.length) {
      teks += ' · Potongan ' + persen(rt.total_persen) + ' = ' + rupiah(rt.total_potongan) +
        ' (' + pot.join(', ') + ')';
    } else if (angka(rt.total_potongan)) {
      teks += ' · Potongan ' + rupiah(rt.total_potongan);
    } else {
      teks += ' · tanpa potongan';
    }
    return teks + ' · Bersih ' + rupiah(rt.tukin_bersih);
  }

  function ringkasUangMakan(rm) {
    if (!rm) return 'Rekap uang makan belum tersedia.';
    var hari = angka(rm.hari_hadir);
    if (!hari) return 'Tidak ada hari hadir · Bersih ' + rupiah(rm.bersih);
    var teks = hari + ' hari x ' + rupiah(rm.tarif) + ' = ' + rupiah(rm.bruto);
    if (angka(rm.pph)) teks += ' · PPh ' + persen(rm.pph_pct) + ' ' + rupiah(rm.pph);
    return teks + ' · Bersih ' + rupiah(rm.bersih);
  }

  function identitas(pegawai, item) {
    var p = pegawai || (item && item.pegawai) || {};
    var b = p.bidang && p.bidang.nama;
    return {
      nama: p.nama || '-',
      nip: p.nip || '-',
      jabatan: p.jabatan || '-',
      gol: p.golongan ? (p.ruang ? p.golongan + '/' + p.ruang : p.golongan) : '-',
      bidang: b || '-',
      status: statusTeks(p.status_kepegawaian),
      no_wa: p.no_wa ? '+' + p.no_wa : '-',
      satker: p.satker_3 || 'Kementerian Agama Republik Indonesia'
    };
  }

  function unduh(opsi) {
    if (!root.PDF) throw new Error('Pembuat PDF belum siap');
    opsi = opsi || {};
    var items = (opsi.items || []).slice().sort(function (a, b) {
      return (angka(a.tahun) - angka(b.tahun)) || (angka(a.bulan) - angka(b.bulan));
    });
    if (!items.length) throw new Error('Tidak ada data untuk diunduh');

    var bagian = opsi.bagian || { kehadiran: true, tukin: true, uangMakan: true };
    var idn = identitas(opsi.pegawai, items[0]);
    var cetak = opsi.dicetak instanceof Date ? opsi.dicetak : new Date();

    var doc = root.PDF.baru();
    var M = 36;
    var L = doc.lebar - M * 2;
    var batas = doc.tinggi - 48;
    var y = 0;

    doc.kakiKiri = 'Tool Tukin - ' + idn.nama + ' - NIP ' + idn.nip;

    function labelPeriode(x) {
      return BULAN[angka(x.bulan) - 1] + ' ' + x.tahun;
    }

    function pastikan(tinggi) {
      if (y + tinggi <= batas) return;
      doc.halamanBaru();
      y = 42;
      doc.teks(M, 22, 'REKAP RINGKAS PRESENSI, TUKIN & UANG MAKAN', { ukuran: 8, tebal: true, warna: NAVY });
      doc.teks(M + L, 22, idn.nama + ' - NIP ' + idn.nip, { ukuran: 8, warna: ABU, rata: 'kanan' });
      doc.garis(M, 28, M + L, 28, { warna: GARIS, tebal: 0.7 });
    }

    // Bungkus teks menjadi beberapa baris agar tidak keluar batas kanan.
    function bungkus(teks, lebar, ukuran) {
      var kata = String(teks || '').split(/\s+/);
      var baris = [];
      var kini = '';
      kata.forEach(function (k) {
        var coba = kini ? kini + ' ' + k : k;
        if (doc.lebarTeks(coba, ukuran, false) > lebar && kini) {
          baris.push(kini);
          kini = k;
        } else {
          kini = coba;
        }
      });
      if (kini) baris.push(kini);
      return baris;
    }

    // Satu baris ringkas: label kiri, isi kanan (boleh beberapa baris).
    function barisRingkas(label, isi) {
      var ukuran = 8.5;
      var xIsi = M + 74;
      var lebarIsi = M + L - 8 - xIsi;
      var isiBaris = bungkus(isi, lebarIsi, ukuran);
      var tinggi = 7 + isiBaris.length * 11.5;
      pastikan(tinggi + 2);
      doc.teks(M + 6, y + 10, label, { ukuran: 8.5, tebal: true, warna: NAVY });
      isiBaris.forEach(function (b, i) {
        doc.teks(xIsi, y + 10 + i * 11.5, b, { ukuran: ukuran, warna: '#1f2937' });
      });
      y += tinggi;
      doc.garis(M, y - 2, M + L, y - 2, { warna: '#eef2f7', tebal: 0.6 });
    }

    // ---------- kop ringkas ----------
    doc.kotak(0, 0, doc.lebar, 72, { isi: BIRU });
    doc.kotak(0, 72, doc.lebar, 3, { isi: '#0f2c66' });
    doc.teks(M, 30, 'REKAP RINGKAS PRESENSI, TUKIN & UANG MAKAN', { ukuran: 14, tebal: true, warna: '#ffffff' });
    doc.teks(M, 46, idn.satker, { ukuran: 8, warna: '#dbe7ff' });
    doc.teks(M, 58, 'Tool Tukin - Sistem Informasi Tunjangan Kinerja', { ukuran: 7.5, warna: '#bfd2ff' });
    doc.teks(doc.lebar - M, 30, 'SALINAN PEGAWAI', { ukuran: 8.5, tebal: true, warna: '#ffffff', rata: 'kanan' });
    doc.teks(doc.lebar - M, 46, 'Dicetak: ' + cetak.toLocaleDateString('id-ID', {
      day: 'numeric', month: 'long', year: 'numeric'
    }), { ukuran: 7.5, warna: '#dbe7ff', rata: 'kanan' });
    doc.teks(doc.lebar - M, 58, items.length + ' bulan', { ukuran: 7.5, warna: '#bfd2ff', rata: 'kanan' });

    y = 86;
    doc.kotak(M, y, L, 74, { isi: '#f5f8ff', garis: GARIS });
    var barisId = [
      ['Nama', idn.nama], ['NIP', idn.nip],
      ['Jabatan', idn.jabatan], ['Golongan', idn.gol],
      ['Bidang', idn.bidang], ['Status', idn.status],
      ['No. HP / WA', idn.no_wa], ['Periode', items.length === 1 ? labelPeriode(items[0]) : items.length + ' bulan']
    ];
    for (var r = 0; r < 4; r++) {
      for (var c = 0; c < 2; c++) {
        var data = barisId[r + c * 4];
        if (!data) continue;
        var bx = M + 10 + c * (L / 2);
        var by = y + 15 + r * 15;
        doc.teks(bx, by, data[0], { ukuran: 7, warna: ABU });
        doc.teks(bx + 58, by, doc.potong(data[1], L / 2 - 76, 8.5, true),
          { ukuran: 8.5, tebal: true, warna: '#1f2937' });
      }
    }
    y += 86;

    // ---------- isi per bulan ----------
    items.forEach(function (item) {
      var kh = satu(item.rekap_kehadiran) || null;
      var rt = satu(item.rekap_tukin) || null;
      var rm = satu(item.rekap_uang_makan) || null;
      var perluBaris = (bagian.kehadiran ? 1 : 0) + (bagian.tukin ? 1 : 0) + (bagian.uangMakan ? 1 : 0);

      // Jaga agar satu bulan tidak terpotong di tengah bila masih muat.
      pastikan(30 + perluBaris * 22);
      doc.kotak(M, y, L, 20, { isi: '#e8efff' });
      doc.teks(M + 8, y + 13.5, 'PERIODE ' + labelPeriode(item).toUpperCase(),
        { ukuran: 9, tebal: true, warna: NAVY });
      doc.teks(M + L - 8, y + 13.5, 'Status: ' + statusTeks(item.status),
        { ukuran: 7.5, warna: '#31508f', rata: 'kanan' });
      y += 26;

      if (bagian.kehadiran) barisRingkas('Kehadiran', ringkasKehadiran(kh, item.presensi));
      if (bagian.tukin) barisRingkas('Tukin', ringkasTukin(rt));
      if (bagian.uangMakan) barisRingkas('Uang makan', ringkasUangMakan(rm));
      y += 8;
    });

    // ---------- penutup ----------
    pastikan(78);
    doc.teks(M, y, 'Catatan: potongan HUKDIS/TB diisi admin saat verifikasi. Angka diambil dari ' +
      'pengajuan yang tersimpan di sistem.', { ukuran: 7.5, warna: ABU });
    y += 12;
    doc.teks(M, y, 'Dokumen dibuat otomatis oleh Tool Tukin pada ' +
      cetak.toLocaleString('id-ID') + '.', { ukuran: 7.5, warna: ABU });
    y += 26;
    doc.garis(M + 10, y + 26, M + 200, y + 26, { warna: '#94a3b8', tebal: 0.8 });
    doc.teks(M + 10, y + 37, 'Pegawai yang bersangkutan', { ukuran: 7.5, warna: ABU });
    doc.garis(M + L - 200, y + 26, M + L - 10, y + 26, { warna: '#94a3b8', tebal: 0.8 });
    doc.teks(M + L - 10, y + 37, 'Admin Kepegawaian', { ukuran: 7.5, warna: ABU, rata: 'kanan' });

    var namaBerkas = 'Rekap ' + idn.nama.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, ' ') +
      ' - ' + (items.length === 1 ? labelPeriode(items[0]) : items.length + ' bulan') + '.pdf';
    return doc.simpan(namaBerkas);
  }

  root.RekapPDF = { unduh: unduh };
})(typeof self !== 'undefined' ? self : this);
