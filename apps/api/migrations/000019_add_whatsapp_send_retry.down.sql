-- Kebalikan 000019. Urutan UPDATE sebelum MODIFY bersifat wajib: enum tiga
-- nilai tidak bisa menampung baris 'retrying', jadi baris itu dipetakan ke
-- 'failed' (masih bisa dikirim ulang manual oleh admin) lebih dulu.
DROP INDEX idx_wa_logs_retry ON whatsapp_send_logs;

UPDATE whatsapp_send_logs SET status='failed' WHERE status='retrying';

ALTER TABLE whatsapp_send_logs
  MODIFY COLUMN status ENUM('pending','sent','failed') NOT NULL DEFAULT 'pending';

ALTER TABLE whatsapp_send_logs
  DROP COLUMN next_retry_at,
  DROP COLUMN retry_count;
