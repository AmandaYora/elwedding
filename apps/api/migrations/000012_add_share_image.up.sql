-- Gambar khusus preview link (og:image) yang diunggah admin - docs/plan/
-- og-share-image-dinamis/PLAN.md K1/T1. Aset cover & foto mempelai yang ada
-- semuanya PORTRAIT, sedangkan summary_large_image yang dipakai crawler
-- WhatsApp/Facebook mengharapkan landscape ~1,91:1. Karena itu preview butuh
-- field sendiri, bukan memakai ulang cover.
--
-- NOT NULL DEFAULT '' mengikuti pola cover_logo_url & dresscode_image_url
-- (migration 000011), bukan pola dresscode_note yang NULLABLE. Konsekuensinya
-- sqlc menghasilkan `string` biasa (bukan sql.NullString), jadi service.go
-- tidak perlu nullStr/toNullStr. Baris singleton id=1 yang sudah ada otomatis
-- mendapat '' yang berarti "belum ada gambar preview" - keadaan SAH, bukan
-- error: router jatuh ke cover_image_desktop_url (K4), lalu ke tag statis di
-- index.html. Aman dijalankan pada data produksi tanpa backfill.
ALTER TABLE invitation_content
  ADD COLUMN share_image_url VARCHAR(500) NOT NULL DEFAULT '' AFTER dresscode_image_url;
