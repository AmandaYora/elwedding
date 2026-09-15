-- Ketahanan koneksi WhatsApp (docs/plan/whatsapp-connection-resilience/PLAN.md
-- T1, keputusan D1). Antrian retry = baris whatsapp_send_logs yang sudah ada,
-- TANPA tabel baru: snapshot di tiap baris (guest_name, phone, qr_payload,
-- couple_name, event_date_label, attending_count) sudah memuat seluruh yang
-- dibutuhkan untuk kirim ulang tanpa menyentuh tabel modul lain.
ALTER TABLE whatsapp_send_logs
  ADD COLUMN retry_count TINYINT UNSIGNED NOT NULL DEFAULT 0,
  ADD COLUMN next_retry_at DATETIME NULL;

ALTER TABLE whatsapp_send_logs
  MODIFY COLUMN status ENUM('pending','sent','failed','retrying') NOT NULL DEFAULT 'pending';

-- Melayani ListRetryableSendLogs (status='retrying' AND next_retry_at <= ?
-- ORDER BY next_retry_at): filter dan sort sekaligus. idx_wa_logs_status yang
-- lama SENGAJA dipertahankan - query reap (status='pending' AND created_at < ?)
-- tetap terlayani index itu; menghapusnya regresi, bukan penghematan.
CREATE INDEX idx_wa_logs_retry ON whatsapp_send_logs (status, next_retry_at);
