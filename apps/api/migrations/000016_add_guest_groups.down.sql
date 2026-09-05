-- Urutannya TERBALIK dan itu wajib: FK harus lepas sebelum kolomnya bisa
-- jatuh, dan tabel guest_groups sebelum itu masih dirujuk FK tersebut.
-- DROP COLUMN ikut membuang idx_guests_group_id.
ALTER TABLE guests DROP FOREIGN KEY fk_guests_group_id;
ALTER TABLE guests DROP COLUMN group_id;
DROP TABLE guest_groups;
