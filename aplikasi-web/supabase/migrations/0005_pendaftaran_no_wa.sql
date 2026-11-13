-- Nomor WhatsApp pendaftar, disimpan dalam format internasional tanpa tanda +
-- (contoh 6281234567890) agar bisa langsung dipakai pada tautan wa.me.
alter table public.pendaftaran
  add column if not exists no_wa text;

comment on column public.pendaftaran.no_wa is
  'Nomor WhatsApp pendaftar, format 62xxxxxxxxxx tanpa tanda +';
