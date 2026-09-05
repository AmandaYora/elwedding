-- PENTING (docs/plan/scan-checkin-gate/PLAN.md §2.5): query di berkas ini
-- MENYEBUT KOLOM SATU PER SATU, bukan `SELECT *` seperti modul content/
-- whatsapp. Artinya kolom baru TIDAK ikut otomatis. Kalau `role` lupa
-- ditambahkan di GetAdminUserByUsername, Authenticate selalu menerbitkan JWT
-- berperan kosong - dan karena peran kosong berarti admin penuh (D8),
-- SELURUH pembatasan akses petugas mati tanpa satu pun error.

-- name: GetAdminUserByUsername :one
SELECT id, username, password_hash, role, created_at FROM admin_users WHERE username = ? LIMIT 1;

-- name: CreateAdminUser :execlastid
INSERT INTO admin_users (username, password_hash, role) VALUES (?, ?, ?);

-- name: ListAdminUsers :many
SELECT id, username, role, created_at FROM admin_users ORDER BY created_at DESC LIMIT ? OFFSET ?;

-- name: CountAdminUsers :one
SELECT COUNT(*) FROM admin_users;

-- CountFullAdmins dipakai guardrail anti-terkunci (§2.3) - TIDAK boleh
-- diganti CountAdminUsers. Begitu akun petugas ada, menghitung seluruh baris
-- membuat admin penuh terakhir lolos dihapus dan sistem terkunci permanen:
-- tidak ada lagi akun yang bisa membuka menu Pengguna untuk memperbaikinya.
-- name: CountFullAdmins :one
SELECT COUNT(*) FROM admin_users WHERE role = 'admin';

-- name: UpdateAdminUserUsername :exec
UPDATE admin_users SET username = ? WHERE id = ?;

-- name: UpdateAdminUserUsernameAndPassword :exec
UPDATE admin_users SET username = ?, password_hash = ? WHERE id = ?;

-- name: UpdateAdminUserRole :exec
UPDATE admin_users SET role = ? WHERE id = ?;

-- name: GetAdminUserByID :one
SELECT id, username, password_hash, role, created_at FROM admin_users WHERE id = ? LIMIT 1;

-- name: DeleteAdminUser :exec
DELETE FROM admin_users WHERE id = ?;
