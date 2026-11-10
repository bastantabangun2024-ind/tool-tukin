-- 0002_seed_referensi.sql — data referensi awal (TAHAP 2)
-- Nilai potongan = perilaku app.js saat ini (versi 1). Jangan ubah tanpa persetujuan admin:
-- hasil pengajuan menyimpan aturan_versi + aturan_snapshot, jadi perubahan di sini
-- tidak mengubah periode yang sudah disahkan.

begin;

insert into public.bidang (kode, nama) values
  ('TU',         'Tata Usaha'),
  ('KANWIL',     'Kanwil'),
  ('PAI',        'PAI'),
  ('BUDDHA',     'Bimas Buddha'),
  ('HINDU',      'Bimas Hindu'),
  ('KRISTEN',    'Bimas Kristen'),
  ('KATOLIK',    'Bimas Katolik'),
  ('PENAISZAWA', 'PenaisZawa'),
  ('PENMAD',     'Penmad'),
  ('PONTREN',    'Pontren'),
  ('URAIS',      'Urais')
on conflict (kode) do update set nama = excluded.nama;

-- tangga TL & PSW sama dengan tanggaPersen(): <=29 = 0.5, <=60 = 1, <=89 = 1.25, >89 = 1.5
insert into public.aturan_potongan (kode, nama, jenis, satuan, nilai, keterangan, dasar_hukum, versi)
values
  ('tk_harian',      'Tidak masuk tanpa keterangan', 'tukin', 'persen_per_hari',      3,    'per hari TK', 'PMA 11/2019 Pasal 8 Ayat (1)', 1),
  ('tanpa_presensi', 'Tidak presensi masuk/pulang',  'tukin', 'persen_per_kejadian',  1.5,  'per sisi yang tidak terekam', 'PMA 11/2019', 1),
  ('telat_0_29',     'Telat 1-29 menit',             'tukin', 'persen_per_kejadian',  0.5,  null, 'PMA 11/2019', 1),
  ('telat_30_60',    'Telat 30-60 menit',            'tukin', 'persen_per_kejadian',  1,    null, 'PMA 11/2019', 1),
  ('telat_61_89',    'Telat 61-89 menit',            'tukin', 'persen_per_kejadian',  1.25, null, 'PMA 11/2019', 1),
  ('telat_90_plus',  'Telat 90 menit atau lebih',    'tukin', 'persen_per_kejadian',  1.5,  null, 'PMA 11/2019', 1),
  ('psw_0_29',       'Pulang awal 1-29 menit',       'tukin', 'persen_per_kejadian',  0.5,  null, 'PMA 11/2019', 1),
  ('psw_30_60',      'Pulang awal 30-60 menit',      'tukin', 'persen_per_kejadian',  1,    null, 'PMA 11/2019', 1),
  ('psw_61_89',      'Pulang awal 61-89 menit',      'tukin', 'persen_per_kejadian',  1.25, null, 'PMA 11/2019', 1),
  ('psw_90_plus',    'Pulang awal 90 menit atau lebih','tukin','persen_per_kejadian',  1.5,  null, 'PMA 11/2019', 1),
  ('hukdis',         'Hukuman disiplin',             'tukin', 'persen_bulanan',       0,    'diisi admin per pengajuan', 'PP 94/2021', 1),
  ('tb',             'Tugas belajar / izin belajar', 'tukin', 'persen_bulanan',       0,    'diisi admin per pengajuan', 'PMA 11/2019', 1),
  ('batas_total',    'Batas potongan per bulan',     'tukin', 'persen_bulanan',       100,  'total potongan tidak melebihi 100%', 'PMA 11/2019', 1),
  ('tarif_uang_makan','Tarif uang makan per hari',   'uang_makan', 'rupiah_per_hari',  37000, null, 'PMK berlaku', 1),
  ('pph_um_pppk',    'PPh uang makan PPPK / gol III', 'uang_makan', 'persen_bulanan',  5,    null, 'ketentuan pajak', 1),
  ('pph_um_gol_iv',  'PPh uang makan PNS gol IV',    'uang_makan', 'persen_bulanan',   15,   null, 'ketentuan pajak', 1)
on conflict (kode, versi) do nothing;

insert into public.pengaturan (kunci, nilai) values
  ('jam_kerja', '{
     "masuk": "08:00",
     "pulang": "16:30",
     "pulang_jumat": "17:00",
     "hari_kerja": [1,2,3,4,5],
     "zona": "Asia/Jakarta"
   }'::jsonb),
  ('aturan_versi_aktif', '1'::jsonb),
  ('drive_folder_id', 'null'::jsonb),
  ('drive_folder_hasil_id', 'null'::jsonb)
on conflict (kunci) do nothing;

commit;
