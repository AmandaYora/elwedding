-- PLAN.md docs/plan/dashboard-wa-rsvp §6.1.
-- attending_count: jumlah tamu yang datang (1 atau 2), diisi TAMU saat RSVP
-- 'attending' - untuk kebutuhan pax makanan. Default 1 supaya baris lama
-- (attending sebelum fitur ini ada) tetap sahih dihitung SUM tanpa COALESCE.
-- is_expected_attending: dugaan ADMIN, terpisah dari rsvp_status milik
-- tamu (keputusan #1) - default TRUE supaya baris lama tidak berubah makna.
ALTER TABLE guests
  ADD COLUMN attending_count TINYINT UNSIGNED NOT NULL DEFAULT 1 AFTER rsvp_status,
  ADD COLUMN is_expected_attending BOOLEAN NOT NULL DEFAULT TRUE AFTER souvenir_type;
