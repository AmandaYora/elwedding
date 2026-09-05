-- Kehadiran nyata di gate - docs/plan/scan-checkin-gate/PLAN.md T1/§2.2.
-- Kolom yang sudah ada TIDAK bisa dipakai untuk ini: `attending_count` adalah
-- janji tamu saat RSVP dan `is_expected_attending` dugaan admin (migration
-- 000007), sedangkan `rsvp_status` niat - tidak satu pun bukti tamu benar
-- benar tiba.
--
-- NULL DISENGAJA (beda dari pola `NOT NULL DEFAULT ''` kolom teks di repo
-- ini): NULL berarti "belum datang", dan justru NULL itulah yang menjadi
-- syarat UPDATE bersyarat `WHERE id = ? AND checked_in_at IS NULL` (D5) -
-- satu-satunya hal yang membuat dua petugas yang memindai QR yang sama
-- tidak saling menimpa jam kedatangan.
--
-- TANPA index: satu-satunya jalur baca adalah lookup per tamu lewat
-- token/id yang sudah ber-index, dan §3.2 menutup semua fitur yang akan
-- memfilter kolom ini (tidak ada penghitung progres, tidak ada laporan).
ALTER TABLE guests
  ADD COLUMN checked_in_at DATETIME NULL AFTER attending_count;
