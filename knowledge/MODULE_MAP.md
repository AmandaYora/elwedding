# Module Map

| Module | Responsibility | Public contract | Owned tables | External integrations |
|---|---|---|---|---|
| auth | Login admin, CRUD akun admin **dengan peran** (`admin` akses penuh / `scanner` petugas gate - membalik keputusan lama "semua admin setara"), terbitkan JWT ber-klaim `role`, guardrail anti-terkunci berbasis jumlah **admin penuh** | `presentation.Handler.{Login,ListUsers,CreateUser,UpdateUser,DeleteUser}` (dipakai `router.New`); `internal/shared/jwtutil` & `internal/shared/authmw` (`RequireAdmin` + `RequireFullAdmin`) dipakai lintas modul sebagai utilitas teknis (bukan kontrak domain) | `admin_users` | — |
| content | Singleton `invitation_content`, 5 resource list (agenda events, rundown items, gallery photos, love story chapters, gift banks), registry `sections`, upload foto | `presentation.Handler` (dipakai `router.New`); `contracts.InvitationInfoProvider` (SATU-SATUNYA yang publik ke modul lain - **dikonsumsi guest** untuk menyusun teks QR, TANPA guest membaca tabel `invitation_content` langsung) | `invitation_content`, `agenda_events`, `rundown_items`, `gallery_photos`, `love_story_chapters`, `wedding_gift_banks`, `sections` | Object storage S3 IDCloudHost (`S3_*`, prefix key `elwedding/`) untuk foto/musik yang diunggah - **menggantikan disk lokal/`UPLOADS_DIR`**, lihat `docs/plan/content-uploads-object-storage/PLAN.md` |
| guest | CRUD tamu (profil lengkap: gender, jenis undangan, pihak, jenis souvenir, kontak), resolve-by-token, update status RSVP (+jumlah tamu, +qrPayload `ELW1:<token>`), ringkasan agregat (status+pax/jenis undangan/souvenir/pihak/gender/aktivitas terbaru), **check-in tamu di gate** (pindai QR, pencarian nama untuk check-in manual, daftar tamu masuk + ringkasan kedatangan per pihak), **CRUD group tamu** (setiap tamu wajib masuk tepat satu group; nama group ikut di hasil check-in) | `presentation.Handler` (dipakai `router.New`); **mengonsumsi** `content/contracts.InvitationInfoProvider` & `whatsapp/contracts.Sender` (keduanya boleh nil) | `guests`, `guest_groups` | — |
| whatsapp | Pairing akun WhatsApp (whatsmeow), kirim QR konfirmasi kehadiran, template pesan, log kirim + kirim ulang manual | `presentation.Handler` (dipakai `router.New`); `contracts.Sender` (SATU-SATUNYA yang publik ke modul lain - **dikonsumsi guest**) | `whatsapp_config`, `whatsapp_send_logs` | `go.mau.fi/whatsmeow` (WhatsApp) + file SQLite terpisah untuk sesi (`WA_STORE_DIR`, BUKAN MySQL project) |

Tidak ada join/FK lintas modul (aturan modular monolith). Setiap modul
hanya mengakses tabelnya sendiri lewat `infrastructure/repository.go`
(dibangun di atas kode ter-generate `sqlc`, lihat `apps/api/sqlc.yaml`).

Modul `guest` kini memiliki **2 tabel** (`guests` + `guest_groups`, sejak
`docs/plan/guest-groups/PLAN.md`). Itu tidak melanggar apa pun: yang dilarang
adalah join & FK **lintas modul**, bukan satu modul memiliki banyak tabel -
modul `content` sudah memiliki 7. Karena `guest_groups` berada DI DALAM modul
`guest`, `guests.group_id` adalah relasi intra-modul sehingga FK dan JOIN sah
dipakai, dan tidak ada `contracts/`, module client, entri `sqlc.yaml`, maupun
wiring `main.go` baru yang dibutuhkan.

17 `section_key` terdaftar di tabel `sections` (urutan default, lihat
migration `000004_seed.up.sql`): `opening_cover`, `cover`, `couple`,
`save_the_date`, `quote`, `event`, `rsvp`, `rundown`, `gallery_photo`,
`gallery_video`, `live_streaming`, `love_story`, `wedding_gift`,
`filter_instagram`, `greet_thanks`, `wedding_wish`, `footnote`.
