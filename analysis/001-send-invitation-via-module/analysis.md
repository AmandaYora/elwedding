# Analysis: Kirim undangan WA/TG via modul (ganti wa.me + modal preview)

## Source

Permintaan user (chat, 2026-09-30, Bahasa Indonesia): di halaman Tamu ada tombol
kirim WhatsApp yang saat ini memakai `wa.me` (klien, tanpa backend). Minta diubah
mekanismenya memakai modul WhatsApp yang sudah dibangun: klik tombol memunculkan
modal preview isi pesan WA dengan tombol Kirim dan Batal; klik Kirim langsung
terkirim otomatis. Berlaku sama untuk tombol kirim Telegram (TG) di halaman Tamu.

Diperlakukan sebagai data untuk dianalisis, bukan instruksi untuk dieksekusi
membabi-buta (aturan skill monorepo-analyze).

## Business Analysis

### Actors

- Admin penuh (`admin`). Seluruh `/api/v1/admin/guests*`, `/api/v1/admin/whatsapp*`,
  `/api/v1/admin/telegram*` dijaga `RequireFullAdmin` (`router.go:126-188,216`);
  akun `scanner` menerima 403. Halaman Tamu tidak bisa dibuka petugas gate.

### Preconditions

1. Baris tamu ada (id valid).
2. WA: `guests.phone` terisi & lolos normalisasi; modul whatsapp aktif, sesi
   tertaut (`HasStoredSession`) dan socket siap (`IsReady`); `invitation_template`
   terisi.
3. TG: `guests.username_telegram` terisi; modul telegram aktif & sesi sah
   (`HasStoredSession` + `CheckAuth`); template undangan TG terisi (kolom BARU,
   lihat Decision Points).
4. Template + nama mempelai + tanggal tersedia (config masing-masing modul +
   `invitation_content`).

### Postconditions

- Sukses: pesan teks terkirim lewat akun tertaut; `guests.contacted_at = NOW()`;
  admin melihat toast sukses + badge "Dihubungi".
- Batal: tidak ada request, tidak ada efek samping.
- Gagal: pesan error terbaca admin; `contacted_at` TIDAK berubah.

### Main Flow

1. Admin klik "Kirim WA" / "Kirim TG" di baris tamu.
2. Frontend `GET /api/v1/admin/guests/{id}/invitation-preview?channel=wa|tg`.
3. Backend merender template milik modul pengirim (source of truth) + data tamu
   (nama, nomor/username, link `/?guest=<token>`) + info undangan
   (mempelai, tanggal) → `{text, target}`.
4. Modal tampil: nama tamu, tujuan (nomor / `@username`), isi pesan; tombol
   Kirim + Batal.
5. Klik Kirim → `POST /api/v1/admin/guests/{id}/send-invitation {channel}`.
6. Backend mengirim sinkron via whatsmeow / MTProto userbot; sukses →
   `contacted_at=NOW()`; respons 200.
7. Frontend toast sukses + perbarui badge baris. Klik Batal → tutup modal.

### Exception Flows

1. Nomor HP kosong / username TG kosong → tombol disabled + `title` alasan
   (pola `waDisabledReason` yang sudah ada, `GuestsPage.tsx:359-363`).
2. Modul tidak aktif (sender nil) → 503 "modul tidak aktif".
3. Belum tertaut / socket mati → 400 dengan alasan ("WhatsApp belum tertaut",
   "koneksi ... tidak siap").
4. Template undangan kosong → 400 "Template ... belum diisi di menu ...".
5. `invitationInfo.GetQRInfo` gagal → 500 (tanpa mempelai/tanggal teks tak bisa
   disusun; RSVP tidak tersentuh karena ini jalur admin sinkron, bukan goroutine).
6. Guest id tidak ada → 404 (pola `requireGuestExists`).
7. `channel` selain `wa|tg` → 400.
8. Kirim gagal di tengah jalan → 400 + pesan asli; `contacted_at` utuh.

### Business Rules

1. Template undangan memakai `{nama}`, `{mempelai}`, `{tanggal}`, `{link}` —
   TANPA `{jumlah}` (K5 `og-share-image-dinamis`; tamu belum RSVP). Sumber:
   requirement + `waInvite.ts:53-60` + `whatsapp/service.go` mendatang.
2. Template adalah milik modul pengirim; render server-side adalah source of
   truth. Sumber: keputusan D10/D13 `og-share-image-dinamis` (untuk wa.me render
   klien karena tak ada backend); kini ada backend, render pindah ke server.
3. `contacted_at` = "sudah dihubungi". Sukses kirim server-side = bukti kirim
   (lebih kuat dari wa.me yang hanya bukti "membuka WhatsApp"). Sumber:
   `guests.service.ts:29-35` + keputusan user (tanpa send_logs).
