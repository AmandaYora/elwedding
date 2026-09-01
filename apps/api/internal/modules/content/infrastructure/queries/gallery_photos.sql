-- name: ListGalleryPhotos :many
SELECT * FROM gallery_photos ORDER BY sort_order ASC;

-- name: GetGalleryPhoto :one
SELECT * FROM gallery_photos WHERE id = ? LIMIT 1;

-- name: CreateGalleryPhoto :execlastid
INSERT INTO gallery_photos (photo_url, thumb_url, sort_order)
VALUES (?, ?, ?);

-- name: UpdateGalleryPhoto :exec
UPDATE gallery_photos SET photo_url=?, thumb_url=?, sort_order=?
WHERE id = ?;

-- name: DeleteGalleryPhoto :exec
DELETE FROM gallery_photos WHERE id = ?;
