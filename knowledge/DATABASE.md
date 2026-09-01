# Database

MySQL (dikunci standar Go skill, bukan pilihan bebas - lihat
`.claude/rules/database.md`). Migrasi di `apps/api/migrations/`,
dijalankan lewat `npm run migrate:up` (wrapper `scripts/migrate.mjs` di
atas `golang-migrate`).

| Tabel | Modul pemilik | Catatan |
|---|---|---|
| `invitation_content` | content | Singleton (1 baris, `id=1`). `wedding_date` DATETIME, dikonversi ke epoch (`weddingDateUnix`) di Go dengan lokasi `Asia/Jakarta` (koneksi DB pakai `?parseTime=true&loc=Asia%2FJakarta`, lihat `internal/database/db.go`) - JANGAN pernah mengirim string tanggal mentah ke frontend untuk dihitung ulang. |
| `agenda_events` | content | List, `sort_order`. |
| `rundown_items` | content | List, `sort_order`, dikelompokkan `group_label` di frontend. |
| `gallery_photos` | content | List, `sort_order`. `thumb_url` = gambar ditampilkan, `photo_url` = lightbox. |
| `love_story_chapters` | content | List, `sort_order`. |
| `wedding_gift_banks` | content | List, `sort_order`. |
| `sections` | content | Registry 17 section (lihat `MODULE_MAP.md`). `section_key` UNIQUE - dipakai sebagai key `window.INVITATION_LAYOUTS` di frontend, jadi harus stabil, tidak boleh berubah tanpa migrasi data. |
| `guests` | guest | `token` UNIQUE + index (link personal tamu, wajib cepat di-lookup). `rsvp_status` ENUM cocok dengan `RsvpChoice` di `RsvpConfirmation.tsx`. Sejak migration `000006`: `gender` ENUM `male`/`female` **NULLABLE** (baris lama sebelum migration ini tetap NULL sampai disunting - tidak ada default yang akurat untuk gender), `invitation_type` ENUM `online`/`physical` NOT NULL DEFAULT `online`, `souvenir_type` ENUM `regular`/`vip` NOT NULL DEFAULT `regular`, `email` VARCHAR NOT NULL DEFAULT `''`, `address`/`notes` TEXT NULLABLE. Sejak migration `000007`: `attending_count` TINYINT UNSIGNED NOT NULL DEFAULT `1` (diisi TAMU saat RSVP `attending`, 1 atau 2 orang, untuk pax makanan - BUKAN diisi admin), `is_expected_attending` BOOLEAN NOT NULL DEFAULT `TRUE` (dugaan ADMIN, kolom terpisah dari `rsvp_status` milik tamu). Lihat `docs/plan/guest-fields-admin-layout/PLAN.md` dan `docs/plan/dashboard-wa-rsvp/PLAN.md`. |
| `admin_users` | auth | Dikelola CRUD lewat menu Pengguna (`docs/plan/admin-users/PLAN.md`) - TIDAK lagi asumsi "selalu 1 baris". Baris seed awal (`admin` / `ubah-password-ini` - **wajib diganti setelah deploy pertama**, lihat `migrations/000005_seed_admin.up.sql`) tetap ada sebagai akun pertama. `username` UNIQUE, tanpa kolom role/permission. |
| `whatsapp_config` | whatsapp | Singleton (1 baris, `id=1`, migration `000008`). `message_template` TEXT dengan placeholder `{nama}`/`{jumlah}`/`{mempelai}`/`{tanggal}`. `is_enabled` menghentikan pengiriman otomatis tanpa memutus tautan akun. |
| `whatsapp_send_logs` | whatsapp | `guest_id` **primitif TANPA FK** ke `guests` (aturan modular monolith). Kolom snapshot (`guest_name`, `phone`, `qr_payload`, `couple_name`, `event_date_label`, `attending_count` - migration `000009`) WAJIB diisi supaya kirim ulang (`Resend`) tidak perlu membaca tabel `guests`/`invitation_content` milik modul lain. `status` ENUM `pending`/`sent`/`failed`, index di `status` & `created_at`. |

Tidak ada FK lintas tabel/modul (aturan modular monolith).

**Sesi WhatsApp (device & kunci enkripsi) TIDAK disimpan di MySQL** - library
`go.mau.fi/whatsmeow` hanya mendukung SQLite/Postgres secara penuh
(diverifikasi dari source `store/sqlstore/container.go`). Disimpan sebagai
file SQLite terpisah di `WA_STORE_DIR` (default `./wa-store/wa.db`),
di-migrate otomatis oleh whatsmeow sendiri (BUKAN golang-migrate). File ini
**wajib** ikut volume persisten di deployment - kalau hilang, akun WhatsApp
harus di-pairing ulang lewat scan QR. Lihat `docs/plan/dashboard-wa-rsvp/PLAN.md`.
