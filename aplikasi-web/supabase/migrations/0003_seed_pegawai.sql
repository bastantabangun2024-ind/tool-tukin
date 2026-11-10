-- 0003_seed_pegawai.sql — HASIL GENERATE, jangan diedit manual.
-- Sumber: aplikasi-offline/APLIKASI/pegawai.js (30 pegawai)
-- Dibuat oleh: node scripts/buat-seed-pegawai.mjs
-- Bidang yang dipakai roster: KRISTEN, KATOLIK, BUDDHA

begin;

insert into public.pegawai
  (nip, nama, nama_key, status_kepegawaian, golongan, ruang, jabatan, kelas_jabatan,
   bidang_id, tukin, tarif_uang_makan, pph_pct)
select v.nip, v.nama, v.nama_key, v.status_kepegawaian::public.status_kepegawaian,
       v.golongan, v.ruang, v.jabatan, v.kelas_jabatan,
       b.id, v.tukin, v.tarif_uang_makan, v.pph_pct
from (values
  ('197904112025211007', 'ARDI ELISMAN SITUMORANG, S.Th.', 'ARDI', 'PPPK', 'IX', null, 'Penyuluh Agama Ahli Pertama', 'IX', 3319000, 37000, 5, 'KRISTEN'),
  ('199312072025212004', 'CHRISTIN YOLANDA DAMANIK, S.Pd.K', 'CHRISTIN', 'PPPK', 'IX', null, 'Penyuluh Agama Ahli Pertama', 'IX', 3319000, 37000, 5, 'KRISTEN'),
  ('198511052025211012', 'DAVID HADAMEAN NAPITUPULU, S.Pd', 'DAVID', 'PPPK', 'IX', null, 'Penyuluh Agama Ahli Pertama', 'IX', 3319000, 37000, 5, 'KRISTEN'),
  ('198710242025211013', 'DAVID, S.Pd', 'DAVID', 'PPPK', 'IX', null, 'Penyuluh Agama Ahli Pertama', 'IX', 3319000, 37000, 5, 'KRISTEN'),
  ('198204142025211012', 'DONNI SIHOMBING, S.Th', 'DONNI', 'PPPK', 'IX', null, 'Penyuluh Agama Ahli Pertama', 'IX', 3319000, 37000, 5, 'KRISTEN'),
  ('198402252025212014', 'EFRICA SARITA MUNTE, S.PAK', 'EFRICA', 'PPPK', 'IX', null, 'Penyuluh Agama Ahli Pertama', 'IX', 3319000, 37000, 5, 'KRISTEN'),
  ('198612292025212013', 'ELIANNA BR TARIGAN, S. Pd', 'ELIANNA', 'PPPK', 'IX', null, 'Penyuluh Agama Ahli Pertama', 'IX', 3319000, 37000, 5, 'KRISTEN'),
  ('197610302025212003', 'ERVINA ROLASNY MARGARETHA, S.Pd.K', 'ERVINA', 'PPPK', 'IX', null, 'Penyuluh Agama Ahli Pertama', 'IX', 3319000, 37000, 5, 'KRISTEN'),
  ('198706062025211010', 'HENDRO SAMBUR, S.Th.', 'HENDRO', 'PPPK', 'IX', null, 'Penyuluh Agama Ahli Pertama', 'IX', 3319000, 37000, 5, 'KRISTEN'),
  ('197911052023212016', 'JUDIKA DUMASARI, S.Th.', 'JUDIKA', 'PPPK', 'IX', null, 'Penyuluh Agama Ahli Pertama', 'IX', 3319000, 37000, 5, 'KRISTEN'),
  ('199005122025211007', 'LUCKIMAI SABABALAT, S.Th', 'LUCKIMAI', 'PPPK', 'IX', null, 'Penyuluh Agama Ahli Pertama', 'IX', 3319000, 37000, 5, 'KRISTEN'),
  ('197812102025211011', 'MARDIN LAOLI, S.Pd', 'MARDIN', 'PPPK', 'IX', null, 'Penyuluh Agama Ahli Pertama', 'IX', 3319000, 37000, 5, 'KRISTEN'),
  ('198012062025212005', 'MAYANI, S.Th.', 'MAYANI', 'PPPK', 'IX', null, 'Penyuluh Agama Ahli Pertama', 'IX', 3319000, 37000, 5, 'KRISTEN'),
  ('198205152023212036', 'NELLY NABABAN, S.Th.', 'NELLY', 'PPPK', 'IX', null, 'Penyuluh Agama Ahli Pertama', 'IX', 3319000, 37000, 5, 'KRISTEN'),
  ('198609032025212014', 'NELLY SUFRYANTI, S.Pd', 'NELLY', 'PPPK', 'IX', null, 'Penyuluh Agama Ahli Pertama', 'IX', 3319000, 37000, 5, 'KRISTEN'),
  ('198909062023212040', 'PIPIH, S.Th.', 'PIPIH', 'PPPK', 'IX', null, 'Penyuluh Agama Ahli Pertama', 'IX', 3319000, 37000, 5, 'KRISTEN'),
  ('198711242025212020', 'RUSMIDAWATI BUTAR BUTAR, S.Pd.K', 'RUSMIDAWATI', 'PPPK', 'IX', null, 'Penyuluh Agama Ahli Pertama', 'IX', 3319000, 37000, 5, 'KRISTEN'),
  ('198311122025212012', 'RUTH, S.Pd', 'RUTH', 'PPPK', 'IX', null, 'Penyuluh Agama Ahli Pertama', 'IX', 3319000, 37000, 5, 'KRISTEN'),
  ('197802152025211008', 'SABAR SIMANULLANG, S. Th', 'SABAR', 'PPPK', 'IX', null, 'Penata Layanan Operasional', 'VII', 2928000, 37000, 5, 'KRISTEN'),
  ('198412092025211006', 'SUTIKNO TAMPUBOLON, S.Pd', 'SUTIKNO', 'PPPK', 'IX', null, 'Penyuluh Agama Ahli Pertama', 'IX', 3319000, 37000, 5, 'KRISTEN'),
  ('198302112025212005', 'ELIYANI BR GINTING, S.S', 'ELIYANI', 'PPPK', 'IX', null, 'Penyuluh Agama Ahli Pertama', 'IX', 3319000, 37000, 5, 'KATOLIK'),
  ('198806202025212002', 'LUSIANA ROTUA NAIBAHO, S.Ag', 'LUSIANA', 'PPPK', 'IX', null, 'Penyuluh Agama Ahli Pertama', 'IX', 3319000, 37000, 5, 'KATOLIK'),
  ('198612052025212014', 'MARLIANA SIBAGARIANG, A.Md', 'MARLIANA', 'PPPK', 'VII', null, 'Pengelola Layanan Operasional (Jabatan Pelaksana)', 'VII', 2702000, 35000, 5, 'KATOLIK'),
  ('198810312025211009', 'ADES SUSANTO, S.Pd.B', 'ADES', 'PPPK', 'IX', null, 'Penata Layanan Operasional', 'IX', 2928000, 37000, 5, 'BUDDHA'),
  ('196905242025211003', 'ANSANI, S.E', 'ANSANI', 'PPPK', 'IX', null, 'Penyuluh Agama Ahli Pertama', 'IX', 3319000, 37000, 5, 'BUDDHA'),
  ('199408312025211010', 'WINNER, S.Kom', 'WINNER', 'PPPK', 'VII', null, 'Pengelola Layanan Operasional (Jabatan Pelaksana)', 'VII', 2702000, 35000, 5, 'BUDDHA'),
  ('197203181999031002', 'Dr. SAMAREL TELAUM BANUA, S PAK, M.Pd.', 'SAMAREL', 'PNS', 'IV', 'b', 'Pembimbing Masyarakat', 'X', 4551000, 41000, 15, 'KRISTEN'),
  ('198605162020121008', 'BASTANTA, S.S.', 'BASTANTA', 'PNS', 'III', 'b', 'Penelaah Teknis Kebijakan', 'VII', 2928000, 37000, 5, 'KRISTEN'),
  ('197402042002121001', 'BARON FERRY SON PANDIANGAN, S.Ag, M.Th', 'BARON', 'PNS', 'IV', 'a', 'Pembimbing Masyarakat', 'X', 4551000, 41000, 15, 'KATOLIK'),
  ('197406112009121001', 'SUWARNO, S.Ag, M.Pd', 'SUWARNO', 'PNS', 'IV', 'a', 'Pembimbing Masyarakat', 'X', 4551000, 41000, 15, 'BUDDHA')
) as v(nip, nama, nama_key, status_kepegawaian, golongan, ruang, jabatan, kelas_jabatan,
       tukin, tarif_uang_makan, pph_pct, bidang_kode)
join public.bidang b on b.kode = v.bidang_kode
on conflict (nip) do update set
  nama               = excluded.nama,
  nama_key           = excluded.nama_key,
  status_kepegawaian = excluded.status_kepegawaian,
  golongan           = excluded.golongan,
  ruang              = excluded.ruang,
  jabatan            = excluded.jabatan,
  kelas_jabatan      = excluded.kelas_jabatan,
  bidang_id          = excluded.bidang_id,
  tukin              = excluded.tukin,
  tarif_uang_makan   = excluded.tarif_uang_makan,
  pph_pct            = excluded.pph_pct;

commit;
