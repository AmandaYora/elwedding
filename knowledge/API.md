# API

Konvensi umum (`/api/v1`, envelope `success/message/data/errors/meta`) ada
di `.claude/rules/api-standard.md`. Endpoint spesifik project ini:

Kolom **Auth**: `publik` tanpa token; `JWT (admin)` = butuh token berperan
`admin` (`authmw.RequireFullAdmin`, petugas dibalas **403**); `JWT (admin+petugas)`
= token valid apa pun perannya (`authmw.RequireAdmin`). Lihat `BACKEND.md`.

| Method | Path | Auth | Modul |
|---|---|---|---|
| POST | `/api/v1/auth/login` | publik | auth |
| GET | `/api/v1/public/invitation` | publik (`Cache-Control: public, max-age=60`) | content |
| GET | `/api/v1/public/guests/by-token/{token}` | publik | guest |
| PATCH | `/api/v1/public/guests/by-token/{token}/rsvp` | publik | guest |
| POST | `/api/v1/public/guests/by-token/{token}/wish` | publik (token tamu) | guest |
| GET | `/api/v1/public/guests/by-token/{token}/wishes` | publik (token tamu) | guest |
| GET | `/api/v1/admin/wishes` | JWT (admin) | guest |
| PATCH | `/api/v1/admin/wishes/{id}/hidden` | JWT (admin) | guest |
| DELETE | `/api/v1/admin/wishes/{id}` | JWT (admin) | guest |
| GET/PATCH | `/api/v1/admin/content` | JWT (admin) | content |
| GET/POST/PUT/DELETE | `/api/v1/admin/content/{agenda-events,rundown-items,gallery-photos,love-story-chapters,gift-banks}[/{id}]` | JWT (admin) | content |
| GET/PATCH | `/api/v1/admin/sections` | JWT (admin) | content |
| POST | `/api/v1/admin/uploads` | JWT (admin) | content |
| POST | `/api/v1/admin/uploads/base64` | JWT (admin) | content |
| GET/POST/PUT/DELETE | `/api/v1/admin/guests[/{id}]` | JWT (admin) | guest |
| GET | `/api/v1/admin/guests/summary` | JWT (admin) | guest |
| DELETE | `/api/v1/admin/guests/{id}/rsvp` | JWT (admin) | guest |
| PATCH | `/api/v1/admin/guests/{id}/contacted` | JWT (admin) | guest |
| GET/POST/PUT/DELETE | `/api/v1/admin/groups[/{id}]` | JWT (admin) | guest |
| GET | `/api/v1/admin/whatsapp/status` | JWT (admin) | whatsapp |
| POST | `/api/v1/admin/whatsapp/pair/start` | JWT (admin) | whatsapp |
| POST | `/api/v1/admin/whatsapp/logout` | JWT (admin) | whatsapp |
| POST | `/api/v1/admin/whatsapp/reconnect` | JWT (admin) | whatsapp |
| GET/PUT | `/api/v1/admin/whatsapp/config` | JWT (admin) | whatsapp |
| GET | `/api/v1/admin/whatsapp/logs` | JWT (admin) | whatsapp |
| POST | `/api/v1/admin/whatsapp/logs/{id}/resend` | JWT (admin) | whatsapp |
| GET/POST/PUT/DELETE | `/api/v1/admin/users[/{id}]` | JWT (admin) | auth |
| POST | `/api/v1/admin/checkin/scan` | JWT (admin+petugas) | guest |
| GET | `/api/v1/admin/checkin/search` | JWT (admin+petugas) | guest |
| GET | `/api/v1/admin/checkin/arrivals` | JWT (admin+petugas) | guest |
| GET | `/api/v1/admin/checkin/summary` | JWT (admin+petugas) | guest |
| POST | `/api/v1/admin/checkin/{id}` | JWT (admin+petugas) | guest |

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
Reservasi, lihat `docs/plan/guest-reservation-split/PLAN.md`), dan `group_id`
(id numerik group; kosong = tanpa filter, nilai non-numerik ditolak **400**);
semuanya digabung dengan `AND`. Filter group TIDAK memakai JOIN - `group_id`
ada di baris `guests` sendiri dan ber-index. Respons tamu membawa `groupId`
(nullable) **tanpa nama group**: pemetaan id -> nama dilakukan frontend dari
daftar group yang sudah dimuat sekali, sehingga tidak ada N+1
(`docs/plan/guest-groups/PLAN.md` D2). `GET /api/v1/admin/guests/summary` mengembalikan
angka agregat (status RSVP + pax, jenis undangan, jenis souvenir, pihak,
gender, aktivitas RSVP terbaru) untuk dashboard admin - lihat
`docs/plan/dashboard-wa-rsvp/PLAN.md`.

