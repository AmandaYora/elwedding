-- Seed nilai yang sekarang hardcode di komponen React (PLAN.md §2.1, task #6),
-- supaya migrasi ke admin-managed content tidak mengubah tampilan sama sekali
-- pada deployment pertama.

INSERT INTO invitation_content (
  id,
  bride_name, bride_parents_text, bride_instagram, bride_photo_url,
  groom_name, groom_parents_text, groom_instagram, groom_photo_url,
  wedding_date, hashtag,
  cover_logo_url, cover_image_desktop_url, cover_image_mobile_url,
  quote_text,
  thanks_title, thanks_description,
  music_url,
  video_gallery_title, video_gallery_youtube_url, video_gallery_caption,
  live_streaming_title, live_streaming_youtube_url,
  instagram_filter_title, instagram_filter_caption, instagram_filter_preview_photo_url, instagram_filter_link,
  wedding_gift_description,
  dresscode_title, dresscode_description, dresscode_note
) VALUES (
  1,
  'Ariana Claire Valen', 'The Daughter of<br>Mr. Herry Smith<br>& Mrs. Joana Kelly', 'https://www.instagram.com/katsudoto', '/media/photos/photo-13.webp',
  'Adrian Lucas Hale', 'The Son of<br>Mr. Lionel Hale<br>& Mrs. Ginny Dera', 'https://www.instagram.com/Katsudoto', '/media/photos/photo-08.webp',
  '2026-05-16 11:00:00', '#AriaMeetsAdrian',
  '/media/photos/photo-21.webp',
  '/media/uploads/gif-872375-1775705339-9344566539b63ad1a7e5d2b5.gif',
  '/media/uploads/gif-872371-1775705325-e8e2cfa87b364b0f5d80e465.gif',
  'May our love grow stronger with each passing day, and may our hearts always find their way back to one another.',
  'Thank You!', 'Thank you for being part of our special day and for surrounding us with your love, blessings, and warm wishes. Your presence has made this celebration even more meaningful, and we are truly grateful to share these precious moments with you. Thank you for being a part of our happiness and for creating beautiful memories with us that we will always cherish.',
  '/assets/audio/background-music.mp3',
  'Our Footage', 'https://www.youtube.com/watch?v=dl_VqonCz6Y', 'The Pre-Wedding',
  'Live Streaming', 'https://www.youtube.com/watch?v=xVVVQjaD-pg',
  'Wedding Filter', 'Capture your moment while attending our wedding by using the Instagram filter below.', '/media/photos/photo-26.webp', 'https://www.instagram.com/ar/933715080836492/',
  'Your blessing and coming to our wedding are enough for us. However, if you want to give a gift we provide a Digital Envelope to make it easier for you. thank you',
  'Dresscode', 'Wear a long gown or formal gown, black tie or bow tie', 'Notes : Garden Party (get a cardigan/sweater ready in case it gets cold!)'
);

INSERT INTO agenda_events (event_label, time_label, venue_name, venue_address, city, maps_url, sort_order) VALUES
  ('Akad Nikah', '09:00 - 10:00', 'favehotel Padjajaran Bogor', 'Jl. Cidangiang No.1, Tegallega, Kecamatan Bogor Tengah, Kota Bogor, Jawa Barat 16129, Indonesia', 'Kota Bogor', 'https://maps.google.com/?cid=10465024281465579158', 1),
  ('Resepsi', '11:00 - 14:00', 'favehotel Padjajaran Bogor', 'Jl. Cidangiang No.1, Tegallega, Kecamatan Bogor Tengah, Kota Bogor, Jawa Barat 16129, Indonesia', 'Kota Bogor', 'https://maps.google.com/?cid=10465024281465579158', 2);

INSERT INTO rundown_items (group_label, time_label, activity_text, sort_order) VALUES
  ('Resepsi', '11:00 AM', 'Guest Arrival & Registration', 1),
  ('Resepsi', '12:00 PM', 'Opening & Couple Entrance', 2),
  ('Resepsi', '12:30 PM', 'Speech Session', 3),
  ('Resepsi', '1:00 PM', 'First Dance', 4),
  ('Resepsi', '2:00 PM', 'Closing', 5);

INSERT INTO gallery_photos (photo_url, thumb_url, sort_order) VALUES
  ('/media/photos/photo-18.webp', '/media/photos/photo-01.webp', 1),
  ('/media/photos/photo-06.webp', '/media/photos/photo-24.webp', 2),
  ('/media/photos/photo-23.webp', '/media/photos/photo-22.webp', 3),
  ('/media/photos/photo-07.webp', '/media/photos/photo-10.webp', 4),
  ('/media/photos/photo-19.webp', '/media/photos/photo-11.webp', 5),
  ('/media/photos/photo-16.webp', '/media/photos/photo-15.webp', 6),
  ('/media/photos/photo-09.webp', '/media/photos/photo-27.webp', 7),
  ('/media/photos/photo-04.webp', '/media/photos/photo-03.webp', 8),
  ('/media/photos/photo-14.webp', '/media/photos/photo-02.webp', 9);

INSERT INTO love_story_chapters (photo_url, title, caption, sort_order) VALUES
  ('/media/photos/photo-05.webp', 'The First Chapter', 'It all started with a simple hello, just two strangers crossing paths on an ordinary day, never knowing it would be the beginning of something special.', 1),
  ('/media/photos/photo-12.webp', 'A Story Unfolding', 'From shared moments and endless conversations, we found comfort in each other, turning ordinary days into something meaningful.', 2),
  ('/media/photos/photo-17.webp', 'A Promise for a Lifetime', 'Through every step, we found our way back to each other. And now, we begin our forever.', 3);

INSERT INTO wedding_gift_banks (bank_name, account_number, account_name, sort_order) VALUES
  ('BANK BRI', '001122301', 'Ariana', 1),
  ('BANK MANDIRI', '10002133', 'Adrian', 2);

-- 17 section (PLAN.md §2.1), urutan sesuai App.tsx asli. `wedding_wish`
-- tetap diseed (bisa di-toggle/reorder, kontennya di luar scope — §4).
INSERT INTO sections (section_key, label, is_enabled, sort_order) VALUES
  ('opening_cover', 'Opening Cover', TRUE, 1),
  ('cover', 'Cover', TRUE, 2),
  ('couple', 'Couple', TRUE, 3),
  ('save_the_date', 'Save the Date', TRUE, 4),
  ('quote', 'Quote', TRUE, 5),
  ('event', 'Event / Agenda', TRUE, 6),
  ('rsvp', 'RSVP', TRUE, 7),
  ('rundown', 'Rundown', TRUE, 8),
  ('gallery_photo', 'Photo Gallery', TRUE, 9),
  ('gallery_video', 'Video Gallery', TRUE, 10),
  ('live_streaming', 'Live Streaming', TRUE, 11),
  ('love_story', 'Love Story', TRUE, 12),
  ('wedding_gift', 'Wedding Gift', TRUE, 13),
  ('filter_instagram', 'Instagram Filter', TRUE, 14),
  ('greet_thanks', 'Thank You Note', TRUE, 15),
  ('wedding_wish', 'Wedding Wish', TRUE, 16),
  ('footnote', 'Footnote', TRUE, 17);
