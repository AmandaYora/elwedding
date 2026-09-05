# Backend

`apps/api` - Go modular monolith, `net/http` `ServeMux` bawaan (Go 1.22+
pattern matching `"METHOD /path/{param}"`), tanpa framework HTTP pihak
ketiga (anti-overengineering).

## Struktur per modul

```
internal/modules/<nama>/
├── application/service.go       # logika bisnis, DTO
├── infrastructure/repository.go  # wrapper tipis di atas sqlc.Queries
├── infrastructure/queries/*.sql  # sumber untuk `sqlc generate`
├── infrastructure/sqlc/          # KODE TER-GENERATE, jangan diedit manual
├── presentation/handler.go       # HTTP handler
└── <nama>.module.go              # wiring repo->service->handler
```

Ubah query: edit `.sql` di `infrastructure/queries/`, lalu jalankan
`npm run sqlc:generate` (butuh binary `sqlc` terpasang) dari root, atau
`cd apps/api && sqlc generate`.

## Konvensi

- `internal/shared/` murni utilitas teknis (response envelope, pagination,
  JWT encode/decode, format tanggal) - tidak ada logika domain di sana.
- `internal/router/router.go` mendaftarkan semua route dan menangani
  fallback SPA - baca komentar di `spaFallback` sebelum mengubahnya (lihat
  `ARCHITECTURE.md` untuk kenapa non-GET selalu 404 JSON).
- **`spaFallback` menyuntikkan meta Open Graph ke `index.html`** (docs/plan/
  og-share-image-dinamis/PLAN.md D1-D8). Crawler WhatsApp/Facebook tidak
  menjalankan JavaScript, jadi nilai `og:*` harus sudah benar di byte HTML
  yang dikirim - inilah satu-satunya tempat itu mungkin. Yang perlu diketahui
  sebelum menyentuhnya:
  - Datanya dibaca lewat **`content/contracts.InvitationInfoProvider`**
    (`GetShareInfo`), **bukan** dengan mengimpor internal modul `content` -
    aturan modular monolith tetap berlaku penuh untuk paket `router`
    (`.claude/rules/backend-modular-monolith.md`). Fungsi murninya ada di
    `internal/router/og_meta.go`, terpisah supaya bisa dites tanpa HTTP/DB.
  - **Setiap kegagalan WAJIB jatuh ke HTML statis, tidak pernah error**:
    provider `nil` (dev), `GetShareInfo` gagal (DB mati), `os.ReadFile` gagal,
    marker `OG_META_START/END` tidak ada di HTML, atau tidak ada gambar yang
    layak. Halaman undangan tidak boleh mati hanya karena preview tidak bisa
    dipersonalisasi. `admin.html` **tidak pernah** di-inject.
  - Gerbang injeksi adalah **ada-tidaknya gambar yang layak**, bukan judul:
    blok hasil injeksi mengganti SELURUH isi marker, jadi menyuntik judul
    tanpa gambar justru menghapus `og:image` statis dan menyisakan preview
    tanpa gambar sama sekali.
  - Kolom cover **bisa berisi video** (`.mp4`/`.webm` - migration 000010
    benar-benar pernah menyetelnya) dan `.webp` yang tidak dirender crawler.
    Fallback cover karena itu disaring `isWaCompatibleImage` (hanya
    `.png`/`.jpg`/`.jpeg`). Jangan melonggarkan daftar izin itu.
  - Origin = `"https://" + r.Host`. **Jangan** membaca `X-Forwarded-Proto`:
    nginx repo ini meneruskan `Host` tapi tidak menyetel header itu, dan
    `r.TLS` nil karena TLS diterminasi nginx.
  - **Jangan** menyetel `ETag`/`Last-Modified` dari mtime berkas pada HTML
    hasil injeksi - isinya bergantung DB, jadi validator berbasis berkas akan
    menyajikan preview basi setelah admin mengganti gambar. `Cache-Control:
    no-cache, must-revalidate` yang sudah ada tetap benar dan tetap dipasang.
  - Sesudah deploy, preview lama masih bisa muncul karena WhatsApp meng-cache
    agresif - pakai **Facebook Sharing Debugger > Scrape Again** untuk
    memaksa ambil ulang sebelum menyimpulkan perbaikannya gagal.
