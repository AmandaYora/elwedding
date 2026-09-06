-- pax_quota ikut ditulis di sini (docs/plan/guest-pax-quota/PLAN.md T2/D1),
-- TAPI attending_count TIDAK - kolom itu milik TAMU, diisi lewat
-- UpdateGuestRsvpStatusByToken, dan tetap memakai DEFAULT kolomnya di sini.
-- Dua kolom, dua pemilik (D11): admin menentukan JATAH, tamu menentukan JANJI.
-- name: CreateGuest :execlastid
INSERT INTO guests (name, phone, side, group_id, token, rsvp_status, gender, invitation_type, souvenir_type, email, address, notes, is_expected_attending, pax_quota)
VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?);

-- name: GetGuestByID :one
SELECT * FROM guests WHERE id = ? LIMIT 1;

-- name: GetGuestByToken :one
SELECT * FROM guests WHERE token = ? LIMIT 1;

-- Sama seperti CreateGuest: pax_quota ikut, attending_count TIDAK PERNAH ikut
-- (D11 - keputusan lama dashboard-wa-rsvp #11 tetap berlaku penuh).
-- name: UpdateGuest :exec
UPDATE guests SET name = ?, phone = ?, side = ?, group_id = ?, gender = ?, invitation_type = ?, souvenir_type = ?, email = ?, address = ?, notes = ?, is_expected_attending = ?, pax_quota = ?
WHERE id = ?;

-- name: UpdateGuestRsvpStatusByToken :exec
UPDATE guests SET rsvp_status = ?, attending_count = ?, rsvp_responded_at = NOW()
WHERE token = ?;

-- ResetGuestRsvpByID mengosongkan JAWABAN tamu, bukan tamunya
-- (docs/plan/reservation-reset-contacted-flag/PLAN.md T2/K1). Dipakai tombol
-- Hapus di menu Reservasi.
--
-- TIGA kolom dikosongkan bersama-sama, dan ketiganya wajib: membiarkan
-- attending_count/rsvp_responded_at berarti tamu ber-status 'pending' tetap
-- membawa angka janji dan jam jawaban milik jawaban yang sudah dihapus.
-- `1` adalah DEFAULT kolomnya (migration 000007) dan nilai yang sama yang
-- ditetapkan resolveAttendingCount untuk status non-'attending'.
--
-- YANG SENGAJA TIDAK DISENTUH:
--   checked_in_at - rsvp_status adalah NIAT, checked_in_at adalah BUKTI
--                   (GLOSSARY.md). Menghapus niat tidak boleh menghapus bukti
--                   bahwa seseorang benar-benar tiba di pintu (D1).
--   pax_quota     - setelan ADMIN, tidak ada hubungannya dengan jawaban tamu (D3).
--   token         - link & QR tamu tetap sah; ia memang masih diundang, hanya
--                   jawabannya yang dikosongkan supaya bisa menjawab ulang.
-- name: ResetGuestRsvpByID :exec
UPDATE guests SET rsvp_status = 'pending', attending_count = 1, rsvp_responded_at = NULL
WHERE id = ?;

-- Penanda "sudah dihubungi" (T2/D8). Dua query terpisah alih-alih satu dengan
-- parameter nullable: masing-masing sepele dan langsung terbaca maksudnya.
--
-- NOW() MENIMPA nilai lama dengan sengaja - klik kedua berarti admin
-- menghubungi ulang, dan waktu terbaru lebih berguna daripada yang pertama.
-- Tidak perlu UPDATE bersyarat seperti MarkGuestCheckedIn: di sana syaratnya
-- mencegah dua petugas gate saling menimpa jam kedatangan, sedangkan di sini
-- hanya ada satu admin yang menekan tombolnya.
-- name: MarkGuestContacted :exec
UPDATE guests SET contacted_at = NOW() WHERE id = ?;

-- name: UnmarkGuestContacted :exec
UPDATE guests SET contacted_at = NULL WHERE id = ?;

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

-- CountGuestsGroupedBySide memikul SELURUH kartu "Proyeksi catering"
-- (docs/plan/guest-pax-quota/PLAN.md T2/D6) - SATU scan, lima agregat per
-- pihak, BUKAN query terpisah per angka. Pola yang sama persis dengan
-- CountGuestsGroupedByStatus di atas dan GetCheckinSummary di bawah.
--
-- ATURAN HITUNGNYA (K4 - "jawaban tamu menang atas dugaan admin"):
--
--   rsvp_status = 'attending'   -> pakai attending_count (JANJI tamu),
--                                  is_expected_attending DIABAIKAN
--   rsvp_status = 'not_attending' -> 0
--   pending / remind_later      -> pakai pax_quota, TAPI hanya bila
--                                  is_expected_attending TRUE
--
-- Kenapa dugaan admin diabaikan begitu tamu menjawab: admin mematikan
-- "diperkirakan hadir" untuk Om Hasan di Surabaya, lalu Om Hasan menjawab
-- "Hadir, 4 orang". Kalau dugaan tetap menang, empat orang datang tanpa
-- porsi. Dugaan dibuat SEBELUM jawaban ada; begitu tamunya menjawab, dugaan
-- itu kedaluwarsa.
--
-- Ini juga kali PERTAMA is_expected_attending benar-benar dipakai menghitung.
-- Sebelum ini ia hanya disimpan dan ditampilkan sebagai badge - tidak ada satu
-- pun agregasi yang membacanya, meski GLOSSARY.md sejak awal menyebutnya
-- "dipakai memperkirakan".
--
-- CAST(... AS UNSIGNED) WAJIB: tanpa itu sqlc memetakan hasil SUM() ke tipe
-- yang tidak diinginkan. Sama seperti total_pax di CountGuestsGroupedByStatus.
--
-- CASE WHEN di dalam SUM() TIDAK menambah scan - ia dievaluasi pada baris yang
-- memang sudah dibaca. `side` ENUM 2 nilai NOT NULL, jadi groom + bride selalu
-- persis sama dengan total; tidak ada sisa yang perlu dijelaskan di UI.
-- name: CountGuestsGroupedBySide :many
SELECT
  side,
  COUNT(*) AS total,
  CAST(COALESCE(SUM(CASE WHEN rsvp_status = 'attending'
    THEN attending_count ELSE 0 END), 0) AS UNSIGNED) AS confirmed_pax,
  CAST(COALESCE(SUM(CASE WHEN rsvp_status IN ('pending', 'remind_later')
    AND is_expected_attending THEN pax_quota ELSE 0 END), 0) AS UNSIGNED) AS expected_pax,
  CAST(COALESCE(SUM(CASE WHEN rsvp_status = 'not_attending'
    THEN 1 ELSE 0 END), 0) AS UNSIGNED) AS excluded_not_attending,
  CAST(COALESCE(SUM(CASE WHEN rsvp_status IN ('pending', 'remind_later')
    AND NOT is_expected_attending THEN 1 ELSE 0 END), 0) AS UNSIGNED) AS excluded_not_expected
FROM guests GROUP BY side;

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
