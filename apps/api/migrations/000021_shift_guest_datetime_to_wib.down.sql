-- Membatalkan geseran +7 jam (docs/plan/timezone-wib/PLAN.md T3).
--
-- Simetris persis dengan .up.sql: kolom yang sama, penjaga yang sama, hanya
-- arah intervalnya yang dibalik. Karena keduanya simetris, `down` lalu `up`
-- mengembalikan data ke keadaan yang sama - tidak ada akumulasi geseran.
--
-- DIPAKAI KAPAN: bila §10 PLAN.md langkah 4 menunjukkan kolom TIMESTAMP
-- (tanggal dibuat di menu Group/Pengguna) justru MAJU 7 jam, berarti migrasi
-- ini salah cakupan dan harus dibatalkan lebih dulu sebelum diperbaiki.
--
-- `updated_at = updated_at` dan `WHERE ... IS NOT NULL` dipertahankan dengan
-- alasan yang sama seperti di .up.sql - lihat komentar lengkapnya di sana.

UPDATE guests
   SET rsvp_responded_at = rsvp_responded_at - INTERVAL 7 HOUR,
       updated_at = updated_at
 WHERE rsvp_responded_at IS NOT NULL;

UPDATE guests
   SET checked_in_at = checked_in_at - INTERVAL 7 HOUR,
       updated_at = updated_at
 WHERE checked_in_at IS NOT NULL;

UPDATE guests
   SET contacted_at = contacted_at - INTERVAL 7 HOUR,
       updated_at = updated_at
 WHERE contacted_at IS NOT NULL;
