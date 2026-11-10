-- 0004_publik.sql — fungsi untuk halaman depan (tanpa login).
-- Hanya mengembalikan data identitas yang memang tampil di form; tukin/golongan
-- tidak ikut karena perhitungan dilakukan di server.

begin;

create or replace function public.cari_pegawai(p_nip text)
returns table (
  nip         text,
  nama        text,
  jabatan     text,
  golongan    text,
  ruang       text,
  status      text,
  bidang      text,
  aktif       boolean
)
language sql stable security definer set search_path = public, pg_temp as $$
  select p.nip, p.nama, p.jabatan, p.golongan, p.ruang,
         p.status_kepegawaian::text, b.nama, p.aktif
  from public.pegawai p
  join public.bidang b on b.id = p.bidang_id
  where p.nip = p_nip;
$$;

revoke all on function public.cari_pegawai(text) from public;
grant execute on function public.cari_pegawai(text) to anon, authenticated;

commit;
