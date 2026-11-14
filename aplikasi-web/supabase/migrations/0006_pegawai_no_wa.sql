-- Nomor WhatsApp pegawai, dipakai di profil dasbor dan rekap PDF.
-- Format internasional tanpa tanda + (contoh 6281234567890), sama seperti
-- kolom pendaftaran.no_wa.
alter table public.pegawai
  add column if not exists no_wa text;

comment on column public.pegawai.no_wa is
  'Nomor WhatsApp/HP pegawai, format 62xxxxxxxxxx tanpa tanda +';

-- Pemeliharaan ringan: statistik untuk perencanaan autovacuum/analisis.
-- (Tidak mengubah data; aman dijalankan ulang.)
analyze public.pegawai;
analyze public.pengajuan_tukin;
analyze public.presensi;
