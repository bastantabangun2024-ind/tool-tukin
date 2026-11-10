-- 0001_init.sql — skema awal Tool Tukin (TAHAP 2)
-- Jalankan di Supabase SQL Editor, atau: node scripts/terapkan-migrasi.mjs
-- Aman dijalankan ulang (create ... if not exists / drop policy if exists).
--
-- Catatan: enum & kolom harian mengikuti keluaran mesin hitung offline
-- (aplikasi-offline/APLIKASI/app.js: klasifikasiHari/prosesSatuOrang):
--   hadir | libur (cuti/sakit/dinas luar) | tk | noPresensi (sisi masuk/pulang) | weekend

begin;

-- ---------------------------------------------------------------------------
-- 1. Enum
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.peran_pengguna as enum ('admin', 'pegawai');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.status_kepegawaian as enum ('PPPK', 'PNS', 'CPNS', 'PPPK_PW');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.status_pendaftaran as enum ('menunggu', 'disetujui', 'ditolak');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.status_pengajuan as enum (
    'draft', 'menunggu_verifikasi', 'sedang_diperiksa',
    'perlu_perbaikan', 'disetujui', 'ditolak');
exception when duplicate_object then null; end $$;

-- jenis hari persis seperti klasifikasiHari()
do $$ begin
  create type public.jenis_hari as enum ('hadir', 'libur', 'tk', 'tidak_presensi', 'weekend');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.sisi_presensi as enum ('masuk', 'pulang');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.jenis_aturan as enum ('tukin', 'uang_makan');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.satuan_aturan as enum (
    'persen_per_hari', 'persen_per_kejadian', 'persen_bulanan',
    'rupiah_per_hari', 'rupiah_per_kejadian');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- 2. Bidang & pengguna
