-- name: CreateGuest :execlastid
INSERT INTO guests (name, phone, side, token, rsvp_status, gender, invitation_type, souvenir_type, email, address, notes, is_expected_attending)
VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?);

-- name: GetGuestByID :one
SELECT * FROM guests WHERE id = ? LIMIT 1;

-- name: GetGuestByToken :one
SELECT * FROM guests WHERE token = ? LIMIT 1;

-- name: UpdateGuest :exec
UPDATE guests SET name = ?, phone = ?, side = ?, gender = ?, invitation_type = ?, souvenir_type = ?, email = ?, address = ?, notes = ?, is_expected_attending = ?
WHERE id = ?;

-- name: UpdateGuestRsvpStatusByToken :exec
UPDATE guests SET rsvp_status = ?, attending_count = ?, rsvp_responded_at = NOW()
WHERE token = ?;

-- name: DeleteGuest :exec
DELETE FROM guests WHERE id = ?;

-- name: ListGuestsFiltered :many
SELECT * FROM guests
WHERE (sqlc.narg(status) IS NULL OR rsvp_status = sqlc.narg(status))
  AND (CAST(sqlc.arg(responded_only) AS UNSIGNED) = 0 OR rsvp_status != 'pending')
  AND (sqlc.narg(invitation_type) IS NULL OR invitation_type = sqlc.narg(invitation_type))
  AND (sqlc.narg(souvenir_type) IS NULL OR souvenir_type = sqlc.narg(souvenir_type))
  AND (sqlc.narg(q) IS NULL OR name LIKE sqlc.narg(q) OR phone LIKE sqlc.narg(q) OR email LIKE sqlc.narg(q))
ORDER BY created_at DESC
LIMIT ? OFFSET ?;

-- name: CountGuestsFiltered :one
SELECT COUNT(*) FROM guests
WHERE (sqlc.narg(status) IS NULL OR rsvp_status = sqlc.narg(status))
  AND (CAST(sqlc.arg(responded_only) AS UNSIGNED) = 0 OR rsvp_status != 'pending')
  AND (sqlc.narg(invitation_type) IS NULL OR invitation_type = sqlc.narg(invitation_type))
  AND (sqlc.narg(souvenir_type) IS NULL OR souvenir_type = sqlc.narg(souvenir_type))
  AND (sqlc.narg(q) IS NULL OR name LIKE sqlc.narg(q) OR phone LIKE sqlc.narg(q) OR email LIKE sqlc.narg(q));

-- CountGuestsGroupedByStatus juga menghasilkan total_pax (SUM attending_count)
-- digabung ke query yang sama (PLAN.md dashboard-wa-rsvp keputusan #16) -
-- satu scan menghasilkan jumlah undangan DAN jumlah orang sekaligus.
-- name: CountGuestsGroupedByStatus :many
SELECT rsvp_status, COUNT(*) AS total, CAST(COALESCE(SUM(attending_count), 0) AS UNSIGNED) AS total_pax FROM guests GROUP BY rsvp_status;

-- name: CountGuestsGroupedByInvitationType :many
SELECT invitation_type, COUNT(*) AS total FROM guests GROUP BY invitation_type;

-- name: CountGuestsGroupedBySouvenirType :many
SELECT souvenir_type, COUNT(*) AS total FROM guests GROUP BY souvenir_type;

-- name: CountGuestsGroupedBySide :many
SELECT side, COUNT(*) AS total FROM guests GROUP BY side;

-- name: CountGuestsGroupedByGender :many
SELECT gender, COUNT(*) AS total FROM guests WHERE gender IS NOT NULL GROUP BY gender;

-- ListRecentRsvpResponses dipakai kartu "Aktivitas RSVP terbaru" di Ringkasan
-- (PLAN.md dashboard-wa-rsvp §3.2) - rsvp_responded_at sudah diisi setiap
-- kali status berubah tapi belum pernah ditampilkan di UI mana pun.
-- name: ListRecentRsvpResponses :many
SELECT name, rsvp_status, attending_count, rsvp_responded_at FROM guests
WHERE rsvp_responded_at IS NOT NULL
ORDER BY rsvp_responded_at DESC
LIMIT 5;
