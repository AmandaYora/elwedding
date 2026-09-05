-- name: CreateGuest :execlastid
INSERT INTO guests (name, phone, side, group_id, token, rsvp_status, gender, invitation_type, souvenir_type, email, address, notes, is_expected_attending)
VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?);

-- name: GetGuestByID :one
SELECT * FROM guests WHERE id = ? LIMIT 1;

-- name: GetGuestByToken :one
SELECT * FROM guests WHERE token = ? LIMIT 1;

-- name: UpdateGuest :exec
UPDATE guests SET name = ?, phone = ?, side = ?, group_id = ?, gender = ?, invitation_type = ?, souvenir_type = ?, email = ?, address = ?, notes = ?, is_expected_attending = ?
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
  AND (sqlc.narg(group_id) IS NULL OR group_id = sqlc.narg(group_id))
  AND (sqlc.narg(q) IS NULL OR name LIKE sqlc.narg(q) OR phone LIKE sqlc.narg(q) OR email LIKE sqlc.narg(q))
ORDER BY created_at DESC
LIMIT ? OFFSET ?;

-- name: CountGuestsFiltered :one
SELECT COUNT(*) FROM guests
WHERE (sqlc.narg(status) IS NULL OR rsvp_status = sqlc.narg(status))
  AND (CAST(sqlc.arg(responded_only) AS UNSIGNED) = 0 OR rsvp_status != 'pending')
  AND (sqlc.narg(invitation_type) IS NULL OR invitation_type = sqlc.narg(invitation_type))
  AND (sqlc.narg(souvenir_type) IS NULL OR souvenir_type = sqlc.narg(souvenir_type))
  AND (sqlc.narg(group_id) IS NULL OR group_id = sqlc.narg(group_id))
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

-- CountGuestsByGroupID adalah penjaga K4: dipanggil TEPAT SEBELUM menghapus
-- group supaya hitungannya sesegar mungkin, dan angkanya ikut disebut di
-- pesan penolakan ("masih dipakai N tamu"). Ber-index lewat
-- idx_guests_group_id (migration 000016).
-- name: CountGuestsByGroupID :one
SELECT COUNT(*) FROM guests WHERE group_id = ?;

-- CountGuestsGroupedByGroup mengisi kolom "Jumlah tamu" SELURUH baris di
-- halaman Group lewat SATU query - bukan satu COUNT per baris group (yang
-- itu N+1). Pola persis CountGuestsGroupedByStatus di atas.
-- WHERE group_id IS NOT NULL: tamu lama yang belum bergroup (K2/§2.6) tidak
-- punya baris hasil untuk dipetakan ke group mana pun.
-- name: CountGuestsGroupedByGroup :many
SELECT group_id, COUNT(*) AS total FROM guests WHERE group_id IS NOT NULL GROUP BY group_id;

-- ListRecentRsvpResponses dipakai kartu "Aktivitas RSVP terbaru" di Ringkasan
-- (PLAN.md dashboard-wa-rsvp §3.2) - rsvp_responded_at sudah diisi setiap
-- kali status berubah tapi belum pernah ditampilkan di UI mana pun.
-- name: ListRecentRsvpResponses :many
SELECT name, rsvp_status, attending_count, rsvp_responded_at FROM guests
WHERE rsvp_responded_at IS NOT NULL
ORDER BY rsvp_responded_at DESC
LIMIT 5;

-- MarkGuestCheckedIn adalah UPDATE BERSYARAT, bukan baca-lalu-tulis
-- (docs/plan/scan-checkin-gate/PLAN.md D5). `AND checked_in_at IS NULL`
-- membuat dua petugas yang memindai QR yang sama pada detik yang sama tidak
-- saling menimpa jam kedatangan, tanpa perlu transaksi.
-- :execrows (BUKAN :exec) disengaja: jumlah baris terpengaruh itulah yang
-- membedakan "baru saja check-in" (1) dari "sudah check-in sebelumnya" (0) -
-- persis informasi yang diminta K3.
-- name: MarkGuestCheckedIn :execrows
UPDATE guests SET checked_in_at = NOW() WHERE id = ? AND checked_in_at IS NULL;

-- ListCheckedInGuests: daftar tamu yang SUDAH tiba, terbaru di atas -
-- menu "Tamu Masuk" milik petugas gate. Kolomnya disebut satu per satu
-- (bukan SELECT *) supaya baris hasil TIDAK membawa phone/email/address/
-- notes/token ke jalur yang diakses akun petugas; lihat CheckinSummaryDTO
-- di application/dto.go untuk alasan keamanannya.
-- name: ListCheckedInGuests :many
SELECT id, name, side, souvenir_type, attending_count, checked_in_at FROM guests
WHERE checked_in_at IS NOT NULL
ORDER BY checked_in_at DESC
LIMIT ? OFFSET ?;

-- name: CountCheckedInGuests :one
SELECT COUNT(*) FROM guests WHERE checked_in_at IS NOT NULL;

-- GetCheckinSummary menghasilkan SELURUH angka kartu ringkasan gate dalam
-- SATU kali scan tabel - bukan 4 query COUNT terpisah, pola yang sama
-- dengan CountGuestsGroupedByStatus di atas.
--
-- arrived_* menghitung BARIS TAMU (undangan), bukan orang, konsisten dengan
-- `total_guests` sebagai penyebutnya. arrived_pax terpisah dan menjumlahkan
-- attending_count: itu jumlah orang yang DIJANJIKAN tamu saat RSVP, bukan
-- hasil hitung kepala di pintu - sistem ini memang tidak merekamnya
-- (docs/plan/scan-checkin-gate/PLAN.md §3.2). Label di UI harus jujur soal itu.
-- name: GetCheckinSummary :one
SELECT
  CAST(COALESCE(SUM(CASE WHEN checked_in_at IS NOT NULL AND side = 'groom' THEN 1 ELSE 0 END), 0) AS UNSIGNED) AS arrived_groom,
  CAST(COALESCE(SUM(CASE WHEN checked_in_at IS NOT NULL AND side = 'bride' THEN 1 ELSE 0 END), 0) AS UNSIGNED) AS arrived_bride,
  CAST(COALESCE(SUM(CASE WHEN checked_in_at IS NOT NULL THEN 1 ELSE 0 END), 0) AS UNSIGNED) AS arrived_total,
  CAST(COALESCE(SUM(CASE WHEN checked_in_at IS NOT NULL THEN attending_count ELSE 0 END), 0) AS UNSIGNED) AS arrived_pax,
  COUNT(*) AS total_guests
FROM guests;
