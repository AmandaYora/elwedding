-- Group tamu - docs/plan/guest-groups/PLAN.md T1/§2.1.
--
-- Tabel BARU, bukan kolom baru pada `guests`: tiga kolom yang terlihat mirip
-- pengelompokan (`side`, `invitation_type`, `souvenir_type`) semuanya ENUM
-- bernilai tetap yang hanya bisa berubah lewat migration, sedangkan group
-- harus bisa dibuat & dihapus admin lewat UI kapan saja (§2.1).
--
-- Pemiliknya modul `guest` (D1), jadi `guests.group_id` adalah relasi
-- INTRA-modul: FK & JOIN sah dipakai, dan tidak ada contracts/ maupun module
-- client yang perlu dibangun (.claude/rules/backend-modular-monolith.md
-- melarang FK LINTAS modul, bukan satu modul memiliki banyak tabel - modul
-- content sudah punya 7).
--
-- `description` VARCHAR(255) NOT NULL DEFAULT '' dan BUKAN TEXT (D6): MySQL
-- melarang DEFAULT pada kolom TEXT - itulah sebabnya address/notes di repo
-- ini terpaksa `TEXT NULL` + helper nullableText di service. Deskripsi group
-- adalah label pendek, jadi VARCHAR menghindari seluruh penanganan NULL.
-- Preseden: `email VARCHAR(255) NOT NULL DEFAULT ''` (migration 000006).
--
-- `name` UNIQUE (D5): dua group bernama "Keluarga" membuat dropdown tidak
-- bisa dibedakan dan layar scan ambigu.
CREATE TABLE guest_groups (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(255) NOT NULL DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_guest_groups_name (name)
);

-- group_id NULL DISENGAJA (K2/§2.6): seluruh baris tamu yang sudah ada tidak
-- berubah - mereka bergroup kosong sampai disunting, tidak dikarang-karangkan
-- masuk group palsu. Yang MEWAJIBKAN group adalah Create/Update di service
-- (D4), bukan skema - pola yang sama persis dengan kolom `gender` sejak
-- migration 000006.
--
-- Index idx_guests_group_id dipakai DUA jalur: filter tamu per group di
-- ListGuestsFiltered dan COUNT penjaga hapus (K4).
--
-- FK dibiarkan ON DELETE RESTRICT (default, D7): K4 sudah ditegakkan di
-- service dengan pesan yang enak dibaca; FK adalah lapis kedua yang menjamin
-- tidak ada jalur lain (skrip, query manual) yang bisa menyisakan group_id
-- menggantung.
ALTER TABLE guests
  ADD COLUMN group_id BIGINT UNSIGNED NULL AFTER side,
  ADD KEY idx_guests_group_id (group_id),
  ADD CONSTRAINT fk_guests_group_id FOREIGN KEY (group_id) REFERENCES guest_groups(id);
