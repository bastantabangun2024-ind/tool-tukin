# 03 — Rancangan Skema Database (TAHAP 1)

Target: **Supabase PostgreSQL**. **Sudah dijalankan** 10 November 2026 lewat
`aplikasi-web/supabase/migrations/0001–0003`: 14 tabel, 25 policy RLS, 11 bidang,
16 aturan versi 1, 30 pegawai. Dokumen ini tetap rujukan rancangan; perubahan skema
berikutnya dibuat sebagai migrasi baru, bukan dengan mengubah file yang sudah jalan.

Prinsip:
1. Semua tabel hasil perhitungan menyimpan `tahun`/`bulan` dan **snapshot aturan**, sehingga
   hasil periode yang sudah disahkan tidak berubah ketika aturan diubah.
2. Relasi memakai foreign key; status memakai enum; angka uang memakai `numeric` (bukan float).
3. RLS aktif di semua tabel; pegawai hanya melihat barisnya sendiri.
4. Nama tabel mengikuti daftar di `website.md` bagian 17.

---

## 1. Extension & enum

```sql
create extension if not exists pgcrypto;

create type peran_pengguna      as enum ('admin', 'pegawai');
create type status_kepegawaian  as enum ('PPPK', 'PNS', 'CPNS', 'PPPK_PW');
create type status_pendaftaran  as enum ('menunggu', 'disetujui', 'ditolak');
create type status_pengajuan    as enum ('draft', 'menunggu_verifikasi', 'sedang_diperiksa',
                                         'perlu_perbaikan', 'disetujui', 'ditolak');
create type jenis_hari          as enum ('hadir', 'tk', 'cuti', 'izin', 'sakit',
                                         'dinas_luar', 'libur', 'tidak_presensi');
create type jenis_aturan        as enum ('tukin', 'uang_makan');
create type satuan_aturan       as enum ('persen_per_hari', 'persen_per_kejadian',
                                         'persen_bulanan', 'rupiah_per_hari',
                                         'rupiah_per_kejadian');
```

---

## 2. Bidang & pengguna

```sql
create table public.bidang (
  id          uuid primary key default gen_random_uuid(),
  kode        text not null unique,          -- KRISTEN, KATOLIK, BUDDHA, PAI, ...
  nama        text not null,                 -- "Bimas Kristen"
  aktif       boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Profil tambahan untuk auth.users (Supabase Auth tetap pemilik password)
create table public.users (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null unique,
  nama        text,
  peran       peran_pengguna not null default 'pegawai',
  aktif       boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.pegawai (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid unique references public.users(id) on delete set null,
  nip                text not null unique check (nip ~ '^[0-9]{18}$'),
  nama               text not null,
  nama_key           text not null,          -- kata pertama nama, untuk cocokkan nama file
  pangkat            text,
  golongan           text,                   -- "III", "IV", "IX"
  ruang              text,                   -- "a", "b", null untuk PPPK
  jabatan            text,
  kelas_jabatan      text,
  bidang_id          uuid not null references public.bidang(id),
  status_kepegawaian status_kepegawaian not null default 'PPPK',
  tukin              numeric(12,0) not null default 0,
  tarif_uang_makan   numeric(10,0) not null default 37000,
  pph_pct            numeric(5,2)  not null default 5,
  satker_2           text,
  satker_3           text default 'Kanwil Kementerian Agama Provinsi Aceh',
  aktif              boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index idx_pegawai_bidang on public.pegawai (bidang_id) where aktif;
create index idx_pegawai_nama_key on public.pegawai (nama_key);
```

Catatan: roster lama punya 30 baris; `gol` dicampur (`IX` untuk PPPK, `IV/b` untuk PNS) →
saat migrasi dipecah menjadi `golongan` + `ruang`.

---

## 3. Pendaftaran

