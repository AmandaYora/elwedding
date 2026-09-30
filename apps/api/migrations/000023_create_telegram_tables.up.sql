-- Modul `telegram` (userbot MTProto, gotd/td) - cermin tabel modul `whatsapp`
-- (migration 000008 + 000019).
--
-- Sesi Telegram (auth key userbot) TIDAK disimpan di sini - gotd/td memakai
-- file sesi sendiri di TG_SESSION_PATH (default ./tg-store/session.json),
-- sejajar WA_STORE_DIR milik whatsmeow. File itu wajib ikut volume persisten:
-- kalau hilang, akun harus login ulang lewat kode OTP + password 2FA.
CREATE TABLE telegram_config (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  message_template TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

-- Singleton id=1, mengikuti pola whatsapp_config (migration 000008).
-- Placeholder SAMA dengan jalur WA: {nama}, {jumlah}, {mempelai}, {tanggal}.
INSERT INTO telegram_config (id, message_template, is_enabled) VALUES (
  1,
  'Halo {nama}! Terima kasih telah mengonfirmasi kehadiran ({jumlah} orang) di pernikahan {mempelai} pada {tanggal}. Berikut QR code konfirmasi Anda.',
  TRUE
);

-- guest_id disimpan sebagai ID primitif TANPA foreign key (aturan modular
-- monolith - modul telegram tidak boleh punya FK ke tabel modul guest).
-- Kolom snapshot (guest_name, telegram_username, qr_payload, couple_name,
-- event_date_label, attending_count) WAJIB diisi supaya Resend/retry bisa
-- menyusun ulang pesan tanpa membaca tabel guests/invitation_content milik
-- modul lain - keputusan yang sama dengan whatsapp_send_logs (#12 & #19).
--
-- Kolom retry (retry_count, next_retry_at, status 'retrying') langsung ikut
-- sejak awal: diambil dari pelajaran whatsapp-connection-resilience, bukan
-- ditambah belakangan seperti migration 000019.
CREATE TABLE telegram_send_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  guest_id BIGINT UNSIGNED NOT NULL,
  guest_name VARCHAR(255) NOT NULL,
  telegram_username VARCHAR(64) NOT NULL,
  qr_payload TEXT NOT NULL,
  couple_name VARCHAR(255) NOT NULL,
  event_date_label VARCHAR(100) NOT NULL,
  attending_count TINYINT UNSIGNED NOT NULL DEFAULT 1,
  status ENUM('pending', 'sent', 'failed', 'retrying') NOT NULL DEFAULT 'pending',
  error_message TEXT NULL,
  sent_at DATETIME NULL,
  retry_count TINYINT UNSIGNED NOT NULL DEFAULT 0,
  next_retry_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_tg_logs_status (status),
  KEY idx_tg_logs_created_at (created_at),
  KEY idx_tg_logs_retry (status, next_retry_at)
);