`PATCH /api/v1/public/guests/by-token/{token}/rsvp` menerima `status` dan
`attendingCount` (wajib 1 atau 2 saat `status='attending'`, diabaikan untuk
status lain). Respons berisi `data.qrPayload` - kini berbentuk
`ELW1:<token tamu>`, **bukan lagi teks undangan** (lihat `BACKEND.md`) - dan
kosong untuk status selain `attending`. Nilainya dihitung SEBELUM info
undangan dibaca, jadi tetap sah walau tabel `invitation_content` sedang gagal
dibaca. Pengiriman QR ke WhatsApp tamu (bila
modul whatsapp aktif & tertaut) berjalan di goroutine terpisah - endpoint
ini TIDAK menunggu hasil kirim WhatsApp.

`POST /api/v1/public/guests/by-token/{token}/wish` menyimpan SATU ucapan
untuk tamu pemilik token (`{message}`, maksimal 500 karakter, nama pengirim
diambil dari baris tamu - bukan dari klien); kiriman kedua ditolak 400.
`GET .../wishes` mengembalikan maksimal 30 ucapan terbaru yang tidak
disembunyikan. Keduanya WAJIB ber-token sah (404 bila tidak) - daftar
nama tamu tidak boleh dipanen tanpa token (docs/plan/wedding-wish/PLAN.md).
`GET /api/v1/admin/wishes` berpaginasi standar (termasuk yang disembunyikan);
`PATCH /{id}/hidden` menerima `{hidden: bool}`; `DELETE /{id}` menghapus
permanen sehingga tamu itu boleh mengisi ulang. `PUT`/`DELETE`/`PATCH` pada
id yang tidak ada membalas **404**.

Endpoint `/api/v1/admin/whatsapp/*` mengelola integrasi WhatsApp
(`go.mau.fi/whatsmeow`) - lihat `docs/plan/dashboard-wa-rsvp/PLAN.md` dan
`docs/plan/whatsapp-connection-resilience/PLAN.md`.
`pair/start` memulai pairing (admin scan QR dari `status.pairingQR`);
`status` mengembalikan `loggedIn` (sesi ada) dan `connected` (socket hidup)
yang DIPISAH plus `lastConnectedAt`/`lastError`, di-polling admin tiap ~2
detik saat belum siap dan ~15 detik saat siap (tidak pernah berhenti).
`logout` SELALU membersihkan sesi lokal dan mengembalikan
`data.remoteRevoked` - `false` berarti server WhatsApp tidak sempat
dihubungi sehingga admin perlu menghapus perangkat manual di HP.
`reconnect` memulihkan koneksi manual (400 bila belum pernah pairing).
Kirim yang gagal karena koneksi masuk antrian retry otomatis (status log
`retrying`, backoff ±4 jam, maksimal 5 percobaan); `logs` menerima
`page`/`limit` (paginasi standar). Sesi WhatsApp (device &
kunci enkripsi) TIDAK tersimpan di MySQL - lihat `DATABASE.md`.

