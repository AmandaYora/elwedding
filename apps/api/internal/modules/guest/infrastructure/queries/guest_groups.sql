-- Query tabel guest_groups - docs/plan/guest-groups/PLAN.md T2.
--
-- Berkas TERPISAH dari guests.sql, satu berkas per tabel (pola modul content
-- yang punya 7 berkas .sql dalam satu direktori). sqlc.yaml TIDAK berubah:
-- konfigurasinya memetakan direktori queries -> package per modul, jadi
-- berkas baru di sini otomatis ikut ter-generate (§1.3).
--
-- Query yang menyentuh tabel `guests` (CountGuestsByGroupID,
-- CountGuestsGroupedByGroup) TETAP tinggal di guests.sql - berkas ini hanya
-- untuk tabel guest_groups.

-- name: CreateGuestGroup :execlastid
INSERT INTO guest_groups (name, description) VALUES (?, ?);

-- name: GetGuestGroupByID :one
SELECT * FROM guest_groups WHERE id = ? LIMIT 1;

-- GetGuestGroupByName adalah penjaga UNIQUE di sisi service (D5) - dicek
-- SEBELUM tulis supaya admin menerima "nama sudah dipakai" yang enak dibaca,
-- bukan error duplicate key mentah dari MySQL. Preseden: ErrUsernameTaken di
-- modul auth.
-- name: GetGuestGroupByName :one
SELECT * FROM guest_groups WHERE name = ? LIMIT 1;

-- ORDER BY name ASC (bukan created_at DESC seperti guests): daftar group
-- dipakai untuk MENCARI satu group di dropdown & tabel, jadi urutan abjad
-- yang bisa ditebak lebih berguna daripada yang terbaru di atas.
-- name: ListGuestGroups :many
SELECT * FROM guest_groups ORDER BY name ASC LIMIT ? OFFSET ?;

-- name: CountGuestGroups :one
SELECT COUNT(*) FROM guest_groups;

-- name: UpdateGuestGroup :exec
UPDATE guest_groups SET name = ?, description = ? WHERE id = ?;

-- name: DeleteGuestGroup :exec
DELETE FROM guest_groups WHERE id = ?;
