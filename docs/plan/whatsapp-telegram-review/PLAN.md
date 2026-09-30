# Review Modul Whatsapp & Telegram — Apakah Sudah Benar, Ideal, dan Bisa Digunakan?

## 1. Requirement yang disepakati & klasifikasi intent

**Permintaan user (dinyatakan ulang):** "Lakukan analisis pada module whatsapp dan telegram apakah sudah benar, ideal, dan bisa digunakan?"

**Klasifikasi intent (analis): design review / go-no-go** — bukan bug fix, bukan enhancement, bukan new capability.
Yang dinilai: kebenaran terhadap aturan modular monolith repo ini, keidealan desain (retry, status, logout,
error handling), dan kesiapan produksi. Tidak ada perubahan perilaku yang diminta.

**Step 0 — pertanyaan ke user: NOL.** Alasan: tidak ada ambiguitas level-*what* (output shape, data scope,
actors, boundaries) yang bila salah tebak akan membuang seluruh trace. Yang direview adalah dua modul yang
sudah ada dan terdaftar di `knowledge/MODULE_MAP.md`. Tidak ada asumsi yang ditulis sebagai pengganti jawaban user.

**Keputusan terkunci:** tidak ada. Rekomendasi perbaikan di §7 adalah usulan analis, bukan keputusan user.

## 2. Entry point (Step 1 — terkonfirmasi ada)

Stack: Go modular monolith, `net/http` `ServeMux` Go 1.22+ pattern matching, tanpa framework HTTP
(`knowledge/BACKEND.md`). Aturan batas: hanya `contracts/` yang publik antar modul
(`.claude/rules/backend-modular-monolith.md`).

| Modul | Kontrak antar-modul | Endpoint HTTP (terdaftar `apps/api/internal/router/router.go:177-197`) |
|---|---|---|
| whatsapp | `apps/api/internal/modules/whatsapp/contracts/sender.go:45-53` (`Sender`: `SendQR`, `PreviewInvitation`, `SendInvitation`) | `GET status`, `POST pair/start`, `POST logout`, `POST reconnect`, `GET/PUT config`, `GET logs`, `POST logs/{id}/resend` (`apps/api/internal/modules/whatsapp/presentation/handler.go`) |
| telegram | `apps/api/internal/modules/telegram/contracts/sender.go:47-56` (bentuk sama, field alamat `TelegramUsername` bukan `Phone`) | `GET status`, `POST login/start`, `POST login/complete`, `POST logout`, `GET/PUT config`, `GET logs`, `POST logs/{id}/resend` (`apps/api/internal/modules/telegram/presentation/handler.go`) — **tanpa** `reconnect` (disengaja, one-shot, lihat §4) |
| Konsumen | `guest` mengimpor kedua kontrak (`apps/api/internal/modules/guest/application/service_invitation.go:10-11`); wiring `apps/api/cmd/server/main.go:60-78` | QR otomatis pasca-RSVP (goroutine detached); undangan manual via `GET .../invitation-preview` + `POST .../send-invitation` milik guest (`router.go:149-150`) |

## 3. Trace — alur kirim QR (pass 1, Steps 2–3)

### 3.1 Whatsapp (`apps/api/internal/modules/whatsapp/application/service.go`)

1. RSVP `attending` → `go SendQR(context.Background(), ...)` supaya respons tidak tertahan
   (pola di sisi guest; satu-satunya jalur `waitInline=true`).
2. `SendQR` (`service.go:617-644`): baca config → `InsertSendLog(status=pending)`
   (`service.go:622-629`) → `sendAndRecord(job{waitInline:true})`.
3. `sendAndRecord` (`service.go:753-805`), gate berurutan: `is_enabled` (`:769`) →
   `normalizePhone` (`:772`) → `HasStoredSession` permanen / `ready()` retryable (`:778-783`,
   `ready()` polling 500 ms s/d 20 dtk di `:723-728`) → `renderQRPNG` → `UploadImage`
   (timeout 60 dtk, `:788`) → `SendImageMessage` (`:797`). Klasifikasi
   `classifySendError` (`:337-360`): retryable hanya `DeadlineExceeded`/`os.IsTimeout`/
   `SQLITE_BUSY`/`ErrNotConnected`, sisanya permanen (default aman anti-ganda).
