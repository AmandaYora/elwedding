-- Kebalikan migration 000022.
ALTER TABLE guests
  DROP COLUMN username_telegram;
