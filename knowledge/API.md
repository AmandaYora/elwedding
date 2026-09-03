# API

Konvensi umum (`/api/v1`, envelope `success/message/data/errors/meta`) ada
di `.claude/rules/api-standard.md`. Endpoint spesifik project ini:

| Method | Path | Auth | Modul |
|---|---|---|---|
| POST | `/api/v1/auth/login` | publik | auth |
| GET | `/api/v1/public/invitation` | publik (`Cache-Control: public, max-age=60`) | content |
| GET | `/api/v1/public/guests/by-token/{token}` | publik | guest |
| PATCH | `/api/v1/public/guests/by-token/{token}/rsvp` | publik | guest |
| GET/PATCH | `/api/v1/admin/content` | JWT | content |
| GET/POST/PUT/DELETE | `/api/v1/admin/content/{agenda-events,rundown-items,gallery-photos,love-story-chapters,gift-banks}[/{id}]` | JWT | content |
| GET/PATCH | `/api/v1/admin/sections` | JWT | content |
| POST | `/api/v1/admin/uploads` | JWT | content |
| POST | `/api/v1/admin/uploads/base64` | JWT | content |
| GET/POST/PUT/DELETE | `/api/v1/admin/guests[/{id}]` | JWT | guest |
| GET | `/api/v1/admin/guests/summary` | JWT | guest |
| GET | `/api/v1/admin/whatsapp/status` | JWT | whatsapp |
| POST | `/api/v1/admin/whatsapp/pair/start` | JWT | whatsapp |
| POST | `/api/v1/admin/whatsapp/logout` | JWT | whatsapp |
| GET/PUT | `/api/v1/admin/whatsapp/config` | JWT | whatsapp |
| GET | `/api/v1/admin/whatsapp/logs` | JWT | whatsapp |
| POST | `/api/v1/admin/whatsapp/logs/{id}/resend` | JWT | whatsapp |
| GET/POST/PUT/DELETE | `/api/v1/admin/users[/{id}]` | JWT | auth |

`POST /api/v1/admin/uploads/base64` menerima image (JPG/PNG/WebP/GIF -
audio TIDAK diterima di sini, tetap lewat `/api/v1/admin/uploads` multipart)
sebagai JSON `{filename, data}`, `data` base64 (boleh berprefix
`data:<mime>;base64,`). Byte hasil decode dibatasi 5 MB, body request
dibatasi 8 MB (413 bila lewat); MIME hasil sniff (`http.DetectContentType`)
harus cocok dengan ekstensi `filename` (400 bila tidak). Hasil akhirnya
tetap disimpan ke S3 lewat `Service.SaveUpload` yang sama dengan jalur
multipart dan mengembalikan URL `/uploads/images/...` yang sama - lihat
`docs/plan/admin-content-upload-base64/PLAN.md`. FE (`ContentPage.tsx`)
mengompres gambar ke WebP di browser (canvas, maks 1920px, quality 0.82)
sebelum mengirim, supaya foto asli 8-12 MB dari HP tidak menabrak limit ini
maupun `client_max_body_size` nginx.

`PATCH /api/v1/admin/content` mengganti **seluruh** baris singleton
(read-modify-write) - klien (`ContentPage.tsx`/`SettingsPage.tsx`) WAJIB
fetch dulu lewat `GET /api/v1/admin/content`, ubah field yang diinginkan,
lalu kirim balik objek lengkap.

`GET /api/v1/public/invitation` mengembalikan `sections[]` HANYA yang
`is_enabled`, dengan `order` ter-normalisasi 1..N (bukan `sort_order`
mentah) - lihat `application/service.go` (`listEnabledSectionsNormalized`).

`GET /api/v1/admin/guests` menerima query param opsional `status`, `q`
(dicocokkan ke `name`/`phone`/`email`, di-escape lewat `escapeLike` sebelum
dipakai di `LIKE` - lihat `DATABASE.md`), `invitation_type`
(`online`/`physical`), `souvenir_type` (`regular`/`vip`), dan `responded`
(`true` = hanya tamu dengan `rsvp_status != 'pending'` - dipakai menu
Reservasi, lihat `docs/plan/guest-reservation-split/PLAN.md`); semuanya
digabung dengan `AND`. `GET /api/v1/admin/guests/summary` mengembalikan
angka agregat (status RSVP + pax, jenis undangan, jenis souvenir, pihak,
gender, aktivitas RSVP terbaru) untuk dashboard admin - lihat
`docs/plan/dashboard-wa-rsvp/PLAN.md`.

`PATCH /api/v1/public/guests/by-token/{token}/rsvp` menerima `status` dan
`attendingCount` (wajib 1 atau 2 saat `status='attending'`, diabaikan untuk
status lain). Respons berisi `data.qrPayload` (string teks QR) - kosong
untuk status selain `attending`. Pengiriman QR ke WhatsApp tamu (bila
modul whatsapp aktif & tertaut) berjalan di goroutine terpisah - endpoint
ini TIDAK menunggu hasil kirim WhatsApp.

Endpoint `/api/v1/admin/whatsapp/*` mengelola integrasi WhatsApp
(`go.mau.fi/whatsmeow`) - lihat `docs/plan/dashboard-wa-rsvp/PLAN.md`.
`pair/start` memulai pairing (admin scan QR dari `status.pairingQR`);
`status` di-polling admin tiap ~2 detik selama pairing berlangsung.
`logs` menerima `page`/`limit` (paginasi standar). Sesi WhatsApp (device &
kunci enkripsi) TIDAK tersimpan di MySQL - lihat `DATABASE.md`.

`/api/v1/admin/users` mengelola akun admin (CRUD penuh, tanpa role/permission
- semua admin setara, lihat `docs/plan/admin-users/PLAN.md`). `username`
wajib unik (dicek lewat `GetAdminUserByUsername` sebelum create/update -
bukan menangkap error MySQL 1062), `password` wajib minimal 6 karakter saat
create, opsional saat update lewat `PUT /{id}` (kosong = tidak diganti).
`DELETE /{id}` menolak 2 kasus: menghapus akun sendiri yang sedang login
(dicek dari klaim JWT), dan menghapus admin terakhir yang tersisa (`COUNT(*)
<= 1`) - keduanya mencegah sistem terkunci total.