- **`whatsapp_config` menyimpan DUA template pesan** (docs/plan/
  og-share-image-dinamis/PLAN.md Bagian B, D10-D14) - jangan menyamakan
  keduanya:
  - `message_template` -> pengiriman **QR otomatis** lewat modul `whatsapp`
    (whatsmeow), dirender `applyTemplate` dan dipanggil `sendQR` sesudah tamu
    RSVP. Placeholder: `{nama}`, `{jumlah}`, `{mempelai}`, `{tanggal}`.
  - `invitation_template` -> tombol **"Kirim Undangan"** per tamu di menu
    Tamu, yang **murni klien lewat `wa.me`** dan **tidak menyentuh modul
    `whatsapp` sama sekali**: tidak ada `Sender`, tidak ada JID, tidak ada
    baris di `whatsapp_send_logs`, dan **tidak ada endpoint backend** dalam
    alur pengirimannya. Pesannya dirakit di browser dari dua endpoint yang
    sudah ada (`GET /admin/whatsapp/config` + `GET /admin/content`).
    Placeholder: `{nama}`, `{mempelai}`, `{tanggal}`, `{link}` - **TANPA**
    `{jumlah}`, karena saat undangan dikirim tamu belum RSVP.
  - Pengiriman undangan **tidak dilacak** dan memang tidak bisa: `wa.me`
    secara desain tidak melaporkan apa pun kembali ke aplikasi. Jangan
    menambahkan kolom `invitation_sent_at` atau status "terkirim" - itu akan
    jadi klaim yang tidak bisa dibuktikan.
- **`is_enabled` pada `whatsapp_config` HANYA mengatur jalur QR otomatis.**
  Tombol Kirim Undangan dikirim manual per tamu dan sengaja **tidak** ikut
  toggle itu: kalau disamakan, admin yang mematikan auto-send QR akan
  diam-diam kehilangan tombol Kirim Undangan tanpa penjelasan apa pun.
- **Aturan normalisasi nomor telepon kini ada di DUA bahasa** dan harus
  diubah bersamaan: `normalizePhone` di
  `internal/modules/whatsapp/application/service.go` (jalur QR) dan
  `normalizePhoneForWa` di `apps/web/src/shared/lib/waInvite.ts` (jalur
  wa.me). Duplikasi ini tidak bisa dihindari - browser tidak bisa memanggil
  fungsi Go - jadi keduanya sudah diberi komentar saling merujuk. Versi TS
  sengaja membuang SEMUA karakter non-digit (nomornya datang langsung dari
  data admin yang diketik manual), versi Go hanya spasi & tanda hubung.
- Password admin di-hash `bcrypt`; JWT via `golang-jwt/jwt/v5`, secret dari
  `JWT_SECRET`.
- Koneksi DB (`internal/database/db.go`) pakai DSN dengan
  `?parseTime=true&loc=Asia%2FJakarta` - ini yang membuat konversi
  `wedding_date` -> epoch selalu benar tanpa perlu konversi timezone manual
  di kode lain.
