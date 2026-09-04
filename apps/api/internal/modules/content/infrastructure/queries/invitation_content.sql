-- name: GetInvitationContent :one
SELECT * FROM invitation_content WHERE id = 1 LIMIT 1;

-- name: UpdateInvitationContent :exec
UPDATE invitation_content SET
  bride_name = ?, bride_parents_text = ?, bride_instagram = ?, bride_photo_url = ?,
  groom_name = ?, groom_parents_text = ?, groom_instagram = ?, groom_photo_url = ?,
  wedding_date = ?, hashtag = ?,
  cover_logo_url = ?, cover_image_desktop_url = ?, cover_image_mobile_url = ?,
  quote_text = ?,
  thanks_title = ?, thanks_description = ?,
  music_url = ?,
  video_gallery_title = ?, video_gallery_youtube_url = ?, video_gallery_caption = ?,
  live_streaming_title = ?, live_streaming_youtube_url = ?,
  instagram_filter_title = ?, instagram_filter_caption = ?, instagram_filter_preview_photo_url = ?, instagram_filter_link = ?,
  wedding_gift_description = ?,
  dresscode_title = ?, dresscode_description = ?, dresscode_note = ?, dresscode_image_url = ?
WHERE id = 1;
