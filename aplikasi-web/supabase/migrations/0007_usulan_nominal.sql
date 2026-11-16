-- 0007_usulan_nominal.sql — usulan Tukin & uang makan dari pegawai
--
-- Pegawai mengisi sendiri nominal Tukin dan uang makan harian lewat
-- "Edit data" di dasbor. Usulan TIDAK langsung mengubah data pegawai:
-- admin harus menyetujui dulu di tab "Verifikasi Nominal". Saat disetujui,
-- nilai usulan disalin ke pegawai.tukin / tarif_uang_makan / pph_pct oleh
-- endpoint /api/nominal/verifikasi (service role).
--
-- Aman dijalankan ulang.

do $$ begin
  create type public.status_usulan as enum ('menunggu', 'disetujui', 'ditolak');
exception when duplicate_object then null; end $$;

create table if not exists public.usulan_nominal (
  id                uuid primary key default gen_random_uuid(),
  pegawai_id        uuid not null references public.pegawai(id) on delete cascade,
  tukin             numeric(12,0) not null default 0 check (tukin >= 0),
  uang_makan        numeric(10,0) not null default 0 check (uang_makan >= 0),
  pph_pct           numeric(5,2) not null default 0 check (pph_pct >= 0 and pph_pct <= 100),
  status            public.status_usulan not null default 'menunggu',
  diajukan_pada     timestamptz not null default now(),
  diverifikasi_oleh uuid references public.users(id) on delete set null,
  diverifikasi_pada timestamptz,
  catatan_admin     text
);

comment on table public.usulan_nominal is
  'Usulan nominal Tukin & uang makan harian dari pegawai; acuan baru berlaku setelah admin menyetujui';
comment on column public.usulan_nominal.uang_makan is
  'Tarif uang makan harian (rupiah), bukan nominal bulanan';
comment on column public.usulan_nominal.pph_pct is
  'Potongan PPh 21 dalam persen dari bruto: 0 (Gol I-II), 5 (Gol III), 15 (Gol IV)';

-- Satu usulan menunggu per pegawai; pengajuan ulang memperbarui baris yang sama.
create unique index if not exists usulan_nominal_satu_menunggu
  on public.usulan_nominal (pegawai_id) where status = 'menunggu';

create index if not exists usulan_nominal_status_idx
  on public.usulan_nominal (status, diajukan_pada desc);

-- RLS: pegawai hanya membaca usulan miliknya; admin membaca & mengelola semua.
-- Penyimpanan usulan & keputusan admin dilakukan server dengan service role.
alter table public.usulan_nominal enable row level security;

drop policy if exists usulan_nominal_baca on public.usulan_nominal;
create policy usulan_nominal_baca on public.usulan_nominal
  for select to authenticated
  using (public.is_admin() or pegawai_id = public.pegawai_saya());

drop policy if exists admin_kelola_usulan_nominal on public.usulan_nominal;
create policy admin_kelola_usulan_nominal on public.usulan_nominal
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

grant select on public.usulan_nominal to authenticated;
grant insert, update, delete on public.usulan_nominal to authenticated;
grant all on public.usulan_nominal to service_role;

analyze public.usulan_nominal;