- **Dua peran akun admin, dan penegakannya ada di middleware - bukan di menu**
  (docs/plan/scan-checkin-gate/PLAN.md K2/D7/T5). `admin_users.role` bernilai
  `admin` (akses penuh) atau `scanner` (petugas gate). Ini **membalik**
  keputusan lama "semua admin setara/tanpa role" secara sadar.
  - `authmw.RequireAdmin` **tidak diubah**: ia hanya memvalidasi JWT, dan
    petugas tetap lolos di sana. Itulah yang membuat route `/admin/checkin/*`
    bisa dibuka akun petugas.
  - `authmw.RequireFullAdmin` membungkus `RequireAdmin` lalu menolak peran
    `scanner` dengan **403**. Dipasang pada prefix `/api/v1/admin/`, jadi
    seluruh menu admin selain check-in tertutup untuk petugas.
  - **Peran KOSONG = admin penuh**, jangan pernah dibalik. JWT yang sudah
    tersimpan di localStorage admin sebelum fitur ini ada tidak punya klaim
    `role`; menolaknya akan membuat admin yang sedang login kehilangan
    seluruh menu tanpa sebab yang terlihat. Kolomnya sendiri `NOT NULL
    DEFAULT 'admin'`, jadi setiap token baru selalu berperan eksplisit.
  - Penyaringan menu di `AdminLayout.tsx` murni **kosmetik**. Jangan pernah
    memperlakukannya sebagai pembatas akses.
- **Query modul `auth` menyebut kolom SATU PER SATU, bukan `SELECT *`** -
  berbeda dari modul content/whatsapp. Kolom baru **tidak** ikut otomatis.
  Kalau `role` lupa ditambahkan di `GetAdminUserByUsername`, `Authenticate`
  selalu menerbitkan JWT berperan kosong dan - karena peran kosong berarti
  admin penuh - **seluruh pembatasan akses mati tanpa satu pun error**. Ini
  kegagalan paling senyap di modul ini.
- **Guardrail "admin terakhir" menghitung ADMIN PENUH saja** (`CountFullAdmins`,
  bukan `Count`). Dengan `COUNT(*)` apa adanya, 1 admin penuh + 3 petugas = 4,
  sehingga admin penuh terakhir lolos dihapus dan sistem terkunci permanen -
  tidak ada lagi akun yang bisa membuka menu Pengguna untuk memperbaikinya.
  Hal yang sama berlaku untuk **penurunan peran**: `canChangeRole` menolak
  admin penuh terakhir diturunkan jadi petugas. Keputusannya diekstrak jadi
  dua fungsi murni (`canDeleteAdmin`, `canChangeRole`) supaya bisa diuji tanpa
  DB - `Service` memegang `*infrastructure.Repository` konkret. `Count()` tetap
  ada dan tetap dipakai paginasi `List`; hanya guardrail yang pindah.
- **Isi QR tamu adalah `ELW1:<token>`, bukan teks yang dibaca manusia**
  (docs/plan/scan-checkin-gate/PLAN.md D1/T10). Format lama (nama/status/
  jumlah/tanggal) secara teknis **tidak bisa dipakai untuk identifikasi**:
  hasil pindaian tidak bisa dipetakan balik ke baris tamu, nama kembar lumrah
  di daftar tamu pernikahan, dan siapa pun bisa mengetik teks yang sama lalu
  membuat QR-nya sendiri. Berprefiks, **bukan URL** - URL membuat token tamu
  tercatat di riwayat browser siapa pun yang memindainya.
  - Prefiks `ELW1:` **kembar di dua bahasa** dan harus diubah bersamaan:
    `checkinCodePrefix` di `modules/guest/application/service.go` dan
    `composeLocalQrPayload` di `apps/web/src/components/RsvpConfirmation/
    RsvpConfirmation.tsx`. Pola yang sama dengan `normalizePhone` di atas.
    `checkin_test.go` menguji bolak-balik terbit->pindai untuk menguncinya.
  - **`qrPayload` dihitung SEBELUM `GetQRInfo`**, dan cabang gagalnya
    mengembalikan nilai yang sama. Kalau tidak, gangguan sesaat pada tabel
    `invitation_content` akan diam-diam menerbitkan QR tanpa identitas yang
    ditolak di gate - padahal token-nya tersedia sepanjang waktu di `row.Token`
    dan tidak bergantung pada `info` sama sekali.
  - Modul `whatsapp` **tidak berubah**: `renderQRPNG` memperlakukan payload
    sebagai string buram. Snapshot `qr_payload` di `whatsapp_send_logs` ikut
    menyimpan format baru dengan sendirinya.