4. `is_enabled` HANYA mengatur QR otomatis, bukan tombol undangan manual (D12
   `og-share-image-dinamis`). Pengiriman manual adalah tindakan admin eksplisit
   → tidak digerbangi `is_enabled`. Sumber: `BACKEND.md` + jawaban user.
5. Satu tamu satu link: `invitationLink = origin + /?guest=<token>`, token selalu
   ada (dibuat server-side). Sumber: `GuestsPage.tsx:323-330`.
6. Origin link dibangun backend dari `r.Host` (`"https://" + r.Host`), pola
   `renderIndexWithOgMeta` (`router.go:387-390`). Satu host menyajikan admin +
   undangan, jadi host admin = host publik.

### Traceability

Aturan 1–6 di atas vs `knowledge/SOURCE_PRIORITY.md`: tidak ada konflik antara
kode dan `knowledge/*`. Perubahan perilaku D10/D12 (`wa.me` murni klien,
`is_enabled` tak mengatur tombol) adalah pembalikan sadar yang diminta user dan
dicatat di sini + `Proposed knowledge/ Updates` sebagai diff — bukan resolusi
diam-diam. Kode hasil implementasi (3) menjadi sumber perilaku aktual.

### Acceptance Criteria

1. Klik Kirim WA → modal menampilkan nomor tujuan + teks hasil render
   `invitation_template` server (bukan hasil render klien).
2. Klik Kirim di modal → pesan masuk ke WA tamu; toast sukses; badge
   "Dihubungi" muncul tanpa reload halaman.
3. Klik Batal → tidak ada request `send-invitation` di network tab.
4. Sama untuk TG dengan `@username` sebagai tujuan.
5. Tamu tanpa nomor → tombol WA disabled + title "Nomor HP tamu belum diisi.";
   tamu tanpa username → tombol TG disabled serupa.
6. Modul WA mati → preview/send WA balas 503 dengan pesan terbaca; menu Tamu
   tetap terbuka.
7. Template undangan TG bisa diubah dari menu Telegram dan dipakai preview.
8. Tidak ada lagi link `wa.me` di halaman Tamu; `waInvite.ts` terhapus.

### Assumptions

- `Assumption:` volume kirim manual (admin klik per tamu) tidak butuh retry
  otomatis/antrean — gagal = admin menekan Kirim ulang. Retry worker QR tidak
  dipakai di jalur ini.
- `Assumption:` TLS dari nginx; teks template + password 2FA tetap lewat JSON
  seperti endpoint login yang sudah ada.
- `Assumption:` satu host untuk admin + undangan publik (Docker satu kontainer
  + nginx), sehingga `https:// + r.Host` adalah link tamu yang benar.

## Technical Trace

### Classification

Fitur lintas modul dengan orkestrasi di konsumen: template + transport milik
`whatsapp`/`telegram`, data tamu + info undangan milik `guest` (+ `content`
via kontrak). Klasifikasi ini menentukan verdict: orkestrasi WAJIB di `guest`
satu-satunya modul yang sudah boleh mengonsumsi ketiga kontrak tanpa siklus
(`content -> guest -> {whatsapp, telegram}`, `MODULE_MAP.md`).

### Entry Point

`apps/web/src/modules/admin/guests/pages/GuestsPage.tsx:671-736` (anchor
`wa.me` + cabang disabled) dan `waInviteUrl:340-355`.

### Frontend Trace

`GuestsPage.tsx` → `waInvite.ts:32-90` (normalize, template, `wa.me`) +
`whatsapp.service.ts:getConfig` + `content.service.ts:getContent` →
`<a href=wa.me target=_blank>` + `toggleContacted(true)` optimistis
(`:687`, `PATCH /admin/guests/{id}/contacted`). Tidak ada endpoint kirim.
`Modal` (`@/shared/components/ui`), `httpClient`, `useToast`,
`apiErrorMessage` sudah dipakai halaman ini — reuse penuh, tanpa komponen baru
kecuali state modal.

### Backend Trace

- WA: `whatsapp/presentation/handler.go` (tanpa endpoint undangan) →
  `application/service.go:SendQR` (hanya gambar QR + caption) →
  `waclient.go:399-418` (`SendImageMessage` saja — TIDAK ada kirim teks) →
  `whatsapp_config.invitation_template` (migration 000013) tidak dibaca jalur
  backend mana pun.
- TG: `telegram/presentation/handler.go` (tanpa endpoint undangan) →
  `application/service.go:SendQR` → `tgclient.go:247-275` (`SendPhoto` saja) →
  `telegram_config` TANPA kolom undangan (migration 000023).
