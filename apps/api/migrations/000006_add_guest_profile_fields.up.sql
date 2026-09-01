-- Menambah field profil tamu (PLAN.md docs/plan/guest-fields-admin-layout).
-- `gender` NULLABLE (keputusan #9): tidak ada default yang benar-benar
-- akurat untuk baris existing, jadi NULL = "belum diketahui" sampai
-- baris itu disunting lewat form yang mewajibkannya.
-- `invitation_type`/`souvenir_type` NOT NULL DEFAULT (keputusan #10): seluruh
-- alur RSVP sekarang berbasis link/token per tamu, jadi baris existing
-- memang tamu undangan online dengan souvenir reguler (baseline non-VIP).
ALTER TABLE guests
  ADD COLUMN gender ENUM('male', 'female') NULL AFTER name,
  ADD COLUMN invitation_type ENUM('online', 'physical') NOT NULL DEFAULT 'online' AFTER side,
  ADD COLUMN souvenir_type ENUM('regular', 'vip') NOT NULL DEFAULT 'regular' AFTER invitation_type,
  ADD COLUMN email VARCHAR(255) NOT NULL DEFAULT '' AFTER souvenir_type,
  ADD COLUMN address TEXT NULL AFTER phone,
  ADD COLUMN notes TEXT NULL AFTER address;
