CREATE TABLE invitation_content (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

  bride_name VARCHAR(255) NOT NULL DEFAULT '',
  bride_parents_text TEXT,
  bride_instagram VARCHAR(255) NOT NULL DEFAULT '',
  bride_photo_url VARCHAR(500) NOT NULL DEFAULT '',

  groom_name VARCHAR(255) NOT NULL DEFAULT '',
  groom_parents_text TEXT,
  groom_instagram VARCHAR(255) NOT NULL DEFAULT '',
  groom_photo_url VARCHAR(500) NOT NULL DEFAULT '',

  wedding_date DATETIME NOT NULL,
  hashtag VARCHAR(255) NOT NULL DEFAULT '',

  cover_logo_url VARCHAR(500) NOT NULL DEFAULT '',
  cover_image_desktop_url VARCHAR(500) NOT NULL DEFAULT '',
  cover_image_mobile_url VARCHAR(500) NOT NULL DEFAULT '',

  quote_text TEXT,

  thanks_title VARCHAR(255) NOT NULL DEFAULT '',
  thanks_description TEXT,

  music_url VARCHAR(500) NOT NULL DEFAULT '',

  video_gallery_title VARCHAR(255) NOT NULL DEFAULT '',
  video_gallery_youtube_url VARCHAR(500) NOT NULL DEFAULT '',
  video_gallery_caption VARCHAR(255) NOT NULL DEFAULT '',

  live_streaming_title VARCHAR(255) NOT NULL DEFAULT '',
  live_streaming_youtube_url VARCHAR(500) NOT NULL DEFAULT '',

  instagram_filter_title VARCHAR(255) NOT NULL DEFAULT '',
  instagram_filter_caption TEXT,
  instagram_filter_preview_photo_url VARCHAR(500) NOT NULL DEFAULT '',
  instagram_filter_link VARCHAR(500) NOT NULL DEFAULT '',

  wedding_gift_description TEXT,

  dresscode_title VARCHAR(255) NOT NULL DEFAULT '',
  dresscode_description TEXT,
  dresscode_note TEXT,

  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id)
);

-- Modul `content` (PLAN.md §5.1/§9). Tiap tabel list punya `sort_order` untuk
-- fitur reorder per-item (bukan reorder section — itu tabel `sections`).

CREATE TABLE agenda_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  event_label VARCHAR(100) NOT NULL,
  time_label VARCHAR(100) NOT NULL DEFAULT '',
  venue_name VARCHAR(255) NOT NULL DEFAULT '',
  venue_address TEXT,
  city VARCHAR(100) NOT NULL DEFAULT '',
  maps_url VARCHAR(500) NOT NULL DEFAULT '',
  sort_order INT NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_agenda_events_sort_order (sort_order)
);

CREATE TABLE rundown_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  group_label VARCHAR(100) NOT NULL DEFAULT '',
  time_label VARCHAR(50) NOT NULL DEFAULT '',
  activity_text VARCHAR(255) NOT NULL DEFAULT '',
  sort_order INT NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_rundown_items_sort_order (sort_order)
);

CREATE TABLE gallery_photos (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  photo_url VARCHAR(500) NOT NULL,
  thumb_url VARCHAR(500) NOT NULL DEFAULT '',
  sort_order INT NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_gallery_photos_sort_order (sort_order)
);

CREATE TABLE love_story_chapters (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  photo_url VARCHAR(500) NOT NULL DEFAULT '',
  title VARCHAR(255) NOT NULL DEFAULT '',
  caption TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_love_story_chapters_sort_order (sort_order)
);

CREATE TABLE wedding_gift_banks (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  bank_name VARCHAR(100) NOT NULL,
  account_number VARCHAR(100) NOT NULL DEFAULT '',
  account_name VARCHAR(100) NOT NULL DEFAULT '',
  sort_order INT NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_wedding_gift_banks_sort_order (sort_order)
);

-- Registry 17 section (PLAN.md §2.1). `section_key` harus UNIQUE karena
-- dipakai sebagai key object map `window.INVITATION_LAYOUTS` di frontend
-- (keputusan #6) — bukan array, jadi tidak boleh ada duplikat/typo key.
CREATE TABLE sections (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  section_key VARCHAR(50) NOT NULL,
  label VARCHAR(100) NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uq_sections_section_key (section_key)
);
