-- name: ListLoveStoryChapters :many
SELECT * FROM love_story_chapters ORDER BY sort_order ASC;

-- name: GetLoveStoryChapter :one
SELECT * FROM love_story_chapters WHERE id = ? LIMIT 1;

-- name: CreateLoveStoryChapter :execlastid
INSERT INTO love_story_chapters (photo_url, title, caption, sort_order)
VALUES (?, ?, ?, ?);

-- name: UpdateLoveStoryChapter :exec
UPDATE love_story_chapters SET photo_url=?, title=?, caption=?, sort_order=?
WHERE id = ?;

-- name: DeleteLoveStoryChapter :exec
DELETE FROM love_story_chapters WHERE id = ?;
