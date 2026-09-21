-- Menggeser +7 jam kolom DATETIME `guests` yang ditulis SQL NOW()
-- (docs/plan/timezone-wib/PLAN.md T3/D2).
--
-- LATAR: sebelum migrasi 000021 + perbaikan DSN, NOW() dievaluasi memakai
-- time_zone server MySQL (UTC di elcodelabs) sementara driver Go membaca
-- hasilnya dengan loc=Asia/Jakarta. Jam UTC dilabeli +07:00, sehingga seluruh
-- waktu di admin tampil MUNDUR 7 jam. Perbaikan DSN membetulkan penulisan ke
-- depan; baris yang sudah terlanjur tersimpan diperbaiki di sini.
--
-- ============================================================================
-- CAKUPANNYA SEMPIT, DAN ITU DISENGAJA. Terlihat seperti kelalaian kalau
-- membacanya tanpa §3.3 PLAN.md, jadi alasannya ditulis lengkap di sini.
-- ============================================================================
--
-- HANYA 3 kolom, HANYA di tabel `guests`:
--
--   rsvp_responded_at  <- UpdateGuestRsvpStatusByToken (guests.sql:22)
--   checked_in_at      <- MarkGuestCheckedIn           (guests.sql:193)
--   contacted_at       <- MarkGuestContacted           (guests.sql:55)
--
-- Ketiganya DATETIME dan satu-satunya penulis nilai non-NULL-nya adalah NOW().
-- Penulis lain hanya menyetel NULL (ResetGuestRsvpByID, UnmarkGuestContacted),
-- dan tidak ada satu pun jalur Go yang menulisnya - jadi tidak ada baris yang
-- sudah benar yang ikut tergeser.
--
-- JANGAN menambahkan kolom TIMESTAMP ke migrasi ini (created_at/updated_at di
-- guests, guest_groups, wedding_wishes, admin_users, invitation_content,
-- whatsapp_send_logs, whatsapp_config). MySQL menyimpan TIMESTAMP sebagai UTC
-- internal dan mengonversinya saat dibaca, jadi nilainya BENAR DENGAN
-- SENDIRINYA begitu zona sesi jadi +07:00 - termasuk baris lama. Menggesernya
-- justru membuatnya MAJU 7 jam.
--
-- JANGAN pula menyentuh invitation_content.wedding_date,
-- whatsapp_send_logs.sent_at, dan whatsapp_send_logs.next_retry_at: ketiganya
-- DATETIME tetapi ditulis dari Go, yang dikonversi driver ke Asia/Jakarta
-- sebelum dikirim - jadi literalnya memang sudah jam Jakarta dan sudah benar.
--
-- ARITMETIKA INTERVAL, BUKAN CONVERT_TZ: CONVERT_TZ dengan nama zona butuh
-- tabel mysql.time_zone* yang pada instalasi default KOSONG, dan diam-diam
-- mengembalikan NULL - itu MENGHAPUS data, bukan menggesernya. Penjumlahan
-- interval tidak bergantung pada zona sesi maupun tabel apa pun, sehingga
-- hasilnya sama baik dijalankan migrate/migrate (UTC) maupun klien lain.
--
-- `updated_at = updated_at` WAJIB ADA: guests.updated_at ber-ON UPDATE
-- CURRENT_TIMESTAMP (migration 000002), jadi tanpa penugasan eksplisit migrasi
-- ini menandai SELURUH baris tamu seolah baru saja disunting. Menugaskannya ke
-- nilainya sendiri menekan pemicu itu.
--
-- `WHERE ... IS NOT NULL` WAJIB ADA: bukan sekadar hemat - tanpa itu setiap
-- baris tersentuh dan efek samping updated_at di atas jadi menyeluruh.

UPDATE guests
   SET rsvp_responded_at = rsvp_responded_at + INTERVAL 7 HOUR,
       updated_at = updated_at
 WHERE rsvp_responded_at IS NOT NULL;

UPDATE guests
   SET checked_in_at = checked_in_at + INTERVAL 7 HOUR,
       updated_at = updated_at
 WHERE checked_in_at IS NOT NULL;

UPDATE guests
   SET contacted_at = contacted_at + INTERVAL 7 HOUR,
       updated_at = updated_at
 WHERE contacted_at IS NOT NULL;
