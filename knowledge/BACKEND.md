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