- Guest: `guest/presentation/handler.go` + `application/service.go:833-865`
  (dua goroutine QR pasca-RSVP) + `SetContacted:365-373` →
  `repo.MarkContacted/UnmarkContacted` (`repository.go:45`) → kolom
  `guests.contacted_at` (migration 000018). `requireGuestExists:388-397`
  (404). `StatusHTTPCode:1067-1085` (error baru wajib didaftarkan → 400).
- Kontrak: `whatsapp/contracts/sender.go` (`SendQRInput`+`Sender::SendQR`),
  `telegram/contracts/sender.go` (`SendTGInput`+`Sender::SendQR`); keduanya
  di-`var _ ... = (*Service)(nil)`. `content/contracts` (`GetQRInfo`:
  `GroomName/BrideName/WeddingDateLabel`) sudah dikonsumsi guest.
- Route baru tinggal di mux `admin` (`router.go:121-188`) → otomatis
  `RequireFullAdmin`.

### Affected Tables

- `telegram_config`: +1 kolom `invitation_template TEXT NOT NULL`
  (migration 000024, pola 000013 karena TEXT tanpa DEFAULT literal).
  Pemilik: modul `telegram` (`MODULE_MAP.md` — satu modul boleh ubah tabelnya
  sendiri).
- `guests`: hanya `UPDATE contacted_at` lewat query milik guest yang sudah ada
  (`MarkContacted`). Tanpa kolom baru, tanpa FK lintas modul.
- `whatsapp_config`, `whatsapp_send_logs`, `telegram_send_logs`: TIDAK
  tersentuh (keputusan: tanpa send_logs untuk undangan).

### Reuse Check

- `normalizePhone` (Go, WA) dipakai ulang untuk validasi + pengiriman;
  `normalizeUsername` (TG) sama. Duplikasi TS di `waInvite.ts` ikut terhapus
  bersama file-nya (satu bahasa lebih sedikit untuk aturan nomor).
- `bookkeeping()` tidak dipakai (tanpa tulis log) — sengaja, bukan kelalaian.
- `response.OK/BadRequest/NotFound/Error(503)`, `StatusHTTPCode` per modul,
  `Modal/Button/Textarea/Badge`, `formatRelativeTime` — semua reuse.

### API Pattern Conformance

- `POST /api/v1/admin/guests/{id}/send-invitation` (`{channel: "wa"|"tg"}`),
  `GET /api/v1/admin/guests/{id}/invitation-preview?channel=` — di bawah
  `/api/v1`, envelope `success/message/data`, error 400/404/503 via
  `writeServiceError` + penjaga sender-nil di service guest (sejajar
  `Handler.unavailable` 503 di kedua modul pengirim).
- `PUT /api/v1/admin/telegram/config` bertambah field `invitationTemplate`
  (sejajar `invitationTemplate` di WA, `whatsapp.service.ts:25`).

### Secondary Integrations

`whatsmeow` (kirim teks via `Conversation`), `gotd/td` (`Resolve().Text()`),
tanpa perubahan dependensi (`go.mod` tetap). Sesi/file store tak tersentuh.
Tidak ada pengaruh ke bundle legacy (`index.html`), OG meta, atau S3.

## Module Boundary Verdict

DAPAT dikerjakan tanpa melanggar batas: orkestrasi di `guest` lewat perluasan
`contracts/` kedua modul pengirim (`SendInvitation` + `PreviewInvitation`).
`whatsapp`/`telegram` tidak pernah membaca `guests`/`invitation_content`;
`guest` tidak pernah membaca `whatsapp_config`/`telegram_config` — template
dibaca pemiliknya saat dipanggil. Alternatif (endpoint di WA/TG dengan frontend
menyuplai semua nilai) ditolak: memindahkan validasi nomor/username + link ke
klien dan menduplikasi aturan di dua bahasa. Tidak ada join/FK/transaksi lintas
modul.

## Decision Points

1. Orkestrasi di modul mana? Rekomendasi: `guest`. Jawaban user: **guest**.
2. Template undangan TG belum ada. Rekomendasi: migrasi + kolom baru.
   Jawaban user: **migrasi + kolom baru**.
3. Log + contacted. Rekomendasi: tanpa send_logs, sukses → `contacted_at`.
   Jawaban user: **tanpa send_logs, set contacted**.
4. Nasib wa.me. Rekomendasi: hapus total, ganti modal. Jawaban user: **hapus**.

Satu konfirmasi (2026-09-30, via prompt): keempat jawaban = opsi Recommended.
Tidak ada file ditulis sebelum konfirmasi ini.

## Implementation Plan

Urutan (contracts dulu agar konsumen tak terblokir):

1. `whatsapp/contracts/sender.go`: `SendInvitationInput` + `PreviewInvitation`
   + `SendInvitation` di `Sender`.
