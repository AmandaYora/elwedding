-- name: GetAdminUserByUsername :one
SELECT id, username, password_hash, created_at FROM admin_users WHERE username = ? LIMIT 1;

-- name: CreateAdminUser :execlastid
INSERT INTO admin_users (username, password_hash) VALUES (?, ?);

-- name: ListAdminUsers :many
SELECT id, username, created_at FROM admin_users ORDER BY created_at DESC LIMIT ? OFFSET ?;

-- name: CountAdminUsers :one
SELECT COUNT(*) FROM admin_users;

-- name: UpdateAdminUserUsername :exec
UPDATE admin_users SET username = ? WHERE id = ?;

-- name: UpdateAdminUserUsernameAndPassword :exec
UPDATE admin_users SET username = ?, password_hash = ? WHERE id = ?;

-- name: DeleteAdminUser :exec
DELETE FROM admin_users WHERE id = ?;
