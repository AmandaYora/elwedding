-- Kebalikan 000018. Menghapus kolomnya membuang seluruh catatan siapa yang
-- sudah dihubungi; tidak ada data tamu lain yang ikut hilang.
ALTER TABLE guests
  DROP COLUMN contacted_at;