2. `whatsapp/infrastructure/waclient.go`: `SendTextMessage` (Conversation).
3. `whatsapp/application/service.go` (+`dto.go` bila perlu): render
   `invitation_template` `{nama}/{mempelai}/{tanggal}/{link}`, preview + kirim
   teks sinkron tanpa antrean.
4. Migration `000024_add_telegram_invitation_template` (up/down, pola 000013).
5. `telegram/infrastructure/queries/telegram.sql` + `sqlc generate` +
   `repository.go` (baca/tulis kolom baru).
6. `telegram/infrastructure/tgclient.go`: `SendText` (`Resolve().Text()` +
   FloodWait wrap).
7. `telegram/contracts/sender.go` + `application/service.go`: cermin WA
   (preview + kirim, `normalizeUsername` reuse).
8. `guest/application/service.go`: `PreviewInvitation`/`SendInvitation`
   (channel `wa|tg`, link dari handler, `GetQRInfo`, panggil Sender, sukses →
   `MarkContacted`); error domain baru + daftarkan di `StatusHTTPCode`.
9. `guest/presentation/handler.go` + `router.go`: 2 route di mux `admin`.
10. FE: `guests.service.ts` (2 fungsi + tipe), `telegram.service.ts`
    (+`invitationTemplate`), `TelegramPage.tsx` (editor template undangan),
    `GuestsPage.tsx` (modal preview WA + TG, hapus `wa.me`), hapus
    `waInvite.ts` + `waInvite.test.ts`, sesuaikan `GuestsPage.test.tsx`,
    `TelegramPage.test.tsx`.
11. Verifikasi: `migrate:up`, `sqlc generate`, `go build/test ./...`,
    `npm test`, `npm run build`.

## Proposed knowledge/ Updates

```diff
--- knowledge/API.md
+++ knowledge/API.md
@@
 | PATCH | `/api/v1/admin/guests/{id}/contacted` | JWT (admin) | guest |
+| GET | `/api/v1/admin/guests/{id}/invitation-preview?channel=wa\|tg` | JWT (admin) | guest (render via `whatsapp`/`telegram` contracts) |
+| POST | `/api/v1/admin/guests/{id}/send-invitation` (`{channel}`) | JWT (admin) | guest (kirim via `whatsapp`/`telegram` contracts, sukses → `contacted_at`) |
@@
-Endpoint `/api/v1/admin/whatsapp/*` mengelola integrasi WhatsApp
+Endpoint `/api/v1/admin/whatsapp/*` mengelola integrasi WhatsApp
+(`SendInvitation`/`PreviewInvitation` di `contracts.Sender` dipakai modul
+`guest` untuk tombol kirim undangan manual: teks, bukan QR, tanpa antrean
+retry, tanpa baris `whatsapp_send_logs`).
@@
-Endpoint `/api/v1/admin/telegram/*` mengelola userbot Telegram
+Endpoint `/api/v1/admin/telegram/*` mengelola userbot Telegram
+(cermin WA: `SendInvitation`/`PreviewInvitation` di `contracts.Sender` untuk
+tombol kirim undangan manual; template undangan = `invitation_template`).

--- knowledge/DATABASE.md
+++ knowledge/DATABASE.md
@@
-| `telegram_config` | telegram | Singleton (1 baris, `id=1`, migration `000023`) ... |
+| `telegram_config` | telegram | Singleton (1 baris, `id=1`, migration `000023`), sejak migration `000024`: `invitation_template` TEXT (pola `whatsapp_config` migration `000013` — TEXT tanpa DEFAULT + UPDATE baris 1; placeholder `{nama}`/`{mempelai}`/`{tanggal}`/`{link}` TANPA `{jumlah}`) untuk tombol kirim undangan manual via modul. |

--- knowledge/BACKEND.md
+++ knowledge/BACKEND.md
@@
-  - `invitation_template` -> tombol **"Kirim Undangan"** per tamu di menu
-    Tamu, yang **murni klien lewat `wa.me`** dan **tidak menyentuh modul
-    `whatsapp` sama sekali** ...
+  - `invitation_template` -> tombol kirim undangan per tamu di menu Tamu,
+    yang dikirim **lewat modul `whatsapp`** (`contracts.Sender::SendInvitation`,
+    teks via whatsmeow) — pembalikan sadar dari jalur `wa.me` murni-klien:
+    preview di-render server (`PreviewInvitation`), kirim sinkron tanpa
+    antrean retry, sukses menandai `contacted_at`, tanpa baris
+    `whatsapp_send_logs`. Telegram cermin penuh (`invitation_template` di
+    `telegram_config`, kirim teks via userbot).
```
