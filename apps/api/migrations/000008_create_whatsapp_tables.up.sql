-- Modul `whatsapp` (PLAN.md docs/plan/dashboard-wa-rsvp §6.2/§4).
-- Sesi WhatsApp (device & kunci enkripsi) TIDAK disimpan di sini - whatsmeow
-- tidak mendukung MySQL, disimpan di file SQLite terpisah (WA_STORE_DIR).
CREATE TABLE whatsapp_config (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  message_template TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

-- Singleton id=1, mengikuti pola invitation_content (migration 000004).
INSERT INTO whatsapp_config (id, message_template, is_enabled) VALUES (
  1,
  'Halo {nama}! Terima kasih telah mengonfirmasi kehadiran ({jumlah} orang) di pernikahan {mempelai} pada {tanggal}. Berikut QR code konfirmasi Anda.',
  TRUE
);

-- guest_id disimpan sebagai ID primitif TANPA foreign key (aturan modular
-- monolith - modul whatsapp tidak boleh punya FK ke tabel modul guest).
-- Kolom snapshot (guest_name, phone, qr_payload, couple_name,
-- event_date_label) WAJIB diisi supaya Resend bisa menyusun ulang pesan
-- tanpa membaca tabel guests/invitation_content milik modul lain
-- (keputusan #12 & #19 PLAN.md).
CREATE TABLE whatsapp_send_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  guest_id BIGINT UNSIGNED NOT NULL,
  guest_name VARCHAR(255) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  qr_payload TEXT NOT NULL,
  couple_name VARCHAR(255) NOT NULL,
  event_date_label VARCHAR(100) NOT NULL,
  status ENUM('pending', 'sent', 'failed') NOT NULL DEFAULT 'pending',
  error_message TEXT NULL,
  sent_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_wa_logs_status (status),
  KEY idx_wa_logs_created_at (created_at)
);
