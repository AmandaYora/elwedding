-- R4 (docs/plan/revisi-uat-logo-og-nama-tamu-dresscode/PLAN.md): satu gambar
-- yang diunggah admin menggantikan ikon dress + palet warna yang sebelumnya
-- hardcode di Agenda.tsx. Judul/deskripsi/catatan dresscode TIDAK diubah -
-- ketiganya sudah admin-managed dan tetap dipakai (keputusan K2).
--
-- NOT NULL DEFAULT '' mengikuti pola cover_logo_url, bukan pola
-- dresscode_note yang NULLABLE. Konsekuensinya sqlc menghasilkan `string`
-- biasa (bukan sql.NullString), jadi service.go tidak perlu nullStr/toNullStr.
-- Baris singleton id=1 yang sudah ada otomatis mendapat '' yang berarti
-- "belum ada gambar", sehingga migration ini aman dijalankan pada data
-- produksi tanpa backfill - Agenda.tsx merender gambarnya secara bersyarat.
ALTER TABLE invitation_content
  ADD COLUMN dresscode_image_url VARCHAR(500) NOT NULL DEFAULT '' AFTER dresscode_note;
