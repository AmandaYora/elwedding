-- Koreksi ditemukan saat implementasi PLAN.md docs/plan/dashboard-wa-rsvp:
-- placeholder template {jumlah} dan Resend butuh attending_count, tapi
-- SendQRInput/whatsapp_send_logs (migration 000008) tidak menyimpannya -
-- Resend tidak bisa menyusun ulang caption yang sama tanpa ini.
ALTER TABLE whatsapp_send_logs
  ADD COLUMN attending_count TINYINT UNSIGNED NOT NULL DEFAULT 1 AFTER event_date_label;
