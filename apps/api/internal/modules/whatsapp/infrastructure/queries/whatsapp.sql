-- name: GetWhatsAppConfig :one
SELECT * FROM whatsapp_config WHERE id = 1 LIMIT 1;

-- name: UpdateWhatsAppConfig :exec
UPDATE whatsapp_config SET message_template = ?, invitation_template = ?, is_enabled = ? WHERE id = 1;

-- name: InsertSendLog :execlastid
INSERT INTO whatsapp_send_logs (guest_id, guest_name, phone, qr_payload, couple_name, event_date_label, attending_count, status)
VALUES (?, ?, ?, ?, ?, ?, ?, ?);

-- name: UpdateSendLogStatus :exec
-- Ikut mengosongkan jadwal retry saat baris mencapai keadaan terminal.
-- Params struct TIDAK berubah karena NULL ditulis sebagai literal.
UPDATE whatsapp_send_logs SET status = ?, error_message = ?, sent_at = ?, next_retry_at = NULL WHERE id = ?;

-- name: GetSendLogByID :one
SELECT * FROM whatsapp_send_logs WHERE id = ? LIMIT 1;

-- name: ListSendLogs :many
SELECT * FROM whatsapp_send_logs ORDER BY created_at DESC LIMIT ? OFFSET ?;

-- name: CountSendLogs :one
SELECT COUNT(*) FROM whatsapp_send_logs;

-- name: ScheduleSendLogRetry :exec
-- retry_count ditulis sebagai nilai ABSOLUT (bukan retry_count + 1), supaya
-- jalur Resend manual yang mengoper retryCount = 0 benar-benar mengulang
-- hitungan dari awal (whatsapp-connection-resilience §5.3.1).
UPDATE whatsapp_send_logs
SET status = 'retrying', error_message = ?, retry_count = ?, next_retry_at = ?
WHERE id = ?;

-- name: ListRetryableSendLogs :many
-- Filter dan sort keduanya terlayani idx_wa_logs_retry (status, next_retry_at).
SELECT * FROM whatsapp_send_logs
WHERE status = 'retrying' AND next_retry_at IS NOT NULL AND next_retry_at <= ?
ORDER BY next_retry_at ASC
LIMIT ?;

-- name: ReapStalePendingSendLogs :exec
-- Baris 'pending' yang tertinggal karena API mati di tengah kirim dijadwalkan
-- ulang, bukan dibiarkan menggantung selamanya (menutup G6).
-- COALESCE menjaga pesan error yang sudah ada agar tidak tertimpa: hari ini
-- baris 'pending' selalu ber-error_message NULL (hanya InsertSendLog yang
-- menulis status itu), jadi ini pengamanan terhadap perubahan di kemudian hari,
-- bukan perbaikan bug yang aktif.
UPDATE whatsapp_send_logs
SET status = 'retrying',
    next_retry_at = ?,
    error_message = COALESCE(error_message, 'proses kirim terputus, dijadwalkan ulang')
WHERE status = 'pending' AND created_at < ?;
