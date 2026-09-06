-- Kebalikan 000017. Menghapus kolomnya membuang seluruh jatah kursi yang sudah
-- disunting admin (dan `attending_count` tamu kembali terbatas 1-2 lewat
-- resolveAttendingCount) - tapi TIDAK ada data tamu lain yang ikut hilang.
ALTER TABLE guests
  DROP COLUMN pax_quota;

ALTER TABLE guest_groups
  DROP COLUMN default_pax;
