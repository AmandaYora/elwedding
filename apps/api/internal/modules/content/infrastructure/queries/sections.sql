-- name: ListSections :many
SELECT * FROM sections ORDER BY sort_order ASC;

-- name: ListEnabledSections :many
SELECT * FROM sections WHERE is_enabled = TRUE ORDER BY sort_order ASC;

-- name: GetSectionByKey :one
SELECT * FROM sections WHERE section_key = ? LIMIT 1;

-- name: UpdateSection :exec
UPDATE sections SET label = ?, is_enabled = ?, sort_order = ?
WHERE section_key = ?;
