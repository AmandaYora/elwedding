-- T29: ganti cover GIF (4.5 MB each) -> MP4 (~112 KB). Tabel singleton id=1.
-- Helper coverMedia.ts menerima .gif MAUPUN .mp4 (D5), jadi urutan deploy tidak penting.
UPDATE invitation_content SET
  cover_image_desktop_url = '/media/uploads/gif-872375-1775705339-9344566539b63ad1a7e5d2b5.mp4',
  cover_image_mobile_url  = '/media/uploads/gif-872371-1775705325-e8e2cfa87b364b0f5d80e465.mp4'
WHERE id = 1;
