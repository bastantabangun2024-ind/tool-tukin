// pdf.js — pembuat PDF A4 sederhana tanpa pustaka luar.
//
// Cukup untuk laporan teks & tabel: memakai font standar PDF (Helvetica,
// Helvetica-Bold) sehingga tidak perlu menyematkan font dan berkasnya kecil
// (beberapa KB). Semua koordinat memakai satuan titik (pt), A4 = 595 x 842.
//
// API:
//   var doc = PDF.baru();
//   doc.halamanBaru();
//   doc.teks(x, y, 'Halo', { ukuran: 10, tebal: true, warna: '#1d4ed8', rata: 'kiri' });
//   doc.kotak(x, y, lebar, tinggi, { isi: '#eef4ff' });
//   doc.garis(x1, y1, x2, y2, { warna: '#cbd5e1', tebal: 0.7 });
//   doc.simpan('nama-berkas.pdf');

(function (root) {
  'use strict';

  var A4 = { lebar: 595.28, tinggi: 841.89 };
  var FONT = { biasa: 'F1', tebal: 'F2' };

  // Ganti karakter di luar ASCII ke padanan aman (WinAnsi hanya untuk dasar).
  function ascii(teks) {
    return String(teks == null ? '' : teks)
      .replace(/[—–]/g, '-')
      .replace(/[’‘]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/·/g, '-')
      .replace(/…/g, '...')
      .replace(/[^\x20-\x7E]/g, '?');
  }

  function escPdf(teks) {
    return teks.replace(/[\\()]/g, function (c) { return '\\' + c; });
  }

  function fmt(n) {
    var v = Math.round(Number(n) * 100) / 100;
    return String(v);
  }

  function warnaHex(hex) {
    var h = String(hex || '').replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    if (!/^[0-9a-fA-F]{6}$/.test(h)) h = '111827';
    return [parseInt(h.slice(0, 2), 16) / 255,
      parseInt(h.slice(2, 4), 16) / 255,
      parseInt(h.slice(4, 6), 16) / 255];
  }

  // Perkiraan lebar teks Helvetica (cukup untuk rata kanan & pemotongan).
  function lebarPerHuruf(c, tebal) {
    if ('iljI.,:;!\'|'.indexOf(c) > -1) return 0.28;
    if ('mwMW'.indexOf(c) > -1) return 0.83;
    if ('ftr()[]{}-/'.indexOf(c) > -1) return 0.35;
    if (c >= 'A' && c <= 'Z') return tebal ? 0.72 : 0.68;
    if (c >= '0' && c <= '9') return 0.556;
    if (c === ' ') return 0.28;
    return tebal ? 0.56 : 0.53;
  }

  function Dokumen() {
    this.lebar = A4.lebar;
    this.tinggi = A4.tinggi;
    this.pages = [];
    this._isi = [];
    this.kakiKiri = '';
    this.pages.push(this._isi);
  }

  Dokumen.prototype.halamanBaru = function () {
    this._isi = [];
    this.pages.push(this._isi);
    return this.pages.length;
  };

  Dokumen.prototype.jumlahHalaman = function () {
    // Halaman terakhir yang masih kosong tidak dihitung.
    return this.pages.length;
  };

  Dokumen.prototype.lebarTeks = function (teks, ukuran, tebal) {
    var t = ascii(teks);
    var total = 0;
    for (var i = 0; i < t.length; i++) total += lebarPerHuruf(t[i], !!tebal);
    return total * (Number(ukuran) || 9);
  };

  Dokumen.prototype.potong = function (teks, maks, ukuran, tebal) {
    var t = ascii(teks);
    if (this.lebarTeks(t, ukuran, tebal) <= maks) return t;
    var elips = '...';
    while (t.length > 1 && this.lebarTeks(t + elips, ukuran, tebal) > maks) {
      t = t.slice(0, -1);
    }
    return t + elips;
  };

  Dokumen.prototype.teks = function (x, y, teks, opt) {
    opt = opt || {};
    var ukuran = Number(opt.ukuran) || 9;
    var tebal = !!opt.tebal;
    var w = this.lebarTeks(teks, ukuran, tebal);
    var px = Number(x) || 0;
    if (opt.rata === 'tengah') px -= w / 2;
    else if (opt.rata === 'kanan') px -= w;
    var c = warnaHex(opt.warna || '#111827');
    this._isi.push(
      fmt(c[0]) + ' ' + fmt(c[1]) + ' ' + fmt(c[2]) + ' rg ' +
      'BT /' + (tebal ? FONT.tebal : FONT.biasa) + ' ' + fmt(ukuran) + ' Tf ' +
      '1 0 0 1 ' + fmt(px) + ' ' + fmt(this.tinggi - (Number(y) || 0)) + ' Tm (' +
      escPdf(ascii(teks)) + ') Tj ET'
    );
    return w;
  };

  Dokumen.prototype.kotak = function (x, y, w, h, opt) {
    opt = opt || {};
    var yPdf = this.tinggi - (Number(y) || 0) - (Number(h) || 0);
    if (opt.isi) {
      var f = warnaHex(opt.isi);
      this._isi.push(fmt(f[0]) + ' ' + fmt(f[1]) + ' ' + fmt(f[2]) + ' rg ' +
        fmt(x) + ' ' + fmt(yPdf) + ' ' + fmt(w) + ' ' + fmt(h) + ' re f');
    }
    if (opt.garis) {
      var s = warnaHex(opt.garis);
      this._isi.push(fmt(s[0]) + ' ' + fmt(s[1]) + ' ' + fmt(s[2]) + ' RG ' +
        fmt(opt.tebal || 0.7) + ' w ' +
        fmt(x) + ' ' + fmt(yPdf) + ' ' + fmt(w) + ' ' + fmt(h) + ' re S');
    }
  };

  Dokumen.prototype.garis = function (x1, y1, x2, y2, opt) {
    opt = opt || {};
    var c = warnaHex(opt.warna || '#cbd5e1');
    this._isi.push(fmt(c[0]) + ' ' + fmt(c[1]) + ' ' + fmt(c[2]) + ' RG ' +
      fmt(opt.tebal || 0.7) + ' w ' +
      fmt(x1) + ' ' + fmt(this.tinggi - y1) + ' m ' +
      fmt(x2) + ' ' + fmt(this.tinggi - y2) + ' l S');
  };

  Dokumen.prototype.simpan = function (namaBerkas) {
    var total = this.pages.length;
    var kaki = ascii(this.kakiKiri || '');
    for (var p = 0; p < total; p++) {
      var yGaris = 34; // koordinat PDF dari bawah
      var c = warnaHex('#cbd5e1');
      this.pages[p].push(fmt(c[0]) + ' ' + fmt(c[1]) + ' ' + fmt(c[2]) + ' RG 0.5 w ' +
        '36 ' + fmt(yGaris) + ' m ' + fmt(this.lebar - 36) + ' ' + fmt(yGaris) + ' l S');
      var abu = warnaHex('#64748b');
      var warnaCmd = fmt(abu[0]) + ' ' + fmt(abu[1]) + ' ' + fmt(abu[2]) + ' rg ';
      this.pages[p].push(warnaCmd + 'BT /F1 8 Tf 1 0 0 1 36 ' +
        '24 Tm (' + escPdf(kaki) + ') Tj ET');
      var label = 'Halaman ' + (p + 1) + ' dari ' + total;
      var wLabel = this.lebarTeks(label, 8, false);
      this.pages[p].push(warnaCmd + 'BT /F1 8 Tf 1 0 0 1 ' +
        fmt(this.lebar - 36 - wLabel) + ' 24 Tm (' +
        escPdf(label) + ') Tj ET');
    }

    var objek = {};
    function obj(n, isi) { objek[n] = isi; }
    obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
    var kids = [];
    for (var i = 0; i < total; i++) kids.push((5 + i * 2) + ' 0 R');
    obj(2, '<< /Type /Pages /Kids [' + kids.join(' ') + '] /Count ' + total + ' >>');
    obj(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    obj(4, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');

    for (var j = 0; j < total; j++) {
      var nomorHalaman = 5 + j * 2;
      var nomorIsi = nomorHalaman + 1;
      var isi = this.pages[j].join('\n');
      obj(nomorHalaman, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' +
        fmt(this.lebar) + ' ' + fmt(this.tinggi) + '] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> ' +
        '/Contents ' + nomorIsi + ' 0 R >>');
      obj(nomorIsi, '<< /Length ' + isi.length + ' >>\nstream\n' + isi + '\nendstream');
    }

    var jumlah = 4 + total * 2;
    var keluar = '%PDF-1.4\n';
    var posisi = [];
    for (var n = 1; n <= jumlah; n++) {
      posisi[n] = keluar.length;
      keluar += n + ' 0 obj\n' + objek[n] + '\nendobj\n';
    }
    var xref = keluar.length;
    keluar += 'xref\n0 ' + (jumlah + 1) + '\n0000000000 65535 f \n';
    for (var m = 1; m <= jumlah; m++) {
      var nomor = String(posisi[m]);
      while (nomor.length < 10) nomor = '0' + nomor;
      keluar += nomor + ' 00000 n \n';
    }
    keluar += 'trailer\n<< /Size ' + (jumlah + 1) + ' /Root 1 0 R >>\nstartxref\n' +
      xref + '\n%%EOF';

    var blob = new Blob([keluar], { type: 'application/pdf' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = namaBerkas || 'rekap.pdf';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    return blob;
  };

  root.PDF = {
    baru: function () { return new Dokumen(); },
    A4: A4
  };
})(typeof self !== 'undefined' ? self : this);