4. Terminal `finalizeLog(sent/failed)` (`:807-822`); retryable `scheduleRetry`
   (`:378-390`): `retry_count` absolut, backoff 1m/5m/15m/60m/180m (`:88-94`), maks 5x.
5. `Resend` (`:597-613`): sinkron, `waitInline=false` + `retryCount=0` (jatah baru, disengaja).
6. Worker (`:236-296`): tiap 30 dtk, sapu `pending` basi >5 mnt → `retrying`, baca config 1x,
   lewati bila `!IsEnabled`/`!IsReady`, proses batch 20 **sekuensial** (anti-rate-limit).
7. Supervisor (`:198-230`): tiap 15 dtk, skip bila `pairing||takeover`/tanpa sesi/sudah connected.

### 3.2 Telegram (`apps/api/internal/modules/telegram/application/service.go`)

1. Login OTP (bukan scan QR): `StartLogin` (`service.go:169-189`) → `TGClient.SendCode`
   (`infrastructure/tgclient.go:173-206`, hash di **memori service**, tidak ke browser) →
   `CompleteLogin` (`service.go:194-227`, + password 2FA, `ErrPasswordNeeded` bukan-kegagalan).
2. **One-shot MTProto, bukan persisten** (`tgclient.go:6-11`, `run` di `:141-149`): tiap operasi
   buka koneksi sendiri di atas `FileStorage` yang sama lalu tutup. Harga connect 1–2 dtk
   diterima untuk puluhan kiriman/acara. Konsekuensi benar: tidak ada endpoint `reconnect`.
3. `SendQR` (`service.go:337-360`): tulis `pending` dulu → `sendAndRecord` (`:458-515`):
   `is_enabled` → `normalizeUsername` → `HasStoredSession` → `renderQRPNG` → `SendPhoto`
   (`tgclient.go:273-301`). FloodWait menghormati jeda server bila melebihi backoff (`:498-501`).
4. Retry identik WA: tabel backoff sama (`:73-79`), `maxRetry=5`, tick 30 dtk + batch 20
   sekuensial (`:597-646`), sapu `pending` basi (`:611-618`), `bookkeeping()` 10 dtk (`:575-590`).
5. `classifySendError` (`:529-543`): retryable hanya `DeadlineExceeded`/timeout — **lebih sempit
   dari WA** (WA me-retry `ErrNotConnected`; TG tidak — lihat temuan T1).

### 3.3 Jalur undangan manual (kedua modul, simetris)

`PreviewInvitation` render template tanpa menyentuh koneksi (source of truth modal preview);
`SendInvitation` kirim **teks sinkron, tanpa `send_logs`, tanpa retry, tanpa gate `is_enabled`**
(WA `service.go:648-654`, TG `service.go:364-370`). Disengaja: sakelar hanya milik QR otomatis,
kegagalan tampil langsung di modal. Sukses ditandai pemanggil via `contacted_at`
(`guest/application/service_invitation.go:148-155`, gagal tandai hanya di-log agar tidak memicu kirim ganda).

### 3.4 Data source (Step 3 — tanpa perubahan)

Tidak ada tabel baru yang dibutuhkan. Yang dipakai sudah ada:
`whatsapp_config` + `whatsapp_send_logs` (migration `000008/000009/000013/000019`),
`telegram_config` + `telegram_send_logs` (`000023`), kolom `guests.username_telegram` (`000022`),
kolom+seed `invitation_template` (`000024` untuk TG, `000013` untuk WA).
Keputusan data: **tanpa perubahan (no change)** — review ini tidak mengusulkan kolom/tabel baru.

## 4. Verdict

### Benar? YA, dengan catatan ringan

