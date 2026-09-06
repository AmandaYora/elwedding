-- Jatah kursi (pax quota) - docs/plan/guest-pax-quota/PLAN.md T1/D1/D2.
--
-- MASALAH YANG DIPECAHKAN: `attending_count` dikunci mati di 1 atau 2
-- (resolveAttendingCount, migration 000007), padahal undangan keluarga
-- ("paman + istri + 2 anak") nyata-nyata lebih dari 2 orang. Akibatnya angka
-- pax untuk catering SELALU bias ke bawah, dan biasnya justru terkonsentrasi
-- di undangan yang pax-nya paling besar.
--
-- DUA LAPIS, bukan satu (K3 plan ini):
--   guest_groups.default_pax -> angka AWAL saat input tamu baru
--   guests.pax_quota         -> SUMBER KEBENARAN per tamu, yang mengikat
--
-- Kenapa kuota TIDAK CUKUP hidup di group saja: group "Keluarga" berisi Paman
-- Budi (istri + 4 anak = 6) DAN Bulek Sri (janda, sendiri = 1). Tidak ada satu
-- angka yang benar untuk seluruh group. Kalau jatah hanya di group, satu-
-- satunya jalan keluar adalah bikin group palsu "Keluarga 6"/"Keluarga 1", dan
-- group berhenti berfungsi sebagai pengelompokan - padahal ia juga dipakai
-- filter daftar Tamu (D2 guest-groups) dan layar Scan (D8 guest-groups).
--
-- DEFAULT 2 pada KEDUANYA adalah inti D1: batas efektif hari ini memang 2,
-- jadi seluruh baris lama langsung BENAR tanpa backfill dan tanpa satu pun
-- baris yang perlu disentuh. Pola identik `attending_count TINYINT UNSIGNED
-- NOT NULL DEFAULT 1` (migration 000007).
--
-- TANPA INDEX (disengaja): satu-satunya pembacaan kedua kolom ini adalah
-- agregasi full-scan di CountGuestsGroupedBySide dan lookup per baris lewat
-- `id`/`token` yang sudah ber-index. Alasan yang sama dengan `checked_in_at`
-- di migration 000014. Index pada kolom berkardinalitas rendah seperti ini
-- justru tidak akan dipakai optimizer.
--
-- MEMBALIK K3 guest-groups ("Isi satu Group: nama + deskripsi saja. Tanpa
-- warna, nomor meja, MAUPUN KUOTA"). K3 diputuskan ketika belum ada
-- requirement pax sama sekali - waktu itu kuota adalah fitur spekulatif tanpa
-- pemakai, dan menolaknya benar. Sekarang requirement-nya nyata. Pembalikan
-- ini DICATAT, bukan disamarkan - preseden yang sama dipakai migration 000015
-- yang membalik "semua admin setara/tanpa role". Lihat §2 PLAN.md.
ALTER TABLE guests
  ADD COLUMN pax_quota TINYINT UNSIGNED NOT NULL DEFAULT 2 AFTER attending_count;

ALTER TABLE guest_groups
  ADD COLUMN default_pax TINYINT UNSIGNED NOT NULL DEFAULT 2 AFTER description;
