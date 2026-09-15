-- Ucapan tamu (docs/plan/wedding-wish/PLAN.md T1/D5). Tabel KETIGA milik modul
-- `guest` (preseden guest_groups, migration 000016): yang dilarang aturan
-- modular monolith adalah join & FK LINTAS modul, bukan satu modul memiliki
-- banyak tabel.
--
-- UNIQUE(guest_id) adalah penegak "sekali saja" di level DB (lapis kedua;
-- lapis pertama validasi di service yang memberi pesan enak dibaca).
-- is_hidden BOOLEAN, bukan ENUM status: hanya dua keadaan yang diminta (D2).
-- FK ON DELETE CASCADE (berbeda dari fk_guests_group_id yang RESTRICT):
-- ucapan tidak bermakna tanpa pengirimnya, dan tanpa CASCADE baris yatim
-- tetap memakan UNIQUE(guest_id).
CREATE TABLE wedding_wishes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  guest_id BIGINT UNSIGNED NOT NULL,
  message VARCHAR(500) NOT NULL,
  is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_wedding_wishes_guest_id (guest_id),
  KEY idx_wedding_wishes_visible (is_hidden, created_at),
  CONSTRAINT fk_wedding_wishes_guest_id FOREIGN KEY (guest_id)
    REFERENCES guests(id) ON DELETE CASCADE
);
