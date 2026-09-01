-- name: ListRundownItems :many
SELECT * FROM rundown_items ORDER BY sort_order ASC;

-- name: GetRundownItem :one
SELECT * FROM rundown_items WHERE id = ? LIMIT 1;

-- name: CreateRundownItem :execlastid
INSERT INTO rundown_items (group_label, time_label, activity_text, sort_order)
VALUES (?, ?, ?, ?);

-- name: UpdateRundownItem :exec
UPDATE rundown_items SET group_label=?, time_label=?, activity_text=?, sort_order=?
WHERE id = ?;

-- name: DeleteRundownItem :exec
DELETE FROM rundown_items WHERE id = ?;