`/api/v1/admin/groups` mengelola group tamu (`docs/plan/guest-groups/PLAN.md`).
`GET` berpaginasi standar dan setiap baris membawa `guestCount` - diisi dari
SATU query `GROUP BY`, bukan satu `COUNT` per baris. `name` wajib, maksimal
100 karakter, dan **unik**; `description` opsional, maksimal 255 karakter.
`DELETE` **ditolak 400 dengan menyebut jumlah tamunya** ("Group tidak bisa
dihapus karena masih dipakai N tamu") bila group masih dipakai - frontend
menampilkan pesan itu apa adanya, tidak menulis ulang kalimatnya.
`PUT`/`DELETE` pada id yang tidak ada membalas **404**, bukan 200 (service
memanggil `GetGuestGroupByID` lebih dulu).

`POST`/`PUT` `/api/v1/admin/guests` kini **mewajibkan** `groupId` (> 0) dan
menolak `404` bila group-nya tidak ada - penegakan di backend, bukan hanya di
form (pola yang sama dengan `gender` yang wajib meski kolomnya nullable).
`DELETE /api/v1/admin/guests/{id}/rsvp` menghapus **RESERVASI**, bukan tamunya
(`docs/plan/reservation-reset-contacted-flag/PLAN.md`): `rsvp_status` balik ke
`pending`, `attending_count` ke 1, `rsvp_responded_at` jadi NULL — sementara
baris tamu, `token`, `pax_quota`, dan `checked_in_at` semuanya **tetap**.
Jangan tertukar dengan `DELETE /api/v1/admin/guests/{id}` yang menghapus
tamunya. Bersifat idempoten (tamu yang sudah `pending` tetap dibalas 200); id
yang tidak ada membalas **404**.

`PATCH /api/v1/admin/guests/{id}/contacted` menerima `{ "contacted": bool }` -
menyalakan/mematikan penanda "sudah dihubungi". Satu endpoint untuk dua arah,
karena perbedaannya cuma satu nilai boolean.

Respons `POST /api/v1/admin/checkin/scan` & `/checkin/{id}` membawa
`groupName` yang di-resolve DI SERVER: akun petugas tidak bisa memanggil
`/api/v1/admin/groups` (dijaga `RequireFullAdmin`), jadi ia tidak mungkin
memetakannya sendiri. Kosong bila tamu belum bergroup - kegagalan membaca
group **tidak pernah** menggagalkan check-in.

Seluruh `/api/v1/admin/groups*` dijaga `RequireFullAdmin`: petugas gate
MELIHAT nama group di hasil scan tapi tidak mengelolanya. Route-nya sengaja
TIDAK didaftarkan di mux root seperti `checkin/*`.

`/api/v1/admin/users` mengelola akun admin (CRUD penuh, lihat
`docs/plan/admin-users/PLAN.md`). `username` wajib unik (dicek lewat
`GetAdminUserByUsername` sebelum create/update - bukan menangkap error MySQL
1062), `password` wajib minimal 6 karakter saat create, opsional saat update
lewat `PUT /{id}` (kosong = tidak diganti).

Sejak `docs/plan/scan-checkin-gate/PLAN.md` akun **punya peran**: `role`
bernilai `admin` atau `scanner`, nilai lain ditolak 400. Pada `POST` peran
kosong berarti `admin`; pada `PUT` peran kosong berarti **tidak diubah**
(sejalan dengan `password` kosong), supaya klien lama tidak diam-diam
menurunkan peran akun. Respons `POST /api/v1/auth/login` ikut membawa
`data.role`.

`DELETE /{id}` menolak 2 kasus: menghapus akun sendiri yang sedang login
(dicek dari klaim JWT), dan menghapus **admin penuh** terakhir. `PUT /{id}`
menolak menurunkan admin penuh terakhir jadi petugas. Ketiganya mencegah
sistem terkunci total. Penghitungnya `CountFullAdmins` (`WHERE role='admin'`),
**bukan** `COUNT(*)` - dengan `COUNT(*)` apa adanya, 1 admin penuh + 3 petugas
= 4 sehingga admin penuh terakhir lolos dihapus. Lihat `BACKEND.md`.

Tiga endpoint `/api/v1/admin/checkin/*` adalah **satu-satunya** yang bisa
diakses akun petugas; sisanya `/api/v1/admin/*` membalas **403** untuk mereka.
`POST /checkin/scan` menerima `{"code": "ELW1:<token>"}` - kode berprefiks lain
atau tanpa token ditolak **400**, token tak dikenal **404**. `POST /checkin/{id}`
adalah check-in manual untuk tamu tanpa QR. Keduanya membalas bentuk yang sama,
dengan `alreadyCheckedIn` membedakan "baru datang" dari "sudah check-in"
(pemindaian kedua **tidak** menimpa `checkedInAt`, dan tidak dihitung ganda).
`GET /checkin/search?q=` dibatasi keras **20 baris** dan **tidak berpaginasi**,
jadi responsnya sengaja **tanpa `meta`**; `q` kosong membalas array kosong,
bukan 20 tamu pertama. Status RSVP tidak memblokir check-in.

`GET /checkin/arrivals` adalah menu **"Tamu Masuk"**: daftar tamu yang sudah
tiba, **terbaru di atas**, dan - berbeda dari `/checkin/search` - memang
**BERPAGINASI** dengan `meta` standar (`page`/`limit`, default 20). Alasannya
bukan gaya: daftar ini diramban dan tumbuh sepanjang acara sampai sebesar
daftar tamu, sedangkan pencarian hanya mencari satu orang.

`GET /checkin/summary` mengembalikan angka kartu gate dalam **satu** query
agregat: `arrivedGroom`, `arrivedBride`, `arrivedTotal`, `arrivedPax`,
`totalGuests`. **Perhatikan satuannya** - `arrived*` dan `totalGuests`
menghitung BARIS TAMU (undangan) sehingga "12 dari 80" selalu apple-to-apple,
sedangkan `arrivedPax` menghitung ORANG dari `attending_count`, yaitu jumlah
yang DIJANJIKAN tamu saat RSVP. Sistem ini tidak merekam hitung kepala di
pintu (§3.2 menolak kolom `checked_in_count`), jadi `arrivedPax` adalah
perkiraan dan label di UI wajib mengatakannya. Jangan menyamakan keduanya.

Respons kelima endpoint check-in sengaja **tidak memuat** `phone`, `email`,
`address`, `notes`, maupun `token` - lihat `BACKEND.md`.
