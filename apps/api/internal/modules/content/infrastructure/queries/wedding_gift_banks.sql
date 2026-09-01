-- name: ListWeddingGiftBanks :many
SELECT * FROM wedding_gift_banks ORDER BY sort_order ASC;

-- name: GetWeddingGiftBank :one
SELECT * FROM wedding_gift_banks WHERE id = ? LIMIT 1;

-- name: CreateWeddingGiftBank :execlastid
INSERT INTO wedding_gift_banks (bank_name, account_number, account_name, sort_order)
VALUES (?, ?, ?, ?);

-- name: UpdateWeddingGiftBank :exec
UPDATE wedding_gift_banks SET bank_name=?, account_number=?, account_name=?, sort_order=?
WHERE id = ?;

-- name: DeleteWeddingGiftBank :exec
DELETE FROM wedding_gift_banks WHERE id = ?;
