// format-pegawai.js — format Excel untuk pendaftaran banyak pegawai sekaligus.
//
// Dipakai dua halaman:
//   daftar.html (umum)  -> pegawai mengunduh format, mengisi, lalu mengirim
//                          file ke admin (WhatsApp/email).
//   admin.html          -> admin mengunduh format yang sama lalu mengunggah
//                          file isian untuk membuat pegawai + akun login.
//
// Membutuhkan pustaka XLSX (dimuat lebih dulu oleh halaman pemanggil).

(function (root) {
  'use strict';

  // Urutan kolom mengikuti formulir Data Pegawai. Kunci = nama field server.
  var KOLOM = [
    ['Nama lengkap', 'nama', 32],
    ['NIP', 'nip', 22],
    ['Pangkat', 'pangkat', 18],
    ['Golongan', 'golongan', 11],
    ['Ruang', 'ruang', 8],
    ['Jabatan', 'jabatan', 28],
    ['Kelas jabatan', 'kelas_jabatan', 13],
    ['Bidang (kode)', 'bidang', 16],
    ['Status kepegawaian', 'status_kepegawaian', 20],
    ['Tukin bruto', 'tukin', 14],
    ['Tarif uang makan', 'tarif_uang_makan', 17],
    ['PPh (%)', 'pph_pct', 10],
    ['No. WA / HP', 'no_wa', 18],
    ['Satker 2', 'satker_2', 24]
  ];

  // Nama kolom yang diterima saat membaca file (dibuat normal: huruf kecil,
  // tanpa tanda baca). Supaya file lama/ketikan manual tetap terbaca.
  var ALIAS = {
    'nama': 'nama', 'nama lengkap': 'nama', 'nama pegawai': 'nama',
    'nip': 'nip',
    'pangkat': 'pangkat',
    'golongan': 'golongan', 'gol': 'golongan',
    'ruang': 'ruang',
    'jabatan': 'jabatan',
    'kelas jabatan': 'kelas_jabatan', 'kelas': 'kelas_jabatan',
    'bidang': 'bidang', 'kode bidang': 'bidang', 'bidang kode': 'bidang',
    'status kepegawaian': 'status_kepegawaian', 'status': 'status_kepegawaian',
    'tukin bruto': 'tukin', 'tukin': 'tukin',
    'tarif uang makan': 'tarif_uang_makan', 'uang makan': 'tarif_uang_makan',
    'pph': 'pph_pct', 'pph persen': 'pph_pct', 'pph %': 'pph_pct',
    'no wa': 'no_wa', 'no wa hp': 'no_wa', 'no hp': 'no_wa',
    'whatsapp': 'no_wa', 'wa': 'no_wa', 'nomor wa': 'no_wa',
    'satker 2': 'satker_2', 'satker2': 'satker_2'
  };

  function normal(teks) {
    return String(teks == null ? '' : teks)
      .toLowerCase()
      .replace(/[^a-z0-9%]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // "3.000.000" / "3,000,000" / "37.000,50" -> angka. Kosong -> null.
  function keAngka(nilai) {
    if (nilai === '' || nilai === null || nilai === undefined) return null;
    if (typeof nilai === 'number') return isFinite(nilai) ? nilai : null;
    var s = String(nilai).trim().replace(/[^\d.,-]/g, '');
    if (!s) return null;
    var koma = s.lastIndexOf(',');
    var titik = s.lastIndexOf('.');
    if (koma > -1 && titik > -1) {
      if (koma > titik) s = s.replace(/\./g, '').replace(',', '.');
      else s = s.replace(/,/g, '');
    } else if (koma > -1) {
      s = /,\d{1,2}$/.test(s) ? s.replace(',', '.') : s.replace(/,/g, '');
    } else if (titik > -1) {
      s = /\.\d{1,2}$/.test(s) ? s : s.replace(/\./g, '');
    }
    var n = Number(s);
    return isFinite(n) ? n : null;
  }

  function unduhTemplate(daftarBidang) {
    if (typeof XLSX === 'undefined') throw new Error('Pustaka Excel belum termuat');
    var bidang = Array.isArray(daftarBidang) ? daftarBidang : [];

    var kepala = KOLOM.map(function (k) { return k[0]; });
    var contoh = ['Contoh Nama Lengkap', '198001012005011001', 'Pengatur', 'II', 'c',
      'Penyuluh Agama', '5', bidang[0] ? bidang[0].kode : 'PAI', 'PPPK',
      0, 37000, 5, '081234567890', ''];
    var ws = XLSX.utils.aoa_to_sheet([kepala, contoh]);
    ws['!cols'] = KOLOM.map(function (k) { return { wch: k[2] }; });
    ws['!rows'] = [{ hpt: 28 }];

    var petunjuk = [
      ['PETUNJUK PENGISIAN FORMAT PENDAFTARAN PEGAWAI'],
      [''],
      ['1. Isi data pada sheet "Data Pegawai", satu baris untuk satu pegawai.'],
      ['2. Baris ke-2 adalah contoh. Hapus baris contoh sebelum file diunggah.'],
      ['3. Jangan mengubah, menambah, atau memindahkan nama kolom.'],
      ['4. Kolom wajib: Nama lengkap, NIP, Bidang (kode).'],
      ['5. NIP harus 18 angka dan belum pernah terdaftar.'],
      ['   Penting: atur kolom NIP berformat Teks sebelum mengetik (atau awali'],
      ['   NIP dengan tanda kutip \') agar 18 angka tidak berubah jadi 0 di akhir.'],
      ['6. Bidang diisi KODE (lihat daftar di bawah), bukan nama lengkap.'],
      ['7. Status kepegawaian: PNS, PPPK, CPNS, atau PPPK_PW.'],
      ['8. Tukin bruto, tarif uang makan, dan PPh boleh dikosongkan admin.'],
      ['9. No. WA / HP ditulis 08xx xxxx xxxx (boleh dengan spasi/tanda +62).'],
      ['10. Setelah selesai, kirim file .xlsx ini ke admin kepegawaian.'],
      [''], ['DAFTAR KODE BIDANG'], ['']
    ];
    if (bidang.length) {
      bidang.forEach(function (b) {
        petunjuk.push([String(b.kode || ''), String(b.nama || '')]);
      });
    } else {
      petunjuk.push(['Kode bidang belum tersedia', 'Hubungi admin untuk daftar kode.']);
    }
    var wsPetunjuk = XLSX.utils.aoa_to_sheet(petunjuk);
    wsPetunjuk['!cols'] = [{ wch: 42 }, { wch: 40 }];

    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data Pegawai');
    XLSX.utils.book_append_sheet(wb, wsPetunjuk, 'Petunjuk');

    var data = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    var blob = new Blob([data], { type: 'application/octet-stream' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'Format Pendaftaran Pegawai.xlsx';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }

  function bacaBerkas(berkas) {
    if (typeof XLSX === 'undefined') return Promise.reject(new Error('Pustaka Excel belum termuat'));
    return new Promise(function (selesai, gagal) {
      var pembaca = new FileReader();
      pembaca.onload = function () {
        try {
          var wb = XLSX.read(new Uint8Array(pembaca.result), { type: 'array' });
          var namaSheet = wb.SheetNames.indexOf('Data Pegawai') > -1
            ? 'Data Pegawai' : wb.SheetNames[0];
          var ws = wb.Sheets[namaSheet];
          if (!ws) throw new Error('Sheet data tidak ditemukan');
          var mentah = XLSX.utils.sheet_to_json(ws, { defval: '', raw: true });
          var hasil = [];
          mentah.forEach(function (baris) {
            var data = {};
            Object.keys(baris).forEach(function (kolom) {
              var kunci = ALIAS[normal(kolom)];
              if (!kunci) return;
              var nilai = baris[kolom];
              if (kunci === 'tukin' || kunci === 'tarif_uang_makan' || kunci === 'pph_pct') {
                data[kunci] = keAngka(nilai);
              } else {
                data[kunci] = String(nilai == null ? '' : nilai).trim();
              }
            });
            if (!String(data.nama || '').trim() && !String(data.nip || '').trim()) return;
            // buang baris contoh bawaan template
            if (normal(data.nama) === 'contoh nama lengkap') return;
            data.nama = String(data.nama || '').trim();
            data.nip = String(data.nip || '').replace(/\s/g, '');
            data.status_kepegawaian = String(data.status_kepegawaian || 'PPPK')
              .trim().toUpperCase().replace(/[\s-]+/g, '_');
            hasil.push(data);
          });
          selesai(hasil);
        } catch (e) {
          gagal(new Error('File tidak terbaca: ' + (e.message || e)));
        }
      };
      pembaca.onerror = function () { gagal(new Error('File gagal dibaca')); };
      pembaca.readAsArrayBuffer(berkas);
    });
  }

  root.FormatPegawai = { unduhTemplate: unduhTemplate, bacaBerkas: bacaBerkas, KOLOM: KOLOM };
})(typeof self !== 'undefined' ? self : this);