```sql
create table public.pendaftaran (
  id               uuid primary key default gen_random_uuid(),
  nama             text not null,
  nip              text not null check (nip ~ '^[0-9]{18}$'),
  pangkat          text,
  golongan         text,
  jabatan          text,
  bidang_id        uuid not null references public.bidang(id),
  email            text not null,
  status           status_pendaftaran not null default 'menunggu',
  catatan_admin    text,
  diputuskan_oleh  uuid references public.users(id),
  diputuskan_pada  timestamptz,
  created_at       timestamptz not null default now()
);

-- satu pendaftaran menunggu per NIP
create unique index uq_pendaftaran_menunggu on public.pendaftaran (nip) where status = 'menunggu';
create index idx_pendaftaran_status on public.pendaftaran (status, created_at desc);
```

Password **tidak** disimpan di sini. Alur pendaftaran (rekomendasi): pegawai mengisi form →
fungsi server membuat `auth.users` (email dikonfirmasi) + baris `pendaftaran` status `menunggu`.
Setelah admin menyetujui, fungsi server membuat baris `pegawai` + menautkan `user_id`.
Jangan biarkan klien `insert` langsung ke `pendaftaran` (agar tidak bisa mengubah `status`).

---

## 4. Aturan potongan (berversi)

```sql
create table public.aturan_potongan (
  id             uuid primary key default gen_random_uuid(),
  kode           text not null,             -- tk_harian, tidak_presensi, telat_0_29, ...
  nama           text not null,
  jenis          jenis_aturan not null,
  satuan         satuan_aturan not null,
  nilai          numeric(10,4) not null,
  keterangan     text,
  dasar_hukum    text,
  berlaku_mulai  date not null default current_date,
  berlaku_sampai date,
  aktif          boolean not null default true,
  versi          integer not null,
  dibuat_oleh    uuid references public.users(id),
  created_at     timestamptz not null default now(),
  unique (kode, versi)
);

create index idx_aturan_aktif on public.aturan_potongan (jenis, aktif, berlaku_mulai desc);
```

Seed versi 1 (persis perilaku offline saat ini):

| kode | nama | satuan | nilai | dasar |
|---|---|---|---:|---|
| `tk_harian` | Tidak masuk tanpa keterangan | persen_per_hari | 3 | PMA 11/2019 Pasal 8 Ayat (1) |
| `tanpa_presensi` | Tidak presensi masuk/pulang | persen_per_kejadian | 1.5 | PMA 11/2019 |
| `telat_0_29` | Telat 1–29 menit | persen_per_kejadian | 0.5 | PMA 11/2019 |
| `telat_30_60` | Telat 30–60 menit | persen_per_kejadian | 1 | PMA 11/2019 |
| `telat_61_89` | Telat 61–89 menit | persen_per_kejadian | 1.25 | PMA 11/2019 |
| `telat_90_plus` | Telat ≥90 menit | persen_per_kejadian | 1.5 | PMA 11/2019 |
| `psw_0_29` … `psw_90_plus` | Pulang sebelum waktu (tangga sama) | persen_per_kejadian | 0.5 / 1 / 1.25 / 1.5 | PMA 11/2019 |
| `batas_total` | Batas potongan per bulan | persen_bulanan | 100 | PMA 11/2019 |
| `pph_um_pppk` | PPh uang makan PPPK/gol III | persen_bulanan | 5 | ketentuan pajak |
| `pph_um_gol_iv` | PPh uang makan PNS gol IV | persen_bulanan | 15 | ketentuan pajak |

Jam kerja (`08:00`, `16:30`, `17:00`) dan hari kerja disimpan di tabel `pengaturan`
(kunci `jam_kerja`) karena bukan potongan.

Aturan baru **tidak mengubah** hasil lama: pengajuan menyimpan `aturan_versi` + `aturan_snapshot`.

---

## 5. Berkas presensi & pengajuan

