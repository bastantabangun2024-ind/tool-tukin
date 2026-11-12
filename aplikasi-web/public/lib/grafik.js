/* ==========================================================================
   Grafik — perender SVG ringan untuk Tool Tukin (tahap 2: visualisasi premium)
   Tanpa pustaka eksternal: tetap jalan offline, tanpa CDN, tanpa build step.

   Fitur:
   - Garis halus (monotone cubic) dengan animasi gambar & area gradien.
   - Titik data interaktif + area sentuh lebih besar.
   - Tooltip melayang (fixed) yang tidak terpotong kartu, mendukung mouse & sentuh.
   - Legenda interaktif: klik untuk menyembunyikan/menampilkan seri.
   - Sorotan bulan/bidang terpilih tanpa menarik ulang data.
   - Donat animasi dengan total & persentase di tengah.
   - Keadaan kosong, galat, dan rangka (skeleton).
   - Gambar ulang hanya saat lebar wadah benar-benar berubah.
   ========================================================================== */
(function (global) {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';

  var WARNA = {
    biru: '#2563eb',
    biruMuda: '#60a5fa',
    biruPucat: '#a9c6ec',
    navy: '#163a5f',
    hijau: '#067647',
    kuning: '#d97706',
    merah: '#b42318',
    ungu: '#7c3aed',
    teal: '#0d9488',
    abu: '#94a3b8'
  };
  var URUTAN = [WARNA.biru, WARNA.teal, WARNA.ungu, WARNA.kuning, WARNA.merah, WARNA.hijau,
    '#db2777', '#0ea5e9', '#84cc16', '#f97316', '#64748b'];

  function buat(tag, atr) {
    var e = document.createElementNS(NS, tag);
    if (atr) Object.keys(atr).forEach(function (k) { e.setAttribute(k, atr[k]); });
    return e;
  }

  function el(tag, kelas, teks) {
    var e = document.createElement(tag);
    if (kelas) e.className = kelas;
    if (teks != null) e.textContent = teks;
    return e;
  }

  // Ringkas: 1.250.000 -> "1,25 jt"; 12.400 -> "12,4 rb".
  function ringkas(n) {
    n = Number(n) || 0;
    var abs = Math.abs(n);
    if (abs >= 1e12) return (n / 1e12).toLocaleString('id-ID', { maximumFractionDigits: 2 }) + ' T';
    if (abs >= 1e9) return (n / 1e9).toLocaleString('id-ID', { maximumFractionDigits: 2 }) + ' M';
    if (abs >= 1e6) return (n / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 2 }) + ' jt';
    if (abs >= 1e3) return (n / 1e3).toLocaleString('id-ID', { maximumFractionDigits: 1 }) + ' rb';
    return n.toLocaleString('id-ID', { maximumFractionDigits: 2 });
  }

  function angka(n) { return (Number(n) || 0).toLocaleString('id-ID'); }

  function rupiah(n) {
    return 'Rp' + Math.round(Number(n) || 0).toLocaleString('id-ID');
  }

  function persenLabel(p) {
    var bulat = Math.round(p * 10) / 10;
    return bulat.toLocaleString('id-ID', { maximumFractionDigits: 1 }) + '%';
  }

  function skala(max, jumlahGaris) {
    if (!(max > 0)) max = 1;
    var kasar = max / jumlahGaris;
    var besaran = Math.pow(10, Math.floor(Math.log10(kasar)));
    var sisa = kasar / besaran;
    var langkah = (sisa <= 1 ? 1 : sisa <= 2 ? 2 : sisa <= 5 ? 5 : 10) * besaran;
    if (!isFinite(langkah) || langkah <= 0) langkah = 1;
    return { batas: Math.ceil(max / langkah) * langkah || 1, langkah: langkah };
  }

  function siapkan(target) {
    if (!target) return null;
    var lama = target.__grafik;
    if (lama && lama.ro) { try { lama.ro.disconnect(); } catch (e) { /* diabaikan */ } }
    target.innerHTML = '';
    target.__grafik = {};
    return target;
  }

  /* ------------------------------------------------------------------------
     Tooltip & interaksi (mouse, keyboard, sentuh)
     ------------------------------------------------------------------------ */
  function buatTooltip(wadah) {
    var tip = el('div', 'grafik-tooltip');
    tip.setAttribute('role', 'status');
    wadah.appendChild(tip);
    var timer = null;

    return {
      tampil: function (html, ev) {
        tip.innerHTML = html;
        tip.classList.add('tampil');

        var lebar = tip.offsetWidth || 160;
        var tinggi = tip.offsetHeight || 48;
        var jendelaW = window.innerWidth || 1024;
        var jendelaH = window.innerHeight || 768;
        var x = (ev && ev.clientX != null ? ev.clientX : jendelaW / 2) + 14;
        var y = (ev && ev.clientY != null ? ev.clientY : jendelaH / 2) - tinggi - 14;

        if (x + lebar > jendelaW - 8) x = (ev.clientX || jendelaW / 2) - lebar - 14;
        if (x < 8) x = 8;
        if (y < 8) y = (ev.clientY || 0) + 18;
        if (y + tinggi > jendelaH - 8) y = jendelaH - tinggi - 8;

        tip.style.left = Math.round(x) + 'px';
        tip.style.top = Math.round(y) + 'px';

        clearTimeout(timer);
      },
      sembunyi: function () {
        clearTimeout(timer);
        tip.classList.remove('tampil');
      },
      sembunyiNanti: function (ms) {
        clearTimeout(timer);
        timer = setTimeout(function () { tip.classList.remove('tampil'); }, ms || 2400);
      }
    };
  }

  // Pasang interaksi pada satu elemen SVG (titik, batang, busur).
  function ikat(elx, tip, htmlFn) {
    function tampil(ev) {
      tip.tampil(htmlFn(), ev || posisiTengah(elx));
    }
    function sentuh(ev) {
      // pointerType "touch"/"pen" -> tahan sebentar agar terbaca
      if (ev && ev.pointerType && ev.pointerType !== 'mouse') {
        tampil(ev);
        tip.sembunyiNanti(2600);
      }
    }
    elx.addEventListener('pointerenter', function (ev) {
      if (!ev.pointerType || ev.pointerType === 'mouse') tampil(ev);
    });
    elx.addEventListener('pointermove', function (ev) {
      if (!ev.pointerType || ev.pointerType === 'mouse') tampil(ev);
    });
    elx.addEventListener('pointerleave', function (ev) {
      if (!ev.pointerType || ev.pointerType === 'mouse') tip.sembunyi();
    });
    elx.addEventListener('pointerdown', function (ev) {
      ev.preventDefault();
      sentuh(ev);
    });
    elx.addEventListener('focus', function () { tampil(posisiTengah(elx)); });
    elx.addEventListener('blur', function () { tip.sembunyi(); });
  }

  function posisiTengah(node) {
    var r = node && node.getBoundingClientRect ? node.getBoundingClientRect() : null;
    if (!r) return null;
    return { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 };
  }

  function barisTip(warna, label, nilai) {
    return '<div class="baris-tip">' +
      (warna ? '<span class="warna-tip" style="background:' + warna + '"></span>' : '') +
      '<span>' + label + '</span><span class="angka-tip">' + nilai + '</span></div>';
  }

  /* ------------------------------------------------------------------------
     Legenda interaktif
     daftar: [{ label, warna, nilai, nonaktif }]
     opsi: { onToggle(index) }
     ------------------------------------------------------------------------ */
  function legenda(wadah, daftar, opsi) {
    opsi = opsi || {};
    var l = el('div', 'legenda');
    daftar.forEach(function (d, i) {
      var item;
      if (opsi.onToggle) {
        item = el('button', 'item-legenda');
        item.type = 'button';
        item.setAttribute('aria-pressed', d.nonaktif ? 'false' : 'true');
        item.setAttribute('title', d.nonaktif ? 'Tampilkan ' + d.label : 'Sembunyikan ' + d.label);
        item.addEventListener('click', function () { opsi.onToggle(i); });
      } else {
        item = el('span', 'item-legenda');
      }
      if (d.nonaktif) item.classList.add('nonaktif');
      var warna = el('span', 'warna-legenda');
      warna.style.background = d.warna;
      item.appendChild(warna);
      item.appendChild(document.createTextNode(d.label));
      if (d.nilai != null) {
        var nilai = el('span', 'nilai-legenda', d.nilai);
        item.appendChild(nilai);
      }
      l.appendChild(item);
    });
    wadah.appendChild(l);
    return l;
  }

  /* ------------------------------------------------------------------------
     Keadaan kosong / galat / skeleton
     ------------------------------------------------------------------------ */
  function svgKosong() {
    return '<div class="ikon-kosong">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round">' +
      '<path d="M4 19V5m0 14h16M8 16l3.5-4 3 2.5L20 8"/></svg></div>';
  }

  function kosong(target, pesan) {
    siapkan(target);
    var div = el('div', 'keadaan-kosong');
    div.innerHTML = svgKosong() + '<b>Belum ada data</b><span>' +
      (pesan || 'Data akan tampil setelah ada pengajuan masuk.') + '</span>';
    target.appendChild(div);
  }

  function galat(target, pesan) {
    siapkan(target);
    var div = el('div', 'keadaan-kosong');
    div.innerHTML = '<div class="ikon-kosong" style="background:#fef3f2;color:#b42318">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">' +
      '<path d="M12 8v5m0 3.5h.01M10.3 3.9 2.5 18a1.9 1.9 0 0 0 1.7 2.8h15.6a1.9 1.9 0 0 0 1.7-2.8L13.7 3.9a1.9 1.9 0 0 0-3.4 0Z"/></svg></div>' +
      '<b>Gagal memuat grafik</b><span>' + (pesan || 'Data tidak dapat diambil dari server.') + '</span>';
    div.setAttribute('role', 'alert');
    target.appendChild(div);
  }

  function rangka(target, tinggi, jumlah) {
    siapkan(target);
    var div = el('div', 'rangka-grafik');
    div.style.height = (tinggi || 210) + 'px';
    target.appendChild(div);
    for (var i = 1; i < (jumlah || 3); i++) {
      var b = el('div', 'rangka rangka-baris');
      b.style.marginTop = '8px';
      b.style.width = (60 - i * 8) + '%';
      target.appendChild(b);
    }
  }

  function pasangResize(target, gambarUlang) {
    if (typeof ResizeObserver === 'undefined') return;
    var terakhir = target.clientWidth;
    var jeda = null;
    var ro = new ResizeObserver(function () {
      var lebar = target.clientWidth;
      if (!lebar || Math.abs(lebar - terakhir) < 6) return;
      terakhir = lebar;
      clearTimeout(jeda);
      jeda = setTimeout(gambarUlang, 150);
    });
    ro.observe(target);
    target.__grafik.ro = ro;
  }

  function bingkai(target, tinggi) {
    var wadah = el('div', 'grafik');
    wadah.style.height = tinggi + 'px';
    target.appendChild(wadah);
    var svg = buat('svg', { role: 'img', height: tinggi });
    wadah.appendChild(svg);
    // Legenda diletakkan di luar wadah bertinggi tetap agar tidak meluber ke kartu berikutnya.
    return { wadah: wadah, svg: svg, tooltip: buatTooltip(wadah), luar: target };
  }

  function labelSumbuX(lebar, jumlah) {
    if (lebar < 340) return Math.max(1, Math.ceil(jumlah / 4));
    if (lebar < 460) return Math.max(1, Math.ceil(jumlah / 3));
    if (lebar < 620) return 2;
    return 1;
  }

  /* ------------------------------------------------------------------------
     Kurva halus monoton (tidak overshoot di bawah nol)
     ------------------------------------------------------------------------ */
  function mulus(titik) {
    var n = titik.length;
    if (!n) return '';
    if (n === 1) return 'M' + titik[0].x.toFixed(1) + ' ' + titik[0].y.toFixed(1);
    if (n === 2) {
      return 'M' + titik[0].x.toFixed(1) + ' ' + titik[0].y.toFixed(1) +
        ' L' + titik[1].x.toFixed(1) + ' ' + titik[1].y.toFixed(1);
    }

    var dx = [], dy = [], m = [];
    for (var i = 0; i < n - 1; i++) {
      dx[i] = titik[i + 1].x - titik[i].x;
      dy[i] = titik[i + 1].y - titik[i].y;
      m[i] = dx[i] ? dy[i] / dx[i] : 0;
    }
    var t = [m[0]];
    for (var j = 1; j < n - 1; j++) {
      if (m[j - 1] * m[j] <= 0) {
        t[j] = 0;
      } else {
        var w1 = 2 * dx[j] + dx[j - 1];
        var w2 = dx[j] + 2 * dx[j - 1];
        t[j] = (w1 + w2) / (w1 / m[j - 1] + w2 / m[j]);
      }
    }
    t[n - 1] = m[n - 2];

    var d = 'M' + titik[0].x.toFixed(1) + ' ' + titik[0].y.toFixed(1);
    for (var k = 0; k < n - 1; k++) {
      var x1 = titik[k].x, y1 = titik[k].y;
      var x2 = titik[k + 1].x, y2 = titik[k + 1].y;
      var cx1 = x1 + dx[k] / 3;
      var cy1 = y1 + (t[k] * dx[k]) / 3;
      var cx2 = x2 - dx[k] / 3;
      var cy2 = y2 - (t[k + 1] * dx[k]) / 3;
      d += ' C' + cx1.toFixed(1) + ' ' + cy1.toFixed(1) + ', ' +
        cx2.toFixed(1) + ' ' + cy2.toFixed(1) + ', ' +
        x2.toFixed(1) + ' ' + y2.toFixed(1);
    }
    return d;
  }

  /* ------------------------------------------------------------------------
     GARIS — tren bulanan
     opsi: { labels, series:[{nama,nilai,warna}], format, sorot, aria,
             pesanKosong, judulTip }
     ------------------------------------------------------------------------ */
  function garis(target, opsi) {
    if (!target) return;
    var labels = opsi.labels || [];
    var series = (opsi.series || []).map(function (s, i) {
      return {
        nama: s.nama,
        nilai: (s.nilai || []).map(function (v) { return Number(v) || 0; }),
        warna: s.warna || URUTAN[i % URUTAN.length]
      };
    });
    var format = opsi.format || ringkas;
    var adaData = series.some(function (s) { return s.nilai.some(function (v) { return v > 0; }); });
    if (!adaData) { kosong(target, opsi.pesanKosong); return; }

    function gambar() {
      var lebar = Math.max(target.clientWidth, 240);
      var tinggi = Math.max(200, Math.min(310, Math.round(lebar * 0.45)));
      siapkan(target);
      var b = bingkai(target, tinggi);
      var pad = { kiri: 48, kanan: 16, atas: 18, bawah: 32 };
      b.svg.setAttribute('viewBox', '0 0 ' + lebar + ' ' + tinggi);
      b.svg.setAttribute('width', lebar);
      b.svg.setAttribute('aria-label', opsi.aria || 'Grafik tren');

      var maks = 0;
      series.forEach(function (s) {
        s.nilai.forEach(function (v) { if (v > maks) maks = v; });
      });
      var sk = skala(maks, 4);
      var W = lebar - pad.kiri - pad.kanan;
      var H = tinggi - pad.atas - pad.bawah;
      var n = labels.length || 1;
      var langkahX = n > 1 ? W / (n - 1) : 0;
      var dasarY = pad.atas + H;

      // Sorotan bulan terpilih (tanpa menarik ulang data)
      var sorot = Number(opsi.sorot);
      if (lebar >= 300 && sorot >= 0 && sorot < n) {
        var lebarPita = n > 1 ? Math.max(14, langkahX * 0.72) : 26;
        var xPita = pad.kiri + langkahX * sorot - lebarPita / 2;
        xPita = Math.max(pad.kiri - 6, Math.min(xPita, lebar - pad.kanan - lebarPita + 6));
        b.svg.appendChild(buat('rect', {
          x: xPita, y: pad.atas - 6, width: lebarPita, height: H + 10, rx: 6,
          fill: 'rgba(37, 99, 235, .07)', class: 'pita-sorot'
        }));
      }

      // Kisi + label sumbu Y
      for (var t = 0; t <= 4; t++) {
        var nilai = sk.langkah * t;
        var y = pad.atas + H - (nilai / sk.batas) * H;
        b.svg.appendChild(buat('line', {
          class: 'garis-kisi', x1: pad.kiri, x2: lebar - pad.kanan, y1: y, y2: y
        }));
        var teksY = buat('text', {
          class: 'grafik-teks', x: pad.kiri - 8, y: y + 3.5, 'text-anchor': 'end'
        });
        teksY.textContent = format(nilai, true);
        b.svg.appendChild(teksY);
      }

      // Label sumbu X
      var setiap = labelSumbuX(lebar, n);
      labels.forEach(function (lb, i) {
        if (i % setiap !== 0) return;
        var tx = buat('text', {
          class: 'grafik-teks' + (sorot === i ? ' kuat' : ''),
          x: pad.kiri + langkahX * i, y: tinggi - 10, 'text-anchor': 'middle'
        });
        tx.textContent = lb;
        b.svg.appendChild(tx);
      });

      b.svg.appendChild(buat('line', {
        class: 'sumbu', x1: pad.kiri, x2: lebar - pad.kanan, y1: dasarY, y2: dasarY
      }));

      var defs = buat('defs');
      series.forEach(function (s, si) {
        var grad = buat('linearGradient', {
          id: 'gradGaris' + si + '-' + Math.random().toString(36).slice(2, 7),
          x1: '0', y1: '0', x2: '0', y2: '1'
        });
        grad.appendChild(buat('stop', { offset: '0%', 'stop-color': s.warna, 'stop-opacity': '.20' }));
        grad.appendChild(buat('stop', { offset: '100%', 'stop-color': s.warna, 'stop-opacity': '0' }));
        defs.appendChild(grad);
        s.gradId = grad.id;
      });
      b.svg.appendChild(defs);

      var visibel = series.map(function () { return true; });
      var grup = [];

      series.forEach(function (s, si) {
        var titik = s.nilai.map(function (v, i) {
          return {
            x: pad.kiri + langkahX * i,
            y: pad.atas + H - (v / sk.batas) * H,
            v: v,
            label: labels[i]
          };
        });

        var g = buat('g', { 'data-seri': si });
        grup.push(g);

        if (series.length === 1 && titik.length > 1) {
          var area = mulus(titik) +
            ' L' + titik[titik.length - 1].x.toFixed(1) + ' ' + dasarY +
            ' L' + titik[0].x.toFixed(1) + ' ' + dasarY + ' Z';
          g.appendChild(buat('path', { d: area, fill: 'url(#' + s.gradId + ')', stroke: 'none' }));
        }

        var jalur = buat('path', {
          d: mulus(titik), fill: 'none', stroke: s.warna, 'stroke-width': 2.6,
          'stroke-linecap': 'round', 'stroke-linejoin': 'round', class: 'anim-garis'
        });
        g.appendChild(jalur);
        b.svg.appendChild(g);

        // Panjang asli supaya animasi gambar rata (fallback bila tak didukung).
        var panjang = 4000;
        try {
          var p = jalur.getTotalLength();
          if (p > 0) panjang = Math.ceil(p + 2);
        } catch (e) { /* stub/DOM lama */ }
        jalur.style.setProperty('--panjang', panjang);

        titik.forEach(function (p, pi) {
          var terpilih = sorot === pi;
          var c = buat('circle', {
            class: 'titik' + (terpilih ? ' titik-sorot' : ''),
            cx: p.x, cy: p.y, r: terpilih ? 5 : 3.6, fill: s.warna,
            'aria-label': p.label + ': ' + format(p.v)
          });
          // Area sentuh transparan agar mudah ditekan di ponsel.
          var hit = buat('circle', {
            class: 'titik-hit', cx: p.x, cy: p.y, r: 13, fill: 'transparent',
            tabindex: '0', role: 'button',
            'aria-label': (opsi.judulTip || p.label) + ' — ' + format(p.v)
          });
          var buatHtml = function () {
            var isi = '<b>' + (opsi.judulTip || p.label) + '</b>';
            series.forEach(function (sx, xi) {
              if (!visibel[xi]) return;
              isi += barisTip(sx.warna, sx.nama, format(sx.nilai[pi] || 0, false, true));
            });
            return isi;
          };
          ikat(hit, b.tooltip, buatHtml);
          ikat(c, b.tooltip, buatHtml);
          g.appendChild(c);
          g.appendChild(hit);
        });
      });

      function gambarLegenda() {
        var lamaLegenda = b.luar.querySelector('.legenda');
        if (lamaLegenda) lamaLegenda.remove();
        legenda(b.luar, series.map(function (s, si) {
          var total = s.nilai.reduce(function (a, v) { return a + v; }, 0);
          return {
            label: s.nama,
            warna: s.warna,
            nilai: format(total, false, true),
            nonaktif: !visibel[si]
          };
        }), series.length > 1 ? {
          onToggle: function (i) {
            var tampil = visibel.filter(Boolean).length;
            if (visibel[i] && tampil === 1) return; // minimal satu seri tetap tampil
            visibel[i] = !visibel[i];
            grup[i].style.display = visibel[i] ? '' : 'none';
            gambarLegenda();
          }
        } : null);
      }

      b.svg.appendChild(buat('line', {
        class: 'sumbu', x1: pad.kiri, x2: lebar - pad.kanan, y1: dasarY, y2: dasarY
      }));
      gambarLegenda();
    }

    gambar();
    pasangResize(target, gambar);
  }

  /* ------------------------------------------------------------------------
     BATANG — horizontal (banyak kategori) / vertikal
     opsi: { labels, nilai, warna, format, namaSeri, sorot, horizontal, aria }
     ------------------------------------------------------------------------ */
  function batang(target, opsi) {
    if (!target) return;
    var labels = opsi.labels || [];
    var nilai = (opsi.nilai || []).map(function (v) { return Number(v) || 0; });
    var warna = opsi.warna || WARNA.biru;
    var format = opsi.format || angka;
    if (!nilai.some(function (v) { return v > 0; })) { kosong(target, opsi.pesanKosong); return; }

    function gambar() {
      var horizontal = opsi.horizontal !== false;
      var lebar = Math.max(target.clientWidth, 240);
      siapkan(target);

      if (horizontal) {
        var barisTinggi = 30;
        var tinggi = Math.max(170, labels.length * barisTinggi + 26);
        var b = bingkai(target, tinggi);
        b.svg.setAttribute('viewBox', '0 0 ' + lebar + ' ' + tinggi);
        b.svg.setAttribute('width', lebar);
        b.svg.setAttribute('aria-label', opsi.aria || 'Grafik batang');

        var nilaiTeks = nilai.map(function (v) { return format(v); });
        var lebarTeks = Math.max.apply(null, nilaiTeks.map(function (s) { return s.length; })) * 6.6 + 12;
        var padKiri = Math.min(148, Math.max(84, Math.round(lebar * 0.26)));
        var padKanan = Math.min(Math.max(54, lebarTeks), Math.max(60, lebar * 0.30));
        var W = lebar - padKiri - padKanan;
        var maks = Math.max.apply(null, nilai) || 1;
        var barisTersedia = tinggi - 20;
        var jarak = barisTersedia / labels.length;

        labels.forEach(function (lb, i) {
          var y = 10 + jarak * i;
          var h = Math.min(19, jarak - 9);
          var w = Math.max(3, (nilai[i] / maks) * W);
          var warnaBar = Array.isArray(warna) ? warna[i % warna.length] : warna;
          var disorot = opsi.sorot != null && opsi.sorot !== '' && String(lb) === String(opsi.sorot);
          if (opsi.sorot && !disorot) warnaBar = WARNA.biruPucat;

          var teksLb = buat('text', {
            class: 'grafik-teks' + (disorot ? ' kuat' : ''),
            x: padKiri - 9, y: y + h / 2 + 3.5, 'text-anchor': 'end'
          });
          teksLb.textContent = lb.length > 19 ? lb.slice(0, 18) + '…' : lb;
          b.svg.appendChild(teksLb);

          b.svg.appendChild(buat('rect', {
            x: padKiri, y: y, width: W, height: h, rx: 5, fill: '#f1f5f9'
          }));

          var rect = buat('rect', {
            x: padKiri, y: y, width: w, height: h, rx: 5, fill: warnaBar,
            class: 'batang anim-batang-x', tabindex: '0', role: 'button',
            'aria-label': lb + ': ' + format(nilai[i])
          });
          rect.style.animationDelay = (i * 45) + 'ms';
          b.svg.appendChild(rect);

          var teksNilai = buat('text', {
            class: 'grafik-teks kuat', x: padKiri + w + 8, y: y + h / 2 + 3.5
          });
          teksNilai.textContent = nilaiTeks[i];
          b.svg.appendChild(teksNilai);

          ikat(rect, b.tooltip, function () {
            return '<b>' + lb + '</b>' + barisTip(warnaBar, opsi.namaSeri || 'Jumlah', format(nilai[i]));
          });
        });
        return;
      }

      // Vertikal
      var tinggi2 = Math.max(220, Math.min(310, Math.round(lebar * 0.5)));
      var b2 = bingkai(target, tinggi2);
      b2.svg.setAttribute('viewBox', '0 0 ' + lebar + ' ' + tinggi2);
      b2.svg.setAttribute('width', lebar);
      b2.svg.setAttribute('aria-label', opsi.aria || 'Grafik batang');

      var pad = { kiri: 44, kanan: 14, atas: 16, bawah: 46 };
      var sk = skala(Math.max.apply(null, nilai), 4);
      var W2 = lebar - pad.kiri - pad.kanan;
      var H2 = tinggi2 - pad.atas - pad.bawah;

      for (var t = 0; t <= 4; t++) {
        var val = sk.langkah * t;
        var y = pad.atas + H2 - (val / sk.batas) * H2;
        b2.svg.appendChild(buat('line', { class: 'garis-kisi', x1: pad.kiri, x2: lebar - pad.kanan, y1: y, y2: y }));
        var ty = buat('text', { class: 'grafik-teks', x: pad.kiri - 7, y: y + 3.5, 'text-anchor': 'end' });
        ty.textContent = format(val, true);
        b2.svg.appendChild(ty);
      }

      var slot = W2 / labels.length;
      var lebarBar = Math.min(40, slot * 0.56);
      labels.forEach(function (lb, i) {
        var x = pad.kiri + slot * i + (slot - lebarBar) / 2;
        var h = (nilai[i] / sk.batas) * H2;
        var warnaBar = Array.isArray(warna) ? warna[i % warna.length] : warna;
        var rect = buat('rect', {
          x: x, y: pad.atas + H2 - h, width: lebarBar, height: Math.max(2, h), rx: 5,
          fill: warnaBar, class: 'batang anim-batang', tabindex: '0', role: 'button',
          'aria-label': lb + ': ' + format(nilai[i])
        });
        rect.style.animationDelay = (i * 45) + 'ms';
        b2.svg.appendChild(rect);

        var tx = buat('text', {
          class: 'grafik-teks', x: x + lebarBar / 2, y: tinggi2 - 26,
          'text-anchor': 'end', transform: 'rotate(-24 ' + (x + lebarBar / 2) + ' ' + (tinggi2 - 26) + ')'
        });
        tx.textContent = lb.length > 12 ? lb.slice(0, 11) + '…' : lb;
        b2.svg.appendChild(tx);

        ikat(rect, b2.tooltip, function () {
          return '<b>' + lb + '</b>' + barisTip(warnaBar, opsi.namaSeri || 'Jumlah', format(nilai[i]));
        });
      });
      b2.svg.appendChild(buat('line', { class: 'sumbu', x1: pad.kiri, x2: lebar - pad.kanan, y1: pad.atas + H2, y2: pad.atas + H2 }));
    }

    gambar();
    pasangResize(target, gambar);
  }

  /* ------------------------------------------------------------------------
     BATANG BERKELOMPOK — dua seri dibandingkan per kategori
     opsi: { labels, series, format, sorot, aria }
     ------------------------------------------------------------------------ */
  function batangKelompok(target, opsi) {
    if (!target) return;
    var labels = opsi.labels || [];
    var series = (opsi.series || []).map(function (s, i) {
      return {
        nama: s.nama,
        nilai: (s.nilai || []).map(function (v) { return Number(v) || 0; }),
        warna: s.warna || URUTAN[i % URUTAN.length]
      };
    });
    var format = opsi.format || ringkas;
    if (!series.some(function (s) { return s.nilai.some(function (v) { return v > 0; }); })) {
      kosong(target, opsi.pesanKosong);
      return;
    }

    function gambar() {
      var lebar = Math.max(target.clientWidth, 240);
      var tinggi = Math.max(220, Math.min(310, Math.round(lebar * 0.48)));
      siapkan(target);
      var b = bingkai(target, tinggi);
      b.svg.setAttribute('viewBox', '0 0 ' + lebar + ' ' + tinggi);
      b.svg.setAttribute('width', lebar);
      b.svg.setAttribute('aria-label', opsi.aria || 'Grafik batang perbandingan');

      var pad = { kiri: 48, kanan: 14, atas: 18, bawah: 32 };
      var maks = 0;
      series.forEach(function (s) { s.nilai.forEach(function (v) { if (v > maks) maks = v; }); });
      var sk = skala(maks, 4);
      var W = lebar - pad.kiri - pad.kanan;
      var n = labels.length || 1;
      var slot = W / n;
      // Label nilai hanya tampil bila tiap bulan cukup lebar; beri ruang satu baris di atas.
      var tampilLabel = slot >= 34;
      if (tampilLabel) pad.atas = 26;
      var H = tinggi - pad.atas - pad.bawah;
      var dasarY = pad.atas + H;
      var sorot = Number(opsi.sorot);

      if (lebar >= 300 && sorot >= 0 && sorot < n) {
        var lebarPita = Math.max(16, slot * 0.76);
        var xPita = pad.kiri + slot * sorot + (slot - lebarPita) / 2;
        b.svg.appendChild(buat('rect', {
          x: xPita, y: pad.atas - 6, width: lebarPita, height: H + 10, rx: 6,
          fill: 'rgba(37, 99, 235, .07)', class: 'pita-sorot'
        }));
      }

      for (var t = 0; t <= 4; t++) {
        var val = sk.langkah * t;
        var y = pad.atas + H - (val / sk.batas) * H;
        b.svg.appendChild(buat('line', { class: 'garis-kisi', x1: pad.kiri, x2: lebar - pad.kanan, y1: y, y2: y }));
        var tx = buat('text', { class: 'grafik-teks', x: pad.kiri - 7, y: y + 3.5, 'text-anchor': 'end' });
        tx.textContent = format(val, true);
        b.svg.appendChild(tx);
      }

      var jarak = 2;
      var lebarBar = Math.max(3, Math.min(15, (slot - 8 - jarak * (series.length - 1)) / series.length));
      var kelompokLebar = lebarBar * series.length + jarak * (series.length - 1);
      var setiap = labelSumbuX(lebar, n);
      var visibel = series.map(function () { return true; });
      var grup = [];
      var labelDitempatkan = [];

      function bentrok(kotak) {
        return labelDitempatkan.some(function (k) {
          return kotak.x1 < k.x2 + 2 && kotak.x2 > k.x1 - 2 && kotak.y1 < k.y2 + 2 && kotak.y2 > k.y1 - 2;
        });
      }

      series.forEach(function (s, si) {
        var g = buat('g', { 'data-seri': si });
        grup.push(g);
        labels.forEach(function (lb, i) {
          var v = s.nilai[i] || 0;
          var h = (v / sk.batas) * H;
          var x = pad.kiri + slot * i + (slot - kelompokLebar) / 2 + si * (lebarBar + jarak);
          var rect = buat('rect', {
            x: x, y: dasarY - h, width: lebarBar, height: Math.max(2, h), rx: 4,
            fill: s.warna, class: 'batang anim-batang', tabindex: '0', role: 'button',
            'aria-label': lb + ' — ' + s.nama + ': ' + format(v)
          });
          rect.style.animationDelay = (i * 28 + si * 55) + 'ms';
          g.appendChild(rect);

          if (tampilLabel && v > 0) {
            var teks = format(v, true).replace(/^Rp\s?/, '');
            var wLabel = Math.max(12, teks.length * 4.3);
            var kiriLabel = si === 0 ? x - 4 - wLabel : x + lebarBar + 4;
            if (kiriLabel < pad.kiri) kiriLabel = x + lebarBar + 4;
            if (kiriLabel + wLabel > lebar - pad.kanan) kiriLabel = x - 4 - wLabel;
            var yLabel = Math.max(10, dasarY - h - 5);
            var kotak = { x1: kiriLabel, x2: kiriLabel + wLabel, y1: yLabel - 9, y2: yLabel + 2 };
            if (!bentrok(kotak)) {
              labelDitempatkan.push(kotak);
              var tx = buat('text', {
                class: 'grafik-teks label-batang',
                x: kiriLabel, y: yLabel, 'text-anchor': 'start'
              });
              tx.style.fill = s.warna;
              tx.textContent = teks;
              g.appendChild(tx);
            }
          }

          ikat(rect, b.tooltip, function () {
            var isi = '<b>' + lb + (sorot === i ? ' · dipilih' : '') + '</b>';
            series.forEach(function (sx, xi) {
              if (!visibel[xi]) return;
              isi += barisTip(sx.warna, sx.nama, format(sx.nilai[i] || 0, false, true));
            });
            return isi;
          });
        });
        b.svg.appendChild(g);
      });

      labels.forEach(function (lb, i) {
        if (i % setiap !== 0) return;
        var tx = buat('text', {
          class: 'grafik-teks' + (sorot === i ? ' kuat' : ''),
          x: pad.kiri + slot * i + slot / 2, y: tinggi - 10, 'text-anchor': 'middle'
        });
        tx.textContent = lb;
        b.svg.appendChild(tx);
      });

      b.svg.appendChild(buat('line', { class: 'sumbu', x1: pad.kiri, x2: lebar - pad.kanan, y1: dasarY, y2: dasarY }));

      function gambarLegenda() {
        var lama = b.luar.querySelector('.legenda');
        if (lama) lama.remove();
        legenda(b.luar, series.map(function (s, si) {
          var total = s.nilai.reduce(function (a, v) { return a + v; }, 0);
          return {
            label: s.nama, warna: s.warna,
            nilai: format(total, false, true),
            nonaktif: !visibel[si]
          };
        }), series.length > 1 ? {
          onToggle: function (i) {
            if (visibel[i] && visibel.filter(Boolean).length === 1) return;
            visibel[i] = !visibel[i];
            grup[i].style.display = visibel[i] ? '' : 'none';
            gambarLegenda();
          }
        } : null);
      }

      gambarLegenda();
    }

    gambar();
    pasangResize(target, gambar);
  }

  /* ------------------------------------------------------------------------
     DONAT — komposisi status
     opsi: { data:[{label,nilai,warna}], labelTotal, format, aria }
     ------------------------------------------------------------------------ */
  function donat(target, opsi) {
    if (!target) return;
    var data = (opsi.data || []).filter(function (d) { return (Number(d.nilai) || 0) > 0; });
    var total = data.reduce(function (a, d) { return a + (Number(d.nilai) || 0); }, 0);
    if (!total) { kosong(target, opsi.pesanKosong); return; }
    var format = opsi.format || angka;

    function gambar() {
      var lebar = Math.max(target.clientWidth, 220);
      var tinggi = Math.max(205, Math.min(255, Math.round(lebar * 0.66)));
      siapkan(target);
      var b = bingkai(target, tinggi);
      b.svg.setAttribute('viewBox', '0 0 ' + lebar + ' ' + tinggi);
      b.svg.setAttribute('width', lebar);
      b.svg.setAttribute('aria-label', opsi.aria || 'Grafik donat');

      var cx = lebar / 2;
      var cy = tinggi / 2 - 4;
      var r = Math.max(44, Math.min(tinggi / 2 - 16, lebar / 3.6, 94));
      var tebal = Math.max(17, r * 0.30);
      var keliling = 2 * Math.PI * r;
      var mulai = 0;

      var tAngka = buat('text', {
        class: 'pusat-donat-angka', x: cx, y: cy + (opsi.labelTotal ? -1 : 6), 'text-anchor': 'middle'
      });
      tAngka.textContent = format(total);
      b.svg.appendChild(tAngka);
      var tLabel = buat('text', {
        class: 'pusat-donat-label', x: cx, y: cy + 17, 'text-anchor': 'middle'
      });
      tLabel.textContent = opsi.labelTotal || 'Total';
      b.svg.appendChild(tLabel);

      var busur = [];
      data.forEach(function (d, i) {
        var bagian = (Number(d.nilai) || 0) / total;
        var panjang = Math.max(0, bagian * keliling - 2.5);
        var warna = d.warna || URUTAN[i % URUTAN.length];
        var c = buat('circle', {
          cx: cx, cy: cy, r: r,
          fill: 'none', stroke: warna, 'stroke-width': tebal,
          'stroke-dasharray': panjang.toFixed(2) + ' ' + (keliling - panjang + 2).toFixed(2),
          'stroke-dashoffset': (-mulai * keliling).toFixed(2),
          transform: 'rotate(-90 ' + cx + ' ' + cy + ')',
          class: 'busur-donat', tabindex: '0', role: 'button',
          'aria-label': d.label + ': ' + format(d.nilai) + ' (' + persenLabel(bagian * 100) + ')'
        });
        // Animasi sapuan: mulai tanpa panjang, lalu transisi ke panjang penuh.
        c.style.strokeDasharray = '0 ' + keliling.toFixed(2);
        c.style.transition = 'stroke-dasharray .85s cubic-bezier(.22, 1, .36, 1), stroke-width .18s ease';
        c.__target = panjang.toFixed(2) + ' ' + (keliling - panjang + 2).toFixed(2);
        b.svg.appendChild(c);
        busur.push(c);

        var html = '<b>' + d.label + '</b>' +
          barisTip(warna, format(d.nilai), persenLabel(bagian * 100));

        c.addEventListener('pointerenter', function (ev) {
          c.style.strokeWidth = String(tebal + 3);
          tAngka.textContent = persenLabel(bagian * 100);
          tLabel.textContent = d.label;
          if (ev.pointerType === 'mouse' || !ev.pointerType) b.tooltip.tampil(html, ev);
        });
        c.addEventListener('pointermove', function (ev) {
          if (ev.pointerType === 'mouse' || !ev.pointerType) b.tooltip.tampil(html, ev);
        });
        c.addEventListener('pointerleave', function () {
          c.style.strokeWidth = String(tebal);
          tAngka.textContent = format(total);
          tLabel.textContent = opsi.labelTotal || 'Total';
          b.tooltip.sembunyi();
        });
        c.addEventListener('pointerdown', function (ev) {
          ev.preventDefault();
          tAngka.textContent = persenLabel(bagian * 100);
          tLabel.textContent = d.label;
          b.tooltip.tampil(html, ev);
          b.tooltip.sembunyiNanti(2600);
        });
        c.addEventListener('focus', function () {
          tAngka.textContent = persenLabel(bagian * 100);
          tLabel.textContent = d.label;
          b.tooltip.tampil(html, posisiTengah(c));
        });
        c.addEventListener('blur', function () {
          tAngka.textContent = format(total);
          tLabel.textContent = opsi.labelTotal || 'Total';
          b.tooltip.sembunyi();
        });

        mulai += bagian;
      });

      // Jalankan animasi setelah elemen terpasang.
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            busur.forEach(function (c) { c.style.strokeDasharray = c.__target; });
          });
        });
      } else {
        busur.forEach(function (c) { c.style.strokeDasharray = c.__target; });
      }

      var l = el('div', 'legenda legenda-donat');
      data.forEach(function (d, i) {
        var bagian = (Number(d.nilai) || 0) / total;
        var item = el('span', 'item-legenda');
        var w = el('span', 'warna-legenda');
        w.style.background = d.warna || URUTAN[i % URUTAN.length];
        item.appendChild(w);
        item.appendChild(document.createTextNode(d.label + ' '));
        var n = el('span', 'nilai-legenda', format(d.nilai) + ' · ' + persenLabel(bagian * 100));
        item.appendChild(n);
        l.appendChild(item);
      });
      target.appendChild(l);
    }

    gambar();
    pasangResize(target, gambar);
  }

  global.Grafik = {
    warna: WARNA,
    palet: URUTAN,
    garis: garis,
    batang: batang,
    batangKelompok: batangKelompok,
    donat: donat,
    kosong: kosong,
    galat: galat,
    rangka: rangka,
    ringkas: ringkas,
    angka: angka,
    rupiah: rupiah,
    persenLabel: persenLabel
  };
})(window);
