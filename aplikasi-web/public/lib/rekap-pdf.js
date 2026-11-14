// rekap-pdf.js — menyusun PDF A4 rekap presensi, tukin, dan uang makan
// seorang pegawai untuk satu atau beberapa bulan.
//
// Dibutuhkan: /lib/pdf.js (window.PDF) sudah dimuat lebih dulu.
// Data: baris pengajuan_tukin + rekap_* + presensi dari Supabase.

(function (root) {
  'use strict';

  var BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli',
    'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  var HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', "Jum'at", 'Sabtu'];

  var NAVY = '#12306e';
  var BIRU = '#1d4ed8';
  var ABU = '#64748b';
  var GARIS = '#d7e0ee';
  var HIJAU = '#0b6b3a';
  var MERAH = '#b42318';

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

  function statusTeks(s) {
    return String(s || '-').replace(/_/g, ' ');
  }

  function sebabPotongan(r) {
    var sebab = [];
    var telat = angka(r.menit_telat);
    var pulangAwal = angka(r.menit_pulang_awal);
    if (telat > 0) sebab.push('Terlambat masuk ' + telat + ' menit');
    if (pulangAwal > 0) sebab.push('Pulang ' + pulangAwal + ' menit lebih awal');
    if (r.jenis === 'tidak_presensi') {
      sebab.push(r.sisi === 'masuk' ? 'Tidak absen masuk'
        : r.sisi === 'pulang' ? 'Tidak absen pulang' : 'Tidak absen');
    }
    if (r.jenis === 'tk') sebab.push('Tanpa keterangan');
    if (r.libur_sub) sebab.push(String(r.libur_sub));
    return sebab;
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
    var batas = doc.tinggi - 52;
    var y = 0;

    doc.kakiKiri = 'Tool Tukin - ' + idn.nama + ' - NIP ' + idn.nip;

    function labelPeriode(x) {
      return BULAN[angka(x.bulan) - 1] + ' ' + x.tahun;
    }

    function pastikan(tinggi) {
      if (y + tinggi <= batas) return;
      doc.halamanBaru();
      y = 46;
      doc.teks(M, 22, 'REKAP PRESENSI, TUKIN & UANG MAKAN', { ukuran: 8, tebal: true, warna: NAVY });
      doc.teks(M + L, 22, idn.nama + ' - NIP ' + idn.nip, { ukuran: 8, warna: ABU, rata: 'kanan' });
      doc.garis(M, 29, M + L, 29, { warna: GARIS, tebal: 0.7 });
    }

    function judulBagian(teks) {
      pastikan(32);
      doc.teks(M, y, teks, { ukuran: 10, tebal: true, warna: NAVY });
      y += 7;
      doc.garis(M, y, M + L, y, { warna: GARIS, tebal: 0.8 });
      y += 16;
    }

    function statistik(daftar) {
      var perBaris = 4;
      var gap = 8;
      var w = (L - gap * (perBaris - 1)) / perBaris;
      var h = 42;
      for (var i = 0; i < daftar.length; i += perBaris) {
        pastikan(h + 8);
        for (var j = 0; j < perBaris; j++) {
          var d = daftar[i + j];
          if (!d) break;
          var x = M + j * (w + gap);
          doc.kotak(x, y, w, h, { isi: '#f7faff', garis: '#dbe5f5' });
          doc.teks(x + 8, y + 18, String(d[0]), { ukuran: 15, tebal: true, warna: d[2] || NAVY });
          doc.teks(x + 8, y + 31, d[1], { ukuran: 7.2, warna: ABU });
        }
        y += h + 8;
      }
    }

    function tabel(kolom, data) {
      function gambarKepala() {
        pastikan(26);
        doc.kotak(M, y, L, 20, { isi: '#eef4ff' });
        var x = M;
        kolom.forEach(function (k) {
          var kanan = k.rata === 'kanan';
          doc.teks(kanan ? x + k.w - 6 : x + 6, y + 13.5, k.judul,
            { ukuran: 8, tebal: true, warna: NAVY, rata: kanan ? 'kanan' : 'kiri' });
          x += k.w;
        });
        y += 20;
      }
      gambarKepala();
      data.forEach(function (baris, i) {
        if (y + 18 > batas) {
          doc.halamanBaru();
          y = 46;
          gambarKepala();
        }
        if (i % 2 === 1) doc.kotak(M, y, L, 18, { isi: '#fafbfe' });
        var x = M;
        baris.forEach(function (nilai, j) {
          var k = kolom[j];
          if (!k) return;
          var kanan = k.rata === 'kanan';
          doc.teks(kanan ? x + k.w - 6 : x + 6, y + 12.5,
            doc.potong(nilai, k.w - 12, 8.5, false),
            { ukuran: 8.5, rata: kanan ? 'kanan' : 'kiri' });
          x += k.w;
        });
        y += 18;
      });
      y += 6;
    }

    function kotakTotal(label, nilai) {
      pastikan(44);
      doc.kotak(M, y, L, 36, { isi: '#ecfdf5', garis: '#86efac' });
      doc.teks(M + 10, y + 23, label, { ukuran: 10, tebal: true, warna: HIJAU });
      doc.teks(M + L - 10, y + 24, nilai, { ukuran: 13, tebal: true, warna: HIJAU, rata: 'kanan' });
      y += 44;
    }

    // ---------- kop ----------
    doc.kotak(0, 0, doc.lebar, 96, { isi: BIRU });
    doc.kotak(0, 96, doc.lebar, 4, { isi: '#0f2c66' });
    doc.teks(M, 34, 'REKAP PRESENSI, TUKIN & UANG MAKAN', { ukuran: 16, tebal: true, warna: '#ffffff' });
    doc.teks(M, 52, idn.satker, { ukuran: 9, warna: '#dbe7ff' });
    doc.teks(M, 68, 'Tool Tukin - Sistem Informasi Tunjangan Kinerja', { ukuran: 8, warna: '#bfd2ff' });
    doc.teks(doc.lebar - M, 34, 'SALINAN PEGAWAI', { ukuran: 9, tebal: true, warna: '#ffffff', rata: 'kanan' });
    doc.teks(doc.lebar - M, 52, 'Dicetak: ' + cetak.toLocaleDateString('id-ID', {
      day: 'numeric', month: 'long', year: 'numeric'
    }), { ukuran: 8, warna: '#dbe7ff', rata: 'kanan' });
    doc.teks(doc.lebar - M, 66, items.length + ' bulan', { ukuran: 8, warna: '#bfd2ff', rata: 'kanan' });

    y = 116;
    doc.kotak(M, y, L, 98, { isi: '#f5f8ff', garis: GARIS });
    var barisId = [
      ['Nama', idn.nama], ['NIP', idn.nip],
      ['Jabatan', idn.jabatan], ['Golongan', idn.gol],
      ['Bidang', idn.bidang], ['Status', idn.status],
      ['No. HP / WA', idn.no_wa],
      ['Periode', items.length === 1 ? labelPeriode(items[0]) : items.length + ' bulan']
    ];
    for (var r = 0; r < 4; r++) {
      for (var c = 0; c < 2; c++) {
        var data = barisId[r + c * 4];
        if (!data) continue;
        var bx = M + 12 + c * (L / 2);
        var by = y + 16 + r * 22;
        doc.teks(bx, by, data[0], { ukuran: 7.5, warna: ABU });
        doc.teks(bx + 62, by, doc.potong(data[1], L / 2 - 82, 9, true),
          { ukuran: 9, tebal: true, warna: '#1f2937' });
      }
    }
    y += 116;

    // ---------- isi per bulan ----------
    items.forEach(function (item) {
      pastikan(54);
      doc.kotak(M, y, L, 26, { isi: '#e8efff' });
      doc.teks(M + 10, y + 17, 'PERIODE: ' + labelPeriode(item).toUpperCase(),
        { ukuran: 10.5, tebal: true, warna: NAVY });
      doc.teks(M + L - 10, y + 17, 'Status: ' + statusTeks(item.status),
        { ukuran: 8, warna: '#31508f', rata: 'kanan' });
      y += 36;

      var kh = satu(item.rekap_kehadiran) || null;
      var rt = satu(item.rekap_tukin) || null;
      var rm = satu(item.rekap_uang_makan) || null;
      var presensi = Array.isArray(item.presensi) ? item.presensi.slice() : [];
      presensi.sort(function (a, b) { return String(a.tanggal).localeCompare(String(b.tanggal)); });

      if (bagian.kehadiran) {
        judulBagian('A. REKAP KEHADIRAN');
        if (!kh) {
          doc.teks(M, y, 'Rekap kehadiran belum tersedia untuk periode ini.', { ukuran: 8.5, warna: ABU });
          y += 18;
        } else {
          statistik([
            [angka(kh.hadir) + ' hr', 'Hadir', HIJAU],
            [angka(kh.telat), 'Terlambat', angka(kh.telat) ? MERAH : NAVY],
            [angka(kh.pulang_awal), 'Pulang awal', angka(kh.pulang_awal) ? MERAH : NAVY],
            [angka(kh.tk), 'Tanpa keterangan', angka(kh.tk) ? MERAH : NAVY],
            [angka(kh.tidak_presensi_masuk), 'Tanpa absen masuk', NAVY],
            [angka(kh.tidak_presensi_pulang), 'Tanpa absen pulang', NAVY],
            [angka(kh.cuti) + angka(kh.sakit) + angka(kh.dinas_luar), 'Cuti / sakit / dinas', NAVY],
            [angka(kh.weekend), 'Akhir pekan', NAVY]
          ]);
          doc.teks(M, y, 'Hari kerja: ' + angka(kh.hari_kerja) + ' hari   -   Izin: ' +
            angka(kh.izin) + ' hari   -   Libur: ' + angka(kh.libur) + ' hari',
            { ukuran: 8, warna: ABU });
          y += 14;

          var kejadian = presensi.map(function (r) {
            var sebab = sebabPotongan(r);
            if (!sebab.length) return null;
            var jam = r.jam_masuk
              ? String(r.jam_masuk).slice(0, 5) + (r.jam_pulang ? ' - ' + String(r.jam_pulang).slice(0, 5) : '')
              : '';
            return [
              tanggalPanjang(r.tanggal) + (jam ? ' (' + jam + ')' : ''),
              sebab.join('; '),
              angka(r.potongan_persen) ? persen(r.potongan_persen) : '-'
            ];
          }).filter(function (x) { return x; });

          judulBagian('Rincian kejadian');
          if (kejadian.length) {
            tabel([
              { judul: 'Hari / tanggal / jam', w: 185 },
              { judul: 'Keterangan', w: L - 185 - 62 },
              { judul: 'Potongan', w: 62, rata: 'kanan' }
            ], kejadian);
          } else {
            doc.teks(M, y, 'Tidak ada keterlambatan, pulang awal, atau ketidakhadiran pada periode ini.',
              { ukuran: 8.5, warna: ABU });
            y += 18;
          }
        }
      }

      if (bagian.tukin) {
        judulBagian('B. TUKIN');
        if (!rt) {
          doc.teks(M, y, 'Rekap tukin belum tersedia untuk periode ini.', { ukuran: 8.5, warna: ABU });
          y += 18;
        } else {
          tabel([
            { judul: 'Komponen', w: 340 },
            { judul: 'Nilai', w: L - 340, rata: 'kanan' }
          ], [
            ['Tukin bruto', rupiah(rt.tukin_bruto)],
            ['Potongan tidak masuk (TK)', rupiah(rt.pot_tk)],
            ['Potongan terlambat', rupiah(rt.pot_tl)],
            ['Potongan pulang awal', rupiah(rt.pot_psw)],
            ['Potongan HUKDIS', rupiah(rt.pot_hukdis)],
            ['Potongan tugas belajar (TB)', rupiah(rt.pot_tb)],
            ['Potongan lain', rupiah(rt.pot_lain)],
            ['Total potongan (' + persen(rt.total_persen) + ')', rupiah(rt.total_potongan)],
            ['Pajak', rupiah(rt.pajak)]
          ]);
          kotakTotal('Tukin bersih diterima', rupiah(rt.tukin_bersih));
        }
      }

      if (bagian.uangMakan) {
        judulBagian('C. UANG MAKAN');
        if (!rm) {
          doc.teks(M, y, 'Rekap uang makan belum tersedia untuk periode ini.', { ukuran: 8.5, warna: ABU });
          y += 18;
        } else {
          tabel([
            { judul: 'Komponen', w: 340 },
            { judul: 'Nilai', w: L - 340, rata: 'kanan' }
          ], [
            ['Hari hadir dihitung', angka(rm.hari_hadir) + ' hari'],
            ['Tarif per hari', rupiah(rm.tarif)],
            ['Bruto', rupiah(rm.bruto)],
            ['PPh ' + persen(rm.pph_pct), rupiah(rm.pph)]
          ]);
          kotakTotal('Uang makan bersih diterima', rupiah(rm.bersih));
        }
      }

      y += 10;
    });

    // ---------- penutup ----------
    pastikan(120);
    doc.teks(M, y, 'Catatan: potongan HUKDIS/TB diisi admin saat verifikasi. Angka pada dokumen ini ' +
      'diambil dari pengajuan yang tersimpan di sistem.', { ukuran: 8, warna: ABU });
    y += 14;
    doc.teks(M, y, 'Dokumen dibuat otomatis oleh Tool Tukin pada ' +
      cetak.toLocaleString('id-ID') + '.', { ukuran: 8, warna: ABU });
    y += 30;
    doc.garis(M + 10, y + 34, M + 210, y + 34, { warna: '#94a3b8', tebal: 0.8 });
    doc.teks(M + 10, y + 46, 'Pegawai yang bersangkutan', { ukuran: 8, warna: ABU });
    doc.garis(M + L - 210, y + 34, M + L - 10, y + 34, { warna: '#94a3b8', tebal: 0.8 });
    doc.teks(M + L - 10, y + 46, 'Admin Kepegawaian', { ukuran: 8, warna: ABU, rata: 'kanan' });

    var namaBerkas = 'Rekap ' + idn.nama.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, ' ') +
      ' - ' + (items.length === 1 ? labelPeriode(items[0]) : items.length + ' bulan') + '.pdf';
    return doc.simpan(namaBerkas);
  }

  root.RekapPDF = { unduh: unduh };
})(typeof self !== 'undefined' ? self : this);