```sql
create table public.file_presensi (
  id            uuid primary key default gen_random_uuid(),
  pegawai_id    uuid not null references public.pegawai(id) on delete cascade,
  nama_asli     text not null,
  drive_file_id text not null unique,       -- id berkas di Google Drive (penyimpanan utama)
  drive_folder_id text,                     -- folder periode di Drive
  drive_link    text,                       -- webViewLink untuk admin
  ukuran        integer not null check (ukuran > 0),
  sha256        text not null,
  tahun         smallint not null check (tahun between 2020 and 2100),
  bulan         smallint not null check (bulan between 1 and 12),
  diunggah_oleh uuid references public.users(id),
  created_at    timestamptz not null default now()
);

create table public.pengajuan_tukin (
  id                uuid primary key default gen_random_uuid(),
  pegawai_id        uuid not null references public.pegawai(id) on delete cascade,
  bidang_id         uuid not null references public.bidang(id),
  tahun             smallint not null check (tahun between 2020 and 2100),
  bulan             smallint not null check (bulan between 1 and 12),
  file_presensi_id  uuid references public.file_presensi(id) on delete set null,
  status            status_pengajuan not null default 'draft',
  dikirim_pada      timestamptz,
  diverifikasi_oleh uuid references public.users(id),
  diverifikasi_pada timestamptz,
  catatan_admin     text,
  izinkan_ulang     boolean not null default false,
  aturan_versi      integer not null,
  aturan_snapshot   jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (pegawai_id, tahun, bulan)          -- cegah pengajuan ganda
);

create index idx_pengajuan_status on public.pengajuan_tukin (status, tahun, bulan);
create index idx_pengajuan_bidang on public.pengajuan_tukin (bidang_id, tahun, bulan);
```

Penyimpanan berkas: **Google Drive** (lihat bagian 10); nama asli tetap disimpan di DB untuk jejak.

---

## 6. Rincian harian & rekap

```sql
create table public.presensi (
  id                bigserial primary key,
  pengajuan_id      uuid not null references public.pengajuan_tukin(id) on delete cascade,
  pegawai_id        uuid not null references public.pegawai(id) on delete cascade,
  tanggal           date not null,
  jenis             jenis_hari not null,
  jam_masuk         time,
  jam_pulang        time,
  menit_telat       integer not null default 0,
  menit_pulang_awal integer not null default 0,
  potongan_kode     text,
  potongan_persen   numeric(6,3) not null default 0,
  keterangan        text,
  anomali           boolean not null default false,
  unique (pengajuan_id, tanggal)
);
create index idx_presensi_pegawai on public.presensi (pegawai_id, tanggal);

create table public.rekap_kehadiran (
  id                      uuid primary key default gen_random_uuid(),
  pengajuan_id            uuid not null unique references public.pengajuan_tukin(id) on delete cascade,
  hari_kerja              smallint not null default 0,
  hadir                   smallint not null default 0,
  telat                   smallint not null default 0,
  pulang_awal             smallint not null default 0,
  tidak_presensi_masuk    smallint not null default 0,
  tidak_presensi_pulang   smallint not null default 0,
  tk                      smallint not null default 0,
  cuti                    smallint not null default 0,
  dinas_luar              smallint not null default 0,
  libur                   smallint not null default 0,
  anomali                 jsonb not null default '[]'::jsonb,
  created_at              timestamptz not null default now()
);

create table public.rekap_tukin (
  id               uuid primary key default gen_random_uuid(),
  pengajuan_id     uuid not null unique references public.pengajuan_tukin(id) on delete cascade,
  tukin_bruto      numeric(12,0) not null default 0,
  pot_tk           numeric(12,0) not null default 0,
  pot_tl           numeric(12,0) not null default 0,
  pot_psw          numeric(12,0) not null default 0,
  pot_hukdis       numeric(12,0) not null default 0,
  pot_tb           numeric(12,0) not null default 0,
  hukdis_pct       numeric(5,2)  not null default 0,   -- diisi admin saat verifikasi
  tb_pct           numeric(5,2)  not null default 0,
  pot_lain         numeric(12,0) not null default 0,
  total_persen     numeric(6,3)  not null default 0,
  total_potongan   numeric(12,0) not null default 0,
  pajak            numeric(12,0) not null default 0,
  tukin_bersih     numeric(12,0) not null default 0,
  rincian          jsonb not null default '{}'::jsonb,   -- persen & rupiah per komponen
  created_at       timestamptz not null default now()
);

create table public.rekap_uang_makan (
  id           uuid primary key default gen_random_uuid(),
  pengajuan_id uuid not null unique references public.pengajuan_tukin(id) on delete cascade,
  hari_hadir   smallint not null default 0,
  tarif        numeric(10,0) not null default 37000,
  bruto        numeric(12,0) not null default 0,
  pph_pct      numeric(5,2)  not null default 5,
  pph          numeric(12,0) not null default 0,
  bersih       numeric(12,0) not null default 0,
  created_at   timestamptz not null default now()
);
```