- **Check-in ditulis lewat UPDATE bersyarat, bukan baca-lalu-tulis**
  (`MarkGuestCheckedIn`, `:execrows`):
  `UPDATE guests SET checked_in_at = NOW() WHERE id = ? AND checked_in_at IS NULL`.
  Dua petugas yang memindai QR yang sama pada detik yang sama tidak saling
  menimpa, tanpa perlu transaksi. `rows = 1` berarti baru datang; `rows = 0`
  berarti sudah check-in - dan pada kasus itu barisnya **dibaca ulang** untuk
  mengambil `checked_in_at` yang asli, karena baris yang sudah dipegang bisa
  saja terbaca sebelum petugas lain menandainya.
- **Status RSVP tidak memblokir check-in.** Tamu ber-status `pending` atau
  `not_attending` yang tetap datang harus bisa dicatat; `rsvpStatus` ikut
  dikembalikan supaya petugas melihatnya di layar. Jangan menambahkan
  penolakan berbasis status.
- **Rute `/admin/checkin/*` didaftarkan sebagai pola SPESIFIK di mux root**,
  bukan di dalam mux `admin` (docs/plan/scan-checkin-gate/PLAN.md D6). Go 1.22+
  `ServeMux` memilih pola paling spesifik, jadi `POST /api/v1/admin/checkin/scan`
  menang atas prefix `/api/v1/admin/` yang dijaga `RequireFullAdmin` - itulah
  yang membuat ketiganya bisa dibuka petugas. Mekanismenya sama persis dengan
  `GET /guests/summary` vs `PUT /guests/{id}`. **Jangan** memindahkannya ke
  dalam mux `admin` demi kerapian: akun petugas akan langsung kehilangan menu
  Scan.
- **Satuan angka ringkasan gate mudah tertukar, dan itu bukan detail sepele.**
  `GetCheckinSummary` (satu query agregat, bukan 4 COUNT terpisah)
  mengembalikan `arrived_groom`/`arrived_bride`/`arrived_total`/`total_guests`
  yang semuanya menghitung **BARIS TAMU (undangan)**, plus `arrived_pax` yang
  menghitung **ORANG**. Menyamakan keduanya menghasilkan "12 dari 80" yang
  membandingkan orang dengan undangan. `arrived_pax` sendiri berasal dari
  `attending_count` - janji tamu saat RSVP, **bukan** hitung kepala di pintu,
  karena §3.2 menolak kolom `checked_in_count`. Label di UI wajib jujur soal
  itu; jangan pernah menyajikannya sebagai jumlah orang terverifikasi.
- **Rute check-in kini ADA LIMA**, semuanya pola spesifik di mux root:
  `POST checkin/scan`, `GET checkin/search`, `GET checkin/arrivals`,
  `GET checkin/summary`, dan `POST checkin/{id}`. Keempat literal menang atas
  wildcard `{id}` **dan** atas prefix `/api/v1/admin/`. Menambah literal baru
  di bawah `checkin/` aman; memindahkan salah satunya ke mux `admin` akan
  langsung mencabutnya dari akun petugas.
- **`ListArrivals` berpaginasi, `SearchForCheckin` tidak** - dan perbedaannya
  disengaja. Daftar tamu masuk diramban serta tumbuh sepanjang acara sampai
  sebesar daftar tamu, jadi ia memakai `pagination.Meta` standar. Pencarian
  hanya mencari satu orang, jadi ia dibatasi keras 20 tanpa `meta` supaya tiap
  ketikan cuma menghasilkan satu query. Jangan menyeragamkan keduanya.
- **DTO petugas sengaja BUKAN `GuestDTO`.** `CheckinResultDTO` &
  `CheckinSearchItemDTO` & `ArrivalItemDTO` tidak membawa `phone`, `email`, `address`, `notes`,
  maupun **`token`**. Memakai ulang `GuestDTO` berarti menyerahkan kredensial
  undangan setiap tamu ke staf vendor yang berjaga di pintu. Ini keputusan
  keamanan, bukan duplikasi yang perlu "dirapikan".