-- ---------------------------------------------------------------------------
create table if not exists public.bidang (
  id          uuid primary key default gen_random_uuid(),
  kode        text not null unique,
  nama        text not null,
  aktif       boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Profil tambahan auth.users. Password tetap milik Supabase Auth.
create table if not exists public.users (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null unique,
  nama        text,
  peran       public.peran_pengguna not null default 'pegawai',
  aktif       boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.pegawai (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid unique references public.users (id) on delete set null,
  nip                 text not null unique check (nip ~ '^[0-9]{18}$'),
  nama                text not null,
  nama_key            text not null,
  pangkat             text,
  golongan            text,
  ruang               text,
  jabatan             text,
  kelas_jabatan       text,
  bidang_id           uuid not null references public.bidang (id),
  status_kepegawaian  public.status_kepegawaian not null default 'PPPK',
  tukin               numeric(12,0) not null default 0 check (tukin >= 0),
  tarif_uang_makan    numeric(10,0) not null default 37000 check (tarif_uang_makan >= 0),
  pph_pct             numeric(5,2) not null default 5 check (pph_pct between 0 and 100),
  satker_2            text,
  satker_3            text default 'Kanwil Kementerian Agama Provinsi Aceh',
  aktif               boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists idx_pegawai_bidang on public.pegawai (bidang_id) where aktif;
create index if not exists idx_pegawai_nama_key on public.pegawai (nama_key);

-- ---------------------------------------------------------------------------
-- 3. Pendaftaran akun (dibuat lewat fungsi server / service role)
-- ---------------------------------------------------------------------------
create table if not exists public.pendaftaran (
  id               uuid primary key default gen_random_uuid(),
  nama             text not null,
  nip              text not null check (nip ~ '^[0-9]{18}$'),
  pangkat          text,
  golongan         text,
  jabatan          text,
  bidang_id        uuid not null references public.bidang (id),
  email            text not null,
  status           public.status_pendaftaran not null default 'menunggu',
  catatan_admin    text,
  diputuskan_oleh  uuid references public.users (id),
  diputuskan_pada  timestamptz,
  created_at       timestamptz not null default now()
);

create unique index if not exists uq_pendaftaran_menunggu
  on public.pendaftaran (nip) where status = 'menunggu';
create index if not exists idx_pendaftaran_status
  on public.pendaftaran (status, created_at desc);

-- ---------------------------------------------------------------------------
-- 4. Aturan potongan (berversi; hasil lama memakai snapshot)
-- ---------------------------------------------------------------------------
create table if not exists public.aturan_potongan (
  id              uuid primary key default gen_random_uuid(),
  kode            text not null,
  nama            text not null,
  jenis           public.jenis_aturan not null,
  satuan          public.satuan_aturan not null,
  nilai           numeric(10,4) not null,
  keterangan      text,
  dasar_hukum     text,
  berlaku_mulai   date not null default current_date,
  berlaku_sampai  date,
  aktif           boolean not null default true,
  versi           integer not null,
  dibuat_oleh     uuid references public.users (id),
  created_at      timestamptz not null default now(),
  unique (kode, versi)
);

create index if not exists idx_aturan_aktif
  on public.aturan_potongan (jenis, aktif, berlaku_mulai desc);

-- ---------------------------------------------------------------------------
-- 5. Berkas presensi (metadata Google Drive) & pengajuan
-- ---------------------------------------------------------------------------
create table if not exists public.file_presensi (
  id               uuid primary key default gen_random_uuid(),
  pegawai_id       uuid not null references public.pegawai (id) on delete cascade,
  nama_asli        text not null,
  drive_file_id    text not null unique,
  drive_folder_id  text,
  drive_link       text,
  ukuran           integer not null check (ukuran > 0),
  sha256           text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  tahun            smallint not null check (tahun between 2020 and 2100),
  bulan            smallint not null check (bulan between 1 and 12),
  diunggah_oleh    uuid references public.users (id),
  created_at       timestamptz not null default now()
);

create index if not exists idx_file_presensi_pegawai
  on public.file_presensi (pegawai_id, tahun, bulan);

create table if not exists public.pengajuan_tukin (
  id                 uuid primary key default gen_random_uuid(),
  pegawai_id         uuid not null references public.pegawai (id) on delete cascade,
  bidang_id          uuid not null references public.bidang (id),
  tahun              smallint not null check (tahun between 2020 and 2100),
  bulan              smallint not null check (bulan between 1 and 12),
  file_presensi_id   uuid references public.file_presensi (id) on delete set null,
  status             public.status_pengajuan not null default 'draft',
  dikirim_pada       timestamptz,
  diverifikasi_oleh  uuid references public.users (id),
  diverifikasi_pada  timestamptz,
  catatan_admin      text,
  izinkan_ulang      boolean not null default false,
  aturan_versi       integer not null default 1,
  aturan_snapshot    jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (pegawai_id, tahun, bulan)
);

create index if not exists idx_pengajuan_status
  on public.pengajuan_tukin (status, tahun, bulan);
create index if not exists idx_pengajuan_bidang
  on public.pengajuan_tukin (bidang_id, tahun, bulan);

-- ---------------------------------------------------------------------------
-- 6. Rincian harian & rekap
-- ---------------------------------------------------------------------------
create table if not exists public.presensi (
  id                 bigserial primary key,
  pengajuan_id       uuid not null references public.pengajuan_tukin (id) on delete cascade,
  pegawai_id         uuid not null references public.pegawai (id) on delete cascade,
  tanggal            date not null,
  jenis              public.jenis_hari not null,
  sisi               public.sisi_presensi,
  jam_masuk          time,
  jam_pulang         time,
  menit_telat        integer not null default 0 check (menit_telat >= 0),
  menit_pulang_awal  integer not null default 0 check (menit_pulang_awal >= 0),
  potongan_kode      text,
  potongan_persen    numeric(6,3) not null default 0 check (potongan_persen >= 0),
  libur_sub          text,
  jenis_tugas        text,
  keterangan         text,
  anomali            boolean not null default false,
  unique (pengajuan_id, tanggal)
);
create index if not exists idx_presensi_pegawai on public.presensi (pegawai_id, tanggal);

create table if not exists public.rekap_kehadiran (
  id                     uuid primary key default gen_random_uuid(),
  pengajuan_id           uuid not null unique references public.pengajuan_tukin (id) on delete cascade,
  hari_kerja             smallint not null default 0,
  hadir                  smallint not null default 0,
  telat                  smallint not null default 0,
  pulang_awal            smallint not null default 0,
  tidak_presensi_masuk   smallint not null default 0,
  tidak_presensi_pulang  smallint not null default 0,
  tk                     smallint not null default 0,
  libur                  smallint not null default 0,
  cuti                   smallint not null default 0,
  sakit                  smallint not null default 0,
  dinas_luar             smallint not null default 0,
  izin                   smallint not null default 0,
  weekend                smallint not null default 0,
  anomali                jsonb not null default '[]'::jsonb,
  created_at             timestamptz not null default now()
);

create table if not exists public.rekap_tukin (
  id              uuid primary key default gen_random_uuid(),
  pengajuan_id    uuid not null unique references public.pengajuan_tukin (id) on delete cascade,
  tukin_bruto     numeric(12,0) not null default 0,
  pot_tk          numeric(12,0) not null default 0,
  pot_tl          numeric(12,0) not null default 0,
  pot_psw         numeric(12,0) not null default 0,
  pot_hukdis      numeric(12,0) not null default 0,
  pot_tb          numeric(12,0) not null default 0,
  hukdis_pct      numeric(5,2) not null default 0 check (hukdis_pct between 0 and 100),
  tb_pct          numeric(5,2) not null default 0 check (tb_pct between 0 and 100),
  pot_lain        numeric(12,0) not null default 0,
  total_persen    numeric(6,3) not null default 0,
  total_potongan  numeric(12,0) not null default 0,
  pajak           numeric(12,0) not null default 0,
  tukin_bersih    numeric(12,0) not null default 0,
  rincian         jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

create table if not exists public.rekap_uang_makan (
  id            uuid primary key default gen_random_uuid(),
  pengajuan_id  uuid not null unique references public.pengajuan_tukin (id) on delete cascade,
  hari_hadir    smallint not null default 0,
  tarif         numeric(10,0) not null default 37000,
  bruto         numeric(12,0) not null default 0,
  pph_pct       numeric(5,2) not null default 5,
  pph           numeric(12,0) not null default 0,
  bersih        numeric(12,0) not null default 0,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 7. Penunjang
-- ---------------------------------------------------------------------------
create table if not exists public.hari_libur (
  tanggal     date primary key,
  keterangan  text not null
);

create table if not exists public.pengaturan (
  kunci            text primary key,
  nilai            jsonb not null,
  diperbarui_oleh  uuid references public.users (id),
  updated_at       timestamptz not null default now()
);

create table if not exists public.audit_log (
  id          bigserial primary key,
  aktor_id    uuid references public.users (id),
  aksi        text not null,
  tabel       text,
  record_id   text,
  data_lama   jsonb,
  data_baru   jsonb,
  ip          inet,
  created_at  timestamptz not null default now()
);
create index if not exists idx_audit_waktu on public.audit_log (created_at desc);

-- ---------------------------------------------------------------------------
-- 8. Trigger updated_at
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_users_updated on public.users;
create trigger trg_users_updated before update on public.users
  for each row execute function public.set_updated_at();

drop trigger if exists trg_pegawai_updated on public.pegawai;
create trigger trg_pegawai_updated before update on public.pegawai
  for each row execute function public.set_updated_at();

drop trigger if exists trg_pengajuan_updated on public.pengajuan_tukin;
create trigger trg_pengajuan_updated before update on public.pengajuan_tukin
  for each row execute function public.set_updated_at();

drop trigger if exists trg_pengaturan_updated on public.pengaturan;
create trigger trg_pengaturan_updated before update on public.pengaturan
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 9. Row Level Security
-- ---------------------------------------------------------------------------
alter table public.bidang           enable row level security;
alter table public.users            enable row level security;
alter table public.pegawai          enable row level security;
alter table public.pendaftaran      enable row level security;
alter table public.aturan_potongan  enable row level security;
alter table public.file_presensi    enable row level security;
alter table public.pengajuan_tukin  enable row level security;
alter table public.presensi         enable row level security;
alter table public.rekap_kehadiran  enable row level security;
alter table public.rekap_tukin      enable row level security;
alter table public.rekap_uang_makan enable row level security;
alter table public.hari_libur       enable row level security;
alter table public.pengaturan       enable row level security;
alter table public.audit_log        enable row level security;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.peran = 'admin' and u.aktif
  );
$$;

create or replace function public.pegawai_saya() returns uuid
language sql stable security definer set search_path = public, pg_temp as $$
  select p.id from public.pegawai p where p.user_id = auth.uid();
$$;

-- users: baca diri sendiri; ubah peran hanya admin
drop policy if exists users_baca on public.users;
create policy users_baca on public.users
  for select to authenticated using (id = auth.uid() or public.is_admin());

drop policy if exists admin_ubah_users on public.users;
create policy admin_ubah_users on public.users
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- bidang
drop policy if exists bidang_baca on public.bidang;
create policy bidang_baca on public.bidang
  for select to authenticated using (aktif or public.is_admin());

drop policy if exists admin_semua_bidang on public.bidang;
create policy admin_semua_bidang on public.bidang
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- pegawai
drop policy if exists admin_semua_pegawai on public.pegawai;
create policy admin_semua_pegawai on public.pegawai
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists pegawai_baca_diri on public.pegawai;
create policy pegawai_baca_diri on public.pegawai
  for select to authenticated using (user_id = auth.uid());

-- pendaftaran: baca/putuskan admin; insert lewat service role
drop policy if exists admin_pendaftaran on public.pendaftaran;
create policy admin_pendaftaran on public.pendaftaran
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- aturan potongan: semua boleh baca yang aktif, admin kelola
drop policy if exists pegawai_baca_aturan on public.aturan_potongan;
create policy pegawai_baca_aturan on public.aturan_potongan
  for select to authenticated using (aktif or public.is_admin());

drop policy if exists admin_kelola_aturan on public.aturan_potongan;
create policy admin_kelola_aturan on public.aturan_potongan
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- file presensi
drop policy if exists file_presensi_baca on public.file_presensi;
create policy file_presensi_baca on public.file_presensi
  for select to authenticated using (pegawai_id = public.pegawai_saya() or public.is_admin());

drop policy if exists admin_file_presensi on public.file_presensi;
create policy admin_file_presensi on public.file_presensi
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- pengajuan
drop policy if exists pengajuan_baca on public.pengajuan_tukin;
create policy pengajuan_baca on public.pengajuan_tukin
  for select to authenticated using (pegawai_id = public.pegawai_saya() or public.is_admin());

drop policy if exists admin_pengajuan on public.pengajuan_tukin;
create policy admin_pengajuan on public.pengajuan_tukin
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- presensi (rincian harian)
drop policy if exists presensi_baca on public.presensi;
create policy presensi_baca on public.presensi
  for select to authenticated using (pegawai_id = public.pegawai_saya() or public.is_admin());

drop policy if exists admin_presensi on public.presensi;
create policy admin_presensi on public.presensi
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- rekap: pegawai hanya miliknya, admin semua
drop policy if exists rekap_kehadiran_baca on public.rekap_kehadiran;
create policy rekap_kehadiran_baca on public.rekap_kehadiran
  for select to authenticated using (
    exists (select 1 from public.pengajuan_tukin p
            where p.id = pengajuan_id
              and (p.pegawai_id = public.pegawai_saya() or public.is_admin()))
  );

drop policy if exists admin_rekap_kehadiran on public.rekap_kehadiran;
create policy admin_rekap_kehadiran on public.rekap_kehadiran
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists rekap_tukin_baca on public.rekap_tukin;
create policy rekap_tukin_baca on public.rekap_tukin
  for select to authenticated using (
    exists (select 1 from public.pengajuan_tukin p
            where p.id = pengajuan_id
              and (p.pegawai_id = public.pegawai_saya() or public.is_admin()))
  );

drop policy if exists admin_rekap_tukin on public.rekap_tukin;
create policy admin_rekap_tukin on public.rekap_tukin
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists rekap_uang_makan_baca on public.rekap_uang_makan;
create policy rekap_uang_makan_baca on public.rekap_uang_makan
  for select to authenticated using (
    exists (select 1 from public.pengajuan_tukin p
            where p.id = pengajuan_id
              and (p.pegawai_id = public.pegawai_saya() or public.is_admin()))
  );

drop policy if exists admin_rekap_uang_makan on public.rekap_uang_makan;
create policy admin_rekap_uang_makan on public.rekap_uang_makan
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- hari libur: dibaca semua (dipakai perhitungan), dikelola admin
drop policy if exists hari_libur_baca on public.hari_libur;
create policy hari_libur_baca on public.hari_libur
  for select to authenticated using (true);

drop policy if exists admin_hari_libur on public.hari_libur;
create policy admin_hari_libur on public.hari_libur
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- pengaturan: admin saja (berisi token Drive terenkripsi)
drop policy if exists admin_pengaturan on public.pengaturan;
create policy admin_pengaturan on public.pengaturan
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- audit log: baca admin; tulis lewat service role
drop policy if exists admin_baca_audit on public.audit_log;
create policy admin_baca_audit on public.audit_log
  for select to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------------
-- 10. Direktori pegawai (publik, hanya 4 kolom non-sensitif)
--     security definer: tidak membocorkan tukin/golongan/NIP penuh.
-- ---------------------------------------------------------------------------
create or replace function public.direktori_pegawai()
returns table (nama text, nip_masked text, bidang text, jabatan text)
language sql stable security definer set search_path = public, pg_temp as $$
  select p.nama,
         '****' || right(p.nip, 4) as nip_masked,
         b.nama as bidang,
         p.jabatan
  from public.pegawai p
  join public.bidang b on b.id = p.bidang_id
  where p.aktif
  order by b.nama, p.nama;
$$;

revoke all on function public.direktori_pegawai() from public;
grant execute on function public.direktori_pegawai() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 11. Hak akses tabel (RLS tetap penyaring utama)
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated, service_role;

grant select on all tables in schema public to authenticated;
grant insert, update, delete on
  public.bidang, public.users, public.pegawai, public.pendaftaran,
  public.aturan_potongan, public.file_presensi, public.pengajuan_tukin,
  public.presensi, public.rekap_kehadiran, public.rekap_tukin,
  public.rekap_uang_makan, public.hari_libur, public.pengaturan
  to authenticated;

grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;

commit;