---

## 7. Penunjang

```sql
create table public.hari_libur (
  tanggal    date primary key,
  keterangan text not null
);

create table public.pengaturan (
  kunci            text primary key,        -- jam_kerja, drive_folder_id, drive_token, ...
  nilai            jsonb not null,
  diperbarui_oleh  uuid references public.users(id),
  updated_at       timestamptz not null default now()
);

create table public.audit_log (
  id          bigserial primary key,
  aktor_id    uuid references public.users(id),
  aksi        text not null,                -- setujui_pengajuan, ubah_aturan, ubah_pegawai, ...
  tabel       text,
  record_id   text,
  data_lama   jsonb,
  data_baru   jsonb,
  ip          inet,
  created_at  timestamptz not null default now()
);
create index idx_audit_waktu on public.audit_log (created_at desc);
```

Token Google Drive disimpan pada `pengaturan` kunci `drive_token` **terenkripsi**
(pgpg/`pgsodium`), hanya admin; tidak pernah dikirim ke browser.

---

## 8. Trigger `updated_at`

```sql
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger trg_users_updated   before update on public.users
  for each row execute function public.set_updated_at();
create trigger trg_pegawai_updated before update on public.pegawai
  for each row execute function public.set_updated_at();
create trigger trg_pengajuan_updated before update on public.pengajuan_tukin
  for each row execute function public.set_updated_at();
create trigger trg_pengaturan_updated before update on public.pengaturan
  for each row execute function public.set_updated_at();
```

---

## 9. Row Level Security

```sql
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
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.peran = 'admin' and u.aktif
  );
$$;

create or replace function public.pegawai_saya() returns uuid
language sql stable security definer set search_path = public as $$
  select p.id from public.pegawai p where p.user_id = auth.uid();
$$;
```

Policy inti (sisanya mengikuti pola yang sama):

```sql
-- admin: akses penuh tabel referensi & hasil
create policy admin_semua_bidang on public.bidang
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy admin_semua_pegawai on public.pegawai
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- pegawai: hanya dirinya
create policy pegawai_baca_diri on public.pegawai
  for select to authenticated using (user_id = auth.uid());

create policy pegawai_baca_pengajuan on public.pengajuan_tukin
  for select to authenticated using (pegawai_id = public.pegawai_saya() or public.is_admin());

create policy pegawai_baca_presensi on public.presensi
  for select to authenticated using (pegawai_id = public.pegawai_saya() or public.is_admin());

create policy pegawai_baca_rekap_kehadiran on public.rekap_kehadiran
  for select to authenticated using (
    exists (select 1 from public.pengajuan_tukin p
            where p.id = pengajuan_id
              and (p.pegawai_id = public.pegawai_saya() or public.is_admin()))
  );

create policy pegawai_baca_aturan on public.aturan_potongan
  for select to authenticated using (aktif or public.is_admin());

-- pendaftaran: hanya admin; pembuatan lewat fungsi server (service role)
create policy admin_pendaftaran on public.pendaftaran
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- audit log: baca admin saja; penulisan lewat service role
create policy admin_baca_audit on public.audit_log
  for select to authenticated using (public.is_admin());

create policy admin_pengaturan on public.pengaturan
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
```

