-- Query tabel wedding_wishes - docs/plan/wedding-wish/PLAN.md T3.
--
-- Berkas TERPISAH, satu berkas per tabel (pola guest_groups.sql).
-- sqlc.yaml TIDAK berubah: konfigurasinya memetakan direktori queries ->
-- package per modul, jadi berkas baru di sini otomatis ikut ter-generate.
--
-- JOIN ke guests SAH karena intra-modul (D5): tabel wedding_wishes dimiliki
-- modul guest yang sama. Nama pengirim diambil live lewat JOIN, bukan
-- snapshot, supaya perbaikan nama tamu di admin langsung tercermin di
-- undangan.

-- name: CreateWeddingWish :execlastid
INSERT INTO wedding_wishes (guest_id, message) VALUES (?, ?);

-- GetWeddingWishByGuestID dipakai DUA jalur: penjaga "sekali saja" di
-- SubmitWish, dan ResolveByToken (mengisi HasWish + WishMessage). Lookup pada
-- UNIQUE key, O(1).
-- name: GetWeddingWishByGuestID :one
SELECT * FROM wedding_wishes WHERE guest_id = ? LIMIT 1;

-- Filter + sort keduanya terlayani idx_wedding_wishes_visible
-- (is_hidden, created_at).
-- name: ListPublicWeddingWishes :many
SELECT w.id, w.message, w.created_at, g.name AS guest_name, g.side AS guest_side
FROM wedding_wishes w
JOIN guests g ON g.id = w.guest_id
WHERE w.is_hidden = FALSE
ORDER BY w.created_at DESC
LIMIT ?;

-- Admin melihat SEMUA termasuk yang disembunyikan - itu justru gunanya.
-- name: ListWeddingWishesAdmin :many
SELECT w.id, w.guest_id, w.message, w.is_hidden, w.created_at,
       g.name AS guest_name, g.side AS guest_side
FROM wedding_wishes w
JOIN guests g ON g.id = w.guest_id
ORDER BY w.created_at DESC
LIMIT ? OFFSET ?;

-- name: CountWeddingWishes :one
SELECT COUNT(*) FROM wedding_wishes;

-- name: SetWeddingWishHidden :exec
UPDATE wedding_wishes SET is_hidden = ? WHERE id = ?;

-- GetWeddingWishByID adalah penjaga 404 sebelum SetHidden/Delete, supaya
-- admin menerima "tidak ditemukan" dan bukan 200 palsu atas baris yang
-- tidak ada.
-- name: GetWeddingWishByID :one
SELECT * FROM wedding_wishes WHERE id = ? LIMIT 1;

-- name: DeleteWeddingWish :exec
DELETE FROM wedding_wishes WHERE id = ?;
