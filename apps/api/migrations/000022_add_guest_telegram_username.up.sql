-- Username Telegram tamu untuk pengiriman QR otomatis lewat akun pengguna
-- (userbot MTProto, modul `telegram`).
--
-- VARCHAR NOT NULL DEFAULT '' (pola `phone`/`email`), BUKAN NULL: "tidak punya
-- Telegram" = string kosong, tanpa makna ketiga. Tanpa index: hanya dibaca
-- per baris di daftar tamu yang sudah dipaginasi, tidak pernah jadi kunci
-- WHERE maupun ORDER BY - alasan yang sama dengan `contacted_at`
-- (migration 000018).
--
-- Validasi format (@ opsional, 5-32 char a-z/0-9/_) ditegakkan di service,
-- bukan CHECK constraint: pesan error-nya harus layak dibaca admin.
ALTER TABLE guests
  ADD COLUMN username_telegram VARCHAR(64) NOT NULL DEFAULT '' AFTER email;
