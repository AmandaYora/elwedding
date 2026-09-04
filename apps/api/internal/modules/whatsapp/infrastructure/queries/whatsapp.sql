-- name: GetWhatsAppConfig :one
SELECT * FROM whatsapp_config WHERE id = 1 LIMIT 1;

-- name: UpdateWhatsAppConfig :exec
UPDATE whatsapp_config SET message_template = ?, invitation_template = ?, is_enabled = ? WHERE id = 1;

-- name: InsertSendLog :execlastid
INSERT INTO whatsapp_send_logs (guest_id, guest_name, phone, qr_payload, couple_name, event_date_label, attending_count, status)
VALUES (?, ?, ?, ?, ?, ?, ?, ?);

-- name: UpdateSendLogStatus :exec
UPDATE whatsapp_send_logs SET status = ?, error_message = ?, sent_at = ? WHERE id = ?;

-- name: GetSendLogByID :one
SELECT * FROM whatsapp_send_logs WHERE id = ? LIMIT 1;

-- name: ListSendLogs :many
SELECT * FROM whatsapp_send_logs ORDER BY created_at DESC LIMIT ? OFFSET ?;

-- name: CountSendLogs :one
SELECT COUNT(*) FROM whatsapp_send_logs;
