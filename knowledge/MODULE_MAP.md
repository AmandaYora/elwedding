# Module Map

| Module | Responsibility | Public contract | Owned tables | External integrations |
|---|---|---|---|---|
| auth | Login admin, CRUD akun admin (tanpa role/permission - semua admin setara), terbitkan JWT | `presentation.Handler.{Login,ListUsers,CreateUser,UpdateUser,DeleteUser}` (dipakai `router.New`); `internal/shared/jwtutil` & `internal/shared/authmw` dipakai lintas modul sebagai utilitas teknis (bukan kontrak domain) | `admin_users` | — |
| content | Singleton `invitation_content`, 5 resource list (agenda events, rundown items, gallery photos, love story chapters, gift banks), registry `sections`, upload foto | `presentation.Handler` (dipakai `router.New`); `contracts.InvitationInfoProvider` (SATU-SATUNYA yang publik ke modul lain - **dikonsumsi guest** untuk menyusun teks QR, TANPA guest membaca tabel `invitation_content` langsung) | `invitation_content`, `agenda_events`, `rundown_items`, `gallery_photos`, `love_story_chapters`, `wedding_gift_banks`, `sections` | Disk lokal (`UPLOADS_DIR`) untuk file yang diunggah |
| guest | CRUD tamu (profil lengkap: gender, jenis undangan, pihak, jenis souvenir, kontak), resolve-by-token, update status RSVP (+jumlah tamu, +qrPayload), ringkasan agregat (status+pax/jenis undangan/souvenir/pihak/gender/aktivitas terbaru) | `presentation.Handler` (dipakai `router.New`); **mengonsumsi** `content/contracts.InvitationInfoProvider` & `whatsapp/contracts.Sender` (keduanya boleh nil) | `guests` | — |
| whatsapp | Pairing akun WhatsApp (whatsmeow), kirim QR konfirmasi kehadiran, template pesan, log kirim + kirim ulang manual | `presentation.Handler` (dipakai `router.New`); `contracts.Sender` (SATU-SATUNYA yang publik ke modul lain - **dikonsumsi guest**) | `whatsapp_config`, `whatsapp_send_logs` | `go.mau.fi/whatsmeow` (WhatsApp) + file SQLite terpisah untuk sesi (`WA_STORE_DIR`, BUKAN MySQL project) |

Tidak ada join/FK lintas modul (aturan modular monolith). Setiap modul
hanya mengakses tabelnya sendiri lewat `infrastructure/repository.go`
(dibangun di atas kode ter-generate `sqlc`, lihat `apps/api/sqlc.yaml`).

17 `section_key` terdaftar di tabel `sections` (urutan default, lihat
migration `000004_seed.up.sql`): `opening_cover`, `cover`, `couple`,
`save_the_date`, `quote`, `event`, `rsvp`, `rundown`, `gallery_photo`,
`gallery_video`, `live_streaming`, `love_story`, `wedding_gift`,
`filter_instagram`, `greet_thanks`, `wedding_wish`, `footnote`.
