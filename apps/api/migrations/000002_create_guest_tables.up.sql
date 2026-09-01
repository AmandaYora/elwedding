-- Modul `guest` (PLAN.md §5.1/§9). `token` UNIQUE + index wajib (PLAN.md §3):
-- setiap tamu membuka link personal lewat token ini (resolve-by-token adalah
-- endpoint publik paling sering dipanggil setelah /public/invitation), tanpa
-- index unik tiap kunjungan tamu memicu full table scan.
CREATE TABLE guests (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(50) NOT NULL DEFAULT '',
  side ENUM('groom', 'bride') NOT NULL,
  token VARCHAR(64) NOT NULL,
  rsvp_status ENUM('pending', 'attending', 'not_attending', 'remind_later') NOT NULL DEFAULT 'pending',
  rsvp_responded_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_guests_token (token),
  KEY idx_guests_rsvp_status (rsvp_status)
);