Yang **tidak** diberi policy: `insert`/`update` untuk pegawai pada `pengajuan_tukin`,
`presensi`, `rekap_*`. Semua penulisan lewat fungsi server (service role) setelah validasi,
sehingga pegawai tidak bisa memalsukan hasil perhitungan.

View direktori publik (halaman "DAFTAR PEGAWAI") — hanya kolom non-sensitif:

```sql
create view public.direktori_pegawai as
select p.nama, p.nip_masked, b.nama as bidang, p.jabatan
from public.pegawai p join public.bidang b on b.id = p.bidang_id
where p.aktif;
```

---

## 10. Penyimpanan berkas — Google Drive (keputusan 10 Nov 2026)

Supabase Storage **tidak dipakai**. Berkas presensi dan hasil rekap disimpan di Drive;
database hanya menyimpan metadata.

```
TUKIN/
└── <TAHUN>/
    └── <BULAN>/
        ├── presensi/  <NIP>_Presensi <B>-<TAHUN>.xlsx
        └── hasil/     Rekapitulasi Kehadiran/Tukin/Uang Makan Bimas <BIDANG>[ PNS] <LABEL>.xlsx
```

- Metadata di `file_presensi`: `drive_file_id`, `drive_folder_id`, `drive_link`, `sha256`, `ukuran`,
  `tahun`, `bulan`, `diunggah_oleh`.
- Folder id induk & folder hasil disimpan di `pengaturan` (`drive_folder_id`, `drive_folder_hasil_id`).
- Refresh token OAuth disimpan terenkripsi di `pengaturan` (`drive_token`), hanya admin.
- Akses berkas oleh pegawai memakai **tautan unduhan sementara** yang dibuat fungsi server
  (bukan link publik permanen); berkas tidak perlu disalin ke Supabase.
- Tidak ada policy `storage.objects` yang perlu dibuat.

---

## 11. Seed bidang (11 + 3 yang sudah berjalan)

```sql
insert into public.bidang (kode, nama) values
  ('TU',           'Tata Usaha'),
  ('KANWIL',       'Kanwil'),
  ('PAI',          'PAI'),
  ('BUDDHA',       'Bimas Buddha'),
  ('HINDU',        'Bimas Hindu'),
  ('KRISTEN',      'Bimas Kristen'),
  ('KATOLIK',      'Bimas Katolik'),
  ('PENAISZAWA',   'PenaisZawa'),
  ('PENMAD',       'Penmad'),
  ('PONTREN',      'Pontren'),
  ('URAIS',        'Urais');
```

Roster lama (`aplikasi-offline/APLIKASI/pegawai.js`) dipetakan: `KRISTEN`→`KRISTEN`,
`KATOLIK`→`KATOLIK`, `BUDDHA`→`BUDDHA`; 30 baris diimpor sebagai data awal pegawai.

---

## 12. Catatan migrasi & operasional

- Angka tukin/tarif/PPH berasal dari roster lama; setelah masuk database, admin bisa
  mengoreksi lewat `/admin/pegawai` tanpa deploy.
- Hasil perhitungan lama (September/Oktober 2026) tidak perlu diimpor untuk mulai; bila ingin,
  impor sebagai pengajuan `disetujui` dengan `aturan_versi = 1`.
- Backup: aktifkan backup harian Supabase; ekspor tabel `audit_log` berkala.
- Estimasi volume: ≤ 500 pegawai, ≤ 12 periode/tahun → jauh di bawah kapasitas paket gratis.
