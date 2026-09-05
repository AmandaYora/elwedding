-- Peran akun admin - docs/plan/scan-checkin-gate/PLAN.md T2/K2.
-- Ini MEMBALIK keputusan lama "semua admin setara/tanpa role" (keputusan #2,
-- masih tertulis di auth/application/service.go) secara sadar: petugas gate
-- butuh akun yang HANYA bisa membuka menu Scan.
--
-- ENUM mengikuti konvensi tabel lain (guests.side, guests.rsvp_status)
-- sehingga sqlc menghasilkan tipe AdminUsersRole - bukan string bebas yang
-- bisa diisi apa saja.
--
-- DEFAULT 'admin' membuat SELURUH akun yang sudah ada tetap admin penuh
-- tanpa backfill apa pun (D8). Pasangannya di sisi kode: JWT lama yang
-- tersimpan di localStorage tidak punya klaim `role`, dan peran kosong
-- diperlakukan sebagai admin penuh oleh authmw.RequireFullAdmin.
ALTER TABLE admin_users
  ADD COLUMN role ENUM('admin', 'scanner') NOT NULL DEFAULT 'admin' AFTER password_hash;