- **Boundary modular monolith PATUH.** Kedua modul hanya mengimpor paket sendiri + `shared`;
  satu-satunya impor lintas modul mengarah ke `contracts/` dari `guest`. `guest_id` primitif
  **tanpa FK** di kedua tabel log; `Resend`/worker menyusun ulang pesan murni dari kolom
  snapshot (`guest_name`, `phone`/`telegram_username`, `qr_payload`, `couple_name`,
  `event_date_label`, `attending_count`) tanpa membaca `guests`/`invitation_content`.
  Nama mempelai/tanggal dipasok pemanggil via kontrak (keputusan #19), bukan dibaca pengirim.
- **Simetri WA↔TG disengaja dan konsisten:** kontrak 3-method sama, retry/backoff sama,
  logout "selalu bersihkan sesi lokal" sama (D2), undangan manual sama. Perbedaan
  (OTP+2FA vs pairing QR; tanpa `reconnect`/`IsReady`/`waitInline` di TG) semuanya beralasan
  dari sifat userbot one-shot vs whatsmeow persisten.
- **Catatan kebenaran (bukan pelanggaran):** regex username diketik ulang di `guest` dan
  `telegram` (`telegram/service.go:650-655` mengakui kembarannya) — risiko drift, bukan
  pelanggaran boundary; normalisasi nomor WA lemah (W1); pesan error menyebut `TG_SESSION_PATH`
  padahal variabelnya `TG_SESSION_DIR` (T4, terbukti `config/config.go:81` vs `tgclient.go:103`).

### Ideal? Sebagian besar YA — 4 deviasi yang terverifikasi

- **Status jujur `loggedIn/connected`:** WA BAIK (`Status` baca client langsung). TG **cacat**:
  tiap `CheckAuth` error → `LoggedIn:false` (`telegram/service.go:141-146`), padahal file sesi
  sah — pemisah yang dijanjikan `dto.go:8-19` jadi tidak berguna, dashboard menuduh logout
  saat hanya jaringan putus (T2).
- **Klasifikasi retry TG lebih sempit dari WA:** gangguan non-timeout dari pre-flight `Status`
  di dalam `SendPhoto`/`SendText` jatuh ke permanen (`service.go:509`), sedangkan WA me-retry
  `IsNotConnectedError` (T1). Satu blip → `failed` permanen + resend manual.
- **Tulis log sebelum gate (kedua modul):** `InsertSendLog(pending)` terjadi SEBELUM cek
  `is_enabled`/sesi (`whatsapp/service.go:622-629` → gate di `:769-779`; TG `:342-350` → gate
  di `:472-485`). Tiap RSVP saat kanal mati/disable menulis baris `pending→failed/retrying` —
  membanjiri tabel log dengan kegagalan kebijakan (W2).
- **Operasional belum ideal:** tanpa graceful shutdown (`Service.Close` hanya dipakai test;
  `main.go` langsung `ListenAndServe`), `Resend` tanpa guard status kirim ulang baris `sent`
  (W9), `Reconnect` WA tanpa guard `pairing` (W4), `StartLogin` TG tak terserialisasi (T6),
  worker head-of-line blocking ~15 mnt/batch macet (T7), scale-out >1 replika berisiko kirim
  ganda tanpa klaim atomik (W10).

### Bisa digunakan? BISA, dengan syarat go-live (conditional GO)

Fondasi kokoh; yang wajib sebelum produksi: migrasi `000008→000024` jalan berurutan,
volume persisten untuk `./wa-store/wa.db` (SQLite whatsmeow, DSN `_busy_timeout=5000` di
`waclient.go:105-107`) dan `./tg-store/session.json`, env `TG_API_ID`/`TG_API_HASH`/`TG_PHONE`
terisi (kosong = modul nonaktif yang degradasi anggun → endpoint 503, boot tetap lanjut),
alur go-live manual (status → pairing QR / login OTP+2FA → cek config → uji kirim manual →
RSVP uji → cek logs). T1+T2+W1+W2 sebaiknya dibereskan sebelum/di awal produksi; sisanya
bisa menyusul tanpa menahan rilis.

## 5. Scope & out-of-scope

**In scope (direview):** `apps/api/internal/modules/whatsapp/**`, `apps/api/internal/modules/telegram/**`,
konsumennya `guest/application/service_invitation.go` + jalur RSVP, `router/router.go:177-197`,
`cmd/server/main.go:60-78`, `config/config.go` (env sesi), migrasi `000008/000009/000013/000019/000022/000023/000024`.

**Out of scope (disengaja, bukan kelalaian):** frontend `TelegramPage.tsx`/`GuestsPage.tsx`
(tidak ditrace — review ini backend-only); isi pesan template (keputusan produk); pilihan
userbot vs Bot API (sudah diputuskan: Bot API tak bisa kirim ke tamu yang belum `/start`);
skema pricing/rate-limit Telegram; backup/restore file sesi.

**Reuse inventory:** tidak ada komponen baru yang diusulkan. Pola yang dirujuk: `bookkeeping()`
10 dtk, `scheduleRetry` absolut, `jobFromLog` snapshot, `unavailable()` 503 saat sender nil,
`invitationNames` via `content/contracts` — semuanya sudah ada dan dipakai ulang apa adanya.

## 6. Diagram

### Sequence — kirim QR otomatis (jalur yang direview)

```sequenceDiagram
participant Tamu as Tamu (RSVP attending)
participant Guest as guest/Service
participant WA as whatsapp/Service
participant TG as telegram/Service
participant WAClient as waclient (whatsmeow)
participant TGClient as tgclient (gotd/td)
participant DB as MySQL (send_logs)

Tamu->>Guest: PATCH rsvp attending
Guest->>WA: go SendQR(ctx=Background)
Guest->>TG: go SendQR(ctx=Background)
WA->>DB: InsertSendLog pending
TG->>DB: InsertSendLog pending
WA->>WA: gate is_enabled → normalize → HasStoredSession → ready()
TG->>TG: gate is_enabled → normalize → HasStoredSession
WA->>WAClient: UploadImage + SendImageMessage
TG->>TGClient: SendPhoto (buka MTProto one-shot, kirim, tutup)
alt sukses
WA->>DB: finalizeLog sent
TG->>DB: finalizeLog sent
else retryable
WA->>DB: scheduleRetry (backoff 1m..180m, maks 5x)
TG->>DB: scheduleRetry (hormati FloodWait bila lebih besar)
else permanen
WA->>DB: finalizeLog failed
TG->>DB: finalizeLog failed
end
```

### ERD — tabel yang dipakai (semua EXISTING, tanpa tabel baru)

```erDiagram
WHATSAPP_CONFIG ||--o{ WHATSAPP_SEND_LOGS : "dibaca per kirim (singleton id=1)"
TELEGRAM_CONFIG ||--o{ TELEGRAM_SEND_LOGS : "dibaca per kirim (singleton id=1)"
GUESTS ||--o{ WHATSAPP_SEND_LOGS : "guest_id primitif TANPA FK (snapshot)"
GUESTS ||--o{ TELEGRAM_SEND_LOGS : "guest_id primitif TANPA FK (snapshot)"

WHATSAPP_CONFIG {
string message_template
string invitation_template
bool is_enabled
}
WHATSAPP_SEND_LOGS {
uint guest_id
string guest_name
string phone
string qr_payload
string couple_name
string event_date_label
uint attending_count
string status_pending_sent_failed_retrying
uint retry_count
datetime next_retry_at
}
TELEGRAM_CONFIG {
string message_template
string invitation_template
bool is_enabled
}
TELEGRAM_SEND_LOGS {
uint guest_id
string guest_name
string telegram_username
string qr_payload
string couple_name
string event_date_label
uint attending_count
string status_pending_sent_failed_retrying
uint retry_count
datetime next_retry_at
}
GUESTS {
string phone
string username_telegram
string token
}
```

### Class diagram

Tidak ada diagram kelas: review ini tidak memperkenalkan atau mengubah struktur/class apa pun —
`Sender`, `Service`, `sendJob`, `Handler` yang ada dipakai apa adanya. Dinyatakan eksplisit
agar tidak dibaca sebagai kelalaian (Step 6).

## 7. Tindak lanjut yang disarankan (bukan handoff implementasi)

Urutan = bobot operasional, bukan urutan file. Setiap item memuat file:line terverifikasi sesi ini.

**Sebelum / awal produksi (disarankan):**
- [ ] T1 — TG: retry gangguan koneksi non-timeout (cerminkan `IsNotConnected` WA) —
  `telegram/application/service.go:529-543` + pre-flight `infrastructure/tgclient.go:251-257,277-283`.
- [ ] T2 — TG: bedakan offline vs logout di `Status` (jangan `LoggedIn:false` untuk error jaringan) —
  `telegram/application/service.go:138-147` vs janji `application/dto.go:3-19`.
- [ ] W1 — WA: validasi `normalizePhone` (digit/panjang, strip `()/.,`) + tolak awal —
  `whatsapp/application/service.go:828-842`.
- [ ] W2 — Kedua modul: pindah gate `is_enabled`/sesi SEBELUM `InsertSendLog` (atau bedakan
  status "dinonaktifkan") — WA `service.go:617-629` vs `:769-779`; TG `service.go:337-350`
  vs `:472-485`.

**Bisa menyusul tanpa menahan rilis:**
- [ ] T4 — Perbaiki pesan error `TG_SESSION_PATH` → `TG_SESSION_DIR` — `tgclient.go:103`
  vs `config/config.go:81`, `.env.example:48`.
- [ ] T3 — Bedakan pesan 2FA salah vs OTP salah (`PASSWORD_HASH_INVALID` kini → `ErrCodeInvalid`) —
  `tgclient.go:317-318`, `service.go:212-221`.
- [ ] W4 — Guard `pairing` di `Reconnect` WA (supervisor sudah punya di `:217`) — `service.go:513-523`.
- [ ] W8/T8 — Validasi `UpdateConfig` (tolak template kosong saat simpan, bukan saat kirim) —
  WA `service.go:539-547`, TG `service.go:266-272`.
- [ ] W9 — Guard `Resend` untuk baris `sent` (anti-duplikat double-klik) — WA `service.go:597-613`,
  TG `service.go:320-333`.
- [ ] W6+T10 — Graceful shutdown (`Close()` kini hanya dipakai test) — `service.go:134-138`,
  `main.go:96-97`. Mitigasi parsial sudah ada (sapu `pending` basi 5 mnt).
- [ ] W7 — Absolutkan/log path `wa.db`+`session.json` saat boot (cwd ganda root vs `apps/api`) —
  `config/config.go:76,81`, `main.go:23-24`.
- [ ] T5 — Hapus/aktifkan `ErrNotPaired` yang kini kode mati — `telegram/service.go:33,705-708`.
- [ ] T6 — Serialisasi `StartLogin` konkuren — `telegram/service.go:169-189`.
- [ ] W10 — Klaim atomik worker bila horizontal scaling direncanakan — WA `service.go:250-296`,
  TG `:597-646` (aman untuk 1 replika).

**Tidak ada task list implementasi** karena hasil analisis ini adalah keputusan review, bukan handoff
coding — daftar di atas adalah rekomendasi tindak lanjut. Dinyatakan eksplisit agar tidak dibaca
sebagai celah.

## 8. Jejak verifikasi (ground truth sesi ini)

Dibaca langsung, bukan dari memori: `whatsapp/contracts/sender.go:45-53`,
`telegram/contracts/sender.go:47-56`, `whatsapp/service.go:617-644,753-805,828-852`,
`telegram/service.go:120-250,337-360,364-420,451-543`, `tgclient.go:103,141-149,251-283`,
`guest/service_invitation.go:56-156`, `router/router.go:177-197`, `config/config.go:81`,
plus laporan trace dua subagen (whatsapp 10 temuan, telegram 10 temuan) yang klaim
load-bearing-nya disampel ulang ke file:line di atas sebelum ditulis ke PLAN ini.

## 9. Validasi PLAN (Step 7)

- Pass 1: requirement = review (bukan build) → tidak ada task implementasi yang tertinggal;
  sequence ↔ prose ↔ ERD memakai nama yang sama (`SendQR`, `sendAndRecord`, `scheduleRetry`,
  `send_logs`); file:line disampel ulang; jalur gagal (retryable/permanen/FloodWait) tercakup;
  volume (puluhan kiriman/acara, batch 20 sekuensial) dicatat. Ditemukan: direktori PLAN
  belum ada → dibuat sebelum Write. → perbaiki, ulangi dari atas.
- Pass 2 (final): tujuh cek di atas bersih dalam satu pass yang sama. Nol temuan terbuka.
